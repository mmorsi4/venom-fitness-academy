import fs from 'fs';
const memPath = 'src/pages/Members.tsx';
let memContent = fs.readFileSync(memPath, 'utf8');

memContent = memContent.replace(
  'const { data: members = [] } = useMembers();',
  'const { data: members = [] } = useMembers();\n  const { data: invoices = [] } = useInvoices();'
);
fs.writeFileSync(memPath, memContent, 'utf8');
