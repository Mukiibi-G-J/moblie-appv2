/**
 * Validates screenshot assets for design-system extraction and parses design-system.json.
 * Run from repo root: node scripts/validate-design-system-assets.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SCREENSHOT_DIR = path.join(ROOT, 'square screen shoots');
const REQUIRED = [4, 5, 6, 7, 8, 9, 10].map(
  (n) => `shared image (${n}).jpeg`,
);
const DESIGN_SYSTEM = path.join(ROOT, 'src', 'design-system', 'design-system.json');
const BRAND = path.join(ROOT, 'src', 'design-system', 'brand-palette.json');

function main() {
  const missing = [];
  for (const name of REQUIRED) {
    const p = path.join(SCREENSHOT_DIR, name);
    try {
      fs.accessSync(p, fs.constants.R_OK);
    } catch {
      missing.push(name);
    }
  }
  if (missing.length) {
    console.error('Missing screenshot files:', missing.join(', '));
    process.exit(1);
  }
  console.log('All', REQUIRED.length, 'screenshots present in', path.relative(ROOT, SCREENSHOT_DIR));

  for (const [label, file] of [
    ['brand-palette.json', BRAND],
    ['design-system.json', DESIGN_SYSTEM],
  ]) {
    const raw = fs.readFileSync(file, 'utf8');
    try {
      JSON.parse(raw);
    } catch (e) {
      console.error('Invalid JSON:', label, e.message);
      process.exit(1);
    }
    console.log('OK parse:', path.relative(ROOT, file));
  }
  process.exit(0);
}

main();
