#!/usr/bin/env node
/**
 * results/ → troubleshoot/*.md
 *
 * Reads every results/<persona>/report.json produced by the Playwright walk
 * and renders one repair doc per persona (plus an index). Each failure row
 * carries the evidence (screenshot, console signature, failing URL) and a
 * likely-cause hint so an AI agent can start fixing without re-running
 * anything.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RESULTS = path.join(ROOT, 'results');
const OUT = path.join(ROOT, 'troubleshoot');

if (!fs.existsSync(RESULTS)) {
  console.error('No results/ directory — run `npx playwright test` first.');
  process.exit(1);
}

/** Map an observed failure signature → likely root cause + first fix to try. */
function hintFor(issue, consoleErrors = [], badNetwork = []) {
  const all = [issue, ...consoleErrors.map((e) => e.text), ...badNetwork.map((n) => `${n.status ?? ''} ${n.url}`)].join(' ');

  if (/bounced to \/login/i.test(all))
    return 'Auth gate rejected the session: token not accepted or persona activation failed. Check the login response in Network tab; verify /v1/users/activate-profile succeeds for this persona; check token TTL in backend/app/core/config.py.';
  if (/ChunkLoadError|Failed to fetch dynamically imported/i.test(all))
    return 'Stale Vite build: the running dev server serves old chunks, or the lazy import path is wrong. Restart the website dev server (./run.sh); if prod, rebuild website/dist.';
  if (/page looks blank/i.test(issue))
    return 'React render crash or empty data path. Reproduce manually, read the uncaught exception above, and check the view component for unguarded undefined (optional chaining) around API data.';
  if (/navigation failed|net::ERR/i.test(all))
    return 'Route missing from the router (check views/<domain>/routes.tsx is mounted in App.tsx) or the dev server dropped. Verify the path renders when navigated to directly.';
  if (/500/.test(all) && badNetwork.length)
    return `Backend exception on ${badNetwork[0].method} ${badNetwork[0].url}. Reproduce with curl against :8000, then read logs/backend.log for the traceback.`;
  if (/403/.test(all))
    return 'Persona gate mismatch: backend activeProfile differs from the page being opened, or the endpoint requires a linked profile. Check users.activate-profile contract and the router dependency gate.';
  if (/404/.test(all) && badNetwork.length)
    return `Endpoint not found: ${badNetwork[0].url} — router not registered in backend/app/main.py or path renamed. Compare with website/src/lib/api/* call sites.`;
  if (/401/.test(all))
    return 'Unauthorized API call: token expired or restricted onboarding token used on a protected endpoint. Check how the client attaches Authorization headers (website/src/lib/api/client.ts).';
  if (/ResizeObserver|Non-passive event listener|Download the React DevTools/i.test(all))
    return 'Benign browser warning (P3 polish) — safe to ignore for release gating.';
  if (/console\.error/.test(issue))
    return 'Application code logged an error (failed fetch, unhandled rejection). Open the screenshot, then reproduce with DevTools console to find the call site.';
  return 'See the console/network evidence for this row; reproduce manually on the route with DevTools open.';
}

function esc(s) {
  return String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function renderPersona(id, report) {
  // Non-route report shapes: superadmin (panel list) and cross-persona (chain observations).
  if (Array.isArray(report.results)) {
    const lines = [];
    lines.push(`# Troubleshoot — Superadmin master console`);
    lines.push('');
    lines.push(`> Target: ${report.baseUrl ?? ''} · Walked: ${report.startedAt ?? 'unknown'}`);
    lines.push('');
    const failed = report.results.filter((r) => r.status === 'fail');
    lines.push(`## Result: ${report.results.length - failed.length} ✅ pass · ${failed.length} ❌ fail (${report.results.length} panels)`);
    lines.push('');
    for (const r of report.results) {
      const icon = r.status === 'pass' ? '✅' : '❌';
      lines.push(`### ${icon} ${r.panel}`);
      for (const issue of r.issues ?? []) {
        lines.push(`- ${issue}`);
        lines.push(`- **Likely cause / first fix to try:** ${hintFor(issue)}`);
      }
      lines.push('');
    }
    lines.push('## How to re-verify after a fix');
    lines.push('');
    lines.push('```bash');
    lines.push('cd playwright-scripts && npx playwright test specs/superadmin.spec.ts');
    lines.push('```');
    lines.push('');
    return lines.join('\n');
  }
  if (Array.isArray(report.observations)) {
    const lines = [];
    lines.push(`# Troubleshoot — Cross-persona workflow chain`);
    lines.push('');
    lines.push(`> One story across five actors: farmer posts a lot → buyer posts a requirement → vyapari & transporter see trade boards → customer browses the mall.`);
    lines.push(`> Walked: ${report.startedAt ?? 'unknown'}`);
    lines.push('');
    for (const o of report.observations) {
      lines.push(`- ${o.ok ? '✅' : '❌'} **[${o.actor}]** ${o.step} — ${o.detail}`);
    }
    lines.push('');
    lines.push('Notes: `blocked-by-kyc` means the UI correctly refused the action because the account lacks verified KYC — seeded demo users (dev-user-*) carry no `kycStatus` field, so backend KYC gates treat them as unverified. To exercise the full create flows, seed kycStatus="verified" on the demo users or complete KYC through the UI.');
    lines.push('');
    lines.push('## How to re-verify after a fix');
    lines.push('');
    lines.push('```bash');
    lines.push('cd playwright-scripts && npx playwright test specs/cross-persona.spec.ts');
    lines.push('```');
    lines.push('');
    return lines.join('\n');
  }
  const rows = report.routes ?? [];
  const s = report.summary ?? { pass: 0, warn: 0, fail: 0 };
  const lines = [];
  lines.push(`# Troubleshoot — ${report.label ?? id}`);
  lines.push('');
  lines.push(`> Persona: **${report.label ?? id}** (${id})`);
  if (report.roleplay) lines.push(`> Roleplay: ${report.roleplay}`);
  lines.push(`> Target: ${report.baseUrl ?? ''} · Walked: ${report.startedAt ?? 'unknown'}`);
  lines.push('');
  lines.push(`## Login recipe used by the test`);
  lines.push('');
  lines.push(`- Mode: \`${report.login?.mode}\` — ${report.login?.detail ?? ''}`);
  lines.push('- Mint session via `POST /v1/auth/quick-login` (or `/v1/auth/onboard` for onboard personas) with dev MPIN `1234`, then the UI walk is 100% browser.');
  lines.push('');
  lines.push(`## Result: ${s.pass} ✅ pass · ${s.warn} ⚠️ warn · ${s.fail} ❌ fail (${rows.length} pages)`);
  lines.push('');
  lines.push('| Route | Status | Issues | Console errors | Bad network | Screenshot |');
  lines.push('|---|---|---|---|---|---|');
  for (const r of rows) {
    const icon = r.status === 'pass' ? '✅' : r.status === 'warn' ? '⚠️' : '❌';
    const issues = (r.issues ?? []).filter((i) => !i.startsWith('note:')).map(esc).join('; ') || '—';
    const consoleErrs = (r.consoleErrors ?? []).filter((e) => e.type === 'error').length;
    const badNet = (r.badNetwork ?? [])
      .map((n) => `${n.status ?? n.failure} ${n.url.replace(/^https?:\/\/[^/]+/, '')}`)
      .map(esc)
      .join('<br>') || '—';
    lines.push(
      `| \`${r.route}\` | ${icon} | ${issues} | ${consoleErrs} | ${badNet} | \`${r.screenshot ?? ''}\` |`,
    );
  }
  lines.push('');

  const failing = rows.filter((r) => r.status === 'fail');
  if (failing.length) {
    lines.push('## Failures — evidence & likely cause');
    lines.push('');
    for (const r of failing) {
      const realIssues = (r.issues ?? []).filter((i) => !i.startsWith('note:'));
      for (const issue of realIssues) {
        lines.push(`### ❌ \`${r.route}\` — ${esc(issue)}`);
        lines.push('');
        lines.push(`- Final URL: ${r.finalPath} · content: ${r.contentChars} chars · load: ${r.loadMs}ms`);
        if (r.screenshot) lines.push(`- Screenshot: \`results/${r.screenshot}\``);
        for (const e of (r.consoleErrors ?? []).filter((e) => e.type === 'error').slice(0, 5)) {
          lines.push(`- console.error: \`${esc(e.text.slice(0, 200))}\`${e.location ? ` at ${esc(e.location)}` : ''}`);
        }
        for (const n of (r.badNetwork ?? []).slice(0, 5)) {
          lines.push(`- network: ${n.method} ${esc(n.url)} → ${n.status ?? n.failure}`);
        }
        lines.push(`- **Likely cause / first fix to try:** ${hintFor(issue, r.consoleErrors ?? [], r.badNetwork ?? [])}`);
        lines.push('');
      }
    }
  }

  const warnRows = rows.filter((r) => r.status === 'warn');
  if (warnRows.length) {
    lines.push('## Warnings (non-blocking, fix after failures)');
    lines.push('');
    for (const r of warnRows) {
      const issue = (r.issues ?? [])[0] ?? '';
      lines.push(`- ⚠️ \`${r.route}\` — ${esc(issue)} → ${hintFor(issue, r.consoleErrors ?? [], r.badNetwork ?? [])}`);
    }
    lines.push('');
  }

  lines.push('## How to re-verify after a fix');
  lines.push('');
  lines.push('```bash');
  lines.push(`cd playwright-scripts && npx playwright test -g "${id === 'shared' ? 'shared' : id}"`);
  lines.push('npm run report   # regenerate this doc');
  lines.push('```');
  lines.push('');
  return lines.join('\n');
}

// --- main -------------------------------------------------------------------
fs.mkdirSync(OUT, { recursive: true });

const entries = fs
  .readdirSync(RESULTS, { withFileTypes: true })
  .filter((d) => d.isDirectory() && fs.existsSync(path.join(RESULTS, d.name, 'report.json')))
  .map((d) => {
    const report = JSON.parse(fs.readFileSync(path.join(RESULTS, d.name, 'report.json'), 'utf8'));
    return { id: d.name, report };
  });

const index = ['# Persona Troubleshoot Index', '', 'Generated by `npm run report` from the latest Playwright walk results.', '', '| Persona | Pass | Warn | Fail | Doc |', '|---|---:|---:|---:|---|'];

for (const { id, report } of entries) {
  let s = report.summary;
  if (!s && Array.isArray(report.results)) {
    const f = report.results.filter((r) => r.status === 'fail').length;
    s = { pass: report.results.length - f, warn: 0, fail: f };
  }
  if (!s && Array.isArray(report.observations)) {
    const f = report.observations.filter((o) => !o.ok).length;
    s = { pass: report.observations.length - f, warn: 0, fail: f };
  }
  s = s ?? { pass: 0, warn: 0, fail: 0 };
  fs.writeFileSync(path.join(OUT, `${id}.md`), renderPersona(id, report));
  index.push(`| ${report.label ?? id} | ${s.pass} | ${s.warn} | ${s.fail} | [${id}.md](${id}.md) |`);
}

fs.writeFileSync(path.join(OUT, 'README.md'), index.join('\n') + '\n');
console.log(`Wrote ${entries.length} persona docs to ${OUT}`);
