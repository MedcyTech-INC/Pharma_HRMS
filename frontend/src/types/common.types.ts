export type Language = 'en' | 'te';
export type PunchType = 'in_office' | 'out_of_office';
export type PinType = 'field_visit' | 'doctor_visit' | 'chemist_visit' | 'stockist_visit' | 'hospital_visit' | 'other';
export type RepaymentTimeline = 2 | 3 | 5;

export type Branch = 'corporate' | 'ts_zone' | 'ap_zone' | 'visakhapatnam' | 'vizianagaram';
export type Hospital = 'orca_labs' | 'both' | 'vizag_ivf' | 'medcy_hospitals';
export type HierarchyLevel = 'be' | 'rsm' | 'zsm' | 'executive' | 'admin' | 'employee' | 'team_lead' | 'manager' | 'senior_manager';
export type PharmaZone = 'TS' | 'AP' | 'Corporate';

export interface Holiday {
  id: string;
  date: string;
  day: string;
  name: string;
  type: 'gazetted' | 'sunday_compensatory';
  year: number;
}

/**
 * In Pharma HRMS, corporate admins (P Aswani, NV Divya Sirisha, Aishwarya / OL102)
 * and designated corporate admin accounts are exempt from checking in.
 * All other field personnel (ZSMs, RSMs, BEs) MUST check in for attendance.
 */
export function isExemptAdmin(emp?: { id?: string; name?: string; hierarchyLevel?: string; role?: string; designation?: string } | null): boolean {
  if (!emp) return false;
  const id = (emp.id || '').toUpperCase();
  const name = (emp.name || '').toLowerCase();
  const role = (emp.role || '').toLowerCase();
  const hierarchyLevel = (((emp as any).hierarchy_level || emp.hierarchyLevel || '') as string).toLowerCase();
  const designation = (emp.designation || '').toLowerCase();
  
  if (id === 'OL026' || id === 'OL009' || id === 'OL102' || id === 'EMP_ADMIN_01') return true;
  if (name.includes('aswani') || name.includes('divya') || name.includes('aishwarya') || name.includes('aiswarya')) return true;
  if (hierarchyLevel === 'admin' || hierarchyLevel === 'corporate_admin' || hierarchyLevel === 'executive') return true;
  if (role === 'admin' || role === 'corporate_admin') return true;
  if (designation === 'admin' || designation.includes('corporate admin')) return true;
  return false;
}

