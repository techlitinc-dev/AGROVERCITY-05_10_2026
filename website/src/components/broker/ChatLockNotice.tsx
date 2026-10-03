import { useT } from '../../lib/i18n';

/** Spec D1 LOCKED state — pre-booking comms stay structured (offer cards only). */
export default function ChatLockNotice() {
  const t = useT();
  return (
    <div className="broker-chat-lock" role="note">
      <span aria-hidden>🔒</span>
      <span>{t('chatLockedNote')}</span>
    </div>
  );
}
