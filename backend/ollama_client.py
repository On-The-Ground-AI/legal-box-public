# ollama_client.py — Wrapper for talking to Ollama (the local LLM runtime)
#
# Ollama runs locally on your computer and serves models like Gemma 4.
# This module handles all communication with it.
#
# Ollama must be running before the backend starts.
# Start it with: ollama serve
# Pull a model with: ollama pull gemma4:e4b

import os
import httpx
import json
from typing import AsyncIterator, List, Dict, Optional
from config import OLLAMA_BASE_URL, DEFAULT_MODEL, MAX_TOKENS

# LLMs on modest hardware can take many minutes on a long contract —
# 120s was cutting off real reviews. Overridable for unusual setups.
REQUEST_TIMEOUT_SECONDS = float(os.getenv("LEGALBOX_LLM_TIMEOUT", "600"))


class OllamaClient:
    """
    Async client for the Ollama API.
    Supports both regular (full response) and streaming (word-by-word) modes.
    """

    def __init__(self, base_url: str = OLLAMA_BASE_URL):
        self.base_url = base_url
        # httpx is an async HTTP client (like requests but for async code)
        self._client = httpx.AsyncClient(
            base_url=base_url,
            # connect fast-fails when Ollama is down; read allows slow inference
            timeout=httpx.Timeout(REQUEST_TIMEOUT_SECONDS, connect=10.0),
        )

    async def list_models(self) -> List[Dict]:
        """Return a list of models currently installed in Ollama."""
        try:
            response = await self._client.get("/api/tags")
            response.raise_for_status()
            data = response.json()
            return data.get("models", [])
        except httpx.ConnectError:
            return []  # Ollama not running
        except Exception as e:
            print(f"[Ollama] Error listing models: {e}")
            return []

    async def list_running(self) -> List[Dict]:
        """Return models currently loaded in memory (Ollama /api/ps).

        Each entry includes name, size, and size_vram — used by the resource
        dashboard to show which model is resident and how much memory it holds.
        """
        try:
            response = await self._client.get("/api/ps")
            response.raise_for_status()
            return response.json().get("models", [])
        except Exception:
            return []

    async def is_available(self) -> bool:
        """Check if Ollama is running and reachable."""
        try:
            response = await self._client.get("/")
            return response.status_code == 200
        except Exception:
            return False

    async def chat(
        self,
        messages: List[Dict[str, str]],
        model: str = DEFAULT_MODEL,
        system_prompt: Optional[str] = None,
    ) -> str:
        """
        Send a conversation to the LLM and get a response.

        messages: list of {"role": "user"/"assistant", "content": "..."}
        system_prompt: instructions for the LLM (e.g. "You are a legal assistant")
        Returns: the LLM's response as a string
        """
        # Build the full message list with optional system prompt
        full_messages = []
        if system_prompt:
            full_messages.append({"role": "system", "content": system_prompt})
        full_messages.extend(messages)

        payload = {
            "model": model,
            "messages": full_messages,
            "stream": False,
            "options": {
                "num_predict": MAX_TOKENS,
                "temperature": 0.3,  # Lower = more focused/less creative (good for legal work)
            }
        }

        try:
            response = await self._client.post("/api/chat", json=payload)
            response.raise_for_status()
            data = response.json()
            return data["message"]["content"]
        except httpx.ConnectError:
            raise ConnectionError(
                "Cannot connect to Ollama. Make sure Ollama is running: run 'ollama serve' in Terminal."
            )
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                raise ValueError(
                    f"Model '{model}' not found. Pull it first: run 'ollama pull {model}'"
                )
            raise

    async def chat_stream(
        self,
        messages: List[Dict[str, str]],
        model: str = DEFAULT_MODEL,
        system_prompt: Optional[str] = None,
    ) -> AsyncIterator[str]:
        """
        Stream the LLM response token by token.
        Yields each chunk of text as it arrives — good for showing a typing effect in the UI.
        """
        full_messages = []
        if system_prompt:
            full_messages.append({"role": "system", "content": system_prompt})
        full_messages.extend(messages)

        payload = {
            "model": model,
            "messages": full_messages,
            "stream": True,
            "options": {
                "num_predict": MAX_TOKENS,
                "temperature": 0.3,
            }
        }

        async with self._client.stream("POST", "/api/chat", json=payload) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if line:
                    try:
                        chunk = json.loads(line)
                        if chunk.get("message", {}).get("content"):
                            yield chunk["message"]["content"]
                        if chunk.get("done"):
                            break
                    except json.JSONDecodeError:
                        continue

    async def generate(
        self,
        prompt: str,
        model: str = DEFAULT_MODEL,
        system_prompt: Optional[str] = None,
    ) -> str:
        """
        Simple single-turn generation (no conversation history).
        Used for summarization, extraction tasks etc.
        """
        messages = [{"role": "user", "content": prompt}]
        return await self.chat(messages, model=model, system_prompt=system_prompt)

    async def pull_model_stream(self, model_name: str) -> AsyncIterator[dict]:
        """
        Stream Ollama model pull progress.
        Yields parsed JSON dicts from Ollama's /api/pull endpoint.
        Each dict may have: status, completed, total, digest.
        """
        import asyncio
        payload = {"name": model_name, "stream": True}
        try:
            async with httpx.AsyncClient(
                base_url=self.base_url,
                timeout=None,  # Pulls can take many minutes
            ) as client:
                async with client.stream("POST", "/api/pull", json=payload) as response:
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        if line:
                            try:
                                yield json.loads(line)
                            except json.JSONDecodeError:
                                pass
                            await asyncio.sleep(0)  # Prevent buffering
        except httpx.ConnectError:
            yield {"status": "error", "error": "Cannot connect to Ollama. Is it running?"}

    async def delete_model(self, model_name: str) -> bool:
        """Delete an installed model from Ollama. Returns True on success."""
        try:
            response = await self._client.request("DELETE", "/api/delete", json={"name": model_name})
            return response.status_code == 200
        except Exception:
            return False

    async def close(self):
        """Clean up the HTTP client when shutting down."""
        await self._client.aclose()


# ──────────────────────────────────────────────
# SYSTEM PROMPTS FOR DIFFERENT TOOLS
# ──────────────────────────────────────────────

CHAT_SYSTEM_PROMPT = """You are a legal assistant for Singapore law firms.
You help lawyers with research, document analysis, drafting, and legal questions.

Important rules:
- Focus on Singapore law and Singapore court procedure
- Be precise and cite specific rules or statutes where you know them
- Always note that your output should be reviewed by a qualified lawyer
- Keep responses clear and well-structured
- If you are not sure about something, say so clearly"""

SUMMARIZE_SYSTEM_PROMPT = """You are a legal document summarizer for Singapore law firms.
Your job is to extract the key information from legal documents clearly and concisely.

For each document, provide:
1. Document type and purpose
2. Key parties involved
3. Main obligations or findings
4. Important dates or deadlines
5. Key risks or points needing attention

Use clear headings and bullet points. Be thorough but concise."""

RAG_SYSTEM_PROMPT = """You are a legal research assistant for Singapore law firms.
You have been given excerpts from relevant case law and legal documents.

When answering:
1. Base your answer on the provided case excerpts
2. Cite specific cases when referencing them (case name + paragraph)
3. Note if the provided cases do not fully answer the question
4. Be precise about Singapore law
5. If case excerpts conflict, explain the different positions"""
