import fs from 'fs';
const path = 'src/lib/utils.ts';
let content = fs.readFileSync(path, 'utf8');

// Replace attendedSessions and scheduledSlots calculation
content = content.replace(
  `const attendedSessions = groupCheckInsAsMain.length;`,
  `const unpaidGroupMain = groupCheckInsAsMain.filter(ci => !ci.is_paid);
  const paidGroupMain = groupCheckInsAsMain.filter(ci => ci.is_paid);
  const attendedSessions = unpaidGroupMain.length;`
);

content = content.replace(
  `const ptAmount = ptCheckIns.length * (coach.pt_rate || 250);`,
  `const unpaidPtCheckIns = ptCheckIns.filter(ci => !ci.is_paid);
  const ptAmount = unpaidPtCheckIns.length * (coach.pt_rate || 250);`
);

content = content.replace(
  `const subExtraPay = groupCheckInsAsSub.length * perSessionRate;`,
  `const unpaidGroupSub = groupCheckInsAsSub.filter(ci => !ci.is_paid);
  const subExtraPay = unpaidGroupSub.length * perSessionRate;`
);

content = content.replace(
  `const groupAmount = (groupCheckInsAsMain.length + groupCheckInsAsSub.length) * coach.rate;`,
  `const groupAmount = (unpaidGroupMain.length + unpaidGroupSub.length) * coach.rate;`
);

content = content.replace(
  `  let baseAmount = 0;`,
  `  let baseAmount = 0;
  const originalScheduledSlots = scheduledSlotsInMonth;
  scheduledSlotsInMonth = Math.max(0, scheduledSlotsInMonth - paidGroupMain.length);`
);

content = content.replace(
  `const perSessionRate = scheduledSlotsInMonth > 0 ? (coach.rate / scheduledSlotsInMonth) : 0;`,
  `const perSessionRate = originalScheduledSlots > 0 ? (coach.rate / originalScheduledSlots) : 0;`
);

content = content.replace(
  `    ...coach,
    scheduledSlotsInMonth,`,
  `    ...coach,
    scheduledSlotsInMonth,
    unpaidCheckInIds: [...unpaidGroupMain, ...unpaidGroupSub, ...unpaidPtCheckIns].map(ci => ci.id),`
);

fs.writeFileSync(path, content, 'utf8');
