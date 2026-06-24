import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type UserRole = 'admin' | 'reception' | 'sales';

export interface AppUser {
  id: string;
  email: string;
  password: string;
  role: UserRole;
  name: string;
}

interface AuthContextType {
  currentUser: AppUser | null;
  users: AppUser[];
  login: (email: string, password: string) => boolean;
  logout: () => void;
  createUser: (user: Omit<AppUser, 'id'>) => { ok: boolean; error?: string };
  updateUser: (id: string, updates: Partial<AppUser>) => void;
  deleteUser: (id: string) => void;
}

const USERS_KEY = 'gymp_users';
const SESSION_KEY = 'gymp_session';

const DEFAULT_USERS: AppUser[] = [
  { id: 'U001', email: 'admin@gym.com', password: 'admin123', role: 'admin', name: 'Admin User' },
  { id: 'U002', email: 'reception@gym.com', password: 'rec123', role: 'reception', name: 'Reception Staff' },
  { id: 'U003', email: 'sales@gym.com', password: 'sales123', role: 'sales', name: 'Sales Team' },
];

function loadUsers(): AppUser[] {
  try {
    const stored = localStorage.getItem(USERS_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  localStorage.setItem(USERS_KEY, JSON.stringify(DEFAULT_USERS));
  return DEFAULT_USERS;
}

function saveUsers(users: AppUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function loadSession(users: AppUser[]): AppUser | null {
  try {
    const id = localStorage.getItem(SESSION_KEY);
    if (id) return users.find(u => u.id === id) ?? null;
  } catch { /* ignore */ }
  return null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<AppUser[]>(() => loadUsers());
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => loadSession(loadUsers()));

  useEffect(() => { saveUsers(users); }, [users]);

  const login = (email: string, password: string): boolean => {
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
    if (user) {
      setCurrentUser(user);
      localStorage.setItem(SESSION_KEY, user.id);
      return true;
    }
    return false;
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem(SESSION_KEY);
  };

  const createUser = (data: Omit<AppUser, 'id'>): { ok: boolean; error?: string } => {
    if (users.find(u => u.email.toLowerCase() === data.email.toLowerCase())) {
      return { ok: false, error: 'Email already exists' };
    }
    const newUser: AppUser = { ...data, id: `U${Date.now()}` };
    setUsers(prev => [...prev, newUser]);
    return { ok: true };
  };

  const updateUser = (id: string, updates: Partial<AppUser>) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...updates } : u));
    if (currentUser?.id === id) setCurrentUser(prev => prev ? { ...prev, ...updates } : null);
  };

  const deleteUser = (id: string) => {
    if (id === currentUser?.id) return;
    setUsers(prev => prev.filter(u => u.id !== id));
  };

  return (
    <AuthContext.Provider value={{ currentUser, users, login, logout, createUser, updateUser, deleteUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// Role-based nav permissions
export const ROLE_NAV: Record<UserRole, string[]> = {
  admin: ['/', '/checkin', '/members', '/subscriptions', '/invoices', '/discounts', '/finance', '/daily', '/reports', '/coaches', '/schedule', '/leads', '/liabilities', '/audit', '/users'],
  reception: ['/', '/checkin', '/members', '/invoices', '/finance', '/coaches', '/schedule', '/daily', '/liabilities'],
  sales: ['/', '/members', '/leads'],
};
