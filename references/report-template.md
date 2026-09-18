# Feedback-Loop Report Template

Use this structure without renaming sections or lane terms.

```markdown
# Test Feedback-Loop Audit — YYYY-MM-DD

## Verdict

[One paragraph: where time is actually lost, what already works, and the recommended migration.]

## Compatibility

| Requirement | Evidence | Result |
|---|---|---|
| pnpm | [manifest/packageManager] | PASS/FAIL |
| Turborepo | [task config] | PASS/FAIL |
| Vitest | [configs/projects] | PASS/FAIL |
| Playwright | [configs/router] | PASS/FAIL |

## Current command behavior

| Command | Work selected | Safety/setup paid | Cache | Measured time |
|---|---|---|---|---:|
| lint final gate | | | | |
| lint scoped check | | | | |
| typecheck final gate | | | | |
| typecheck scoped check | | | | |
| test final gate | | | | |
| related scoped check | | | | |
| workspace scoped check | | | | |
| focused E2E gate | | | never | |
| full journey | | | never | |

## Vitest topology

| Workspace | pure | database | guard | Unclassified |
|---|---:|---:|---:|---:|
| | | | | |
| Total | | | | |

State how classification was verified from behavior/imports.

## Playwright topology

| Named gate | Focused? | Independent? | Mutable resources | Duration |
|---|---|---|---|---:|
| | | | | |

State whether a dependent full journey exists and whether local refusal is justified.

## Findings

1. **[Severity] [Short name]**
   - Evidence:
   - Waste or false-green behavior:
   - Required correction:

## Proposed migration

| Contract area | State | Required change or reason no change is needed |
|---|---|---|
| Exhaustive topology | missing/present/not applicable | |
| No-argument final gates | missing/present/not applicable | |
| File/workspace/related scoped checks | missing/present/not applicable | |
| pure/database/guard execution | missing/present/not applicable | |
| Complete pure-package Turbo caching | missing/present/not applicable | |
| Focused E2E gate registry | missing/present/not applicable | |
| Full journey policy | missing/present/not applicable | |
| Commit-boundary rule | missing/present/not applicable | |

Sequence only rows marked `missing`. Do not implement a row merely because the template names it.

## Excluded work

- Database worker isolation unless separately measured and approved.
- Another package manager/task runner/test framework.
- A universal CLI or shared runtime dependency.
- Renaming the fixed contract.

## Decision required

[One recommendation and one focused user decision. Stop here in audit mode.]

## Verification results

[Populate only in verify mode.]

| Proof | Before/evidence | After/evidence | Result |
|---|---|---|---|
| Unclassified Vitest file is rejected | | | |
| Every Vitest file is selected exactly once | | | |
| Unknown workspace/filter is rejected | | | |
| Focused pure test starts no database setup | | | |
| Focused database test validates before connection/mutation | | | |
| Unsafe database target refuses before network access or pool construction | | | |
| Partial/related result is never a complete Turbo cache entry | | | |
| Complete pure-package test misses after a relevant edit and hits when unchanged | | | |
| Every workspace participates in all no-argument final gates | | | |
| Shared-package edit invalidates consumer test and typecheck final gate tasks | | | |
| Task-specific root/config/environment inputs invalidate only their owning task; unrelated root files do not | | | |
| Cached typecheck restores generated outputs | | | |
| Guard regressions finish before final gate database preparation | | | |
| Unsafe second database target refuses before first-target mutation | | | |
| Test and E2E OS-backed locks each exclude a second run | | | |
| Unknown E2E command/arguments are rejected | | | |
| Local full journey refusal names every focused E2E gate | | | |
| CI runs the full journey with one worker, cancels superseded refs, preserves exit status, and uploads reports/traces/screenshots on success and failure | | | |
| E2E cleanup leaves foreign listeners untouched and reports their working directory | | | |
| lint scoped check timing | | | |
| typecheck scoped check cold/warm timing | | | |
| Focused E2E gate timing | | | |
| Complete Vitest file/test count | | | |
```

Never report a timing not observed in the target repository. Never call a scoped check the final
verdict.
