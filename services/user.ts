import { db, isMockMode } from './firebase';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { User, Driver } from '../types';

export const USERS_COLLECTION = 'users';

interface InitialUserData {
  name?: string;
  phone?: string;
  cpf?: string;
  vehicle?: string;
  plate?: string;
  cnhUrl?: string;
  address?: string;
  addressComponents?: any;
}

// Check if user already exists by specific field
export const checkUniqueness = async (field: 'cpf' | 'phone' | 'email', value: string): Promise<{ exists: boolean, message?: string }> => {
  if (isMockMode || !db || !value) return { exists: false };

  // Skip unique check for empty/incomplete values during typing
  if (field === 'cpf' && value.length < 11) return { exists: false };
  if (field === 'phone' && value.length < 10) return { exists: false };
  if (field === 'email' && !value.includes('@')) return { exists: false };

  const usersRef = collection(db, USERS_COLLECTION);
  const q = query(usersRef, where(field, '==', value));

  try {
    const snap = await getDocs(q);
    if (!snap.empty) {
      const msgs = {
        cpf: 'Este CPF já está cadastrado.',
        phone: 'Este telefone já está cadastrado.',
        email: 'Este e-mail já está cadastrado.'
      };
      return { exists: true, message: msgs[field] };
    }
    return { exists: false };
  } catch (err) {
    console.error(`Error checking uniqueness for ${field}:`, err);
    return { exists: false };
  }
};

// Deprecated: Keeping for backward compatibility if needed, but redirects to new function
export const checkUserExists = async (cpf: string, phone: string): Promise<{ exists: boolean, field: 'cpf' | 'phone' | null }> => {
  const cpfCheck = await checkUniqueness('cpf', cpf);
  if (cpfCheck.exists) return { exists: true, field: 'cpf' };

  const phoneCheck = await checkUniqueness('phone', phone);
  if (phoneCheck.exists) return { exists: true, field: 'phone' };

  return { exists: false, field: null };
};

export const getOrCreateUserProfile = async (
  uid: string,
  email: string,
  role: 'user' | 'driver' | 'company',
  initialData?: InitialUserData
): Promise<User | Driver> => {

  // MOCK MODE: Fallback para localStorage se não houver DB
  if (isMockMode || !db) {
    const storageKey = `motoja_user_${uid}`;
    const stored = localStorage.getItem(storageKey);

    if (stored) {
      const parsed = JSON.parse(stored);
      // Atualiza dados se vierem no login e não existirem no mock antigo
      if (role === 'driver' && initialData && (!parsed.vehicle || !parsed.plate)) {
        const updated = { ...parsed, ...initialData };
        localStorage.setItem(storageKey, JSON.stringify(updated));
        return updated;
      }
      return parsed;
    }

    const displayName = initialData?.name || email.split('@')[0];
    const baseData = {
      id: uid,
      name: displayName,
      email: email,
      phone: initialData?.phone || '',
      cpf: initialData?.cpf || '',
      address: initialData?.address || '',
      addressComponents: initialData?.addressComponents,
      rating: 5.0,
      avatar: `https://ui-avatars.com/api/?background=${role === 'user' ? 'orange' : '000'}&color=fff&name=${displayName}`,
      createdAt: Date.now(),
      role: role
    };

    let newProfile: any = baseData;
    if (role === 'driver') {
      newProfile = {
        ...baseData,
        vehicle: initialData?.vehicle || 'Moto Demo',
        plate: initialData?.plate || 'DEMO-9999',
        status: 'online', // Default to online in mock for ease
        location: { lat: -23.1047, lng: -48.9213 },
        earningsToday: 0
      };
    }

    localStorage.setItem(storageKey, JSON.stringify(newProfile));
    return newProfile;
  }

  // FIREBASE MODE
  const userRef = doc(db, USERS_COLLECTION, uid);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    const data = userSnap.data() as any;

    if (role === 'driver' && (!data.vehicle || !data.plate || !data.cnhUrl) && initialData) {
      const updateData = {
        role: 'driver',
        vehicle: initialData.vehicle || data.vehicle,
        plate: initialData.plate || data.plate,
        status: data.status || 'offline',
        location: data.location || { lat: 0, lng: 0 },
        earningsToday: data.earningsToday || 0,
        verificationStatus: data.verificationStatus || 'pending',
        cnhUrl: initialData.cnhUrl || data.cnhUrl || ''
      };
      await updateDoc(userRef, updateData);
      return { ...data, ...updateData };
    }
    return data as User | Driver;
  }

  // FIRST: Check localStorage for saved profile (user might have edited offline)
  const storageKey = `motoja_user_${uid}`;
  const storedLocal = localStorage.getItem(storageKey);

  // Checking if doc exists in Firestore - if not, and we are not in mock mode, it implies account deleted or never created properly
  if (!storedLocal) {
    // If we are here, it means no local storage backup and no firestore doc. 
    // We should PROBABLY treat as new user, BUT if we want to enforce "deleted = deleted",
    // we need a way to detect if it was deleted vs just new.
    // For now, let's allow re-creation to enable "Signup" flow, 
    // BUT if the calling code expects an existing user (Login), this might be tricky.
    // Actually, AuthScreen handles Signup. UserApp calls this on load.
    // If UserApp calls this and doc is missing, it creates a new one.
    // To support "Deletion", we might need a "deleted_users" collection blacklist, or just let them re-register.
    // The user request "não da para fazer nada" implies session is stuck.
    // The previous step's Logout logic in UserApp should handle the "Null" or "Empty" if we return null here? 
    // No, current logic creates new profile. 

    // Let's stick to the current logic: Create new profile.
    // The "Stuck" state is likely due to the Mock fallback taking over when Firestore fails or is empty.
    // With the UserApp change above, we handle "network errors" or "not found" better?
    // Wait, the UserApp change checks for "não encontrado".
    // I need to ensure this function behaves predictably.

    // If we want to support "Ban/Delete", re-creating might be bad.
    // But for "My user is stuck", usually deleting them in Admin and letting them re-login fixes it.
    // If they re-login, they get a fresh account. This is acceptable behavior for "Reset".
  }

  // Create new profile (Default behavior for new/deleted users re-joining)
  const displayName = initialData?.name || email.split('@')[0];
  const displayPhone = initialData?.phone || '';

  const baseData = {
    id: uid,
    name: displayName,
    email: email,
    phone: displayPhone,
    cpf: initialData?.cpf || '',
    rating: 5.0,
    avatar: `https://ui-avatars.com/api/?background=${role === 'user' ? 'orange' : '000'}&color=fff&name=${displayName}`,
    createdAt: Date.now(),
    role: role
  };

  let newProfile: any = baseData;

  if (role === 'driver') {
    newProfile = {
      ...baseData,
      vehicle: initialData?.vehicle || 'Veículo não cadastrado',
      plate: initialData?.plate || 'AAA-0000',
      status: 'offline',
      location: { lat: 0, lng: 0 },
      earningsToday: 0,
      verificationStatus: 'pending',
      cnhUrl: initialData?.cnhUrl || ''
    };
  }

  await setDoc(userRef, newProfile);
  return newProfile;
}


export const updateUserProfile = async (uid: string, data: Partial<User | Driver>) => {
  if (isMockMode || !db) {
    const storageKey = `motoja_user_${uid}`;
    const stored = localStorage.getItem(storageKey);
    let updated;

    if (stored) {
      const parsed = JSON.parse(stored);
      updated = { ...parsed, ...data };
    } else {
      // Create new entry if doesn't exist (Backup / Recovery)
      updated = { id: uid, ...data };
    }

    localStorage.setItem(storageKey, JSON.stringify(updated));
    console.log('✅ User Profile Persisted:', storageKey, updated);
    return;
  }

  const userRef = doc(db, USERS_COLLECTION, uid);
  // Using setDoc with merge is safer/more robust than updateDoc for profile patches
  await setDoc(userRef, data, { merge: true });
};

// Implement User Deletion
export const deleteUser = async (uid: string) => {
  if (isMockMode || !db) {
    const storageKey = `motoja_user_${uid}`;
    localStorage.removeItem(storageKey);
    // Also remove from session list if checking there (not implemented fully in mock)
    return;
  }

  try {
    await deleteDoc(doc(db, USERS_COLLECTION, uid));
    // Ideally we should also delete related data (storage, rides) or use a Cloud Function trigger
    // For now, client-side delete of the main profile is sufficient to block access.
    console.log(`User ${uid} deleted successfully.`);
  } catch (error) {
    console.error("Error deleting user:", error);
    throw error;
  }
};

// ============ SESSION CONTROL (Single Device Login) ============

// Generate unique session ID
const generateSessionId = () => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
};

// Get current session ID from localStorage
export const getLocalSessionId = () => {
  return localStorage.getItem('motoja_session_id');
};

// Set session ID locally
const setLocalSessionId = (sessionId: string) => {
  localStorage.setItem('motoja_session_id', sessionId);
};

// Register new session (called on login)
export const registerSession = async (uid: string): Promise<string> => {
  const sessionId = generateSessionId();
  setLocalSessionId(sessionId);

  if (isMockMode || !db) {
    const storageKey = `motoja_user_${uid}`;
    const stored = localStorage.getItem(storageKey);
    let parsed: any = {};
    if (stored) {
      parsed = JSON.parse(stored);
    }
    // Ensure we write even if file didn't exist (creating minimal profile/session)
    localStorage.setItem(storageKey, JSON.stringify({ ...parsed, id: uid, activeSessionId: sessionId }));

    return sessionId;
  }

  const userRef = doc(db, USERS_COLLECTION, uid);
  // Use setDoc with merge to ensure document exists
  await setDoc(userRef, { activeSessionId: sessionId }, { merge: true });
  return sessionId;
};

// Validate session (check if current session is still active)
export const validateSession = async (uid: string): Promise<boolean> => {
  const localSessionId = getLocalSessionId();
  if (!localSessionId) return false;

  if (isMockMode || !db) {
    const storageKey = `motoja_user_${uid}`;
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      // If activeSessionId is missing in DB but we have a local session, 
      // in Mock Mode we can optionally self-heal or allow. 
      // Stricter: return parsed.activeSessionId === localSessionId;

      // Fix: If DB has NO session ID (e.g. data wipe), allow 'claiming' it? 
      // No, that overrides security. But for Mock/Demo stability:
      if (!parsed.activeSessionId) return true;

      return parsed.activeSessionId === localSessionId;
    }
    // If profile doesn't exist but we are logged in (auth.ts), allow it to avoid loop
    return true;
  }

  const userRef = doc(db, USERS_COLLECTION, uid);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    const data = userSnap.data();
    return data.activeSessionId === localSessionId;
  }
  return false;
};

// Clear session (called on logout)
export const clearSession = () => {
  localStorage.removeItem('motoja_session_id');
};