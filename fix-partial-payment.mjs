import fs from 'fs';
const path = 'src/pages/Invoices.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add state variables
const stateTarget = `  const [paymentModalInvoice, setPaymentModalInvoice] = useState<Invoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("Cash");`;
const stateReplacement = `  const [paymentModalInvoice, setPaymentModalInvoice] = useState<Invoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("Cash");
  const [paymentCustomId, setPaymentCustomId] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>("");`;
content = content.replace(stateTarget, stateReplacement);

// 2. Update mutate call
const mutateTarget = `    createInvoice.mutate({
      member_id: paymentModalInvoice.member_id,
      member_name: paymentModalInvoice.member_name,
      package_id: null,
      package_name: \`Payment Completion: \${paymentModalInvoice.package_name || 'Invoice'}\`,
      class_id: paymentModalInvoice.class_id,
      paid_amount: payment,
      total_amount: payment,
      payment_method: paymentMethod as any,
      status: 'paid',
      discount_amount: 0,
      discount_id: null,
      discount_description: null,
      activation_date: new Date().toISOString()
    }, {`;
const mutateReplacement = `    createInvoice.mutate({
      member_id: paymentModalInvoice.member_id,
      member_name: paymentModalInvoice.member_name,
      package_id: null,
      package_name: \`Payment Completion: \${paymentModalInvoice.package_name || 'Invoice'}\`,
      class_id: paymentModalInvoice.class_id,
      paid_amount: payment,
      total_amount: payment,
      payment_method: paymentMethod as any,
      status: 'paid',
      discount_amount: 0,
      discount_id: null,
      discount_description: null,
      activation_date: paymentDate ? new Date(paymentDate).toISOString() : new Date().toISOString(),
      ...(paymentCustomId.trim() ? { id: paymentCustomId.trim() } : {}),
      ...(paymentDate ? { created_at: new Date(paymentDate).toISOString() } : {})
    } as any, {`;
content = content.replace(mutateTarget, mutateReplacement);

// 3. Clear states on success/cancel
const clearTarget = `            setPaymentModalInvoice(null);
            setPaymentAmount("");`;
const clearReplacement = `            setPaymentModalInvoice(null);
            setPaymentAmount("");
            setPaymentCustomId("");
            setPaymentDate("");`;
content = content.replace(clearTarget, clearReplacement);

// 4. Update the dialog
const dialogTarget = `                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Payment Amount (EGP)</Label>
                    <Input
                      type="number"
                      min="0"
                      max={(paymentModalInvoice?.total_amount || 0) - (paymentModalInvoice?.paid_amount || 0)}
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Payment Method</Label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {paymentMethods.filter(m => m !== 'Split').map(m => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>`;
const dialogReplacement = `                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Payment Amount (EGP)</Label>
                    <Input
                      type="number"
                      min="0"
                      max={(paymentModalInvoice?.total_amount || 0) - (paymentModalInvoice?.paid_amount || 0)}
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Payment Method</Label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {paymentMethods.filter(m => m !== 'Split').map(m => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Invoice ID</Label>
                    <Input
                      placeholder="Auto-generated"
                      value={paymentCustomId}
                      onChange={(e) => setPaymentCustomId(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Payment Date</Label>
                    <Input
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                    />
                  </div>
                </div>`;
content = content.replace(dialogTarget, dialogReplacement);

fs.writeFileSync(path, content, 'utf8');
console.log("Updated Invoices.tsx");
