import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, describe, test } from "node:test"
import {
  VERSION_FILES,
  assertVersionsConsistent,
  bumpVersion,
  parseReleaseTag,
  readVersionFromContent,
  readVersions,
  writeVersionToContent,
  writeVersions,
  type VersionFile,
  type Versions,
} from "./release-version.ts"

const repoRoot = path.resolve(import.meta.dirname, "..")

const cargoToml = (version: string) => `[package]
name = "launchd-ui"
version = "${version}"
authors = ["azu"]

[dependencies]
serde = { version = "1", features = ["derive"] }

[workspace.package]
version = "9.9.9"
`

const cargoLock = (version: string) => `version = 4

[[package]]
name = "adler2"
version = "2.0.1"

[[package]]
name = "launchd-ui"
version = "${version}"
dependencies = [
 "dirs",
]
`

function fixtureContents(versions: Record<VersionFile, string>) {
  return {
    "package.json":
      JSON.stringify({ name: "launchd-ui", version: versions["package.json"] }, null, 2) +
      "\n",
    "src-tauri/tauri.conf.json":
      JSON.stringify(
        { productName: "launchd-ui", version: versions["src-tauri/tauri.conf.json"] },
        null,
        2
      ) + "\n",
    "src-tauri/Cargo.toml": cargoToml(versions["src-tauri/Cargo.toml"]),
    "src-tauri/Cargo.lock": cargoLock(versions["src-tauri/Cargo.lock"]),
  }
}

const tempDirs: string[] = []

function createFixture(versions: Record<VersionFile, string>): string {
  const dir = mkdtempSync(path.join(tmpdir(), "launchd-ui-version-"))
  tempDirs.push(dir)
  mkdirSync(path.join(dir, "src-tauri"))
  for (const [file, content] of Object.entries(fixtureContents(versions))) {
    writeFileSync(path.join(dir, file), content)
  }
  return dir
}

function sameVersions(version: string): Record<VersionFile, string> {
  return Object.fromEntries(VERSION_FILES.map((file) => [file, version])) as Record<
    VersionFile,
    string
  >
}

function snapshot(dir: string): string[] {
  return VERSION_FILES.map((file) => readFileSync(path.join(dir, file), "utf-8"))
}

function runScript(script: string, args: string[], cwd: string) {
  return spawnSync(process.execPath, [path.join(repoRoot, "scripts", script), ...args], {
    cwd,
    encoding: "utf-8",
  })
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe("readVersionFromContent", () => {
  test("reads [package] version from Cargo.toml, ignoring other tables", () => {
    assert.equal(readVersionFromContent("src-tauri/Cargo.toml", cargoToml("1.4.1")), "1.4.1")
    const noPackageVersion = '[package]\nname = "launchd-ui"\n\n[workspace.package]\nversion = "9.9.9"\n'
    assert.equal(readVersionFromContent("src-tauri/Cargo.toml", noPackageVersion), undefined)
  })

  test("reads the launchd-ui entry from Cargo.lock, not other packages", () => {
    assert.equal(readVersionFromContent("src-tauri/Cargo.lock", cargoLock("1.4.1")), "1.4.1")
  })
})

describe("writeVersionToContent", () => {
  test("changes only the app version line in TOML files", () => {
    const toml = writeVersionToContent("src-tauri/Cargo.toml", cargoToml("1.2.0"), "1.4.1")
    assert.equal(toml, cargoToml("1.4.1"))
    const lock = writeVersionToContent("src-tauri/Cargo.lock", cargoLock("1.2.0"), "1.4.1")
    assert.equal(lock, cargoLock("1.4.1"))
  })

  test("throws when the version cannot be located", () => {
    assert.throws(
      () => writeVersionToContent("src-tauri/Cargo.lock", "version = 4\n", "1.4.1"),
      /Cargo\.lock: version of "launchd-ui" not found/
    )
    assert.throws(
      () => writeVersionToContent("package.json", "{}", "1.4.1"),
      /package\.json: "version" field not found/
    )
  })
})

describe("assertVersionsConsistent", () => {
  const consistent = sameVersions("1.4.1") as Versions

  test("returns the shared version", () => {
    assert.equal(assertVersionsConsistent(consistent), "1.4.1")
    assert.equal(assertVersionsConsistent(consistent, "1.4.1"), "1.4.1")
  })

  test("rejects the drift that sent v1.4.1 assets to v1.2.0 (issue #14)", () => {
    const drifted: Versions = { ...(sameVersions("1.2.0") as Versions), "package.json": "1.2.1" }
    assert.throws(() => assertVersionsConsistent(drifted), /Version mismatch[\s\S]*package\.json: 1\.2\.1/)
  })

  test("rejects versions that differ from the release tag", () => {
    assert.throws(
      () => assertVersionsConsistent(sameVersions("1.2.0") as Versions, parseReleaseTag("v1.4.1")),
      /do not match expected version 1\.4\.1/
    )
  })

  test("rejects a missing version", () => {
    const missing: Versions = { ...consistent, "src-tauri/Cargo.lock": undefined }
    assert.throws(() => assertVersionsConsistent(missing), /Cargo\.lock: \(not found\)/)
  })
})

describe("parseReleaseTag / bumpVersion", () => {
  test("accepts only vX.Y.Z tags", () => {
    assert.equal(parseReleaseTag("v1.4.1"), "1.4.1")
    for (const tag of ["1.4.1", "v1.4", "v1.4.1-beta", "release-1.4.1"]) {
      assert.throws(() => parseReleaseTag(tag), /Invalid release tag/)
    }
  })

  test("bumps patch, minor and major", () => {
    assert.equal(bumpVersion("1.4.1", "patch"), "1.4.2")
    assert.equal(bumpVersion("1.4.1", "minor"), "1.5.0")
    assert.equal(bumpVersion("1.4.1", "major"), "2.0.0")
    assert.throws(() => bumpVersion("1.4", "patch"), /Invalid version/)
  })
})

describe("version files on disk", () => {
  test("the repository's version files are consistent", () => {
    assert.doesNotThrow(() => assertVersionsConsistent(readVersions(repoRoot)))
  })

  test("writeVersions updates all files", () => {
    const dir = createFixture(sameVersions("1.2.0"))
    writeVersions(dir, "1.4.1")
    assert.deepEqual(readVersions(dir), sameVersions("1.4.1"))
  })

  test("writeVersions leaves every file untouched when one cannot be updated", () => {
    const dir = createFixture(sameVersions("1.2.0"))
    writeFileSync(path.join(dir, "src-tauri/Cargo.lock"), "version = 4\n")
    const before = snapshot(dir)
    assert.throws(() => writeVersions(dir, "1.4.1"))
    assert.deepEqual(snapshot(dir), before)
  })
})

describe("CLI scripts", () => {
  test("bump-version bumps all four files together", () => {
    const dir = createFixture(sameVersions("1.4.1"))
    const result = runScript("bump-version.ts", ["patch"], dir)
    assert.equal(result.status, 0, result.stderr)
    assert.equal(result.stdout.trim(), "v1.4.2")
    assert.deepEqual(readVersions(dir), sameVersions("1.4.2"))
  })

  test("bump-version refuses to bump inconsistent files", () => {
    const dir = createFixture({ ...sameVersions("1.2.0"), "package.json": "1.2.1" })
    const before = snapshot(dir)
    const result = runScript("bump-version.ts", ["patch"], dir)
    assert.equal(result.status, 1)
    assert.match(result.stderr, /Version mismatch/)
    assert.deepEqual(snapshot(dir), before)
  })

  test("check-version fails when the tag does not match", () => {
    const dir = createFixture(sameVersions("1.2.0"))
    assert.equal(runScript("check-version.ts", ["v1.2.0"], dir).status, 0)
    const result = runScript("check-version.ts", ["v1.4.1"], dir)
    assert.equal(result.status, 1)
    assert.match(result.stderr, /do not match expected version 1\.4\.1/)
  })
})
