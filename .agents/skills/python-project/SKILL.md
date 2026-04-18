---
name: python-project
description: Build, set up and run Python projects. Use when the user wants to create a Python script or app, set up a virtual environment, install pip packages, run Python code, use poetry or uv, or debug Python environment issues like wrong interpreter, missing packages, or version conflicts.
---

# Python Project

## When to Use

- Setting up a new Python project (venv, poetry, uv)
- Installing Python packages
- Running Python scripts or apps
- Debugging "module not found", wrong interpreter, or version conflict errors
- Configuring Python in this Replit/NixOS environment

## Environment: Replit / NixOS

In Replit, Python is managed via **modules** (NixOS toolchains). Do NOT use apt or brew.

**Check current Python:**
```bash
python --version
python3 --version
which python
```

**Install Python via Replit (preferred):**
Use `installProgrammingLanguage` callback in code_execution:
```javascript
const modules = await listAvailableModules({ langName: "python" });
await installProgrammingLanguage({ language: "python-3.11" });
```

## Virtual Environments

### venv (standard library — always available)
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
deactivate
```

**Check which python is active:**
```bash
which python
python -c "import sys; print(sys.prefix)"
```

### poetry
```bash
pip install poetry
poetry init
poetry add requests flask
poetry install
poetry run python main.py
poetry shell
```

Key files: `pyproject.toml`, `poetry.lock`

### uv (fastest — recommended for new projects)
```bash
pip install uv
uv venv
source .venv/bin/activate
uv pip install requests flask
uv pip install -r requirements.txt
```

`uv` is a drop-in pip replacement — use `uv pip` instead of `pip` everywhere.

## Installing Packages

```bash
pip install requests flask sqlalchemy
pip install -r requirements.txt
pip install --upgrade pip

pip list                    # list installed packages
pip show requests           # info about a package
pip freeze > requirements.txt
```

**Via Replit callback (auto-tracks in requirements.txt):**
```javascript
await installLanguagePackages({
    language: "python",
    packages: ["requests", "flask", "sqlalchemy"]
});
```

## Running Scripts

```bash
python main.py
python -m mymodule
python -c "print('hello')"

# With env variable
MY_VAR=hello python main.py

# Module as script (e.g. uvicorn, gunicorn)
python -m uvicorn app:app --reload
python -m gunicorn app:app
```

## Common Pitfalls & Fixes

| Problem | Symptom | Fix |
|---|---|---|
| Wrong interpreter | `ModuleNotFoundError` after install | `which python` — activate venv first |
| pip not in venv | packages install globally | `source .venv/bin/activate` |
| Package not found | `ModuleNotFoundError: No module named 'X'` | `pip install X` then verify with `pip list` |
| Python version mismatch | syntax errors on valid code | check `python --version`, use correct version |
| Missing env variable | `KeyError` or `None` from `os.environ` | set var: `export VAR=value` or use `.env` + `python-dotenv` |
| `__pycache__` issues | stale `.pyc` files | `find . -name "*.pyc" -delete` or `find . -type d -name __pycache__ -exec rm -rf {} +` |
| Circular imports | `ImportError: cannot import name X` | restructure modules, use lazy imports |

## Environment Variables

```bash
# .env file pattern
export DATABASE_URL="postgresql://..."
export SECRET_KEY="..."

# Load in Python
from dotenv import load_dotenv
import os
load_dotenv()
db_url = os.environ["DATABASE_URL"]
```

Install dotenv: `pip install python-dotenv`

## Project Structure (recommended)

```
myproject/
├── .venv/              # virtual env (gitignored)
├── src/
│   └── myproject/
│       ├── __init__.py
│       └── main.py
├── tests/
│   └── test_main.py
├── requirements.txt    # or pyproject.toml
└── .gitignore
```

`.gitignore` for Python:
```
.venv/
__pycache__/
*.pyc
*.pyo
.env
dist/
*.egg-info/
```

## Checking Python Setup Quickly

```bash
python --version
pip --version
pip list | grep -E "flask|requests|sqlalchemy"
python -c "import requests; print(requests.__version__)"
```
