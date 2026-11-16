export type LeaveType = 
  | 'casual' 
  | 'sick' 
  | 'monthly' 
  | 'earned' 
  | 'emergency' 
  | 'maternity' 
  | 'paternity' 
  | 'other';

export type LeaveStatus = 'pending' | 'approved' | 'rejected';

export interface LeaveRequest {
  id: string;
  type: LeaveType;
  fromDate: string;
  toDate: string;
  reason: string;
  status: LeaveStatus;
  submittedAt: string;
  approvedBy?: string;
}

export interface LeaveBalance {
  sick: { allowed: number; taken: number };
  casual: { allowed: number; taken: number };
  earned?: { allowed: number; taken: number };
  emergency?: { allowed: number; taken: number };
  maternity?: { allowed: number; taken: number };
  paternity?: { allowed: number; taken: number };
  other?: { allowed: number; taken: number };
}

export interface MonthlyLeaveQuota {
  id: string;
  month: string;       // "2026-07"
  allotted: number;    // default 3
  used: number;
  remaining: number;   // computed: allotted - used
}
