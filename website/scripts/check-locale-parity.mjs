#!/usr/bin/env node
/**
 * en/hi locale key parity gate (WS-06) — fails the build when either
 * dictionary has a top-level key the other lacks. All user-facing strings must
 * exist in both locales at ship time (global rule 6).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function keysOf(locale) {
  const text = readFileSync(join(root, 'src', 'lib', 'i18n', 'locales', `${locale}.ts`), 'utf8');
  const keys = new Set();
  for (const line of text.split('\n')) {
    const match = line.match(/^\s{2}(?:'([^']+)'|"([^"]+)"|([A-Za-z_$][\w$]*))\s*:/);
    if (match) keys.add(match[1] || match[2] || match[3]);
  }
  return keys;
}

const en = keysOf('en');
const hi = keysOf('hi');
const missingInHi = [...en].filter((key) => !hi.has(key));
const missingInEn = [...hi].filter((key) => !en.has(key));

if (missingInHi.length || missingInEn.length) {
  if (missingInHi.length) console.error(`en keys missing in hi: ${missingInHi.join(', ')}`);
  if (missingInEn.length) console.error(`hi keys missing in en: ${missingInEn.join(', ')}`);
  process.exit(1);
}
console.log(`locale parity ok (${en.size} keys)`);
