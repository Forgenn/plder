---
name: tdd
description: Use when implementing any feature or bugfix. Enforces test-first development — write a failing test before writing implementation code.
---

# TDD — Red · Green · Refactor

**This is a hard constraint, not a suggestion. Follow every phase exactly.**

---

## The Only Rule

> A failing test must exist and be confirmed running before any implementation code is written.

If you catch yourself writing implementation first — stop. Delete it. Write the test. Run it. See it fail. Then implement.

---

## How LLMs Cheat at TDD (recognise and refuse these)

**1. Implementation-first with backfill** — writing code, then writing tests that confirm what was already built. The tests are worthless because they were designed around a known implementation.

**2. Trivially-passing tests** — writing a test that passes before any implementation exists (e.g. asserting `undefined === undefined`, or testing a function that already existed). If the test passes before you write the function, the test is wrong.

**3. Skipping the fail run** — writing the test but not actually executing it before implementing. The run is not optional. You must see the red output.

**4. Failing for the wrong reason** — if the test fails with an import/compile error, that is a setup error, not a RED. Fix the test setup until you get a real assertion failure, then proceed.

**5. Over-implementing at GREEN** — writing more than the minimal code to pass the test. Extra logic belongs in a future cycle, not now.

**6. Skipping REFACTOR** — moving to the next feature without reviewing for cleanup. Always check. Saying "no refactoring needed" is fine — but you must check.

---

## Phase 0 — Setup

**Detect the test runner** from project files:

| Signal | Runner |
|---|---|
| `package.json` → `vitest` | `npx vitest run` |
| `package.json` → `jest` | `npx jest` |
| `package.json` → `mocha` | `npx mocha` |
| `go.mod` | `go test ./...` |
| `Cargo.toml` | `cargo test` |
| `pyproject.toml` / `pytest.ini` | `pytest` |
| `mix.exs` | `mix test` |

If unclear, ask before proceeding.

**Break the work into increments.** Each increment = one RED·GREEN·REFACTOR cycle. Start with the simplest/degenerate case, build toward the general case. Present the list and confirm with the user before starting.

---

## 🔴 RED — Write a Failing Test

1. Write the test in the appropriate test file, following existing project conventions.
2. The test must describe **behaviour**, not implementation. Test what the code does, not how.
3. Keep it minimal — one thing per test, one assertion when possible.

**▶ Run the test now.**

```
<test runner command>
```

- **Fails with assertion error** → correct. State: "🔴 RED confirmed." Proceed to GREEN.
- **Passes unexpectedly** → STOP. The behaviour already exists, or the test is wrong. Investigate before continuing. Do not proceed.
- **Fails with compile/import error** → STOP. This is not RED. Fix the test setup. Do not write implementation to fix this.

> **Gate: Do not write any implementation until you have confirmed assertion failure output.**

---

## 🟢 GREEN — Write Minimal Implementation

Write the **minimum code** to make the failing test pass. Nothing more.

Rules:
- No error handling for cases not covered by a test
- No refactoring yet
- No additional features the test doesn't require
- If you're unsure what "minimal" means: fake it first (`return true`, hardcoded value), then generalise only when a new test forces it

**▶ Run the full test suite now** (not just the new test).

```
<full suite command>
```

- **All pass** → proceed to REFACTOR.
- **New test fails** → fix implementation (not the test, unless the test is wrong).
- **Existing test regressed** → fix the regression before proceeding.

> **Gate: Do not proceed to REFACTOR until the full suite is green.**

---

## 🔵 REFACTOR — Improve Without Changing Behaviour

Review the code written in GREEN. Look for:
- Duplication (extract)
- Poor names (rename)
- Complex logic (simplify)
- Structure that makes the next cycle harder

Apply changes. After each change: **run the full suite**. If anything breaks, revert the refactoring change.

If no refactoring is needed, say so explicitly — but you must check.

> **Gate: Full suite must be green after every refactoring change.**

---

## Cycle Summary

After each 🔴·🟢·🔵 cycle, briefly state:
- What test was added and what behaviour it covers
- What implementation was written
- What was refactored (or "no refactoring needed")

Then move directly to the next increment — back to 🔴 RED.

---

## Done

After all increments are complete:
1. Run the full suite one final time
2. List each increment, its test, and its status
3. Note any edge cases or follow-up tests worth adding

---

## When TDD Does Not Apply

- Pure configuration changes (no logic)
- Documentation-only changes
- Deleting dead code with no behaviour change

When in doubt: write the test.
