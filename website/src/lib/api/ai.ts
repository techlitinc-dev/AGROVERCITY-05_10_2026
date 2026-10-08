/**
 * Shared AI surface types (phase-08 WS-01 / ai.md §7).
 *
 * Every AI annotation carries the same provenance envelope so surfaces can
 * badge "AI sujhav", show confidence, and explain the contributing factors.
 * Automation is always `suggest` unless the phase-G gate raised it; nothing on
 * the client ever executes an AI action without a user tap.
 */

export type AiSource = 'jev' | 'gemini' | 'fallback' | 'shim';
export type AutomationLevel = 'suggest' | 'require_confirm' | 'auto';

export interface AiAnnotation {
  decisionId: string;
  confidence: number;
  source: AiSource;
  automationLevel: AutomationLevel;
}

/** Confidence → badge band (mirrors the backend `<AiBadge>` bands). */
export function aiConfidenceBand(confidence: number): 'high' | 'mid' | 'low' {
  if (confidence >= 0.75) return 'high';
  if (confidence >= 0.5) return 'mid';
  return 'low';
}

/** A deterministic fallback answer is never presented as a confident AI claim. */
export function isAiFallback(source: AiSource): boolean {
  return source === 'fallback';
}
