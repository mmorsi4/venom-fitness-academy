import { useState, useEffect, useRef, useMemo } from "react";
import { useLocation, useSearch } from "wouter";
import { Plus, FileText, CreditCard, Tag, Trash2, Pencil, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { SearchableSelect } from "@/components/SearchableSelect";
import { ExpensesView } from "@/components/ExpensesView";
import { useInvoices, usePackages, useMembers, useDiscounts, useCreateInvoice, useUpdateInvoice, useDeleteInvoice, useCreateAuditLog, useClasses, useCreateJointInvoiceGroup } from "@/hooks/use-data";
import { useAuth } from "@/lib/auth";
import type { Invoice } from "@/lib/types";
import { toast } from "sonner";
import { format } from "date-fns";

const paymentMethods = ["Cash", "Visa", "InstaPay", "Split"];
const paymentStatuses: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-700 border-emerald-200",
  partial: "bg-amber-100 text-amber-700 border-amber-200",
  unpaid: "bg-red-100 text-red-700 border-red-200",
};

type DiscountMode = 'none' | 'group' | 'custom';
type CustomDiscountType = 'fixed' | 'percentage';

const emptyForm = {
  memberId: "", packageId: "", classId: "", paymentMethod: "Cash",
  paidAmount: "",
  discountMode: "none" as DiscountMode,
  discountGroupId: "",
  customDiscountType: "fixed" as CustomDiscountType,
  customDiscountValue: "",
  customDiscountDescription: "",
  invoiceDate: "",
  activationDate: "",
  customId: "",
  splitPayments: [] as { method: string, amount: string }[],
  isFreeMembership: false,
  jointMembersData: [] as {
    memberId: string, classId: string, invoiceDate: string, activationDate: string,
    packageId: string, paidAmount: string, paymentMethod: string, splitPayments: { method: string, amount: string }[]
  }[],
};

export default function Invoices() {
  const { data: invoices = [] } = useInvoices();
  const { data: members = [] } = useMembers();
  const { data: packages = [] } = usePackages();
  const { data: classes = [] } = useClasses();
  const { data: discounts = [] } = useDiscounts();
  const createInvoice = useCreateInvoice();
  const updateInvoice = useUpdateInvoice();
  const deleteInvoice = useDeleteInvoice();
  const createAuditLog = useCreateAuditLog();
  const createJointGroup = useCreateJointInvoiceGroup();
  const { currentUser } = useAuth();

  const [activeMainTab, setActiveMainTab] = useState("invoices");
  const [tab, setTab] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [showVerificationDialog, setShowVerificationDialog] = useState(false);
  const [verificationAction, setVerificationAction] = useState<'create' | 'edit'>('create');
  const [verificationPassword, setVerificationPassword] = useState("");
  const [packageCategoryFilter, setPackageCategoryFilter] = useState<'All' | 'Normal' | 'PT' | 'Clinic'>('All');
  const [form, setForm] = useState(emptyForm);
  const [jointStep, setJointStep] = useState(1);
  const [paymentModalInvoice, setPaymentModalInvoice] = useState<Invoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("Cash");
  const [paymentCustomId, setPaymentCustomId] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>("");
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const hasConsumedParams = useRef(false);

  // Auto-open create dialog when navigating from Members with query params
  useEffect(() => {
    if (hasConsumedParams.current) return;
    const params = new URLSearchParams(searchString);
    const memberId = params.get('memberId');
    const packageId = params.get('packageId');
    if (memberId || packageId) {
      hasConsumedParams.current = true;
      setForm(prev => ({
        ...prev,
        memberId: memberId ?? prev.memberId,
        packageId: packageId ?? prev.packageId,
      }));
      setShowCreate(true);
      // Clean up query params from URL
      navigate('/invoices', { replace: true });
    }
  }, [searchString, navigate]);

  // Edit invoice state
  const [editInvoice, setEditInvoice] = useState<Invoice | null>(null);
  const [editForm, setEditForm] = useState({
    memberId: "",
    packageId: "",
    classId: "",
    discountMode: "none" as DiscountMode,
    discountGroupId: "",
    customDiscountType: "fixed" as CustomDiscountType,
    customDiscountValue: "",
    customDiscountDescription: "",
    paidAmount: "",
    paymentMethod: "Cash",
    splitPayments: [] as { method: string; amount: string }[],
    status: "paid" as any,
    activationDate: "",
    invoiceDate: "",
    customId: "",
    isFreeMembership: false,
  });

  // Delete invoice state
  const [confirmDelete, setConfirmDelete] = useState<Invoice | null>(null);

  // Overpay confirmation state
  const [overpayConfirmAction, setOverpayConfirmAction] = useState<(() => void) | null>(null);
  const [overpayDetails, setOverpayDetails] = useState<{ paid: number, total: number } | null>(null);

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchField, setSearchField] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [filterPaymentMethod, setFilterPaymentMethod] = useState("all");
  const [filterPackage, setFilterPackage] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterActivationDateFrom, setFilterActivationDateFrom] = useState("");
  const [filterActivationDateTo, setFilterActivationDateTo] = useState("");
  const [filterClinicOnly, setFilterClinicOnly] = useState(false);

  const filtered = invoices.filter(i => {
    // Status tab filter
    if (tab !== "all" && i.status !== tab) return false;

    // Smart search logic
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const member = members.find(m => m.uuid === i.member_id);
      const isNumeric = /^\d+$/.test(searchQuery.trim());
      let matchesSearch = false;

      if (searchField === "all") {
        matchesSearch = i.id.toLowerCase().includes(q) ||
          i.member_name.toLowerCase().includes(q) ||
          (member?.phone ?? "").includes(searchQuery.trim());
        if (member?.id !== -1 && isNumeric) {
          matchesSearch = matchesSearch || member?.id.toString() === searchQuery.trim();
        }
      } else if (searchField === "id") {
        matchesSearch = member?.id?.toString() === searchQuery.trim() || i.id.toLowerCase().includes(q);
      } else if (searchField === "name") {
        matchesSearch = i.member_name.toLowerCase().includes(q);
      } else if (searchField === "phone") {
        matchesSearch = (member?.phone ?? "").includes(searchQuery.trim());
      }

      if (!matchesSearch) return false;
    }

    // Payment method filter
    if (filterPaymentMethod !== "all" && i.payment_method !== filterPaymentMethod) return false;

    // Package filter
    if (filterPackage !== "all" && i.package_name !== filterPackage) return false;

    // Date range filter
    if (filterDateFrom) {
      const invoiceDate = new Date(i.created_at);
      if (invoiceDate < new Date(filterDateFrom)) return false;
    }
    if (filterDateTo) {
      const invoiceDate = new Date(i.created_at);
      const toDate = new Date(filterDateTo);
      toDate.setHours(23, 59, 59, 999);
      if (invoiceDate > toDate) return false;
    }

    if (filterClinicOnly) {
      const pkg = packages.find(p => p.id === i.package_id);
      if (!pkg?.is_clinic) return false;
    }

    // Activation Date range filter
    if (filterActivationDateFrom) {
      if (!i.activation_date) return false;
      const activationDate = new Date(i.activation_date);
      if (activationDate < new Date(filterActivationDateFrom)) return false;
    }
    if (filterActivationDateTo) {
      if (!i.activation_date) return false;
      const activationDate = new Date(i.activation_date);
      const toDate = new Date(filterActivationDateTo);
      toDate.setHours(23, 59, 59, 999);
      if (activationDate > toDate) return false;
    }

    return true;
  });

  const selectedPackage = packages.find(p => p.id === form.packageId);
  const selectedMember = members.find(m => m.uuid === form.memberId);
  const createAvailablePackages = packages.filter(p => {
    if (selectedMember?.id === -1 && !p.is_clinic && p.category !== 'Clinic') return false;
    if (packageCategoryFilter !== 'All') {
      if (packageCategoryFilter === 'PT' && !p.is_pt && p.category !== 'PT') return false;
      if (packageCategoryFilter === 'Clinic' && !p.is_clinic && p.category !== 'Clinic') return false;
      if (packageCategoryFilter === 'Normal' && (p.is_pt || p.is_clinic || (p.category && p.category !== 'Normal'))) return false;
    }
    return true;
  });
  const activeDiscounts = discounts.filter(d => d.active);
  const selectedGroup = activeDiscounts.find(d => d.id === form.discountGroupId);

  const computeDiscountAmount = (pkg: any) => {
    if (!pkg) return 0;
    if (form.discountMode === 'group' && selectedGroup) {
      return selectedGroup.discount_type === 'fixed'
        ? selectedGroup.value
        : Math.round(pkg.price * selectedGroup.value / 100);
    } else if (form.discountMode === 'custom' && form.customDiscountValue) {
      if (form.customDiscountType === 'fixed') {
        return Number(form.customDiscountValue) || 0;
      } else {
        return Math.round(pkg.price * (Number(form.customDiscountValue) || 0) / 100);
      }
    }
    return 0;
  };

  const discountAmount = computeDiscountAmount(selectedPackage);

  const total = selectedPackage ? Math.max(0, selectedPackage.price - discountAmount) : 0;
  const paid = form.paymentMethod === 'Split'
    ? form.splitPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
    : (form.paidAmount !== "" ? Number(form.paidAmount) : total);
  const needsDescription = form.discountMode === 'custom' && discountAmount > 0 && !form.customDiscountDescription.trim();

  // Joint Member Derived State
  const currentJointIndex = jointStep - 2;
  const jointData = currentJointIndex >= 0 ? (form.jointMembersData[currentJointIndex] || {}) : {} as any;
  const jointPkg = currentJointIndex >= 0 ? packages.find(p => p.id === (jointData.packageId || form.packageId)) : null;
  const jointDiscountAmount = computeDiscountAmount(jointPkg);
  const jointTotal = jointPkg ? Math.max(0, jointPkg.price - jointDiscountAmount) : 0;
  const jointPaid = jointData.paymentMethod === 'Split'
    ? (jointData.splitPayments || []).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0)
    : (jointData.paidAmount !== undefined && jointData.paidAmount !== "" ? Number(jointData.paidAmount) : jointTotal);

  // Edit form derived state
  const selectedEditPackage = packages.find(p => p.id === editForm.packageId);
  const selectedEditGroup = activeDiscounts.find(d => d.id === editForm.discountGroupId);

  let editDiscountAmount = 0;
  if (editForm.discountMode === 'group' && selectedEditGroup && selectedEditPackage) {
    editDiscountAmount = selectedEditGroup.discount_type === 'fixed'
      ? selectedEditGroup.value
      : Math.round(selectedEditPackage.price * selectedEditGroup.value / 100);
  } else if (editForm.discountMode === 'custom' && editForm.customDiscountValue) {
    if (editForm.customDiscountType === 'fixed') {
      editDiscountAmount = Number(editForm.customDiscountValue) || 0;
    } else if (selectedEditPackage) {
      editDiscountAmount = Math.round(selectedEditPackage.price * (Number(editForm.customDiscountValue) || 0) / 100);
    }
  }

  const editTotal = selectedEditPackage ? Math.max(0, selectedEditPackage.price - editDiscountAmount) : (editInvoice?.total_amount ?? 0);
  const editNeedsDescription = editForm.discountMode === 'custom' && editDiscountAmount > 0 && !editForm.customDiscountDescription.trim();

  const resetForm = () => { setForm(emptyForm); setJointStep(1); };

  const handleCreate = () => {
    if (jointStep === 1) {
      if (!form.memberId || !form.packageId) { toast.error("Select a member and package"); return; }
      if (needsDescription) { toast.error("A reason is required for custom discounts"); return; }

      // if (form.invoiceDate && form.activationDate) {
      //   if (new Date(form.invoiceDate) > new Date(form.activationDate)) {
      //     toast.error("Invoice date cannot be after the activation date.");
      //     return;
      //   }
      // }

      if (form.discountMode === 'custom' && discountAmount > 0) {
        setVerificationAction('create');
        setShowVerificationDialog(true);
        return;
      }
    } else {
      const currentJointIndex = jointStep - 2;
      const data = form.jointMembersData[currentJointIndex];
      if (!data || !data.memberId) { toast.error(`Please select Member #${jointStep}`); return; }
      if (data.invoiceDate && data.activationDate) {
        if (new Date(data.invoiceDate) > new Date(data.activationDate)) {
          toast.error("Invoice date cannot be after the activation date.");
          return;
        }
      }
    }

    proceedCreate();
  };

  const proceedCreate = () => {
    const jointCount = selectedGroup?.is_joint ? selectedGroup.joint_count : 1;
    if (jointStep < jointCount) {
      setJointStep(jointStep + 1);
    } else {
      submitCreate();
    }
  };

  const verifyAndSubmit = () => {
    const correctPassword = import.meta.env.VITE_CUSTOM_DISCOUNT_PASSWORD || "01102611117";
    if (verificationPassword !== correctPassword) {
      toast.error("Incorrect verification password");
      return;
    }
    setShowVerificationDialog(false);
    setVerificationPassword("");
    if (verificationAction === 'create') proceedCreate();
    else submitEdit();
  };

  const submitCreate = async (skipOverpayCheck = false) => {
    const jointCount = selectedGroup?.is_joint ? selectedGroup.joint_count : 1;

    const allMembersData = [{
      memberId: form.memberId,
      classId: form.classId,
      invoiceDate: form.invoiceDate,
      activationDate: form.activationDate
    }];

    if (jointCount > 1) {
      for (let i = 0; i < jointCount - 1; i++) {
        if (form.jointMembersData[i]) {
          allMembersData.push(form.jointMembersData[i]);
        }
      }
    }

    if (selectedGroup?.is_joint && allMembersData.length < jointCount) {
      toast.error(`Please select all ${jointCount} members for this joint discount.`);
      return;
    }

    if (!form.isFreeMembership && !skipOverpayCheck) {
      let totalP = 0;
      let totalT = 0;
      for (let i = 0; i < allMembersData.length; i++) {
        const data = allMembersData[i] as any;
        const isMain = i === 0;
        const memPkg = isMain ? selectedPackage : packages.find(p => p.id === (data.packageId || form.packageId));
        const memDiscount = isMain ? discountAmount : computeDiscountAmount(memPkg);
        const memTotal = memPkg ? Math.max(0, memPkg.price - memDiscount) : 0;
        const memPaid = isMain ? paid : (data.paymentMethod === 'Split'
          ? (data.splitPayments || []).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0)
          : (data.paidAmount !== undefined && data.paidAmount !== "" ? Number(data.paidAmount) : memTotal));
        totalP += memPaid;
        totalT += memTotal;
      }
      if (totalP > totalT) {
        setOverpayConfirmAction(() => () => submitCreate(true));
        setOverpayDetails({ paid: totalP, total: totalT });
        return;
      }
    }

    let jointGroupId: string | null = null;
    if (jointCount > 1) {
      try {
        const group = await createJointGroup.mutateAsync();
        jointGroupId = group.id;
      } catch (err: any) {
        toast.error(`Error creating joint group: ${err.message}`);
        return;
      }
    }

    try {
      for (let i = 0; i < allMembersData.length; i++) {
        const data = allMembersData[i] as any;
        const m = members.find(x => x.uuid === data.memberId);
        if (!m) continue;

        const isMain = i === 0;

        const memPkg = isMain ? selectedPackage : packages.find(p => p.id === (data.packageId || form.packageId));
        let memDiscount = isMain ? discountAmount : computeDiscountAmount(memPkg);
        let memTotal = memPkg ? Math.max(0, memPkg.price - memDiscount) : 0;

        let memPaid = isMain ? paid : (data.paymentMethod === 'Split'
          ? (data.splitPayments || []).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0)
          : (data.paidAmount !== undefined && data.paidAmount !== "" ? Number(data.paidAmount) : memTotal));

        if (memPaid > memTotal) {
          memTotal = memPaid;
        }

        let memInvStatus = memPaid >= memTotal ? 'paid' : memPaid > 0 ? 'partial' : 'unpaid';
        let memPaymentMethod = isMain ? form.paymentMethod : (data.paymentMethod || form.paymentMethod);
        let memSplitPayments = isMain ? form.splitPayments : (data.splitPayments || []);

        let customIdToUse = isMain ? form.customId.trim() : "";

        if (form.isFreeMembership) {
          memDiscount = memPkg ? memPkg.price : 0;
          memTotal = 0;
          memPaid = 0;
          memInvStatus = 'paid';
          memPaymentMethod = 'Cash';
          memSplitPayments = [];
          
          const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
          const cleanName = m.name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 4).toUpperCase();
          customIdToUse = `FREE-${cleanName}-${randomStr}`;
        }

        await createInvoice.mutateAsync({
          member_id: data.memberId,
          member_name: m.name,
          package_id: memPkg?.id || null,
          package_name: memPkg?.name ?? "",
          class_id: data.classId === 'none' ? null : (data.classId || null),
          discount_id: form.discountMode === 'group' ? form.discountGroupId : null,
          discount_description: form.discountMode === 'custom'
            ? form.customDiscountDescription.trim()
            : (selectedGroup?.name ?? null),
          discount_amount: memDiscount,
          total_amount: memTotal,
          paid_amount: memPaid,
          status: memInvStatus,
          payment_method: memPaymentMethod as any,
          split_payments: memPaymentMethod === 'Split' ? memSplitPayments.map((sp: any) => ({ method: sp.method as any, amount: Number(sp.amount) || 0 })) : null,
          created_at: data.invoiceDate ? new Date(data.invoiceDate).toISOString() : new Date().toISOString(),
          activation_date: data.activationDate ? new Date(data.activationDate).toISOString() : (data.invoiceDate ? new Date(data.invoiceDate).toISOString() : new Date().toISOString()),
          joint_invoice_group_id: jointGroupId,
          ...(customIdToUse ? { id: customIdToUse } : {}),
        } as any);
      }

      toast.success(`Invoices created`);
      resetForm();
      setShowCreate(false);
    } catch (err: any) {
      toast.error(`Error creating invoice: ${err.message}`);
    }
  };

  const openEditInvoice = (inv: Invoice) => {
    let mode: DiscountMode = 'none';
    let group = "";
    let customVal = "";
    let customDesc = "";
    let customType: CustomDiscountType = "fixed";

    if (inv.discount_id) {
      mode = 'group';
      group = inv.discount_id;
    } else if (inv.discount_amount > 0) {
      mode = 'custom';
      customVal = String(inv.discount_amount);
      customDesc = inv.discount_description || "";
      customType = "fixed";
    }

    setEditInvoice(inv);
    setEditForm({
      memberId: inv.member_id,
      packageId: inv.package_id || "",
      classId: inv.class_id || "",
      discountMode: mode,
      discountGroupId: group,
      customDiscountType: customType,
      customDiscountValue: customVal,
      customDiscountDescription: customDesc,
      paidAmount: String(inv.paid_amount),
      paymentMethod: inv.payment_method,
      splitPayments: inv.split_payments ? inv.split_payments.map(s => ({ method: s.method, amount: String(s.amount) })) : [],
      status: inv.status,
      activationDate: inv.activation_date ? inv.activation_date.split('T')[0] : "",
      invoiceDate: inv.created_at ? inv.created_at.split('T')[0] : "",
      customId: inv.id,
    });
  };

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginatedInvoices = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleCollectPayment = () => {
    if (!paymentModalInvoice) return;
    const payment = Number(paymentAmount);
    if (isNaN(payment) || payment <= 0) {
      toast.error("Enter a valid payment amount");
      return;
    }
    const remaining = paymentModalInvoice.total_amount - paymentModalInvoice.paid_amount;
    if (payment > remaining) {
      // Allow small overrides but warn
      toast.info(`Note: Payment is ${(payment - remaining).toLocaleString()} EGP over the remaining balance. Proceeding as override.`);
    }

    createInvoice.mutate({
      member_id: paymentModalInvoice.member_id,
      member_name: paymentModalInvoice.member_name,
      package_id: null,
      package_name: `Payment Completion: ${paymentModalInvoice.package_name || 'Invoice'}`,
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
    } as any, {
      onSuccess: () => {
        // Now update the original invoice's paid amount
        const newPaidAmount = paymentModalInvoice.paid_amount + payment;
        const newStatus = newPaidAmount >= paymentModalInvoice.total_amount ? 'paid' : 'partial';
        updateInvoice.mutate({
          uuid: paymentModalInvoice.uuid,
          updates: {
            paid_amount: newPaidAmount,
            status: newStatus
          }
        }, {
          onSuccess: () => {
            createAuditLog.mutate({
              action: 'Collect Payment',
              action_type: 'edit_payment',
              performed_by: currentUser?.id ?? null,
              performer_name: currentUser?.name ?? 'System',
              member_id: paymentModalInvoice.member_id,
              member_name: paymentModalInvoice.member_name,
              timestamp: new Date().toISOString(),
              details: `Collected ${payment} EGP for invoice ${paymentModalInvoice.id}. New paid total: ${newPaidAmount}. Created completion invoice.`
            });
            toast.success("Payment collected and new invoice generated");
            setPaymentModalInvoice(null);
            setPaymentAmount("");
          }
        });
      },
      onError: (err: any) => toast.error(`Error creating payment invoice: ${err.message}`)
    });
  };

  const handleEditInvoice = () => {
    if (!editInvoice) return;
    if (editNeedsDescription) { toast.error("A reason is required for custom discounts"); return; }

    if (editForm.discountMode === 'custom' && editDiscountAmount > 0 && String(editDiscountAmount) !== String(editInvoice.discount_amount)) {
      setVerificationAction('edit');
      setShowVerificationDialog(true);
      return;
    }

    submitEdit();
  };

  const submitEdit = (skipOverpayCheck = false) => {
    if (!editInvoice) return;

    let newPaid = Number(editForm.paidAmount) || 0;
    if (editForm.paymentMethod === 'Split') {
      const splitTotal = editForm.splitPayments.reduce((sum, split) => sum + (Number(split.amount) || 0), 0);
      if (editForm.splitPayments.some(s => !s.amount || Number(s.amount) <= 0)) {
        toast.error("All split payments must have a valid amount");
        return;
      }
      newPaid = splitTotal;
    }

    if (!editForm.isFreeMembership && !skipOverpayCheck && newPaid > editTotal) {
      setOverpayConfirmAction(() => () => submitEdit(true));
      setOverpayDetails({ paid: newPaid, total: editTotal });
      return;
    }

    let finalEditTotal = editTotal;
    if (newPaid > finalEditTotal) {
      finalEditTotal = newPaid;
    }

    const newStatus: 'paid' | 'partial' | 'unpaid' =
      newPaid >= finalEditTotal ? 'paid' : newPaid > 0 ? 'partial' : 'unpaid';

    const selectedEditMember = members.find(m => m.uuid === editForm.memberId);

    updateInvoice.mutate({
      uuid: editInvoice.uuid,
      updates: {
        member_id: editForm.memberId,
        member_name: selectedEditMember?.name ?? editInvoice.member_name,
        package_id: editForm.packageId || null,
        package_name: selectedEditPackage?.name ?? editInvoice.package_name,
        class_id: editForm.classId === 'none' ? null : (editForm.classId || null),
        discount_id: editForm.discountMode === 'group' ? editForm.discountGroupId : null,
        discount_description: editForm.discountMode === 'custom'
          ? editForm.customDiscountDescription.trim()
          : (selectedEditGroup?.name ?? null),
        discount_amount: editDiscountAmount,
        total_amount: finalEditTotal,
        paid_amount: newPaid,
        payment_method: editForm.paymentMethod as any,
        split_payments: editForm.paymentMethod === 'Split' ? editForm.splitPayments.map((sp: any) => ({ method: sp.method as any, amount: Number(sp.amount) || 0 })) : null,
        status: newStatus,
        activation_date: editForm.activationDate ? new Date(editForm.activationDate).toISOString() : editInvoice.activation_date,
        created_at: editForm.invoiceDate ? new Date(editForm.invoiceDate).toISOString() : editInvoice.created_at,
        id: editForm.customId.trim() || undefined,
      }
    }, {
      onSuccess: () => {
        createAuditLog.mutate({
          action: 'Edit Invoice',
          action_type: 'edit_payment',
          performed_by: currentUser?.id ?? null,
          performer_name: currentUser?.name ?? 'System',
          member_id: editInvoice.member_id,
          member_name: editInvoice.member_name,
          timestamp: new Date().toISOString(),
          details: `Full edited invoice ${editInvoice.id}: Member: ${selectedEditMember?.name}, Pkg: ${selectedEditPackage?.name}, paid ${editInvoice.paid_amount} → ${newPaid} EGP, method: ${editForm.paymentMethod}`,
        });
        toast.success(`Invoice ${editInvoice.id} updated`);
        setEditInvoice(null);
      },
      onError: (err: any) => toast.error(`Error: ${err.message}`),
    });
  };

  const handleDeleteInvoice = (inv: Invoice) => {
    const invoicesToDelete = inv.joint_invoice_group_id 
      ? invoices.filter(i => i.joint_invoice_group_id === inv.joint_invoice_group_id)
      : [inv];

    invoicesToDelete.forEach(i => {
      deleteInvoice.mutate(i.uuid, {
        onSuccess: () => {
          createAuditLog.mutate({
            action: 'Delete Invoice',
            action_type: 'other',
            performed_by: currentUser?.id ?? null,
            performer_name: currentUser?.name ?? 'System',
            member_id: null,
            member_name: i.member_name,
            timestamp: new Date().toISOString(),
            details: `Hard deleted invoice ${i.id} for ${i.member_name}, amount: ${i.total_amount} EGP`,
          });
        },
        onError: (err) => toast.error(`Error deleting invoice: ${err.message}`),
      });
    });

    toast.success(`${invoicesToDelete.length} invoice(s) deleted`);
    setConfirmDelete(null);
  };

  const counts = {
    all: invoices.length,
    paid: invoices.filter(i => i.status === 'paid').length,
    partial: invoices.filter(i => i.status === 'partial').length,
    unpaid: invoices.filter(i => i.status === 'unpaid').length,
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Accounting</h1>
          <p className="text-sm text-muted-foreground">Manage your invoices and expenses</p>
        </div>
        <Tabs value={activeMainTab} onValueChange={setActiveMainTab} className="w-full sm:w-auto">
          <TabsList className="grid w-full sm:w-[300px] grid-cols-2">
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="expenses">Expenses</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {activeMainTab === 'expenses' ? (
        <ExpensesView />
      ) : (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-foreground">Invoices List</h2>
              <p className="text-sm text-muted-foreground">{invoices.length} total invoices</p>
            </div>
            <Button data-testid="btn-create-invoice" onClick={() => setShowCreate(true)} className="gap-2">
              <Plus className="w-4 h-4" /> New Invoice
            </Button>
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
              <TabsTrigger value="paid">Paid ({counts.paid})</TabsTrigger>
              <TabsTrigger value="partial">Partial ({counts.partial})</TabsTrigger>
              <TabsTrigger value="unpaid">Unpaid ({counts.unpaid})</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
            <div className="flex flex-wrap gap-2">
              <Select value={searchField} onValueChange={setSearchField}>
                <SelectTrigger className="w-[130px] h-9">
                  <SelectValue placeholder="Search by..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Fields</SelectItem>
                  <SelectItem value="id">ID / Invoice #</SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="phone">Phone</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search invoices..."
                  className="pl-9 h-9"
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                />
              </div>
            </div>
            <Select value={filterPaymentMethod} onValueChange={setFilterPaymentMethod}>
              <SelectTrigger className="w-36" data-testid="filter-payment-method">
                <SelectValue placeholder="Payment..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Methods</SelectItem>
                {paymentMethods.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterPackage} onValueChange={setFilterPackage}>
              <SelectTrigger className="w-40" data-testid="filter-package">
                <SelectValue placeholder="Package..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Packages</SelectItem>
                {[...new Set(invoices.map(i => i.package_name).filter(Boolean))].map(p => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={filterDateFrom}
              onChange={e => setFilterDateFrom(e.target.value)}
              className="w-36"
              title="From date"
            />
            <Input
              type="date"
              value={filterDateTo}
              onChange={e => setFilterDateTo(e.target.value)}
              className="w-36"
              title="To date"
            />
            <div className="flex items-center space-x-2 bg-muted/30 px-3 rounded-md border border-border/50">
              <input
                type="checkbox"
                id="clinic-invoices-toggle"
                checked={filterClinicOnly}
                onChange={(e) => setFilterClinicOnly(e.target.checked)}
                className="rounded border-gray-300 text-primary focus:ring-primary"
              />
              <Label htmlFor="clinic-invoices-toggle" className="text-sm font-medium leading-none cursor-pointer">
                Clinic Only
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Label className="text-xs text-muted-foreground shrink-0">Activation Date:</Label>
              <Input
                type="date"
                value={filterActivationDateFrom}
                onChange={e => setFilterActivationDateFrom(e.target.value)}
                className="w-36"
                title="From activation date"
              />
              <Input
                type="date"
                value={filterActivationDateTo}
                onChange={e => setFilterActivationDateTo(e.target.value)}
                className="w-36"
                title="To activation date"
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <Card><CardContent className="py-12 text-center"><p className="text-muted-foreground">No invoices</p></CardContent></Card>
          ) : (
            <div className="rounded-md border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Member ID</TableHead>
                    <TableHead>Member Name</TableHead>
                    <TableHead>Package</TableHead>
                    <TableHead>Creation Date</TableHead>
                    <TableHead>Status & Payment</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedInvoices.map(inv => {
                    const shortId = members.find(m => m.uuid === inv.member_id)?.id;
                    const jointRelated = inv.joint_invoice_group_id ? invoices.filter(i => i.joint_invoice_group_id === inv.joint_invoice_group_id && i.uuid !== inv.uuid) : [];

                    return (
                      <TableRow key={inv.uuid} data-testid={`invoice-${inv.uuid}`}>
                        <TableCell className="font-bold text-xs text-muted-foreground">
                          {inv.id}
                        </TableCell>
                        <TableCell className="text-sm font-medium text-muted-foreground">{shortId === -1 ? 'Clinic Visitor' : (shortId ?? '?')}</TableCell>
                        <TableCell className="font-medium text-sm">
                          {inv.member_name}
                          {inv.id.startsWith("FREE-") && (
                            <div className="mt-1">
                              <span className="text-[10px] text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-md inline-block max-w-fit font-bold">
                                Free Membership
                              </span>
                            </div>
                          )}
                          {jointRelated.length > 0 && (
                            <div className="mt-1 flex flex-col gap-0.5">
                              {jointRelated.map(j => (
                                <span key={j.uuid} className="text-[10px] text-primary/80 bg-primary/10 px-1.5 py-0.5 rounded-md inline-block max-w-fit">
                                  Joint with: {j.id} - {j.member_name}
                                </span>
                              ))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{inv.package_name}</TableCell>
                        <TableCell className="text-sm">{format(new Date(inv.created_at), "dd/MM/yyyy")}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1 items-start">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${paymentStatuses[inv.status]}`}>
                              {inv.status}
                            </span>
                            <div className="flex flex-col gap-0.5 text-xs text-muted-foreground mt-1">
                              {inv.payment_method === 'Split' && inv.split_payments ? (
                                inv.split_payments.map((sp, idx) => (
                                  <div key={idx} className="flex items-center gap-1 text-[10px]">
                                    <CreditCard className="w-3 h-3" /> {sp.method}: {sp.amount}
                                  </div>
                                ))
                              ) : (
                                <div className="flex items-center gap-1">
                                  <CreditCard className="w-3 h-3" /> {inv.payment_method}
                                </div>
                              )}
                            </div>
                            {inv.status === 'partial' && (
                              <div className="space-y-1">
                                <p className="text-[10px] text-muted-foreground">Paid: {inv.paid_amount} / {inv.total_amount}</p>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="h-6 text-[10px] px-2"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPaymentModalInvoice(inv);
                                  }}
                                >
                                  Collect
                                </Button>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <p className="text-sm font-bold">{inv.total_amount.toLocaleString()} EGP</p>
                          {inv.discount_amount > 0 && (
                            <div className="flex items-center gap-1 justify-end text-muted-foreground mt-0.5">
                              <Tag className="w-3 h-3" />
                              <p className="text-[10px]">-{inv.discount_amount} EGP</p>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 justify-end">
                            <button
                              data-testid={`btn-edit-invoice-${inv.uuid}`}
                              onClick={() => openEditInvoice(inv)}
                              className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              data-testid={`btn-delete-invoice-${inv.uuid}`}
                              onClick={() => setConfirmDelete(inv)}
                              className="p-1.5 rounded-md hover:bg-red-50 transition-colors text-muted-foreground hover:text-red-600"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              <div className="flex items-center justify-between p-4 border-t">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Rows per page:</span>
                  <Select value={pageSize.toString()} onValueChange={v => { setPageSize(Number(v)); setCurrentPage(1); }}>
                    <SelectTrigger className="w-[70px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground mr-4">
                    Page {currentPage} of {totalPages === 0 ? 1 : totalPages} ({filtered.length} total)
                  </span>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages || totalPages === 0}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Create Invoice Dialog */}
          <Dialog open={showCreate} onOpenChange={v => { if (!v) resetForm(); setShowCreate(v); }}>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>{jointStep === 1 ? "New Invoice" : `Member #${jointStep}`}</DialogTitle></DialogHeader>
              <div className="space-y-4 py-2 max-h-[72vh] overflow-y-auto pr-1">

                {jointStep === 1 ? (
                  <>
                    <div className="space-y-1.5">
                      <Label>{selectedGroup?.is_joint ? "Primary Member" : "Member"}</Label>
                      <SearchableSelect
                        data-testid="select-invoice-member"
                        options={members.map(m => ({
                          value: m.uuid,
                          label: `${m.name} (${m.id === -1 ? 'Clinic Visitor' : m.id})`,
                          searchTerms: `${m.phone} ${m.id}`,
                        }))}
                        value={form.memberId}
                        onValueChange={v => setForm(p => ({ ...p, memberId: v }))}
                        placeholder="Search member by name, phone, or ID..."
                        searchPlaceholder="Type name, phone, or member ID..."
                        emptyMessage="No members found"
                      />
                    </div>



                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label>Package</Label>
                        <Tabs value={packageCategoryFilter} onValueChange={(v: any) => setPackageCategoryFilter(v)} className="w-[200px]">
                          <TabsList className="grid w-full grid-cols-4 h-7 text-[10px]">
                            <TabsTrigger value="All" className="text-[10px]">All</TabsTrigger>
                            <TabsTrigger value="Normal" className="text-[10px]">Gym</TabsTrigger>
                            <TabsTrigger value="PT" className="text-[10px]">PT</TabsTrigger>
                            <TabsTrigger value="Clinic" className="text-[10px]">Clinic</TabsTrigger>
                          </TabsList>
                        </Tabs>
                      </div>
                      <SearchableSelect
                        options={createAvailablePackages.map(p => ({ value: p.id, label: `${p.name} — ${p.price} EGP`, searchTerms: p.category }))}
                        value={form.packageId}
                        onValueChange={v => setForm(p => ({ ...p, packageId: v }))}
                        placeholder="Select package..."
                        searchPlaceholder="Search packages..."
                        data-testid="select-invoice-package"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Class (Optional)</Label>
                      <Select value={form.classId} onValueChange={v => setForm(p => ({ ...p, classId: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {classes.map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Discount */}
                    <div className="space-y-3">
                      <Label>Discount</Label>
                      <div className="flex gap-2">
                        {(['none', 'group', 'custom'] as DiscountMode[]).map(mode => (
                          <button
                            key={mode}
                            onClick={() => setForm(p => ({ ...p, discountMode: mode, discountGroupId: '', customDiscountValue: '', customDiscountDescription: '' }))}
                            className={`flex-1 py-1.5 px-2 rounded-lg border text-xs font-medium transition-colors ${form.discountMode === mode ? 'bg-primary text-primary-foreground border-primary' : 'bg-card hover:bg-accent'}`}
                          >
                            {mode === 'none' ? 'No Discount' : mode === 'group' ? 'Discount Group' : 'Custom'}
                          </button>
                        ))}
                      </div>

                      {form.discountMode === 'group' && (
                        <div className="space-y-1.5">
                          <Select value={form.discountGroupId} onValueChange={v => setForm(p => ({ ...p, discountGroupId: v }))}>
                            <SelectTrigger><SelectValue placeholder="Select discount group..." /></SelectTrigger>
                            <SelectContent>
                              {activeDiscounts.length === 0
                                ? <SelectItem value="__none__" disabled>No active groups</SelectItem>
                                : activeDiscounts.map(d => (
                                  <SelectItem key={d.id} value={d.id}>
                                    {d.name} ({d.discount_type === 'fixed' ? `${d.value} EGP` : `${d.value}%`})
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                          {selectedGroup && selectedPackage && (
                            <p className="text-xs text-emerald-600 font-medium">Applied: -{discountAmount} EGP off {selectedPackage.price} EGP</p>
                          )}
                        </div>
                      )}

                      {form.discountMode === 'custom' && (
                        <div className="space-y-3">
                          {/* Fixed / Percentage toggle */}
                          <div className="flex gap-2">
                            {(['fixed', 'percentage'] as CustomDiscountType[]).map(t => (
                              <button
                                key={t}
                                onClick={() => setForm(p => ({ ...p, customDiscountType: t, customDiscountValue: '' }))}
                                className={`flex-1 py-1.5 rounded-lg border text-xs font-medium transition-colors ${form.customDiscountType === t ? 'bg-foreground text-background border-foreground' : 'bg-card hover:bg-accent'}`}
                              >
                                {t === 'fixed' ? 'Fixed Amount (EGP)' : 'Percentage (%)'}
                              </button>
                            ))}
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">
                              {form.customDiscountType === 'fixed' ? 'Discount Amount (EGP)' : 'Discount (%)'}
                            </Label>
                            <Input
                              data-testid="input-invoice-discount"
                              type="number" min="0"
                              max={form.customDiscountType === 'percentage' ? "100" : undefined}
                              placeholder={form.customDiscountType === 'fixed' ? '0' : '0 – 100'}
                              value={form.customDiscountValue}
                              onChange={e => setForm(p => ({ ...p, customDiscountValue: e.target.value }))}
                            />
                            {form.customDiscountType === 'percentage' && selectedPackage && form.customDiscountValue && (
                              <p className="text-xs text-muted-foreground">= {discountAmount} EGP off</p>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Reason for Discount *</Label>
                            <Textarea
                              data-testid="input-invoice-discount-reason"
                              placeholder="Required: explain why this discount is applied..."
                              value={form.customDiscountDescription}
                              onChange={e => setForm(p => ({ ...p, customDiscountDescription: e.target.value }))}
                              rows={2}
                              className={needsDescription ? 'border-red-400' : ''}
                            />
                            {needsDescription && <p className="text-xs text-red-500">Required when applying a custom discount</p>}
                          </div>
                        </div>
                      )}
                    </div>

                    {!form.isFreeMembership && (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Payment Method</Label>
                        <Select value={form.paymentMethod} onValueChange={v => {
                          setForm(p => ({
                            ...p,
                            paymentMethod: v,
                            splitPayments: v === 'Split' && p.splitPayments.length === 0 ? [{ method: 'Cash', amount: '' }] : p.splitPayments
                          }));
                        }}>
                          <SelectTrigger data-testid="select-invoice-method"><SelectValue /></SelectTrigger>
                          <SelectContent>{paymentMethods.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Amount Paid (EGP)</Label>
                        {form.paymentMethod === 'Split' ? (
                          <div className="flex h-9 items-center px-3 border rounded-md bg-muted/50 text-muted-foreground text-sm">
                            {paid}
                          </div>
                        ) : (
                          <Input
                            data-testid="input-invoice-paid"
                            type="number" placeholder={String(total)}
                            value={form.paidAmount}
                            onChange={e => setForm(p => ({ ...p, paidAmount: e.target.value }))}
                          />
                        )}
                      </div>
                    </div>

                    {form.paymentMethod === 'Split' && (
                      <div className="space-y-3 p-3 border rounded-md bg-muted/20">
                        <div className="flex items-center justify-between">
                          <Label>Split Payment Details</Label>
                          <Button
                            variant="outline" size="sm" className="h-7 text-xs"
                            onClick={() => setForm(p => ({ ...p, splitPayments: [...p.splitPayments, { method: 'Cash', amount: '' }] }))}
                          >
                            <Plus className="w-3 h-3 mr-1" /> Add Payment
                          </Button>
                        </div>
                        {form.splitPayments.map((sp, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <Select
                              value={sp.method}
                              onValueChange={v => {
                                const newSp = [...form.splitPayments];
                                newSp[idx].method = v;
                                setForm(p => ({ ...p, splitPayments: newSp }));
                              }}
                            >
                              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {["Cash", "Visa", "InstaPay"].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <Input
                              type="number" placeholder="Amount"
                              value={sp.amount}
                              onChange={e => {
                                const newSp = [...form.splitPayments];
                                newSp[idx].amount = e.target.value;
                                setForm(p => ({ ...p, splitPayments: newSp }));
                              }}
                            />
                            <Button
                              variant="ghost" size="icon" className="text-red-500 shrink-0"
                              disabled={form.splitPayments.length <= 1}
                              onClick={() => {
                                const newSp = form.splitPayments.filter((_, i) => i !== idx);
                                setForm(p => ({ ...p, splitPayments: newSp }));
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                        )}
                      </>
                    )}

                    {/* Free Membership Toggle */}
                    <div className="flex items-center justify-between p-3 border rounded-md bg-emerald-50 border-emerald-100">
                      <div>
                        <Label className="text-emerald-800 font-bold">Free Membership</Label>
                        <p className="text-xs text-emerald-600">Marks invoice as fully paid with 0 EGP</p>
                      </div>
                      <Switch 
                        checked={form.isFreeMembership} 
                        onCheckedChange={c => setForm(p => ({ ...p, isFreeMembership: c }))} 
                      />
                    </div>

                    {/* Custom Invoice ID */}
                    {!form.isFreeMembership && (
                    <div className="space-y-1.5">
                      <Label>Custom Invoice ID</Label>
                      <Input
                        placeholder="Leave empty for auto-generated"
                        value={form.customId}
                        onChange={e => setForm(p => ({ ...p, customId: e.target.value }))}
                      />
                    </div>
                    )}

                    {/* Invoice Date & Activation Date */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Invoice Date</Label>
                        <Input
                          type="date"
                          data-testid="input-invoice-date"
                          value={form.invoiceDate}
                          onChange={e => setForm(p => ({ ...p, invoiceDate: e.target.value }))}
                        />
                        <p className="text-[10px] text-muted-foreground">Leave empty for today</p>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Activation Date</Label>
                        <Input
                          type="date"
                          data-testid="input-activation-date"
                          value={form.activationDate}
                          onChange={e => setForm(p => ({ ...p, activationDate: e.target.value }))}
                        />
                        <p className="text-[10px] text-muted-foreground">Leave empty to activate today</p>
                      </div>
                    </div>

                    {selectedPackage && (
                      <div className="p-3 rounded-lg bg-muted/50 text-sm space-y-1">
                        <div className="flex justify-between"><span className="text-muted-foreground">Package price</span><span>{selectedPackage.price} EGP</span></div>
                        {discountAmount > 0 && (
                          <div className="flex justify-between text-emerald-600">
                            <span>Discount</span><span>-{discountAmount} EGP</span>
                          </div>
                        )}
                        <div className="flex justify-between font-bold pt-1 border-t border-border"><span>Total</span><span>{total} EGP</span></div>
                        <div className="flex justify-between text-muted-foreground"><span>Status</span><span className="capitalize">{paid >= total ? 'Paid' : paid > 0 ? 'Partial' : 'Unpaid'}</span></div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {/* Secondary Member Fields */}
                    <div className="space-y-1.5">
                      <Label>Member #{jointStep}</Label>
                      <SearchableSelect
                        options={members
                          .filter(m => {
                            const pickedMemberIds = [
                              form.memberId,
                              ...form.jointMembersData.map((d, i) => i !== (jointStep - 2) ? d.memberId : null)
                            ].filter(Boolean);
                            return !pickedMemberIds.includes(m.uuid);
                          })
                          .map(m => ({
                            value: m.uuid,
                            label: `${m.name} (${m.id === -1 ? 'Clinic Visitor' : m.id})`,
                            searchTerms: `${m.phone} ${m.id}`,
                          }))}
                        value={form.jointMembersData[jointStep - 2]?.memberId || ""}
                        onValueChange={v => {
                          const newData = [...form.jointMembersData];
                          if (!newData[jointStep - 2]) newData[jointStep - 2] = { memberId: v, classId: "", invoiceDate: "", activationDate: "", packageId: "", paidAmount: "", paymentMethod: "Cash", splitPayments: [] };
                          else newData[jointStep - 2].memberId = v;
                          setForm(p => ({ ...p, jointMembersData: newData }));
                        }}
                        placeholder="Search member by name, phone, or ID..."
                        searchPlaceholder="Type name, phone, or member ID..."
                        emptyMessage="No members found"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Class (Optional)</Label>
                      <Select
                        value={form.jointMembersData[jointStep - 2]?.classId || ""}
                        onValueChange={v => {
                          const newData = [...form.jointMembersData];
                          if (!newData[jointStep - 2]) newData[jointStep - 2] = { memberId: "", classId: v, invoiceDate: "", activationDate: "", packageId: "", paidAmount: "", paymentMethod: "Cash", splitPayments: [] };
                          else newData[jointStep - 2].classId = v;
                          setForm(p => ({ ...p, jointMembersData: newData }));
                        }}
                      >
                        <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {classes.map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label>Package</Label>
                        <Tabs value={packageCategoryFilter} onValueChange={(v: any) => setPackageCategoryFilter(v)} className="w-[200px]">
                          <TabsList className="grid w-full grid-cols-4 h-7 text-[10px]">
                            <TabsTrigger value="All" className="text-[10px]">All</TabsTrigger>
                            <TabsTrigger value="Normal" className="text-[10px]">Gym</TabsTrigger>
                            <TabsTrigger value="PT" className="text-[10px]">PT</TabsTrigger>
                            <TabsTrigger value="Clinic" className="text-[10px]">Clinic</TabsTrigger>
                          </TabsList>
                        </Tabs>
                      </div>
                      <SearchableSelect
                        options={createAvailablePackages.map(p => ({ value: p.id, label: `${p.name} — ${p.price} EGP`, searchTerms: p.category }))}
                        value={form.jointMembersData[jointStep - 2]?.packageId || form.packageId}
                        onValueChange={v => {
                          const newData = [...form.jointMembersData];
                          if (!newData[jointStep - 2]) newData[jointStep - 2] = { memberId: "", classId: "", invoiceDate: "", activationDate: "", packageId: v, paidAmount: "", paymentMethod: "Cash", splitPayments: [] };
                          else newData[jointStep - 2].packageId = v;
                          setForm(p => ({ ...p, jointMembersData: newData }));
                        }}
                        placeholder="Select package..."
                        searchPlaceholder="Search packages..."
                      />
                      <p className="text-[10px] font-medium text-emerald-600">Discount applied: -{jointDiscountAmount} EGP (Total: {jointTotal} EGP)</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Invoice Date</Label>
                        <Input
                          type="date"
                          value={form.jointMembersData[jointStep - 2]?.invoiceDate || ""}
                          onChange={e => {
                            const newData = [...form.jointMembersData];
                            if (!newData[jointStep - 2]) newData[jointStep - 2] = { memberId: "", classId: "", invoiceDate: e.target.value, activationDate: "", packageId: form.packageId, paidAmount: "", paymentMethod: form.paymentMethod, splitPayments: [] };
                            else newData[jointStep - 2].invoiceDate = e.target.value;
                            setForm(p => ({ ...p, jointMembersData: newData }));
                          }}
                        />
                        <p className="text-[10px] text-muted-foreground">Leave empty to mirror primary</p>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Activation Date</Label>
                        <Input
                          type="date"
                          value={form.jointMembersData[jointStep - 2]?.activationDate || ""}
                          onChange={e => {
                            const newData = [...form.jointMembersData];
                            if (!newData[jointStep - 2]) newData[jointStep - 2] = { memberId: "", classId: "", invoiceDate: "", activationDate: e.target.value, packageId: form.packageId, paidAmount: "", paymentMethod: form.paymentMethod, splitPayments: [] };
                            else newData[jointStep - 2].activationDate = e.target.value;
                            setForm(p => ({ ...p, jointMembersData: newData }));
                          }}
                        />
                        <p className="text-[10px] text-muted-foreground">Leave empty to mirror primary</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Payment Method</Label>
                        <Select
                          value={form.jointMembersData[jointStep - 2]?.paymentMethod || form.paymentMethod}
                          onValueChange={v => {
                            const newData = [...form.jointMembersData];
                            if (!newData[jointStep - 2]) newData[jointStep - 2] = { memberId: "", classId: "", invoiceDate: "", activationDate: "", packageId: form.packageId, paidAmount: "", paymentMethod: v, splitPayments: v === 'Split' ? [{ method: 'Cash', amount: '' }] : [] };
                            else {
                              newData[jointStep - 2].paymentMethod = v;
                              if (v === 'Split' && (!newData[jointStep - 2].splitPayments || newData[jointStep - 2].splitPayments.length === 0)) {
                                newData[jointStep - 2].splitPayments = [{ method: 'Cash', amount: '' }];
                              }
                            }
                            setForm(p => ({ ...p, jointMembersData: newData }));
                          }}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{paymentMethods.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Amount Paid (EGP)</Label>
                        {(form.jointMembersData[jointStep - 2]?.paymentMethod || form.paymentMethod) === 'Split' ? (
                          <div className="flex h-9 items-center px-3 border rounded-md bg-muted/50 text-muted-foreground text-sm">
                            {jointPaid}
                          </div>
                        ) : (
                          <Input
                            type="number" placeholder={String(jointTotal)}
                            value={form.jointMembersData[jointStep - 2]?.paidAmount ?? ""}
                            onChange={e => {
                              const newData = [...form.jointMembersData];
                              if (!newData[jointStep - 2]) newData[jointStep - 2] = { memberId: "", classId: "", invoiceDate: "", activationDate: "", packageId: form.packageId, paidAmount: e.target.value, paymentMethod: form.paymentMethod, splitPayments: [] };
                              else newData[jointStep - 2].paidAmount = e.target.value;
                              setForm(p => ({ ...p, jointMembersData: newData }));
                            }}
                          />
                        )}
                      </div>
                    </div>

                    {(form.jointMembersData[jointStep - 2]?.paymentMethod || form.paymentMethod) === 'Split' && (
                      <div className="space-y-3 p-3 border rounded-md bg-muted/20">
                        <div className="flex items-center justify-between">
                          <Label>Split Payment Details</Label>
                          <Button
                            variant="outline" size="sm" className="h-7 text-xs"
                            onClick={() => {
                              const newData = [...form.jointMembersData];
                              if (!newData[jointStep - 2]) newData[jointStep - 2] = { memberId: "", classId: "", invoiceDate: "", activationDate: "", packageId: form.packageId, paidAmount: "", paymentMethod: "Split", splitPayments: [{ method: 'Cash', amount: '' }] };
                              else {
                                if (!newData[jointStep - 2].splitPayments) newData[jointStep - 2].splitPayments = [];
                                newData[jointStep - 2].splitPayments.push({ method: 'Cash', amount: '' });
                              }
                              setForm(p => ({ ...p, jointMembersData: newData }));
                            }}
                          >
                            <Plus className="w-3 h-3 mr-1" /> Add Payment
                          </Button>
                        </div>
                        {(form.jointMembersData[jointStep - 2]?.splitPayments || form.splitPayments || []).map((sp, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <Select
                              value={sp.method}
                              onValueChange={v => {
                                const newData = [...form.jointMembersData];
                                if (!newData[jointStep - 2]) return;
                                if (!newData[jointStep - 2].splitPayments) newData[jointStep - 2].splitPayments = [];
                                newData[jointStep - 2].splitPayments[idx].method = v;
                                setForm(p => ({ ...p, jointMembersData: newData }));
                              }}
                            >
                              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {["Cash", "Visa", "InstaPay"].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <Input
                              type="number" placeholder="Amount"
                              value={sp.amount}
                              onChange={e => {
                                const newData = [...form.jointMembersData];
                                if (!newData[jointStep - 2]) return;
                                if (!newData[jointStep - 2].splitPayments) newData[jointStep - 2].splitPayments = [];
                                newData[jointStep - 2].splitPayments[idx].amount = e.target.value;
                                setForm(p => ({ ...p, jointMembersData: newData }));
                              }}
                            />
                            <Button
                              variant="ghost" size="icon" className="text-red-500 shrink-0"
                              disabled={(form.jointMembersData[jointStep - 2]?.splitPayments || form.splitPayments || []).length <= 1}
                              onClick={() => {
                                const newData = [...form.jointMembersData];
                                if (!newData[jointStep - 2]) return;
                                if (!newData[jointStep - 2].splitPayments) return;
                                newData[jointStep - 2].splitPayments = newData[jointStep - 2].splitPayments.filter((_, i) => i !== idx);
                                setForm(p => ({ ...p, jointMembersData: newData }));
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { resetForm(); setShowCreate(false); }}>Cancel</Button>
                <Button data-testid="btn-save-invoice" onClick={handleCreate} disabled={createInvoice.isPending}>
                  {createInvoice.isPending ? "Processing..." : (jointStep < (selectedGroup?.is_joint ? selectedGroup.joint_count : 1) ? `Next: Member #${jointStep + 1}` : "Create Invoice")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Edit Invoice Dialog */}
          <Dialog open={!!editInvoice} onOpenChange={o => !o && setEditInvoice(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Edit Invoice: {editInvoice?.id}</DialogTitle></DialogHeader>
              <div className="space-y-4 py-2 max-h-[72vh] overflow-y-auto pr-1">
                <div className="space-y-1.5">
                  <Label>Member</Label>
                  <SearchableSelect
                    options={members.map(m => ({
                      value: m.uuid,
                      label: `${m.name} (${m.id === -1 ? 'Clinic Visitor' : m.id})`,
                      searchTerms: `${m.phone} ${m.id}`,
                    }))}
                    value={editForm.memberId}
                    onValueChange={v => setEditForm(p => ({ ...p, memberId: v }))}
                    placeholder="Search member..."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Package</Label>
                  <SearchableSelect
                    options={packages.map(p => ({ value: p.id, label: `${p.name} — ${p.price} EGP`, searchTerms: p.category }))}
                    value={editForm.packageId}
                    onValueChange={v => setEditForm(p => ({ ...p, packageId: v }))}
                    placeholder="Select package..."
                    searchPlaceholder="Search packages..."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Class (Optional)</Label>
                  <Select value={editForm.classId} onValueChange={v => setEditForm(p => ({ ...p, classId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {classes.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Discount */}
                <div className="space-y-3">
                  <Label>Discount</Label>
                  <div className="flex gap-2">
                    {(['none', 'group', 'custom'] as DiscountMode[]).map(mode => (
                      <button
                        key={mode}
                        onClick={() => setEditForm(p => ({ ...p, discountMode: mode, discountGroupId: '', customDiscountValue: '', customDiscountDescription: '' }))}
                        className={`flex-1 py-1.5 px-2 rounded-lg border text-xs font-medium transition-colors ${editForm.discountMode === mode ? 'bg-primary text-primary-foreground border-primary' : 'bg-card hover:bg-accent'}`}
                      >
                        {mode === 'none' ? 'No Discount' : mode === 'group' ? 'Discount Group' : 'Custom'}
                      </button>
                    ))}
                  </div>

                  {editForm.discountMode === 'group' && (
                    <div className="space-y-1.5">
                      <Select value={editForm.discountGroupId} onValueChange={v => setEditForm(p => ({ ...p, discountGroupId: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select discount group..." /></SelectTrigger>
                        <SelectContent>
                          {activeDiscounts.length === 0
                            ? <SelectItem value="__none__" disabled>No active groups</SelectItem>
                            : activeDiscounts.map(d => (
                              <SelectItem key={d.id} value={d.id}>
                                {d.name} ({d.discount_type === 'fixed' ? `${d.value} EGP` : `${d.value}%`})
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      {selectedEditGroup && selectedEditPackage && (
                        <p className="text-xs text-emerald-600 font-medium">Applied: -{editDiscountAmount} EGP off {selectedEditPackage.price} EGP</p>
                      )}
                    </div>
                  )}

                  {editForm.discountMode === 'custom' && (
                    <div className="space-y-3">
                      {/* Fixed / Percentage toggle */}
                      <div className="flex gap-2">
                        {(['fixed', 'percentage'] as CustomDiscountType[]).map(t => (
                          <button
                            key={t}
                            onClick={() => setEditForm(p => ({ ...p, customDiscountType: t, customDiscountValue: '' }))}
                            className={`flex-1 py-1.5 rounded-lg border text-xs font-medium transition-colors ${editForm.customDiscountType === t ? 'bg-foreground text-background border-foreground' : 'bg-card hover:bg-accent'}`}
                          >
                            {t === 'fixed' ? 'Fixed Amount (EGP)' : 'Percentage (%)'}
                          </button>
                        ))}
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">
                          {editForm.customDiscountType === 'fixed' ? 'Discount Amount (EGP)' : 'Discount (%)'}
                        </Label>
                        <Input
                          type="number" min="0"
                          max={editForm.customDiscountType === 'percentage' ? "100" : undefined}
                          placeholder={editForm.customDiscountType === 'fixed' ? '0' : '0 – 100'}
                          value={editForm.customDiscountValue}
                          onChange={e => setEditForm(p => ({ ...p, customDiscountValue: e.target.value }))}
                        />
                        {editForm.customDiscountType === 'percentage' && selectedEditPackage && editForm.customDiscountValue && (
                          <p className="text-xs text-muted-foreground">= {editDiscountAmount} EGP off</p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Reason for Discount *</Label>
                        <Textarea
                          placeholder="Required: explain why this discount is applied..."
                          value={editForm.customDiscountDescription}
                          onChange={e => setEditForm(p => ({ ...p, customDiscountDescription: e.target.value }))}
                          rows={2}
                          className={editNeedsDescription ? 'border-red-400' : ''}
                        />
                        {editNeedsDescription && <p className="text-xs text-red-500">Required when applying a custom discount</p>}
                      </div>
                    </div>
                  )}
                </div>

                {selectedEditPackage && (
                  <div className="p-3 rounded-lg bg-muted/50 text-sm space-y-1">
                    <div className="flex justify-between"><span className="text-muted-foreground">Package price</span><span>{selectedEditPackage.price} EGP</span></div>
                    {editDiscountAmount > 0 && (
                      <div className="flex justify-between text-emerald-600">
                        <span>Discount</span><span>-{editDiscountAmount} EGP</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold pt-1 border-t border-border"><span>Total</span><span>{editTotal} EGP</span></div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Amount Paid (EGP)</Label>
                    <Input
                      type="number"
                      value={editForm.paidAmount}
                      onChange={e => setEditForm(p => ({ ...p, paidAmount: e.target.value }))}
                      placeholder={String(editTotal)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Payment Method</Label>
                    <Select value={editForm.paymentMethod} onValueChange={v => setEditForm(p => ({
                      ...p,
                      paymentMethod: v,
                      splitPayments: v === 'Split' && p.splitPayments.length === 0 ? [{ method: 'Cash', amount: '' }] : p.splitPayments
                    }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {paymentMethods.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {editForm.paymentMethod === 'Split' && (
                  <div className="space-y-3 p-3 border rounded-md bg-muted/20">
                    <div className="flex items-center justify-between">
                      <Label>Split Payment Details</Label>
                      <Button
                        type="button"
                        variant="outline" size="sm" className="h-7 text-xs"
                        onClick={() => setEditForm(p => ({ ...p, splitPayments: [...p.splitPayments, { method: 'Cash', amount: '' }] }))}
                      >
                        <Plus className="w-3 h-3 mr-1" /> Add Split
                      </Button>
                    </div>
                    {editForm.splitPayments.map((split, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Select
                          value={split.method}
                          onValueChange={v => {
                            const newSplits = [...editForm.splitPayments];
                            newSplits[i].method = v;
                            setEditForm(p => ({ ...p, splitPayments: newSplits }));
                          }}
                        >
                          <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {paymentMethods.filter(m => m !== 'Split').map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          placeholder="Amount"
                          value={split.amount}
                          onChange={e => {
                            const newSplits = [...editForm.splitPayments];
                            newSplits[i].amount = e.target.value;
                            setEditForm(p => ({ ...p, splitPayments: newSplits }));
                          }}
                        />
                        {editForm.splitPayments.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost" size="icon"
                            className="h-9 w-9 text-red-500 hover:text-red-600 hover:bg-red-50"
                            onClick={() => {
                              const newSplits = editForm.splitPayments.filter((_, idx) => idx !== i);
                              setEditForm(p => ({ ...p, splitPayments: newSplits }));
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-1.5 pt-2">
                  <Label>Invoice ID</Label>
                  <Input
                    placeholder="Leave empty for auto-generated"
                    value={editForm.customId}
                    onChange={e => setEditForm(p => ({ ...p, customId: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="space-y-1.5">
                    <Label>Creation Date</Label>
                    <Input
                      type="date"
                      value={editForm.invoiceDate}
                      onChange={e => setEditForm(p => ({ ...p, invoiceDate: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Activation Date</Label>
                    <Input
                      type="date"
                      value={editForm.activationDate}
                      onChange={e => setEditForm(p => ({ ...p, activationDate: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditInvoice(null)}>Cancel</Button>
                <Button onClick={handleEditInvoice} disabled={updateInvoice.isPending}>
                  {updateInvoice.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Payment Collection Dialog */}
          <Dialog open={!!paymentModalInvoice} onOpenChange={o => !o && setPaymentModalInvoice(null)}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader><DialogTitle>Collect Payment</DialogTitle></DialogHeader>
              <div className="py-4 space-y-4">
                <div className="bg-muted p-3 rounded-md space-y-1 text-sm">
                  <p className="font-medium">Invoice: {paymentModalInvoice?.id}</p>
                  <p>Total: {paymentModalInvoice?.total_amount} EGP</p>
                  <p>Paid: {paymentModalInvoice?.paid_amount} EGP</p>
                  <p className="font-bold text-destructive">Remaining: {(paymentModalInvoice?.total_amount || 0) - (paymentModalInvoice?.paid_amount || 0)} EGP</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
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
                        <SelectItem value="Cash">Cash</SelectItem>
                        <SelectItem value="Visa">Visa</SelectItem>
                        <SelectItem value="InstaPay">InstaPay</SelectItem>
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
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setPaymentModalInvoice(null); setPaymentAmount(""); setPaymentCustomId(""); setPaymentDate(""); }}>Cancel</Button>
                <Button onClick={handleCollectPayment} disabled={createInvoice.isPending || updateInvoice.isPending}>
                  {createInvoice.isPending || updateInvoice.isPending ? "Processing..." : "Collect"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Verification Dialog */}
          <Dialog open={showVerificationDialog} onOpenChange={setShowVerificationDialog}>
            <DialogContent>
              <DialogHeader><DialogTitle>Admin Verification</DialogTitle></DialogHeader>
              <div className="py-4 space-y-3">
                <p className="text-sm text-muted-foreground">Please confirm with the admin and enter the verification password</p>
                <Input
                  type="password"
                  placeholder="Verification password"
                  value={verificationPassword}
                  onChange={(e) => setVerificationPassword(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowVerificationDialog(false)}>Cancel</Button>
                <Button onClick={verifyAndSubmit} disabled={createInvoice.isPending || updateInvoice.isPending}>
                  {createInvoice.isPending || updateInvoice.isPending ? "Processing..." : "Verify & Submit"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Overpay Confirmation Dialog */}
          <AlertDialog open={!!overpayConfirmAction} onOpenChange={o => !o && setOverpayConfirmAction(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirm Overpayment</AlertDialogTitle>
                <AlertDialogDescription>
                  <span className="block mb-2 font-bold text-amber-600">You are about to overpay for this package!</span>
                  The entered paid amount is <strong>{overpayDetails?.paid.toLocaleString()} EGP</strong>, but the package total is only <strong>{overpayDetails?.total.toLocaleString()} EGP</strong>.
                  <span className="block mt-2 text-sm text-muted-foreground">
                    If you proceed, the system will automatically override the total amount to match your paid amount ({overpayDetails?.paid.toLocaleString()} EGP).
                  </span>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setOverpayConfirmAction(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    const action = overpayConfirmAction;
                    setOverpayConfirmAction(null);
                    if (action) action();
                  }}
                  className="bg-amber-600 text-white hover:bg-amber-700"
                >
                  Confirm Overpayment
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Delete Invoice Confirmation */}
          <AlertDialog open={!!confirmDelete} onOpenChange={o => !o && setConfirmDelete(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Invoice</AlertDialogTitle>
                <AlertDialogDescription>
                  {confirmDelete?.joint_invoice_group_id ? (
                    <>
                      <span className="block mb-2 font-bold text-red-600">WARNING: This is a Joint Invoice.</span>
                      Deleting this will permanently delete ALL invoices in this joint group.
                    </>
                  ) : (
                    <>Permanently delete invoice <strong>{confirmDelete?.id}</strong> for {confirmDelete?.member_name}?</>
                  )}
                  <span className="block mt-1 text-sm">Amount: {confirmDelete?.total_amount.toLocaleString()} EGP</span>
                  <span className="block mt-2 text-red-600 font-medium">This action cannot be undone.</span>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => confirmDelete && handleDeleteInvoice(confirmDelete)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={deleteInvoice.isPending}
                >
                  {deleteInvoice.isPending ? "Deleting..." : "Delete Invoice"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
}
