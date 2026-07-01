/* ---------------------------------------------------------------
   Shared TypeScript types for the gym management app.
   These mirror the Supabase database schema.
   --------------------------------------------------------------- */

// ── Enums ──────────────────────────────────────────────────────

export type UserRole = 'admin' | 'reception' | 'sales';
export type MemberStatus = 'active' | 'expired' | 'expiring_soon' | 'has_debt' | 'new';
export type Gender = 'male' | 'female' | 'other';
export type InvoiceStatus = 'paid' | 'partial' | 'unpaid';
export type PaymentMethod = 'Cash' | 'Visa' | 'InstaPay';
export type CoachPaymentType = 'salary' | 'per_session' | 'commission';
export type CommissionBase = 'revenue' | 'members';
export type LeadStatus = 'New' | 'Contacted' | 'Follow-up' | 'Converted' | 'Lost';
export type LiabilityType = 'installment' | 'one_time';
export type DiscountKind = 'seasonal' | 'manual';
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
  role: UserRole;
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
  total_sessions: number;
  expires_at: string | null;
  member_since: string;
  last_subscription_date?: string | null;
  package_id: string | null;
  package_name: string;
  class_id: string | null;
  coach_name?: string | null;
  class_info?: Class | null;
  freeze_days_used: number;
  freeze_days_total: number;
  invitations_remaining: number;
  inbody_sessions_remaining: number;
  sport: string | null;
  created_at: string;
  // Joined field (populated via query)
  coach_name?: string;
}

export interface SubscriptionPackage {
  id: string;
  name: string;
  sessions: number;
  price: number;
  validity_days: number;
  freeze_days: number;
  invitations: number;
  inbody_sessions: number;
  created_at: string;
}

export interface Invoice {
  uuid: string;
  id: string;
  member_id: string;
  member_name: string;
  package_id: string | null;
  package_name: string;
  discount_id: string | null;
  discount_description: string | null;
  discount_amount: number;
  total_amount: number;
  paid_amount: number;
  status: InvoiceStatus;
  payment_method: PaymentMethod;
  created_at: string;
}

export interface Discount {
  id: string;
  name: string;
  type: DiscountKind;
  discount_type: DiscountType;
  value: number;
  active: boolean;
  created_at: string;
  // Joined / computed
  member_ids?: string[];
  invoice_ids?: string[];
}

export interface Coach {
  id: string;
  name: string;
  phone: string;
  payment_type: CoachPaymentType;
  rate: number;
  commission_base: CommissionBase | null;
  sessions_this_month: number;
  created_at: string;
}

export interface Lead {
  id: string;
  name: string;
  phone: string;
  source: string;
  status: LeadStatus;
  notes: string[];
  follow_up_date: string;
  assigned_to: string | null;
  calls_made: number;
  created_at: string;
}

export interface Expense {
  id: string;
  category: string;
  amount: number;
  description: string;
  date: string;
  liability_id: string | null;
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
  check_in_date: string;
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

// ── Supabase Database type (for typed client) ──────────────────

export interface Database {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Omit<Profile, 'created_at'>; Update: Partial<Omit<Profile, 'id' | 'created_at'>> };
      members: { Row: Member; Insert: Omit<Member, 'id' | 'created_at' | 'coach_name'>; Update: Partial<Omit<Member, 'id' | 'created_at' | 'coach_name'>> };
      packages: { Row: SubscriptionPackage; Insert: Omit<SubscriptionPackage, 'id' | 'created_at'>; Update: Partial<Omit<SubscriptionPackage, 'id' | 'created_at'>> };
      invoices: { Row: Invoice; Insert: Omit<Invoice, 'uuid' | 'id' | 'created_at'>; Update: Partial<Omit<Invoice, 'uuid' | 'id' | 'created_at'>> };
      discounts: { Row: Discount; Insert: Omit<Discount, 'id' | 'created_at' | 'member_ids' | 'invoice_ids'>; Update: Partial<Omit<Discount, 'id' | 'created_at' | 'member_ids' | 'invoice_ids'>> };
      coaches: { Row: Coach; Insert: Omit<Coach, 'id' | 'created_at'>; Update: Partial<Omit<Coach, 'id' | 'created_at'>> };
      leads: { Row: Lead; Insert: Omit<Lead, 'id' | 'created_at'>; Update: Partial<Omit<Lead, 'id' | 'created_at'>> };
      expenses: { Row: Expense; Insert: Omit<Expense, 'id' | 'created_at'>; Update: Partial<Omit<Expense, 'id' | 'created_at'>> };
      liabilities: { Row: Liability; Insert: Omit<Liability, 'id' | 'created_at'>; Update: Partial<Omit<Liability, 'id' | 'created_at'>> };
      audit_logs: { Row: AuditLog; Insert: Omit<AuditLog, 'id'>; Update: never };
      check_ins: { Row: CheckIn; Insert: Omit<CheckIn, 'id' | 'created_at'>; Update: never };
      coach_check_ins: { Row: CoachCheckIn; Insert: Omit<CoachCheckIn, 'id' | 'created_at'>; Update: never };
      classes: { Row: Class; Insert: Omit<Class, 'id' | 'created_at' | 'sport_name' | 'coach_name'>; Update: Partial<Omit<Class, 'id' | 'created_at' | 'sport_name' | 'coach_name'>> };
      sports: { Row: Sport; Insert: Omit<Sport, 'id' | 'created_at'>; Update: Partial<Omit<Sport, 'id' | 'created_at'>> };
      discount_members: { Row: DiscountMember; Insert: DiscountMember; Update: never };
      discount_invoices: { Row: DiscountInvoice; Insert: DiscountInvoice; Update: never };
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
