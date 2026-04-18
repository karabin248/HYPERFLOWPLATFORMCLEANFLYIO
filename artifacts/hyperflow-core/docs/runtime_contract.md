# Hyperflow Runtime Contract

**Version:** 0.3.0
**Authority:** `artifacts/hyperflow-core/`
**Date:** 2026-04-09

This document defines the canonical output shape of the Hyperflow Python runtime.
Every field listed here is part of the stable contract. The TypeScript shell reads
these fields by name — changes require coordinated migration.

---

## Contract version

```
contract_version: "0.3.0"
```

Reported in the `version` field of `GET /v1/health` and in the `contract.version`
field of `POST /v1/run` responses.

One canonical version string. It lives in `hyperflow/__init__.py` as `__version__`
and is imported at startup by `main.py`:

```python
from hyperflow import __version__ as HYPERFLOW_VERSION
app = FastAPI(title="Hyperflow Python Core", version=HYPERFLOW_VERSION)
```

---

## Canonical phase names

Defined in `language/emoji_parser.py` (runtime source of truth), mirrored in
`configs/canonical_semantics.json` (reference config).

| Position | Phase | Emoji |
|---|---|---|
| 1 | `perceive` | 🌈 |
| 2 | `extract_essence` | 💎 |
| 3 | `sense_direction` | 🔥 |
| 4 | `synthesize` | 🧠 |
| 5 | `generate_options` | 🔀 |
| 6 | `choose` | ⚡ |

Phase order is fixed and enforced by construction. All 6 phases complete on every
run — no skipping.

---

## Endpoint contract table

| Endpoint | Method | Stable | Notes |
|---|---|---|---|
| `/v1/health` | GET | ✅ | Health shape below |
| `/v1/logs/recent` | GET | ✅ | Query param: `limit` (1–200) |
| `/v1/session` | GET | ✅ | In-process session ring buffer summary |
| `/v1/mps-profiles` | GET | ✅ | MPS level reference table |
| `/v1/explore` | POST | ✅ | Emoji-aware path exploration, no LLM call |
| `/v1/run` | POST | ✅ | Full 6-phase EDDE pipeline |
| `/v1/agent/run` | POST | ✅ | Agent-native execution (Phase 2) |
| `/v1/workflow/run` | POST | ✅ | Multi-step workflow with topo sort |
| `/v1/workflow/resume` | POST | ✅ | Resume from completed node set |
| `/v1/repositories/scan` | POST | ✅ | Clone + classify + extract deps |
| `/v1/repositories/graph` | POST | ✅ | Build dependency + affinity graph |

---

## `GET /v1/health` response shape

```json
{
  "status": "ok",
  "service": "hyperflow-python-core",
  "version": "0.3.0",
  "runtime_authority": "python-core",
  "canonical_combo": "🌈💎🔥🧠🔀⚡",
  "canonical_phases": ["perceive", "extract_essence", "sense_direction", "synthesize", "generate_options", "choose"],
  "mps_levels": 7
}
```

---

## `POST /v1/run` — request

```json
{
  "prompt": "string (required)",
  "type":   "string (optional, default: 'agent')",
  "name":   "string (optional)"
}
```

## `POST /v1/run` — response (success)

```json
{
  "run_id":           "uuid4",
  "intent":           "plan | analyze | generate | transform | explain | query | classify | validate | optimize | monitor | process",
  "mode":             "planning | analytical | generative | transformative | explanatory | retrieval | verification | observational",
  "output_type":      "execution_plan | analysis_report | generated_artifact | ...",
  "result": {
    "output":      "string",
    "intent":      "string",
    "mode":        "string",
    "token_count": "integer",
    "reasoning":   "string",
    "confidence":  "float 0–1",
    "source":      "llm | stub",
    "timestamp":   "ISO-8601"
  },
  "contract": {
    "input_type":  "natural_language",
    "output_type": "string",
    "mode":        "string",
    "intent":      "string",
    "runtime":     "python-core",
    "version":     "0.3.0",
    "mps_level":   "integer 1–7",
    "mps_name":    "string",
    "constraints": {
      "max_tokens":            2048,
      "confidence_threshold":  0.60
    }
  },
  "quality_score":    "float 0–1",
  "should_reset":     "boolean",
  "knowledge_format": "structured_insight | final_insight | fragment_standard",
  "canonical_combo":  "🌈💎🔥🧠🔀⚡",
  "canonical_phases": ["perceive", "extract_essence", "sense_direction", "synthesize", "generate_options", "choose"],
  "canonical_trace": {
    "canonical_combo":           "🌈💎🔥🧠🔀⚡",
    "canonical_phases":          ["perceive", "extract_essence", "sense_direction", "synthesize", "generate_options", "choose"],
    "phases_completed":          ["perceive", "extract_essence", "sense_direction", "synthesize", "generate_options", "choose"],
    "terminal_phase":            "choose",
    "order_preserved":           true,
    "cycle_version":             "1.0",
    "mps_level":                 "integer 1–7",
    "mps_name":                  "string",
    "canonical_combo_detected":  "boolean"
  },
  "runId":       "uuid4 (same as run_id — TS persistence layer alias)",
  "type":        "string",
  "name":        "string",
  "status":      "completed",
  "progress":    100,
  "startedAt":   "ISO-8601",
  "completedAt": "ISO-8601"
}
```

## `POST /v1/run` — response (failure)

```json
{
  "run_id":           "uuid4",
  "intent":           "unknown",
  "mode":             "unknown",
  "output_type":      "error",
  "result":           {},
  "contract":         {},
  "quality_score":    0.0,
  "should_reset":     true,
  "knowledge_format": "fragment_standard",
  "error":            "ExceptionType: message",
  "runId":            "uuid4",
  "type":             "agent",
  "name":             "failed run",
  "status":           "failed",
  "progress":         0,
  "startedAt":        "ISO-8601",
  "completedAt":      "ISO-8601"
}
```

---

## `POST /v1/agent/run` — Agent Execution

Agent execution uses the same canonical EDDE pipeline as `/v1/run` but accepts
a formal `AgentExecutionRequest` with agent identity, version, and policy.

### Request

```json
{
  "agent_id":          "string (required)",
  "agent_version":     "string (default: '1.0.0')",
  "prompt":            "string (required)",
  "agent_role":        "string (optional, default: 'assistant')",
  "agent_capabilities": ["string"] ,
  "run_policy":        {},
  "context":           {}
}
```

### Response (success)

```json
{
  "run_id":           "uuid4",
  "agent_id":         "string",
  "agent_version":    "string",
  "intent":           "string",
  "mode":             "string",
  "output_type":      "string",
  "result":           {},
  "contract":         {},
  "quality_score":    "float 0–1",
  "knowledge_format": "string",
  "canonical_combo":  "🌈💎🔥🧠🔀⚡",
  "canonical_phases": ["perceive", "extract_essence", "sense_direction", "synthesize", "generate_options", "choose"],
  "canonical_trace": {
    "canonical_combo":           "🌈💎🔥🧠🔀⚡",
    "canonical_phases":          ["perceive", "extract_essence", "sense_direction", "synthesize", "generate_options", "choose"],
    "phases_completed":          ["perceive", "extract_essence", "sense_direction", "synthesize", "generate_options", "choose"],
    "terminal_phase":            "choose",
    "order_preserved":           true,
    "cycle_version":             "1.0",
    "mps_level":                 "integer 1–7",
    "mps_name":                  "string",
    "canonical_combo_detected":  "boolean"
  },
  "status":      "completed",
  "startedAt":   "ISO-8601",
  "completedAt": "ISO-8601"
}
```

Agent execution guarantees:
- Uses the same EDDE 6-phase pipeline as baseline `/v1/run`
- Same `canonical_combo` and `canonical_phases` — never reinterpreted
- Agent identity is attached to the response but does not alter the execution spine
- All 6 phases complete on every run — no skipping or bypassing

---

## Normalized Output Contract

The API Server produces a `normalizedOutput` for every completed run, derived from
the raw runtime response. This is a stable contract between the API Server and
consumers (Operator Panel, external integrations).

```json
{
  "summary":             "string — human-readable summary of the result",
  "structured":          {},
  "artifacts":           ["string — list of artifact references"],
  "qualityScore":        "float 0–1 or null",
  "warnings":            ["string — any warnings from processing"],
  "nextSuggestedAction": "string or null — optional recommended next step"
}
```

The `normalizedOutput` is stored in the `agent_runs` table alongside `rawOutput`
(the unprocessed runtime response) and `output` (the legacy extracted result).

---

## Canonical Semantics Ownership

The canonical execution cycle `🌈💎🔥🧠🔀⚡` is owned exclusively by the Python Core:

- **Runtime source of truth:** `language/emoji_parser.py` → `CANONICAL_COMBO`, `CANONICAL_PHASES`
- **Reference config:** `configs/canonical_semantics.json` (must match runtime)
- **Authority model:** `authority.execution = "python_core"`, `authority.observer = "typescript_shell"`

The TypeScript shell (api-server) and operator panel:
- May **consume** canonical fields from API responses
- May **store** canonical metadata in persistence
- May **render** canonical data in the UI
- Must **never redefine** canonical combo, canonical phases, or canonical order

CI enforces this via `make canonical-check`, which:
1. Asserts exact combo and phase values at runtime
2. Validates config matches runtime
3. Scans shell and panel for redefinition patterns
4. Runs the canonical regression test suite

---

## MPS levels

| Level | Name | Temperature | Max candidates |
|---|---|---|---|
| 1 | Observation | 0.3 | 1 |
| 2 | Stabilize | 0.5 | 2 |
| 3 | Harmonize | 0.65 | 3 |
| 4 | Amplify | 0.75 | 3 |
| 5 | Dominant Core | 0.85 | 3 |
| 6 | Satellite Ops | 0.90 | 3 |
| 7 | Emergency | 0.2 | 1 |

MPS level resolution priority:
1. Explicit numeric marker from emoji parser (highest)
2. Emergency signal (`🛑`)
3. Full canonical combo detected → level 4
4. Mode-based heuristic + intent boost
5. Default → level 2

---

## Stability guarantees

- All fields in the response tables above are **stable** in v0.3.x.
- `canonical_trace` is **additive** — its presence is conditional on a successful run.
- The `runId` alias field (snake_case `run_id` + camelCase `runId`) is maintained
  for backward compatibility with the TS persistence layer.
- Fields marked with `(optional)` may be absent in error or fallback paths.
- `normalizedOutput` is guaranteed present for all completed runs; absent for failed/cancelled.

---

## Breaking change policy

No field in the stable contract above may be removed or renamed without:
1. A new contract version bump in `pyproject.toml`
2. A migration note in this document
3. A corresponding update to `artifacts/api-server/src/lib/pythonClient.ts`
4. Verified passing tests in both `artifacts/hyperflow-core/tests/` and `artifacts/api-server/tests/`
