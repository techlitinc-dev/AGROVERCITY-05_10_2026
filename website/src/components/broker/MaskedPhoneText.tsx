import { maskPhone } from '../../lib/api/broker';

interface MaskedPhoneTextProps {
  phone: string;
  className?: string;
}

/**
 * C1: the ONLY place phone rendering lives. Numbers are always masked,
 * never linkable (no tel:) and never copyable.
 */
export default function MaskedPhoneText({ phone, className }: MaskedPhoneTextProps) {
  if (!phone) return null;
  return (
    <span className={className ?? 'broker-masked-phone'} onCopy={(e) => e.preventDefault()}>
      {maskPhone(phone)}
    </span>
  );
}
