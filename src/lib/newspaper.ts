import { daysInMonth, getLocalDateString } from './milk';

export interface NewspaperEntryCell {
  status: 'delivered' | 'skipped' | 'vacation' | 'inactive';
  cost: number;
  note?: string;
}

export interface NewspaperMatrixRow {
  account: any;
  entries: Record<number, NewspaperEntryCell>;
  totalDelivered: number;
  totalSkipped: number;
  totalVacation: number;
  monthlyBill: number;
  totalPaid: number;
  balanceDue: number;
}

export function isSunday(dateStr: string): boolean {
  const date = new Date(dateStr + 'T00:00:00Z');
  return date.getUTCDay() === 0; // 0 is Sunday
}

export function getDayRate(account: any, dateStr: string): number {
  return isSunday(dateStr) ? (Number(account.rate_sunday) ?? 7.0) : (Number(account.rate_weekday) ?? 5.0);
}

export function buildNewspaperMatrixRow(
  account: any,
  dbEntries: any[],
  year: number,
  month: number,
  totalPayments: number
): NewspaperMatrixRow {
  const numDays = daysInMonth(year, month);
  
  const entriesMap: Record<number, { status: string; note?: string }> = {};
  for (const entry of dbEntries) {
    const day = new Date(entry.entry_date + 'T00:00:00Z').getUTCDate();
    entriesMap[day] = {
      status: entry.status,
      note: entry.note || undefined
    };
  }

  const entries: Record<number, NewspaperEntryCell> = {};
  let totalDelivered = 0;
  let totalSkipped = 0;
  let totalVacation = 0;
  let monthlyBill = 0;

  for (let d = 1; d <= numDays; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    
    // Check if subscription active
    let isActive = true;
    if (account.start_date && dateStr < account.start_date) {
      isActive = false;
    }
    if (account.end_date && dateStr > account.end_date) {
      isActive = false;
    }

    if (!isActive) {
      entries[d] = {
        status: 'inactive',
        cost: 0,
        note: 'Inactive'
      };
      continue;
    }

    const dbEntry = entriesMap[d];
    const todayStr = getLocalDateString();
    
    let status: 'delivered' | 'skipped' | 'vacation' | 'inactive' = 'inactive';
    let note = undefined;

    if (dbEntry) {
      status = dbEntry.status as any;
      note = dbEntry.note;
    } else if (dateStr <= todayStr) {
      status = 'delivered';
    } else {
      status = 'inactive';
    }

    let cost = 0;
    if (status === 'delivered') {
      cost = getDayRate(account, dateStr);
      totalDelivered++;
      monthlyBill += cost;
    } else if (status === 'skipped') {
      totalSkipped++;
    } else if (status === 'vacation') {
      totalVacation++;
    }

    entries[d] = {
      status,
      cost,
      note
    };
  }

  const totalPaid = totalPayments;
  const balanceDue = monthlyBill - totalPaid;

  return {
    account,
    entries,
    totalDelivered,
    totalSkipped,
    totalVacation,
    monthlyBill,
    totalPaid,
    balanceDue
  };
}

export function detectNewspaperMissingDates(
  account: any,
  dbEntries: any[],
  year: number,
  month: number
): string[] {
  if (!account.active) {
    return [];
  }
  const existingDates = new Set(dbEntries.map((e: any) => e.entry_date));
  const today = getLocalDateString();
  const numDays = daysInMonth(year, month);
  
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(numDays).padStart(2, '0')}`;
  
  const startStr = account.start_date && account.start_date > monthStart ? account.start_date : monthStart;
  
  let effectiveEnd = monthEnd < today ? monthEnd : today;
  if (account.end_date) {
    effectiveEnd = account.end_date < effectiveEnd ? account.end_date : effectiveEnd;
  }

  const missingDates: string[] = [];
  const start = new Date(startStr + 'T00:00:00Z');
  const end = new Date(effectiveEnd + 'T00:00:00Z');
  
  const current = new Date(start);
  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];
    if (!existingDates.has(dateStr)) {
      missingDates.push(dateStr);
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }
  
  return missingDates;
}
