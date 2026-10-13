import { supabase } from '../supabase-client';
import { Holiday } from '../../types';



export async function fetchHolidays(year: number = 2026): Promise<Holiday[]> {
  try {
    let { data, error } = await supabase
      .from('pharma_hrms_holidays')
      .select('*')
      .eq('year', year)
      .order('date', { ascending: true });

    if (error || !data || data.length === 0) {
      console.warn('No holidays found in database for year', year);
      return [];
    }

    return data.map((item: any) => ({
      id: item.id || `h-${item.date}`,
      date: item.date,
      day: item.day,
      name: item.name,
      type: item.type as 'gazetted' | 'sunday_compensatory',
      year: item.year || year
    }));
  } catch (err) {
    console.error('Error fetching holidays:', err);
    return [];
  }
}

/**
 * Format Date as YYYY-MM-DD in local time
 */
export function formatLocalDateStr(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Checks if today is an official holiday
 */
export function getTodayHoliday(holidays: Holiday[], referenceDate: Date = new Date()): Holiday | null {
  const todayStr = formatLocalDateStr(referenceDate);
  return holidays.find(h => h.date === todayStr) || null;
}

/**
 * Checks if tomorrow is an official holiday (holiday eve)
 */
export function isHolidayEve(holidays: Holiday[], referenceDate: Date = new Date()): Holiday | null {
  const tomorrow = new Date(referenceDate);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = formatLocalDateStr(tomorrow);
  return holidays.find(h => h.date === tomorrowStr) || null;
}

/**
 * Gets upcoming holidays on or after today, sorted chronologically
 */
export function getUpcomingHolidays(holidays: Holiday[], limit: number = 5, referenceDate: Date = new Date()): Holiday[] {
  const todayStr = formatLocalDateStr(referenceDate);
  return [...holidays]
    .filter(h => h.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, limit);
}

/**
 * Gets the single next upcoming holiday
 */
export function getNextHoliday(holidays: Holiday[], referenceDate: Date = new Date()): Holiday | null {
  const upcoming = getUpcomingHolidays(holidays, 1, referenceDate);
  return upcoming.length > 0 ? upcoming[0] : null;
}

/**
 * Calculates number of calendar days between referenceDate and a holiday
 */
export function getDaysUntil(holiday: Holiday, referenceDate: Date = new Date()): number {
  const todayStr = formatLocalDateStr(referenceDate);
  const [ty, tm, td] = todayStr.split('-').map(Number);
  const [hy, hm, hd] = holiday.date.split('-').map(Number);

  const tDate = new Date(ty, tm - 1, td);
  const hDate = new Date(hy, hm - 1, hd);

  const diffTime = hDate.getTime() - tDate.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}
