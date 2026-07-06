import fs from 'fs';
const path = 'src/pages/Invoices.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  `<Button variant="outline" onClick={() => setPaymentModalInvoice(null)}>Cancel</Button>`,
  `<Button variant="outline" onClick={() => { setPaymentModalInvoice(null); setPaymentAmount(""); setPaymentCustomId(""); setPaymentDate(""); }}>Cancel</Button>`
);

fs.writeFileSync(path, content, 'utf8');
