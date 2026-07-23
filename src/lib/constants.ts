export const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
export type DayOfWeek = typeof DAYS_OF_WEEK[number];

export const PAYMENT_METHODS = ["Cash", "Visa", "InstaPay", "Split"] as const;
export const PAYMENT_METHODS_NO_SPLIT = ["Cash", "Visa", "InstaPay"] as const;

export const EXPENSE_BASE_CATEGORIES = ["Government Bills", "Maintenance", "Salaries", "Coach Loan", "Purchases", "Other"] as const;
export const LIABILITY_CATEGORY = "Liability Payment";

export const LEAD_SOURCES = ["Walk-in", "Referral", "Facebook", "Instagram", "WhatsApp", "Invitation"] as const;
export const LEAD_STATUSES = ["New", "Contacted", "Follow-up", "Converted", "Invited", "Lost"] as const;
