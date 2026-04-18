---
name: debug-general
description: Systematically debug errors in any language (TypeScript, JavaScript, Python). Use when the user reports a bug, error, crash, or unexpected behavior. Covers reading stack traces, isolating root causes, log analysis, and the reproduce-isolate-fix-verify workflow.
---

# General Debugging

## Core Workflow

```
1. REPRODUCE  → Make the error happen consistently
2. ISOLATE    → Narrow down where it happens
3. FIX        → Make the smallest change that resolves it
4. VERIFY     → Confirm the fix and check for regressions
```

Never skip steps. Guessing at a fix before isolating the root cause usually adds new bugs.

## Reading Stack Traces

### TypeScript / JavaScript

```
Error: Cannot read properties of undefined (reading 'name')
    at getUserName (src/users.ts:24:18)     ← start here
    at handleRequest (src/routes.ts:87:12)
    at Layer.handle (node_modules/express/...)
```

- Read **top-down** — the first non-library frame is usually the root cause
- `src/users.ts:24:18` = file, line, column — go directly there
- Ignore `node_modules/` frames unless the error is inside a dependency

**Common TypeScript errors:**
| Error | Meaning | Fix |
|---|---|---|
| `Cannot read properties of undefined` | Accessed property on null/undefined | Add null check: `obj?.prop` or `if (obj)` |
| `is not assignable to type` | Type mismatch | Fix the type or add a cast |
| `Property X does not exist on type Y` | Wrong object shape | Check the type definition |
| `Module not found` | Wrong import path or missing package | Fix path, run `pnpm install` |
| `TS2345`, `TS2322` | Type assignment errors | Read error message, fix types |

### Python

```
Traceback (most recent call last):
  File "main.py", line 12, in <module>
    result = process(data)
  File "main.py", line 8, in process
    return data["key"]       ← actual error location
KeyError: 'key'
```

- Read **bottom-up** — last frame before the error = root cause
- `File "main.py", line 8` → go to that line
- The final line (`KeyError: 'key'`) = what went wrong

**Common Python errors:**
| Error | Meaning | Fix |
|---|---|---|
| `KeyError` | Dict key doesn't exist | Use `dict.get(key)` or check first |
| `AttributeError` | Method/attr doesn't exist on object | Check object type with `type(obj)` |
| `TypeError` | Wrong type passed | Check function signature |
| `ImportError` | Module not installed or wrong path | `pip install X` or fix import path |
| `IndentationError` | Mixed tabs/spaces | Use consistent 4-space indentation |
| `RecursionError` | Infinite recursion | Add base case or limit |

## Isolating the Problem

### Binary search approach
1. Comment out half the relevant code — does the error still occur?
2. If yes, problem is in the remaining half. If no, it's in what you commented out.
3. Repeat until you find the exact line.

### Add temporary debug output

**TypeScript/JS:**
```typescript
console.log("DEBUG value:", JSON.stringify(value, null, 2));
console.log("DEBUG type:", typeof value);
console.log("DEBUG keys:", Object.keys(value));
```

**Python:**
```python
print(f"DEBUG value: {value!r}")
print(f"DEBUG type: {type(value)}")
import pprint; pprint.pprint(value)
```

Remove all debug output before completing the task.

### Check assumptions

Before fixing, verify what the data actually is:
```typescript
// Don't assume — log first
console.log("User before update:", user);
const updated = await updateUser(user.id, data);
console.log("User after update:", updated);
```

## Runtime vs Static Errors

| Type | When detected | How to find |
|---|---|---|
| Static / type errors | Before running | `pnpm run typecheck` / LSP diagnostics |
| Runtime errors | While running | logs, stack traces |
| Logic bugs | After running (wrong output) | add assertions, compare expected vs actual |

**Check static errors first (TypeScript):**
```bash
pnpm run typecheck
# or check a single file via LSP:
# use getLatestLspDiagnostics({ filePath: "src/foo.ts" }) in code_execution
```

## Network / API Errors

```bash
# Test an endpoint directly
curl -s localhost:80/api/healthz | jq
curl -X POST localhost:80/api/users \
  -H "Content-Type: application/json" \
  -d '{"name":"test"}' | jq

# Check response status
curl -I localhost:80/api/users
```

Common HTTP errors:
| Status | Meaning | Debug approach |
|---|---|---|
| `400` | Bad request | Check request body, validation errors |
| `401` | Unauthorized | Check auth token/header |
| `404` | Not found | Check route path, router registration |
| `500` | Server error | Check server logs for stack trace |
| `503` | Service down | Check if server workflow is running |

## Debugging in This Workspace

```bash
# Run typecheck across all packages
pnpm run typecheck

# Run API server in dev mode (hot reload)
pnpm --filter @workspace/api-server run dev

# Check workflow logs
# Use refresh_all_logs tool — reads current logs from all workflows

# Test API
curl localhost:80/api/healthz
```

## Checklist Before Declaring Fixed

- [ ] Error no longer occurs on the original reproduction steps
- [ ] Related functionality still works (no regression)
- [ ] Debug `console.log` / `print` statements removed
- [ ] `pnpm run typecheck` passes (for TypeScript changes)
- [ ] Checked edge cases: null, empty, zero, very large values
