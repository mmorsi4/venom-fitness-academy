import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from './supabase';
import type { UserRole, Profile } from './types';
import type { Session, User } from '@supabase/supabase-js';

export type { UserRole } from './types';

export interface AppUser {
  id: string;
  email: string;
  role: UserRole;
  name: string;
}

interface AuthContextType {
  currentUser: AppUser | null;
  users: AppUser[];
  loading: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  createUser: (data: { name: string; email: string; password: string; role: UserRole }) => Promise<{ ok: boolean; error?: string }>;
  updateUser: (id: string, updates: { name?: string; email?: string; password?: string; role?: UserRole }) => Promise<{ ok: boolean; error?: string }>;
  deleteUser: (id: string) => Promise<{ ok: boolean; error?: string }>;
  refreshUsers: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function profileToAppUser(user: User): Promise<AppUser | null> {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  if (!data) return null;
  return {
    id: data.id,
    email: data.email,
    role: data.role as UserRole,
    name: data.name,
  };
}

async function fetchAllUsers(): Promise<AppUser[]> {
  const { data } = await supabase.from('profiles').select('*').order('created_at');
  return (data ?? []).map((p: Profile) => ({
    id: p.id,
    email: p.email,
    role: p.role as UserRole,
    name: p.name,
  }));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Initialize: check existing session
  useEffect(() => {
    let mounted = true;

    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user && mounted) {
        const appUser = await profileToAppUser(session.user);
        setCurrentUser(appUser);
        const allUsers = await fetchAllUsers();
        setUsers(allUsers);
      }
      if (mounted) setLoading(false);
    }

    init();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user && mounted) {
          const appUser = await profileToAppUser(session.user);
          setCurrentUser(appUser);
          const allUsers = await fetchAllUsers();
          setUsers(allUsers);
        } else if (mounted) {
          setCurrentUser(null);
          setUsers([]);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string): Promise<{ ok: boolean; error?: string }> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setUsers([]);
  };

  const refreshUsers = async () => {
    const allUsers = await fetchAllUsers();
    setUsers(allUsers);
  };

  // Admin user management via Edge Functions
  const createUser = async (data: { name: string; email: string; password: string; role: UserRole }): Promise<{ ok: boolean; error?: string }> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return { ok: false, error: 'Not authenticated' };

      const response = await supabase.functions.invoke('admin-create-user', {
        body: data,
      });
      if (response.error) return { ok: false, error: response.error.message };
      if (response.data?.error) return { ok: false, error: response.data.error };

      await refreshUsers();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err.message ?? 'Failed to create user' };
    }
  };

  const updateUser = async (id: string, updates: { name?: string; email?: string; password?: string; role?: UserRole }): Promise<{ ok: boolean; error?: string }> => {
    try {
      const response = await supabase.functions.invoke('admin-update-user', {
        body: { userId: id, ...updates },
      });
      if (response.error) return { ok: false, error: response.error.message };
      if (response.data?.error) return { ok: false, error: response.data.error };

      await refreshUsers();
      // If we updated ourselves, refresh current user
      if (id === currentUser?.id) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const appUser = await profileToAppUser(user);
          setCurrentUser(appUser);
        }
      }
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err.message ?? 'Failed to update user' };
    }
  };

  const deleteUser = async (id: string): Promise<{ ok: boolean; error?: string }> => {
    if (id === currentUser?.id) return { ok: false, error: 'Cannot delete your own account' };
    try {
      const response = await supabase.functions.invoke('admin-delete-user', {
        body: { userId: id },
      });
      if (response.error) return { ok: false, error: response.error.message };
      if (response.data?.error) return { ok: false, error: response.data.error };

      await refreshUsers();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err.message ?? 'Failed to delete user' };
    }
  };

  return (
    <AuthContext.Provider value={{ currentUser, users, loading, login, logout, createUser, updateUser, deleteUser, refreshUsers }}>
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
