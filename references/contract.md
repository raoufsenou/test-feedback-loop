# Fixed Contract

This vocabulary is closed. Do not substitute synonyms in code, documentation, reports, or rule text.

## Execution domains

| Term | Exact meaning | Cache/concurrency |
|---|---|---|
| `pure` | A Vitest file that uses no mutable external service | Bounded parallelism; complete package runs may be Turbo-cached |
| `database` | A Vitest file that opens the approved disposable Postgres database | Serial and uncached until each worker owns an isolated database |
| `guard` | A Vitest file testing target validation, routing, topology, or refusal behavior | Runs before the operation it protects in the final gate |
| `focused E2E gate` | One independently runnable Playwright product flow | Local, named, locked, never Turbo-cached |
| `full journey` | Ordered Playwright acts whose later state depends on earlier acts | CI-only when dependency is demonstrated |
| `scoped check` | `file`, `workspace`, `related`, or one focused E2E gate | Partial evidence; never reported as the final verdict |
| `final gate` | A no-argument lint/typecheck/test command | Complete evidence at the commit boundary |

`database` may contain zero files. Do not rename it to `integration`, `stateful`, `slow`, or `DB`.
Playwright is not a fourth Vitest lane.

Classification precedence is fixed:

1. `guard` when the file's subject is target validation, command routing, topology, or refusal;
2. otherwise `database` when the file opens Postgres; and
3. otherwise `pure`.

A `guard` file may mock a database client to prove that no connection occurs, but it must never open
Postgres. This precedence makes the lanes mutually exclusive.

## Public commands

These names and mode words are fixed:

```text
pnpm lint
pnpm lint file <paths...>
pnpm lint workspace <name>

pnpm typecheck
pnpm typecheck workspace <name>

pnpm test
pnpm test related <paths...>
pnpm test workspace <name> [filters...]

pnpm e2e <named-gate>
```

No-argument lint/typecheck/test are complete. Scoped checks print that they are partial.

Reject:

- unknown modes, workspaces, gates, and file filters;
- option-shaped file/filter arguments;
- a workspace filter matching zero tests;
- extra Playwright arguments not explicitly owned by the named gate; and
- alternate local spellings of a CI-only full journey.

Do not add `test:*`, `lint:*`, `typecheck:*`, or `e2e:*` aliases. Helpers stay behind the owning
router.

## Topology invariant

One executable policy must discover every Vitest file and assign it to exactly one lane. It must
fail when:

- a file has no classification;
- two projects select the same file;
- a project's include/exclude patterns disagree with the classifier;
- a pure file opens Postgres; or
- the recorded per-lane baseline changes without an intentional contract update.

Classification uses behavior and imports. Directory names are evidence, not proof.

## Database invariant

Every database invocation executes the runtime safety check. Testing the safety check and executing
it are different:

- guard regression files prove malformed/remote/development targets refuse before network access;
- runtime setup validates every configured target before mutating any selected target;
- focused database runs execute runtime validation but need not rerun all guard regression files;
- the final gate runs guard regressions before database setup.

The approved target is local, explicitly test-named, distinct from development and other test
databases, and checked without printing credentials. One OS-backed lock spans the test command.

Do not parallelize shared-database files by increasing a worker flag. Parallel database tests require
one validated disposable database per worker and a measured improvement.

## Turbo invariant

Turbo works at task/package granularity. Vitest `related` supplies file-level selection.

- Use task-specific root inputs, not broad `globalDependencies`, wherever supported.
- Include every file and environment value actually read by a task.
- Use dependency edges so shared-package changes invalidate consumers.
- Cache only complete pure-package test commands.
- Never cache a related, filtered, or database test result as a complete package result.
- Preserve generated type outputs required by a cached typecheck.
- Do not use `--affected` for direct-on-`main` local workflows; name the workspace or edited paths.

Root package metadata, the lockfile, and Turbo configuration may remain unavoidable global
invalidators.

## Playwright invariant

One registry owns every public E2E name, runner kind, target, description, and focused/full status.
The router derives help and execution from that registry.

Focused E2E gates:

- own their configuration, ports, database targets, and startup;
- are locally runnable and independently meaningful;
- reject unreviewed extra arguments;
- hold one OS-backed E2E lock; and
- stop only processes proven to belong to the current repository.

A full journey becomes CI-only only when later acts depend on earlier browser state. Its local refusal
must close direct-spec, grep, and alternate-config bypasses and name all focused alternatives.

## Commit boundary

During implementation use scoped checks. After review and the final relevant edit, run:

1. the typecheck final gate;
2. the lint final gate;
3. the test final gate; and
4. relevant focused E2E gates.

Fix with scoped checks. Repeat the final gate sequence once after the final fix. A later
code/configuration/test edit invalidates the pass. The CI-only full journey is not run locally.
