---
name: system-inspect
description: Inspect the Linux/NixOS system environment. Use when checking what processes are running, which ports are in use, CPU or memory usage, disk space, system files, or when something is "stuck" or "not responding". Specific to Replit/NixOS environment.
---

# System Inspection

## Environment Notes (Replit / NixOS)

- OS: **NixOS** (not Ubuntu/Debian — `apt` does NOT work)
- Package manager: `nix` (or use `installSystemDependencies` callback)
- Tools available: `ps`, `ss`, `ls`, `df`, `free`, `cat /proc/*`
- Some tools like `htop`, `lsof` may need to be installed
- User is NOT root — `sudo` may be unavailable

## Processes

```bash
# List all running processes
ps aux

# Search for a specific process
ps aux | grep node
ps aux | grep python
ps aux | grep pnpm

# Show process tree
ps auxf

# Find process by name
pgrep -l node
pgrep -l python

# Kill a process
kill <PID>          # graceful (SIGTERM)
kill -9 <PID>       # force (SIGKILL)
pkill node          # kill by name (SIGTERM)
pkill -9 python     # force kill by name
```

**Check if a specific service is running:**
```bash
ps aux | grep "api-server" | grep -v grep
# if no output → not running
```

## Ports & Network

```bash
# List all listening ports
ss -tlnp

# Find what's using a specific port
ss -tlnp | grep :8080
ss -tlnp | grep :3000

# All established connections
ss -tnp

# Show all TCP connections (including closed)
ss -tanp
```

**Check if a service is reachable:**
```bash
curl -s localhost:80/api/healthz
curl -I localhost:3000

# Via the Replit proxy (correct way):
curl localhost:80/api/healthz    # routes through shared proxy
# NOT: curl localhost:8080/...   # wrong — never hit ports directly
```

**Port reference for this workspace:**
- `:80` — shared reverse proxy (use this for all curl tests)
- API server: check `artifact.toml` for assigned port
- Vite dev servers: check `artifact.toml` for assigned port

## Memory & CPU

```bash
# Memory overview
free -h
cat /proc/meminfo | head -20

# CPU info
cat /proc/cpuinfo | grep "model name" | head -1
nproc                       # number of CPU cores

# Memory + CPU of a process (by PID)
cat /proc/<PID>/status | grep -E "VmRSS|VmPeak|Threads"

# Top processes by memory
ps aux --sort=-%mem | head -10

# Top processes by CPU
ps aux --sort=-%cpu | head -10
```

**Quick overview:**
```bash
# Single snapshot (like top, but one-shot)
ps aux --sort=-%cpu | awk 'NR<=11 {print $1,$2,$3,$4,$11}'
```

## Disk Space

```bash
# Overall disk usage
df -h

# Disk usage of a directory
du -sh .
du -sh artifacts/
du -sh node_modules/

# Find large files
find . -type f -size +10M 2>/dev/null | head -20

# Find large directories
du -sh */ 2>/dev/null | sort -hr | head -10
```

## System Files & Environment

```bash
# Environment variables
env | sort
env | grep -i path
printenv PATH
printenv NODE_ENV
printenv PORT

# Current user
whoami
id

# OS info
cat /etc/os-release
uname -a

# Open file descriptors (if lsof available)
lsof -p <PID>
lsof -i :8080       # what's using port 8080
```

## File System

```bash
# List files with details
ls -lah
ls -lah src/

# Find files
find . -name "*.log" 2>/dev/null
find . -name "*.ts" -newer package.json 2>/dev/null

# Check if file/dir exists
test -f file.txt && echo "exists" || echo "missing"
test -d dir/     && echo "exists" || echo "missing"

# File permissions
stat file.txt
chmod +x script.sh
```

## Node.js / pnpm Specific

```bash
# Node version
node --version
npm --version
pnpm --version

# Installed global packages
npm list -g --depth=0
pnpm list -g

# Workspace package info
pnpm list --filter @workspace/api-server

# Check if pnpm packages are installed
ls node_modules/ | head -20
test -d node_modules && echo "installed" || echo "run pnpm install"
```

## Python Specific

```bash
# Python version
python --version
python3 --version
which python

# Installed packages
pip list
pip show flask

# Check if running in venv
python -c "import sys; print(sys.prefix)"
echo $VIRTUAL_ENV
```

## Quick Health Check Script

```bash
echo "=== PROCESSES ===" && ps aux | grep -E "node|python|pnpm" | grep -v grep
echo "=== PORTS ===" && ss -tlnp
echo "=== MEMORY ===" && free -h
echo "=== DISK ===" && df -h /
echo "=== ENV ===" && echo "PORT=$PORT NODE_ENV=$NODE_ENV"
```

## Common Problems & Solutions

| Problem | Command to diagnose | Fix |
|---|---|---|
| Port already in use | `ss -tlnp \| grep :<PORT>` | Kill the process using that port: `kill $(ss -tlnp \| grep :<PORT> \| awk '{print $6}' \| cut -d',' -f2 \| cut -d'=' -f2)` |
| Process not responding | `ps aux \| grep <name>` | `pkill -9 <name>`, then restart workflow |
| Out of disk space | `df -h` | `du -sh */ \| sort -hr` to find culprits, delete large files |
| High memory usage | `ps aux --sort=-%mem \| head -10` | Identify and restart heavy process |
| Workflow not starting | `pnpm --filter @workspace/X run dev` manually | Check error output directly |
