---
name: package-management-guide
description: Manage packages across all package managers: pnpm (with workspace support), pip/poetry/uv for Python, and system-level Nix packages. Use when installing, updating, auditing, or fixing dependency conflicts in any language.
---

# Package Management Guide

## This Workspace: pnpm Monorepo

This workspace uses **pnpm workspaces** with TypeScript. Always use `pnpm`, never `npm` or `yarn`.

### pnpm — Core Commands

```bash
# Install all workspace dependencies
pnpm install

# Add a package to a specific workspace package
pnpm --filter @workspace/api-server add express
pnpm --filter @workspace/api-server add -D @types/express

# Add to a specific artifact
pnpm --filter @workspace/my-app add react-query

# Add to root (shared dev tooling only)
pnpm add -D -w prettier

# Remove a package
pnpm --filter @workspace/api-server remove lodash

# List installed packages
pnpm list
pnpm list --filter @workspace/api-server

# Check for outdated packages
pnpm outdated

# Update packages
pnpm update
pnpm update --filter @workspace/api-server
```

### pnpm — Workspace Rules

```bash
# CORRECT: always use --filter for specific packages
pnpm --filter @workspace/api-server add zod

# WRONG: running pnpm add in the root for app dependencies
pnpm add zod   # installs to root — only for repo-level tooling
```

**devDependencies vs dependencies:**
- React/Vite apps (static build): all packages → `devDependencies` (`pnpm add -D`)
- Express/server: runtime packages → `dependencies`, build tools → `devDependencies`

**Catalog packages** (already pinned in `pnpm-workspace.yaml`):
```bash
# pnpm automatically uses "catalog:" for pinned deps
pnpm --filter @workspace/api-server add zod  # uses catalog version if pinned
```

### pnpm — Troubleshooting

```bash
# Symlink issues or phantom packages
pnpm install --frozen-lockfile   # CI-style strict install

# Full clean reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install

# Check why a package is installed
pnpm why lodash
pnpm why --filter @workspace/api-server lodash
```

---

## Python Packages

### pip (standard)

```bash
pip install requests flask sqlalchemy
pip install -r requirements.txt
pip install --upgrade requests
pip uninstall requests

pip list                          # all installed
pip show requests                 # info + version
pip freeze > requirements.txt     # snapshot current env
pip check                         # verify compatibility
```

### uv (fast drop-in replacement — recommended)

```bash
uv pip install requests flask
uv pip install -r requirements.txt
uv pip list
uv pip freeze
```

### poetry

```bash
poetry add requests flask         # add to dependencies
poetry add --group dev pytest     # add dev dependency
poetry remove requests

poetry install                    # install from lock file
poetry update                     # update all
poetry update requests            # update specific
poetry show                       # list installed
poetry show --outdated
```

### Via Replit callback (preferred for new installs)

```javascript
await installLanguagePackages({
    language: "python",
    packages: ["requests", "flask", "sqlalchemy"]
});
```

This automatically tracks packages in `requirements.txt`.

---

## System Packages (NixOS / Replit)

**IMPORTANT:** This is NixOS — `apt` and `brew` do NOT work. Use Nix package names.

```javascript
// Via Replit callback (preferred):
await installSystemDependencies({
    packages: ["jq", "ffmpeg", "imagemagick"]
});
```

```bash
# Check if a tool is available
which ffmpeg
which jq
```

**Nix package name differences:**
| apt / common name | Nix package name |
|---|---|
| `libxcb` | `xorg.libxcb` |
| `libx11` | `xorg.libX11` |
| `ca-certificates` | `cacert` |
| `libjpeg` | `libjpeg` |
| `postgresql` | `postgresql` |

---

## Auditing & Security

### Node.js (pnpm)

```bash
pnpm audit
pnpm audit --fix     # auto-fix low-risk vulnerabilities
```

### Python

```bash
pip install safety
safety check

# or audit requirements.txt
pip-audit   # pip install pip-audit first
```

---

## Fixing Dependency Conflicts

### pnpm conflict

```bash
# See conflicting versions
pnpm why conflicting-package

# Pin a version in pnpm-workspace.yaml overrides:
# overrides:
#   conflicting-package: "1.2.3"

# Reinstall cleanly
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Python conflict

```bash
pip install pipdeptree
pipdeptree | grep conflicting-package

# Fix: create fresh venv
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

---

## Quick Reference

| Action | pnpm | pip/uv | Nix |
|---|---|---|---|
| Install | `pnpm --filter X add pkg` | `pip install pkg` | `installSystemDependencies` |
| Install all | `pnpm install` | `pip install -r requirements.txt` | — |
| Remove | `pnpm --filter X remove pkg` | `pip uninstall pkg` | `uninstallSystemDependencies` |
| List | `pnpm list` | `pip list` | — |
| Outdated | `pnpm outdated` | `pip list --outdated` | — |
| Audit | `pnpm audit` | `safety check` | — |
