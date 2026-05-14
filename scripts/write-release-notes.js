/**
 * Prints the CHANGELOG.md section for the current package.json version
 * (for gh release create --notes-file).
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const version = require(path.join(root, 'package.json')).version;
const changelogPath = path.join(root, 'CHANGELOG.md');
const changelog = fs.readFileSync(changelogPath, 'utf8');
const lines = changelog.split('\n');
const header = `## [${version}]`;
const idx = lines.findIndex((l) => l.startsWith(header));

if (idx === -1) {
  console.error(
    `CHANGELOG.md has no section "${header}". Add it (and move items from [Unreleased]) before releasing.`,
  );
  process.exit(1);
}

const out = [];
for (let i = idx; i < lines.length; i++) {
  const line = lines[i];
  if (i > idx && line.startsWith('## [')) break;
  out.push(line);
}

process.stdout.write(out.join('\n').trimEnd());
process.stdout.write('\n');
