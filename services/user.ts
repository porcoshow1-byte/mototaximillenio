import { db, isMockMode } from './firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { User, Driver } from '../types';

export const USERS_COLLECTION = 'users';

interface InitialUserData {
  name?: string;
  phone?: string;
  vehicle?: string;
  plate?: string;
  cnhUrl?: string;
}

export const getOrCreateUserProfile = async (
  uid: string,
  email: string,
  role: 'user' | 'driver',
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
  } else {
    const displayName = initialData?.name || email.split('@')[0];
    const displayPhone = initialData?.phone || '';

    const baseData = {
      id: uid,
      name: displayName,
      email: email,
      phone: displayPhone,
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
};

export const updateUserProfile = async (uid: string, data: Partial<User | Driver>) => {
  if (isMockMode || !db) {
    const storageKey = `motoja_user_${uid}`;
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      const updated = { ...parsed, ...data };
      localStorage.setItem(storageKey, JSON.stringify(updated));
      console.log('✅ Driver status updated:', updated.status, updated.location);
    } else {
      // Create new entry if doesn't exist
      localStorage.setItem(storageKey, JSON.stringify({ id: uid, ...data }));
      console.log('✅ Driver entry created:', uid);
    }
    return;
  }

  const userRef = doc(db, USERS_COLLECTION, uid);
  await updateDoc(userRef, data);
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
    if (stored) {
      const parsed = JSON.parse(stored);
      localStorage.setItem(storageKey, JSON.stringify({ ...parsed, activeSessionId: sessionId }));
    }
    return sessionId;
  }

  const userRef = doc(db, USERS_COLLECTION, uid);
  await updateDoc(userRef, { activeSessionId: sessionId });
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
      return parsed.activeSessionId === localSessionId;
    }
    return false;
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