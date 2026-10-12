import { readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

// Every file that carries the app version. tauri-action names the release
// assets from tauri.conf.json, so all of these must agree with the git tag.
export const VERSION_FILES = [
  "package.json",
  "src-tauri/tauri.conf.json",
  "src-tauri/Cargo.toml",
  "src-tauri/Cargo.lock",
] as const

export type VersionFile = (typeof VERSION_FILES)[number]
export type Versions = Record<VersionFile, string | undefined>
export type BumpKind = "patch" | "minor" | "major"

const PACKAGE_NAME = "launchd-ui"
const SEMVER = /^\d+\.\d+\.\d+$/
const TOML_VERSION_LINE = /^(version\s*=\s*)"([^"]*)"(\s*)$/

// Line index of `version = "..."` inside the [package] table of Cargo.toml.
function findCargoTomlVersionLine(lines: string[]): number {
  const start = lines.findIndex((line) => line.trim() === "[package]")
  if (start === -1) return -1
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].trimStart().startsWith("[")) return -1
    if (TOML_VERSION_LINE.test(lines[i])) return i
  }
  return -1
}

// Line index of the version of this app's own entry in Cargo.lock.
function findCargoLockVersionLine(lines: string[]): number {
  for (let i = 1; i < lines.length - 1; i++) {
    if (
      lines[i - 1] === "[[package]]" &&
      lines[i] === `name = "${PACKAGE_NAME}"` &&
      TOML_VERSION_LINE.test(lines[i + 1])
    ) {
      return i + 1
    }
  }
  return -1
}

function findTomlVersionLine(file: VersionFile, lines: string[]): number {
  return file === "src-tauri/Cargo.toml"
    ? findCargoTomlVersionLine(lines)
    : findCargoLockVersionLine(lines)
}

export function readVersionFromContent(
  file: VersionFile,
  content: string
): string | undefined {
  if (file === "package.json" || file === "src-tauri/tauri.conf.json") {
    const version = JSON.parse(content).version
    return typeof version === "string" ? version : undefined
  }
  const lines = content.split("\n")
  const index = findTomlVersionLine(file, lines)
  return index === -1 ? undefined : lines[index].match(TOML_VERSION_LINE)?.[2]
}

export function writeVersionToContent(
  file: VersionFile,
  content: string,
  version: string
): string {
  if (file === "package.json" || file === "src-tauri/tauri.conf.json") {
    const json = JSON.parse(content)
    if (typeof json.version !== "string") {
      throw new Error(`${file}: "version" field not found`)
    }
    json.version = version
    return JSON.stringify(json, null, 2) + "\n"
  }
  const lines = content.split("\n")
  const index = findTomlVersionLine(file, lines)
  if (index === -1) {
    throw new Error(`${file}: version of "${PACKAGE_NAME}" not found`)
  }
  lines[index] = lines[index].replace(TOML_VERSION_LINE, `$1"${version}"$3`)
  return lines.join("\n")
}

export function readVersions(root: string): Versions {
  const versions = {} as Versions
  for (const file of VERSION_FILES) {
    const content = readFileSync(path.join(root, file), "utf-8")
    versions[file] = readVersionFromContent(file, content)
  }
  return versions
}

export function writeVersions(root: string, version: string): void {
  // Compute every update before writing so a failure leaves no partial bump.
  const updates = VERSION_FILES.map((file) => {
    const filePath = path.join(root, file)
    const content = readFileSync(filePath, "utf-8")
    return { filePath, content: writeVersionToContent(file, content, version) }
  })
  for (const { filePath, content } of updates) {
    writeFileSync(filePath, content)
  }
}

function formatVersions(versions: Versions): string {
  return VERSION_FILES.map(
    (file) => `  ${file}: ${versions[file] ?? "(not found)"}`
  ).join("\n")
}

// Returns the shared version, or throws if any file is missing a version,
// the files disagree, or (when given) they differ from `expected`.
export function assertVersionsConsistent(
  versions: Versions,
  expected?: string
): string {
  const values = VERSION_FILES.map((file) => versions[file])
  const target = expected ?? values[0]
  const ok =
    target !== undefined &&
    SEMVER.test(target) &&
    values.every((value) => value === target)
  if (!ok) {
    const header =
      expected === undefined
        ? "Version mismatch between files:"
        : `Versions do not match expected version ${expected}:`
    throw new Error(`${header}\n${formatVersions(versions)}`)
  }
  return target
}

export function parseReleaseTag(tag: string): string {
  const match = /^v(\d+\.\d+\.\d+)$/.exec(tag)
  if (!match) {
    throw new Error(`Invalid release tag "${tag}": expected vX.Y.Z`)
  }
  return match[1]
}

export function bumpVersion(version: string, kind: BumpKind): string {
  if (!SEMVER.test(version)) {
    throw new Error(`Invalid version "${version}": expected X.Y.Z`)
  }
  const [major, minor, patch] = version.split(".").map(Number)
  switch (kind) {
    case "major":
      return `${major + 1}.0.0`
    case "minor":
      return `${major}.${minor + 1}.0`
    case "patch":
      return `${major}.${minor}.${patch + 1}`
  }
}
