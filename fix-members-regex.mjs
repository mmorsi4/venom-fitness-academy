import fs from 'fs';
const path = 'src/pages/Members.tsx';
let content = fs.readFileSync(path, 'utf8');

const targetStr = `{(() => {
                              const jGroups = invoices.filter((i: any) => i.member_id === m.uuid && i.joint_invoice_group_id).map((i: any) => i.joint_invoice_group_id);
                              if (jGroups.length === 0) return null;
                              const jInvs = invoices.filter((i: any) => jGroups.includes(i.joint_invoice_group_id) && i.member_id !== m.uuid);
                              const jIds = Array.from(new Set(jInvs.map((i: any) => members.find((mem: any) => mem.uuid === i.member_id)?.id))).filter(Boolean);
                              if (jIds.length === 0) return null;
                              return (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700">
                                  Joint: {jIds.join(', ')}
                                </span>
                              );
                            })()}`;

const replacementStr = `{(() => {
                              // 1. Try actual joint_invoice_group_id
                              const jGroups = invoices.filter((i: any) => i.member_id === m.uuid && i.joint_invoice_group_id).map((i: any) => i.joint_invoice_group_id);
                              let jIds: any[] = [];
                              if (jGroups.length > 0) {
                                const jInvs = invoices.filter((i: any) => jGroups.includes(i.joint_invoice_group_id) && i.member_id !== m.uuid);
                                jIds = Array.from(new Set(jInvs.map((i: any) => members.find((mem: any) => mem.uuid === i.member_id)?.id))).filter(Boolean);
                              }
                              
                              // 2. Try parsing discount_description (e.g. "10% joint 3354, 3355")
                              if (jIds.length === 0) {
                                const myInvs = invoices.filter((i: any) => i.member_id === m.uuid && i.discount_description);
                                for (const inv of myInvs) {
                                  const match = inv.discount_description.match(/(?:joint|join)\\s*(?:with)?\\s*[:#-]?\\s*([\\d,\\s&]+)/i);
                                  if (match && match[1]) {
                                    const extractedIds = match[1].replace(/&/g, ',').split(',').map((s: string) => s.trim()).filter(Boolean);
                                    jIds.push(...extractedIds);
                                  }
                                }
                                jIds = Array.from(new Set(jIds));
                              }

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
