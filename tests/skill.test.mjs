import assert from 'node:assert/strict'
import {
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test, { afterEach } from 'node:test'
import { fileURLToPath } from 'node:url'
import { ARTIFACT_ENTRIES, REQUIRED_ARTIFACT_FILES, SKILL_NAME } from '../scripts/artifact.mjs'
import {
  claimInstallLock,
  installPlan,
  installSkill,
  stageInstallationBackup,
} from '../scripts/install.mjs'
import { validateSkill } from '../scripts/validate.mjs'

const SOURCE_ROOT = fileURLToPath(new URL('..', import.meta.url))
const temporaryRoots = []

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function temporaryRoot() {
  const root = mkdtempSync(join(tmpdir(), 'test-feedback-loop-'))
  temporaryRoots.push(root)
  return root
}

function copyArtifact(destination) {
  mkdirSync(destination, { recursive: true })
  for (const entry of ARTIFACT_ENTRIES) {
    const target = join(destination, entry)
    mkdirSync(dirname(target), { recursive: true })
    cpSync(join(SOURCE_ROOT, entry), target, { recursive: true })
  }
}

test('the publishable skill satisfies its closed contract', () => {
  assert.deepEqual(validateSkill(SOURCE_ROOT), [])
  assert.equal(readFileSync(join(SOURCE_ROOT, 'SKILL.md'), 'utf8').split('\n').length <= 500, true)
})

test('installer arguments expose only explicit replacement', () => {
  assert.deepEqual(installPlan([]), { replace: false })
  assert.deepEqual(installPlan(['--replace']), { replace: true })
  assert.throws(() => installPlan(['--target', '/tmp/elsewhere']), /Usage:/)
})

test('global installation is a validated copy independent from its source', async () => {
  const root = temporaryRoot()
  const source = join(root, 'source')
  const skills = join(root, 'skills')
  copyArtifact(source)
  writeFileSync(join(source, 'references', 'unreviewed.md'), 'not part of the artifact\n')

  const destination = await installSkill({ sourceRoot: source, targetRoot: skills, lockPort: 0 })
  rmSync(source, { recursive: true })

  assert.equal(destination, join(skills, SKILL_NAME))
  assert.deepEqual(validateSkill(destination, { artifactOnly: true }), [])
  for (const file of REQUIRED_ARTIFACT_FILES) assert.equal(existsSync(join(destination, file)), true)
  assert.equal(existsSync(join(destination, 'package.json')), false)
  assert.equal(existsSync(join(destination, 'scripts')), false)
  assert.equal(existsSync(join(destination, 'references', 'unreviewed.md')), false)
})

test('an existing installation refuses implicitly and replaces only after validation', async () => {
  const root = temporaryRoot()
  const source = join(root, 'source')
  const replacement = join(root, 'replacement')
  const invalid = join(root, 'invalid')
  const skills = join(root, 'skills')
  copyArtifact(source)
  copyArtifact(replacement)
  copyArtifact(invalid)
  const portProbe = await claimInstallLock(0)
  const installPort = portProbe.port
  await portProbe.release()
  await installSkill({ sourceRoot: source, targetRoot: skills, lockPort: installPort })

  await assert.rejects(
    installSkill({ sourceRoot: replacement, targetRoot: skills, lockPort: installPort }),
    /Refusing to overwrite existing skill/,
  )

  rmSync(join(invalid, 'references', 'contract.md'))
  await assert.rejects(
    installSkill({ sourceRoot: invalid, targetRoot: skills, replace: true, lockPort: installPort }),
    /Source skill is invalid/,
  )
  assert.deepEqual(validateSkill(join(skills, SKILL_NAME), { artifactOnly: true }), [])

  stageInstallationBackup(
    join(skills, SKILL_NAME),
    skills,
    { id: '00000000-0000-4000-8000-000000000001' },
  )
  await assert.rejects(
    installSkill({ sourceRoot: replacement, targetRoot: skills, lockPort: installPort }),
    /Refusing to overwrite existing skill/,
  )
  assert.deepEqual(validateSkill(join(skills, SKILL_NAME), { artifactOnly: true }), [])

  writeFileSync(join(skills, SKILL_NAME, 'references', 'contract.md'), 'obsolete installation\n')
  writeFileSync(join(skills, SKILL_NAME, 'references', 'obsolete.md'), 'old installation\n')
  const destination = await installSkill({
    sourceRoot: replacement,
    targetRoot: skills,
    replace: true,
    lockPort: installPort,
  })
  assert.equal(
    readFileSync(join(destination, 'references', 'contract.md'), 'utf8'),
    readFileSync(join(replacement, 'references', 'contract.md'), 'utf8'),
  )
  assert.equal(existsSync(join(destination, 'references', 'obsolete.md')), false)
  assert.deepEqual(validateSkill(destination, { artifactOnly: true }), [])
})

test('the OS-held installer lock excludes a concurrent installation', async () => {
  const root = temporaryRoot()
  const source = join(root, 'source')
  copyArtifact(source)
  const lock = await claimInstallLock(0)
  try {
    await assert.rejects(
      installSkill({
        sourceRoot: source,
        targetRoot: join(root, 'skills'),
        lockPort: lock.port,
      }),
      /Refusing concurrent installation/,
    )
  } finally {
    await lock.release()
  }
})

test('an interrupted upgrade restores its older snapshot before replacing it', async () => {
  const root = temporaryRoot()
  const source = join(root, 'source')
  const skills = join(root, 'skills')
  copyArtifact(source)
  const destination = await installSkill({ sourceRoot: source, targetRoot: skills, lockPort: 0 })
  writeFileSync(
    join(destination, 'references', 'contract.md'),
    `${readFileSync(join(destination, 'references', 'contract.md'), 'utf8')}\nOlder installed revision.\n`,
  )
  stageInstallationBackup(
    destination,
    skills,
    { id: '00000000-0000-4000-8000-000000000003' },
  )

  const replaced = await installSkill({
    sourceRoot: source,
    targetRoot: skills,
    replace: true,
    lockPort: 0,
  })
  assert.deepEqual(validateSkill(replaced, { artifactOnly: true }), [])
})

test('a newer installer recognizes a previously promoted replacement snapshot', async () => {
  const root = temporaryRoot()
  const source = join(root, 'source')
  const promoted = join(root, 'promoted')
  const skills = join(root, 'skills')
  copyArtifact(source)
  copyArtifact(promoted)
  const destination = await installSkill({ sourceRoot: source, targetRoot: skills, lockPort: 0 })
  writeFileSync(
    join(destination, 'references', 'contract.md'),
    `${readFileSync(join(destination, 'references', 'contract.md'), 'utf8')}\nOlder V1 revision.\n`,
  )
  writeFileSync(
    join(promoted, 'references', 'contract.md'),
    `${readFileSync(join(promoted, 'references', 'contract.md'), 'utf8')}\nPromoted V2 revision.\n`,
  )
  stageInstallationBackup(destination, skills, {
    id: '00000000-0000-4000-8000-000000000004',
    replacement: promoted,
  })
  renameSync(promoted, destination)

  const replaced = await installSkill({
    sourceRoot: source,
    targetRoot: skills,
    replace: true,
    lockPort: 0,
  })
  assert.deepEqual(validateSkill(replaced, { artifactOnly: true }), [])
})

test('recovery never promotes a corrupted installation backup', async () => {
  const root = temporaryRoot()
  const source = join(root, 'source')
  const skills = join(root, 'skills')
  copyArtifact(source)
  const destination = await installSkill({ sourceRoot: source, targetRoot: skills, lockPort: 0 })
  writeFileSync(join(destination, 'references', 'contract.md'), 'corrupted backup\n')
  const backup = stageInstallationBackup(
    destination,
    skills,
    { id: '00000000-0000-4000-8000-000000000002' },
  )
  writeFileSync(join(backup.directory, 'references', 'contract.md'), 'corrupted after snapshot\n')

  await assert.rejects(
    installSkill({ sourceRoot: source, targetRoot: skills, lockPort: 0 }),
    /installation backup is invalid/,
  )
  assert.equal(existsSync(destination), false)
  assert.equal(existsSync(backup.directory), true)
})

test('recovery ignores directories that only resemble installer backups', async () => {
  const root = temporaryRoot()
  const source = join(root, 'source')
  const skills = join(root, 'skills')
  const unrelated = join(skills, `.${SKILL_NAME}-backup-personal`)
  copyArtifact(source)
  mkdirSync(unrelated, { recursive: true })
  writeFileSync(join(unrelated, 'keep.txt'), 'belongs to someone else\n')

  await installSkill({ sourceRoot: source, targetRoot: skills, lockPort: 0 })
  assert.equal(readFileSync(join(unrelated, 'keep.txt'), 'utf8'), 'belongs to someone else\n')
})

test('installation dereferences artifact symlinks before the checkout disappears', async () => {
  const root = temporaryRoot()
  const source = join(root, 'source')
  const outside = join(root, 'contract-source.md')
  copyArtifact(source)
  writeFileSync(outside, readFileSync(join(source, 'references', 'contract.md'), 'utf8'))
  rmSync(join(source, 'references', 'contract.md'))
  symlinkSync(outside, join(source, 'references', 'contract.md'))

  const destination = await installSkill({
    sourceRoot: source,
    targetRoot: join(root, 'skills'),
    lockPort: 0,
  })
  rmSync(source, { recursive: true })
  rmSync(outside)

  assert.deepEqual(validateSkill(destination, { artifactOnly: true }), [])
})

test('validation rejects metadata drift and missing references', () => {
  const metadataRoot = temporaryRoot()
  copyArtifact(metadataRoot)
  const skillPath = join(metadataRoot, 'SKILL.md')
  writeFileSync(
    skillPath,
    readFileSync(skillPath, 'utf8').replace('name: test-feedback-loop', 'name: improvised-loop'),
  )
  assert.equal(
    validateSkill(metadataRoot).some((problem) => problem.includes('name must be')),
    true,
  )

  const missingRoot = temporaryRoot()
  copyArtifact(missingRoot)
  rmSync(join(missingRoot, 'references', 'playwright.md'))
  assert.equal(
    validateSkill(missingRoot).some((problem) => problem.includes('missing artifact file')),
    true,
  )

  const contentRoot = temporaryRoot()
  copyArtifact(contentRoot)
  writeFileSync(join(contentRoot, 'references', 'playwright.md'), '# Playwright Profile\n')
  writeFileSync(join(contentRoot, 'references', 'report-template.md'), '# Report\n')
  const contentProblems = validateSkill(contentRoot)
  assert.equal(contentProblems.some((problem) => problem.includes('playwright.md must define')), true)
  assert.equal(contentProblems.some((problem) => problem.includes('report-template.md must define')), true)

  const extraRoot = temporaryRoot()
  copyArtifact(extraRoot)
  writeFileSync(join(extraRoot, 'references', 'extra.md'), 'unreviewed\n')
  assert.equal(
    validateSkill(extraRoot, { artifactOnly: true })
      .some((problem) => problem.includes('installed artifact files differ')),
    true,
  )

  const semanticRoot = temporaryRoot()
  copyArtifact(semanticRoot)
  const contractPath = join(semanticRoot, 'references', 'contract.md')
  writeFileSync(
    contractPath,
    readFileSync(contractPath, 'utf8').replace(
      "1. `guard` when the file's subject",
      "1. `pure` when the file's subject",
    ),
  )
  const semanticProblems = validateSkill(semanticRoot)
  assert.equal(semanticProblems.includes('artifact checksum changed: references/contract.md'), true)
  assert.equal(
    semanticProblems.some((problem) => problem.includes('lane precedence must remain')),
    true,
  )

  const ciRoot = temporaryRoot()
  copyArtifact(ciRoot)
  const playwrightPath = join(ciRoot, 'references', 'playwright.md')
  writeFileSync(
    playwrightPath,
    readFileSync(playwrightPath, 'utf8').replace(
      'CI should use one worker',
      'CI should not use one worker',
    ),
  )
  const ciProblems = validateSkill(ciRoot)
  assert.equal(ciProblems.includes('artifact checksum changed: references/playwright.md'), true)
  assert.equal(ciProblems.some((problem) => problem.includes('CI should use one worker')), true)

  const skillRoot = temporaryRoot()
  copyArtifact(skillRoot)
  const skillVerificationPath = join(skillRoot, 'SKILL.md')
  writeFileSync(
    skillVerificationPath,
    readFileSync(skillVerificationPath, 'utf8').replace(
      'Removing a generated type output and replaying a cache hit restores that output.',
      'A cache hit succeeds.',
    ),
  )
  assert.equal(
    validateSkill(skillRoot)
      .some((problem) => problem.includes('Removing a generated type output')),
    true,
  )

  const reportRoot = temporaryRoot()
  copyArtifact(reportRoot)
  const reportPath = join(reportRoot, 'references', 'report-template.md')
  writeFileSync(
    reportPath,
    readFileSync(reportPath, 'utf8').replace(
      '| Task-specific root/config/environment inputs invalidate only their owning task; unrelated root files do not | | | |\n',
      '',
    ),
  )
  assert.equal(
    validateSkill(reportRoot)
      .some((problem) => problem.includes('Task-specific root/config/environment inputs')),
    true,
  )
})
