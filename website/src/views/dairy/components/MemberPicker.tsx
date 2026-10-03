import { useEffect, useMemo, useState } from 'react';
import ModalSheet from '../../../components/ModalSheet';
import { listMembers, type DairyMember } from '../../../lib/api/dairy';
import { useT } from '../../../lib/i18n';
import EmptyState from './EmptyState';

interface MemberPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (member: DairyMember) => void;
}

/** Searchable member bottom-sheet — name + memberCode + village per row. */
export default function MemberPicker({ open, onClose, onSelect }: MemberPickerProps) {
  const t = useT();
  const [members, setMembers] = useState<DairyMember[] | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) return;
    setQuery('');
    listMembers({ status: 'active', pageSize: 500 })
      .then((res) => setMembers(res.data))
      .catch(() => setMembers([]));
  }, [open]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members ?? [];
    return (members ?? []).filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.village.toLowerCase().includes(q) ||
        m.memberCode.toLowerCase().includes(q)
    );
  }, [members, query]);

  return (
    <ModalSheet open={open} onClose={onClose} title={t('dairyPickMember')}>
      <input
        className="av-input"
        style={{ marginBottom: 12 }}
        placeholder={t('dairyPickMemberSearch')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="dairy-list" style={{ marginTop: 0 }}>
        {visible.length === 0 ? (
          <EmptyState icon="🔍" titleKey="dairyPickMemberEmpty" />
        ) : (
          visible.map((member) => (
            <button
              key={member.id}
              type="button"
              className="dairy-card"
              onClick={() => {
                onSelect(member);
                onClose();
              }}
            >
              <span className="dairy-card-row">
                <span className="dairy-card-title">{member.name}</span>
                <span className="dairy-card-sub">{member.memberCode}</span>
              </span>
              {member.village ? <span className="dairy-card-sub">{member.village}</span> : null}
            </button>
          ))
        )}
      </div>
    </ModalSheet>
  );
}
