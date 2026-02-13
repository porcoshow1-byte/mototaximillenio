/**
 * Settings Service
 * Centralizes all application configuration.
 * Persists to Supabase 'settings' table (row id='general').
 */

import { supabase, isMockMode } from './supabase';

export interface PaymentGatewaySettings {
    provider: 'mercadopago' | 'asaas' | 'stripe' | 'none';
    apiKey: string;
    secretKey?: string;
    webhookUrl?: string; // For callbacks
    publicKey?: string;
}

export interface N8NSettings {
    enabled: boolean;
    webhookUrl: string;
    apiKey?: string;
    events: {
        rideCreated: boolean;
        rideCompleted: boolean;
        driverRegistered: boolean;
    };
}

export interface SMTPSettings {
    host: string;
    port: number;
    user: string;
    pass: string;
    secure: boolean;
    fromName: string;
    fromEmail: string;
}

export interface CampaignBanner {
    id: string;
    title: string;
    imageUrl: string;
    linkUrl?: string;
    showCta?: boolean;
    ctaType?: 'saiba_mais' | 'ligar' | 'whatsapp' | 'eu_quero' | 'comprar' | 'pedir_agora' | 'chamar_zap' | 'zap' | 'chama';
    active: boolean;
    createdAt: string;
}

export interface SystemSettings {
    // Pricing
    basePrice: number;
    pricePerKm: number;
    platformFee: number;

    // Bike Pricing
    bikeBasePrice: number;
    bikePricePerKm: number;
    bikeMaxDistance: number;
    bikePlatformFee: number;

    // Delivery Moto Pricing
    deliveryMotoBasePrice: number;
    deliveryMotoPricePerKm: number;

    // Company Info
    appName: string;
    supportPhone: string;
    supportEmail: string;
    companyName: string;
    companyCnpj: string;
    companyAddress: string;
    companyCity: string;
    companyState: string;
    companyCep: string;
    companyEmail: string;
    companyPhone: string;

    // Visual Customization
    visual: {
        loginBackgroundImage: string;
        mobileBackgroundImage: string;
        appLogoUrl: string;
        primaryColor: string;
        loginTitle: string;
        loginSubtitle: string;
    };

    // Integations
    paymentGateway: PaymentGatewaySettings;
    n8n: N8NSettings;
    smtp: SMTPSettings;

    // Campaigns (Partner Ads)
    campaigns: CampaignBanner[];
    activeCampaignBanner: string | null;
}

export const DEFAULT_SETTINGS: SystemSettings = {
    basePrice: 5.00,
    pricePerKm: 2.00,
    platformFee: 20,
    bikeBasePrice: 3.00,
    bikePricePerKm: 1.50,
    bikeMaxDistance: 5,
    bikePlatformFee: 15,

    deliveryMotoBasePrice: 6.00,
    deliveryMotoPricePerKm: 2.20,

    appName: 'MotoJá',
    supportPhone: '(11) 99999-9999',
    supportEmail: 'suporte@motoja.com.br',
    companyName: 'MotoJá Transportes LTDA',
    companyCnpj: '00.000.000/0001-00',
    companyAddress: 'Rua das Motos, 123 - Centro',
    companyCity: 'Avaré',
    companyState: 'SP',
    companyCep: '18700-000',
    companyEmail: 'contato@motoja.com.br',
    companyPhone: '(14) 3732-0000',

    visual: {
        loginBackgroundImage: '/assets/admin_login.png',
        mobileBackgroundImage: '',
        appLogoUrl: '',
        primaryColor: '#f97316', // Orange-500
        loginTitle: 'MotoJá',
        loginSubtitle: 'Gestão completa da plataforma de mobilidade em um único lugar.',
    },

    paymentGateway: {
        provider: 'none',
        apiKey: '',
        secretKey: '',
    },
    n8n: {
        enabled: false,
        webhookUrl: '',
        events: {
            rideCreated: true,
            rideCompleted: true,
            driverRegistered: true,
        }
    },
    smtp: {
        host: 'smtp.example.com',
        port: 587,
        user: 'user@example.com',
        pass: '',
        secure: true,
        fromName: 'MotoJá Notificações',
        fromEmail: 'noreply@motoja.com.br'
    },
    campaigns: [],
    activeCampaignBanner: null
};

const STORAGE_KEY = 'motoja_system_settings';
export const SETTINGS_TABLE = 'settings';

/**
 * Validates and merges data with default settings
 */
const mergeWithDefaults = (data: any): SystemSettings => {
    return {
        ...DEFAULT_SETTINGS,
        ...data,
        paymentGateway: { ...DEFAULT_SETTINGS.paymentGateway, ...(data.paymentGateway || {}) },
        n8n: { ...DEFAULT_SETTINGS.n8n, ...(data.n8n || {}) },
        smtp: { ...DEFAULT_SETTINGS.smtp, ...(data.smtp || {}) },
        visual: { ...DEFAULT_SETTINGS.visual, ...(data.visual || {}) },
    };
};

/**
 * Fetch settings from Supabase.
 * Falls back to DEFAULTS if not found.
 */
export const getSettings = async (): Promise<SystemSettings> => {
    if (isMockMode || !supabase) {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) return mergeWithDefaults(JSON.parse(stored));
        return DEFAULT_SETTINGS;
    }

    try {
        const { data, error } = await supabase
            .from(SETTINGS_TABLE)
            .select('data')
            .eq('id', 'general')
            .single();

        if (data && data.data) {
            return mergeWithDefaults(data.data);
        }
    } catch (e) {
        console.warn('Error fetching settings from Supabase:', e);
    }

    return DEFAULT_SETTINGS;
};

/**
 * Save settings to Supabase
 */
export const saveSettings = async (settings: SystemSettings): Promise<void> => {
    if (isMockMode || !supabase) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
        return;
    }

    try {
        const { error } = await supabase
            .from(SETTINGS_TABLE)
            .upsert({ id: 'general', data: settings });

        if (error) throw error;

        console.log('[Settings] Saved to Supabase successfully');
    } catch (e: any) {
        console.error('[Settings] Error saving to Supabase:', e);
        throw new Error('Erro ao salvar: ' + (e?.message || 'Erro desconhecido'));
    }
};

/**
 * Real-time settings subscription
 */
export const subscribeToSettings = (callback: (settings: SystemSettings) => void) => {
    if (isMockMode || !supabase) {
        callback(DEFAULT_SETTINGS);
        return () => { };
    }

    // Initial fetch
    getSettings().then(callback);

    const channel = supabase
        .channel('settings_update')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: SETTINGS_TABLE, filter: "id=eq.general" },
            (payload) => {
                if (payload.new && (payload.new as any).data) {
                    const merged = mergeWithDefaults((payload.new as any).data);
                    // Update cache silently
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
                    callback(merged);
                }
            }
        )
        .subscribe();

    return () => {
        channel.unsubscribe();
    };
};
