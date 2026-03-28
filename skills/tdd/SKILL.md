---
name: tdd
description: Use when implementing any feature or bugfix. Enforces test-first development — write a failing test before writing implementation code.
---

# Test-Driven Development

**Hard rule: No implementation code before a failing test exists.**

This is a rigid skill. Follow the steps exactly. Do not skip or reorder.

## Trigger

Implementing any feature, bugfix, or behavioral change.

## Flow

### Step 1: Detect Test Runner

Look for project signals to determine the test framework:
- `package.json` with vitest/jest/mocha → `npx vitest run` / `npx jest`
- `go.mod` → `go test ./...`
- `Cargo.toml` → `cargo test`
- `pyproject.toml` / `pytest.ini` → `pytest`
- `mix.exs` → `mix test`

If unclear, ask the user.

**K8s Remote Mode**: If K8s remote execution is active, tests run on the remote pod automatically. The test runner detection and execution works the same — all bash commands route through kubectl.

### Step 2: Write Failing Test

1. Create or open the test file for the module you're changing
2. Write a test that describes the expected behavior
3. The test should be minimal — test one thing

### Step 3: Run Test — Must Fail

```
<run test command>
```

- If the test **fails**: Good. This proves the test tests something real. Proceed.
- If the test **passes**: The behavior already exists or the test is wrong. Investigate before continuing.
- If the test **errors** (compilation/import): Fix the test setup, not the implementation.

### Step 4: Implement Minimum Code

Write the **minimum code** to make the failing test pass. Nothing more.

Rules:
- Don't add error handling for cases not in the test
- Don't refactor yet
- Don't add features the test doesn't cover

### Step 5: Run Test — Must Pass

```
<run test command>
```

- If it **passes**: Proceed to refactor.
- If it **fails**: Fix the implementation (not the test, unless the test is wrong).

### Step 6: Refactor

Now that tests are green, clean up:
- Extract duplicated code
- Rename for clarity
- Simplify logic

After refactoring, run the test again to confirm it still passes.

### Step 7: Run Full Suite

```
<run full test suite>
```

Ensure nothing else broke. If something did, fix it before moving on.

### Step 8: Repeat

Go back to Step 2 for the next behavior. Each cycle should be small (5-15 minutes of work).

## When to Skip TDD

- Pure configuration changes (no logic)
- Documentation-only changes
- Deleting dead code

When in doubt, write the test.
