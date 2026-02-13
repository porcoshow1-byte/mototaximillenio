import { User } from '@supabase/supabase-js';
import { supabase, isMockMode } from './supabase';

// Tipo de callback para observadores
type AuthCallback = (user: UserWithUID | null) => void;

// Supabase User type doesn't have 'uid', but our app uses 'uid' everywhere.
// We extend the type to include 'uid' as an alias for 'id'.
export interface UserWithUID extends User {
  uid: string;
}

// Lista de observadores para o modo Mock
const mockObservers: AuthCallback[] = [];

// Notifica todos os observadores quando o estado muda no modo Mock
const notifyObservers = (user: UserWithUID | null) => {
  mockObservers.forEach(cb => cb(user));
};

// Gera um ID consistente baseado no email para que o perfil persista entre logins no modo Mock
const generateMockUid = (email: string) => {
  try {
    return 'mock_' + btoa(email).replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
  } catch (e) {
    return 'mock_' + Date.now();
  }
};

const mapSupabaseUser = (user: User | null): UserWithUID | null => {
  if (!user) return null;
  return {
    ...user,
    uid: user.id, // Alias for compatibility
  };
};

export const observeAuthState = (callback: AuthCallback) => {
  if (isMockMode || !supabase) {
    console.warn("⚠️ Auth rodando em modo MOCK (Supabase).");

    // Verificação inicial via localStorage
    const storedUser = localStorage.getItem('motoja_mock_user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        callback(parsed);
      } catch {
        callback(null);
      }
    } else {
      callback(null);
    }

    mockObservers.push(callback);
    return () => {
      const index = mockObservers.indexOf(callback);
      if (index > -1) mockObservers.splice(index, 1);
    };
  }

  // Supabase Auth Listener
  const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
    const user = session?.user || null;
    callback(mapSupabaseUser(user));
  });

  return () => {
    subscription.unsubscribe();
  };
};

export const login = async (email: string, pass: string) => {
  if (isMockMode || !supabase) {
    await new Promise(r => setTimeout(r, 800));

    // Validação simulada
    if (!email.includes('@')) throw new Error("E-mail inválido");
    if (pass.length < 6) throw new Error("A senha deve ter pelo menos 6 caracteres");

    // Simular validação "incorreta"
    if (pass === 'wrongpass') throw new Error("Credenciais incorretas (simulado)");

    const uid = generateMockUid(email);
    const mockUser = {
      id: uid,
      uid: uid,
      email,
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString()
    } as unknown as UserWithUID;

    localStorage.setItem('motoja_mock_user', JSON.stringify(mockUser));
    notifyObservers(mockUser);

    return { user: mockUser, session: null };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: pass,
  });

  if (error) throw error;

  return {
    user: mapSupabaseUser(data.user),
    session: data.session
  };
};

export const register = async (email: string, pass: string) => {
  if (isMockMode || !supabase) {
    await new Promise(r => setTimeout(r, 800));

    if (!email.includes('@')) throw new Error("E-mail inválido");
    if (pass.length < 6) throw new Error("A senha deve ter pelo menos 6 caracteres");

    const uid = generateMockUid(email);
    const mockUser = {
      id: uid,
      uid: uid,
      email,
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString()
    } as unknown as UserWithUID;

    localStorage.setItem('motoja_mock_user', JSON.stringify(mockUser));
    notifyObservers(mockUser);

    return { user: mockUser, session: null };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password: pass,
  });

  if (error) throw error;

  return {
    user: mapSupabaseUser(data.user),
    session: data.session
  };
};

export const logout = async () => {
  if (isMockMode || !supabase) {
    localStorage.removeItem('motoja_mock_user');
    const { clearSession } = await import('./user');
    clearSession();
    notifyObservers(null);
    return;
  }

  const { clearSession } = await import('./user');
  clearSession();

  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

// Supabase change password (requires generic 'updateUser')
export const updateCurrentUserPassword = async (newPassword: string) => {
  if (isMockMode || !supabase) {
    if (newPassword.length < 6) throw new Error("A senha deve ter pelo menos 6 caracteres");
    return;
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
};