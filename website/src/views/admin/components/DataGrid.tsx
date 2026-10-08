import { useCallback, useEffect, useState } from 'react';
import { useT } from '../../../lib/i18n';

export interface GridColumn {
  key: string;
  labelKey: string;
  sortable?: boolean;
  render?: (row: Record<string, unknown>) => React.ReactNode;
}

export interface GridQuery {
  page: number;
  pageSize: number;
  search: string;
  status: string;
  sort: string;
}

interface Props {
  columns: GridColumn[];
  fetchPage: (q: GridQuery) => Promise<{ data: Record<string, unknown>[]; total: number }>;
  statusChips?: string[];
  onBulkAction?: (ids: string[]) => void;
  onRowClick?: (row: Record<string, unknown>) => void;
  refreshKey?: number;
}

const DEFAULT_CHIPS = ['all', 'pending', 'approved', 'flagged', 'rejected'];

/** Universal server-paginated data grid: search, status chips, sort, bulk select. */
export default function DataGrid({
  columns,
  fetchPage,
  statusChips = DEFAULT_CHIPS,
  onBulkAction,
  onRowClick,
  refreshKey = 0,
}: Props) {
  const t = useT();
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [status, setStatus] = useState(statusChips[0]);
  const [sort, setSort] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetchPage({ page, pageSize, search, status, sort })
      .then((res) => {
        setRows(res.data ?? []);
        setTotal(res.total ?? 0);
      })
      .catch(() => {
        setRows([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [fetchPage, page, pageSize, search, status, sort]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const toggleSort = (col: GridColumn) => {
    if (!col.sortable) return;
    setSort((prev) => (prev === col.key ? `-${col.key}` : col.key));
  };

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const allSelected = rows.length > 0 && selected.length === rows.length;

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <input
          className="admin-input"
          style={{ maxWidth: 260 }}
          placeholder={t('admin.grid.search')}
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setPage(1);
              setSearch(searchDraft);
            }
          }}
        />
        <button
          className="admin-button secondary"
          onClick={() => {
            setPage(1);
            setSearch(searchDraft);
          }}
        >
          {t('admin.grid.search')}
        </button>
        {statusChips.map((chip) => (
          <button
            key={chip}
            className={`admin-chip${status === chip ? ' active' : ''}`}
            onClick={() => {
              setStatus(chip);
              setPage(1);
            }}
          >
            {t(`admin.grid.status.${chip}`)}
          </button>
        ))}
        {onBulkAction && selected.length > 0 && (
          <button className="admin-button secondary" onClick={() => onBulkAction(selected)}>
            {t('admin.grid.bulk')} ({selected.length})
          </button>
        )}
      </div>

      <table className="admin-grid">
        <thead>
          <tr>
            {onBulkAction && (
              <th>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) =>
                    setSelected(e.target.checked ? rows.map((r) => String(r.id)) : [])
                  }
                />
              </th>
            )}
            {columns.map((col) => (
              <th key={col.key} onClick={() => toggleSort(col)} style={{ cursor: col.sortable ? 'pointer' : 'default' }}>
                {t(col.labelKey)}
                {sort === col.key ? ' ▲' : sort === `-${col.key}` ? ' ▼' : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={columns.length + (onBulkAction ? 1 : 0)}>{t('admin.grid.loading')}</td>
            </tr>
          )}
          {!loading && rows.length === 0 && (
            <tr>
              <td colSpan={columns.length + (onBulkAction ? 1 : 0)}>{t('admin.grid.empty')}</td>
            </tr>
          )}
          {!loading &&
            rows.map((row) => (
              <tr key={String(row.id)} onClick={() => onRowClick?.(row)}>
                {onBulkAction && (
                  <td onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.includes(String(row.id))}
                      onChange={(e) =>
                        setSelected((prev) =>
                          e.target.checked
                            ? [...prev, String(row.id)]
                            : prev.filter((id) => id !== String(row.id))
                        )
                      }
                    />
                  </td>
                )}
                {columns.map((col) => (
                  <td key={col.key}>
                    {col.render ? col.render(row) : String(row[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
        <button className="admin-button secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          {t('admin.grid.prev')}
        </button>
        <span className="admin-nav-group-label">
          {t('admin.grid.page')} {page} / {pageCount}
        </span>
        <button
          className="admin-button secondary"
          disabled={page >= pageCount}
          onClick={() => setPage((p) => p + 1)}
        >
          {t('admin.grid.next')}
        </button>
      </div>
    </div>
  );
}
