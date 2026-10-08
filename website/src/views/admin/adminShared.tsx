import { useCallback, useState } from 'react';
import { useT } from '../../lib/i18n';
import { adminGet, adminPost, adminPut, mutationHeaders } from '../../lib/api/admin';
import { useSessionStore } from '../../stores/session';
import { getAdminRole } from './AdminShell';
import DataGrid, { type GridColumn, type GridQuery } from './components/DataGrid';
import DetailDrawer from './components/DetailDrawer';
import ConfirmActionModal from './components/ConfirmActionModal';

export function useRole(): string {
  const user = useSessionStore((s) => s.user);
  return getAdminRole(user as unknown as Record<string, unknown> | null) ?? 'superadmin';
}

export interface ActionConfig {
  labelKey: string;
  destructive?: boolean;
  method?: 'post' | 'put';
  path: (row: Record<string, unknown>) => string;
  body?: (row: Record<string, unknown>) => Record<string, unknown>;
  fields?: { key: string; labelKey: string; placeholderKey?: string }[];
  when?: (row: Record<string, unknown>) => boolean;
}

interface GridPageProps {
  titleKey: string;
  url: string;
  columns: GridColumn[];
  statusChips?: string[];
  params?: Record<string, unknown>;
  idKey?: string;
  detailUrl?: (id: string) => string;
  actions?: ActionConfig[];
  renderExtra?: (entity: Record<string, unknown>) => React.ReactNode;
}

/** A full admin module page: header + DataGrid + DetailDrawer + confirmed actions. */
export function GridPage({
  titleKey,
  url,
  columns,
  statusChips,
  params = {},
  idKey = 'id',
  detailUrl,
  actions = [],
  renderExtra,
}: GridPageProps) {
  const t = useT();
  const role = useRole();
  const [refreshKey, setRefreshKey] = useState(0);
  const [drawer, setDrawer] = useState<Record<string, unknown> | null>(null);

  const paramsKey = JSON.stringify(params);
  const fetchPage = useCallback(
    (q: GridQuery) => {
      const p: Record<string, unknown> = { ...params, page: q.page, pageSize: q.pageSize };
      if (q.search) p.search = q.search;
      if (q.status && q.status !== 'all') p.status = q.status;
      return adminGet<{ data?: Record<string, unknown>[]; total?: number }>(url, p).then((r) => ({
        data: r.data ?? [],
        total: r.total ?? 0,
      }));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [url, paramsKey]
  );

  const drawerActions =
    drawer === null
      ? []
      : actions
          .filter((a) => !a.when || a.when(drawer))
          .map((a) => ({
            labelKey: a.labelKey,
            destructive: a.destructive,
            fields: a.fields,
            onConfirm: async (reason: string, extra: Record<string, string>) => {
              const path = a.path(drawer);
              const base = a.body ? a.body(drawer) : {};
              const body = { ...base, ...extra, reason };
              const call = a.method === 'put' ? adminPut : adminPost;
              await call(path, body, mutationHeaders(role, reason));
              setRefreshKey((k) => k + 1);
            },
          }));

  return (
    <div>
      <h2>{t(titleKey)}</h2>
      <DataGrid
        columns={columns}
        fetchPage={fetchPage}
        statusChips={statusChips}
        refreshKey={refreshKey}
        onRowClick={(row) => setDrawer(row)}
      />
      {drawer && (
        <DetailDrawer
          targetId={String(drawer[idKey] ?? '')}
          title={t(titleKey)}
          fetchEntity={() =>
            adminGet<Record<string, unknown>>(
              detailUrl ? detailUrl(String(drawer[idKey])) : `${url}/${String(drawer[idKey])}`
            )
          }
          actions={drawerActions}
          renderExtra={renderExtra}
          onClose={() => setDrawer(null)}
          ConfirmComponent={ConfirmActionModal}
        />
      )}
    </div>
  );
}
