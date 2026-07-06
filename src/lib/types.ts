/* ---------------------------------------------------------------
   Shared TypeScript types for the gym management app.
   These mirror the Supabase database schema.
   --------------------------------------------------------------- */

// ── Enums ──────────────────────────────────────────────────────

export interface Role {
  id: string;
  name: string;
  description: string | null;
  tabs: string[];
  created_at: string;
}

export interface UserRoleMapping {
  user_id: string;
  role_id: string;
  role?: Role;
}
export type MemberStatus = 'active' | 'expired' | 'expiring_soon' | 'has_debt' | 'new';
export type Gender = 'male' | 'female';
export type InvoiceStatus = 'paid' | 'partial' | 'unpaid';
export type PaymentMethod = 'Cash' | 'Visa' | 'InstaPay' | 'Split';
export type CoachPaymentType = 'salary' | 'per_session';
export type LeadStatus = 'New' | 'Contacted' | 'Follow-up' | 'Converted' | 'Lost' | 'Invited';
export type LiabilityType = 'installment' | 'one_time';
export type DiscountType = 'fixed' | 'percentage';
export type AuditActionType =
  | 'override_checkin'
  | 'edit_payment'
  | 'apply_discount'
  | 'remove_discount'
  | 'checkin'
  | 'other';

// ── Row types ──────────────────────────────────────────────────

export interface Profile {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

export interface Member {
  uuid: string;
  id: number;
  name: string;
  phone: string;
  parent_phone: string | null;
  birth_date: string | null;
  gender: Gender | null;
  status: MemberStatus;
  sessions_remaining: number;
  session_debt: number;
  expires_at: string | null;
  member_since: string;
  last_subscription_date?: string | null;
  pending_subscription_date?: string | null;
  package_id: string | null;
  package_name: string;
  class_id: string | null;
  coach_name?: string | null;
  class_info?: Class | null;
  freeze_days_remaining: number;
  invitations_remaining: number;
  inbody_sessions_remaining: number;
  created_at: string;
  // Joined field (populated via query)
  frozen_until?: string | null;
}

export interface SubscriptionPackage {
  id: string;
  name: string;
  category: 'PT' | 'Clinic' | 'Normal';
  sessions: number;
  price: number;
  validity_days: number;
  freeze_days: number;
  invitations: number;
  inbody_sessions: number;
  is_clinic?: boolean;
  is_pt?: boolean;
  is_free?: boolean;
  created_at: string;
}

export interface Invoice {
  uuid: string;
  id: string;
  member_id: string;
  member_name: string;
  class_id?: string | null;
  package_id: string | null;
  package_name: string;
  discount_id: string | null;
  discount_description: string | null;
  discount_amount: number;
  total_amount: number;
  paid_amount: number;
  status: InvoiceStatus;
  payment_method: PaymentMethod;
  notes?: string | null;
  split_payments?: { method: PaymentMethod; amount: number }[] | null;
  created_at: string;
  activation_date: string;
  is_applied: boolean;
  joint_invoice_group_id?: string | null;
  settled_by_invoice_id?: string | null;
  sessions_remaining?: number | null;
  freeze_days_remaining?: number | null;
}

export interface Discount {
  id: string;
  name: string;
  discount_type: DiscountType;
  value: number;
  active: boolean;
  is_joint: boolean;
  joint_count: number;
  created_at: string;
}

export interface Coach {
  id: string;
  name: string;
  phone: string;
  payment_type: CoachPaymentType;
  rate: number;
  pt_sessions_done: number;
  pt_rate: number;
  pt_percentage?: number;
  user_id?: string | null;
  created_at: string;
}

export interface Lead {
  id: string;
  name: string;
  phone: string;
  source: string;
  status: LeadStatus;
  notes: string[];
  interest?: string | null;
  follow_up_date: string;
  assigned_to: string | null;
  inviting_member_id?: string | null;
  calls_made: number;
  took_invitation: boolean;
  created_at: string;
}

export interface Expense {
  uuid: string;
  id: string;
  category: string;
  amount: number;
  description: string;
  date: string;
  liability_id: string | null;
  coach_id: string | null;
  payment_method: PaymentMethod;
  split_payments?: { method: PaymentMethod; amount: number }[] | null;
  created_at: string;
}

export interface InternalTransfer {
  id: string;
  from_account: PaymentMethod;
  to_account: PaymentMethod;
  amount: number;
  date: string;
  note: string | null;
  created_at: string;
}

export interface Liability {
  id: string;
  name: string;
  description: string;
  type: LiabilityType;
  total_amount: number;
  paid_amount: number;
  installment_amount: number;
  frequency_days: number;
  next_due_date: string;
  notify_days_before: number;
  is_complete: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  action: string;
  action_type: AuditActionType;
  performed_by: string | null;
  performer_name: string;
  member_id: string | null;
  member_name: string | null;
  timestamp: string;
  details: string;
}

export interface CheckIn {
  id: string;
  member_id: string;
  checked_in_by: string | null;
  is_override: boolean;
  pay_later: boolean;
  created_at: string;
}

export interface CoachCheckIn {
  id: string;
  coach_id: string;
  class_id?: string;
  check_in_date: string;
  is_substitute: boolean;
  original_coach_id?: string | null;
  session_type: 'group' | 'pt';
  member_uuid?: string | null;
  is_paid: boolean;
  expense_uuid?: string | null;
  created_at: string;
}



export interface Sport {
  id: string;
  name: string;
  created_at: string;
}

export interface ClassSchedule {
  day: string;
  time: string;
}

export interface Class {
  id: string;
  name: string;
  sport_id: string | null;
  coach_id: string | null;
  schedules: ClassSchedule[];
  capacity: number;
  attendance_count: number;
  created_at: string;
  
  // Joined fields
  sport_name?: string;
  coach_name?: string;
}

export interface DiscountMember {
  discount_id: string;
  member_id: string;
}

export interface DiscountInvoice {
  discount_id: string;
  invoice_id: string;
}

export interface Employee {
  id: string;
  name: string;
  phone: string;
  department: string;
  rate: number;
  work_days: string[];
  shift_start: string | null;
  shift_end: string | null;
  late_threshold_minutes: number;
  deduction_per_minute: number;
  user_id?: string | null;
  created_at: string;
}

export interface EmployeeCheckIn {
  id: string;
  employee_id: string;
  check_in_time?: string;
  check_out_time?: string | null;
  checked_in_at?: string;
  late_minutes?: number;
  deduction?: number;
  notes: string | null;
  created_at: string;
}

export interface EmployeeDeduction {
  id: string;
  employee_id: string;
  amount: number;
  reason: string;
  created_at: string;
}

export interface FinanceBaseBalance {
  id: string;
  month: number;
  year: number;
  cash: number;
  visa: number;
  instapay: number;
  created_at: string;
}

export interface GlobalSettings {
  id: number;
  finance_start_date: string | null;
  finance_start_cash: number;
  finance_start_visa: number;
  finance_start_instapay: number;
}

export interface CoachDeduction {
  id: string;
  coach_id: string;
  amount: number;
  forgiven_sessions: number;
  reason: string;
  date: string;
  created_at: string;
}

export interface InvoicePayment {
  id: string;
  custom_id?: string | null;
  invoice_uuid: string;
  amount: number;
  payment_method: PaymentMethod;
  split_payments?: { method: PaymentMethod; amount: number }[] | null;
  paid_at: string;
  recorded_by: string | null;
  notes: string | null;
  created_at: string;
}

// ── Supabase Database type (for typed client) ──────────────────

export interface Database {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: any; Update: any };
      members: { Row: Member; Insert: any; Update: any };
      packages: { Row: SubscriptionPackage; Insert: any; Update: any };
      invoices: { Row: Invoice; Insert: any; Update: any };
      discounts: { Row: Discount; Insert: any; Update: any };
      coaches: { Row: Coach; Insert: any; Update: any };
      leads: { Row: Lead; Insert: any; Update: any };
      expenses: { Row: Expense; Insert: any; Update: any };
      liabilities: { Row: Liability; Insert: any; Update: any };
      audit_logs: { Row: AuditLog; Insert: any; Update: any };
      check_ins: { Row: CheckIn; Insert: any; Update: any };
      coach_check_ins: { Row: CoachCheckIn; Insert: any; Update: any };
      classes: { Row: Class; Insert: any; Update: any };
      sports: { Row: Sport; Insert: any; Update: any };

      roles: { Row: Role; Insert: any; Update: any };
      user_roles: { Row: UserRoleMapping; Insert: any; Update: any };
    };
    Functions: {
      check_in_member: {
        Args: { p_member_id: string; p_is_override: boolean; p_pay_later: boolean; p_performed_by: string; p_performer_name: string };
        Returns: void;
      };
      pay_liability: {
        Args: { p_liability_id: string; p_amount: number };
        Returns: void;
      };
      cleanup_expired_subscriptions: {
        Args: Record<PropertyKey, never>;
        Returns: void;
      };
    };
  };
}
