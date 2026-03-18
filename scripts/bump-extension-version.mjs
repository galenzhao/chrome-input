import fs from "node:fs";
import path from "node:path";

function parseSemver(version) {
  const parts = version.trim().split(".");
  if (parts.length !== 3) {
    throw new Error(
      `Unsupported version format: "${version}". Expected "major.minor.patch".`
    );
  }

  const [major, minor, patch] = parts.map((p) => Number(p));
  if ([major, minor, patch].some((n) => !Number.isFinite(n) || n < 0)) {
    throw new Error(`Invalid semver numbers in: "${version}"`);
  }
  return { major, minor, patch };
}

function bump({ major, minor, patch }, level) {
  if (level === "patch") return { major, minor, patch: patch + 1 };
  if (level === "minor") return { major, minor: minor + 1, patch: 0 };
  if (level === "major") return { major: major + 1, minor: 0, patch: 0 };
  throw new Error(`Unknown bump level: "${level}". Use major/minor/patch.`);
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

const repoRoot = process.cwd();
const bumpLevel = (process.argv[2] || process.env.BUMP_LEVEL || "patch").toLowerCase();

const pkgPath = path.join(repoRoot, "package.json");
const manifestPath = path.join(repoRoot, "manifest.json");
const lockPath = path.join(repoRoot, "package-lock.json");

const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const lock = fs.existsSync(lockPath) ? JSON.parse(fs.readFileSync(lockPath, "utf8")) : undefined;

const currentVersion = pkg.version ?? manifest.version;
if (!currentVersion) {
  throw new Error("Cannot bump version: package.json or manifest.json is missing `version`.");
}

const semver = parseSemver(currentVersion);
const next = bump(semver, bumpLevel);
const nextVersion = `${next.major}.${next.minor}.${next.patch}`;

pkg.version = nextVersion;
manifest.version = nextVersion;

if (lock) {
  lock.version = nextVersion;
  if (lock.packages && lock.packages[""] && typeof lock.packages[""].version === "string") {
    lock.packages[""].version = nextVersion;
  }
}

writeJson(pkgPath, pkg);
writeJson(manifestPath, manifest);
if (lock) writeJson(lockPath, lock);

// Useful for CI logs / manual runs.
console.log(`Bumped extension version: ${currentVersion} -> ${nextVersion}`);

