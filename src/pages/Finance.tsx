import { useState } from "react";
import { Plus, TrendingUp, TrendingDown, DollarSign, ChevronLeft, ChevronRight, ChevronDown, Printer, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell
} from "recharts";
import { 
  useInvoices, useExpenses, useLiabilities, useInternalTransfers,
  useCoaches, useMembers, useCoachCheckInsForMonth, useClasses, usePackages,
  useFinanceBaseBalances, useUpsertFinanceBaseBalance, useCreateInvoice, useCreateExpense, useCreateInternalTransfer, useCoachDeductions,
  useGlobalSettings, useUpsertGlobalSettings
} from "@/hooks/use-data";
import { toast } from "sonner";
import { format } from "date-fns";
import { calculateCoachPayroll, calculateIncomeByMethod, calculateExpenseByMethod } from "../lib/utils";

import { EXPENSE_BASE_CATEGORIES, LIABILITY_CATEGORY } from "@/lib/constants";
const INCOME_COLORS = ['#047857', '#34d399', '#064e3b', '#6ee7b7', '#10b981', '#a7f3d0']; 
const EXPENSE_COLORS = ['#dc2626', '#fca5a5', '#7f1d1d', '#f87171', '#ef4444', '#fecaca'];
const PAYMENT_COLORS = ['#0284c7', '#7dd3fc', '#0c4a6e', '#38bdf8'];


export default function Finance() {
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth());
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());

  const { data: invoices = [] } = useInvoices();
  const { data: expenses = [] } = useExpenses();
  const { data: internalTransfers = [] } = useInternalTransfers();
  const { data: liabilities = [] } = useLiabilities();
  const { data: coaches = [] } = useCoaches();
  const { data: members = [] } = useMembers();
  const { data: classes = [] } = useClasses();
  const { data: packages = [] } = usePackages();
  const { data: coachDeductions = [] } = useCoachDeductions();
  const { data: checkInsThisMonth = [] } = useCoachCheckInsForMonth(filterMonth, filterYear);
  const [isCoachPayrollExpanded, setIsCoachPayrollExpanded] = useState(false);
  const [isLiabilityExpanded, setIsLiabilityExpanded] = useState(false);
  const [clinicOnly, setClinicOnly] = useState(false);

  // New Account Adjustments state
  const createInvoice = useCreateInvoice();
  const createExpense = useCreateExpense();
  const createInternalTransfer = useCreateInternalTransfer();
  const [showAdjustDialog, setShowAdjustDialog] = useState(false);
  const [adjustMethod, setAdjustMethod] = useState<'Cash'|'Visa'|'InstaPay'>('Cash');
  const [actualBalance, setActualBalance] = useState<string>('');

  const upsertGlobalSettings = useUpsertGlobalSettings();
  const [showStartBalanceDialog, setShowStartBalanceDialog] = useState(false);
  const [startBalancesForm, setStartBalancesForm] = useState({
    date: '',
    cash: '',
    visa: '',
    instapay: ''
  });

  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [transferForm, setTransferForm] = useState({
    fromAccount: 'Cash' as 'Cash'|'Visa'|'InstaPay',
    toAccount: 'Visa' as 'Cash'|'Visa'|'InstaPay',
    amount: '',
    note: '',
    date: ''
  });

  const uniqueExistingCategories = [...new Set(expenses.map(e => e.category))];
  const dynamicCategories = [...new Set([...EXPENSE_BASE_CATEGORIES, ...uniqueExistingCategories])].filter(c => c !== LIABILITY_CATEGORY);
  const allCategories = [...dynamicCategories, LIABILITY_CATEGORY, "CUSTOM"];


  // Global Yearly Data (Ignores month/year filter)
  const currentYear = new Date().getFullYear();
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const globalChartData = MONTHS.map((monthName, index) => {
    return {
      name: monthName,
      Income: invoices
        .filter(i => {
          const d = new Date(i.created_at);
          return d.getMonth() === index && d.getFullYear() === currentYear;
        })
        .reduce((s, i) => s + i.paid_amount, 0),
      Expenses: expenses
        .filter(e => {
          const d = new Date(e.date);
          return d.getMonth() === index && d.getFullYear() === currentYear;
        })
        .reduce((s, e) => s + e.amount, 0),
    };
  });

  const { data: globalSettings } = useGlobalSettings();

  // Filter out data before start_date for Global Account Balances
  const financeStartDate = globalSettings?.finance_start_date ? new Date(globalSettings.finance_start_date) : new Date(0);
  
  const applicableInvoices = invoices.filter(i => new Date(i.created_at) >= financeStartDate);
  const applicableExpenses = expenses.filter(e => new Date(e.date) >= financeStartDate);
  const applicableTransfers = internalTransfers.filter(t => new Date(t.date) >= financeStartDate);

  // Helper to calculate transfer net effect on an account
  const calculateTransferNet = (method: 'Cash'|'Visa'|'InstaPay') => {
    const transfersIn = applicableTransfers.filter((t: any) => t.to_account === method).reduce((s: number, t: any) => s + t.amount, 0);
    const transfersOut = applicableTransfers.filter((t: any) => t.from_account === method).reduce((s: number, t: any) => s + t.amount, 0);
    return transfersIn - transfersOut;
  };

  // Global Account Balances (All Time starting from Start Date)
  const globalCashBalance = (globalSettings?.finance_start_cash || 0) + calculateIncomeByMethod(applicableInvoices, 'Cash') - calculateExpenseByMethod(applicableExpenses, 'Cash') + calculateTransferNet('Cash');
  const globalVisaBalance = (globalSettings?.finance_start_visa || 0) + calculateIncomeByMethod(applicableInvoices, 'Visa') - calculateExpenseByMethod(applicableExpenses, 'Visa') + calculateTransferNet('Visa');
  const globalInstapayBalance = (globalSettings?.finance_start_instapay || 0) + calculateIncomeByMethod(applicableInvoices, 'InstaPay') - calculateExpenseByMethod(applicableExpenses, 'InstaPay') + calculateTransferNet('InstaPay');

  // Filter invoices and expenses by selected month/year
  const filteredInvoices = invoices.filter(i => {
    const d = new Date(i.created_at);
    return d.getMonth() === filterMonth && d.getFullYear() === filterYear;
  });

  const filteredExpenses = expenses.filter(e => {
    const d = new Date(e.date);
    return d.getMonth() === filterMonth && d.getFullYear() === filterYear && d >= financeStartDate;
  });

  const filteredTransfers = internalTransfers.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === filterMonth && d.getFullYear() === filterYear && d >= financeStartDate;
  });

  const liabilityPayments = filteredExpenses.filter(e => e.category === LIABILITY_CATEGORY);
  const regularExpenses = filteredExpenses.filter(e => e.category !== LIABILITY_CATEGORY);
  const totalLiabilityPayments = liabilityPayments.reduce((s, e) => s + e.amount, 0);

  const isStartingMonth = globalSettings?.finance_start_date && new Date(globalSettings.finance_start_date).getMonth() === filterMonth && new Date(globalSettings.finance_start_date).getFullYear() === filterYear;
  const startingCashIncome = isStartingMonth && !clinicOnly ? (globalSettings?.finance_start_cash || 0) : 0;
  const startingVisaIncome = isStartingMonth && !clinicOnly ? (globalSettings?.finance_start_visa || 0) : 0;
  const startingInstapayIncome = isStartingMonth && !clinicOnly ? (globalSettings?.finance_start_instapay || 0) : 0;
  const totalStartingIncome = startingCashIncome + startingVisaIncome + startingInstapayIncome;

  const totalIncome = filteredInvoices.reduce((s, i) => s + i.paid_amount, 0) + totalStartingIncome;

  const clinicIncome = filteredInvoices.filter(i => {
    const pkg = packages.find(p => p.id === i.package_id);
    return pkg?.is_clinic;
  }).reduce((s, i) => s + i.paid_amount, 0);

  const newMembersThisMonth = members.filter(m => {
    const d = new Date(m.member_since);
    return d.getMonth() === filterMonth && d.getFullYear() === filterYear;
  }).length;

  const coachPayrolls = coaches.map(coach => 
    calculateCoachPayroll(coach, filterMonth, filterYear, classes, checkInsThisMonth, totalIncome, newMembersThisMonth, coachDeductions)
  ).filter(c => c.calculatedAmount > 0 || c.missedSessions > 0 || c.netAdjustment !== 0);

  const totalCoachPayroll = coachPayrolls.reduce((sum, c) => sum + c.calculatedAmount, 0);

  const totalBaseExpenses = filteredExpenses.reduce((s, e) => s + e.amount, 0);
  const totalExpenses = totalBaseExpenses;
  const netBalance = totalIncome - totalExpenses;

  const cashIncome = calculateIncomeByMethod(filteredInvoices, 'Cash');
  const visaIncome = calculateIncomeByMethod(filteredInvoices, 'Visa');
  const instapayIncome = calculateIncomeByMethod(filteredInvoices, 'InstaPay');

  const paymentMethods = [
    { name: "Cash", amount: cashIncome },
    { name: "Visa", amount: visaIncome },
    { name: "InstaPay", amount: instapayIncome },
  ].filter(p => p.amount > 0).map(p => ({
    ...p,
    percentage: totalIncome > 0 ? (p.amount / totalIncome) * 100 : 0
  })).sort((a, b) => b.amount - a.amount);

  const breakdownInvoices = filteredInvoices.filter(i => {
    if (!clinicOnly) return true;
    const pkg = packages.find(p => p.id === i.package_id);
    return pkg?.is_clinic;
  });
  const breakdownTotalIncome = breakdownInvoices.reduce((s, i) => s + i.paid_amount, 0) + totalStartingIncome;

  const calculateMonthlyTransferNet = (method: 'Cash'|'Visa'|'InstaPay') => {
    if (clinicOnly) return 0; // Transfers only affect global gym accounts
    const transfersIn = filteredTransfers.filter(t => t.to_account === method).reduce((s, t) => s + t.amount, 0);
    const transfersOut = filteredTransfers.filter(t => t.from_account === method).reduce((s, t) => s + t.amount, 0);
    return transfersIn - transfersOut;
  };

  const breakdownCashIncome = calculateIncomeByMethod(breakdownInvoices, 'Cash') + startingCashIncome;
  const breakdownVisaIncome = calculateIncomeByMethod(breakdownInvoices, 'Visa') + startingVisaIncome;
  const breakdownInstapayIncome = calculateIncomeByMethod(breakdownInvoices, 'InstaPay') + startingInstapayIncome;

  const breakdownPaymentMethods = [
    { name: "Cash", amount: breakdownCashIncome },
    { name: "Visa", amount: breakdownVisaIncome },
    { name: "InstaPay", amount: breakdownInstapayIncome },
  ].filter(p => p.amount > 0).map(p => ({
    ...p,
    percentage: breakdownTotalIncome > 0 ? (p.amount / breakdownTotalIncome) * 100 : 0
  })).sort((a, b) => b.amount - a.amount);

  const allChartCategories = [...dynamicCategories, LIABILITY_CATEGORY];
  let rawExpenseByCategory = allChartCategories.map(cat => ({
    category: cat,
    amount: filteredExpenses.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0),
  })).filter(c => c.amount > 0);

  const totalCalculatedExpenses = rawExpenseByCategory.reduce((s, c) => s + c.amount, 0);
  const expenseByCategory = rawExpenseByCategory.map(c => ({
    ...c,
    percentage: totalCalculatedExpenses > 0 ? (c.amount / totalCalculatedExpenses) * 100 : 0
  })).sort((a, b) => b.amount - a.amount);

  // Income by package
  const incomeByPackage = [...new Set(breakdownInvoices.map(i => i.package_name).filter(Boolean))]
    .map(pkg => {
      const amount = breakdownInvoices.filter(i => i.package_name === pkg).reduce((s, i) => s + i.paid_amount, 0);
      return {
        package: pkg,
        amount,
        count: breakdownInvoices.filter(i => i.package_name === pkg).length,
        percentage: breakdownTotalIncome > 0 ? (amount / breakdownTotalIncome) * 100 : 0
      };
    })
    .sort((a, b) => b.amount - a.amount);

  if (totalStartingIncome > 0) {
    incomeByPackage.push({
      package: "Starting Balance",
      amount: totalStartingIncome,
      count: 1,
      percentage: breakdownTotalIncome > 0 ? (totalStartingIncome / breakdownTotalIncome) * 100 : 0
    });
    incomeByPackage.sort((a, b) => b.amount - a.amount);
  }


  const prevMonth = () => {
    if (filterMonth === 0) { setFilterMonth(11); setFilterYear(y => y - 1); }
    else setFilterMonth(m => m - 1);
  };

  const currentRealDate = new Date();
  const canGoNextMonth = () => {
    if (filterYear < currentRealDate.getFullYear()) return true;
    if (filterYear === currentRealDate.getFullYear() && filterMonth < currentRealDate.getMonth()) return true;
    return false;
  };

  const nextMonth = () => {
    if (!canGoNextMonth()) return;
    if (filterMonth === 11) { setFilterMonth(0); setFilterYear(y => y + 1); }
    else setFilterMonth(m => m + 1);
  };

  const openAdjustDialog = (method: 'Cash'|'Visa'|'InstaPay') => {
    setAdjustMethod(method);
    const currentBal = method === 'Cash' ? globalCashBalance : method === 'Visa' ? globalVisaBalance : globalInstapayBalance;
    setActualBalance(currentBal.toString());
    setShowAdjustDialog(true);
  };

  const handleSetStartBalance = () => {
    upsertGlobalSettings.mutate({
      finance_start_date: startBalancesForm.date || null,
      finance_start_cash: Number(startBalancesForm.cash) || 0,
      finance_start_visa: Number(startBalancesForm.visa) || 0,
      finance_start_instapay: Number(startBalancesForm.instapay) || 0
    }, {
      onSuccess: () => {
        toast.success("Starting balances updated");
        setShowStartBalanceDialog(false);
      },
      onError: (err: any) => {
        toast.error(`Error saving settings: ${err.message}`);
      }
    });
  };

  const handleAdjustBalances = () => {
    const currentSysBal = adjustMethod === 'Cash' ? globalCashBalance : adjustMethod === 'Visa' ? globalVisaBalance : globalInstapayBalance;
    const actual = Number(actualBalance);
    if (isNaN(actual)) { toast.error("Invalid amount"); return; }
    
    const diff = actual - currentSysBal;
    if (diff === 0) {
      toast.info("Balance is already match, no adjustment needed.");
      setShowAdjustDialog(false);
      return;
    }

    if (diff > 0) {
      createInvoice.mutate({
        member_name: "System Adjustment",
        package_id: null,
        package_name: "Manual Reconciliation",
        paid_amount: diff,
        payment_method: adjustMethod,
        total_amount: diff,
        status: "paid",
        discount_amount: 0,
        discount_id: null,
        discount_description: null,
        class_id: null,
        member_id: "00000000-0000-0000-0000-000000000000",
        activation_date: new Date().toISOString()
      }, {
        onSuccess: () => {
          toast.success(`Account balance reconciled (+${diff.toLocaleString()})`);
          setShowAdjustDialog(false);
        }
      });
    } else {
      createExpense.mutate({
        description: `Adjustment: ${adjustMethod}`,
        amount: Math.abs(diff),
        date: new Date().toISOString(),
        category: 'CUSTOM',
        payment_method: adjustMethod,
        liability_id: null,
        coach_id: null,
      }, {
        onSuccess: () => {
          toast.success(`Account balance reconciled (${diff.toLocaleString()})`);
          setShowAdjustDialog(false);
        }
      });
    }
  };

  const handleTransfer = async () => {
    const amt = Number(transferForm.amount);
    if (isNaN(amt) || amt <= 0) {
      toast.error("Invalid transfer amount");
      return;
    }
    if (transferForm.fromAccount === transferForm.toAccount) {
      toast.error("Cannot transfer to the same account");
      return;
    }

    const note = transferForm.note ? ` (${transferForm.note})` : "";
    const transferDate = transferForm.date ? new Date(transferForm.date).toISOString() : new Date().toISOString();
    
    try {
      await createInternalTransfer.mutateAsync({
        from_account: transferForm.fromAccount,
        to_account: transferForm.toAccount,
        amount: amt,
        date: transferDate,
        note: transferForm.note || null,
      });

      toast.success(`Transferred ${amt} EGP from ${transferForm.fromAccount} to ${transferForm.toAccount}`);
      setShowTransferDialog(false);
      setTransferForm(p => ({ ...p, amount: '', note: '', date: '' }));
    } catch (err: any) {
      toast.error(`Transfer failed: ${err.message}`);
    }
  };

  return (
    <div className="p-6 space-y-8">
      {/* --- PRINT ONLY LAYOUT --- */}
      <div className="hidden print:block w-full text-black space-y-6 p-4 font-serif">
        <h1 className="text-lg font-bold uppercase text-center border-b border-black pb-2 mb-4">
          Financial Statement - {new Date(filterYear, filterMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h1>

        {/* Income Table */}
        <div className="space-y-2">
          <h2 className="text-base font-bold uppercase border-b border-black pb-1">Income Details</h2>
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-black">
                <th className="py-1 pr-4 w-20">Date</th>
                <th className="py-1 pr-4">Member</th>
                <th className="py-1 pr-4">Package</th>
                <th className="py-1 pr-4">Method</th>
                <th className="py-1 text-right">Amount (EGP)</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.map((i, idx) => (
                <tr key={i.id} className={`border-b border-gray-300 ${idx % 2 === 0 ? "bg-gray-50" : ""}`}>
                  <td className="py-1 pr-4 align-top">{format(new Date(i.created_at), 'dd/MM/yyyy')}</td>
                  <td className="py-1 pr-4 align-top">{i.member_name}</td>
                  <td className="py-1 pr-4 align-top">{i.package_name}</td>
                  <td className="py-1 pr-4 align-top">{i.payment_method}</td>
                  <td className="py-1 text-right font-medium align-top">{i.paid_amount.toLocaleString()}</td>
                </tr>
              ))}
              {filteredInvoices.length === 0 && (
                <tr><td colSpan={5} className="py-2 text-center italic text-gray-500">No income recorded for this period.</td></tr>
              )}
              <tr className="border-t border-black font-bold text-sm">
                <td colSpan={4} className="py-2 text-right">TOTAL INCOME</td>
                <td className="py-2 text-right">{totalIncome.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Expense Table */}
        <div className="space-y-2">
          <h2 className="text-base font-bold uppercase border-b border-black pb-1">Expense Details</h2>
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-black">
                <th className="py-1 pr-4 w-20">Date</th>
                <th className="py-1 pr-4">Description</th>
                <th className="py-1 pr-4">Category</th>
                <th className="py-1 text-right">Amount (EGP)</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.map((e, idx) => (
                <tr key={e.id} className={`border-b border-gray-300 ${idx % 2 === 0 ? "bg-gray-50" : ""}`}>
                  <td className="py-1 pr-4 align-top">{format(new Date(e.date), 'dd/MM/yyyy')}</td>
                  <td className="py-1 pr-4 align-top">{e.description || e.category}</td>
                  <td className="py-1 pr-4 align-top">{e.category}</td>
                  <td className="py-1 text-right font-medium align-top">{e.amount.toLocaleString()}</td>
                </tr>
              ))}
              {/* Coach Payroll Details */}
              {coachPayrolls.map((coach, idx) => (
                <tr key={`coach-${coach.id}`} className={`border-b border-gray-300 ${(filteredExpenses.length + idx) % 2 === 0 ? "bg-gray-50" : ""}`}>
                  <td className="py-1 pr-4 align-top">Month End</td>
                  <td className="py-1 pr-4 align-top">
                    <div className="flex justify-between items-center bg-muted/30 p-2 rounded-md border border-border/50 text-sm">
                      <div>
                        <span className="font-medium text-foreground">{coach.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          ({coach.payment_type === 'salary' ? 'Salary' : 'Per Session'})
                        </span>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Expected: {coach.scheduledSlotsInMonth} slots | Attended: {coach.attendedSessions} slots
                        </p>
                        {coach.missedSessions > 0 && coach.payment_type === 'salary' && coach.deduction > 0 && (
                          <p className="text-xs font-semibold text-red-500 mt-0.5">
                            Deduction: -{Math.round(coach.deduction).toLocaleString()} EGP (Missed {coach.missedSessions} slots)
                          </p>
                        )}
                        {coach.netAdjustment !== 0 && (
                          <p className={`text-xs font-semibold mt-0.5 ${coach.netAdjustment > 0 ? 'text-emerald-500' : 'text-orange-500'}`}>
                            Net Adjustment: {coach.netAdjustment > 0 ? '+' : ''}{Math.round(coach.netAdjustment).toLocaleString()} EGP
                          </p>
                        )}
                        {coach.advance_balance > 0 && (
                          <p className="text-xs font-semibold text-amber-600 mt-0.5">
                            Active Advance Debt: {coach.advance_balance.toLocaleString()} EGP
                          </p>
                        )}
                      </div>
                      <span className="font-bold text-foreground">{coach.calculatedAmount.toLocaleString()} EGP</span>
                    </div>
                  </td>
                  <td className="py-1 pr-4 align-top">Coach Payroll</td>
                  <td className="py-1 text-right font-medium align-top">{coach.calculatedAmount.toLocaleString()}</td>
                </tr>
              ))}
              {filteredExpenses.length === 0 && coachPayrolls.length === 0 && (
                <tr><td colSpan={4} className="py-2 text-center italic text-gray-500">No expenses recorded for this period.</td></tr>
              )}
              <tr className="border-t border-black font-bold text-sm">
                <td colSpan={3} className="py-2 text-right">TOTAL EXPENSES</td>
                <td className="py-2 text-right">{totalExpenses.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Net Balance */}
        <div className="flex justify-end pt-4">
          <div className="w-1/2 border border-black p-2 bg-gray-100 flex justify-between items-center text-base font-bold">
            <span>NET BALANCE</span>
            <span>{netBalance >= 0 ? "" : "-"}{Math.abs(netBalance).toLocaleString()} EGP</span>
          </div>
        </div>

        <div className="pt-6 text-xs text-gray-500 text-center">
          <p>Generated on {new Date().toLocaleString()}</p>
        </div>
      </div>

      {/* --- STANDARD SCREEN LAYOUT --- */}
      <div className="print:hidden space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Financial Management</h1>
          <p className="text-sm text-muted-foreground">Income, expenses, and reports</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <Button variant="outline" onClick={() => {
            setStartBalancesForm({
              date: globalSettings?.finance_start_date ? globalSettings.finance_start_date.split('T')[0] : '',
              cash: globalSettings?.finance_start_cash.toString() || '0',
              visa: globalSettings?.finance_start_visa.toString() || '0',
              instapay: globalSettings?.finance_start_instapay.toString() || '0'
            });
            setShowStartBalanceDialog(true);
          }} className="gap-2">
            Set Starting Balances
          </Button>
          <Button variant="outline" onClick={() => setShowTransferDialog(true)} className="gap-2">
            Transfer Money
          </Button>
          <Button variant="outline" onClick={() => setShowAdjustDialog(true)} className="gap-2">
            Adjust Balances
          </Button>
          <Button variant="outline" onClick={() => window.print()} className="gap-2">
            <Printer className="w-4 h-4" /> Print Report
          </Button>
        </div>
      </div>

      {/* Global Account Balances */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-amber-200 shadow-sm bg-amber-50/30 cursor-pointer hover:bg-amber-50/60 transition-colors" onClick={() => openAdjustDialog('Cash')}>
          <CardContent className="p-5">
            <p className="text-sm font-semibold text-amber-800 uppercase tracking-wider mb-1">Cash Balance (All-Time)</p>
            <p className="text-3xl font-bold text-amber-700">{globalCashBalance.toLocaleString()} EGP</p>
          </CardContent>
        </Card>
        <Card className="border-blue-200 shadow-sm bg-blue-50/30 cursor-pointer hover:bg-blue-50/60 transition-colors" onClick={() => openAdjustDialog('Visa')}>
          <CardContent className="p-5">
            <p className="text-sm font-semibold text-blue-800 uppercase tracking-wider mb-1">Visa Balance (All-Time)</p>
            <p className="text-3xl font-bold text-blue-700">{globalVisaBalance.toLocaleString()} EGP</p>
          </CardContent>
        </Card>
        <Card className="border-violet-200 shadow-sm bg-violet-50/30 cursor-pointer hover:bg-violet-50/60 transition-colors" onClick={() => openAdjustDialog('InstaPay')}>
          <CardContent className="p-5">
            <p className="text-sm font-semibold text-violet-800 uppercase tracking-wider mb-1">InstaPay Balance (All-Time)</p>
            <p className="text-3xl font-bold text-violet-700">{globalInstapayBalance.toLocaleString()} EGP</p>
          </CardContent>
        </Card>
      </div>

      {/* Global Yearly Line Chart (Top) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Monthly Revenue vs Expenses ({currentYear})</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={globalChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 88%)" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => [`${Math.round(v).toLocaleString()} EGP`]} />
              <Legend />
              <Line type="monotone" dataKey="Income" stroke="#059669" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="Expenses" stroke="#ef4444" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Month/Year Selector (Centered) */}
      <div className="flex justify-center items-center gap-4 py-2 border-t border-b border-border/50 bg-muted/20 -mx-6 px-6">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={prevMonth}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="text-center min-w-[160px]">
          <p className="text-base font-bold text-foreground">
            {new Date(filterYear, filterMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </p>
        </div>
        {canGoNextMonth() ? (
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={nextMonth}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        ) : (
          <div className="w-8 h-8" />
        )}
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-emerald-100 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-muted-foreground">Total Income</p>
              <div className="p-2 bg-emerald-50 rounded-full">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
              </div>
            </div>
            <p className="text-3xl font-bold text-emerald-600">{totalIncome.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-2">EGP collected for {new Date(filterYear, filterMonth).toLocaleString('default', { month: 'long' })}</p>
          </CardContent>
        </Card>
        
        <Card className="border-teal-100 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-muted-foreground">Clinic Only Income</p>
              <div className="p-2 bg-teal-50 rounded-full">
                <Activity className="w-5 h-5 text-teal-500" />
              </div>
            </div>
            <p className="text-3xl font-bold text-teal-600">{clinicIncome.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-2">EGP from clinic packages</p>
          </CardContent>
        </Card>
        <Card className="border-red-100 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-muted-foreground">Total Expenses</p>
              <div className="p-2 bg-red-50 rounded-full">
                <TrendingDown className="w-5 h-5 text-red-500" />
              </div>
            </div>
            <p className="text-3xl font-bold text-red-600">{totalExpenses.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-2">EGP spent</p>
          </CardContent>
        </Card>
        <Card className={netBalance >= 0 ? "border-emerald-100 shadow-sm" : "border-red-100 shadow-sm"}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-muted-foreground">Net Balance</p>
              <div className={`p-2 rounded-full ${netBalance >= 0 ? "bg-emerald-50" : "bg-red-50"}`}>
                <DollarSign className={`w-5 h-5 ${netBalance >= 0 ? "text-emerald-500" : "text-red-500"}`} />
              </div>
            </div>
            <p className={`text-3xl font-bold ${netBalance >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {netBalance >= 0 ? "" : "-"}{Math.abs(netBalance).toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-2">EGP net</p>
          </CardContent>
        </Card>
      </div>

      {/* Split Layout Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4 border-t border-border/50">
        
        {/* Left Column: Income */}
        <div className="space-y-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-foreground">Income Breakdown</h2>
            <div className="flex items-center space-x-2 bg-muted/30 px-3 py-1.5 rounded-md border border-border/50">
              <input
                type="checkbox"
                id="clinic-only-toggle"
                checked={clinicOnly}
                onChange={(e) => setClinicOnly(e.target.checked)}
                className="rounded border-gray-300 text-primary focus:ring-primary"
              />
              <Label htmlFor="clinic-only-toggle" className="text-sm font-medium leading-none cursor-pointer">
                Clinic Only
              </Label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Income by Package */}
            <Card className="flex flex-col h-[420px]">
              <CardHeader className="pb-3 flex-shrink-0">
                <CardTitle className="text-sm font-semibold">By Package</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto">
                {incomeByPackage.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No income recorded</p>
                ) : (
                  <div className="flex flex-col">
                    <div className="h-[160px] w-full mb-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie 
                            data={incomeByPackage} 
                            dataKey="amount" 
                            nameKey="package" 
                            cx="50%" 
                            cy="50%" 
                            outerRadius={65} 
                            innerRadius={35}
                            paddingAngle={3}
                          >
                            {incomeByPackage.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={INCOME_COLORS[index % INCOME_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number, name: string, props: any) => [`${value.toLocaleString()} EGP (${props.payload.percentage.toFixed(1)}%)`, name]} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="space-y-2">
                      {incomeByPackage.map(({ package: pkg, amount, count, percentage }) => (
                        <div key={pkg} className="flex items-center justify-between p-2 rounded-md bg-muted/30 border border-border/50">
                          <div>
                            <p className="font-medium text-sm text-foreground">{pkg}</p>
                            <p className="text-[10px] text-muted-foreground">{count} invoice{count !== 1 ? 's' : ''}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-sm">{amount.toLocaleString()} EGP</p>
                            <p className="text-[10px] text-muted-foreground">{percentage.toFixed(1)}%</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Income by Payment Method */}
            <Card className="flex flex-col h-[420px]">
              <CardHeader className="pb-3 flex-shrink-0">
                <CardTitle className="text-sm font-semibold">By Payment Method</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto">
                {breakdownPaymentMethods.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No income recorded</p>
                ) : (
                  <div className="flex flex-col">
                    <div className="h-[160px] w-full mb-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie 
                            data={breakdownPaymentMethods} 
                            dataKey="amount" 
                            nameKey="name" 
                            cx="50%" 
                            cy="50%" 
                            outerRadius={65} 
                            innerRadius={35}
                            paddingAngle={3}
                          >
                            {breakdownPaymentMethods.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={PAYMENT_COLORS[index % PAYMENT_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number, name: string, props: any) => [`${value.toLocaleString()} EGP (${props.payload.percentage.toFixed(1)}%)`, name]} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="space-y-2">
                      {breakdownPaymentMethods.map(({ name, amount, percentage }, i) => (
                        <div key={name} className="flex items-center justify-between p-2 rounded-md bg-muted/30 border border-border/50">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: PAYMENT_COLORS[i % PAYMENT_COLORS.length] }} />
                            <p className="font-medium text-sm text-foreground">{name}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-sm">{amount.toLocaleString()} EGP</p>
                            <p className="text-[10px] text-muted-foreground">{percentage.toFixed(1)}%</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Income Log */}
          <Card>
            <CardHeader className="pb-3 flex-shrink-0">
              <CardTitle className="text-sm font-semibold">Income Log</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[350px] overflow-y-auto pr-2">
              {breakdownInvoices.map(i => (
                <div key={i.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50 border border-border/50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {i.member_name}
                    </p>
                    <p className="text-xs text-muted-foreground">{i.package_name} · {i.payment_method} · {format(new Date(i.created_at), 'dd/MM')}</p>
                  </div>
                  <p className="text-sm font-bold text-emerald-600 flex-shrink-0">{i.paid_amount.toLocaleString()} EGP</p>
                </div>
              ))}
              {breakdownInvoices.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No income recorded this month</p>}
            </CardContent>
          </Card>

        </div>

        {/* Right Column: Expenses */}
        <div className="space-y-6">
          <h2 className="text-lg font-bold text-foreground mb-4">Expense Breakdown</h2>

          {/* Expenses by Category */}
          <Card className="flex flex-col h-[420px]">
            <CardHeader className="pb-3 flex-shrink-0">
              <CardTitle className="text-sm font-semibold">Expenses by Category</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto">
              {expenseByCategory.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No expenses recorded</p>
              ) : (
                <div className="flex flex-col">
                  {/* Pie Chart */}
                  <div className="h-[220px] w-full mb-6">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie 
                          data={expenseByCategory} 
                          dataKey="amount" 
                          nameKey="category" 
                          cx="50%" 
                          cy="50%" 
                          outerRadius={85} 
                          innerRadius={45}
                          paddingAngle={3}
                        >
                          {expenseByCategory.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={EXPENSE_COLORS[index % EXPENSE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number, name: string, props: any) => [`${value.toLocaleString()} EGP (${props.payload.percentage.toFixed(1)}%)`, name]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Detail List Without Progress Bars */}
                  <div className="space-y-2">
                    {expenseByCategory.map(({ category, amount, percentage }) => (
                      <div key={category} className="flex items-center justify-between p-2 rounded-md bg-muted/30 border border-border/50">
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium text-sm text-foreground">{category}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-sm">{Math.round(amount).toLocaleString()} EGP</p>
                          <p className="text-[10px] text-muted-foreground">{percentage.toFixed(1)}%</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Expense Log */}
          <Card>
            <CardHeader className="pb-3 flex-shrink-0">
              <CardTitle className="text-sm font-semibold">Expense Log</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[350px] overflow-y-auto pr-2">
              
              {/* Automated Coach Payroll expandable */}
              {totalCoachPayroll > 0 && (
                <div className="space-y-1">
                  <div 
                    className="flex items-center gap-3 p-2.5 rounded-lg bg-indigo-50/50 border border-indigo-100 cursor-pointer hover:bg-indigo-50 transition-colors"
                    onClick={() => setIsCoachPayrollExpanded(!isCoachPayrollExpanded)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-indigo-900 truncate flex items-center gap-2">
                        Remaining Coach Payments
                        {isCoachPayrollExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </p>
                      <p className="text-xs text-indigo-600/70">Calculated for this month</p>
                    </div>
                    <p className="text-sm font-bold text-indigo-600 flex-shrink-0">{totalCoachPayroll.toLocaleString()} EGP</p>
                  </div>
                  {isCoachPayrollExpanded && (
                    <div className="pl-3 pr-1 py-1 space-y-1 mt-1">
                      {coachPayrolls.map(coach => (
                        <div key={coach.id} className="flex items-center justify-between p-2 rounded-md bg-muted/30 border border-border/50 text-sm">
                          <div>
                            <span className="font-medium text-foreground">{coach.name}</span>
                            <span className="text-xs text-muted-foreground ml-2">
                              ({coach.payment_type === 'salary' ? 'Salary' : 'Per Session'})
                            </span>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              Expected: {coach.scheduledSlotsInMonth} slots | Attended: {coach.attendedSessions} slots
                            </p>
                            {coach.missedSessions > 0 && coach.payment_type === 'salary' && coach.deduction > 0 && (
                              <p className="text-[10px] font-semibold text-red-500 mt-0.5">
                                Deduction: -{Math.round(coach.deduction).toLocaleString()} EGP (Missed {coach.missedSessions} slots)
                              </p>
                            )}
                            {coach.netAdjustment !== 0 && (
                              <p className={`text-[10px] font-semibold mt-0.5 ${coach.netAdjustment > 0 ? 'text-emerald-500' : 'text-orange-500'}`}>
                                Net Adjustment: {coach.netAdjustment > 0 ? '+' : ''}{Math.round(coach.netAdjustment).toLocaleString()} EGP
                              </p>
                            )}
                            {coach.advance_balance > 0 && (
                              <p className="text-[10px] font-semibold text-amber-600 mt-0.5">
                                Active Advance Debt: {coach.advance_balance.toLocaleString()} EGP
                              </p>
                            )}
                          </div>
                          <p className="font-semibold">{coach.calculatedAmount.toLocaleString()} EGP</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Liability Payments Expandable */}
              {totalLiabilityPayments > 0 && (
                <div className="space-y-1">
                  <div 
                    className="flex items-center gap-3 p-2.5 rounded-lg bg-amber-50/50 border border-amber-100 cursor-pointer hover:bg-amber-50 transition-colors"
                    onClick={() => setIsLiabilityExpanded(!isLiabilityExpanded)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-amber-900 truncate flex items-center gap-2">
                        Liability Payments
                        {isLiabilityExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </p>
                      <p className="text-xs text-amber-600/70">{liabilityPayments.length} payment(s) this month</p>
                    </div>
                    <p className="text-sm font-bold text-amber-600 flex-shrink-0">{totalLiabilityPayments.toLocaleString()} EGP</p>
                  </div>
                  {isLiabilityExpanded && (
                    <div className="pl-3 pr-1 py-1 space-y-1 mt-1">
                      {liabilityPayments.map(e => (
                        <div key={e.id} className="flex items-center justify-between p-2 rounded-md bg-muted/30 border border-border/50 text-sm">
                          <div>
                            <p className="font-medium text-foreground">{e.description || e.category}</p>
                            <p className="text-xs text-muted-foreground">{format(new Date(e.date), 'dd/MM')}</p>
                          </div>
                          <p className="font-semibold">{e.amount.toLocaleString()} EGP</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Regular Expenses */}
              {regularExpenses.map(e => (
                <div key={e.id} data-testid={`expense-${e.id}`} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50 border border-border/50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{e.description || e.category}</p>
                    <p className="text-xs text-muted-foreground">{e.category} · {format(new Date(e.date), 'dd/MM')}</p>
                  </div>
                  <p className="text-sm font-bold text-red-600 flex-shrink-0">{e.amount.toLocaleString()} EGP</p>
                </div>
              ))}
              
              {regularExpenses.length === 0 && totalCoachPayroll === 0 && totalLiabilityPayments === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No expenses recorded this month</p>
              )}
            </CardContent>
          </Card>

          {/* Internal Transfers Log */}
          <Card className="mt-4">
            <CardHeader className="pb-3 flex-shrink-0">
              <CardTitle className="text-sm font-semibold">Internal Transfers Log</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[350px] overflow-y-auto pr-2">
              {filteredTransfers.map(t => (
                <div key={t.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50 border border-border/50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {t.from_account} ➔ {t.to_account}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(t.date), 'dd/MM')}{t.note ? ` - ${t.note}` : ''}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-blue-600 flex-shrink-0">{t.amount.toLocaleString()} EGP</p>
                </div>
              ))}
              {filteredTransfers.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No internal transfers this month</p>
              )}
            </CardContent>
          </Card>
        </div>
        </div>
      </div>

      <Dialog open={showAdjustDialog} onOpenChange={setShowAdjustDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Adjust {adjustMethod} Balance</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Actual Balance ({adjustMethod})</Label>
              <Input 
                type="number" 
                value={actualBalance} 
                onChange={e => setActualBalance(e.target.value)}
                placeholder="Enter current actual balance..."
              />
            </div>
            <p className="text-xs text-muted-foreground">
              The system currently shows {
                adjustMethod === 'Cash' ? globalCashBalance.toLocaleString() :
                adjustMethod === 'Visa' ? globalVisaBalance.toLocaleString() :
                globalInstapayBalance.toLocaleString()
              } EGP.
              <br/><br/>
              If you proceed, the system will automatically create an income or expense transaction named "System Adjustment" to make the balances match.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdjustDialog(false)}>Cancel</Button>
            <Button onClick={handleAdjustBalances} disabled={createInvoice.isPending || createExpense.isPending}>
              {createInvoice.isPending || createExpense.isPending ? "Applying..." : "Apply Adjustment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showStartBalanceDialog} onOpenChange={setShowStartBalanceDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Set Starting Balances</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Start Date</Label>
              <Input 
                type="date" 
                value={startBalancesForm.date} 
                onChange={e => setStartBalancesForm(prev => ({ ...prev, date: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">Transactions before this date will be ignored in the global balance.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Starting Cash</Label>
              <Input 
                type="number" 
                value={startBalancesForm.cash} 
                onChange={e => setStartBalancesForm(prev => ({ ...prev, cash: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Starting Visa</Label>
              <Input 
                type="number" 
                value={startBalancesForm.visa} 
                onChange={e => setStartBalancesForm(prev => ({ ...prev, visa: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Starting InstaPay</Label>
              <Input 
                type="number" 
                value={startBalancesForm.instapay} 
                onChange={e => setStartBalancesForm(prev => ({ ...prev, instapay: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStartBalanceDialog(false)}>Cancel</Button>
            <Button onClick={handleSetStartBalance} disabled={upsertGlobalSettings.isPending}>
              {upsertGlobalSettings.isPending ? "Saving..." : "Save Settings"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Transfer Money</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>From Account</Label>
              <Select value={transferForm.fromAccount} onValueChange={(v: any) => setTransferForm(p => ({...p, fromAccount: v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cash">Cash ({globalCashBalance.toLocaleString()} EGP)</SelectItem>
                  <SelectItem value="Visa">Visa ({globalVisaBalance.toLocaleString()} EGP)</SelectItem>
                  <SelectItem value="InstaPay">InstaPay ({globalInstapayBalance.toLocaleString()} EGP)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>To Account</Label>
              <Select value={transferForm.toAccount} onValueChange={(v: any) => setTransferForm(p => ({...p, toAccount: v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Visa">Visa</SelectItem>
                  <SelectItem value="InstaPay">InstaPay</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input 
                type="datetime-local" 
                value={transferForm.date} 
                onChange={e => setTransferForm(prev => ({ ...prev, date: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Amount (EGP)</Label>
              <Input 
                type="number" 
                value={transferForm.amount} 
                onChange={e => setTransferForm(prev => ({ ...prev, amount: e.target.value }))}
                placeholder="Enter amount..."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Note (Optional)</Label>
              <Input 
                value={transferForm.note} 
                onChange={e => setTransferForm(prev => ({ ...prev, note: e.target.value }))}
                placeholder="e.g. Bank deposit"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTransferDialog(false)}>Cancel</Button>
            <Button onClick={handleTransfer} disabled={createInternalTransfer.isPending}>
              {createInternalTransfer.isPending ? "Transferring..." : "Transfer Money"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const FREQUENCY_LABELS: Record<number, string> = { 7: "weekly", 14: "bi-weekly", 30: "monthly", 90: "quarterly" };
