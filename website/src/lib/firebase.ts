/**
 * Firebase web SDK (auth only) — OTP lives entirely client-side; the backend
 * consumes the Firebase ID token via POST /v1/auth/firebase-verify.
 * Config mirrors apps/mobile/lib/firebase_options.dart (web).
 */
import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider, getToken } from 'firebase/app-check';
import {
  Auth,
  ConfirmationResult,
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
} from 'firebase/auth';
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';

const firebaseConfig = {
  apiKey: (import.meta.env.VITE_FIREBASE_API_KEY as string) || 'AIzaSyDj2XFY_cFr623pLTpqroxvc2noeQJNo_k',
  appId: (import.meta.env.VITE_FIREBASE_APP_ID as string) || '1:71490924274:web:450a310fbc7d75b3a46a6b',
  messagingSenderId: (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string) || '71490924274',
  projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID as string) || 'agrovercity-bafec',
  authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string) || 'agrovercity-bafec.firebaseapp.com',
  storageBucket: (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string) || 'agrovercity-bafec.firebasestorage.app',
};

export const firebaseApp = initializeApp(firebaseConfig);

export const firebaseAuth: Auth = getAuth(firebaseApp);

const appCheckSiteKey = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY as string | undefined;

export const firebaseAppCheck = appCheckSiteKey
  ? initializeAppCheck(firebaseApp, {
      provider: new ReCaptchaV3Provider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    })
  : null;

export async function getAppCheckToken(): Promise<string | null> {
  if (!firebaseAppCheck) return null;
  try {
    return (await getToken(firebaseAppCheck, false)).token;
  } catch {
    return null;
  }
}

let verifier: RecaptchaVerifier | null = null;

function containerEl(containerId: string): HTMLElement {
  const el = document.getElementById(containerId);
  if (!el) throw new Error(`reCAPTCHA container #${containerId} not found`);
  return el;
}

/**
 * Discard the current reCAPTCHA widget. Firebase requires a FRESH invisible
 * reCAPTCHA instance for every signInWithPhoneNumber attempt — reusing one
 * after a failed/sent attempt throws reCAPTCHA errors on retry.
 */
function resetVerifier(containerId: string): void {
  if (verifier) {
    try {
      verifier.clear();
    } catch {
      // widget already cleared
    }
    verifier = null;
  }
  containerEl(containerId).innerHTML = '';
}

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  return phone.startsWith('+') ? phone : `+${digits}`;
}

export async function sendPhoneOtp(phoneE164: string, recaptchaContainerId: string): Promise<ConfirmationResult> {
  resetVerifier(recaptchaContainerId);
  verifier = new RecaptchaVerifier(firebaseAuth, containerEl(recaptchaContainerId), { size: 'invisible' });
  try {
    return await signInWithPhoneNumber(firebaseAuth, phoneE164, verifier);
  } catch (e) {
    resetVerifier(recaptchaContainerId);
    throw e;
  }
}

export async function confirmPhoneOtp(confirmation: ConfirmationResult, code: string): Promise<string> {
  const credential = await confirmation.confirm(code);
  return credential.user.getIdToken();
}

// ---------- Storage (produce photos, spec F4) ----------

const storage = getStorage(firebaseApp);

/**
 * Upload an image to Firebase Storage and return its download URL.
 * Path: trade/<uid>/<uuid>.jpg — Storage rules must allow authenticated writes.
 */
export async function uploadTradeImage(uid: string, file: File | Blob): Promise<string> {
  const path = `trade/${uid}/${crypto.randomUUID()}.jpg`;
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, file, { contentType: 'image/jpeg' });
  return getDownloadURL(fileRef);
}

/** Downscale + re-encode to JPEG for upload (target ≤ ~500 KB, spec §12 risk 5). */
export async function compressImage(file: File, maxEdge = 1024): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob ?? file), 'image/jpeg', 0.82);
  });
}
