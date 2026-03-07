---
name: brainstorming
description: Use when the user asks to build, add, create, or implement something new. Explores intent, requirements, and design before writing any code.
---

# Brainstorming

Use this skill when the user wants to build something new. **Never jump to implementation.** Explore intent, clarify requirements, and design the solution first.

## Trigger

User says "build", "add", "create", "implement", or describes a new feature/component.

## Flow

### Step 1: Explore Context

1. Read project config files (AGENTS.md, package.json, go.mod, Cargo.toml, etc.)
2. Scan recent git commits (`git log --oneline -20`)
3. Understand what already exists that's relevant

### Step 2: Clarify Intent

Ask clarifying questions **one at a time**. Prefer multiple-choice when possible.

Rules:
- One question per message. Wait for an answer before the next.
- Offer 2-4 concrete options when you can, with a recommended default.
- If the user's answer implies follow-up questions, ask them. Don't assume.
- Stop asking when you have enough to propose an approach.

### Step 3: Propose Approaches

Present 2-3 approaches with:
- **Name**: Short label
- **Description**: What it does, how it works
- **Trade-offs**: Pros and cons
- **Recommendation**: Which one and why

Let the user pick or combine.

### Step 4: Incremental Design

Present the design **section by section**:
1. Data model / types
2. Core logic / algorithm
3. API / interface
4. Integration points
5. Edge cases

After each section, ask: "Does this look right, or should we adjust?"

### Step 5: Write Design Doc

Save the approved design to `docs/plans/YYYY-MM-DD-<topic>.md` with:
- Overview
- Architecture decisions
- File structure
- Build order (bite-sized steps)
- Trade-offs acknowledged

### Step 6: Transition

Say: "Design is saved. Ready to implement — should I start with the first task?"

## Principles

- **YAGNI**: Don't design for hypothetical future needs. Build what's needed now.
- **Incremental validation**: Get approval at each step, don't present a wall of design.
- **Concrete over abstract**: Use real examples, not abstract descriptions.
- **One question at a time**: Never dump a list of questions.
