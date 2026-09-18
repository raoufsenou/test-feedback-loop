export const SKILL_NAME = 'test-feedback-loop'

export const ARTIFACT_ENTRIES = Object.freeze([
  'SKILL.md',
  'references/contract.md',
  'references/playwright.md',
  'references/report-template.md',
])

export const REQUIRED_ARTIFACT_FILES = ARTIFACT_ENTRIES

export const ARTIFACT_SHA256 = Object.freeze({
  'SKILL.md': '8ea0bcde0dcba29fd4f0d3ebecb7b5e4c0b512d1acd6c3201f5f4d7ed692e574',
  'references/contract.md': '2c1e7a1c866a06e9e7f75eb76de40c95c6dd4f5294f5ca0c50b0fe0e50131ca4',
  'references/playwright.md': '67345d7e0b54b02375a8fd028fe0b4adb7f0f8e5f147c943efd1ce5d151976a0',
  'references/report-template.md': 'a0f0f1314cced39cec83406d48499d329fab6c62be95218c015eacfc0ceb59db',
})

export const SKILL_VERIFICATION_PROOFS = Object.freeze([
  'A new unclassified Vitest file fails the topology guard.',
  'Every existing Vitest file is selected exactly once.',
  'An unknown workspace/filter exits non-zero.',
  'A focused pure test starts no database setup.',
  'A focused database test executes runtime target validation before any connection or mutation.',
  'An unsafe database target refuses before probing or constructing a pool.',
  'A partial/related run is never stored as a complete Turbo task result.',
  'A complete pure-package run misses after a relevant edit and hits when unchanged.',
  'Every workspace participates in the no-argument lint, typecheck, and test final gates.',
  'A shared-package edit invalidates consumer test and typecheck final gate tasks.',
  'Each task-specific root/config/environment input invalidates the task that reads it, while an unrelated root file does not.',
  'Removing a generated type output and replaying a cache hit restores that output.',
  'Guard regression tests finish before final gate database preparation starts.',
  'An unsafe second database target refuses before the first target is mutated.',
  'A second test command and a second E2E command are each excluded by their OS-backed locks.',
  'Unknown E2E commands and extra options fail closed.',
  'A local dependent full journey refuses and names every focused E2E gate.',
  'CI actually runs the full journey with one worker, cancels superseded refs, preserves its exit status, and uploads reports, traces, and screenshots on both success and failure.',
  'E2E cleanup leaves a listener outside the repository untouched and reports its working directory.',
])

export const REPORT_VERIFICATION_PROOFS = Object.freeze([
  'Unclassified Vitest file is rejected',
  'Every Vitest file is selected exactly once',
  'Unknown workspace/filter is rejected',
  'Focused pure test starts no database setup',
  'Focused database test validates before connection/mutation',
  'Unsafe database target refuses before network access or pool construction',
  'Partial/related result is never a complete Turbo cache entry',
  'Complete pure-package test misses after a relevant edit and hits when unchanged',
  'Every workspace participates in all no-argument final gates',
  'Shared-package edit invalidates consumer test and typecheck final gate tasks',
  'Task-specific root/config/environment inputs invalidate only their owning task; unrelated root files do not',
  'Cached typecheck restores generated outputs',
  'Guard regressions finish before final gate database preparation',
  'Unsafe second database target refuses before first-target mutation',
  'Test and E2E OS-backed locks each exclude a second run',
  'Unknown E2E command/arguments are rejected',
  'Local full journey refusal names every focused E2E gate',
  'CI runs the full journey with one worker, cancels superseded refs, preserves exit status, and uploads reports/traces/screenshots on success and failure',
  'E2E cleanup leaves foreign listeners untouched and reports their working directory',
])
