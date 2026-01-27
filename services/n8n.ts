
import { getSettings } from './settings';

type WebhookEvent = 'ride_requested' | 'ride_accepted' | 'ride_completed' | 'ride_cancelled' | 'driver_approved' | 'support_ticket_created';

interface WebhookPayload {
    event: WebhookEvent;
    timestamp: string;
    data: any;
}

/**
 * Dispara um webhook para o N8N se a integração estiver ativa
 */
export const triggerN8NWebhook = async (event: WebhookEvent, data: any) => {
    const settings = await getSettings();

    if (!settings.n8n.enabled || !settings.n8n.webhookUrl) {
        return;
    }

    const payload: WebhookPayload = {
        event,
        timestamp: new Date().toISOString(),
        data
    };

    try {
        console.log(`🔌 N8N: Disparando webhook para ${event}`, payload);

        // Em produção, isso seria um fetch real.
        // Como estamos no navegador, pode ter problemas de CORS dependendo da configuração do N8N.
        // Usamos 'no-cors' para disparar e esquecer (fire and forget) em alguns casos, 
        // ou assumimos que o servidor N8N suporta CORS.

        fetch(settings.n8n.webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        }).catch(err => {
            console.warn('⚠️ N8N: Erro ao enviar webhook (possível erro de CORS ou rede)', err);
        });

    } catch (error) {
        console.error('❌ N8N: Erro interno ao processar webhook', error);
    }
};
