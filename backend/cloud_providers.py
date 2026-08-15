# cloud_providers.py — Cloud LLM provider abstraction
#
# Supports OpenAI, Anthropic, Groq, and Google Gemini.
# Each provider is a simple async function that takes (messages, model, system_prompt)
# and returns a string response.

import httpx
from typing import List, Dict, Optional


async def call_openai(
    messages: List[Dict],
    model: str,
    system_prompt: Optional[str],
    api_key: str,
    base_url: str = "https://api.openai.com/v1",
) -> str:
    """Call OpenAI Chat Completions API (v1)."""
    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=api_key, base_url=base_url)
    full_messages = []
    if system_prompt:
        full_messages.append({"role": "system", "content": system_prompt})
    full_messages.extend(messages)
    resp = await client.chat.completions.create(model=model, messages=full_messages)
    return resp.choices[0].message.content or ""


async def call_anthropic(
    messages: List[Dict],
    model: str,
    system_prompt: Optional[str],
    api_key: str,
    base_url: str = "https://api.anthropic.com",
) -> str:
    """Call Anthropic Messages API."""
    async with httpx.AsyncClient(base_url=base_url, timeout=120) as client:
        headers = {
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
        payload = {"model": model, "messages": messages, "max_tokens": 2048}
        if system_prompt:
            payload["system"] = system_prompt
        resp = await client.post("/v1/messages", json=payload, headers=headers)
        resp.raise_for_status()
        data = resp.json()
        return data.get("content", [{}])[0].get("text", "")


async def call_groq(
    messages: List[Dict],
    model: str,
    system_prompt: Optional[str],
    api_key: str,
    base_url: str = "https://api.groq.com/openai/v1",
) -> str:
    """Call Groq's OpenAI-compatible API."""
    return await call_openai(messages, model, system_prompt, api_key, base_url)


async def call_gemini(
    messages: List[Dict],
    model: str,
    system_prompt: Optional[str],
    api_key: str,
    base_url: str = "https://generativelanguage.googleapis.com/v1beta",
) -> str:
    """Call Google Gemini API."""
    async with httpx.AsyncClient(base_url=base_url, timeout=120) as client:
        # Convert messages to Gemini format
        contents = []
        for msg in messages:
            role = "user" if msg["role"] == "user" else "model"
            contents.append({"role": role, "parts": [{"text": msg["content"]}]})
        payload = {"contents": contents}
        if system_prompt:
            payload["system_instruction"] = {"parts": [{"text": system_prompt}]}
        resp = await client.post(
            f"/models/{model}:generateContent?key={api_key}",
            json=payload,
        )
        resp.raise_for_status()
        data = resp.json()
        candidates = data.get("candidates", [])
        if candidates:
            parts = candidates[0].get("content", {}).get("parts", [])
            return "".join(p.get("text", "") for p in parts)
        return ""


# Registry of providers
PROVIDERS = {
    "openai": call_openai,
    "anthropic": call_anthropic,
    "groq": call_groq,
    "gemini": call_gemini,
}

# Default models per provider
DEFAULT_MODELS = {
    "openai": "gpt-4o-mini",
    "anthropic": "claude-3-5-sonnet",
    "groq": "llama-3.1-70b-versatile",
    "gemini": "gemini-1.5-flash",
}


async def call_provider(
    provider: str,
    messages: List[Dict],
    model: Optional[str],
    system_prompt: Optional[str],
    api_key: str,
    base_url: str = "",
) -> str:
    """Route a call to the appropriate cloud provider."""
    if provider not in PROVIDERS:
        raise ValueError(f"Unknown cloud provider: {provider}")
    func = PROVIDERS[provider]
    kwargs = {
        "messages": messages,
        "model": model,
        "system_prompt": system_prompt,
        "api_key": api_key,
    }
    if base_url:
        kwargs["base_url"] = base_url
    return await func(**kwargs)
