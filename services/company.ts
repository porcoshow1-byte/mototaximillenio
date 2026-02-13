import { Company } from '../types';
import { supabase, isMockMode } from './supabase';

const COMPANIES_TABLE = 'companies';

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
    // ... keep other mocks if needed
];

// Helpers
const mapToAppCompany = (data: any): Company => {
    if (!data) return data;
    return {
        ...data,
        creditLimit: data.credit_limit,
        usedCredit: data.used_credit,
        logoUrl: data.logo_url,
        contractUrl: data.contract_url,
        ownerUid: data.owner_uid,
        tradeName: data.trade_name,
        stateInscription: data.state_inscription,
        financialManager: data.financial_manager,
        financialManagerPhone: data.financial_manager_phone,
        isTempPassword: data.is_temp_password,
        passwordHash: data.password_hash,
        allowInvoicing: data.allow_invoicing,
        addressComponents: data.address_components
    };
};

const mapToDbCompany = (data: Partial<Company>): any => {
    const mapped: any = { ...data };

    if (data.creditLimit !== undefined) mapped.credit_limit = data.creditLimit;
    if (data.usedCredit !== undefined) mapped.used_credit = data.usedCredit;
    if (data.logoUrl !== undefined) mapped.logo_url = data.logoUrl;
    if (data.contractUrl !== undefined) mapped.contract_url = data.contractUrl;
    if (data.ownerUid !== undefined) mapped.owner_uid = data.ownerUid;
    if (data.tradeName !== undefined) mapped.trade_name = data.tradeName;
    if (data.stateInscription !== undefined) mapped.state_inscription = data.stateInscription;
    if (data.financialManager !== undefined) mapped.financial_manager = data.financialManager;
    if (data.financialManagerPhone !== undefined) mapped.financial_manager_phone = data.financialManagerPhone;
    if (data.isTempPassword !== undefined) mapped.is_temp_password = data.isTempPassword;
    if (data.passwordHash !== undefined) mapped.password_hash = data.passwordHash;
    if (data.allowInvoicing !== undefined) mapped.allow_invoicing = data.allowInvoicing;
    if (data.addressComponents !== undefined) mapped.address_components = data.addressComponents;

    delete mapped.creditLimit;
    delete mapped.usedCredit;
    delete mapped.logoUrl;
    delete mapped.contractUrl;
    delete mapped.ownerUid;
    delete mapped.tradeName;
    delete mapped.stateInscription;
    delete mapped.financialManager;
    delete mapped.financialManagerPhone;
    delete mapped.isTempPassword;
    delete mapped.passwordHash;
    delete mapped.allowInvoicing;
    delete mapped.addressComponents;

    return mapped;
};

const getMockData = (): Company[] => {
    try {
        const stored = JSON.parse(localStorage.getItem('motoja_mock_companies') || '[]');
        return stored.length > 0 ? stored : INITIAL_COMPANIES;
    } catch { return INITIAL_COMPANIES; }
};

const saveMockData = (companies: Company[]) => {
    localStorage.setItem('motoja_mock_companies', JSON.stringify(companies));
};

export const getCompany = async (companyId: string): Promise<Company | null> => {
    if (isMockMode || !supabase) {
        const companies = getMockData();
        return companies.find(c => c.id === companyId) || null;
    }
    const { data, error } = await supabase
        .from(COMPANIES_TABLE)
        .select('*')
        .eq('id', companyId)
        .single();

    if (error) {
        console.error("Error fetching company:", error);
        return null;
    }
    return mapToAppCompany(data);
};

export const saveCompany = async (company: Company): Promise<void> => {
    if (isMockMode || !supabase) {
        const companies = getMockData();
        const index = companies.findIndex(c => c.id === company.id);
        if (index >= 0) companies[index] = company;
        else companies.push(company);
        saveMockData(companies);
        return;
    }

    const dbData = mapToDbCompany(company);
    // Use upsert
    const { error } = await supabase
        .from(COMPANIES_TABLE)
        .upsert(dbData);

    if (error) {
        console.error("Error saving company:", error);
        throw error;
    }
};

export const subscribeToCompanies = (callback: (companies: Company[]) => void) => {
    if (isMockMode || !supabase) {
        callback(getMockData());
        return () => { };
    }

    const fetchAll = () => {
        supabase
            .from(COMPANIES_TABLE)
            .select('*')
            .then(({ data }) => {
                if (data) callback(data.map(mapToAppCompany));
            });
    };

    fetchAll();

    const channel = supabase
        .channel('companies_list')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: COMPANIES_TABLE },
            () => fetchAll()
        )
        .subscribe();

    return () => channel.unsubscribe();
};

export const getMockCompanies = (): Company[] => getMockData();

export const updateCompanyStatus = async (companyId: string, status: 'active' | 'blocked' | 'pending') => {
    if (isMockMode || !supabase) {
        const companies = getMockData();
        const company = companies.find(c => c.id === companyId);
        if (company) {
            company.status = status;
            saveMockData(companies);
        }
        return;
    }
    await supabase.from(COMPANIES_TABLE).update({ status }).eq('id', companyId);
};

export const deleteCompany = async (companyId: string): Promise<void> => {
    if (isMockMode || !supabase) {
        const companies = getMockData();
        saveMockData(companies.filter(c => c.id !== companyId));
        return;
    }

    const { error } = await supabase.from(COMPANIES_TABLE).delete().eq('id', companyId);
    if (error) throw error;
};

export const getCompanyByOwner = async (ownerUid: string): Promise<Company | null> => {
    if (isMockMode || !supabase) {
        const companies = getMockData();
        let found = companies.find(c => c.ownerUid === ownerUid);
        if (!found) found = companies.find(c => c.id === ownerUid);
        return found || null;
    }

    const { data } = await supabase
        .from(COMPANIES_TABLE)
        .select('*')
        .eq('owner_uid', ownerUid)
        .single();

    return mapToAppCompany(data);
};

export const canBookCorporateRide = (company: Company, estimatedPrice: number): boolean => {
    if (company.status !== 'active') return false;
    const availableCredit = (company.creditLimit || 0) - (company.usedCredit || 0);
    return availableCredit >= estimatedPrice;
};

export const getAllCompanies = async (): Promise<Company[]> => {
    if (isMockMode || !supabase) return getMockData();

    const { data } = await supabase.from(COMPANIES_TABLE).select('*');
    return (data || []).map(mapToAppCompany);
};

export const findCompanyByIdentifier = async (identifier: string): Promise<Company | null> => {
    const isEmail = identifier.includes('@');

    if (isMockMode || !supabase) {
        const companies = getMockData();
        return companies.find(c =>
            c.email.toLowerCase() === identifier.toLowerCase() ||
            c.cnpj === identifier
        ) || null;
    }

    let query = supabase.from(COMPANIES_TABLE).select('*');
    if (isEmail) {
        query = query.eq('email', identifier);
    } else {
        query = query.eq('cnpj', identifier);
    }

    const { data } = await query.single();
    return mapToAppCompany(data);
};

export const checkCompanyExists = async (cnpj: string): Promise<boolean> => {
    if (isMockMode || !supabase) return false;
    const { count } = await supabase
        .from(COMPANIES_TABLE)
        .select('id', { count: 'exact', head: true })
        .eq('cnpj', cnpj);

    return (count || 0) > 0;
};