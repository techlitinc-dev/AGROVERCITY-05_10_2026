// Demo/live switch: change apiMode to 'live' (and liveBaseUrl) to use the real
// FastAPI backend instead of the built-in demo API. No other code changes needed.
export const settings = {
  apiMode: 'demo' as 'demo' | 'live',
  liveBaseUrl: 'http://localhost:8000/v1',
  demoLatencyMs: 250,
};
