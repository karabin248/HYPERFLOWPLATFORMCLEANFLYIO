"""
Hyperflow Python Core — canonical Python runtime

Serves as the canonical Python runtime for the Hyperflow TS shell.

Endpoints (contract-stable — TS shell depends on these):
  GET  /v1/health
  GET  /v1/logs/recent
  POST /v1/explore
  POST /v1/run          ← full 6-phase EDDE pipeline + LLM via OpenRouter
  POST /v1/agent/run    ← agent-native execution (Phase 2 Agent Platform)
  POST /v1/workflow/run
  POST /v1/workflow/resume
  POST /v1/repositories/scan
  POST /v1/repositories/graph

New in v0.3.0:
  GET  /v1/session      ← session memory summary (in-process ring buffer)
  GET  /v1/mps-profiles ← MPS level profiles reference

Canonical phase names (source of truth: configs/canonical_semantics.json):
  perceive → extract_essence → sense_direction → synthesize → generate_options → choose
  🌈          💎                 🔥              🧠           🔀                 ⚡
"""

# NOTE: We intentionally avoid `from __future__ import annotations` here.
# Pydantic's schema generation relies on runtime evaluation of type hints,
# and postponed evaluation can cause unresolved forward references for
# common typing names (e.g. Optional).  Removing the future import ensures
# that annotations are actual types rather than strings.

import asyncio
import hmac
import os
import re
import sys
import tempfile
import uuid
from collections import deque
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Deque, Dict, List, Optional

import typing  # ensure Optional and other typing symbols available for forward refs

import logging

from fastapi import Depends, FastAPI, HTTPException, Header, Query, Request as FastAPIRequest
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

core_logger = logging.getLogger("hyperflow.core")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")

# Allow sibling module imports when running from this directory
sys.path.insert(0, str(Path(__file__).parent))

from hyperflow import __version__ as HYPERFLOW_VERSION
from openrouter import OpenRouterUnavailable, call_model as _call_openrouter, close_client as _close_openrouter_client
from language.emoji_parser import CANONICAL_COMBO, CANONICAL_PHASES, parse as parse_emoji
from language.intent_resolver import resolve as resolve_intent
from control.mps_controller import MPS_PROFILES, build_mps_context
from engine.edde_orchestrator import _candidate_paths, run_edde
from memory.store import (
    get_session_summary,
    push_session,
    save_knowledge,
    save_trace,
)
from scanner.core import (
    _SCAN_MAX_DURATION_S,
    _SCAN_MAX_REPOS,
    analyze_repo_real,
    analyze_repo_stub,
    compute_overlap_scores,
)

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

def _cors_origins_from_env() -> List[str]:
    """Resolve allowed browser origins for the core service.

    The core normally sits behind the TS shell, so a permissive wildcard should
    not be the default. Support both the old and new env var names for
    compatibility and fall back to localhost dev origins only.
    """
    raw = (
        os.environ.get("HYPERFLOW_CORE_CORS_ORIGINS")
        or os.environ.get("CORS_ALLOW_ORIGINS")
        or "http://localhost:3000,http://localhost:3001"
    ).strip()
    origins = [origin.strip() for origin in raw.split(",") if origin.strip()]
    return origins or ["http://localhost:3000", "http://localhost:3001"]


app = FastAPI(title="Hyperflow Python Core", version=HYPERFLOW_VERSION)


@app.on_event("shutdown")
async def _shutdown_openrouter_client() -> None:
    await _close_openrouter_client()

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins_from_env(),
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Correlation-Id", "X-Timeout-Hint-Ms", "X-Internal-Token"],
)

# ---------------------------------------------------------------------------
# Internal token auth — CRIT-01 fix
# All non-health endpoints require X-Internal-Token to match
# HYPERFLOW_CORE_TOKEN env var (when the env var is set).
# In dev mode (env var unset) the check is skipped — explicitly documented.
# The TS shell must forward this header via pythonClient.ts.
# ---------------------------------------------------------------------------

_CORE_TOKEN: str = os.environ.get("HYPERFLOW_CORE_TOKEN", "").strip()
_RUNTIME_ENV: str = (
    os.environ.get("NODE_ENV")
    or os.environ.get("HYPERFLOW_ENV")
    or os.environ.get("ENV")
    or "development"
).strip().lower()

if not _CORE_TOKEN:
    if _RUNTIME_ENV not in {"development", "dev", "local", "test", "testing"}:
        core_logger.critical(
            "HYPERFLOW_CORE_TOKEN is required when runtime env is %r. "
            "Refusing to start without internal token auth.",
            _RUNTIME_ENV,
        )
        raise RuntimeError("HYPERFLOW_CORE_TOKEN must be set outside development/test mode")
    core_logger.warning(
        "HYPERFLOW_CORE_TOKEN is not set — Python core is running WITHOUT "
        "internal token auth. This is allowed only for development/test mode."
    )


async def _require_internal_token(x_internal_token: str = Header(default="")) -> None:
    """FastAPI dependency: verify X-Internal-Token against HYPERFLOW_CORE_TOKEN.

    If HYPERFLOW_CORE_TOKEN is not configured the check is bypassed so local dev
    still works.  In any production or hardened deployment the env var MUST be set
    and the TS shell MUST forward the header on every call.
    """
    if not _CORE_TOKEN:
        # Token not configured — dev mode, allow all callers.
        return
    if not hmac.compare_digest(x_internal_token, _CORE_TOKEN):
        raise HTTPException(status_code=403, detail="Forbidden: invalid internal token")

# ---------------------------------------------------------------------------
# Log store — ring buffer (shared with EDDE orchestrator via _emit callback)
# ---------------------------------------------------------------------------

_LOG_STORE: Deque[Dict[str, Any]] = deque(maxlen=200)


def _emit(event: str, run_id: str, **extra: Any) -> None:
    _LOG_STORE.append({
        "event":     event,
        "run_id":    run_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        **extra,
    })


# ---------------------------------------------------------------------------
# Canonical phase logging
# ---------------------------------------------------------------------------

_PHASE_POSITIONS: Dict[str, int] = {p: i + 1 for i, p in enumerate(CANONICAL_PHASES)}


def _log_phase_entered(run_id: str, phase: str) -> None:
    _emit("canonical_phase_entered", run_id,
          phase=phase, position=_PHASE_POSITIONS.get(phase, 0))


def _log_phase_completed(run_id: str, phase: str) -> None:
    _emit("canonical_phase_completed", run_id,
          phase=phase, position=_PHASE_POSITIONS.get(phase, 0))


# ---------------------------------------------------------------------------
# LLM wrapper — passes MPS temperature hint to call site
# ---------------------------------------------------------------------------

async def _call_llm(prompt: str, intent: str, mode: str, temperature: float):
    return await _call_openrouter(prompt, intent, mode, temperature)


# ---------------------------------------------------------------------------
# Testing / inspection utilities — thin wrappers exposed for test imports
# ---------------------------------------------------------------------------

def _classify(text: str) -> tuple[str, str, str]:
    """
    Public-for-testing wrapper around the intent resolver.

    Returns (intent, mode, output_type) for the given text with no emoji
    tokens — equivalent to a plain-text call through the extract phase.
    Used by tests/test_classify.py for direct classification assertions.
    """
    ep = parse_emoji(text)
    cleaned = ep["cleaned_text"] or text
    return resolve_intent(cleaned, ep["raw_tokens"])



# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class ExploreRequest(BaseModel):
    prompt: str
    mps_level: typing.Optional[int] = None


class RunRequest(BaseModel):
    prompt: str
    type:   typing.Optional[str] = "agent"
    name:   typing.Optional[str] = None


class AgentExecutionRequest(BaseModel):
    agent_id: str
    agent_version: str = "1.0.0"
    prompt: str
    agent_role: typing.Optional[str] = "assistant"
    agent_capabilities: typing.Optional[List[str]] = []
    run_policy: typing.Optional[Dict[str, Any]] = {}
    context: typing.Optional[Dict[str, Any]] = {}


class WorkflowStep(BaseModel):
    id:        str
    name:      str
    prompt:    str
    dependsOn: List[str] = []


class WorkflowRunRequest(BaseModel):
    workflowId: str
    name:       str
    steps:      List[WorkflowStep]


class RepositoryInput(BaseModel):
    id:   str
    name: str
    url:  str


class RepositoryScanRequest(BaseModel):
    repositories: List[RepositoryInput]


class GraphRepoInput(BaseModel):
    id:              str
    name:            str
    url:             typing.Optional[str] = None
    language:        str
    classification:  str
    dependencyCount: int
    dependencyNames: typing.Optional[List[str]] = None
    packageName:     typing.Optional[str] = None


class RepositoryGraphRequest(BaseModel):
    repositories: List[GraphRepoInput]


class CompletedNode(BaseModel):
    nodeId:      str
    name:        str
    result:      typing.Optional[Dict[str, Any]] = None
    startedAt:   typing.Optional[str] = None
    completedAt: typing.Optional[str] = None


class WorkflowResumeRequest(BaseModel):
    runId:          str
    workflowId:     str
    name:           str
    steps:          List[WorkflowStep]
    completedNodes: List[CompletedNode]


# ---------------------------------------------------------------------------
# Health + observability
# ---------------------------------------------------------------------------

@app.get("/v1/health")
def health():
    return {
        "status":            "ok",
        "service":           "hyperflow-python-core",
        "version":           HYPERFLOW_VERSION,
        "runtime_authority": "python-core",
        "canonical_combo":   CANONICAL_COMBO,
        "canonical_phases":  CANONICAL_PHASES,
        "mps_levels":        len(MPS_PROFILES),
    }


@app.get("/v1/logs/recent")
def logs_recent(limit: int = Query(default=20, ge=1, le=200), _: None = Depends(_require_internal_token)):
    return {"items": list(_LOG_STORE)[-limit:]}


@app.get("/v1/session")
def session(_: None = Depends(_require_internal_token)):
    """In-process session memory summary. New in v0.3.0."""
    return get_session_summary()


@app.get("/v1/mps-profiles")
def mps_profiles_ref(_: None = Depends(_require_internal_token)):
    """MPS profile reference table. New in v0.3.0."""
    return {"profiles": MPS_PROFILES}


# ---------------------------------------------------------------------------
# /v1/explore — emoji-aware path exploration (no LLM call)
# ---------------------------------------------------------------------------

@app.post("/v1/explore")
def explore(req: ExploreRequest, _: None = Depends(_require_internal_token)):
    ep = parse_emoji(req.prompt)
    cleaned = ep["cleaned_text"] or req.prompt
    intent, mode, _ = resolve_intent(cleaned, ep["raw_tokens"])
    mps_ctx = build_mps_context(
        intent=intent,
        mode=mode,
        emoji_tokens=ep["raw_tokens"],
        mps_level_hint=req.mps_level or ep["mps_level_hint"],
        canonical_combo_detected=ep["canonical_combo_detected"],
    )
    paths = _candidate_paths(intent, req.prompt, mps_ctx["max_candidates"])
    selected = max(paths, key=lambda p: p["evaluation_score"]) if paths else {}
    return {
        "paths":               paths,
        "selected_path_label": selected.get("label", ""),
        "selected_path_key":   selected.get("path_key", ""),
        "selection_reason": (
            f"Score {selected.get('evaluation_score', 0)} — "
            f"intent '{intent}', MPS {mps_ctx['level']} ({mps_ctx['name']})."
        ),
        "emoji_parse": ep,
        "mps_context": mps_ctx,
    }


# ---------------------------------------------------------------------------
# /v1/run — FULL 6-PHASE EDDE PIPELINE
# ---------------------------------------------------------------------------

_KNOWLEDGE_FORMAT_MAP: Dict[str, str] = {
    "analytical":    "structured_insight",
    "generative":    "final_insight",
    "transformative":"structured_insight",
    "explanatory":   "final_insight",
    "retrieval":     "fragment_standard",
    "planning":      "structured_insight",
    "verification":  "structured_insight",
    "observational": "fragment_standard",
}


@app.post("/v1/run")
async def run(req: RunRequest, request: FastAPIRequest, _: None = Depends(_require_internal_token)):
    run_id     = str(uuid.uuid4())
    started_at = datetime.now(timezone.utc)
    correlation_id = request.headers.get("x-correlation-id", "")
    timeout_hint_ms = request.headers.get("x-timeout-hint-ms", "")
    if correlation_id:
        core_logger.info("run started run_id=%s correlation_id=%s", run_id, correlation_id)
    if timeout_hint_ms:
        core_logger.info("run timeout_hint run_id=%s timeout_hint_ms=%s", run_id, timeout_hint_ms)

    _emit("step_started", run_id, prompt_preview=req.prompt[:80], correlation_id=correlation_id)

    try:
        bundle = await run_edde(
            prompt=req.prompt,
            run_id=run_id,
            emit=_emit,
            call_llm=_call_llm,
            log_phase_entered=_log_phase_entered,
            log_phase_completed=_log_phase_completed,
        )
    except Exception as exc:
        error_msg = f"{type(exc).__name__}: {exc}"
        _emit("run_failed", run_id, error=error_msg)
        return {
            "run_id":           run_id,
            "intent":           "unknown",
            "mode":             "unknown",
            "output_type":      "error",
            "result":           {},
            "contract":         {},
            "quality_score":    0.0,
            "should_reset":     True,
            "knowledge_format": "fragment_standard",
            "error":            error_msg,
            "runId":            run_id,
            "type":             req.type or "agent",
            "name":             req.name or "failed run",
            "status":           "failed",
            "progress":         0,
            "startedAt":        started_at.isoformat(),
            "completedAt":      datetime.now(timezone.utc).isoformat(),
        }

    intent     = bundle["intent"]
    mode       = bundle["mode"]
    output_type= bundle["output_type"]
    result     = bundle["result"]
    q_score    = bundle["quality_score"]
    source     = bundle["source"]
    mps_ctx    = bundle["mps_context"]

    contract = {
        "input_type":  "natural_language",
        "output_type": output_type,
        "mode":        mode,
        "intent":      intent,
        "runtime":     "python-core",
        "version":     HYPERFLOW_VERSION,
        "mps_level":   mps_ctx["level"],
        "mps_name":    mps_ctx["name"],
        "constraints": {"max_tokens": 2048, "confidence_threshold": 0.60},
    }

    _emit("step_completed", run_id, source=source, quality_score=q_score,
          mps_level=mps_ctx["level"])
    _emit("run_completed",  run_id, intent=intent, mode=mode,
          source=source, quality_score=q_score, mps_level=mps_ctx["level"])

    # Best-effort memory persistence; JSONL writes are sync, so run them off the event loop.
    await asyncio.to_thread(save_knowledge, run_id, intent, mode, str(result.get("output", "")), bundle["confidence"])
    await asyncio.to_thread(
        save_trace,
        run_id=run_id, prompt=req.prompt, intent=intent, mode=mode,
        mps_context=mps_ctx,
        phases_completed=bundle["canonical_trace"]["phases_completed"],
        canonical_combo_detected=bundle["canonical_trace"]["canonical_combo_detected"],
        quality_score=q_score, source=source,
    )
    push_session(run_id, intent, mode, q_score)

    return {
        # Contract fields — TS shell reads these
        "run_id":           run_id,
        "intent":           intent,
        "mode":             mode,
        "output_type":      output_type,
        "result":           result,
        "contract":         contract,
        "quality_score":    q_score,
        "should_reset":     bundle["should_reset"],
        "knowledge_format": _KNOWLEDGE_FORMAT_MAP.get(mode, "fragment_standard"),
        # Canonical semantics — runtime-owned, never redefined by shell or panel
        "canonical_combo":  CANONICAL_COMBO,
        "canonical_phases": list(CANONICAL_PHASES),
        "canonical_trace":  bundle["canonical_trace"],
        # Run envelope — TS persistence layer
        "runId":            run_id,
        "type":             req.type or "agent",
        "name":             req.name or f"{intent} run",
        "status":           "completed",
        "progress":         100,
        "startedAt":        started_at.isoformat(),
        "completedAt":      datetime.now(timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------------------
# /v1/agent/run — AGENT-NATIVE EXECUTION (Phase 2 Agent Platform)
# ---------------------------------------------------------------------------

@app.post("/v1/agent/run")
async def agent_run(req: AgentExecutionRequest, request: FastAPIRequest, _: None = Depends(_require_internal_token)):
    run_id     = str(uuid.uuid4())
    started_at = datetime.now(timezone.utc)
    correlation_id = request.headers.get("x-correlation-id", "")
    timeout_hint_ms = request.headers.get("x-timeout-hint-ms", "")
    if correlation_id:
        core_logger.info("agent_run started run_id=%s agent_id=%s correlation_id=%s",
                         run_id, req.agent_id, correlation_id)
    if timeout_hint_ms:
        core_logger.info("agent_run timeout_hint run_id=%s timeout_hint_ms=%s", run_id, timeout_hint_ms)

    _emit("agent_run_started", run_id,
          agent_id=req.agent_id, agent_version=req.agent_version,
          agent_role=req.agent_role, correlation_id=correlation_id)

    try:
        bundle = await run_edde(
            prompt=req.prompt,
            run_id=run_id,
            emit=_emit,
            call_llm=_call_llm,
            log_phase_entered=_log_phase_entered,
            log_phase_completed=_log_phase_completed,
        )
    except Exception as exc:
        error_msg = f"{type(exc).__name__}: {exc}"
        _emit("agent_run_failed", run_id, error=error_msg,
              agent_id=req.agent_id)
        return {
            "run_id":           run_id,
            "agent_id":         req.agent_id,
            "agent_version":    req.agent_version,
            "intent":           "unknown",
            "mode":             "unknown",
            "output_type":      "error",
            "result":           {},
            "quality_score":    0.0,
            "error":            error_msg,
            "status":           "failed",
            "startedAt":        started_at.isoformat(),
            "completedAt":      datetime.now(timezone.utc).isoformat(),
        }

    intent      = bundle["intent"]
    mode        = bundle["mode"]
    output_type = bundle["output_type"]
    result      = bundle["result"]
    q_score     = bundle["quality_score"]
    source      = bundle["source"]
    mps_ctx     = bundle["mps_context"]

    contract = {
        "input_type":  "agent_execution",
        "output_type": output_type,
        "mode":        mode,
        "intent":      intent,
        "runtime":     "python-core",
        "version":     HYPERFLOW_VERSION,
        "agent_id":    req.agent_id,
        "agent_version": req.agent_version,
        "agent_role":  req.agent_role,
        "mps_level":   mps_ctx["level"],
        "mps_name":    mps_ctx["name"],
    }

    _emit("agent_run_completed", run_id,
          agent_id=req.agent_id, intent=intent, mode=mode,
          source=source, quality_score=q_score)

    await asyncio.to_thread(save_knowledge, run_id, intent, mode, str(result.get("output", "")), bundle["confidence"])
    await asyncio.to_thread(
        save_trace,
        run_id=run_id, prompt=req.prompt, intent=intent, mode=mode,
        mps_context=mps_ctx,
        phases_completed=bundle["canonical_trace"]["phases_completed"],
        canonical_combo_detected=bundle["canonical_trace"]["canonical_combo_detected"],
        quality_score=q_score, source=source,
    )
    push_session(run_id, intent, mode, q_score)

    completed_at = datetime.now(timezone.utc)
    return {
        "run_id":           run_id,
        "agent_id":         req.agent_id,
        "agent_version":    req.agent_version,
        "intent":           intent,
        "mode":             mode,
        "output_type":      output_type,
        "result":           result,
        "contract":         contract,
        "quality_score":    q_score,
        "knowledge_format": _KNOWLEDGE_FORMAT_MAP.get(mode, "fragment_standard"),
        # Canonical semantics — runtime-owned, never redefined by shell or panel
        "canonical_combo":  CANONICAL_COMBO,
        "canonical_phases": list(CANONICAL_PHASES),
        "canonical_trace":  bundle["canonical_trace"],
        "status":           "completed",
        "startedAt":        started_at.isoformat(),
        "completedAt":      completed_at.isoformat(),
    }


# ---------------------------------------------------------------------------
# Workflow — topological sort + per-step EDDE runs
# ---------------------------------------------------------------------------

def _build_dag(steps: List[WorkflowStep]) -> tuple[List[WorkflowStep], List[List[WorkflowStep]]]:
    """Build and validate the workflow DAG once, returning flat order and level batches."""
    step_map: Dict[str, WorkflowStep] = {}
    for step in steps:
        if step.id in step_map:
            raise ValueError(f"Duplicate workflow step id '{step.id}'.")
        step_map[step.id] = step

    for step in steps:
        for dep in step.dependsOn:
            if dep not in step_map:
                raise ValueError(f"Step '{step.id}' depends on unknown step '{dep}'.")

    in_degree = {step.id: len(step.dependsOn) for step in steps}
    adj: Dict[str, List[str]] = {step.id: [] for step in steps}
    for step in steps:
        for dep in step.dependsOn:
            adj[dep].append(step.id)

    queue: deque[str] = deque(step.id for step in steps if in_degree[step.id] == 0)
    order: List[WorkflowStep] = []
    levels: List[List[WorkflowStep]] = []

    while queue:
        current = list(queue)
        queue.clear()
        levels.append([step_map[sid] for sid in current])
        for sid in current:
            order.append(step_map[sid])
            for child in adj[sid]:
                in_degree[child] -= 1
                if in_degree[child] == 0:
                    queue.append(child)

    if len(order) != len(steps):
        raise ValueError("Workflow has a dependency cycle.")
    return order, levels


def _topo_sort(steps: List[WorkflowStep]) -> List[WorkflowStep]:
    order, _ = _build_dag(steps)
    return order


def _workflow_levels(steps: List[WorkflowStep]) -> List[List[WorkflowStep]]:
    _, levels = _build_dag(steps)
    return levels


async def _run_step(step: WorkflowStep) -> Dict[str, Any]:
    step_id = str(uuid.uuid4())
    started = datetime.now(timezone.utc)
    try:
        bundle = await run_edde(
            prompt=step.prompt, run_id=step_id, emit=_emit,
            call_llm=_call_llm,
            log_phase_entered=_log_phase_entered,
            log_phase_completed=_log_phase_completed,
        )
        return {
            "nodeId": step.id, "name": step.name, "status": "completed",
            "result": bundle["result"],
            "startedAt": started.isoformat(),
            "completedAt": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as exc:
        return {
            "nodeId": step.id, "name": step.name, "status": "failed",
            "result": {"error": str(exc)},
            "startedAt": started.isoformat(),
            "completedAt": datetime.now(timezone.utc).isoformat(),
        }


@app.post("/v1/workflow/run")
async def workflow_run(req: WorkflowRunRequest, _: None = Depends(_require_internal_token)):
    run_id = str(uuid.uuid4())
    started_at = datetime.now(timezone.utc)
    try:
        _, levels = _build_dag(req.steps)
    except ValueError as exc:
        return {"status": "failed", "error": str(exc), "nodes": [],
                "runId": run_id, "startedAt": started_at.isoformat(),
                "completedAt": datetime.now(timezone.utc).isoformat()}

    nodes: List[Dict[str, Any]] = []
    failed = False
    for level in levels:
        if failed:
            nodes.extend({"nodeId": step.id, "name": step.name, "status": "skipped",
                          "result": None, "startedAt": None, "completedAt": None} for step in level)
            continue
        gathered = await asyncio.gather(*[_run_step(step) for step in level], return_exceptions=True)
        level_results = [
            result if not isinstance(result, BaseException) else {
                "nodeId": level[i].id,
                "name": level[i].name,
                "status": "failed",
                "result": {"error": str(result)},
                "startedAt": None,
                "completedAt": None,
            }
            for i, result in enumerate(gathered)
        ]
        nodes.extend(level_results)
        if any(node["status"] == "failed" for node in level_results):
            failed = True

    return {
        "runId": run_id, "workflowId": req.workflowId, "name": req.name,
        "status": "failed" if failed else "completed", "nodes": nodes,
        "startedAt": started_at.isoformat(),
        "completedAt": datetime.now(timezone.utc).isoformat(),
    }


@app.post("/v1/workflow/resume")
async def workflow_resume(req: WorkflowResumeRequest, _: None = Depends(_require_internal_token)):
    started_at    = datetime.now(timezone.utc)
    completed_ids = {n.nodeId for n in req.completedNodes}
    nodes: List[Dict[str, Any]] = [
        {"nodeId": cn.nodeId, "name": cn.name, "status": "completed",
         "result": cn.result, "startedAt": cn.startedAt, "completedAt": cn.completedAt}
        for cn in req.completedNodes
    ]
    try:
        _, levels = _build_dag(req.steps)
    except ValueError as exc:
        return {"status": "failed", "error": str(exc), "nodes": nodes}

    failed = False
    for level in levels:
        pending_level = [step for step in level if step.id not in completed_ids]
        if not pending_level:
            continue
        if failed:
            nodes.extend({"nodeId": step.id, "name": step.name, "status": "skipped",
                          "result": None, "startedAt": None, "completedAt": None} for step in pending_level)
            continue
        gathered = await asyncio.gather(*[_run_step(step) for step in pending_level], return_exceptions=True)
        level_results = [
            result if not isinstance(result, BaseException) else {
                "nodeId": pending_level[i].id,
                "name": pending_level[i].name,
                "status": "failed",
                "result": {"error": str(result)},
                "startedAt": None,
                "completedAt": None,
            }
            for i, result in enumerate(gathered)
        ]
        nodes.extend(level_results)
        if any(node["status"] == "failed" for node in level_results):
            failed = True

    return {
        "runId": req.runId, "workflowId": req.workflowId, "name": req.name,
        "status": "failed" if failed else "completed", "nodes": nodes,
        "startedAt": started_at.isoformat(),
        "completedAt": datetime.now(timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------------------
# Repository scanning
# ---------------------------------------------------------------------------


def _jaccard(a: str, b: str) -> float:
    ta = set(re.split(r"[_\-/.]", a.lower()))
    tb = set(re.split(r"[_\-/.]", b.lower()))
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / len(ta | tb)


@app.post("/v1/repositories/scan")
async def repositories_scan(req: RepositoryScanRequest, _: None = Depends(_require_internal_token)):
    results = []
    overlap_scores = compute_overlap_scores([repo.model_dump() for repo in req.repositories])
    scan_started = datetime.now(timezone.utc)

    with tempfile.TemporaryDirectory() as tmp:
        work_dir = Path(tmp)
        for repo in req.repositories:
            try:
                elapsed_s = (datetime.now(timezone.utc) - scan_started).total_seconds()
                remaining_s = max(5.0, 300.0 - elapsed_s)
                analyzed = await analyze_repo_real(
                    repo.model_dump(),
                    work_dir=work_dir,
                    overlap=overlap_scores.get(repo.id, 0.0),
                    remaining_s=remaining_s,
                )
                pkg_name = repo.name.replace(" ", "-").lower()
                results.append({
                    "id": repo.id,
                    "name": repo.name,
                    "url": repo.url,
                    "language": analyzed["language"],
                    "classification": analyzed["classification"],
                    "classificationRationale": analyzed.get("classificationRationale"),
                    "dependencyCount": analyzed["dependencyCount"],
                    "dependencyNames": analyzed["dependencyNames"],
                    "packageName": pkg_name,
                    "overlapScore": analyzed["overlapScore"],
                    "status": "scanned",
                    "cloneDurationMs": analyzed.get("cloneDurationMs"),
                    "analysisDurationMs": analyzed.get("analysisDurationMs"),
                })
            except Exception as exc:
                results.append({
                    "id": repo.id, "name": repo.name, "url": repo.url,
                    "language": "unknown", "classification": "unknown",
                    "dependencyCount": 0, "dependencyNames": [], "packageName": "",
                    "overlapScore": overlap_scores.get(repo.id, 0.0), "status": "failed", "error": str(exc),
                })
    return {"status": "completed", "repositories": results}


@app.post("/v1/repositories/graph")
def repositories_graph(req: RepositoryGraphRequest, _: None = Depends(_require_internal_token)):
    repos  = req.repositories
    nodes  = [{"id": r.id, "name": r.name, "language": r.language,
               "classification": r.classification, "dependencyCount": r.dependencyCount}
              for r in repos]
    pkg_map  = {r.packageName: r.id for r in repos if r.packageName}
    name_map = {r.name: r.id for r in repos}
    edges: List[Dict[str, Any]] = []
    overlap_pairs: List[Dict[str, Any]] = []

    for r in repos:
        for dep in (r.dependencyNames or []):
            tid = (
                pkg_map.get(dep)
                or pkg_map.get(dep.replace("_", "-"))
                or pkg_map.get(dep.replace("-", "_"))
                or name_map.get(dep)
            )
            if tid and tid != r.id:
                edges.append({"source": r.id, "target": tid,
                              "weight": 1.0, "matchType": "dependency"})

    for i, a in enumerate(repos):
        for b in repos[i + 1:]:
            score = _jaccard(a.name, b.name)
            if score > 0.2:
                overlap_pairs.append({"repoA": a.id, "repoB": b.id, "score": round(score, 4)})
            if a.language == b.language:
                edges.append({"source": a.id, "target": b.id,
                              "weight": 0.5, "matchType": "affinity"})

    return {"nodes": nodes, "edges": edges, "overlapPairs": overlap_pairs}


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run("main:app", host=os.environ.get("HOST", "127.0.0.1"), port=port, reload=False)
