import fs from 'fs';
const path = 'src/pages/Members.tsx';
let content = fs.readFileSync(path, 'utf8');

const targetStr = `                  <TableRow key={m.uuid} data-testid={\`member-row-\${m.uuid}\`}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className={\`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 \${m.id === -1 ? 'bg-teal-100 text-teal-600' : 'bg-primary/10 text-primary'}\`}>
                          <span className="text-sm font-bold">{m.name.charAt(0)}</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-foreground text-sm">{m.name}</p>`;

const replacementStr = `                  <TableRow key={m.uuid} data-testid={\`member-row-\${m.uuid}\`}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className={\`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 \${m.id === -1 ? 'bg-teal-100 text-teal-600' : 'bg-primary/10 text-primary'}\`}>
                          <span className="text-sm font-bold">{m.name.charAt(0)}</span>
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-foreground text-sm">{m.name}</p>
                            {(() => {
                              const jGroups = invoices.filter(i => i.member_id === m.uuid && i.joint_invoice_group_id).map(i => i.joint_invoice_group_id);
                              if (jGroups.length === 0) return null;
                              const jInvs = invoices.filter(i => jGroups.includes(i.joint_invoice_group_id) && i.member_id !== m.uuid);
                              const jIds = Array.from(new Set(jInvs.map(i => members.find(mem => mem.uuid === i.member_id)?.id))).filter(Boolean);
                              if (jIds.length === 0) return null;
                              return (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700">
                                  Joint: {jIds.join(', ')}
                                </span>
                              );
                            })()}`;

if (content.includes(targetStr)) {
  content = content.replace(targetStr, replacementStr);
  fs.writeFileSync(path, content, 'utf8');
  console.log("Updated Members.tsx");
} else {
  console.log("Target not found");
}
