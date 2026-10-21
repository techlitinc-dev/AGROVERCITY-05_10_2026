// Common utility functions for formatting numbers, currency, dates, and labels

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-IN').format(num);
}

/** Money is integer paisa on the backend — render ₹ with up to 2 decimals when needed. */
export function formatPaisa(paisa: number): string {
  const rupees = (paisa || 0) / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: Number.isInteger(rupees) ? 0 : 2,
  }).format(rupees);
}

export function formatWeight(quintals: number): string {
  if (quintals >= 10) {
    return `${formatNumber(quintals)} Quintals (${formatNumber(quintals * 100)} kg)`;
  }
  return `${formatNumber(quintals * 100)} kg`;
}

export function formatDate(dateString: string): string {
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

export function formatDateTime(dateString: string): string {
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}

export function getStatusColor(status: string): { bg: string; text: string; border: string } {
  switch (status.toLowerCase()) {
    case 'open':
    case 'active':
    case 'completed':
    case 'delivered':
    case 'approved':
    case 'settled':
    case 'paid':
    case 'verified':
      return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };

    case 'confirmed':
    case 'advancepaid':
    case 'pickupscheduled':
    case 'shipped':
    case 'packed':
    case 'intransit':
    case 'in_progress':
    case 'negotiating':
    case 'countered':
      return { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' };

    case 'pending':
    case 'offered':
    case 'under_review':
    case 'intimated':
    case 'draft':
      return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' };

    case 'qcdisputed':
    case 'disputed':
    case 'rejected':
    case 'cancelled':
    case 'withdrawn':
    case 'declined':
    case 'closed':
      return { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' };

    default:
      return { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' };
  }
}

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
