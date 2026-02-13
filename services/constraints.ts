import { supabase, isMockMode } from './supabase';
import { USERS_TABLE } from './user';
// We can't import COMPANIES_TABLE from company.ts if it creates circular, but here it's fine.
// const COMPANIES_TABLE = 'companies'; // defining locally to be safe

interface UniquenessResult {
    exists: boolean;
    message?: string;
}

export const checkUniqueness = async (
    field: 'email' | 'cpf' | 'cnpj' | 'phone',
    value: string
): Promise<UniquenessResult> => {
    if (!value) return { exists: false };
    if (isMockMode || !supabase) return { exists: false };

    const cleanValue = field === 'email' ? value.toLowerCase().trim() : value.trim();

    try {
        // 1. Check Users Table
        if (field === 'email' || field === 'cpf' || field === 'phone') {
            const { count } = await supabase
                .from(USERS_TABLE)
                .select('id', { count: 'exact', head: true })
                .eq(field, cleanValue); // Assuming stored value matches format

            if (count && count > 0) {
                return { exists: true, message: `Este ${field === 'phone' ? 'TELEFONE' : field.toUpperCase()} já está cadastrado em nossa base.` };
            }
        }

        // 2. Check Companies Table
        if (field === 'email' || field === 'cnpj' || field === 'phone') {
            const { count } = await supabase
                .from('companies')
                .select('id', { count: 'exact', head: true })
                .eq(field, field === 'email' ? cleanValue : value); // Companies might have formatting

            if (count && count > 0) {
                return { exists: true, message: `Este ${field === 'phone' ? 'TELEFONE' : field.toUpperCase()} já está cadastrado como Empresa.` };
            }
        }

        return { exists: false };

    } catch (error) {
        console.error("Error checking uniqueness:", error);
        return { exists: false };
    }
};
