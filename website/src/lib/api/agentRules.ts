import { api } from './client';

/**
 * M29 (phase-08 WS-01) — farmer standing-agent rules. Rule text is parsed for
 * review, then created only after explicit user confirmation. A fire NEVER
 * auto-executes: it surfaces a one-tap confirm task that calls the existing
 * offer-accept endpoint. No privileged write path exists.
 */

export type RuleOperator = '>=' | '>' | '<=' | '<' | '==' | '!=';

export interface RuleCondition {
  field: string;
  op: RuleOperator;
  value: string | number;
}

export interface RuleSummary {
  en: string;
  hi: string;
}

export interface ParsedRule {
  module: string;
  condition: RuleCondition;
  action: string;
  max_value_paisa: number;
  summary: RuleSummary;
}

export interface AgentRule {
  ruleId: string;
  userId: string;
  module: string;
  condition: RuleCondition;
  action: string;
  max_value_paisa: number;
  active: boolean;
  summary?: RuleSummary;
  text?: string | null;
  createdAt: string;
  lastFiredAt: string | null;
}

export async function parseRule(text: string, module = 'offers'): Promise<ParsedRule> {
  const { data } = await api.post<ParsedRule>('/agent/rules/parse', { text, module });
  return data;
}

export async function createRule(input: {
  condition: RuleCondition;
  action: string;
  max_value_paisa?: number;
  module?: string;
  summary?: RuleSummary;
  text?: string;
}): Promise<AgentRule> {
  const { data } = await api.post<AgentRule>('/agent/rules', input);
  return data;
}

export async function listRules(): Promise<{ items: AgentRule[]; nextCursor: string | null }> {
  const { data } = await api.get<{ items: AgentRule[]; nextCursor: string | null }>('/agent/rules');
  return data;
}

export async function pauseRule(ruleId: string): Promise<AgentRule> {
  const { data } = await api.post<AgentRule>(`/agent/rules/${ruleId}/pause`, {});
  return data;
}

export async function deleteRule(ruleId: string): Promise<void> {
  await api.delete(`/agent/rules/${ruleId}`);
}
