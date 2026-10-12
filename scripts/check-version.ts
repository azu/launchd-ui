import {
  assertVersionsConsistent,
  parseReleaseTag,
  readVersions,
} from "./release-version.ts"

// Usage: node scripts/check-version.ts [vX.Y.Z]
// Without a tag, checks that all version files agree.
// With a tag, also checks that they match the tag.
const tag = process.argv[2]

try {
  const expected = tag === undefined ? undefined : parseReleaseTag(tag)
  const version = assertVersionsConsistent(readVersions(process.cwd()), expected)
  console.log(
    tag === undefined
      ? `All version files are at ${version}`
      : `All version files match ${tag}`
  )
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}
