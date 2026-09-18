# Test Feedback Loop

A Cursor skill that applies one fixed testing contract to pnpm + Turborepo + Vitest + Playwright
repositories.

## Why this skill exists

Test feedback often becomes slower and less trustworthy as a repository grows. A small edit can
trigger unrelated setup, partial runs can be mistaken for complete evidence, and browser testing can
collapse into one expensive flow that developers avoid running.

This skill establishes a fixed contract that keeps development feedback narrow while preserving
complete evidence at the commit boundary:

- `pure`, `database`, and `guard` Vitest lanes;
- `file`, `workspace`, and `related` scoped checks;
- no-argument final gates;
- Turbo caching only for complete pure-package tests;
- named local focused E2E gates;
- an optional CI-only dependent full journey; and
- final gate verification immediately before a code commit.

It audits the repository first, reports where time or confidence is being lost, and stops for
approval before changing anything.

## When to use it

Use this skill when all of the following are true:

- the repository uses pnpm, Turborepo, Vitest, and Playwright;
- test, lint, typecheck, or browser feedback is too broad or too slow for the edit being made;
- database setup is paid by tests that do not need it;
- scoped checks, final gates, or Turbo cache boundaries are unclear or can produce false confidence;
  or
- Playwright needs independently runnable focused E2E gates while a dependent full journey remains
  in CI.

The skill is also useful before reorganizing an existing test command surface, because `audit`
records the current behavior and recommends the smallest complete migration before `apply`.

## When not to use it

Do not use this skill when:

- the repository uses another package manager, task graph, unit-test runner, or browser-test runner;
- the goal is to translate this contract to Jest, Nx, Pytest, Cargo, or another stack;
- a one-off test failure needs debugging rather than feedback-loop design;
- the repository already satisfies the contract and measurements show no meaningful feedback cost;
  or
- you want an audit to silently continue into implementation.

Unsupported repositories are refused instead of receiving a partial adapter. `audit` is always
read-only and ends at an explicit decision before `apply`.

## Supported profile

- pnpm
- Turborepo
- Vitest
- Playwright
- optional Postgres-backed `database` lane

Other package managers, task graphs, and test runners are deliberately unsupported. The skill
refuses rather than improvising different terminology.

## Project layout

```text
SKILL.md                       Installed skill workflow
references/contract.md        Closed terminology and invariants
references/playwright.md      Focused E2E gate and full journey rules
references/report-template.md Fixed audit and verification report
scripts/install.mjs           Safe global copy
scripts/validate.mjs          Package validator
tests/skill.test.mjs          Validator and installer regression tests
```

Only `SKILL.md` and `references/` are copied into the global installation. The installer and its
tests remain development files, so the cloned project may be deleted afterward.

## Validate

```bash
pnpm test
pnpm lint
```

## Install globally

```bash
pnpm install:global
```

This copies the artifact to:

```text
~/.cursor/skills/test-feedback-loop/
```

An existing installation is never overwritten implicitly. An OS-held lock excludes concurrent
installers; an interrupted replacement is recovered from its validated backup on the next run.
After validating a newer checkout:

```bash
pnpm install:global -- --replace
```

The replacement is prepared and validated before the current installation is exchanged.

## Use

```text
/test-feedback-loop audit
/test-feedback-loop apply
/test-feedback-loop verify
/test-feedback-loop install-rule
```

With no mode, the skill performs the read-only `audit` and waits for a decision.
