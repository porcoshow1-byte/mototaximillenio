import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updatePassword,
  User as FirebaseUser
} from 'firebase/auth';
import { auth, isMockMode } from './firebase';

type AuthCallback = (user: FirebaseUser | any | null) => void;

// Lista de observadores para o modo Mock
const mockObservers: AuthCallback[] = [];

// Notifica todos os observadores quando o estado muda no modo Mock
const notifyObservers = (user: any) => {
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

export const observeAuthState = (callback: AuthCallback) => {
  if (isMockMode || !auth) {
    console.warn("⚠️ Auth rodando em modo MOCK. Sistema de login simulado ativo.");

    // Verificação inicial
    const storedUser = localStorage.getItem('motoja_mock_user');
    if (storedUser) {
      try {
        callback(JSON.parse(storedUser));
      } catch {
        callback(null);
      }
    } else {
      callback(null);
    }

    // Registrar observador para atualizações futuras
    mockObservers.push(callback);

    // Retorna função de limpeza (unsubscribe)
    return () => {
      const index = mockObservers.indexOf(callback);
      if (index > -1) mockObservers.splice(index, 1);
    };
  }
  return onAuthStateChanged(auth, callback);
};

export const login = async (email: string, pass: string) => {
  if (isMockMode || !auth) {
    // Simula delay de rede
    await new Promise(r => setTimeout(r, 800));

    // Validação básica simulada
    if (!email.includes('@')) throw new Error("E-mail inválido");
    if (pass.length < 6) throw new Error("A senha deve ter pelo menos 6 caracteres (auth/weak-password)");

    const uid = generateMockUid(email);
    const mockUser = {
      uid,
      email,
      displayName: email.split('@')[0],
      emailVerified: true
    };

    localStorage.setItem('motoja_mock_user', JSON.stringify(mockUser));
    notifyObservers(mockUser); // Notifica o AuthContext

    return { user: mockUser };
  }
  return signInWithEmailAndPassword(auth, email, pass);
};

export const register = async (email: string, pass: string) => {
  if (isMockMode || !auth) {
    await new Promise(r => setTimeout(r, 800));

    if (!email.includes('@')) throw new Error("E-mail inválido");
    if (pass.length < 6) throw new Error("A senha deve ter pelo menos 6 caracteres (auth/weak-password)");

    const uid = generateMockUid(email);
    const mockUser = {
      uid,
      email,
      displayName: email.split('@')[0],
      emailVerified: true
    };

    localStorage.setItem('motoja_mock_user', JSON.stringify(mockUser));
    notifyObservers(mockUser); // Notifica o AuthContext

    return { user: mockUser };
  }
  return createUserWithEmailAndPassword(auth, email, pass);
};

export const logout = async () => {
  if (isMockMode || !auth) {
    localStorage.removeItem('motoja_mock_user');
    const { clearSession } = await import('./user');
    clearSession();
    notifyObservers(null); // Notifica o AuthContext que o usuário saiu
    return;
  }
  const { clearSession } = await import('./user');
  clearSession();
  return firebaseSignOut(auth);
};

export const updateCurrentUserPassword = async (newPassword: string) => {
  if (isMockMode || !auth) {
    if (newPassword.length < 6) throw new Error("A senha deve ter pelo menos 6 caracteres");
    // In mock mode, we just pretend it worked
    return;
  }

  if (auth.currentUser) {
    return updatePassword(auth.currentUser, newPassword);
  }
  throw new Error("Usuário não autenticado");
};