---
name: log-monitoring
description: Monitor logs and diagnose application issues. Use when reading workflow logs, filtering error messages, analyzing server crashes, checking deployment logs, or diagnosing Express/Node.js or Python app errors. Also covers production (deployment) log analysis.
---

# Log Monitoring & Diagnostics

## This Workspace: Reading Workflow Logs

**Always use `refresh_all_logs` tool** to get current logs from all running workflows.

```
refresh_all_logs
→ writes logs to /tmp/logs/<workflow>_<timestamp>.log
→ returns a preview + full file paths
```

Then read or search the log files:
```bash
# Search for errors
grep -i "error\|exception\|fatal" /tmp/logs/api-server_*.log

# Search for a specific pattern
grep "POST /api/users" /tmp/logs/api-server_*.log

# Last N lines
tail -50 /tmp/logs/api-server_*.log

# Follow a log file (last 100 lines)
tail -n 100 /tmp/logs/api-server_*.log
```

---

## Log Levels (severity order)

| Level | Meaning | Action needed |
|---|---|---|
| `DEBUG` | Verbose dev info | Usually ignore in production |
| `INFO` | Normal operations | Good baseline |
| `WARN` | Potential issue, non-fatal | Investigate if repeated |
| `ERROR` | Something failed | Investigate immediately |
| `FATAL` | App crashed or cannot continue | Fix urgently |

**Filter by severity:**
```bash
grep "ERROR\|FATAL" logfile.log
grep -v "DEBUG\|INFO" logfile.log   # hide noisy levels
```

---

## Express / Node.js Logs

This workspace uses **pino** via `req.log` (in route handlers) and `logger` singleton.

**Expected log format (JSON):**
```json
{"level":30,"time":1712345678901,"msg":"GET /api/users 200 12ms","req":{"method":"GET","url":"/api/users"},"res":{"statusCode":200}}
```

**Common log patterns to search:**
```bash
# HTTP errors (4xx, 5xx)
grep '"statusCode":4\|"statusCode":5' logfile.log
grep -E '"statusCode":[45][0-9]{2}' logfile.log

# Slow requests
grep "ms" logfile.log | awk -F'"' '{for(i=1;i<=NF;i++) if($i~/[0-9]+ms/) print $i}' | sort -n

# Specific route
grep '"url":"/api/users"' logfile.log

# Database errors
grep -i "db\|postgres\|drizzle\|pool\|connection" logfile.log
```

**Pretty-print JSON logs (if jq available):**
```bash
cat logfile.log | jq .
cat logfile.log | jq 'select(.level >= 50)'   # WARN and above
cat logfile.log | jq 'select(.msg | contains("error"))'
```

---

## Python App Logs

```python
# Standard logging setup
import logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s"
)
logger = logging.getLogger(__name__)

logger.info("Server started on port %d", port)
logger.error("Failed to connect to DB: %s", str(e))
logger.exception("Unexpected error")   # includes stack trace
```

**Search Python logs:**
```bash
grep "ERROR\|Exception\|Traceback" app.log
grep -A 10 "Traceback" app.log   # show 10 lines after each traceback
```

---

## grep & rg Patterns

```bash
# Basic search
grep "pattern" file.log

# Case-insensitive
grep -i "error" file.log

# Show N lines of context around match
grep -C 5 "error" file.log        # 5 lines before + after
grep -A 10 "Traceback" file.log   # 10 lines after
grep -B 3 "500" file.log          # 3 lines before

# Multiple patterns (OR)
grep -E "error|exception|fatal" file.log

# Count occurrences
grep -c "error" file.log

# Exclude pattern
grep -v "DEBUG" file.log

# Search recursively (rg — faster)
rg "error" /tmp/logs/
rg -i "exception" /tmp/logs/ --type log
rg "POST /api" /tmp/logs/ -C 3
```

---

## Deployment / Production Logs

Use `fetch_deployment_logs` tool to get production logs.

```
fetch_deployment_logs()                     # all recent logs
fetch_deployment_logs({ message: "ERROR" }) # filter by pattern
fetch_deployment_logs({ message: "(?i)database" })  # case-insensitive
fetch_deployment_logs({
    message: "ERROR",
    message_context: { lines: 10, limit: 3 }  # show 10 lines context per match
})
```

**Common production investigations:**

| Symptom | Search pattern |
|---|---|
| App crashes on startup | `FATAL\|Error\|failed to start` |
| DB connection failing | `(?i)database\|connection refused\|ECONNREFUSED` |
| Auth issues | `(?i)auth\|401\|403\|token\|unauthorized` |
| Slow responses | `timeout\|ETIMEDOUT\|slow` |
| 500 errors | `500\|Internal Server Error` |

---

## Structured Log Analysis Workflow

1. **Get logs** — use `refresh_all_logs` (dev) or `fetch_deployment_logs` (prod)
2. **Scan for severity** — `grep -i "error\|fatal\|exception"` to find problems
3. **Get context** — use `-C 10` or `-A 20` to see what happened before/after
4. **Find pattern** — is it repeated? What triggers it? Time of day?
5. **Correlate** — match log timestamps to specific user actions or deployments
6. **Fix** — address root cause, not just the symptom

---

## Log Line Parsing

```bash
# Extract timestamps from JSON logs
cat logfile.log | jq -r '.time | todate'

# Count errors per minute
grep '"level":50' logfile.log | jq -r '.time | todate' | cut -c1-16 | sort | uniq -c

# Top error messages
grep '"level":50' logfile.log | jq -r '.msg' | sort | uniq -c | sort -rn | head -10
```

---

## Logging Best Practices (for writing server code)

- Use `req.log` in route handlers (attached by pino-http)
- Use the singleton `logger` for non-request code (startup, background jobs)
- Never use `console.log` in server code — it bypasses structured logging
- Log at the right level: `info` for normal ops, `warn` for degraded, `error` for failures
- Always log errors with context: `logger.error({ err, userId }, "Operation failed")`
- Don't log secrets, tokens, passwords, or PII
