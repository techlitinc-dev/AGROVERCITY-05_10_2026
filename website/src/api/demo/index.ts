import { ApiError } from '@/api/errors';
import { getTokens } from '@/api/http';
import { matchRoute } from './registry';
import { DemoHttpError, idemGet, idemSet, latency } from './util';
import { saveDb } from './db';

import './domains/appConfig';
import './domains/auth';
import './domains/users';
import './domains/reference';
import './domains/platform';
import './domains/mandi';
import './domains/commerce';
import './domains/contracts';
import './domains/transport';
import './domains/equipment';
import './domains/fpo';
import './domains/market';
import './domains/seller';
import './domains/broker';
import './domains/land';
import './domains/farm';
import './domains/advisory';
import './domains/chatbot';
import './domains/weather';
import './domains/tasks';
import './domains/pnl';
import './domains/diary';
import './domains/water';
import './domains/schemes';
import './domains/vault';
import './domains/finance';
import './domains/insurance';
import './domains/landRecords';
import './domains/livestock';
import './domains/content';
import './domains/tree';
import './domains/gamification';
import './domains/referrals';
import './domains/climate';
import './domains/postHarvest';
import './domains/women';
import './domains/soilTests';
import './domains/dashboard';

export interface DemoFetchOpts {
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
}

export async function demoFetch<T>(method: string, path: string, opts: DemoFetchOpts = {}): Promise<T> {
  const upper = method.toUpperCase();
  const isWrite = upper !== 'GET';
  const headers: Record<string, string> = { ...opts.headers };
  const tokens = getTokens();
  if (tokens) headers['authorization'] = `Bearer ${tokens.accessToken}`;

  const query: Record<string, string> = {};
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined) query[k] = String(v);
    }
  }

  let idemKey = headers['idempotency-key'];
  if (isWrite && !idemKey) idemKey = crypto.randomUUID();

  await latency();

  try {
    if (isWrite && idemKey) {
      const replay = idemGet(idemKey);
      if (replay) return replay.body as T;
    }

    const match = matchRoute(upper, path);
    if (!match) {
      throw new DemoHttpError(404, 'NOT_FOUND', `डेमो API में ${upper} ${path} अभी उपलब्ध नहीं है.`);
    }
    const res = await match.handler({
      params: match.params,
      query,
      body: opts.body,
      headers,
      files: opts.body instanceof FormData ? opts.body : undefined,
    });

    if (isWrite) {
      if (idemKey) idemSet(idemKey, res.status, res.body);
      saveDb();
    }
    if (res.status === 204) return undefined as T;
    return res.body as T;
  } catch (e) {
    if (e instanceof DemoHttpError) {
      throw new ApiError(e.status, e.code, e.message, e.fieldErrors);
    }
    throw e;
  }
}
