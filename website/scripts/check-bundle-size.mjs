#!/usr/bin/env node
/**
 * Bundle-size gate (powerpacked.md §4.5) — protects the first-load budget by
 * gating the gzip size of exactly the assets index.html references (entry JS
 * + entry CSS + modulepreload links). Lazy route chunks under dist/chunks are
 * intentionally excluded.
 *
 * Budgets are env-overridable: BUNDLE_JS_BUDGET / BUNDLE_CSS_BUDGET (bytes).
 */
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const distDir = new URL('../dist', import.meta.url).pathname;
const JS_BUDGET = Number(process.env.BUNDLE_JS_BUDGET ?? 300 * 1024);
const CSS_BUDGET = Number(process.env.BUNDLE_CSS_BUDGET ?? 50 * 1024);

const html = readFileSync(join(distDir, 'index.html'), 'utf8');
const referenced = new Set(
  [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+?\.(?:js|css))"/g)].map((m) => m[1]),
);

if (!referenced.size) {
  console.error('check-bundle-size: no assets referenced by dist/index.html — did the build run?');
  process.exit(1);
}

let js = 0;
let css = 0;
for (const rel of referenced) {
  const path = join(distDir, rel);
  const gz = gzipSync(readFileSync(path), { level: 9 }).length;
  if (rel.endsWith('.js')) js += gz;
  else css += gz;
  console.log(`${rel}  gzip=${(gz / 1024).toFixed(1)} KiB  raw=${(statSync(path).size / 1024).toFixed(1)} KiB`);
}

const fail = [];
if (js > JS_BUDGET) fail.push(`entry JS ${(js / 1024).toFixed(1)} KiB > budget ${(JS_BUDGET / 1024).toFixed(1)} KiB`);
if (css > CSS_BUDGET) fail.push(`entry CSS ${(css / 1024).toFixed(1)} KiB > budget ${(CSS_BUDGET / 1024).toFixed(1)} KiB`);

console.log(`entry JS ${(js / 1024).toFixed(1)} KiB (budget ${(JS_BUDGET / 1024).toFixed(1)}), entry CSS ${(css / 1024).toFixed(1)} KiB (budget ${(CSS_BUDGET / 1024).toFixed(1)})`);
if (fail.length) {
  console.error(`BUNDLE SIZE GATE FAILED: ${fail.join('; ')}`);
  process.exit(1);
}
