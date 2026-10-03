import type { ReactNode } from 'react';

interface ConfidenceGateProps {
  /** Model confidence for the ranked decision (0–1). */
  confidence: number;
  /** Question-set threshold — below it the UI stays neutral (no nudge). */
  threshold?: number;
  children: (preselected: boolean) => ReactNode;
}

/**
 * ConfidenceGate (phase-01 WS-03): high confidence → the primary action is
 * preselected/highlighted; below threshold → neutral display, no nudge.
 * Automation level stays `suggest` — the user always taps.
 */
export default function ConfidenceGate({
  confidence,
  threshold = 0.75,
  children,
}: ConfidenceGateProps) {
  return <>{children(confidence >= threshold)}</>;
}
