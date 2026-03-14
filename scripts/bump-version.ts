import { readFileSync, writeFileSync } from "node:fs"

const bump = process.argv[2] as "patch" | "minor" | "major" | undefined
if (!bump || !["patch", "minor", "major"].includes(bump)) {
  console.error("Usage: node scripts/bump-version.ts <patch|minor|major>")
  process.exit(1)
}

const pkg = JSON.parse(readFileSync("package.json", "utf-8"))
const [major, minor, patch] = pkg.version.split(".").map(Number)

const newVersion =
  bump === "major"
    ? `${major + 1}.0.0`
    : bump === "minor"
      ? `${major}.${minor + 1}.0`
      : `${major}.${minor}.${patch + 1}`

// package.json
pkg.version = newVersion
writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n")

// src-tauri/tauri.conf.json
const tauriConf = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf-8"))
tauriConf.version = newVersion
writeFileSync("src-tauri/tauri.conf.json", JSON.stringify(tauriConf, null, 2) + "\n")

// src-tauri/Cargo.toml
const cargoToml = readFileSync("src-tauri/Cargo.toml", "utf-8")
const updatedCargo = cargoToml.replace(
  /^version = ".*"$/m,
  `version = "${newVersion}"`
)
writeFileSync("src-tauri/Cargo.toml", updatedCargo)

// src-tauri/Cargo.lock — update the version for the launchd-ui package
const cargoLock = readFileSync("src-tauri/Cargo.lock", "utf-8")
const updatedLock = cargoLock.replace(
  /(\[\[package\]\]\nname = "launchd-ui"\nversion = )"[^"]*"/,
  `$1"${newVersion}"`
)
writeFileSync("src-tauri/Cargo.lock", updatedLock)

console.log(`v${newVersion}`)
