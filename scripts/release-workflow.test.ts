import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, test } from "node:test"

const repoRoot = path.resolve(import.meta.dirname, "..")
const read = (file: string) => readFileSync(path.join(repoRoot, file), "utf-8")

const releaseWorkflow = read(".github/workflows/release.yml")
const createReleasePrWorkflow = read(".github/workflows/create-release-pr.yml")
const readme = read("README.md")
const productName: string = JSON.parse(read("src-tauri/tauri.conf.json")).productName

const RELEASE_LABEL = "Type: Release"

// Rust target in the release matrix -> arch suffix tauri-action uses for the
// macOS assets (e.g. launchd-ui_x64.app.tar.gz, launchd-ui_1.4.1_x64.dmg).
const MAC_TARGETS = {
  "aarch64-apple-darwin": "aarch64",
  "x86_64-apple-darwin": "x64",
} as const

function indexOrFail(text: string, needle: string): number {
  const index = text.indexOf(needle)
  assert.notEqual(index, -1, `missing: ${needle}`)
  return index
}

describe("create-release-pr workflow", () => {
  test("is started manually with a patch/minor/major choice", () => {
    assert.match(createReleasePrWorkflow, /^\s+workflow_dispatch:$/m)
    assert.match(createReleasePrWorkflow, /options:\s+- patch\s+- minor\s+- major/)
  })

  test("bumps all version files with the shared script", () => {
    indexOrFail(createReleasePrWorkflow, 'node scripts/bump-version.ts "$SEMVER"')
    assert.match(createReleasePrWorkflow, /SEMVER: \$\{\{ inputs\.semver \}\}/)
  })

  test("labels the PR with the label the release workflow waits for", () => {
    assert.ok(createReleasePrWorkflow.includes(`labels: "${RELEASE_LABEL}"`))
    assert.ok(releaseWorkflow.includes(`'${RELEASE_LABEL}'`))
  })
})

describe("release workflow", () => {
  test("runs only for merged release PRs from this repository", () => {
    assert.match(releaseWorkflow, /pull_request:\s+branches: \[main\]\s+types: \[closed\]/)
    assert.doesNotMatch(releaseWorkflow, /^\s+tags:/m)
    for (const condition of [
      "github.event.pull_request.merged == true",
      "github.event.pull_request.head.repo.full_name == github.repository",
      `contains(github.event.pull_request.labels.*.name, '${RELEASE_LABEL}')`,
    ]) {
      indexOrFail(releaseWorkflow, condition)
    }
  })

  test("builds the merge commit, not the PR head", () => {
    const refs = releaseWorkflow.match(/ref: \$\{\{ github\.event\.pull_request\.merge_commit_sha \}\}/g)
    assert.equal(refs?.length, 2, "create-release and build must check out the merge commit")
  })

  test("uploads to the draft release it created, never one derived from tauri.conf.json", () => {
    assert.doesNotMatch(releaseWorkflow, /__VERSION__/)
    assert.doesNotMatch(releaseWorkflow, /tagName:/)
    indexOrFail(releaseWorkflow, "-F draft=true")
    indexOrFail(releaseWorkflow, "releaseId: ${{ needs.create-release.outputs.release_id }}")
  })

  test("checks the version files against the tag before building", () => {
    const check = indexOrFail(releaseWorkflow, 'node scripts/check-version.ts "$RELEASE_TAG"')
    const build = indexOrFail(releaseWorkflow, "uses: tauri-apps/tauri-action@")
    assert.ok(check < build, "version check must run before tauri-action")
    indexOrFail(releaseWorkflow, "RELEASE_TAG: ${{ needs.create-release.outputs.tag }}")
  })

  test("builds both Apple Silicon and Intel targets", () => {
    for (const target of Object.keys(MAC_TARGETS)) {
      indexOrFail(releaseWorkflow, `args: "--target ${target}"`)
    }
  })

  test("publishes only after every expected asset is uploaded", () => {
    const publish = indexOrFail(releaseWorkflow, "-F draft=false")
    assert.ok(publish > indexOrFail(releaseWorkflow, "needs: [create-release, build]"))
    for (const arch of Object.values(MAC_TARGETS)) {
      const archive = indexOrFail(releaseWorkflow, `"${productName}_${arch}.app.tar.gz"`)
      const dmg = indexOrFail(releaseWorkflow, `"${productName}_\${version}_${arch}.dmg"`)
      assert.ok(archive < publish && dmg < publish)
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
