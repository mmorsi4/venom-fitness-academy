import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { eachDayOfInterval, startOfMonth, endOfMonth, isBefore, startOfDay, format } from "date-fns"
import type { Coach, Class, CoachCheckIn, Invoice, PaymentMethod, CoachDeduction, Expense, ClassScheduleOverride } from "./types"
import { DAYS_OF_WEEK } from "./constants"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function validateEgyptPhone(phone: string): boolean {
  return /^\d{11}$/.test(phone.trim());
}

export function calculateCoachPayroll(
  coach: Coach,
  month: number, // 0-indexed
  year: number,
  classes: Class[],
  checkInsThisMonth: CoachCheckIn[],
  revenue: number,
  newMembersCount: number,
  deductions: CoachDeduction[] = [],
  scheduleOverrides: ClassScheduleOverride[] = []
) {
  const start = startOfMonth(new Date(year, month));
  const end = endOfMonth(start);
  const allDays = eachDayOfInterval({ start, end });
  const today = startOfDay(new Date());

  const coachDeductions = deductions.filter(d => {
    if (d.coach_id !== coach.id) return false;
    const dDate = new Date(d.date);
    return dDate.getMonth() === month && dDate.getFullYear() === year;
  });
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
    const dayName = DAYS_OF_WEEK[day.getDay()];
    const dateString = format(day, 'yyyy-MM-dd');
    let slotsForDay = 0;
    
    coachClasses.forEach(c => {
      let classSlots = c.schedules.filter(s => s.day === dayName).length;
      
      const overrides = scheduleOverrides.filter(o => o.class_id === c.id);
      const cancelledOrPostponedToday = overrides.filter(o => o.original_date === dateString && (o.status === 'cancelled' || o.status === 'postponed')).length;
      const postponedToToday = overrides.filter(o => o.status === 'postponed' && o.new_date === dateString).length;

      classSlots = classSlots - cancelledOrPostponedToday + postponedToToday;
      slotsForDay += Math.max(0, classSlots);
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
  
  const ptPct = coach.pt_percentage ?? 100;
  const actualPtRate = (coach.pt_rate || 250) * (ptPct / 100);

  const ptAmount = unpaidPtCheckIns.length * actualPtRate;

  missedSessions = Math.max(0, missedSessions - totalForgivenSessions);

  let expectedAmount = 0;
  let paidAmount = 0;

  if (coach.payment_type === 'salary') {
    baseAmount = coach.rate;
    const perSessionRate = originalScheduledSlots > 0 ? (coach.rate / originalScheduledSlots) : 0;
    
    deduction = missedSessions * perSessionRate;
    const subExtraPay = unpaidGroupSub.length * perSessionRate;
    
    finalAmount = Math.max(0, baseAmount - deduction) + subExtraPay + ptAmount;

    expectedAmount = coach.rate + (groupCheckInsAsSub.length * perSessionRate) + (ptCheckIns.length * actualPtRate);
    const paidPt = ptCheckIns.filter(ci => ci.is_paid).length * actualPtRate;
    const paidSub = groupCheckInsAsSub.filter(ci => ci.is_paid).length * perSessionRate;
    paidAmount = paidPt + paidSub - netAdjustment;

  } else if (coach.payment_type === 'per_session') {
    const groupAmount = (unpaidGroupMain.length + unpaidGroupSub.length) * coach.rate;
    baseAmount = groupAmount;
    deduction = 0;
    finalAmount = baseAmount + ptAmount; 

    expectedAmount = (groupCheckInsAsMain.length + groupCheckInsAsSub.length) * coach.rate + (ptCheckIns.length * actualPtRate);
    paidAmount = (paidGroupMain.length + groupCheckInsAsSub.filter(ci => ci.is_paid).length) * coach.rate + (ptCheckIns.filter(ci => ci.is_paid).length * actualPtRate) - netAdjustment;
  }
  finalAmount = Math.max(0, finalAmount + netAdjustment);
  
  const advanceBalance = coach.advance_balance || 0;
  const originalFinalAmount = finalAmount;
  finalAmount = Math.max(0, finalAmount - advanceBalance);

  return {
    ...coach,
    scheduledSlotsInMonth,
    attendedSessions,
    missedSessions,
    baseAmount,
    deduction,
    netAdjustment,
    ptAmount,
    calculatedAmount: Math.round(finalAmount),
    expectedAmount: Math.round(expectedAmount),
    paidAmount: Math.round(paidAmount),
    ptCheckIns: unpaidPtCheckIns.length,
    subCheckIns: unpaidGroupSub.length,
    unpaidCheckInIds: [...unpaidGroupMain, ...unpaidGroupSub, ...unpaidPtCheckIns].map(ci => ci.id),
    advanceBalanceOffset: originalFinalAmount - finalAmount
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
