import { createHash } from 'node:crypto'
import { existsSync, lstatSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ARTIFACT_SHA256,
  REPORT_VERIFICATION_PROOFS,
  REQUIRED_ARTIFACT_FILES,
  SKILL_NAME,
  SKILL_VERIFICATION_PROOFS,
} from './artifact.mjs'

const SOURCE_ROOT = fileURLToPath(new URL('..', import.meta.url))

function frontmatterValue(markdown, key) {
  const frontmatter = /^---\n([\s\S]*?)\n---/.exec(markdown)?.[1] ?? ''
  return new RegExp(`^${key}:\\s*(.+)$`, 'm').exec(frontmatter)?.[1]?.trim() ?? ''
}

function filesBelow(root, directory = root) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return filesBelow(root, path)
    return [relative(root, path).split(sep).join('/')]
  })
}

export function validateSkill(root = SOURCE_ROOT, { artifactOnly = false } = {}) {
  const problems = []
  for (const file of REQUIRED_ARTIFACT_FILES) {
    const path = join(root, file)
    if (!existsSync(path) || !statSync(path).isFile()) problems.push(`missing artifact file: ${file}`)
  }
  if (problems.length > 0) return problems
  for (const file of REQUIRED_ARTIFACT_FILES) {
    const actual = createHash('sha256').update(readFileSync(join(root, file))).digest('hex')
    if (actual !== ARTIFACT_SHA256[file]) problems.push(`artifact checksum changed: ${file}`)
  }
  if (artifactOnly) {
    const discovered = filesBelow(root).toSorted()
    const expected = [...REQUIRED_ARTIFACT_FILES].toSorted()
    if (JSON.stringify(discovered) !== JSON.stringify(expected)) {
      problems.push(`installed artifact files differ: expected ${expected.join(', ')}`)
    }
    for (const file of REQUIRED_ARTIFACT_FILES) {
      if (lstatSync(join(root, file)).isSymbolicLink()) {
        problems.push(`installed artifact must not contain a symlink: ${file}`)
      }
    }
  }

  const skill = readFileSync(join(root, 'SKILL.md'), 'utf8')
  const lines = skill.split('\n').length
  if (lines > 500) problems.push(`SKILL.md has ${lines} lines; maximum is 500`)

  const frontmatter = /^---\n([\s\S]*?)\n---\n/.exec(skill)?.[1]
  if (!frontmatter || (skill.match(/^---$/gm) ?? []).length !== 2) {
    problems.push('SKILL.md must contain one valid frontmatter block')
  } else {
    for (const field of ['name', 'description']) {
      if ((frontmatter.match(new RegExp(`^${field}:`, 'gm')) ?? []).length !== 1) {
        problems.push(`SKILL.md frontmatter must define ${field} exactly once`)
      }
    }
  }
  if (frontmatterValue(skill, 'name') !== SKILL_NAME) {
    problems.push(`SKILL.md name must be ${SKILL_NAME}`)
  }
  const description = frontmatterValue(skill, 'description')
  if (description.length === 0 || description.length > 1024) {
    problems.push('SKILL.md description must contain 1–1024 characters')
  }
  for (const term of ['pnpm', 'Turborepo', 'Vitest', 'Playwright']) {
    if (!description.includes(term)) problems.push(`SKILL.md description must name ${term}`)
  }

  for (const mode of ['audit', 'apply', 'verify', 'install-rule']) {
    const matches = skill.match(new RegExp(`^## Mode: ${mode}$`, 'gm')) ?? []
    if (matches.length !== 1) problems.push(`SKILL.md must define Mode: ${mode} exactly once`)
  }
  for (const invariant of [
    'Never combine `audit` and `apply` in one uninterrupted pass. An audit ends at a user decision.',
    'Install `.cursor/rules/commit-gate.mdc` only after the target commands are implemented and verified.',
    'report `UNSUPPORTED PROFILE` and stop without offering an adapter.',
  ]) {
    if (!skill.replace(/\s+/g, ' ').includes(invariant.replace(/\s+/g, ' '))) {
      problems.push(`SKILL.md must preserve: ${invariant}`)
    }
  }
  const verifySection = skill.slice(
    skill.indexOf('## Mode: verify'),
    skill.indexOf('Then benchmark the same representative cases'),
  )
  const verificationNumbers = [...verifySection.matchAll(/^(\d+)\. /gm)].map((match) => Number(match[1]))
  if (JSON.stringify(verificationNumbers) !== JSON.stringify(Array.from({ length: 19 }, (_, i) => i + 1))) {
    problems.push('SKILL.md verification matrix must contain ordered proofs 1–19')
  }
  const normalizedSkill = skill.replace(/\s+/g, ' ')
  for (const proof of SKILL_VERIFICATION_PROOFS) {
    if (!normalizedSkill.includes(proof)) {
      problems.push(`SKILL.md verification matrix must preserve: ${proof}`)
    }
  }

  const contract = readFileSync(join(root, 'references/contract.md'), 'utf8')
  for (const term of [
    '`pure`',
    '`database`',
    '`guard`',
    '`focused E2E gate`',
    '`full journey`',
    '`scoped check`',
    '`final gate`',
  ]) {
    if (!contract.includes(term)) problems.push(`contract.md must define ${term}`)
  }
  for (const command of [
    'pnpm lint file <paths...>',
    'pnpm lint workspace <name>',
    'pnpm typecheck workspace <name>',
    'pnpm test related <paths...>',
    'pnpm test workspace <name> [filters...]',
    'pnpm e2e <named-gate>',
  ]) {
    if (!contract.includes(command)) problems.push(`contract.md must define ${command}`)
  }
  if (!contract.includes('Classification precedence is fixed:')) {
    problems.push('contract.md must define mutually exclusive lane precedence')
  }
  const precedence = [
    "1. `guard` when the file's subject is target validation, command routing, topology, or refusal;",
    '2. otherwise `database` when the file opens Postgres; and',
    '3. otherwise `pure`.',
  ]
  const precedenceIndexes = precedence.map((line) => contract.indexOf(line))
  if (
    precedenceIndexes.some((index) => index < 0) ||
    precedenceIndexes.some((index, position) => position > 0 && index <= precedenceIndexes[position - 1])
  ) {
    problems.push('contract.md lane precedence must remain guard, then database, then pure')
  }

  const playwright = readFileSync(join(root, 'references/playwright.md'), 'utf8')
  for (const heading of [
    '## One registry',
    '## Focused E2E gates',
    '## Full journey',
    '## Lock and cleanup',
    '## Browser cache policy',
    '## Commit boundary',
  ]) {
    if (!playwright.includes(heading)) problems.push(`playwright.md must define ${heading}`)
  }
  for (const proof of ['one worker', 'exit status', 'working directory', 'OS-held lock']) {
    if (!playwright.includes(proof)) problems.push(`playwright.md must preserve ${proof}`)
  }
  const normalizedPlaywright = playwright.replace(/\s+/g, ' ')
  for (const invariant of [
    'CI should use one worker for dependent acts, cancel superseded refs, and upload evidence on both success and failure.',
    'Treat any invocation not recognized as a focused configuration as the full journey',
    'leave foreign listeners untouched and report their working directory',
  ]) {
    if (!normalizedPlaywright.includes(invariant)) {
      problems.push(`playwright.md must preserve: ${invariant}`)
    }
  }

  const report = readFileSync(join(root, 'references/report-template.md'), 'utf8')
  for (const heading of [
    '## Current command behavior',
    '## Vitest topology',
    '## Playwright topology',
    '## Proposed migration',
    '## Decision required',
    '## Verification results',
  ]) {
    if (!report.includes(heading)) problems.push(`report-template.md must define ${heading}`)
  }
  for (const proof of REPORT_VERIFICATION_PROOFS) {
    if (!report.includes(`| ${proof} |`)) {
      problems.push(`report-template.md verification matrix must include ${proof}`)
    }
  }

  const links = [...skill.matchAll(/\]\(([^)]+)\)/g)]
    .map((match) => match[1].split('#')[0])
    .filter((target) => target.endsWith('.md'))
  for (const target of links) {
    if (!target.startsWith('references/') || target.slice('references/'.length).includes('/')) {
      problems.push(`SKILL.md reference must be one level below the skill: ${target}`)
      continue
    }
    if (!existsSync(join(dirname(join(root, 'SKILL.md')), target))) {
      problems.push(`SKILL.md reference does not exist: ${target}`)
    }
  }
  for (const file of REQUIRED_ARTIFACT_FILES.filter((path) => path.startsWith('references/'))) {
    if (!links.includes(file)) problems.push(`SKILL.md must link directly to ${file}`)
  }

  const optionalSourceDocs = ['README.md', 'AGENTS.md']
    .filter((file) => existsSync(join(root, file)))
    .map((file) => readFileSync(join(root, file), 'utf8'))
  const installedText = [skill, contract, playwright, report, ...optionalSourceDocs].join('\n')
  for (const [pattern, label] of [
    [/\bfocused gates?\b/i, 'focused gate'],
    [/\bfocused-gate\b/i, 'focused-gate'],
    [/\bfull browser journey\b/i, 'full browser journey'],
    [/\bfull-journey\b/i, 'full-journey'],
    [/\bCI-only journey\b/i, 'CI-only journey'],
    [/\bfocused-E2E\b/i, 'focused-E2E'],
    [/\bcomplete gates?\b/i, 'complete gate'],
    [/\bfinal-gate\b/i, 'final-gate'],
    [/<paths>/, '<paths>'],
  ]) {
    if (pattern.test(installedText)) problems.push(`installed artifact uses non-contract term: ${label}`)
  }
  if (/\\/.test(skill)) problems.push('SKILL.md contains a Windows-style path separator')
  return problems
}

function main() {
  const problems = validateSkill()
  if (problems.length > 0) {
    process.stderr.write(`Skill validation failed:\n${problems.map((problem) => `- ${problem}`).join('\n')}\n`)
    return 1
  }
  process.stdout.write('Skill validation passed.\n')
  return 0
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exitCode = main()
