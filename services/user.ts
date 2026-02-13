import { supabase, isMockMode } from './supabase';
import { User, Driver } from '../types';

export const USERS_TABLE = 'users';

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

// Helper to map DB snake_case to App camelCase
const mapToAppUser = (data: any): User | Driver => {
  if (!data) return data;
  return {
    ...data,
    earningsToday: data.earnings_today,
    verificationStatus: data.verification_status,
    cnhUrl: data.cnh_url,
    rejectionReason: data.rejection_reason,
    activeSessionId: data.active_session_id,
    addressComponents: data.address_components,
    totalRides: data.total_rides,
    walletBalance: data.wallet_balance,
    walletHistory: data.wallet_history,
    referralCode: data.referral_code,
    favoriteDrivers: data.favorite_drivers,
    savedAddresses: data.saved_addresses,
    companyId: data.company_id,
    driverStatus: data.driver_status,
    // Fix: Map driver_status to status so UI can read it consistently
    status: data.driver_status || data.status
  };
};

// Helper to map App camelCase to DB snake_case
const mapToDbUser = (data: any): any => {
  const mapped: any = { ...data };

  // Mapping specific fields
  if (data.earningsToday !== undefined) mapped.earnings_today = data.earningsToday;
  if (data.verificationStatus !== undefined) mapped.verification_status = data.verificationStatus;
  if (data.cnhUrl !== undefined) mapped.cnh_url = data.cnhUrl;
  if (data.rejectionReason !== undefined) mapped.rejection_reason = data.rejectionReason;
  if (data.activeSessionId !== undefined) mapped.active_session_id = data.activeSessionId;
  if (data.addressComponents !== undefined) mapped.address_components = data.addressComponents;
  if (data.totalRides !== undefined) mapped.total_rides = data.totalRides;
  if (data.walletBalance !== undefined) mapped.wallet_balance = data.walletBalance;
  if (data.walletHistory !== undefined) mapped.wallet_history = data.walletHistory;
  if (data.referralCode !== undefined) mapped.referral_code = data.referralCode;
  if (data.favoriteDrivers !== undefined) mapped.favorite_drivers = data.favoriteDrivers;
  if (data.savedAddresses !== undefined) mapped.saved_addresses = data.savedAddresses;
  if (data.companyId !== undefined) mapped.company_id = data.companyId;
  if (data.driverStatus !== undefined) mapped.driver_status = data.driverStatus;

  // Fix: If 'status' is being updated to an availability state, map it to driver_status
  if (data.status === 'online' || data.status === 'offline' || data.status === 'busy') {
    mapped.driver_status = data.status;
    // Do NOT send 'status' column update if it's meant for driver_status, 
    // unless you actually have a 'status' column for account status that you don't want to corrupt.
    // Assuming 'status' column is for account status (active/blocked).
    delete mapped.status;
  }

  // Remove camelCase keys to avoid DB errors (Supabase ignores unknown columns usually, but good practice)
  delete mapped.earningsToday;
  delete mapped.verificationStatus;
  delete mapped.cnhUrl;
  delete mapped.rejectionReason;
  delete mapped.activeSessionId;
  delete mapped.addressComponents;
  delete mapped.totalRides;
  delete mapped.walletBalance;
  delete mapped.walletHistory;
  delete mapped.referralCode;
  delete mapped.favoriteDrivers;
  delete mapped.savedAddresses;
  delete mapped.companyId;
  delete mapped.driverStatus;

  return mapped;
};


// Check if user already exists by specific field
export const checkUniqueness = async (field: 'cpf' | 'phone' | 'email', value: string): Promise<{ exists: boolean, message?: string }> => {
  if (isMockMode || !supabase || !value) return { exists: false };

  // Skip unique check for empty/incomplete values
  if (field === 'cpf' && value.length < 11) return { exists: false };
  if (field === 'phone' && value.length < 10) return { exists: false };
  if (field === 'email' && !value.includes('@')) return { exists: false };

  // Supabase check
  // Note: field name in DB matches 'email', 'phone', 'cpf' exactly, so no mapping needed for these.
  const { data, error } = await supabase
    .from(USERS_TABLE)
    .select('id')
    .eq(field, value)
    .single();

  if (data) {
    const msgs = {
      cpf: 'Este CPF já está cadastrado.',
      phone: 'Este telefone já está cadastrado.',
      email: 'Este e-mail já está cadastrado.'
    };
    return { exists: true, message: msgs[field] };
  }

  return { exists: false };
};

// Deprecated: Keeping for backward compatibility
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

  // MOCK MODE
  if (isMockMode || !supabase) {
    const storageKey = `motoja_user_${uid}`;
    const stored = localStorage.getItem(storageKey);

    if (stored) {
      const parsed = JSON.parse(stored);
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
      type: role === 'user' ? 'passenger' : role // Map role to schema type
    };

    let newProfile: any = baseData;
    if (role === 'driver') {
      newProfile = {
        ...baseData,
        vehicle: initialData?.vehicle || 'Moto Demo',
        plate: initialData?.plate || 'DEMO-9999',
        status: 'online',
        location: { lat: -23.1047, lng: -48.9213 },
        earningsToday: 0
      };
    }

    localStorage.setItem(storageKey, JSON.stringify(newProfile));
    return newProfile;
  }

  // SUPABASE MODE
  // 1. Try to get user
  const { data: userData, error } = await supabase
    .from(USERS_TABLE)
    .select('*')
    .eq('id', uid)
    .single();

  if (userData) {
    // User exists
    let mappedUser = mapToAppUser(userData) as any;

    // Check if we need to update driver info on login (if missing)
    if (role === 'driver' && initialData) {
      const needsUpdate: any = {};

      // Update vehicle/plate/cnhUrl if missing
      if ((!mappedUser.vehicle || !mappedUser.plate || !mappedUser.cnhUrl)) {
        if (initialData.vehicle) needsUpdate.vehicle = initialData.vehicle;
        if (initialData.plate) needsUpdate.plate = initialData.plate;
        if (initialData.cnhUrl) needsUpdate.cnh_url = initialData.cnhUrl;
      }

      // Update personal data if missing or defaulted to email prefix
      if (initialData.name && (!mappedUser.name || mappedUser.name === email.split('@')[0])) {
        needsUpdate.name = initialData.name;
      }
      if (initialData.phone && !mappedUser.phone) {
        needsUpdate.phone = initialData.phone;
      }
      if (initialData.cpf && !mappedUser.cpf) {
        needsUpdate.cpf = initialData.cpf;
      }

      // Always ensure driver status fields exist
      needsUpdate.driver_status = mappedUser.driverStatus || 'offline';
      needsUpdate.verification_status = mappedUser.verificationStatus || 'pending';

      if (Object.keys(needsUpdate).length > 2) { // More than just status fields
        await supabase.from(USERS_TABLE).update(needsUpdate).eq('id', uid);
        mappedUser = {
          ...mappedUser,
          ...needsUpdate,
          name: needsUpdate.name || mappedUser.name,
          phone: needsUpdate.phone || mappedUser.phone,
          cpf: needsUpdate.cpf || mappedUser.cpf,
          driverStatus: needsUpdate.driver_status,
          verificationStatus: needsUpdate.verification_status,
          cnhUrl: needsUpdate.cnh_url || mappedUser.cnhUrl
        };
      }
    }

    return mappedUser;
  }

  // 2. User does not exist, create new
  const displayName = initialData?.name || email.split('@')[0];
  const displayPhone = initialData?.phone || '';

  const baseData = {
    id: uid,
    auth_id: uid, // Make sure to link with Auth!
    name: displayName,
    email: email,
    phone: displayPhone,
    cpf: initialData?.cpf || '',
    rating: 5.0,
    avatar: `https://ui-avatars.com/api/?background=${role === 'user' ? 'orange' : '000'}&color=fff&name=${displayName}`,
    type: role === 'user' ? 'passenger' : role, // Map role to schema type
    address: initialData?.address || '',
    address_components: initialData?.addressComponents || null
  };

  let newProfile: any = baseData;

  if (role === 'driver') {
    newProfile = {
      ...baseData,
      vehicle: initialData?.vehicle || 'Veículo não cadastrado',
      plate: initialData?.plate || 'AAA-0000',
      driver_status: 'offline',
      location: { lat: 0, lng: 0 },
      earnings_today: 0,
      verification_status: 'pending',
      cnh_url: initialData?.cnhUrl || ''
    };
  }

  const { data: createdUser, error: createError } = await supabase
    .from(USERS_TABLE)
    .insert(newProfile)
    .select()
    .single();

  if (createError) {
    console.error("Error creating user profile:", createError);
    throw createError;
  }

  return mapToAppUser(createdUser);
}


export const updateUserProfile = async (uid: string, data: Partial<User | Driver>) => {
  if (isMockMode || !supabase) {
    const storageKey = `motoja_user_${uid}`;
    const stored = localStorage.getItem(storageKey);
    let updated;
    if (stored) {
      const parsed = JSON.parse(stored);
      updated = { ...parsed, ...data };
    } else {
      updated = { id: uid, ...data };
    }
    localStorage.setItem(storageKey, JSON.stringify(updated));
    return;
  }

  const dbData = mapToDbUser(data);
  const { error } = await supabase.from(USERS_TABLE).update(dbData).eq('id', uid);

  if (error) {
    console.error("Error updating user profile:", error);
    throw new Error(error.message || 'Falha ao atualizar perfil');
  }
};

export const deleteUser = async (uid: string) => {
  if (isMockMode || !supabase) {
    localStorage.removeItem(`motoja_user_${uid}`);
    return;
  }

  // Supabase delete
  const { error } = await supabase.from(USERS_TABLE).delete().eq('id', uid);
  if (error) throw error;
};

// ============ SESSION CONTROL ============

const generateSessionId = () => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
};

export const getLocalSessionId = () => {
  return localStorage.getItem('motoja_session_id');
};

const setLocalSessionId = (sessionId: string) => {
  localStorage.setItem('motoja_session_id', sessionId);
};

export const registerSession = async (uid: string): Promise<string> => {
  const sessionId = generateSessionId();
  setLocalSessionId(sessionId);

  if (isMockMode || !supabase) {
    // ... mock logic ...
    return sessionId;
  }

  await supabase.from(USERS_TABLE).update({ active_session_id: sessionId }).eq('id', uid);
  return sessionId;
};

export const validateSession = async (uid: string): Promise<boolean> => {
  const localSessionId = getLocalSessionId();
  if (!localSessionId) return false;

  if (isMockMode || !supabase) {
    return true; // Simplification for mock
  }

  const { data } = await supabase.from(USERS_TABLE).select('active_session_id').eq('id', uid).single();

  if (data) {
    return data.active_session_id === localSessionId;
  }
  return false;
};

export const clearSession = () => {
  localStorage.removeItem('motoja_session_id');
};