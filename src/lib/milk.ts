export interface EntryCell {
  q: number;
  type: 'auto' | 'manual' | 'none';
}

export interface MatrixRow {
  account: any;
  entries: Record<number, EntryCell>;
  payments: number;
  totalQty: number;
  payable: number;
  paid: number;
  net: number;
}

export interface PendingAutofill {
  account_id: number;
  supplier_name: string;
  category_name: string;
  qty: number;
  count: number;
  range: string;
}

export function getLocalDateString(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const partMap = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${partMap.year}-${partMap.month}-${partMap.day}`;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function previousMonth(year: number, month: number): { year: number; month: number } {
  if (month === 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}

export function formatRange(start: string, end: string): string {
  const s = new Date(start + 'T00:00:00Z');
  const e = new Date(end + 'T00:00:00Z');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const sStr = `${months[s.getUTCMonth()]} ${s.getUTCDate()}`;
  const eStr = `${months[e.getUTCMonth()]} ${e.getUTCDate()}`;
  return sStr === eStr ? sStr : `${sStr} to ${eStr}`;
}

export function buildMatrixRow(account: any, dbEntries: any[], daysInMonth: number, totalPayments: number): MatrixRow {
  const entriesMap: Record<number, { q: number; type: 'auto' | 'manual' | 'none' }> = {};
  for (const entry of dbEntries) {
    const day = new Date(entry.entry_date + 'T00:00:00Z').getUTCDate();
    entriesMap[day] = { q: Number(entry.quantity) || 0, type: (entry.entry_type === 'manual' ? 'manual' : 'auto') as 'manual' | 'auto' };
  }
  const entries: Record<number, EntryCell> = {};
  let totalQty = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    if (entriesMap[d]) {
      entries[d] = entriesMap[d];
      totalQty += entriesMap[d].q;
    } else {
      entries[d] = { q: 0, type: 'none' };
    }
  }
  const payable = totalQty * (Number(account.rate) || 0);
  const paid = totalPayments;
  const net = paid - payable;
  return { account, entries, payments: totalPayments, totalQty, payable, paid, net };
}

export function detectMissingAutofills(
  account: any, dbEntries: any[], year: number, month: number, daysInMonth: number
): { missingDates: string[]; pending: PendingAutofill | null } {
  if (!account.active || !account.autogen_daily || !account.autogen_quantity || Number(account.autogen_quantity) <= 0) {
    return { missingDates: [], pending: null };
  }
  const existingDates = new Set(dbEntries.map((e: any) => e.entry_date));
  const today = getLocalDateString();
  const now = new Date();
  const autoTime = account.autogen_time || '00:00:00';
  const [autoHour, autoMin] = autoTime.split(':').map(Number);
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const monthEnd = `${year}-${String(month).padStart(2, '0')}-${daysInMonth}`;
  const startStr = account.start_date && account.start_date > monthStart ? account.start_date : monthStart;
  const endStr = account.end_date && account.end_date < monthEnd ? account.end_date : monthEnd;
  const effectiveEnd = endStr < today ? endStr : today;
  const start = new Date(startStr + 'T00:00:00Z');
  const end = new Date(effectiveEnd + 'T00:00:00Z');
  const missingDates: string[] = [];
  const current = new Date(start);
  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];
    if (!existingDates.has(dateStr)) {
      if (dateStr === today) {
        const targetTime = new Date(today + `T${String(autoHour).padStart(2, '0')}:${String(autoMin).padStart(2, '0')}:00+05:30`);
        if (now < targetTime) { current.setUTCDate(current.getUTCDate() + 1); continue; }
      }
      missingDates.push(dateStr);
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }
  if (missingDates.length === 0) return { missingDates: [], pending: null };
  return {
    missingDates,
    pending: {
      account_id: account.id,
      supplier_name: account.milksupplier_name,
      category_name: account.category_name,
      qty: Number(account.autogen_quantity),
      count: missingDates.length,
      range: formatRange(missingDates[0], missingDates[missingDates.length - 1]),
    },
  };
}

export function getCarryForwardData(prevAccounts: any[], year: number, month: number): any[] {
  const monthEnd = `${year}-${String(month).padStart(2, '0')}-${daysInMonth(year, month)}`;
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  return prevAccounts.filter((a: any) => a.active).map((a: any) => ({
    userId: a.user_id,
    supplierId: a.milksupplier_id,
    categoryId: a.category_id,
    rate: a.rate,
    autogenQuantity: a.autogen_quantity,
    autogenDaily: a.autogen_daily,
    autogenTime: a.autogen_time,
    year, month,
    startDate: monthStart,
    endDate: monthEnd,
    active: 1,
  }));
}
