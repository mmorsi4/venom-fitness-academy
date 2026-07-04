import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from './supabase';
import type { Profile, Role } from './types';
import type { Session, User } from '@supabase/supabase-js';

export interface AppUser {
  id: string;
  email: string;
  name: string;
  roles: Role[];
}

interface AuthContextType {
  currentUser: AppUser | null;
  isAdmin: boolean;
  users: AppUser[];
  availableRoles: Role[];
  loading: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  createUser: (data: { name: string; email: string; password: string; roleIds: string[] }) => Promise<{ ok: boolean; error?: string }>;
  updateUser: (id: string, updates: { name?: string; email?: string; password?: string; roleIds?: string[] }) => Promise<{ ok: boolean; error?: string }>;
  deleteUser: (id: string) => Promise<{ ok: boolean; error?: string }>;
  createRole: (data: { name: string; description: string; tabs: string[] }) => Promise<{ ok: boolean; error?: string }>;
  updateRole: (id: string, updates: { name?: string; description?: string; tabs?: string[] }) => Promise<{ ok: boolean; error?: string }>;
  deleteRole: (id: string) => Promise<{ ok: boolean; error?: string }>;
  refreshUsers: () => Promise<void>;
  refreshRoles: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function profileToAppUser(user: User): Promise<AppUser | null> {
  const { data } = await supabase
    .from('profiles')
    .select('*, user_roles(roles(*))')
    .eq('id', user.id)
    .single();
  if (!data) return null;
  return {
    id: data.id,
    email: data.email,
    name: data.name,
    roles: (data.user_roles || []).map((ur: any) => ur.roles).filter(Boolean),
  };
}

async function fetchAllUsers(): Promise<AppUser[]> {
  const { data } = await supabase.from('profiles').select('*, user_roles(roles(*))').order('created_at');
  return (data ?? []).map((p: any) => ({
    id: p.id,
    email: p.email,
    name: p.name,
    roles: (p.user_roles || []).map((ur: any) => ur.roles).filter(Boolean),
  }));
}

async function fetchAllRoles(): Promise<Role[]> {
  const { data } = await supabase.from('roles').select('*').order('name');
  return data ?? [];
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user && mounted) {
        const appUser = await profileToAppUser(session.user);
        setCurrentUser(appUser);
        const allUsers = await fetchAllUsers();
        setUsers(allUsers);
        const roles = await fetchAllRoles();
        setAvailableRoles(roles);
      }
      if (mounted) setLoading(false);
    }

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user && mounted) {
          const appUser = await profileToAppUser(session.user);
          setCurrentUser(appUser);
          const allUsers = await fetchAllUsers();
          setUsers(allUsers);
          const roles = await fetchAllRoles();
          setAvailableRoles(roles);
        } else if (mounted) {
          setCurrentUser(null);
          setUsers([]);
          setAvailableRoles([]);
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
    setAvailableRoles([]);
  };

  const refreshUsers = async () => {
    const allUsers = await fetchAllUsers();
    setUsers(allUsers);
  };

  const refreshRoles = async () => {
    const roles = await fetchAllRoles();
    setAvailableRoles(roles);
  };

  const createUser = async (data: { name: string; email: string; password: string; roleIds: string[] }): Promise<{ ok: boolean; error?: string }> => {
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

  const updateUser = async (id: string, updates: { name?: string; email?: string; password?: string; roleIds?: string[] }): Promise<{ ok: boolean; error?: string }> => {
    try {
      const response = await supabase.functions.invoke('admin-update-user', {
        body: { userId: id, ...updates },
      });
      if (response.error) return { ok: false, error: response.error.message };
      if (response.data?.error) return { ok: false, error: response.data.error };

      await refreshUsers();
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

  const createRole = async (data: { name: string; description: string; tabs: string[] }) => {
    const { error } = await supabase.from('roles').insert([data]);
    if (error) return { ok: false, error: error.message };
    await refreshRoles();
    return { ok: true };
  };

  const updateRole = async (id: string, updates: { name?: string; description?: string; tabs?: string[] }) => {
    const { error } = await supabase.from('roles').update(updates).eq('id', id);
    if (error) return { ok: false, error: error.message };
    await refreshRoles();
    // Also refresh users to update their effective roles and permissions
    await refreshUsers();
    
    // Refresh current user if needed (in case our own role was updated)
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const appUser = await profileToAppUser(user);
      setCurrentUser(appUser);
    }
    return { ok: true };
  };

  const deleteRole = async (id: string) => {
    const { error } = await supabase.from('roles').delete().eq('id', id);
    if (error) return { ok: false, error: error.message };
    await refreshRoles();
    await refreshUsers();
    return { ok: true };
  };

  const isAdmin = currentUser?.roles.some(r => r.name.toLowerCase() === 'admin') ?? false;

  return (
    <AuthContext.Provider value={{ 
      currentUser, isAdmin, users, availableRoles, loading, 
      login, logout, 
      createUser, updateUser, deleteUser, refreshUsers,
      createRole, updateRole, deleteRole, refreshRoles
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
