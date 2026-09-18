import { createHash, randomUUID } from 'node:crypto'
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { createServer } from 'node:net'
import { homedir } from 'node:os'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ARTIFACT_ENTRIES, SKILL_NAME } from './artifact.mjs'
import { validateSkill } from './validate.mjs'

const SOURCE_ROOT = fileURLToPath(new URL('..', import.meta.url))
export const INSTALL_LOCK_PORT = 4595

export function installPlan(args) {
  if (args.length === 0) return { replace: false }
  if (args.length === 1 && args[0] === '--replace') return { replace: true }
  throw new Error('Usage: pnpm install:global [-- --replace]')
}

export async function claimInstallLock(port = INSTALL_LOCK_PORT) {
  const server = createServer()
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject)
      server.listen(port, '127.0.0.1', resolve)
    })
  } catch (error) {
    if (error.code === 'EADDRINUSE') {
      throw new Error(`Refusing concurrent installation: 127.0.0.1:${port} is already held.`)
    }
    throw error
  }
  let released = false
  return {
    port: server.address().port,
    async release() {
      if (released) return
      released = true
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
      })
    },
  }
}

function snapshotFiles(root, directory = root, files = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isSymbolicLink()) throw new Error(`Installation backup contains a symlink: ${path}`)
    if (entry.isDirectory()) {
      snapshotFiles(root, path, files)
      continue
    }
    if (!entry.isFile()) throw new Error(`Installation backup contains a special file: ${path}`)
    const relativePath = relative(root, path).split(sep).join('/')
    files.push([relativePath, createHash('sha256').update(readFileSync(path)).digest('hex')])
  }
  return files.toSorted(([a], [b]) => a.localeCompare(b))
}

function snapshotMatches(directory, expected) {
  return JSON.stringify(snapshotFiles(directory)) === JSON.stringify(expected)
}

function backupRecord(root, id) {
  const directoryName = `.${SKILL_NAME}-backup-${id}`
  return {
    directory: join(root, directoryName),
    manifest: join(root, `${directoryName}.json`),
    directoryName,
  }
}

function validSnapshot(value) {
  return Array.isArray(value) &&
    value.every((entry) => {
      if (!Array.isArray(entry) || entry.length !== 2) return false
      const [path, hash] = entry
      return typeof path === 'string' &&
        !path.startsWith('/') &&
        !path.split('/').includes('..') &&
        typeof hash === 'string' &&
        /^[0-9a-f]{64}$/.test(hash)
    })
}

export function stageInstallationBackup(
  destination,
  root,
  { id = randomUUID(), replacement = null } = {},
) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)) {
    throw new Error('Installation backup id must be a UUIDv4.')
  }
  const record = backupRecord(root, id)
  if (existsSync(record.directory) || existsSync(record.manifest)) {
    throw new Error(`Installation backup already exists: ${id}`)
  }
  const manifest = {
    schema: 1,
    skill: SKILL_NAME,
    directory: record.directoryName,
    files: snapshotFiles(destination),
    replacementFiles: replacement ? snapshotFiles(replacement) : null,
  }
  writeFileSync(record.manifest, `${JSON.stringify(manifest)}\n`, { flag: 'wx', mode: 0o600 })
  try {
    renameSync(destination, record.directory)
    return {
      ...record,
      files: manifest.files,
      replacementFiles: manifest.replacementFiles,
    }
  } catch (error) {
    unlinkSync(record.manifest)
    throw error
  }
}

function installationBackups(root) {
  const pattern = new RegExp(
    `^\\.${SKILL_NAME}-backup-([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\\.json$`,
  )
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const match = entry.isFile() ? pattern.exec(entry.name) : null
    if (!match) return []
    const record = backupRecord(root, match[1])
    let manifest
    try {
      manifest = JSON.parse(readFileSync(record.manifest, 'utf8'))
    } catch {
      throw new Error(`Cannot read installation backup manifest: ${record.manifest}`)
    }
    if (
      manifest?.schema !== 1 ||
      manifest.skill !== SKILL_NAME ||
      manifest.directory !== record.directoryName ||
      !validSnapshot(manifest.files) ||
      (manifest.replacementFiles !== null && !validSnapshot(manifest.replacementFiles))
    ) {
      throw new Error(`Invalid installation backup manifest: ${record.manifest}`)
    }
    return [{
      ...record,
      files: manifest.files,
      replacementFiles: manifest.replacementFiles,
    }]
  })
}

function recoverInterruptedReplacement(root, destination) {
  const records = installationBackups(root)
  for (const record of records.filter(({ directory }) => !existsSync(directory))) {
    unlinkSync(record.manifest)
  }
  const backups = records.filter(({ directory }) => existsSync(directory))
  if (backups.length === 0) return
  if (backups.length !== 1) {
    throw new Error(`Cannot recover ${SKILL_NAME}: multiple installation backups exist.`)
  }

  if (!existsSync(destination)) {
    if (!snapshotMatches(backups[0].directory, backups[0].files)) {
      throw new Error(`Cannot recover ${SKILL_NAME}: the installation backup is invalid.`)
    }
    renameSync(backups[0].directory, destination)
    unlinkSync(backups[0].manifest)
    return
  }

  const backup = backups[0]
  if (
    backup.replacementFiles === null ||
    !snapshotMatches(destination, backup.replacementFiles)
  ) {
    throw new Error('Cannot clean an installation backup: the promoted skill does not match its recorded replacement.')
  }
  if (!snapshotMatches(backup.directory, backup.files)) {
    throw new Error(`Cannot clean a corrupted installation backup: ${backup.directory}`)
  }
  rmSync(backup.directory, { recursive: true, force: true })
  unlinkSync(backup.manifest)
}

function copyDereferenced(source, destination, ancestors = new Set()) {
  const real = realpathSync(source)
  const stats = statSync(source)
  if (stats.isFile()) {
    copyFileSync(source, destination)
    return
  }
  if (!stats.isDirectory()) throw new Error(`Artifact entry is not a file or directory: ${source}`)
  if (ancestors.has(real)) throw new Error(`Artifact contains a directory cycle: ${source}`)

  const nextAncestors = new Set(ancestors).add(real)
  mkdirSync(destination, { recursive: true })
  for (const entry of readdirSync(source)) {
    copyDereferenced(join(source, entry), join(destination, entry), nextAncestors)
  }
}

export async function installSkill({
  sourceRoot = SOURCE_ROOT,
  targetRoot = join(homedir(), '.cursor', 'skills'),
  replace = false,
  lockPort = INSTALL_LOCK_PORT,
} = {}) {
  const sourceProblems = validateSkill(sourceRoot)
  if (sourceProblems.length > 0) {
    throw new Error(`Source skill is invalid:\n${sourceProblems.join('\n')}`)
  }

  const root = resolve(targetRoot)
  const destination = join(root, SKILL_NAME)
  mkdirSync(root, { recursive: true })
  const lock = await claimInstallLock(lockPort)
  let prepared
  try {
    recoverInterruptedReplacement(root, destination)
    if (existsSync(destination) && !replace) {
      throw new Error(`Refusing to overwrite existing skill: ${destination}\nRerun with --replace.`)
    }

    prepared = mkdtempSync(join(root, `.${SKILL_NAME}-install-`))
    for (const entry of ARTIFACT_ENTRIES) {
      const destinationEntry = join(prepared, entry)
      mkdirSync(dirname(destinationEntry), { recursive: true })
      copyDereferenced(join(sourceRoot, entry), destinationEntry)
    }
    const preparedProblems = validateSkill(prepared, { artifactOnly: true })
    if (preparedProblems.length > 0) {
      throw new Error(`Prepared skill is invalid:\n${preparedProblems.join('\n')}`)
    }

    if (!existsSync(destination)) {
      renameSync(prepared, destination)
      return destination
    }
    if (!replace) {
      throw new Error(`Refusing to overwrite existing skill: ${destination}\nRerun with --replace.`)
    }

    const backup = stageInstallationBackup(destination, root, { replacement: prepared })
    try {
      renameSync(prepared, destination)
      rmSync(backup.directory, { recursive: true, force: true })
      unlinkSync(backup.manifest)
      return destination
    } catch (error) {
      if (!existsSync(destination) && existsSync(backup.directory)) {
        if (!snapshotMatches(backup.directory, backup.files)) {
          throw new Error(`Replacement failed and its installation backup is invalid: ${backup.directory}`, {
            cause: error,
          })
        }
        renameSync(backup.directory, destination)
        unlinkSync(backup.manifest)
      }
      throw error
    }
  } finally {
    try {
      if (prepared && existsSync(prepared)) rmSync(prepared, { recursive: true, force: true })
    } finally {
      await lock.release()
    }
  }
}

async function main() {
  const plan = installPlan(process.argv.slice(2))
  const destination = await installSkill(plan)
  process.stdout.write(`Installed ${SKILL_NAME} at ${destination}\n`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : 'Skill installation failed.'}\n`)
    process.exitCode = 1
  })
}
