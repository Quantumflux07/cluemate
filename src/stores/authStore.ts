import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { ProfileRow } from '../types/database';

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: ProfileRow | null;
  loading: boolean;
  initialized: boolean;
  error: string | null;

  initialize: () => Promise<void>;
  signIn: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, pass: string, displayName: string) => Promise<{ success: boolean; error?: string }>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  loading: true,
  initialized: false,
  error: null,

  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      let profile: ProfileRow | null = null;
      if (session?.user) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        profile = data as ProfileRow | null;
      }

      set({
        session,
        user: session?.user ?? null,
        profile,
        loading: false,
        initialized: true,
      });

      // Listen for auth state changes
      supabase.auth.onAuthStateChange(async (_event, newSession) => {
        let newProfile: ProfileRow | null = null;
        if (newSession?.user) {
          const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', newSession.user.id)
            .single();
          newProfile = data as ProfileRow | null;
        }

        set({
          session: newSession,
          user: newSession?.user ?? null,
          profile: newProfile,
          loading: false,
        });
      });
    } catch (err: any) {
      set({ loading: false, initialized: true, error: err.message || 'Initialization failed' });
    }
  },

  signIn: async (email: string, pass: string) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: pass,
      });

      if (error) {
        set({ loading: false, error: error.message });
        return { success: false, error: error.message };
      }

      let profile: ProfileRow | null = null;
      if (data.user) {
        const { data: p } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();
        profile = p as ProfileRow | null;
      }

      set({
        session: data.session,
        user: data.user,
        profile,
        loading: false,
        error: null,
      });

      return { success: true };
    } catch (err: any) {
      const msg = err.message || 'Failed to sign in';
      set({ loading: false, error: msg });
      return { success: false, error: msg };
    }
  },

  signUp: async (email: string, pass: string, displayName: string) => {
    set({ loading: true, error: null });
    try {
      const trimmedEmail = email.trim();
      const trimmedName = displayName.trim() || trimmedEmail.split('@')[0];

      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password: pass,
        options: {
          data: {
            display_name: trimmedName,
          },
        },
      });

      if (error) {
        set({ loading: false, error: error.message });
        return { success: false, error: error.message };
      }

      set({
        session: data.session,
        user: data.user,
        loading: false,
        error: null,
      });

      return { success: true };
    } catch (err: any) {
      const msg = err.message || 'Failed to sign up';
      set({ loading: false, error: msg });
      return { success: false, error: msg };
    }
  },

  resetPassword: async (email: string) => {
    set({ loading: true, error: null });
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
      set({ loading: false });
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: any) {
      const msg = err.message || 'Failed to send reset email';
      set({ loading: false, error: msg });
      return { success: false, error: msg };
    }
  },

  signOut: async () => {
    set({ loading: true });
    await supabase.auth.signOut();
    set({
      session: null,
      user: null,
      profile: null,
      loading: false,
      error: null,
    });
  },

  refreshProfile: async () => {
    const user = get().user;
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    if (data) {
      set({ profile: data as ProfileRow });
    }
  },
}));
