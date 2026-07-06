import fs from 'fs';
const path = 'src/pages/Coaches.tsx';
let content = fs.readFileSync(path, 'utf8');

const targetStr = `<div className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">{coach.name}</span>
                    <span className={\`text-xs px-2 py-0.5 rounded-full \${paymentTypeColors[coach.payment_type]}\`}>{paymentTypeLabels[coach.payment_type]}</span>
                  </div>
                  <span className="text-sm font-bold">{stats.calculatedAmount.toLocaleString()} EGP</span>
                </div>`;

const replacementStr = `<div className="flex flex-col py-3 border-b border-border last:border-0 gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">{coach.name}</span>
                      <span className={\`text-xs px-2 py-0.5 rounded-full \${paymentTypeColors[coach.payment_type]}\`}>{paymentTypeLabels[coach.payment_type]}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-muted/50 p-2 rounded-md">
                      <p className="text-muted-foreground mb-0.5">Expected</p>
                      <p className="font-semibold">{(stats as any).expectedAmount?.toLocaleString() || 0} EGP</p>
                    </div>
                    <div className="bg-green-500/10 text-green-700 p-2 rounded-md">
                      <p className="mb-0.5 opacity-80">Paid</p>
                      <p className="font-semibold">{(stats as any).paidAmount?.toLocaleString() || 0} EGP</p>
                    </div>
                    <div className="bg-amber-500/10 text-amber-700 p-2 rounded-md">
                      <p className="mb-0.5 opacity-80">Owed</p>
                      <p className="font-bold">{stats.calculatedAmount.toLocaleString()} EGP</p>
                    </div>
                  </div>
                </div>`;

const targetTotal = `<div className="flex items-center justify-between py-2 pt-3">
              <span className="text-sm font-bold">Total Payroll</span>
              <span className="text-base font-bold text-primary">
                {coaches.reduce((s, c) => s + calculateCoachPayroll(c, new Date().getMonth(), new Date().getFullYear(), classes, checkInsThisMonth, monthlyRevenue, newMembersThisMonth).calculatedAmount, 0).toLocaleString()} EGP
              </span>
            </div>`;

const replacementTotal = `<div className="grid grid-cols-3 gap-2 pt-4 border-t border-border mt-2">
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">Total Expected</span>
                <span className="text-sm font-bold text-foreground">
                  {coaches.reduce((s, c) => s + ((calculateCoachPayroll(c, new Date().getMonth(), new Date().getFullYear(), classes, checkInsThisMonth, monthlyRevenue, newMembersThisMonth) as any).expectedAmount || 0), 0).toLocaleString()} EGP
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">Total Paid</span>
                <span className="text-sm font-bold text-green-600">
                  {coaches.reduce((s, c) => s + ((calculateCoachPayroll(c, new Date().getMonth(), new Date().getFullYear(), classes, checkInsThisMonth, monthlyRevenue, newMembersThisMonth) as any).paidAmount || 0), 0).toLocaleString()} EGP
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">Total Owed</span>
                <span className="text-base font-bold text-amber-600">
                  {coaches.reduce((s, c) => s + calculateCoachPayroll(c, new Date().getMonth(), new Date().getFullYear(), classes, checkInsThisMonth, monthlyRevenue, newMembersThisMonth).calculatedAmount, 0).toLocaleString()} EGP
                </span>
              </div>
            </div>`;

if (content.includes(targetStr) && content.includes(targetTotal)) {
  content = content.replace(targetStr, replacementStr);
  content = content.replace(targetTotal, replacementTotal);
  fs.writeFileSync(path, content, 'utf8');
} else {
  console.log("Could not find targets");
}
