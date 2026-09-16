import { register } from '../registry';
import type { AppConfig } from '@/api/types';

const CONFIG: AppConfig = {
  minSupportedVersion: '1.1.0',
  latestVersion: '1.3.0',
  forceUpdate: false,
  playStoreUrl: 'https://play.google.com/store/apps/details?id=in.agrovercity.app',
  featureFlags: { inAppChat: true, sellProduce: true, speechEnabled: false },
  rateSanityBandPct: 15,
  coinCaps: { earnPerDay: 200, redeemMaxPctOfOrder: 50 },
  maintenance: { active: false, message: '' },
};

function parseSemver(v: string): [number, number, number] {
  const [a, b, c] = v.split('.').map((x) => Number(x) || 0);
  return [a ?? 0, b ?? 0, c ?? 0];
}

function cmpSemver(a: string, b: string): number {
  const ta = parseSemver(a);
  const tb = parseSemver(b);
  for (let i = 0; i < 3; i++) {
    if (ta[i] !== tb[i]) return ta[i] - tb[i];
  }
  return 0;
}

register('GET', '/app-config', ({ query }) => {
  const version = query.version ?? CONFIG.latestVersion;
  const forceUpdate = cmpSemver(version, CONFIG.minSupportedVersion) < 0;
  return { status: 200, body: { ...CONFIG, forceUpdate: forceUpdate || CONFIG.forceUpdate } };
});
