import React, { useState } from 'react';
import { Database, Pencil, Trash2, Upload, X, Plus } from 'lucide-react';
import { admin, apiErrorMessage } from '../../../lib/api';
import {
  PanelShell,
  DataTable,
  Btn,
  Field,
  TextInput,
  TextArea,
  Select,
  Banner,
  str,
  num,
  useAsync,
  useReasonModal,
  asRow,
  fmtVal,
  type Row,
} from './shared';

/**
 * Master Data Manager — admin CRUD over the platform reference collections
 * (mandis, crops, varieties, grades, categories, states, units, vehicle-types).
 *
 * GET/POST /admin/master/{collection}, PUT/DELETE /admin/master/{collection}/{code},
 * POST /admin/master/{collection}/import (bulk upsert, max 500 rows).
 * Static seed rows can be overridden per code; deletes are soft (active=false).
 */

const COLLECTIONS = [
  { value: 'mandis', label: 'Mandis' },
  { value: 'crops', label: 'Crops' },
  { value: 'varieties', label: 'Varieties' },
  { value: 'grades', label: 'Grades' },
  { value: 'categories', label: 'Categories' },
  { value: 'states', label: 'States' },
  { value: 'units', label: 'Units' },
  { value: 'vehicle-types', label: 'Vehicle types' },
];

const BUILT_IN_KEYS = new Set(['code', 'name', 'active', 'source', 'collection', 'updatedBy', 'updatedAt']);

export const MasterDataPanel: React.FC = () => {
  const [collection, setCollection] = useState('crops');
  const [includeInactive, setIncludeInactive] = useState(false);
  const { request, modal } = useReasonModal();

  const entries = useAsync(
    () => admin.masterData.list(collection, { includeInactive }),
    [collection, includeInactive]
  );

  const rows = (entries.data ?? []) as Row[];

  const remove = (r: Row) =>
    request({
      title: `Soft-delete ${str(r, 'code')} from ${collection}`,
      description: `“${str(r, 'name')}” drops out of the merged list; static seed rows are only masked, never deleted.`,
      confirmLabel: 'Delete entry',
      tone: 'danger',
      action: (reason) => admin.masterData.remove(collection, str(r, 'code'), reason),
      onDone: entries.reload,
    });

  return (
    <>
      <PanelShell
        title="Master Data Manager"
        subtitle="Reference data feeding every dropdown in the apps. Firestore overrides win over static seeds per code; every change is audit-logged."
        icon={Database}
        loading={entries.loading}
        error={entries.error}
        onRefresh={entries.reload}
        actions={
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Collection" className="w-44">
              <Select value={collection} onChange={setCollection} options={COLLECTIONS} />
            </Field>
            <Field label="Rows" className="w-36">
              <Select
                value={includeInactive ? 'all' : 'active'}
                onChange={(v) => setIncludeInactive(v === 'all')}
                options={[
                  { value: 'active', label: 'Active only' },
                  { value: 'all', label: 'Include deleted' },
                ]}
              />
            </Field>
          </div>
        }
      >
        <EntryEditor collection={collection} onDone={entries.reload} />
        <DataTable
          rows={rows}
          empty={`No entries in ${collection}. Create one or use bulk import.`}
          columns={[
            { header: 'Code', cell: (r) => <span className="font-mono font-bold text-slate-800">{str(r, 'code')}</span> },
            { header: 'Name', cell: (r) => <span className="font-semibold text-slate-700">{str(r, 'name')}</span> },
            { header: 'Source', cell: (r) => <SourceBadge source={str(r, 'source')} /> },
            {
              header: 'Active',
              cell: (r) => (
                <span
                  className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    r.active === false
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}
                >
                  {r.active === false ? 'deleted' : 'active'}
                </span>
              ),
            },
            {
              header: 'Extra fields',
              cell: (r) => {
                const extras = Object.entries(r).filter(([k, v]) => !BUILT_IN_KEYS.has(k) && v !== undefined && v !== null && v !== '');
                if (!extras.length) return <span className="text-slate-300">—</span>;
                return (
                  <span className="text-[11px] text-slate-500 break-all">
                    {extras.map(([k, v]) => `${k}: ${fmtVal(v)}`).join(' • ')}
                  </span>
                );
              },
            },
            { header: 'Updated', cell: (r) => <span className="text-[10px] text-slate-400">{str(r, 'updatedAt')}</span> },
            {
              header: 'Actions',
              className: 'text-right',
              cell: (r) => (
                <div className="flex justify-end gap-1.5">
                  <EntryEditorButton collection={collection} row={r} onDone={entries.reload} />
                  <Btn tone="danger" onClick={() => remove(r)}>
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </Btn>
                </div>
              ),
            },
          ]}
        />
      </PanelShell>

      <ImportCard collection={collection} onDone={entries.reload} />
      {modal}
    </>
  );
};

const SourceBadge: React.FC<{ source: string }> = ({ source }) =>
  source === 'static' ? (
    <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">seed</span>
  ) : source === 'firestore' ? (
    <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-50 text-violet-700 border border-violet-200">override</span>
  ) : (
    <span className="text-slate-300">—</span>
  );

/** Create / edit modal for a single master entry. Rendered inline (button-style). */
const EntryEditorButton: React.FC<{ collection: string; row: Row; onDone: () => void }> = ({ collection, row, onDone }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Btn onClick={() => setOpen(true)}>
        <Pencil className="w-3.5 h-3.5" /> Edit
      </Btn>
      {open && (
        <EntryModal
          collection={collection}
          initial={row}
          onClose={() => setOpen(false)}
          onDone={() => {
            setOpen(false);
            onDone();
          }}
        />
      )}
    </>
  );
};

const EntryEditor: React.FC<{ collection: string; onDone: () => void }> = ({ collection, onDone }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Btn tone="primary" onClick={() => setOpen(true)}>
        <Plus className="w-3.5 h-3.5" /> New {collection} entry
      </Btn>
      {open && (
        <EntryModal
          collection={collection}
          initial={null}
          onClose={() => setOpen(false)}
          onDone={() => {
            setOpen(false);
            onDone();
          }}
        />
      )}
    </>
  );
};

const EntryModal: React.FC<{
  collection: string;
  initial: Row | null;
  onClose: () => void;
  onDone: () => void;
}> = ({ collection, initial, onClose, onDone }) => {
  const isEdit = initial !== null;
  const [code, setCode] = useState(isEdit ? str(initial, 'code') : '');
  const [name, setName] = useState(isEdit ? str(initial, 'name') : '');
  const [active, setActive] = useState(isEdit ? initial!.active !== false : true);
  const [extraJson, setExtraJson] = useState(() => {
    if (!isEdit) return '';
    const extras = Object.fromEntries(
      Object.entries(initial!).filter(([k, v]) => !BUILT_IN_KEYS.has(k) && v !== undefined && v !== null)
    );
    return Object.keys(extras).length ? JSON.stringify(extras, null, 2) : '';
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  const save = async () => {
    let extra: Record<string, unknown> | undefined;
    if (extraJson.trim()) {
      try {
        const parsed: unknown = JSON.parse(extraJson);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('extra must be a JSON object');
        extra = parsed as Record<string, unknown>;
      } catch (e) {
        setMsg({ kind: 'error', text: e instanceof Error ? e.message : 'Extra fields must be a JSON object.' });
        return;
      }
    }
    setBusy(true);
    setMsg(null);
    try {
      if (isEdit) {
        await admin.masterData.update(
          collection,
          code,
          { name: name.trim(), active, ...(extra ? { extra } : {}) },
          `${collection}: update ${code}`
        );
      } else {
        await admin.masterData.create(
          collection,
          { code: code.trim(), name: name.trim(), active, ...(extra ? { extra } : {}) },
          `${collection}: create ${code.trim()}`
        );
      }
      setMsg({ kind: 'success', text: 'Saved.' });
      onDone();
      window.setTimeout(onClose, 700);
    } catch (e) {
      setMsg({ kind: 'error', text: apiErrorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs" role="dialog" aria-modal>
      <div className="w-full max-w-lg bg-white rounded-3xl border border-slate-200 shadow-lg p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="font-extrabold text-sm text-slate-900">
              {isEdit ? `Edit ${collection} entry` : `New ${collection} entry`}
            </h4>
            <p className="text-xs text-slate-500 mt-1">
              {isEdit
                ? `PUT /admin/master/${collection}/{code} — code is the immutable key.`
                : `POST /admin/master/${collection} — code + name are required.`}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        {msg && <Banner kind={msg.kind}>{msg.text}</Banner>}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Code" className={isEdit ? 'opacity-60' : undefined}>
            <TextInput value={code} onChange={setCode} placeholder="e.g. basmati" disabled={isEdit} required />
          </Field>
          <Field label="Name">
            <TextInput value={name} onChange={setName} placeholder="e.g. Basmati Rice" required />
          </Field>
        </div>
        <Field label="Active">
          <Select
            value={String(active)}
            onChange={(v) => setActive(v === 'true')}
            options={[
              { value: 'true', label: 'Active' },
              { value: 'false', label: 'Inactive (hidden from merged list)' },
            ]}
          />
        </Field>
        <Field label="Extra fields (JSON object — stored verbatim on the entry)">
          <TextArea
            value={extraJson}
            onChange={setExtraJson}
            rows={5}
            className="font-mono text-[11px]"
            placeholder='{"baseFare": 500, "perKmRate": 28, "capacityTonnes": 8}'
          />
        </Field>

        <div className="flex justify-end gap-2 pt-1">
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn tone="primary" busy={busy} disabled={!code.trim() || !name.trim()} onClick={save}>
            {isEdit ? 'Save changes' : 'Create entry'}
          </Btn>
        </div>
      </div>
    </div>
  );
};

/** Bulk import — paste CSV (code,name[,extra…]) or a JSON array of rows. */
const ImportCard: React.FC<{ collection: string; onDone: () => void }> = ({ collection, onDone }) => {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ created: number; updated: number; errors: Row[] } | null>(null);
  const [msg, setMsg] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  const parseRows = (): Record<string, unknown>[] | null => {
    const t = text.trim();
    if (!t) return null;
    if (t.startsWith('[')) {
      try {
        const parsed: unknown = JSON.parse(t);
        if (!Array.isArray(parsed)) throw new Error('JSON import must be an array of objects');
        return parsed as Record<string, unknown>[];
      } catch (e) {
        setMsg({ kind: 'error', text: e instanceof Error ? e.message : 'Invalid JSON array.' });
        return null;
      }
    }
    const lines = t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return null;
    const first = lines[0].split(',').map((c) => c.trim().toLowerCase());
    const hasHeader = first.includes('code') && first.includes('name');
    const header = hasHeader ? first : null;
    const dataLines = hasHeader ? lines.slice(1) : lines;
    return dataLines.map((line) => {
      const cells = line.split(',').map((c) => c.trim());
      if (header) {
        const row: Record<string, unknown> = {};
        header.forEach((h, i) => {
          row[h] = cells[i] ?? '';
        });
        return row;
      }
      const [code, name, ...rest] = cells;
      const row: Record<string, unknown> = { code, name };
      rest.forEach((cell, i) => {
        row[`col${i + 1}`] = cell;
      });
      return row;
    });
  };

  const runImport = async () => {
    const rows = parseRows();
    if (!rows || !rows.length) {
      setMsg({ kind: 'error', text: 'Nothing to import — paste CSV rows (code,name,…) or a JSON array.' });
      return;
    }
    setBusy(true);
    setMsg(null);
    setResult(null);
    try {
      const res = asRow(await admin.masterData.importRows(collection, rows, `${collection}: bulk import (${rows.length} rows)`));
      setResult({
        created: typeof res?.created === 'number' ? res.created : 0,
        updated: typeof res?.updated === 'number' ? res.updated : 0,
        errors: Array.isArray(res?.errors) ? (res!.errors as Row[]) : [],
      });
      setText('');
      onDone();
    } catch (e) {
      setMsg({ kind: 'error', text: apiErrorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <PanelShell
      title="Bulk import"
      subtitle={`POST /admin/master/${collection}/import — up to 500 rows per batch. Paste CSV (code,name[,extra…] with an optional header row) or a JSON array of objects; bad rows are collected as errors without aborting the batch.`}
      icon={Upload}
    >
      {msg && <Banner kind={msg.kind}>{msg.text}</Banner>}
      {result && (
        <Banner kind={result.errors.length ? 'info' : 'success'}>
          Import finished: {result.created} created, {result.updated} updated, {result.errors.length} errors.
          {result.errors.slice(0, 5).map((e, i) => (
            <span key={i} className="block">
              Row {num(e, 'index') ?? '?'} ({str(e, 'code')}): {str(e, 'error')}
            </span>
          ))}
        </Banner>
      )}
      <TextArea
        value={text}
        onChange={setText}
        rows={7}
        className="font-mono text-[11px]"
        placeholder={'wheat,Wheat\nbasmati,Basmati Rice\n\nor\n\n[{"code":"wheat","name":"Wheat"}, {"code":"truck_9t","name":"9T Truck","baseFare":700,"perKmRate":32}]'}
      />
      <div className="flex justify-end">
        <Btn tone="primary" busy={busy} disabled={!text.trim()} onClick={runImport}>
          <Upload className="w-3.5 h-3.5" /> Import into {collection}
        </Btn>
      </div>
    </PanelShell>
  );
};
