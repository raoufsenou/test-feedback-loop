# Repository contract

This repository publishes the `test-feedback-loop` Cursor skill. The installed artifact is
`SKILL.md` plus `references/`; development scripts and tests must not become runtime dependencies.

- Use pnpm only.
- Do not run Git unless the maintainer explicitly asks for a commit.
- Never read or print `.env` files, credentials, tokens, or secrets.
- Keep `SKILL.md` below 500 lines and every referenced file one level deep.
- The closed terms are `pure`, `database`, `guard`, `focused E2E gate`, `full journey`,
  `scoped check`, and `final gate`. Do not add synonyms.
- The supported profile is pnpm + Turborepo + Vitest + Playwright. Refuse unsupported stacks rather
  than adding adapters.
- `audit` is read-only and stops for approval before `apply`.
- Installer changes require a temporary-directory test proving the global copy is independent from
  its source.
- Run `pnpm test` and `pnpm lint` before reporting the project complete.
