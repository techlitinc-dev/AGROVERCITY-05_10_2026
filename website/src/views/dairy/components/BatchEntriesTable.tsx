import { fmtINR, fmtL, type PaymentEntry } from '../../../lib/api/dairy';
import { useT } from '../../../lib/i18n';

interface BatchEntriesTableProps {
  entries: PaymentEntry[];
}

/** Per-member payment rows: member, liters, amount, deduction, net. */
export default function BatchEntriesTable({ entries }: BatchEntriesTableProps) {
  const t = useT();
  const totalLiters = entries.reduce((sum, e) => sum + e.liters, 0);
  const totalAmount = entries.reduce((sum, e) => sum + e.amount, 0);
  const totalDeduction = entries.reduce((sum, e) => sum + e.deduction, 0);
  const totalNet = entries.reduce((sum, e) => sum + e.netAmount, 0);

  return (
    <div className="dairy-table-wrap">
      <table className="dairy-table">
        <thead>
          <tr>
            <th>{t('dairyTblMember')}</th>
            <th>{t('dairyTblLiters')}</th>
            <th>{t('dairyTblAmount')}</th>
            <th>{t('dairyTblDeduction')}</th>
            <th>{t('dairyTblNet')}</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id}>
              <td>{entry.memberName}</td>
              <td className="dairy-table-num">{fmtL(entry.liters)}</td>
              <td className="dairy-table-num">{fmtINR(entry.amount)}</td>
              <td className="dairy-table-num">
                {entry.deduction > 0 ? `− ${fmtINR(entry.deduction)}` : '—'}
              </td>
              <td className="dairy-table-num">{fmtINR(entry.netAmount)}</td>
            </tr>
          ))}
        </tbody>
        {entries.length > 0 ? (
          <tfoot>
            <tr>
              <td>{t('commonTotal')}</td>
              <td className="dairy-table-num">{fmtL(totalLiters)}</td>
              <td className="dairy-table-num">{fmtINR(totalAmount)}</td>
              <td className="dairy-table-num">
                {totalDeduction > 0 ? `− ${fmtINR(totalDeduction)}` : '—'}
              </td>
              <td className="dairy-table-num">{fmtINR(totalNet)}</td>
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}
