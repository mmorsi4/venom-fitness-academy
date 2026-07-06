import fs from 'fs';
const path = 'src/lib/utils.ts';
let content = fs.readFileSync(path, 'utf8');

const replacement = `
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
    // We assume if they took advances, that's part of what was "paid so far".
    paidAmount = paidPt + paidSub + totalAdvances;

  } else if (coach.payment_type === 'per_session') {
    const groupAmount = (unpaidGroupMain.length + unpaidGroupSub.length) * coach.rate;
    baseAmount = groupAmount;
    deduction = 0;
    finalAmount = baseAmount + ptAmount; 

    expectedAmount = (groupCheckInsAsMain.length + groupCheckInsAsSub.length) * coach.rate + (ptCheckIns.length * (coach.pt_rate || 250));
    paidAmount = (paidGroupMain.length + groupCheckInsAsSub.filter(ci => ci.is_paid).length) * coach.rate + (ptCheckIns.filter(ci => ci.is_paid).length * (coach.pt_rate || 250)) + totalAdvances;
  }
  finalAmount = Math.max(0, finalAmount - totalAdvances);
  
  return {
    ...coach,
    scheduledSlotsInMonth,
    attendedSessions,
    missedSessions,
    baseAmount,
    deduction,
    totalAdvances,
    calculatedAmount: Math.round(finalAmount),
    expectedAmount: Math.round(expectedAmount),
    paidAmount: Math.round(paidAmount),
    ptCheckIns: ptCheckIns.length,
    subCheckIns: groupCheckInsAsSub.length,
    unpaidCheckInIds: [...unpaidGroupMain, ...unpaidGroupSub, ...unpaidPtCheckIns].map(ci => ci.id)
  };
`;

const startIndex = content.indexOf('const ptAmount = unpaidPtCheckIns.length');
const endIndex = content.indexOf('export function calculateIncomeByMethod');

if (startIndex !== -1 && endIndex !== -1) {
  content = content.substring(0, startIndex) + replacement.trim() + '\n}\n\n' + content.substring(endIndex);
  fs.writeFileSync(path, content, 'utf8');
} else {
  console.log("Could not find targets");
}
