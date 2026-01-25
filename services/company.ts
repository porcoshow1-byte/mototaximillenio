import { Company } from '../types';
import { db } from './firebase';
import { collection, doc, setDoc, getDoc, getDocs, onSnapshot, query, where, updateDoc } from 'firebase/firestore';

const COLLECTION_NAME = 'companies';

const INITIAL_COMPANIES: Company[] = [
    {
        id: 'comp_001',
        name: 'Tech Solutions Ltda',
        cnpj: '12.345.678/0001-90',
        email: 'financeiro@techsolutions.com',
        status: 'active',
        address: 'Av. Paulista, 1000 - SP',
        creditLimit: 5000,
        usedCredit: 1250,
        logoUrl: 'https://ui-avatars.com/api/?name=Tech+Solutions&background=0D8ABC&color=fff' // Default
    },
    {
        id: 'comp_002',
        name: 'Logística Express',
        cnpj: '98.765.432/0001-10',
        email: 'contato@logex.com',
        status: 'active',
        address: 'Rua das Flores, 500 - RJ',
        creditLimit: 2000,
        usedCredit: 1980,
        logoUrl: 'https://ui-avatars.com/api/?name=Log+Express&background=ff0000&color=fff'
    },
    {
        id: 'comp_003',
        name: 'Terapimax',
        cnpj: '30.278.186/0001-06',
        email: 'contato@terapimax.com.br',
        status: 'active',
        address: 'Endereço da Terapimax',
        creditLimit: 100,
        usedCredit: 0,
        logoUrl: 'https://ui-avatars.com/api/?name=Terapimax&background=random&color=fff'
    }
];

// Helper for Mock Mode
const getMockData = (): Company[] => {
    const stored = JSON.parse(localStorage.getItem('motoja_mock_companies') || '[]');
    if (stored.length === 0) {
        return INITIAL_COMPANIES;
    }
    return stored.length > 0 ? stored : INITIAL_COMPANIES;
};

const saveMockData = (companies: Company[]) => {
    localStorage.setItem('motoja_mock_companies', JSON.stringify(companies));
};

export const getCompany = async (companyId: string): Promise<Company | null> => {
    if (!db) {
        const companies = getMockData();
        return companies.find(c => c.id === companyId) || null;
    }
    try {
        const docRef = doc(db, COLLECTION_NAME, companyId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data() as Company;
        }
        return null;
    } catch (error) {
        console.error("Error fetching company:", error);
        return null;
    }
};

export const saveCompany = async (company: Company): Promise<void> => {
    if (!db) {
        const companies = getMockData();
        const index = companies.findIndex(c => c.id === company.id);
        if (index >= 0) {
            companies[index] = company;
        } else {
            companies.push(company);
        }
        saveMockData(companies);
        return;
    }
    try {
        await setDoc(doc(db, COLLECTION_NAME, company.id), company);
    } catch (error) {
        console.error("Error saving company:", error);
        throw error;
    }
};

export const subscribeToCompanies = (callback: (companies: Company[]) => void) => {
    if (!db) {
        // Mock subscription
        const companies = getMockData();
        callback(companies);
        return () => { };
    }

    const q = query(collection(db, COLLECTION_NAME));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const companies: Company[] = [];
        querySnapshot.forEach((doc) => {
            companies.push(doc.data() as Company);
        });
        callback(companies);
    });

    return unsubscribe;
};

// Legacy support for mock data
export const getMockCompanies = (): Company[] => {
    return getMockData();
};

export const updateCompanyStatus = async (companyId: string, status: 'active' | 'blocked' | 'pending') => {
    if (!db) {
        const companies = getMockData();
        const company = companies.find(c => c.id === companyId);
        if (company) {
            company.status = status;
            saveMockData(companies);
        }
        return;
    }
    try {
        const docRef = doc(db, COLLECTION_NAME, companyId);
        await updateDoc(docRef, { status });
    } catch (error) {
        console.error("Error updating company status:", error);
    }
};

export const deleteCompany = async (companyId: string): Promise<void> => {
    if (!db) {
        const companies = getMockData();
        const filtered = companies.filter(c => c.id !== companyId);
        saveMockData(filtered);
        return;
    }
    try {
        const { deleteDoc } = await import('firebase/firestore');
        await deleteDoc(doc(db, COLLECTION_NAME, companyId));
    } catch (error) {
        console.error("Error deleting company:", error);
        throw error;
    }
};

export const getCompanyByOwner = async (ownerUid: string): Promise<Company | null> => {
    console.log('[getCompanyByOwner] Searching for ownerUid:', ownerUid);

    if (!db) {
        const companies = getMockData();
        console.log('[getCompanyByOwner] Mock companies:', companies.map(c => ({ id: c.id, ownerUid: c.ownerUid, email: c.email })));

        // First try to find by ownerUid
        let found = companies.find(c => c.ownerUid === ownerUid);

        // If not found, try to find by ID (in case ID === ownerUid)
        if (!found) {
            found = companies.find(c => c.id === ownerUid);
        }

        console.log('[getCompanyByOwner] Found:', found ? found.name : 'null');
        return found || null;
    }
    try {
        const q = query(collection(db, COLLECTION_NAME), where('ownerUid', '==', ownerUid));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            return querySnapshot.docs[0].data() as Company;
        }
        return null;
    } catch (error) {
        console.error("Error fetching company by owner:", error);
        return null;
    }
};

export const canBookCorporateRide = (company: Company, estimatedPrice: number): boolean => {
    if (company.status !== 'active') return false;
    const availableCredit = (company.creditLimit || 0) - (company.usedCredit || 0);
    return availableCredit >= estimatedPrice;
};

// Helper for exposing all companies (Mock or Firestore)
export const getAllCompanies = async (): Promise<Company[]> => {
    if (!db) {
        return getMockData();
    }
    try {
        const q = query(collection(db, COLLECTION_NAME));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => doc.data() as Company);
    } catch (error) {
        console.error("Error fetching all companies:", error);
        return [];
    }
};

export const findCompanyByIdentifier = async (identifier: string): Promise<Company | null> => {
    const cleanId = identifier.replace(/\D/g, ''); // For CNPJ check
    const isEmail = identifier.includes('@');

    if (!db) {
        const companies = getMockData();
        return companies.find(c =>
            c.email.toLowerCase() === identifier.toLowerCase() ||
            c.cnpj.replace(/\D/g, '') === cleanId
        ) || null;
    }

    try {
        // Try to find by Email
        let q = query(collection(db, COLLECTION_NAME), where('email', '==', identifier));
        let snapshot = await getDocs(q);

        if (!snapshot.empty) return snapshot.docs[0].data() as Company;

        // If not found and it looks like a CNPJ (digits only/mostly), try CNPJ
        // Firestore doesn't support OR queries officially in V8/simple SDKs easily without 'or' operator,
        // so sequential checks are safer for this context.
        if (!isEmail) {
            // Try strict CNPJ match if stored with formatting
            q = query(collection(db, COLLECTION_NAME), where('cnpj', '==', identifier));
            snapshot = await getDocs(q);
            if (!snapshot.empty) return snapshot.docs[0].data() as Company;
        }

        // Fallback: iterate all (expensive but safe for small datasets if exact match fails)
        // In production, maintain a 'cleanCnpj' field. For now, we rely on exact email match mostly.
        return null;
    } catch (error) {
        console.error("Error finding company:", error);
        return null;
    }
};