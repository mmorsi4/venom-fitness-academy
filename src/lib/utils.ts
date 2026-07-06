import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { eachDayOfInterval, startOfMonth, endOfMonth, isBefore, startOfDay, format } from "date-fns"
import type { Coach, Class, CoachCheckIn, Invoice, PaymentMethod, CoachDeduction, Expense } from "./types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function calculateCoachPayroll(
  coach: Coach,
  month: number, // 0-indexed
  year: number,
  classes: Class[],
  checkInsThisMonth: CoachCheckIn[],
  revenue: number,
  newMembersCount: number,
  deductions: CoachDeduction[] = []
) {
  const start = startOfMonth(new Date(year, month));
  const end = endOfMonth(start);
  const allDays = eachDayOfInterval({ start, end });
  const today = startOfDay(new Date());

  const coachDeductions = deductions.filter(d => d.coach_id === coach.id);
  const netAdjustment = coachDeductions.reduce((s, d) => s + d.amount, 0);
  const totalForgivenSessions = coachDeductions.reduce((s, d) => s + d.forgiven_sessions, 0);

  const coachClasses = classes.filter(c => c.coach_id === coach.id);
  
  let scheduledSlotsInMonth = 0;
  let missedSessions = 0;
  
  const checkInCountsByDate: Record<string, number> = {};
  
  const ptCheckIns = checkInsThisMonth.filter(ci => ci.coach_id === coach.id && ci.session_type === 'pt');
  const groupCheckInsAsSub = checkInsThisMonth.filter(ci => ci.coach_id === coach.id && ci.session_type === 'group' && ci.is_substitute);
  const groupCheckInsAsMain = checkInsThisMonth.filter(ci => ci.coach_id === coach.id && ci.session_type === 'group' && !ci.is_substitute);

  const unpaidGroupMain = groupCheckInsAsMain.filter(ci => !ci.is_paid);
  const paidGroupMain = groupCheckInsAsMain.filter(ci => ci.is_paid);
  const attendedSessions = unpaidGroupMain.length;

  const unpaidGroupSub = groupCheckInsAsSub.filter(ci => !ci.is_paid);
  const unpaidPtCheckIns = ptCheckIns.filter(ci => !ci.is_paid);

  groupCheckInsAsMain.forEach(ci => {
    const d = ci.check_in_date.split('T')[0];
    checkInCountsByDate[d] = (checkInCountsByDate[d] || 0) + 1;
  });

  allDays.forEach(day => {
    const dayName = DAYS[day.getDay()];
    let slotsForDay = 0;
    coachClasses.forEach(c => {
      slotsForDay += c.schedules.filter(s => s.day === dayName).length;
    });
    
    scheduledSlotsInMonth += slotsForDay;
    
    if (isBefore(day, today)) {
      const dateString = format(day, 'yyyy-MM-dd');
      const checkInsOnDay = checkInCountsByDate[dateString] || 0;
      
      const missing = slotsForDay - checkInsOnDay;
      if (missing > 0) {
        missedSessions += missing;
      }
    }
  });

  let baseAmount = 0;
  const originalScheduledSlots = scheduledSlotsInMonth;
  scheduledSlotsInMonth = Math.max(0, scheduledSlotsInMonth - paidGroupMain.length);
  let deduction = 0;
  let finalAmount = 0;
  
  const ptAmount = unpaidPtCheckIns.length * (coach.pt_rate || 250);

  missedSessions = Math.max(0, missedSessions - totalForgivenSessions);

  let expectedAmount = 0;
  let paidAmount = 0;

  if (coach.payment_type === 'salary') {
    baseAmount = coach.rate;
    const perSessionRate = originalScheduledSlots > 0 ? (coach.rate / originalScheduledSlots) : 0;
    
    deduction = missedSessions * perSessionRate;
    const subExtraPay = unpaidGroupSub.length * perSessionRate;
    
    finalAmount = Math.max(0, baseAmount - deduction) + subExtraPay + ptAmount;

    expectedAmount = coach.rate + (groupCheckInsAsSub.length * perSessionRate) + (ptCheckIns.length * (coach.pt_rate || 250));
    // Paid amount for salary coaches is hard to derive just from checkins because base salary is paid as a lump sum.
    // For now, we calculate paid based on the value of paid checkins plus any advances.
    const paidPt = ptCheckIns.filter(ci => ci.is_paid).length * (coach.pt_rate || 250);
    const paidSub = groupCheckInsAsSub.filter(ci => ci.is_paid).length * perSessionRate;
    // Net adjustment (bonuses - deductions) is effectively an adjustment to what they are owed.
    // So if they had a deduction (negative), it lowers what they are owed.
    paidAmount = paidPt + paidSub - netAdjustment;

  } else if (coach.payment_type === 'per_session') {
    const groupAmount = (unpaidGroupMain.length + unpaidGroupSub.length) * coach.rate;
    baseAmount = groupAmount;
    deduction = 0;
    finalAmount = baseAmount + ptAmount; 

    expectedAmount = (groupCheckInsAsMain.length + groupCheckInsAsSub.length) * coach.rate + (ptCheckIns.length * (coach.pt_rate || 250));
    paidAmount = (paidGroupMain.length + groupCheckInsAsSub.filter(ci => ci.is_paid).length) * coach.rate + (ptCheckIns.filter(ci => ci.is_paid).length * (coach.pt_rate || 250)) - netAdjustment;
  }
  finalAmount = Math.max(0, finalAmount + netAdjustment);
  
  return {
    ...coach,
    scheduledSlotsInMonth,
    attendedSessions,
    missedSessions,
    baseAmount,
    deduction,
    netAdjustment,
    calculatedAmount: Math.round(finalAmount),
    expectedAmount: Math.round(expectedAmount),
    paidAmount: Math.round(paidAmount),
    ptCheckIns: ptCheckIns.length,
    subCheckIns: groupCheckInsAsSub.length,
    unpaidCheckInIds: [...unpaidGroupMain, ...unpaidGroupSub, ...unpaidPtCheckIns].map(ci => ci.id)
  };
}

export function calculateIncomeByMethod(invoices: Invoice[], method: PaymentMethod): number {
  return invoices.reduce((sum, inv) => {
    if (inv.payment_method === 'Split' && inv.split_payments) {
      return sum + inv.split_payments.filter(sp => sp.method === method).reduce((s, sp) => s + sp.amount, 0);
    }
    if (inv.payment_method === method) {
      return sum + inv.paid_amount;
    }
    return sum;
  }, 0);
}

export function calculateExpenseByMethod(expenses: Expense[], method: PaymentMethod): number {
  return expenses.reduce((sum, exp) => {
    if (exp.payment_method === 'Split' && exp.split_payments) {
      return sum + exp.split_payments.filter((sp: any) => sp.method === method).reduce((s: any, sp: any) => s + sp.amount, 0);
    }
    if (exp.payment_method === method) {
      return sum + exp.amount;
    }
    return sum;
  }, 0);
}
