#!/usr/bin/env node
/**
 * Locale parity gate (WS-07).
 *
 * Diffs every locale (base file + per-module pairs) against the English base.
 * "Approved" keys are those present in the REAL locale files — the
 * `src/lib/i18n/drafts/` directory is ignored entirely, so ai-draft keys never
 * satisfy parity.
 *
 * Skips ../src/lib/i18n/drafts. Compares approved counts against
 * scripts/locale_baseline.json. With no baseline (or --write-baseline) it
 * writes the current counts and exits 0. Otherwise it exits 1 when any locale
 * drops below its baseline, or when en/hi parity breaks (hi missing an en key).
 */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const LOCALES_DIR = path.join(__dirname, '..', 'src', 'lib', 'i18n', 'locales');
const BASELINE_PATH = path.join(__dirname, 'locale_baseline.json');

const KEY_RE = /^\s*(?:'([^']+)'|"([^"]+)"|([A-Za-z_$][\w$]*))\s*:/gm;

function extractKeys(file) {
  const text = fs.readFileSync(file, 'utf8');
  const keys = new Set();
  let match;
  KEY_RE.lastIndex = 0;
  while ((match = KEY_RE.exec(text)) !== null) {
    const key = match[1] ?? match[2] ?? match[3];
    if (key && key !== 'default') keys.add(key);
  }
  return keys;
}

function collect() {
  // localeCode -> Set(keys)
  const locales = {};
  for (const name of fs.readdirSync(LOCALES_DIR)) {
    if (!name.endsWith('.ts') || name.endsWith('.d.ts')) continue;
    const m = name.match(/^([a-z]{2,3})(?:\.([A-Za-z0-9_-]+))?\.ts$/);
    if (!m) continue;
    const code = m[1];
    locales[code] = locales[code] ?? new Set();
    for (const key of extractKeys(path.join(LOCALES_DIR, name))) locales[code].add(key);
  }
  return locales;
}

const locales = collect();
const enTotal = locales.en ?? new Set();
const writeBaseline = process.argv.includes('--write-baseline');

let failed = false;
const summary = {};
for (const [code, keys] of Object.entries(locales).sort()) {
  const missing = [...enTotal].filter((k) => !keys.has(k));
  const extra = [...keys].filter((k) => !enTotal.has(k));
  const approved = keys.size;
  summary[code] = approved;
  console.log(
    `${code.padEnd(6)} approved=${String(approved).padStart(4)} missing=${String(missing.length).padStart(4)} extra=${String(extra.length).padStart(3)}`
  );
}

if (writeBaseline || !fs.existsSync(BASELINE_PATH)) {
  fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(`\nwrote baseline to ${path.relative(process.cwd(), BASELINE_PATH)}`);
  process.exit(0);
}

const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
for (const [code, count] of Object.entries(summary)) {
  const floor = baseline[code];
  if (floor !== undefined && count < floor) {
    console.error(`REGRESSION: ${code} approved ${count} < baseline ${floor}`);
    failed = true;
  }
}

const hiMissing = [...enTotal].filter((k) => !(locales.hi ?? new Set()).has(k));
if (hiMissing.length > 0) {
  console.error(`en/hi parity broken: hi missing ${hiMissing.length} en keys`);
  failed = true;
}

process.exit(failed ? 1 : 0);
