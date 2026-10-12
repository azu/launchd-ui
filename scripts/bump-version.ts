import {
  assertVersionsConsistent,
  bumpVersion,
  readVersions,
  writeVersions,
  type BumpKind,
} from "./release-version.ts"

const bump = process.argv[2] as BumpKind | undefined
if (!bump || !["patch", "minor", "major"].includes(bump)) {
  console.error("Usage: node scripts/bump-version.ts <patch|minor|major>")
  process.exit(1)
}

const root = process.cwd()

try {
  // Refuse to bump from an inconsistent state; otherwise the new tag and the
  // version embedded in the app (and used for asset upload) would diverge.
  const current = assertVersionsConsistent(readVersions(root))
  const newVersion = bumpVersion(current, bump)
  writeVersions(root, newVersion)
  assertVersionsConsistent(readVersions(root), newVersion)
  console.log(`v${newVersion}`)
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}
