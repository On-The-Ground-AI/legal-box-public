# routers/models.py — In-app model management endpoints
import asyncio
import json
from typing import Optional
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

import config

router = APIRouter(prefix="/api/models", tags=["models"])

# Offline model catalog — all Ollama-library models that run on consumer
# hardware (< 65 GB). Each entry is the exact `ollama pull` name plus display
# metadata. This catalog is bundled with the app — it is never fetched from
# the internet, so new models only appear when the app itself is updated.
# Sizes are from Ollama's reported values and are approximate (Q4_K_M).
OFFLINE_MODEL_CATALOG = [
    # ── Basic (8–12 GB RAM) ──────────────────────────────────────────────
    {
        "id":          "gemma4:e4b",
        "name":        "Gemma 4 E4B",
        "description": "Google's efficient 4B — runs on most laptops. Default model.",
        "ram_gb":      8,
        "disk_gb":     5,
        "context_k":   128,
        "tier":        "basic",
    },
    {
        "id":          "gemma3:4b",
        "name":        "Gemma 3 4B",
        "description": "Previous-gen Gemma — fast on entry-level hardware.",
        "ram_gb":      8,
        "disk_gb":     5,
        "context_k":   128,
        "tier":        "basic",
    },
    {
        "id":          "gemma3n:4b",
        "name":        "Gemma 3n 4B",
        "description": "Gemma 3n — optimised for mobile-class hardware.",
        "ram_gb":      8,
        "disk_gb":     4,
        "context_k":   128,
        "tier":        "basic",
    },
    {
        "id":          "llama3.2:3b",
        "name":        "Llama 3.2 3B",
        "description": "Meta's small model — fast, good for chat and summarisation.",
        "ram_gb":      8,
        "disk_gb":     4,
        "context_k":   128,
        "tier":        "basic",
    },
    {
        "id":          "phi4-mini:3.8b",
        "name":        "Phi 4 Mini 3.8B",
        "description": "Microsoft's compact model — strong reasoning for its size.",
        "ram_gb":      8,
        "disk_gb":     4,
        "context_k":   128,
        "tier":        "basic",
    },
    {
        "id":          "nemotron-mini:4b",
        "name":        "Nemotron Mini 4B",
        "description": "NVIDIA's compact model — efficient on consumer hardware.",
        "ram_gb":      8,
        "disk_gb":     4,
        "context_k":   128,
        "tier":        "basic",
    },
    {
        "id":          "granite3.1-dense:2b",
        "name":        "Granite 3.1 Dense 2B",
        "description": "IBM's small enterprise model — fast and permissive license.",
        "ram_gb":      8,
        "disk_gb":     3,
        "context_k":   128,
        "tier":        "basic",
    },
    {
        "id":          "granite3.1-moe:3b",
        "name":        "Granite 3.1 MoE 3B",
        "description": "IBM mixture-of-experts — active params only, efficient.",
        "ram_gb":      8,
        "disk_gb":     4,
        "context_k":   128,
        "tier":        "basic",
    },
    {
        "id":          "olmo-3:7b",
        "name":        "OLMo 3 7B",
        "description": "Allen Institute's open model — fully transparent training.",
        "ram_gb":      12,
        "disk_gb":     6,
        "context_k":   128,
        "tier":        "basic",
    },
    {
        "id":          "qwen2.5:7b",
        "name":        "Qwen 2.5 7B",
        "description": "Alibaba's multilingual model — excellent Asian language support.",
        "ram_gb":      12,
        "disk_gb":     6,
        "context_k":   128,
        "tier":        "basic",
    },
    {
        "id":          "qwen2.5-coder:7b",
        "name":        "Qwen 2.5 Coder 7B",
        "description": "Alibaba's code model — strong for contract analysis.",
        "ram_gb":      12,
        "disk_gb":     6,
        "context_k":   32,
        "tier":        "basic",
    },
    {
        "id":          "qwen3:8b",
        "name":        "Qwen 3 8B",
        "description": "Latest Qwen — improved reasoning and instruction following.",
        "ram_gb":      12,
        "disk_gb":     6,
        "context_k":   128,
        "tier":        "basic",
    },
    {
        "id":          "qwen3-coder:8b",
        "name":        "Qwen 3 Coder 8B",
        "description": "Latest Qwen code model — strong structured output.",
        "ram_gb":      12,
        "disk_gb":     6,
        "context_k":   32,
        "tier":        "basic",
    },
    {
        "id":          "deepseek-r1:7b",
        "name":        "DeepSeek R1 7B",
        "description": "Reasoning model — chain-of-thought for complex legal analysis.",
        "ram_gb":      12,
        "disk_gb":     6,
        "context_k":   128,
        "tier":        "basic",
    },
    {
        "id":          "dolphin3:8b",
        "name":        "Dolphin 3 8B",
        "description": "Uncensored Llama-based — flexible for unusual queries.",
        "ram_gb":      12,
        "disk_gb":     6,
        "context_k":   128,
        "tier":        "basic",
    },
    {
        "id":          "command-r7b:7b",
        "name":        "Command R7B 7B",
        "description": "Cohere's retrieval model — strong with long documents.",
        "ram_gb":      12,
        "disk_gb":     6,
        "context_k":   128,
        "tier":        "basic",
    },
    {
        "id":          "llama3.1:8b",
        "name":        "Llama 3.1 8B",
        "description": "Meta's refined 8B — balanced speed and quality.",
        "ram_gb":      12,
        "disk_gb":     6,
        "context_k":   128,
        "tier":        "basic",
    },
    {
        "id":          "gpt-oss:20b",
        "name":        "GPT OSS 20B",
        "description": "Open-source GPT — strong general capability.",
        "ram_gb":      24,
        "disk_gb":     14,
        "context_k":   128,
        "tier":        "basic",
    },
    # ── Recommended (16–24 GB RAM) ────────────────────────────────────────
    {
        "id":          "gemma4:26b",
        "name":        "Gemma 4 26B",
        "description": "Mixture-of-Experts — only 4B params active per token. Best quality/speed balance.",
        "ram_gb":      16,
        "disk_gb":     16,
        "context_k":   256,
        "tier":        "recommended",
    },
    {
        "id":          "gemma3:12b",
        "name":        "Gemma 3 12B",
        "description": "Mid-range Gemma — strong all-rounder.",
        "ram_gb":      16,
        "disk_gb":     10,
        "context_k":   128,
        "tier":        "recommended",
    },
    {
        "id":          "gemma3n:12b",
        "name":        "Gemma 3n 12B",
        "description": "Gemma 3n — optimised mid-range.",
        "ram_gb":      16,
        "disk_gb":     8,
        "context_k":   128,
        "tier":        "recommended",
    },
    {
        "id":          "llama3.2:11b",
        "name":        "Llama 3.2 11B",
        "description": "Meta's vision-capable model — good for complex documents.",
        "ram_gb":      16,
        "disk_gb":     8,
        "context_k":   128,
        "tier":        "recommended",
    },
    {
        "id":          "llama4:17b",
        "name":        "Llama 4 17B",
        "description": "Meta's latest — strong multilingual and reasoning.",
        "ram_gb":      24,
        "disk_gb":     12,
        "context_k":   128,
        "tier":        "recommended",
    },
    {
        "id":          "qwen2.5:14b",
        "name":        "Qwen 2.5 14B",
        "description": "Alibaba's mid-range — best-in-class for Asian languages.",
        "ram_gb":      16,
        "disk_gb":     10,
        "context_k":   128,
        "tier":        "recommended",
    },
    {
        "id":          "qwen2.5-coder:14b",
        "name":        "Qwen 2.5 Coder 14B",
        "description": "Alibaba's mid-range code model — strong structured analysis.",
        "ram_gb":      16,
        "disk_gb":     10,
        "context_k":   32,
        "tier":        "recommended",
    },
    {
        "id":          "qwen3:14b",
        "name":        "Qwen 3 14B",
        "description": "Latest Qwen — improved mid-range reasoning.",
        "ram_gb":      16,
        "disk_gb":     10,
        "context_k":   128,
        "tier":        "recommended",
    },
    {
        "id":          "qwen3-coder:14b",
        "name":        "Qwen 3 Coder 14B",
        "description": "Latest Qwen code model — strong contract analysis.",
        "ram_gb":      16,
        "disk_gb":     10,
        "context_k":   32,
        "tier":        "recommended",
    },
    {
        "id":          "deepseek-r1:14b",
        "name":        "DeepSeek R1 14B",
        "description": "Reasoning model — stronger chain-of-thought than 7B.",
        "ram_gb":      16,
        "disk_gb":     10,
        "context_k":   128,
        "tier":        "recommended",
    },
    {
        "id":          "deepseek-coder-v2:16b",
        "name":        "DeepSeek Coder V2 16B",
        "description": "DeepSeek's code model — excellent for structured document tasks.",
        "ram_gb":      16,
        "disk_gb":     10,
        "context_k":   32,
        "tier":        "recommended",
    },
    {
        "id":          "mistral-nemo:12b",
        "name":        "Mistral Nemo 12B",
        "description": "Mistral's efficient 12B — strong instruction following.",
        "ram_gb":      16,
        "disk_gb":     8,
        "context_k":   128,
        "tier":        "recommended",
    },
    {
        "id":          "mistral-small:22b",
        "name":        "Mistral Small 22B",
        "description": "Mistral's small model — strong European language support.",
        "ram_gb":      24,
        "disk_gb":     14,
        "context_k":   32,
        "tier":        "recommended",
    },
    {
        "id":          "phi4:14b",
        "name":        "Phi 4 14B",
        "description": "Microsoft's model — strong reasoning, compact.",
        "ram_gb":      16,
        "disk_gb":     10,
        "context_k":   128,
        "tier":        "recommended",
    },
    {
        "id":          "nemotron-3-nano:30b",
        "name":        "Nemotron 3 Nano 30B",
        "description": "NVIDIA's MoE model — efficient 30B with active params.",
        "ram_gb":      32,
        "disk_gb":     20,
        "context_k":   128,
        "tier":        "recommended",
    },
    {
        "id":          "granite3.1-dense:8b",
        "name":        "Granite 3.1 Dense 8B",
        "description": "IBM's enterprise model — Apache 2.0, commercially safe.",
        "ram_gb":      12,
        "disk_gb":     6,
        "context_k":   128,
        "tier":        "recommended",
    },
    {
        "id":          "olmo-3:13b",
        "name":        "OLMo 3 13B",
        "description": "Allen Institute's open model — fully reproducible.",
        "ram_gb":      16,
        "disk_gb":     10,
        "context_k":   128,
        "tier":        "recommended",
    },
    {
        "id":          "devstral-2:12b",
        "name":        "Devstral 2 12B",
        "description": "Mistral's developer model — strong for structured tasks.",
        "ram_gb":      16,
        "disk_gb":     8,
        "context_k":   32,
        "tier":        "recommended",
    },
    {
        "id":          "codellama:13b",
        "name":        "Code Llama 13B",
        "description": "Meta's code model — good for contract analysis.",
        "ram_gb":      16,
        "disk_gb":     10,
        "context_k":   16,
        "tier":        "recommended",
    },
    # ── Professional (32+ GB RAM) ─────────────────────────────────────────
    {
        "id":          "gemma4:31b",
        "name":        "Gemma 4 31B",
        "description": "Full-density 31B — highest quality legal reasoning. Requires Mac Studio or equivalent.",
        "ram_gb":      32,
        "disk_gb":     20,
        "context_k":   256,
        "tier":        "professional",
    },
    {
        "id":          "gemma3:27b",
        "name":        "Gemma 3 27B",
        "description": "Previous-gen large Gemma — excellent reasoning.",
        "ram_gb":      32,
        "disk_gb":     18,
        "context_k":   128,
        "tier":        "professional",
    },
    {
        "id":          "llama3.1:70b",
        "name":        "Llama 3.1 70B",
        "description": "Meta's flagship — top-tier reasoning and instruction following.",
        "ram_gb":      48,
        "disk_gb":     40,
        "context_k":   128,
        "tier":        "professional",
    },
    {
        "id":          "llama3.2:90b",
        "name":        "Llama 3.2 90B",
        "description": "Meta's vision-capable flagship — best for complex documents.",
        "ram_gb":      64,
        "disk_gb":     55,
        "context_k":   128,
        "tier":        "professional",
    },
    {
        "id":          "qwen2.5:32b",
        "name":        "Qwen 2.5 32B",
        "description": "Alibaba's large model — best Asian language support.",
        "ram_gb":      32,
        "disk_gb":     20,
        "context_k":   128,
        "tier":        "professional",
    },
    {
        "id":          "qwen2.5:72b",
        "name":        "Qwen 2.5 72B",
        "description": "Alibaba's flagship — top-tier multilingual reasoning.",
        "ram_gb":      48,
        "disk_gb":     45,
        "context_k":   128,
        "tier":        "professional",
    },
    {
        "id":          "qwen2.5-coder:32b",
        "name":        "Qwen 2.5 Coder 32B",
        "description": "Alibaba's large code model — strong contract analysis.",
        "ram_gb":      32,
        "disk_gb":     20,
        "context_k":   32,
        "tier":        "professional",
    },
    {
        "id":          "qwen3:32b",
        "name":        "Qwen 3 32B",
        "description": "Latest Qwen large — improved reasoning.",
        "ram_gb":      32,
        "disk_gb":     20,
        "context_k":   128,
        "tier":        "professional",
    },
    {
        "id":          "deepseek-r1:32b",
        "name":        "DeepSeek R1 32B",
        "description": "Reasoning model — strongest chain-of-thought in this list.",
        "ram_gb":      32,
        "disk_gb":     20,
        "context_k":   128,
        "tier":        "professional",
    },
    {
        "id":          "deepseek-r1:70b",
        "name":        "DeepSeek R1 70B",
        "description": "DeepSeek's flagship reasoning — top-tier legal analysis.",
        "ram_gb":      48,
        "disk_gb":     40,
        "context_k":   128,
        "tier":        "professional",
    },
    {
        "id":          "codellama:34b",
        "name":        "Code Llama 34B",
        "description": "Meta's large code model — strong structured output.",
        "ram_gb":      32,
        "disk_gb":     20,
        "context_k":   16,
        "tier":        "professional",
    },
    {
        "id":          "nous-hermes2-mixtral:47b",
        "name":        "Nous Hermes 2 Mixtral 47B",
        "description": "Mixture-of-experts — strong instruction following.",
        "ram_gb":      48,
        "disk_gb":     30,
        "context_k":   32,
        "tier":        "professional",
    },
    {
        "id":          "gpt-oss:120b",
        "name":        "GPT OSS 120B",
        "description": "Open-source GPT — flagship general capability.",
        "ram_gb":      64,
        "disk_gb":     45,
        "context_k":   128,
        "tier":        "professional",
    },
]


@router.get("/recommended")
async def recommended_models():
    """
    Return the full offline-capable model catalog with hardware requirements.

    This catalog is bundled with the app — it does NOT fetch from the internet.
    New models only appear when the app itself is updated. This is intentional:
    OTG Legal Box runs in air-gapped environments where the app must never
    reach out to a remote catalog.
    """
    return {"models": OFFLINE_MODEL_CATALOG, "source": "bundled"}


class ProfilesBody(BaseModel):
    heavy: Optional[str] = None
    light: Optional[str] = None


@router.get("/profiles")
async def get_profiles():
    """
    Return the current model profile assignments plus the active (fallback) model.

    Profiles let the user install multiple models and assign one to heavy tasks
    (contracts, drafting, redline) and another to light tasks (chat, search,
    summarisation). If a slot is empty the app falls back to `active`.
    """
    return {
        "profiles": dict(config.MODEL_PROFILES),
        "active":   config.DEFAULT_MODEL,
        "tiers":    dict(config.MODEL_TIER_BY_ROUTE),
    }


@router.post("/profiles")
async def set_profiles(body: ProfilesBody):
    """Update the heavy/light profile slots. Empty string clears a slot."""
    if body.heavy is not None:
        config.MODEL_PROFILES["heavy"] = body.heavy.strip()
    if body.light is not None:
        config.MODEL_PROFILES["light"] = body.light.strip()
    config.save_settings()
    return {
        "success":  True,
        "profiles": dict(config.MODEL_PROFILES),
        "active":   config.DEFAULT_MODEL,
    }


@router.post("/pull")
async def pull_model(body: dict):
    """
    Stream model download progress from Ollama via SSE.

    Request body: {"model": "gemma4:e4b"}
    Response: text/event-stream — each event is a JSON object from Ollama.
    """
    model_name = body.get("model", "").strip()
    if not model_name:
        raise HTTPException(status_code=400, detail="model name is required")

    from ollama_client import OllamaClient
    client = OllamaClient()

    async def event_stream():
        try:
            async for progress in client.pull_model_stream(model_name):
                yield f"data: {json.dumps(progress)}\n\n"
                await asyncio.sleep(0)
            yield f"data: {json.dumps({'status': 'done'})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'status': 'error', 'error': str(e)})}\n\n"
        finally:
            await client.close()

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control":     "no-cache",
            "X-Accel-Buffering": "no",
            "Connection":        "keep-alive",
        },
    )


@router.delete("/{model_name:path}")
async def delete_model(model_name: str):
    """Delete an installed model from Ollama."""
    from ollama_client import OllamaClient
    client = OllamaClient()
    ok = await client.delete_model(model_name)
    await client.close()
    if not ok:
        raise HTTPException(status_code=500, detail=f"Failed to delete model '{model_name}'")
    return {"success": True, "message": f"Model '{model_name}' deleted."}
