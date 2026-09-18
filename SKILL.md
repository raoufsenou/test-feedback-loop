---
name: test-feedback-loop
description: Audits and installs a fixed test feedback-loop contract in pnpm, Turborepo, Vitest, and Playwright repositories. Use when test, lint, typecheck, or browser feedback is slow or over-broad; when reorganizing test execution; or when applying the pure/database/guard and focused E2E gate model to a new or existing project.
---

# Test Feedback Loop

Apply one fixed vocabulary and one fixed public command shape. Adapt implementation details to the
repository, but never rename concepts or invent another execution model.

Read [contract.md](references/contract.md) before auditing or changing a repository. Read
[playwright.md](references/playwright.md) whenever Playwright is present. Use
[report-template.md](references/report-template.md) for every audit and verification report.

## Invocation modes

Infer the mode from the request. With no explicit mode, use `audit`.

- `audit` — read-only inventory, measurements already available, findings, and recommendation.
- `apply` — implement a user-approved audit plan.
- `verify` — prove topology, safety, cache correctness, and before/after timings.
- `install-rule` — install the project-specific commit-boundary rule after commands are proven.

Never combine `audit` and `apply` in one uninterrupted pass. An audit ends at a user decision.

## Compatibility gate

The supported profile is:

- pnpm workspace or pnpm single-package repository;
- Turborepo task graph;
- Vitest for in-process tests; and
- Playwright for browser tests.

An empty/new repository may adopt this profile after explicit approval. In an existing repository,
if another package manager, task graph, test runner, or browser runner owns the workflow, stop and
report `UNSUPPORTED PROFILE`. Do not translate the contract to Jest, Nx, Pytest, Cargo, or another
tool under this skill.

## Safety rules

- Read the target repository's rules and authority plan before any command.
- Never inspect, print, copy, or summarize `.env` files, credentials, tokens, or secret values.
- Do not run Git commands.
- Before a test, build, or browser command, establish that no competing suite is running.
- Start services only through repository-owned commands and stop everything this session starts.
- State what a check can catch before running it.
- Do not run a command expected to exceed 30 seconds during `audit` without user approval.
- Never weaken a test, skip, guard, count, or final gate to make the migration pass.

## Mode: audit

Remain read-only.

1. Read root/workspace manifests, `turbo.json`, Vitest configuration, Playwright configuration,
   command routers, test setup, database harnesses, repository rules, and active testing docs.
2. Inventory every Vitest file by workspace. Determine from imports and setup—not names alone—whether
   it belongs to `guard`, otherwise `database`, otherwise `pure`; apply that precedence exactly.
3. Inventory every Playwright flow and determine whether it is a focused E2E gate or part of a
   dependent full journey.
4. Trace current command behavior for:
   - no-argument `test`, `lint`, and `typecheck`;
   - file/workspace/related scoped checks;
   - focused E2E gate commands; and
   - the full journey.
5. Inspect Turbo task dependencies, inputs, outputs, environment hashing, cache boundaries, and
   unavoidable global invalidators.
6. Use existing timing evidence first. If evidence is missing, propose the narrowest benchmark and
   state its expected duration before asking permission.
7. Produce the fixed report structure. Distinguish actual waste from justified final gate cost.
8. Recommend the smallest complete migration and stop for one user decision.

The audit must explicitly report:

- Vitest file counts per lane and unclassified files;
- setup/policy overhead paid by a focused test;
- pure and database execution time;
- cache hits/misses for lint, typecheck, and complete pure-package tests;
- focused E2E gate and full journey costs;
- false-green paths such as empty filters or cached partial runs; and
- commands whose behavior differs from their documentation.

## Mode: apply

Require an accepted audit. If none exists, run `audit` and stop.

Implement in this order:

1. Pin the discovered topology with a test proving every Vitest file belongs to exactly one lane.
2. Preserve no-argument commands as final gates.
3. Add the exact scoped checks:
   - `pnpm lint file <paths...>` and `pnpm lint workspace <name>`;
   - `pnpm typecheck workspace <name>`;
   - `pnpm test related <paths...>` and `pnpm test workspace <name> [filters...]`; and
   - `pnpm e2e <named-gate>`.
4. Split pure/database/guard execution without changing what tests prove.
5. Add Turbo caching only for complete pure-package tests and finite lint/typecheck tasks.
6. Give Playwright one reviewed registry of named focused E2E gates and one execution lock.
7. Keep a dependent full journey CI-only; make local alternate spellings refuse.
8. Add command-contract tests and active documentation. `install-rule` remains a separate verified
   mode.

Use existing root command names. Do not add colon aliases or expose helper choreography as package
scripts. Internal script names may follow the repository's conventions.

## Mode: verify

Run narrow proofs first:

1. A new unclassified Vitest file fails the topology guard.
2. Every existing Vitest file is selected exactly once.
3. An unknown workspace/filter exits non-zero.
4. A focused pure test starts no database setup.
5. A focused database test executes runtime target validation before any connection or mutation.
6. An unsafe database target refuses before probing or constructing a pool.
7. A partial/related run is never stored as a complete Turbo task result.
8. A complete pure-package run misses after a relevant edit and hits when unchanged.
9. Every workspace participates in the no-argument lint, typecheck, and test final gates.
10. A shared-package edit invalidates consumer test and typecheck final gate tasks.
11. Each task-specific root/config/environment input invalidates the task that reads it, while an
    unrelated root file does not.
12. Removing a generated type output and replaying a cache hit restores that output.
13. Guard regression tests finish before final gate database preparation starts.
14. An unsafe second database target refuses before the first target is mutated.
15. A second test command and a second E2E command are each excluded by their OS-backed locks.
16. Unknown E2E commands and extra options fail closed.
17. A local dependent full journey refuses and names every focused E2E gate.
18. CI actually runs the full journey with one worker, cancels superseded refs, preserves its exit
    status, and uploads reports, traces, and screenshots on both success and failure.
19. E2E cleanup leaves a listener outside the repository untouched and reports its working directory.

Then benchmark the same representative cases used by the audit. Do not run the no-argument final
gate merely to measure it again when a valid baseline already exists.

When the user asks to commit code/configuration/tests, run the final gate sequence after review and
the last relevant edit:

1. `pnpm typecheck`
2. `pnpm lint`
3. `pnpm test`
4. each relevant focused `pnpm e2e <named-gate>`

Fix failures with scoped checks, then rerun the final gate sequence once. The CI-only full journey
is not a local commit gate.

## Mode: install-rule

Install `.cursor/rules/commit-gate.mdc` only after the target commands are implemented and verified.
Use the exact command names above. The rule must say:

- scoped checks during implementation;
- final gates immediately before a code/configuration/test commit;
- later relevant edits invalidate the final gate pass;
- documentation-only commits run only their relevant guard;
- relevant focused E2E gates run at the boundary; and
- no Git hook or additional package command is introduced.

## Stop conditions

For an existing repository that fails the compatibility profile, report `UNSUPPORTED PROFILE` and
stop without offering an adapter. For a new/empty repository missing the profile, ask before
installing it.

Stop and ask one focused question when:

- lane ownership is ambiguous;
- a test requires mutable infrastructure other than the approved database;
- the candidate full journey is not actually dependent and CI-only would add no value;
- cache correctness depends on an unknown environment input; or
- completing a touched unit would require unapproved product or infrastructure work.

Never resolve these by introducing new terminology.
