# Playwright Profile

## Inventory

For every Playwright configuration, record:

- product behavior proved;
- test/spec files selected;
- applications and mutable services started;
- ports and database targets;
- setup and teardown owner;
- measured local duration;
- whether the flow is independently runnable; and
- whether another flow must run first.

Delete duplicate configurations only after their consumers and named deliverables are checked.

## One registry

Create one repository-owned registry that defines each public E2E command:

```ts
type E2eDefinition = {
  kind: 'playwright' | 'node' | 'tsx' | 'journey'
  target?: string
  description: string
  focused: boolean
}
```

The router and its help text read this registry. Tests assert the complete reviewed key set and the
exact target for every key. Unknown names and unowned arguments fail.

Do not infer public commands from filenames; filenames are implementation details.

## Focused E2E gates

A focused E2E gate is valid only when it:

1. starts from independently provisioned state;
2. reaches the changed product surface without replaying unrelated acts;
3. proves both success and important refusal behavior;
4. performs cleanup even after failure;
5. owns fixed, validated ports and disposable database targets; and
6. can run alone repeatedly.

Split by product flow, not by arbitrary spec size. A five-minute flow may still be focused when its
setup is essential; a ten-second spec is not focused if it silently relies on another run.

Maintain a documented source-surface → focused E2E gate map. This mapping is explicit because browser
behavior has no reliable static import graph.

## Full journey

Move a full journey to CI only when all are true:

- acts are ordered and later acts consume browser/server state from earlier acts;
- resuming safely in the middle is not implemented;
- local reruns spend material time replaying unrelated setup;
- focused E2E gates cover normal development feedback; and
- CI preserves reports, traces, screenshots, and the original exit status.

Local refusal is part of the design. Treat any invocation not recognized as a focused configuration
as the full journey, so a spec path or grep cannot rename the expensive command back into existence.

CI should use one worker for dependent acts, cancel superseded refs, and upload evidence on both
success and failure.

## Lock and cleanup

Use an OS-held lock that disappears when its owner exits. A diagnostic PID file alone is not the
lock.

Before startup, record which configured ports were free. On cleanup:

- inspect listeners by port, never process-name patterns;
- verify each listener's working directory belongs to the repository;
- reap only ports observed free before this run;
- leave foreign listeners untouched and report their working directory; and
- stop every process group this run started.

Never use `pkill`, `killall`, or command-pattern matching.

## Browser cache policy

Do not Turbo-cache Playwright verdicts. Browser results depend on browser/runtime versions, service
startup, databases, certificates, and timing. Cache package installation and browser binaries in CI
when correct, but execute the focused E2E gate itself.

## Commit boundary

Run only focused E2E gates whose documented source-surface map includes the changed behavior. Run them
after review and final source edits, beside the final gate sequence. The dependent
full journey remains CI-only.
