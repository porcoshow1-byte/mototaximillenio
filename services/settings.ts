/**
 * Settings Service
 * Centralizes all application configuration including Pricing, Company Info, and Integrations.
 * Persists to localStorage for the prototype.
 */

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
        loginBackgroundImage: string; // URL or Base64 (Desktop)
        mobileBackgroundImage: string; // URL or Base64 (Mobile)
        appLogoUrl: string; // URL or Base64 (Optional)
        primaryColor: string; // Optional branding
        loginTitle: string; // Custom title
        loginSubtitle: string; // Custom subtitle
    };

    // Integations
    paymentGateway: PaymentGatewaySettings;
    n8n: N8NSettings;
    smtp: SMTPSettings;
}

export const DEFAULT_SETTINGS: SystemSettings = {
    basePrice: 5.00,
    pricePerKm: 2.00,
    platformFee: 20,
    bikeBasePrice: 3.00,
    bikePricePerKm: 1.50,
    bikeMaxDistance: 5,
    bikePlatformFee: 15,

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
    }
};

import { db } from './firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

const STORAGE_KEY = 'motoja_system_settings';

const getSettingsDoc = () => {
    if (!db) return null;
    return doc(db, 'settings', 'general');
};
/**
 * Fetch settings from Firestore.
 * Falls back to DEFAULTS if not found.
 */
export const getSettings = async (): Promise<SystemSettings> => {
    try {
        const docRef = getSettingsDoc();
        if (docRef) {
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data() as Partial<SystemSettings>;
                return mergeWithDefaults(data);
            }
        }
    } catch (e) {
        console.warn('Error fetching settings from Firestore:', e);
    }

    return DEFAULT_SETTINGS;
};

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
 * Save settings to Firestore
 * Images are compressed Base64 or Firebase Storage URLs.
 */
export const saveSettings = async (settings: SystemSettings): Promise<void> => {
    const docRef = getSettingsDoc();
    if (!docRef) {
        throw new Error('Firestore não disponível. Configure as variáveis de ambiente do Firebase.');
    }

    try {
        const jsonStr = JSON.stringify(settings);
        const sizeKB = Math.round(jsonStr.length / 1024);
        console.log(`[Settings] Document size: ${sizeKB}KB`);

        if (sizeKB > 900) {
            console.warn(`[Settings] Document is very large (${sizeKB}KB), may exceed 1MB Firestore limit`);
        }

        await setDoc(docRef, settings);
        console.log('[Settings] Saved to Firestore successfully');
    } catch (e: any) {
        console.error('[Settings] Error saving to Firestore:', e);
        throw new Error('Erro ao salvar: ' + (e?.message || 'Erro desconhecido'));
    }
};

/**
 * Real-time settings subscription
 */
export const subscribeToSettings = (callback: (settings: SystemSettings) => void) => {
    const docRef = getSettingsDoc();
    if (!docRef) {
        console.warn('Firestore not available for subscription.');
        callback(DEFAULT_SETTINGS);
        return () => { };
    }

    return onSnapshot(docRef, (doc) => {
        if (doc.exists()) {
            const data = doc.data();
            const merged = mergeWithDefaults(data);
            // Update cache silently
            localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
            callback(merged);
        } else {
            callback(DEFAULT_SETTINGS);
        }
    });
};

