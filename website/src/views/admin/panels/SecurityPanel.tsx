import React, { useState } from 'react';
import { Lock, KeyRound } from 'lucide-react';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { admin, apiErrorMessage } from '../../../lib/api';
import {
  PanelShell,
  DataTable,
  KV,
  Btn,
  Field,
  TextInput,
  TextArea,
  Banner,
  idOf,
  str,
  useAsync,
  useReasonModal,
  asRow,
  type Row,
} from './shared';

/**
 * SOP-01 — Auth & Admin Sessions.
 * Firebase auth user roster, MPIN resets, session revocation, security policy
 * editor, and a step-up MPIN verification probe (POST /admin/verify-mpin).
 */
export const SecurityPanel: React.FC = () => {
  const { request, modal } = useReasonModal();
  const authUsers = useAsync(() => admin.users.authUsers(), []);
  const policy = useAsync(() => admin.users.securityPolicy().catch(() => null), []);

  const [policyDraft, setPolicyDraft] = useState<string | null>(null);
  const [policyBusy, setPolicyBusy] = useState(false);
  const [policyMsg, setPolicyMsg] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  const [probeMpin, setProbeMpin] = useState('');
  const [probeBusy, setProbeBusy] = useState(false);
  const [probeResult, setProbeResult] = useState<{ ok: boolean; text: string } | null>(null);

  const savePolicy = async () => {
    if (!policyDraft) return;
    try {
      JSON.parse(policyDraft);
    } catch {
      setPolicyMsg({ kind: 'error', text: 'Invalid JSON — fix the draft before saving.' });
      return;
    }
    setPolicyBusy(true);
    setPolicyMsg(null);
    try {
      await admin.users.updateSecurityPolicy(JSON.parse(policyDraft), 'Security policy update from SOP-01 desk');
      setPolicyMsg({ kind: 'success', text: 'Security policy updated.' });
      policy.reload();
    } catch (e) {
      setPolicyMsg({ kind: 'error', text: apiErrorMessage(e) });
    } finally {
      setPolicyBusy(false);
    }
  };

  const probe = async () => {
    setProbeBusy(true);
    setProbeResult(null);
    try {
      await admin.users.verifyMpin(probeMpin);
      setProbeResult({ ok: true, text: 'MPIN accepted — step-up verified.' });
    } catch (e) {
      setProbeResult({ ok: false, text: apiErrorMessage(e) });
    } finally {
      setProbeBusy(false);
    }
  };

  const policyRow = asRow(policy.data);

  return (
    <>
      <PanelShell
        title="SOP-01: Auth & Admin Sessions"
        subtitle="Auth user roster with MPIN reset and session revocation, plus the platform security policy."
        icon={Lock}
        loading={authUsers.loading}
        error={authUsers.error}
        onRefresh={() => {
          authUsers.reload();
          policy.reload();
        }}
      >
        <DataTable
          rows={(authUsers.data ?? []) as Row[]}
          empty="No auth users returned."
          columns={[
            {
              header: 'User',
              cell: (r) => (
                <div>
                  <p className="font-bold text-slate-900">{str(r, 'name', 'displayName', 'phone')}</p>
                  <p className="text-[10px] text-slate-400 font-mono">{str(r, 'uid', 'id', 'phone')}</p>
                </div>
              ),
            },
            {
              header: 'Phone',
              cell: (r) => <span className="font-mono text-slate-600">{str(r, 'phone', 'mobile')}</span>,
            },
            {
              header: 'Providers',
              cell: (r) => <span className="text-slate-600">{str(r, 'providers', 'signInProviders', 'provider')}</span>,
            },
            {
              header: 'Last sign-in',
              cell: (r) => <span className="text-slate-500">{str(r, 'lastSignIn', 'lastSignInTime', 'createdAt')}</span>,
            },
            {
              header: 'Disabled',
              cell: (r) => <StatusBadge status={String(firstValOr(r, ['disabled'], false))} />,
            },
            {
              header: 'Actions',
              className: 'text-right',
              cell: (r) => {
                const uid = str(r, 'uid', 'id');
                return (
                  <div className="flex justify-end gap-1.5">
                    <Btn
                      onClick={() =>
                        request({
                          title: `Reset MPIN — ${str(r, 'name', 'phone')}`,
                          defaultReason: 'SOP-01 security desk reset',
                          action: (reason) => admin.users.resetMpin(uid, reason),
                          onDone: () => authUsers.reload(),
                        })
                      }
                    >
                      <KeyRound className="w-3.5 h-3.5" /> Reset MPIN
                    </Btn>
                    <Btn
                      tone="danger"
                      onClick={() =>
                        request({
                          title: `Revoke sessions — ${str(r, 'name', 'phone')}`,
                          confirmLabel: 'Revoke all',
                          requireMpin: true,
                          action: (reason) => admin.users.revokeSessions(uid, reason),
                          onDone: () => authUsers.reload(),
                        })
                      }
                    >
                      Revoke
                    </Btn>
                  </div>
                );
              },
            },
          ]}
        />
      </PanelShell>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <PanelShell
          title="Security policy"
          subtitle="Current platform auth policy (retrieved live). Edit as JSON, save with audit reason."
          icon={Lock}
          loading={policy.loading}
          actions={
            policyDraft !== null ? (
              <div className="flex gap-2">
                <Btn onClick={() => setPolicyDraft(null)}>Cancel</Btn>
                <Btn tone="primary" busy={policyBusy} onClick={savePolicy}>Save policy</Btn>
              </div>
            ) : (
              <Btn onClick={() => setPolicyDraft(JSON.stringify(policy.data ?? {}, null, 2))}>Edit as JSON</Btn>
            )
          }
        >
          {policyMsg && <Banner kind={policyMsg.kind}>{policyMsg.text}</Banner>}
          {policyDraft !== null ? (
            <TextArea value={policyDraft} onChange={setPolicyDraft} rows={12} className="font-mono text-[11px]" />
          ) : (
            <KV record={policyRow} compact />
          )}
        </PanelShell>

        <PanelShell
          title="Step-up verification probe"
          subtitle="Verify your admin MPIN against POST /admin/verify-mpin before destructive operations."
          icon={KeyRound}
        >
          <div className="flex items-end gap-2">
            <Field label="Admin MPIN" className="w-40">
              <TextInput
                type="password"
                inputMode="numeric"
                value={probeMpin}
                onChange={(v) => setProbeMpin(v.replace(/\D/g, '').slice(0, 4))}
                placeholder="••••"
                className="tracking-[0.5em] text-center"
              />
            </Field>
            <Btn tone="primary" busy={probeBusy} disabled={probeMpin.length !== 4} onClick={probe}>
              Verify
            </Btn>
          </div>
          {probeResult && <Banner kind={probeResult.ok ? 'success' : 'error'}>{probeResult.text}</Banner>}
        </PanelShell>
      </div>
      {modal}
    </>
  );
};

const firstValOr = (r: Row, keys: string[], fallback: unknown): unknown => {
  for (const k of keys) {
    if (r[k] !== undefined && r[k] !== null) return r[k];
  }
  return fallback;
};
