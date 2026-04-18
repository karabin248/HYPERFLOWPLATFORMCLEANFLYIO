---
name: code-testing
description: Write and run automated tests. Use when setting up unit tests, integration tests, or end-to-end tests for TypeScript/JavaScript (vitest, jest) or Python (pytest). Covers mocking, coverage, and test strategy.
---

# Code Testing

## Test Strategy: Test What Matters

Focus on:
1. **Critical paths** — core business logic, auth, payments, data mutations
2. **Edge cases** — null, empty, boundary values, error states
3. **Integration points** — DB queries, API calls, external services

Skip:
- Trivial getters/setters
- Framework internals
- Pure UI rendering (prefer e2e for that)

---

## TypeScript / JavaScript

### Vitest (preferred in this workspace — Vite-based)

```bash
# Run all tests
pnpm --filter @workspace/api-server run test

# Watch mode
pnpm --filter @workspace/api-server run test --watch

# Single file
npx vitest run src/users.test.ts

# Coverage
npx vitest run --coverage
```

**Basic test file:**
```typescript
// src/users.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { getUserById } from "./users";

describe("getUserById", () => {
    it("returns user when found", async () => {
        const user = await getUserById(1);
        expect(user).toMatchObject({ id: 1, name: expect.any(String) });
    });

    it("throws when user not found", async () => {
        await expect(getUserById(99999)).rejects.toThrow("not found");
    });
});
```

**Mocking with vitest:**
```typescript
import { vi, describe, it, expect } from "vitest";
import * as db from "./db";

// Mock a module
vi.mock("./db", () => ({
    findUser: vi.fn()
}));

describe("service", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns user from db", async () => {
        vi.mocked(db.findUser).mockResolvedValue({ id: 1, name: "Alice" });
        const result = await getUser(1);
        expect(result.name).toBe("Alice");
        expect(db.findUser).toHaveBeenCalledWith(1);
    });
});
```

**Mocking fetch / HTTP:**
```typescript
vi.mock("node-fetch", () => ({
    default: vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: "mocked" })
    })
}));
```

### Jest (alternative)

```bash
npx jest
npx jest --watch
npx jest --coverage
npx jest src/users.test.ts
```

Same API as vitest — `describe`, `it`, `expect`, `jest.fn()`, `jest.mock()`.

### Setup vitest in a workspace package

```json
// package.json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "vitest": "catalog:"
  }
}
```

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";
export default defineConfig({
    test: {
        environment: "node",
        coverage: { reporter: ["text", "html"] }
    }
});
```

---

## Python

### pytest (standard)

```bash
# Install
pip install pytest pytest-cov

# Run all tests
pytest

# Run specific file
pytest tests/test_users.py

# Run specific test
pytest tests/test_users.py::test_get_user

# Verbose
pytest -v

# Coverage
pytest --cov=src --cov-report=html
```

**Basic test file:**
```python
# tests/test_users.py
import pytest
from src.users import get_user, create_user

def test_get_user_returns_user():
    user = get_user(1)
    assert user["id"] == 1
    assert "name" in user

def test_get_user_raises_for_missing():
    with pytest.raises(ValueError, match="not found"):
        get_user(99999)

def test_create_user_validates_email():
    with pytest.raises(ValueError):
        create_user(name="Alice", email="not-an-email")
```

**Fixtures (setup/teardown):**
```python
import pytest

@pytest.fixture
def db_session():
    session = create_test_session()
    yield session
    session.rollback()
    session.close()

def test_user_saved(db_session):
    user = create_user(db_session, name="Bob")
    assert db_session.query(User).filter_by(name="Bob").first() is not None
```

**Mocking with pytest-mock / unittest.mock:**
```python
from unittest.mock import patch, MagicMock

def test_sends_email(mocker):  # requires pytest-mock
    mock_send = mocker.patch("src.email.send_email")
    notify_user(user_id=1)
    mock_send.assert_called_once_with(to="user@example.com", subject="Welcome")

# or with patch context manager:
def test_api_call():
    with patch("requests.get") as mock_get:
        mock_get.return_value.json.return_value = {"status": "ok"}
        result = fetch_status()
        assert result == "ok"
```

**Parametrize (run test with multiple inputs):**
```python
@pytest.mark.parametrize("email,valid", [
    ("user@example.com", True),
    ("not-an-email", False),
    ("", False),
    ("@nodomain", False),
])
def test_email_validation(email, valid):
    assert is_valid_email(email) == valid
```

### Setup pytest

```bash
# pytest.ini or pyproject.toml
[tool.pytest.ini_options]
testpaths = ["tests"]
python_files = ["test_*.py"]
python_functions = ["test_*"]
```

---

## Integration Tests

### API integration (TypeScript — supertest)

```typescript
import request from "supertest";
import app from "./app";

describe("POST /api/users", () => {
    it("creates user and returns 201", async () => {
        const res = await request(app)
            .post("/api/users")
            .send({ name: "Alice", email: "alice@example.com" });

        expect(res.status).toBe(201);
        expect(res.body).toMatchObject({ name: "Alice" });
    });
});
```

### API integration (Python — httpx / requests)

```python
import httpx

def test_create_user():
    with httpx.Client(base_url="http://localhost:8000") as client:
        res = client.post("/api/users", json={"name": "Alice"})
        assert res.status_code == 201
        assert res.json()["name"] == "Alice"
```

---

## Coverage Targets

| Coverage % | Interpretation |
|---|---|
| < 50% | Under-tested — add tests for critical paths |
| 50–80% | Acceptable for most projects |
| 80–90% | Good — diminishing returns above this |
| > 90% | High — may be testing trivial code |

Don't chase 100% — focus on meaningful coverage.

---

## Test File Conventions

```
src/
├── users.ts
└── users.test.ts      # co-located (vitest/jest)

# or:
tests/
├── test_users.py      # pytest
└── conftest.py        # shared fixtures
```

- Name files: `*.test.ts`, `*.spec.ts`, `test_*.py`
- One test file per source file
- Group related tests with `describe` blocks
