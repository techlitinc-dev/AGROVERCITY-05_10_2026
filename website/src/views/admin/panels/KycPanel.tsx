import React, { useState } from 'react';
import { ShieldCheck, FileQuestion, X } from 'lucide-react';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { admin, apiErrorMessage } from '../../../lib/api';
import {
  PanelShell,
  DataTable,
  KV,
  Tabs,
  Btn,
  Field,
  TextArea,
  Banner,
  idOf,
  str,
  useAsync,
  useReasonModal,
  type Row,
} from './shared';

/**
 * SOP-03 — KYC & Document Vault Queue.
 * Pending list → case detail (document preview links) → verify / reject-with-reason /
 * request-more-documents (doc moves to resubmission_requested with the reviewer
 * note) → history.
 */
export const KycPanel: React.FC = () => {
  const [tab, setTab] = useState('pending');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [requestMoreFor, setRequestMoreFor] = useState<Row | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const { request, modal } = useReasonModal();

  const pending = useAsync(() => admin.kyc.pending(), []);
  const queue = useAsync(() => admin.kyc.queue(), []);
  const history = useAsync(() => admin.kyc.history(), []);

  const reloadAll = () => {
    pending.reload();
    queue.reload();
    history.reload();
  };

  const rows = tab === 'pending' ? pending : tab === 'queue' ? queue : history;
  const activeRows = (rows.data ?? []) as Row[];
  const selected = selectedId ? (activeRows.find((r) => idOf(r) === selectedId) ?? null) : null;

  return (
    <>
      <PanelShell
        title="SOP-03: KYC Verification & Document Vault Queue"
        subtitle="Review submitted identity documents, verify, reject with a recorded reason, or send back for resubmission with instructions. Every decision is written to the audit log."
        icon={ShieldCheck}
        loading={rows.loading}
        error={rows.error}
        onRefresh={rows.reload}
        actions={<Tabs
          active={tab}
          onChange={(t) => {
            setTab(t);
            setSelectedId(null);
          }}
          tabs={[
            { id: 'pending', label: 'Pending' },
            { id: 'queue', label: 'Full queue' },
            { id: 'history', label: 'History' },
          ]}
        />}
      >
        {flash && <Banner kind="success">{flash}</Banner>}
        <DataTable
          rows={activeRows}
          empty="Queue is empty. Nothing awaiting review."
          columns={[
            {
              header: 'Applicant',
              cell: (r) => (
                <div>
                  <p className="font-bold text-slate-900">{str(r, 'name', 'applicantName', 'userName', 'fullName')}</p>
                  <p className="text-[10px] text-slate-400 font-mono">{str(r, 'userId', 'uid', 'phone', 'applicantId')}</p>
                </div>
              ),
            },
            {
              header: 'Persona / Doc type',
              cell: (r) => (
                <div>
                  <p className="font-semibold text-slate-700">{str(r, 'persona', 'role', 'personaType', 'userRole')}</p>
                  <p className="text-[10px] text-slate-400">{str(r, 'docType', 'documentType', 'kycType', 'type')}</p>
                </div>
              ),
            },
            {
              header: 'Submitted',
              cell: (r) => <span className="text-slate-500">{str(r, 'submittedAt', 'createdAt', 'submitted', 'updatedAt')}</span>,
            },
            {
              header: 'Status',
              cell: (r) => <StatusBadge status={str(r, 'status', 'state')} />,
            },
            {
              header: 'Action',
              className: 'text-right',
              cell: (r) => (
                <Btn onClick={() => setSelectedId(idOf(r))}>Open case</Btn>
              ),
            },
          ]}
        />
      </PanelShell>

      {selected && (
        <PanelShell
          title={`Case: ${str(selected, 'name', 'applicantName', 'userName')} (${str(selected, 'docType', 'documentType', 'kycType')})`}
          subtitle="Document preview links and case actions. Every decision is written to the audit log."
          icon={ShieldCheck}
          actions={
            <div className="flex flex-wrap gap-2">
              <Btn onClick={() => setRequestMoreFor(selected)}>
                <FileQuestion className="w-3.5 h-3.5" /> Request documents
              </Btn>
              <Btn
                tone="danger"
                onClick={() =>
                  request({
                    title: 'Reject KYC case',
                    description: 'Rejection reason is stored on the case and shown to the applicant.',
                    confirmLabel: 'Reject case',
                    tone: 'danger',
                    action: (reason) => admin.kyc.reject(idOf(selected), { reason }, reason),
                    onDone: reloadAll,
                  })
                }
              >
                Reject
              </Btn>
              <Btn
                tone="primary"
                onClick={() =>
                  request({
                    title: 'Verify KYC case',
                    defaultReason: 'Documents verified against originals',
                    confirmLabel: 'Verify & approve',
                    action: (reason) => admin.kyc.verify(idOf(selected), reason),
                    onDone: reloadAll,
                  })
                }
              >
                Verify
              </Btn>
            </div>
          }
        >
          <KV record={selected} />
        </PanelShell>
      )}

      {requestMoreFor && (
        <RequestMoreModal
          row={requestMoreFor}
          onClose={() => setRequestMoreFor(null)}
          onDone={() => {
            setRequestMoreFor(null);
            setFlash(
              `Resubmission requested for ${idOf(requestMoreFor)} — the applicant was notified and the item now shows “resubmission requested”.`
            );
            reloadAll();
          }}
        />
      )}
      {modal}
    </>
  );
};

const RequestMoreModal: React.FC<{ row: Row; onClose: () => void; onDone: () => void }> = ({ row, onClose, onDone }) => {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const noteOk = note.trim().length >= 3;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await admin.kyc.requestMore(idOf(row), { note: note.trim() }, `Resubmission requested: ${note.trim()}`);
      onDone();
      window.setTimeout(onClose, 900);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs" role="dialog" aria-modal>
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-lg p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="font-extrabold text-sm text-slate-900">Request documents — {idOf(row)}</h4>
            <p className="text-xs text-slate-500 mt-1">
              The doc moves to <span className="font-semibold">resubmission_requested</span> and the applicant gets a
              notification with your note. A reupload flips it back to pending.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && <Banner kind="error">{error}</Banner>}

        <Field label="Note for the applicant (min 3 chars — what must be fixed)">
          <TextArea
            value={note}
            onChange={setNote}
            rows={3}
            placeholder="e.g. Aadhaar photo is blurry — please re-upload all four corners visible"
          />
        </Field>

        <div className="flex justify-end gap-2 pt-1">
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn tone="warn" disabled={!noteOk} busy={busy} onClick={submit}>
            <FileQuestion className="w-3.5 h-3.5" /> Send resubmission request
          </Btn>
        </div>
      </div>
    </div>
  );
};
