#!/usr/bin/env python3
"""
Doutor Bridge v6.0 — Ponte Node.js ↔ Doutor Antimatter Squad
Motor Hermes: Hermes Agent como núcleo central de raciocínio + 34 agentes especializados
Modo Triplo: Hermes API | Kernel Doutor v5.0 | Fallback HTTP (VPS/Docker)

Uso:
    python doutor-bridge.py '{"action":"chat","messages":[...]}'
    python doutor-bridge.py '{"action":"hermes_ask","prompt":"..."}'
    python doutor-bridge.py '{"action":"seo_generate","topic":"..."}'
    python doutor-bridge.py '{"action":"test"}'
"""
import json, logging, os, sys, traceback, asyncio
from pathlib import Path
from typing import Optional

logging.basicConfig(level=logging.WARNING, format="%(message)s")
logger = logging.getLogger("doutor_bridge_v6")

# ═══════════════════════════════════════════════════════════════
# CAMADA 1: Hermes Agent (núcleo central v6.0)
# ═══════════════════════════════════════════════════════════════
HERMES_AVAILABLE = False
HERMES_API_URL = os.getenv("HERMES_API_URL", "http://localhost:8642")
HERMES_API_KEY = os.getenv("HERMES_API_KEY", "")

async def _call_hermes(prompt: str, system: str = "", model: str = "") -> dict:
    """Chama Hermes Agent API (porta 8642)."""
    import aiohttp
    payload = {
        "prompt": prompt,
        "system": system or "Você é o Doutor 6.0, agência de elite headless.",
        "model": model or "google/gemma-4-31b-it:free",
        "max_tokens": 4096,
        "temperature": 0.7
    }
    headers = {"Content-Type": "application/json"}
    if HERMES_API_KEY:
        headers["Authorization"] = f"Bearer {HERMES_API_KEY}"
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{HERMES_API_URL}/api/generate",
                headers=headers, json=payload,
                timeout=aiohttp.ClientTimeout(total=120)
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    HERMES_AVAILABLE = True
                    return {"success": True, "content": data.get("response", data.get("text", "")),
                            "model": model, "provider": "hermes"}
                else:
                    return {"success": False, "error": f"Hermes HTTP {resp.status}", "provider": "hermes"}
    except Exception as e:
        return {"success": False, "error": f"Hermes: {type(e).__name__}: {e}", "provider": "hermes"}

# ═══════════════════════════════════════════════════════════════
# CAMADA 2: Kernel Doutor v5.0 (36 MCP tools, 40 agents)
# ═══════════════════════════════════════════════════════════════
DOUTOR_AVAILABLE = False
DOUTOR_CALL_LLM = None
GET_ALL_QUOTAS = None
CIRCUIT_BREAKER_STATUS = None
DOUTOR_ORCHESTRATOR = None
DOUTOR_HERMES_BRIDGE = None
DOUTOR_SEO = None
DOUTOR_GROWTH = None

try:
    _doutor_path = str(Path.home() / ".gemini" / "antigravity-ide" / "scratch" / "doutor")
    if _doutor_path not in sys.path:
        sys.path.insert(0, _doutor_path)
    
    from kernel.llm_client import call_llm as _doutor_call_llm
    from kernel.provider_quotas import get_all_quotas as _get_all_quotas, circuit_breaker_status as _cb_status
    
    # Tentar importar novos módulos v6.0
    try:
        from kernel.hermes_bridge import HermesBridge
        DOUTOR_HERMES_BRIDGE = HermesBridge
    except ImportError:
        pass
    try:
        from kernel.seo_orchestrator import SEOOrchestrator
        DOUTOR_SEO = SEOOrchestrator
    except ImportError:
        pass
    try:
        from kernel.growth_agent import GrowthAgent
        DOUTOR_GROWTH = GrowthAgent
    except ImportError:
        pass
    try:
        from kernel.orchestrator import AntimatterOrchestrator
        DOUTOR_ORCHESTRATOR = AntimatterOrchestrator
    except ImportError:
        pass
    
    DOUTOR_AVAILABLE = True
    DOUTOR_CALL_LLM = _doutor_call_llm
    GET_ALL_QUOTAS = _get_all_quotas
    CIRCUIT_BREAKER_STATUS = _cb_status
except ImportError as e:
    logger.warning(f"Kernel Doutor não disponível: {e}")

# ═══════════════════════════════════════════════════════════════
# CAMADA 3: Fallback HTTP (OpenRouter direto)
# ═══════════════════════════════════════════════════════════════
FALLBACK_API_URL = os.getenv("DOUTOR_FALLBACK_URL", "https://openrouter.ai/api/v1/chat/completions")
FALLBACK_MODEL = os.getenv("DOUTOR_FALLBACK_MODEL", "google/gemma-4-31b-it:free")
FALLBACK_API_KEY = os.getenv("OPENROUTER_API_KEY") or os.getenv("FALLBACK_API_KEY", "")

async def _fallback_llm(system: str, user: str, history: list = None) -> str:
    """Chamada HTTP direta ao OpenRouter (fallback sem kernel)."""
    import aiohttp
    if not FALLBACK_API_KEY:
        return "Nenhuma chave de API configurada. Defina OPENROUTER_API_KEY no .env"
    
    messages = [{"role": "system", "content": system}]
    if history:
        for h in history:
            messages.append({"role": h.get("role", "user"), "content": h.get("content", "")})
    messages.append({"role": "user", "content": user})

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                FALLBACK_API_URL,
                headers={"Authorization": f"Bearer {FALLBACK_API_KEY}", "Content-Type": "application/json"},
                json={"model": FALLBACK_MODEL, "messages": messages, "temperature": 0.7, "max_tokens": 2048},
                timeout=aiohttp.ClientTimeout(total=120)
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return data["choices"][0]["message"]["content"]
                else:
                    error_text = await resp.text()
                    return f"Erro HTTP {resp.status}: {error_text[:200]}"
    except Exception as e:
        print(f"[BRIDGE_DEBUG] {type(e).__name__}: {e}", file=sys.stderr)
        return f"Erro de conexão: {type(e).__name__}: {str(e)[:200]}"


async def call_llm(role: str, system: str, user: str, history: list = None):
    """Chama Hermes → Doutor Kernel → Fallback (cascata)."""
    # 1º - Tentar Hermes (mais rápido, modelo dedicado)
    hermes_result = await _call_hermes(prompt=user, system=system)
    if hermes_result.get("success"):
        return hermes_result
    
    # 2º - Tentar Kernel Doutor (36 tools, 40 agents)
    if DOUTOR_AVAILABLE and DOUTOR_CALL_LLM:
        return await DOUTOR_CALL_LLM(role=role, system=system, user=user)
    
    # 3º - Fallback HTTP
    content = await _fallback_llm(system, user, history)
    return {"content": content, "provider": "fallback_http"}


# ── System prompts ────────────────────────────────────────────
CHAT_SYSTEM = "Você é Madalena, SDR sênior da operação G5X Partners. Responda em PT-BR."
ANALYZE_SYSTEM = """Analise a mensagem e retorne JSON:
{"intenção":"agendar_reuniao|duvida|objecao|desinteresse|outro","objeção":"texto ou null",
"needs_human":true/false,"tom":"positivo|neutro|negativo","urgencia":"baixa|media|alta"}"""
GENERATE_SYSTEM = "Você é especialista em copywriting B2B. Gere mensagem persuasiva em PT-BR."
OBJECTION_SYSTEM = "Você é especialista em quebra de objeções B2B para construção civil."
INSIGHTS_SYSTEM = "Analise os dados do CRM e gere 3 insights objetivos em PT-BR."
LEAD_SCORING_SYSTEM = """Você é analista de crédito B2B. Retorne JSON:
{"score":0.0-1.0,"classificacao":"Tubarão|Qualificado|Embrião|Descartado",
"justificativa":"...","confianca":0.0-1.0,"recomendacao":"..."}"""

# ── Handlers v4.7 compatíveis ─────────────────────────────────
async def handle_chat(p):
    msgs = p.get("messages", [])
    has_sys = any(m.get("role") == "system" for m in msgs)
    if not has_sys:
        msgs.insert(0, {"role": "system", "content": CHAT_SYSTEM})
    r = await call_llm("the_wordsmith", msgs[0]["content"] if msgs[0]["role"] == "system" else CHAT_SYSTEM,
                       msgs[-1]["content"] if msgs else "", msgs[1:-1] if len(msgs) > 2 else [])
    return {"success": True, "content": r.get("content", str(r)), "provider": r.get("provider", "unknown")}

async def handle_analyze(p):
    r = await call_llm("the_scout", ANALYZE_SYSTEM, f"Mensagem: {p.get('message','')}")
    try:
        return {"success": True, **(json.loads(r.get("content","{}")) if isinstance(r,dict) else json.loads(r))}
    except:
        return {"success": True, "intenção": "desconhecida", "needs_human": True}

async def handle_generate(p):
    r = await call_llm("the_wordsmith", GENERATE_SYSTEM, f"Contexto:\n{json.dumps(p.get('context',{}), indent=2)}")
    return {"success": True, "content": r.get("content", str(r))}

async def handle_objection(p):
    r = await call_llm("the_scout", OBJECTION_SYSTEM,
                       f"Objeção: {p.get('objection','')}\nConhecimento: {p.get('knowledge','')}")
    return {"success": True, "content": r.get("content", str(r))}

async def handle_insights(p):
    r = await call_llm("the_ranker", INSIGHTS_SYSTEM, f"Dados CRM:\n{json.dumps(p.get('data',{}), indent=2)}")
    return {"success": True, "content": r.get("content", str(r))}

async def handle_score(p):
    ld = p.get("lead", {})
    r = await call_llm("the_ranker", LEAD_SCORING_SYSTEM, json.dumps(ld, indent=2))
    try:
        return {"success": True, **(json.loads(r.get("content","{}")) if isinstance(r,dict) else json.loads(r))}
    except:
        return {"success": True, "score": 0.5, "classificacao": "Desconhecido"}

async def handle_test(p):
    result = {
        "version": "6.0.0",
        "hermes_available": HERMES_AVAILABLE,
        "hermes_url": HERMES_API_URL,
        "doutor_kernel": DOUTOR_AVAILABLE,
        "doutor_tools": 36,
        "doutor_agents": 40,
        "has_hermes_bridge": DOUTOR_HERMES_BRIDGE is not None,
        "has_seo": DOUTOR_SEO is not None,
        "has_growth": DOUTOR_GROWTH is not None,
        "has_orchestrator": DOUTOR_ORCHESTRATOR is not None,
    }
    if DOUTOR_AVAILABLE:
        q = GET_ALL_QUOTAS() if GET_ALL_QUOTAS else []
        result["providers"] = len(q) if q else 0
    has_key = bool(FALLBACK_API_KEY)
    result["fallback_key_configured"] = has_key
    result["status"] = "hermes+doutor+fallback" if all([HERMES_AVAILABLE, DOUTOR_AVAILABLE]) else \
                       "doutor+fallback" if DOUTOR_AVAILABLE else \
                       "fallback_only" if has_key else "unconfigured"
    return {"success": True, **result}

# ── NOVOS Handlers v6.0 (Hermes, SEO, Growth) ─────────────────
async def handle_hermes_ask(p):
    """Pergunta direta ao Hermes Agent."""
    prompt = p.get("prompt", "")
    system = p.get("system", "")
    model = p.get("model", "")
    if not prompt:
        return {"success": False, "error": "Campo 'prompt' é obrigatório"}
    return await _call_hermes(prompt=prompt, system=system, model=model)

async def handle_hermes_status(p):
    """Status do Hermes Agent."""
    hermes_test = await _call_hermes(prompt="Status check. Reply OK.", system="You are a health check.")
    return {
        "success": True,
        "hermes_responding": hermes_test.get("success", False),
        "hermes_url": HERMES_API_URL,
        "last_response": hermes_test.get("content", "")[:100] if hermes_test.get("success") else "offline",
        "doutor_version": "6.0.0"
    }

async def handle_seo_generate(p):
    """Gera conteúdo SEO via SEO Orchestrator."""
    topic = p.get("topic", "")
    audience = p.get("audience", "")
    if not topic:
        return {"success": False, "error": "Campo 'topic' é obrigatório"}
    
    # Usar Hermes para SEO (mesmo sem SEOOrchestrator carregado)
    system = f"Você é o SEO Orchestrator do Doutor 6.0. Gere conteúdo para: {topic}"
    if audience:
        system += f"\nPúblico-alvo: {audience}"
    
    hermes_result = await _call_hermes(prompt=f"Crie um artigo SEO otimizado sobre: {topic}", system=system)
    if hermes_result.get("success"):
        return hermes_result
    
    # Fallback: LLM normal
    r = await call_llm("the_wordsmith", system, topic)
    return {"success": True, "content": r.get("content", str(r)), "provider": r.get("provider", "fallback")}

async def handle_growth_analyze(p):
    """Analisa mercado via Growth Agent."""
    niche = p.get("niche", "")
    data = p.get("data", {})
    if not niche:
        return {"success": False, "error": "Campo 'niche' é obrigatório"}
    
    system = f"Você é o Growth Agent do Doutor 6.0. Analise o mercado de: {niche}"
    prompt = f"Dados: {json.dumps(data, indent=2)}\n\nGere análise de mercado com tendências, oportunidades e riscos."
    
    hermes_result = await _call_hermes(prompt=prompt, system=system)
    if hermes_result.get("success"):
        return hermes_result
    
    r = await call_llm("the_scout", system, prompt)
    return {"success": True, "content": r.get("content", str(r)), "provider": r.get("provider", "fallback")}

# ── Dispatch v6.0 ──
ACTIONS = {
    # Compatibilidade v4.7
    "chat": handle_chat,
    "analyze": handle_analyze,
    "generate": handle_generate,
    "objection": handle_objection,
    "insights": handle_insights,
    "test": handle_test,
    "score": handle_score,
    # Novos v6.0
    "hermes_ask": handle_hermes_ask,
    "hermes_status": handle_hermes_status,
    "seo_generate": handle_seo_generate,
    "growth_analyze": handle_growth_analyze,
}

async def dispatch(action, params):
    h = ACTIONS.get(action)
    if not h: return {"success": False, "error": f"Ação desconhecida: {action}"}
    return await h(params)

def main():
    if len(sys.argv) > 1:
        try: payload = json.loads(sys.argv[1])
        except json.JSONDecodeError as e:
            print(json.dumps({"success": False, "error": f"JSON inválido: {e}"}))
            return
    else:
        payload = json.loads(sys.stdin.read())
    
    action = payload.get("action", "test")
    params = payload.get("params", payload)
    
    try:
        result = asyncio.run(dispatch(action, params))
        print(json.dumps(result, ensure_ascii=False, default=str))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e), "traceback": traceback.format_exc()},
                         ensure_ascii=False, default=str))

if __name__ == "__main__":
    main()
