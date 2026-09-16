export interface DemoRequest {
  params: Record<string, string>;
  query: Record<string, string>;
  body: unknown;
  headers: Record<string, string>;
  files?: FormData;
}

export interface DemoResponse {
  status: number;
  body?: unknown;
}

export type DemoHandler = (req: DemoRequest) => DemoResponse | Promise<DemoResponse>;

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface RouteEntry {
  method: Method;
  segments: string[];
  handler: DemoHandler;
}

const routes: RouteEntry[] = [];

export function register(method: Method, pattern: string, handler: DemoHandler): void {
  routes.push({ method, segments: pattern.split('/').filter(Boolean), handler });
}

export function matchRoute(
  method: string,
  path: string,
): { handler: DemoHandler; params: Record<string, string> } | null {
  const segments = path.split('/').filter(Boolean);
  let fallback: { handler: DemoHandler; params: Record<string, string> } | null = null;
  for (const route of routes) {
    if (route.method !== method || route.segments.length !== segments.length) continue;
    const params: Record<string, string> = {};
    let dynamic = false;
    let ok = true;
    for (let i = 0; i < segments.length; i++) {
      const seg = route.segments[i];
      if (seg.startsWith(':')) {
        params[seg.slice(1)] = decodeURIComponent(segments[i]);
        dynamic = true;
      } else if (seg !== segments[i]) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    if (!dynamic) return { handler: route.handler, params };
    fallback ??= { handler: route.handler, params };
  }
  return fallback;
}
