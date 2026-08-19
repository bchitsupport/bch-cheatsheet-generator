/**
 * Package skill/bch-cheat-sheet/ into the zip that Claude accepts, and verify it.
 *
 * Do not build this with PowerShell's Compress-Archive. On Windows PowerShell 5.1
 * it writes the platform path separator into the archive, producing entries like
 * `bch-cheat-sheet\SKILL.md`. The ZIP spec requires forward slashes, and Claude
 * rejects the upload with "Zip file contains path with invalid characters" — a
 * failure that only shows up at upload time, long after the build looked fine.
 *
 *   npm run build:skill
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skillDir = path.join(root, 'skill');
const name = 'bch-cheat-sheet';
const zipPath = path.join(skillDir, `${name}.zip`);

if (!fs.existsSync(path.join(skillDir, name, 'SKILL.md'))) {
  console.error(`No SKILL.md in skill/${name}/`);
  process.exit(1);
}

// bsdtar ships with Windows 10+ and every mac/Linux; it writes conformant paths.
fs.rmSync(zipPath, { force: true });
execFileSync('tar', ['-a', '-c', '-f', zipPath, name], { cwd: skillDir, stdio: 'inherit' });

// ---- verify what we just wrote, rather than trusting the tool
const buf = fs.readFileSync(zipPath);
const names = [];

// Walk the central directory: each entry starts with the signature PK\x01\x02.
for (let i = 0; i < buf.length - 46; i++) {
  if (buf.readUInt32LE(i) !== 0x02014b50) continue;
  const nameLen = buf.readUInt16LE(i + 28);
  names.push(buf.subarray(i + 46, i + 46 + nameLen).toString('utf8'));
}

if (names.length === 0) {
  console.error('Could not read the central directory — is this a valid zip?');
  process.exit(1);
}

const backslashed = names.filter((n) => n.includes('\\'));
const hasSkillMd = names.some((n) => n === `${name}/SKILL.md`);

console.log(`\n${names.length} entries:`);
for (const n of names) console.log(`  ${n}`);

const problems = [];
if (backslashed.length) {
  problems.push(
    `${backslashed.length} entries use backslashes — Claude will reject this zip:\n` +
      backslashed.map((n) => `    ${n}`).join('\n'),
  );
}
if (!hasSkillMd) problems.push(`No ${name}/SKILL.md at the expected path.`);

const frontmatter = fs.readFileSync(path.join(skillDir, name, 'SKILL.md'), 'utf8').slice(0, 400);
if (!/^---\r?\n(?:.*\r?\n)*?name:\s*\S/.test(frontmatter)) {
  problems.push('SKILL.md is missing a YAML `name:` in its frontmatter.');
}
if (!/^---\r?\n(?:.*\r?\n)*?description:\s*\S/m.test(frontmatter)) {
  problems.push('SKILL.md is missing a YAML `description:` in its frontmatter.');
}

if (problems.length) {
  console.error(`\nFAILED\n  ${problems.join('\n  ')}`);
  process.exit(1);
}

console.log(
  `\nOK — ${path.relative(root, zipPath)} (${Math.round(buf.length / 1024)}KB), ` +
    'forward-slash paths, SKILL.md present with name and description.',
);
