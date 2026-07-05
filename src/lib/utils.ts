import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { eachDayOfInterval, startOfMonth, endOfMonth, isBefore, startOfDay, format } from "date-fns"
import type { Coach, Class, CoachCheckIn, Invoice, PaymentMethod } from "./types"

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
  newMembersCount: number
) {
  const start = startOfMonth(new Date(year, month));
  const end = endOfMonth(start);
  const allDays = eachDayOfInterval({ start, end });
  const today = startOfDay(new Date());

  const coachClasses = classes.filter(c => c.coach_id === coach.id);
  
  let scheduledSlotsInMonth = 0;
  let missedSessions = 0;
  
  // A helper map to quickly find check-ins for this coach by date string (yyyy-MM-dd)
  const checkInCountsByDate: Record<string, number> = {};
  checkInsThisMonth.forEach(ci => {
    if (ci.coach_id === coach.id) {
      const d = ci.check_in_date.split('T')[0];
      checkInCountsByDate[d] = (checkInCountsByDate[d] || 0) + 1;
    }
  });

  const attendedSessions = checkInsThisMonth.filter(ci => ci.coach_id === coach.id).length;

  allDays.forEach(day => {
    const dayName = DAYS[day.getDay()];
    
    // How many slots scheduled for this day?
    let slotsForDay = 0;
    coachClasses.forEach(c => {
      slotsForDay += c.schedules.filter(s => s.day === dayName).length;
    });
    
    scheduledSlotsInMonth += slotsForDay;
    
    // Deductions only apply to days strictly BEFORE today
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
  let deduction = 0;
  let finalAmount = 0;
  
  if (coach.payment_type === 'salary') {
    baseAmount = coach.rate;
    if (scheduledSlotsInMonth > 0) {
      const deductionPerSession = coach.rate / scheduledSlotsInMonth;
      deduction = missedSessions * deductionPerSession;
    }
    finalAmount = Math.max(0, baseAmount - deduction);
  } else if (coach.payment_type === 'per_session') {
    // For per session, they only get paid for attended sessions
    baseAmount = coach.rate * attendedSessions;
    deduction = 0;
    finalAmount = baseAmount; 
  }
  
  return {
    ...coach,
    scheduledSlotsInMonth,
    attendedSessions,
    missedSessions,
    baseAmount,
    deduction,
    calculatedAmount: Math.round(finalAmount),
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
