import fs from 'fs';
const memPath = 'src/pages/Members.tsx';
let memContent = fs.readFileSync(memPath, 'utf8');

memContent = memContent.replace(
  'import { useMembers, usePackages, useClasses } from "@/hooks/use-data";',
  'import { useMembers, usePackages, useClasses, useInvoices } from "@/hooks/use-data";'
);
fs.writeFileSync(memPath, memContent, 'utf8');
