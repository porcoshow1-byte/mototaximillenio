import { getSettings } from './settings';

/**
 * Email Service
 * Handles sending system emails using the configured SMTP settings.
 * Since this runs in the browser, it simulates the SMTP handshake/sending process
 * but uses the actual configuration from SystemSettings.
 */

export interface EmailResult {
    success: boolean;
    message: string;
    details?: any;
}

export const sendEmail = async (
    to: string,
    subject: string,
    body: string, // HTML or Text
    isHtml: boolean = true
): Promise<EmailResult> => {
    const settings = await getSettings();
    const { smtp } = settings;

    console.group('📧 SMTP Email Simulation');
    console.log(`Checking SMTP Configuration...`);
    console.log(`Host: ${smtp.host}:${smtp.port}`);
    console.log(`User: ${smtp.user}`);
    console.log(`Secure: ${smtp.secure}`);

    if (!smtp.host || smtp.host === 'smtp.example.com' || !smtp.user || !smtp.pass) {
        console.warn('⚠️ SMTP not fully configured. Email would fail in production.');
        console.groupEnd();
        return {
            success: false,
            message: 'Configuração SMTP incompleta. Verifique as configurações no Painel Admin.'
        };
    }

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    console.log(`\n--- ENVELOP ---`);
    console.log(`FROM: ${smtp.fromName} <${smtp.fromEmail}>`);
    console.log(`TO: ${to}`);
    console.log(`SUBJECT: ${subject}`);
    console.log(`--- BODY (${isHtml ? 'HTML' : 'TEXT'}) ---`);
    console.log(body.substring(0, 100) + (body.length > 100 ? '...' : ''));
    console.log(`--- END ENVELOP ---\n`);

    // Integration with N8N (if enabled)
    if (settings.n8n.enabled && settings.n8n.webhookUrl) {
        console.log(`🪝 Triggering N8N Webhook for Email Event...`);
        // In a real scenario, we might fire a webhook here to log the email or track it
        // fetch(settings.n8n.webhookUrl, { method: 'POST', body: JSON.stringify({ event: 'email_sent', to, subject }) }).catch(console.error);
    }

    console.log('✅ Email sent successfully (Simulated)');
    console.groupEnd();

    return {
        success: true,
        message: 'Email enviado com sucesso (Simulado)'
    };
};

// Helper to test connection
export const testSMTPConnection = async (): Promise<EmailResult> => {
    const settings = await getSettings();
    return sendEmail(
        settings.companyEmail || 'admin@motoja.com',
        'Teste de Conexão SMTP - MotoJá',
        '<h1>Conexão SMTP Bem Sucedida!</h1><p>Se você está lendo isso, suas configurações de SMTP estão tecnicamente corretas (simuladas).</p>'
    );
};
