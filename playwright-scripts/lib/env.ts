/** Central environment knobs. Defaults match `./run.sh` on this VPS. */
export const BASE_URL = (process.env.BASE_URL || 'http://localhost:5173').replace(/\/$/, '');
export const API_URL = (process.env.API_URL || 'http://localhost:8000').replace(/\/$/, '');
export const SUPERADMIN_URL = (process.env.SUPERADMIN_URL || 'http://localhost:5174').replace(/\/$/, '');
export const DEV_MPIN = process.env.DEV_MPIN || '1234';

export const RESULTS_DIR = new URL('../results/', import.meta.url).pathname;
