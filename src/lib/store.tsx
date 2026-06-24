import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import {
  Member, SubscriptionPackage, Invoice, Discount, Coach, Lead, AuditLog, Expense, Liability,
  MOCK_MEMBERS, MOCK_PACKAGES, MOCK_INVOICES, MOCK_DISCOUNTS, MOCK_COACHES,
  MOCK_LEADS, MOCK_AUDIT, MOCK_EXPENSES, MOCK_LIABILITIES,
} from './mock-data';

interface AppState {
  members: Member[];
  packages: SubscriptionPackage[];
  invoices: Invoice[];
  discounts: Discount[];
  coaches: Coach[];
  leads: Lead[];
  auditLogs: AuditLog[];
  expenses: Expense[];
  liabilities: Liability[];
}

type Action =
  | { type: 'ADD_MEMBER'; payload: Member }
  | { type: 'UPDATE_MEMBER'; payload: Member }
  | { type: 'DELETE_MEMBER'; payload: string }
  | { type: 'CHECK_IN_MEMBER'; payload: { memberId: string; override?: boolean; payLater?: boolean; performedBy?: string } }
  | { type: 'FREEZE_MEMBER'; payload: { memberId: string; days: number } }
  | { type: 'ADD_PACKAGE'; payload: SubscriptionPackage }
  | { type: 'UPDATE_PACKAGE'; payload: SubscriptionPackage }
  | { type: 'DELETE_PACKAGE'; payload: string }
  | { type: 'ADD_INVOICE'; payload: Invoice }
  | { type: 'UPDATE_INVOICE'; payload: Invoice }
  | { type: 'ADD_DISCOUNT'; payload: Discount }
  | { type: 'UPDATE_DISCOUNT'; payload: Discount }
  | { type: 'ADD_COACH'; payload: Coach }
  | { type: 'UPDATE_COACH'; payload: Coach }
  | { type: 'CHECK_IN_COACH'; payload: string }
  | { type: 'ADD_LEAD'; payload: Lead }
  | { type: 'UPDATE_LEAD'; payload: Lead }
  | { type: 'ADD_AUDIT_LOG'; payload: AuditLog }
  | { type: 'ADD_EXPENSE'; payload: Expense }
  | { type: 'ADD_LIABILITY'; payload: Liability }
  | { type: 'UPDATE_LIABILITY'; payload: Liability }
  | { type: 'PAY_INSTALLMENT'; payload: string };

const initialState: AppState = {
  members: MOCK_MEMBERS,
  packages: MOCK_PACKAGES,
  invoices: MOCK_INVOICES,
  discounts: MOCK_DISCOUNTS,
  coaches: MOCK_COACHES,
  leads: MOCK_LEADS,
  auditLogs: MOCK_AUDIT,
  expenses: MOCK_EXPENSES,
  liabilities: MOCK_LIABILITIES,
};

function updateLiabilityByPayment(liabilities: Liability[], liabilityId: string, amount: number): Liability[] {
  return liabilities.map(l => {
    if (l.id !== liabilityId) return l;
    const newPaid = Math.min(l.paidAmount + amount, l.totalAmount);
    const isComplete = newPaid >= l.totalAmount;
    const nextDue = !isComplete && l.frequencyDays > 0
      ? new Date(new Date(l.nextDueDate).getTime() + l.frequencyDays * 86400000).toISOString()
      : l.nextDueDate;
    return { ...l, paidAmount: newPaid, isComplete, nextDueDate: nextDue };
  });
}

function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'ADD_MEMBER':
      return { ...state, members: [...state.members, action.payload] };
    case 'UPDATE_MEMBER':
      return { ...state, members: state.members.map(m => m.id === action.payload.id ? action.payload : m) };
    case 'DELETE_MEMBER':
      return { ...state, members: state.members.filter(m => m.id !== action.payload) };
    case 'CHECK_IN_MEMBER': {
      const { memberId, override, payLater, performedBy = 'Reception' } = action.payload;
      const member = state.members.find(m => m.id === memberId);
      if (!member) return state;
      const updatedMember = { ...member, sessionsRemaining: Math.max(0, member.sessionsRemaining - 1) };
      if (updatedMember.sessionsRemaining <= 2) updatedMember.status = 'expiring_soon';
      const auditType = override ? 'override_checkin' as const : 'checkin' as const;
      const details = override
        ? `Allowed ${payLater ? '(Pay Later) ' : ''}expired member ${memberId} (${member.name}) to attend`
        : `Normal check-in: ${memberId} (${member.name}), session deducted (${updatedMember.sessionsRemaining} remaining)`;
      const log: AuditLog = {
        id: `A${Date.now()}`, action: override ? 'Override Check-in' : 'Check-in', actionType: auditType,
        performedBy, memberId, memberName: member.name, timestamp: new Date().toISOString(), details,
      };
      return {
        ...state,
        members: state.members.map(m => m.id === memberId ? updatedMember : m),
        auditLogs: [log, ...state.auditLogs],
      };
    }
    case 'FREEZE_MEMBER': {
      const { memberId, days } = action.payload;
      return {
        ...state,
        members: state.members.map(m =>
          m.id === memberId
            ? { ...m, freezeDaysUsed: Math.min((m.freezeDaysUsed ?? 0) + days, m.freezeDaysTotal ?? 7) }
            : m
        ),
      };
    }
    case 'ADD_PACKAGE':
      return { ...state, packages: [...state.packages, action.payload] };
    case 'UPDATE_PACKAGE':
      return { ...state, packages: state.packages.map(p => p.id === action.payload.id ? action.payload : p) };
    case 'DELETE_PACKAGE':
      return { ...state, packages: state.packages.filter(p => p.id !== action.payload) };
    case 'ADD_INVOICE':
      return { ...state, invoices: [...state.invoices, action.payload] };
    case 'UPDATE_INVOICE':
      return { ...state, invoices: state.invoices.map(i => i.id === action.payload.id ? action.payload : i) };
    case 'ADD_DISCOUNT':
      return { ...state, discounts: [...state.discounts, action.payload] };
    case 'UPDATE_DISCOUNT':
      return { ...state, discounts: state.discounts.map(d => d.id === action.payload.id ? action.payload : d) };
    case 'ADD_COACH':
      return { ...state, coaches: [...state.coaches, action.payload] };
    case 'UPDATE_COACH':
      return { ...state, coaches: state.coaches.map(c => c.id === action.payload.id ? action.payload : c) };
    case 'CHECK_IN_COACH':
      return { ...state, coaches: state.coaches.map(c => c.id === action.payload ? { ...c, checkedInToday: true } : c) };
    case 'ADD_LEAD':
      return { ...state, leads: [...state.leads, action.payload] };
    case 'UPDATE_LEAD':
      return { ...state, leads: state.leads.map(l => l.id === action.payload.id ? action.payload : l) };
    case 'ADD_AUDIT_LOG':
      return { ...state, auditLogs: [action.payload, ...state.auditLogs] };
    case 'ADD_EXPENSE': {
      const expense = action.payload;
      const newLiabilities = expense.liabilityId
        ? updateLiabilityByPayment(state.liabilities, expense.liabilityId, expense.amount)
        : state.liabilities;
      return { ...state, expenses: [...state.expenses, expense], liabilities: newLiabilities };
    }
    case 'ADD_LIABILITY':
      return { ...state, liabilities: [...state.liabilities, action.payload] };
    case 'UPDATE_LIABILITY':
      return { ...state, liabilities: state.liabilities.map(l => l.id === action.payload.id ? action.payload : l) };
    case 'PAY_INSTALLMENT': {
      return {
        ...state,
        liabilities: updateLiabilityByPayment(state.liabilities, action.payload,
          state.liabilities.find(l => l.id === action.payload)?.installmentAmount ?? 0
        ),
      };
    }
    default:
      return state;
  }
}

const AppStateContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<Action>;
} | undefined>(undefined);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  return (
    <AppStateContext.Provider value={{ state, dispatch }}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider');
  return ctx;
}
