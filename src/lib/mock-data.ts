export type MemberStatus = 'active' | 'expired' | 'expiring_soon' | 'has_debt';
export type Gender = 'male' | 'female' | 'other';

export interface Member {
  id: string;
  name: string;
  phone: string;
  parentPhone?: string;
  birthDate?: string;
  gender?: Gender;
  source: string;
  status: MemberStatus;
  sessionsRemaining: number;
  totalSessions: number;
  expiresAt: string;
  memberSince: string;
  packageName: string;
  assignedCoach?: string;
  freezeDaysUsed?: number;
  freezeDaysTotal?: number;
}

export interface SubscriptionPackage {
  id: string;
  name: string;
  sessions: number;
  price: number;
  validityDays: number;
  freezeDays: number;
  invitations: number;
  inBodySessions: number;
}

export interface Invoice {
  id: string;
  memberId: string;
  memberName: string;
  packageId: string;
  packageName: string;
  discountId?: string;
  discountGroupId?: string;
  discountDescription?: string;
  discountAmount: number;
  totalAmount: number;
  paidAmount: number;
  status: 'paid' | 'partial' | 'unpaid';
  paymentMethod: string;
  createdAt: string;
}

export interface Discount {
  id: string;
  name: string;
  type: 'seasonal' | 'manual';
  discountType: 'fixed' | 'percentage';
  value: number;
  memberIds: string[];
  invoiceIds: string[];
  active: boolean;
}

export interface Coach {
  id: string;
  name: string;
  paymentType: 'salary' | 'per_session' | 'commission';
  rate: number;
  commissionBase?: 'revenue' | 'members';
  checkedInToday: boolean;
  sessionsThisMonth: number;
}

export interface Lead {
  id: string;
  name: string;
  phone: string;
  source: string;
  status: 'New' | 'Contacted' | 'Follow-up' | 'Converted' | 'Lost';
  notes: string[];
  followUpDate: string;
  assignedTo: string;
  callsMade: number;
}

export interface AuditLog {
  id: string;
  action: string;
  actionType: 'override_checkin' | 'edit_payment' | 'apply_discount' | 'remove_discount' | 'checkin' | 'other';
  performedBy: string;
  memberId?: string;
  memberName?: string;
  timestamp: string;
  details: string;
}

export interface Expense {
  id: string;
  category: string;
  amount: number;
  description: string;
  date: string;
  liabilityId?: string;
}

export interface GymSession {
  id: string;
  name: string;
  dayOfWeek: string;
  time: string;
  attendanceCount: number;
  capacity: number;
  coachName: string;
}

export interface Liability {
  id: string;
  name: string;
  description: string;
  type: 'installment' | 'one_time';
  totalAmount: number;
  paidAmount: number;
  installmentAmount: number;
  frequencyDays: number;
  nextDueDate: string;
  notifyDaysBefore: number;
  isComplete: boolean;
  createdAt: string;
}

const d = (daysFromNow: number) =>
  new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000).toISOString();

export const MOCK_MEMBERS: Member[] = [
  {
    id: "M001", name: "Ahmed Al-Rashid", phone: "055-0101", parentPhone: "055-0100",
    birthDate: "1998-03-15", gender: "male", source: "Walk-in", status: "active",
    sessionsRemaining: 8, totalSessions: 12, expiresAt: d(14), memberSince: d(-60),
    packageName: "12 Sessions", assignedCoach: "Alex Turner", freezeDaysUsed: 0, freezeDaysTotal: 7,
  },
  {
    id: "M002", name: "Nour Hassan", phone: "055-0102", parentPhone: "055-0109",
    birthDate: "2002-07-22", gender: "female", source: "Instagram", status: "expiring_soon",
    sessionsRemaining: 2, totalSessions: 8, expiresAt: d(2), memberSince: d(-30),
    packageName: "8 Sessions", assignedCoach: "Bella Nour", freezeDaysUsed: 3, freezeDaysTotal: 7,
  },
  {
    id: "M003", name: "Kareem Mansour", phone: "055-0103",
    birthDate: "1995-11-08", gender: "male", source: "Referral", status: "expired",
    sessionsRemaining: 0, totalSessions: 12, expiresAt: d(-5), memberSince: d(-90),
    packageName: "12 Sessions", assignedCoach: "Chris Maged", freezeDaysUsed: 0, freezeDaysTotal: 7,
  },
  {
    id: "M004", name: "Sara Al-Fahed", phone: "055-0104", parentPhone: "055-0111",
    birthDate: "2001-01-30", gender: "female", source: "Facebook", status: "has_debt",
    sessionsRemaining: 10, totalSessions: 12, expiresAt: d(25), memberSince: d(-5),
    packageName: "12 Sessions", assignedCoach: "Bella Nour", freezeDaysUsed: 0, freezeDaysTotal: 7,
  },
  {
    id: "M005", name: "Layla Ibrahim", phone: "055-0105",
    birthDate: "1999-05-14", gender: "female", source: "WhatsApp", status: "active",
    sessionsRemaining: 6, totalSessions: 8, expiresAt: d(18), memberSince: d(-15),
    packageName: "8 Sessions", assignedCoach: "Bella Nour", freezeDaysUsed: 0, freezeDaysTotal: 7,
  },
  {
    id: "M006", name: "Omar Khalil", phone: "055-0106",
    birthDate: "1993-09-03", gender: "male", source: "Walk-in", status: "active",
    sessionsRemaining: 999, totalSessions: 999, expiresAt: d(20), memberSince: d(-10),
    packageName: "Unlimited Monthly", assignedCoach: "Alex Turner", freezeDaysUsed: 2, freezeDaysTotal: 14,
  },
  {
    id: "M007", name: "Rania Saleh", phone: "055-0107", parentPhone: "055-0120",
    birthDate: "2003-12-19", gender: "female", source: "Instagram", status: "expiring_soon",
    sessionsRemaining: 1, totalSessions: 12, expiresAt: d(1), memberSince: d(-45),
    packageName: "12 Sessions", assignedCoach: "Alex Turner", freezeDaysUsed: 0, freezeDaysTotal: 7,
  },
  {
    id: "M008", name: "Hassan Yousef", phone: "055-0108",
    birthDate: "1990-06-25", gender: "male", source: "Referral", status: "expired",
    sessionsRemaining: 2, totalSessions: 12, expiresAt: d(-3), memberSince: d(-75),
    packageName: "12 Sessions", assignedCoach: "Chris Maged", freezeDaysUsed: 7, freezeDaysTotal: 7,
  },
];

export const MOCK_PACKAGES: SubscriptionPackage[] = [
  { id: "P01", name: "8 Sessions", sessions: 8, price: 350, validityDays: 30, freezeDays: 7, invitations: 1, inBodySessions: 1 },
  { id: "P02", name: "12 Sessions", sessions: 12, price: 480, validityDays: 30, freezeDays: 7, invitations: 2, inBodySessions: 2 },
  { id: "P03", name: "Unlimited Monthly", sessions: 999, price: 700, validityDays: 30, freezeDays: 14, invitations: 3, inBodySessions: 2 },
  { id: "P04", name: "16 Sessions", sessions: 16, price: 580, validityDays: 45, freezeDays: 10, invitations: 2, inBodySessions: 2 },
];

export const MOCK_INVOICES: Invoice[] = [
  { id: "INV-1001", memberId: "M001", memberName: "Ahmed Al-Rashid", packageId: "P02", packageName: "12 Sessions", discountAmount: 0, totalAmount: 480, paidAmount: 480, status: "paid", paymentMethod: "Visa", createdAt: d(-15) },
  { id: "INV-1002", memberId: "M004", memberName: "Sara Al-Fahed", packageId: "P02", packageName: "12 Sessions", discountGroupId: "D01", discountDescription: "Ramadan promotion", discountAmount: 50, totalAmount: 480, paidAmount: 200, status: "partial", paymentMethod: "Cash", createdAt: d(-5) },
  { id: "INV-1003", memberId: "M005", memberName: "Layla Ibrahim", packageId: "P01", packageName: "8 Sessions", discountAmount: 0, totalAmount: 350, paidAmount: 350, status: "paid", paymentMethod: "InstaPay", createdAt: d(-15) },
  { id: "INV-1004", memberId: "M006", memberName: "Omar Khalil", packageId: "P03", packageName: "Unlimited Monthly", discountGroupId: "D01", discountDescription: "Ramadan promotion", discountAmount: 70, totalAmount: 700, paidAmount: 0, status: "unpaid", paymentMethod: "Cash", createdAt: d(-10) },
  { id: "INV-1005", memberId: "M007", memberName: "Rania Saleh", packageId: "P02", packageName: "12 Sessions", discountAmount: 0, totalAmount: 480, paidAmount: 480, status: "paid", paymentMethod: "Visa", createdAt: d(-45) },
  { id: "INV-1006", memberId: "M002", memberName: "Nour Hassan", packageId: "P01", packageName: "8 Sessions", discountAmount: 0, totalAmount: 350, paidAmount: 350, status: "paid", paymentMethod: "Cash", createdAt: d(0) },
];

export const MOCK_DISCOUNTS: Discount[] = [
  { id: "D01", name: "Ramadan Special 2025", type: "seasonal", discountType: "percentage", value: 15, memberIds: ["M004", "M006"], invoiceIds: ["INV-1002", "INV-1004"], active: true },
  { id: "D02", name: "Couples Discount", type: "manual", discountType: "fixed", value: 50, memberIds: ["M001", "M005"], invoiceIds: ["INV-1001", "INV-1003"], active: true },
];

export const MOCK_COACHES: Coach[] = [
  { id: "C01", name: "Alex Turner", paymentType: "salary", rate: 3000, checkedInToday: true, sessionsThisMonth: 22 },
  { id: "C02", name: "Bella Nour", paymentType: "per_session", rate: 80, checkedInToday: false, sessionsThisMonth: 18 },
  { id: "C03", name: "Chris Maged", paymentType: "commission", rate: 10, commissionBase: "revenue", checkedInToday: true, sessionsThisMonth: 25 },
];

export const MOCK_LEADS: Lead[] = [
  { id: "L01", name: "David Miller", phone: "055-0201", source: "Instagram", status: "New", notes: [], followUpDate: d(1), assignedTo: "Reception", callsMade: 0 },
  { id: "L02", name: "Emma Al-Sayed", phone: "055-0202", source: "Walk-in", status: "Contacted", notes: ["Interested in unlimited package", "Wants trial session"], followUpDate: d(2), assignedTo: "Reception", callsMade: 2 },
  { id: "L03", name: "Firas Nabil", phone: "055-0203", source: "Facebook", status: "Follow-up", notes: ["Budget concern", "Offered discount"], followUpDate: d(0), assignedTo: "Sales", callsMade: 3 },
  { id: "L04", name: "Ghada Farouk", phone: "055-0204", source: "Referral", status: "Converted", notes: ["Converted to 12 sessions package"], followUpDate: d(-1), assignedTo: "Reception", callsMade: 1 },
  { id: "L05", name: "Hana Ziad", phone: "055-0205", source: "WhatsApp", status: "Lost", notes: ["Went with competitor"], followUpDate: d(-5), assignedTo: "Sales", callsMade: 4 },
];

export const MOCK_AUDIT: AuditLog[] = [
  { id: "A01", action: "Override Check-in", actionType: "override_checkin", performedBy: "Admin", memberId: "M003", memberName: "Kareem Mansour", timestamp: new Date().toISOString(), details: "Allowed expired member M003 (Kareem Mansour) to attend" },
  { id: "A02", action: "Edit Payment", actionType: "edit_payment", performedBy: "Reception", timestamp: new Date(Date.now() - 3600000).toISOString(), details: "Updated INV-1002: partial payment recorded, amount 200 EGP" },
  { id: "A03", action: "Apply Discount", actionType: "apply_discount", performedBy: "Admin", timestamp: new Date(Date.now() - 86400000).toISOString(), details: "Applied Ramadan Special 2025 (15%) to INV-1004" },
  { id: "A04", action: "Check-in", actionType: "checkin", performedBy: "Reception", memberId: "M001", memberName: "Ahmed Al-Rashid", timestamp: new Date(Date.now() - 1800000).toISOString(), details: "Normal check-in: M001 (Ahmed Al-Rashid), session deducted (8 remaining)" },
  { id: "A05", action: "Check-in", actionType: "checkin", performedBy: "Reception", memberId: "M005", memberName: "Layla Ibrahim", timestamp: new Date(Date.now() - 5400000).toISOString(), details: "Normal check-in: M005 (Layla Ibrahim), session deducted (6 remaining)" },
];

export const MOCK_EXPENSES: Expense[] = [
  { id: "E01", category: "Salaries", amount: 12000, description: "Monthly coach salaries", date: new Date(Date.now() - 5 * 86400000).toISOString() },
  { id: "E02", category: "Maintenance", amount: 450, description: "Treadmill belt replacement", date: new Date(Date.now() - 3 * 86400000).toISOString() },
  { id: "E03", category: "Government Bills", amount: 1200, description: "Electricity bill", date: new Date(Date.now() - 8 * 86400000).toISOString() },
  { id: "E04", category: "Purchases", amount: 800, description: "Resistance bands restock", date: new Date().toISOString() },
];

export const MOCK_SESSIONS: GymSession[] = [
  { id: "S01", name: "Morning HIIT", dayOfWeek: "Sunday", time: "07:00", attendanceCount: 18, capacity: 20, coachName: "Alex Turner" },
  { id: "S02", name: "Yoga Flow", dayOfWeek: "Sunday", time: "09:00", attendanceCount: 12, capacity: 15, coachName: "Bella Nour" },
  { id: "S03", name: "Strength Training", dayOfWeek: "Monday", time: "07:00", attendanceCount: 15, capacity: 20, coachName: "Chris Maged" },
  { id: "S04", name: "Spin Class", dayOfWeek: "Monday", time: "18:00", attendanceCount: 20, capacity: 20, coachName: "Alex Turner" },
  { id: "S05", name: "Boxing", dayOfWeek: "Tuesday", time: "07:00", attendanceCount: 10, capacity: 12, coachName: "Chris Maged" },
  { id: "S06", name: "Pilates", dayOfWeek: "Wednesday", time: "09:00", attendanceCount: 8, capacity: 12, coachName: "Bella Nour" },
  { id: "S07", name: "CrossFit", dayOfWeek: "Thursday", time: "07:00", attendanceCount: 16, capacity: 20, coachName: "Alex Turner" },
  { id: "S08", name: "Evening HIIT", dayOfWeek: "Thursday", time: "19:00", attendanceCount: 19, capacity: 20, coachName: "Chris Maged" },
  { id: "S09", name: "Morning HIIT", dayOfWeek: "Saturday", time: "08:00", attendanceCount: 14, capacity: 20, coachName: "Alex Turner" },
  { id: "S10", name: "Open Gym", dayOfWeek: "Friday", time: "10:00", attendanceCount: 22, capacity: 30, coachName: "Bella Nour" },
];

export const MOCK_LIABILITIES: Liability[] = [
  {
    id: "LB01", name: "Commercial Treadmill Set", description: "8 commercial treadmills purchased for cardio zone",
    type: "installment", totalAmount: 24000, paidAmount: 6000,
    installmentAmount: 2000, frequencyDays: 30,
    nextDueDate: new Date(Date.now() + 3 * 86400000).toISOString(),
    notifyDaysBefore: 5, isComplete: false, createdAt: d(-90),
  },
  {
    id: "LB02", name: "AC System Upgrade", description: "Full HVAC upgrade for main gym floor",
    type: "one_time", totalAmount: 8500, paidAmount: 0,
    installmentAmount: 8500, frequencyDays: 0,
    nextDueDate: new Date(Date.now() + 12 * 86400000).toISOString(),
    notifyDaysBefore: 5, isComplete: false, createdAt: d(-10),
  },
  {
    id: "LB03", name: "Reception Renovation", description: "New reception desk, chairs, and lighting",
    type: "installment", totalAmount: 15000, paidAmount: 7500,
    installmentAmount: 2500, frequencyDays: 30,
    nextDueDate: new Date(Date.now() + 18 * 86400000).toISOString(),
    notifyDaysBefore: 5, isComplete: false, createdAt: d(-90),
  },
];
