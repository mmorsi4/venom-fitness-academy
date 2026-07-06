import fs from 'fs';

// Fix Invoices.tsx state
const invPath = 'src/pages/Invoices.tsx';
let invContent = fs.readFileSync(invPath, 'utf8');
if (!invContent.includes('const [paymentCustomId, setPaymentCustomId]')) {
  invContent = invContent.replace(
    'const [paymentMethod, setPaymentMethod] = useState<string>("Cash");',
    'const [paymentMethod, setPaymentMethod] = useState<string>("Cash");\n  const [paymentCustomId, setPaymentCustomId] = useState<string>("");\n  const [paymentDate, setPaymentDate] = useState<string>("");'
  );
  fs.writeFileSync(invPath, invContent, 'utf8');
}

// Fix Members.tsx invoices
const memPath = 'src/pages/Members.tsx';
let memContent = fs.readFileSync(memPath, 'utf8');
if (!memContent.includes('useInvoices()')) {
  memContent = memContent.replace(
    'import { useMembers, usePackages, useClasses }',
    'import { useMembers, usePackages, useClasses, useInvoices }'
  );
  memContent = memContent.replace(
    'const { data: members = [], isLoading } = useMembers();',
    'const { data: members = [], isLoading } = useMembers();\n  const { data: invoices = [] } = useInvoices();'
  );
  // Add type to map parameter to fix TS7006
  memContent = memContent.replace(
    'const jGroups = invoices.filter(i => i.member_id === m.uuid && i.joint_invoice_group_id).map(i => i.joint_invoice_group_id);',
    'const jGroups = invoices.filter((i: any) => i.member_id === m.uuid && i.joint_invoice_group_id).map((i: any) => i.joint_invoice_group_id);'
  );
  memContent = memContent.replace(
    'const jInvs = invoices.filter(i => jGroups.includes(i.joint_invoice_group_id) && i.member_id !== m.uuid);',
    'const jInvs = invoices.filter((i: any) => jGroups.includes(i.joint_invoice_group_id) && i.member_id !== m.uuid);'
  );
  memContent = memContent.replace(
    'const jIds = Array.from(new Set(jInvs.map(i => members.find(mem => mem.uuid === i.member_id)?.id))).filter(Boolean);',
    'const jIds = Array.from(new Set(jInvs.map((i: any) => members.find((mem: any) => mem.uuid === i.member_id)?.id))).filter(Boolean);'
  );
  fs.writeFileSync(memPath, memContent, 'utf8');
}
console.log("Fixed TS errors");
