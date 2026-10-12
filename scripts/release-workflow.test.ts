import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, test } from "node:test"

const repoRoot = path.resolve(import.meta.dirname, "..")
const read = (file: string) => readFileSync(path.join(repoRoot, file), "utf-8")

const releaseWorkflow = read(".github/workflows/release.yml")
const readme = read("README.md")
const productName: string = JSON.parse(read("src-tauri/tauri.conf.json")).productName

// Rust target in the release matrix -> arch suffix tauri-action uses for the
// macOS app archive (e.g. launchd-ui_x64.app.tar.gz).
const MAC_TARGETS = {
  "aarch64-apple-darwin": "aarch64",
  "x86_64-apple-darwin": "x64",
} as const

describe("release workflow", () => {
  test("uploads assets to the pushed tag, not one derived from tauri.conf.json", () => {
    assert.match(releaseWorkflow, /^\s+tagName: \$\{\{ github\.ref_name \}\}$/m)
    assert.doesNotMatch(releaseWorkflow, /__VERSION__/)
  })

  test("checks the version files against the tag before building", () => {
    const check = releaseWorkflow.indexOf("node scripts/check-version.ts \"$RELEASE_TAG\"")
    const build = releaseWorkflow.indexOf("uses: tauri-apps/tauri-action@")
    assert.notEqual(check, -1, "version check step is missing")
    assert.notEqual(build, -1, "tauri-action step is missing")
    assert.ok(check < build, "version check must run before tauri-action")
    assert.match(releaseWorkflow, /RELEASE_TAG: \$\{\{ github\.ref_name \}\}/)
  })

  test("builds both Apple Silicon and Intel targets", () => {
    for (const target of Object.keys(MAC_TARGETS)) {
      assert.match(releaseWorkflow, new RegExp(`args: "--target ${target}"`))
    }
  })
})

describe("README install instructions", () => {
  for (const [target, arch] of Object.entries(MAC_TARGETS)) {
    test(`downloads the ${target} archive from the latest release`, () => {
      const url = `https://github.com/azu/launchd-ui/releases/latest/download/${productName}_${arch}.app.tar.gz`
      assert.ok(readme.includes(`curl -fL "${url}" | tar xz -C /Applications`), url)
    })
  }

  test("removes quarantine from the extracted app bundle", () => {
    assert.ok(readme.includes(`xattr -cr /Applications/${productName}.app`))
  })
})
