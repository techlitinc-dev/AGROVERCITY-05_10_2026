/**
 * Event-based toaster — no React host needed. toast() appends a div.av-toast
 * (styled in tokens.css) to document.body and removes it after a short delay.
 * Multiple toasts stack vertically.
 */

interface ToastOptions {
  error?: boolean;
  durationMs?: number;
}

let activeToasts = 0;

export function toast(message: string, opts?: ToastOptions): void {
  const el = document.createElement('div');
  el.className = `av-toast${opts?.error ? ' error' : ''}`;
  el.textContent = message;
  el.style.bottom = `${28 + activeToasts * 52}px`;
  document.body.appendChild(el);
  activeToasts += 1;

  window.setTimeout(() => {
    el.remove();
    activeToasts = Math.max(0, activeToasts - 1);
  }, opts?.durationMs ?? 2600);
}
