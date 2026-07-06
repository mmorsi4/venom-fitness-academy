import fs from 'fs';
const path = 'src/lib/utils.ts';
let content = fs.readFileSync(path, 'utf8');

// Move unpaidGroupSub up
content = content.replace(
  `  const unpaidGroupMain = groupCheckInsAsMain.filter(ci => !ci.is_paid);`,
  `  const unpaidGroupMain = groupCheckInsAsMain.filter(ci => !ci.is_paid);
  const unpaidGroupSub = groupCheckInsAsSub.filter(ci => !ci.is_paid);`
);

content = content.replace(
  `    const unpaidGroupSub = groupCheckInsAsSub.filter(ci => !ci.is_paid);
  const subExtraPay = unpaidGroupSub.length * perSessionRate;`,
  `    const subExtraPay = unpaidGroupSub.length * perSessionRate;`
);

fs.writeFileSync(path, content, 'utf8');
