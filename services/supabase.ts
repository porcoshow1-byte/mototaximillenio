import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Helper para ler variáveis de ambiente de forma segura
const getEnv = (key: string): string => {
    // @ts-ignore
    return (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) || '';
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY');

// Se não houver configuração válida, ativamos o modo Mock
export const isMockMode = !supabaseUrl || supabaseUrl.length < 10;

let supabase: SupabaseClient | null = null;

try {
    if (!isMockMode) {
        supabase = createClient(supabaseUrl, supabaseAnonKey, {
            auth: {
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: true,
            },
            realtime: {
                params: {
                    eventsPerSecond: 10,
                },
            },
        });
        console.log("✅ Supabase conectado:", supabaseUrl);
    } else {
        console.warn("⚠️ Supabase não configurado (Faltam variáveis de ambiente). O app rodará em modo MOCK/DEMO.");
    }
} catch (error: any) {
    console.error("ERRO CRÍTICO SUPABASE:", error);
}

export { supabase };
