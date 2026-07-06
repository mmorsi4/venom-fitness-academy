import fs from 'fs';

// Fix utils.ts
const utilsPath = 'src/lib/utils.ts';
let utilsContent = fs.readFileSync(utilsPath, 'utf8');
utilsContent = utilsContent.replace(
  `const subExtraPay = unpaidGroupSub.length * perSessionRate;`,
  `const unpaidGroupSub = groupCheckInsAsSub.filter(ci => !ci.is_paid);
  const subExtraPay = unpaidGroupSub.length * perSessionRate;`
);
// Make sure we didn't duplicate it. Wait, previously I replaced:
// content.replace( `const subExtraPay = groupCheckInsAsSub.length * perSessionRate;`, ...)
// Let's just do a clean fix for utils.ts.
