
import { getSettings } from './settings';
import { createPixPayment } from './mercadopago';

interface InvoicePaymentResult {
    success: boolean;
    paymentLink?: string;
    qrCode?: string;
    qrCodeBase64?: string;
    paymentId?: string;
    message?: string;
}

/**
 * Gera um pagamento de fatura corporativa (B2B) usando o gateway configurado
 */
export const generateInvoicePayment = async (
    companyId: string,
    invoiceId: string,
    amount: number,
    payerEmail: string
): Promise<InvoicePaymentResult> => {
    const settings = await getSettings();
    const provider = settings.paymentGateway.provider;
    const description = `Fatura MotoJá #${invoiceId} - Empresa ${companyId}`;

    try {
        if (provider === 'mercadopago') {
            const secretKey = settings.paymentGateway.secretKey;

            // Usa a função do serviço mercadopago passando o token configurado
            const payment = await createPixPayment(
                `inv_${invoiceId}`,
                amount,
                payerEmail,
                { accessToken: secretKey }
            );

            return {
                success: true,
                paymentId: payment.id,
                qrCode: payment.qr_code,
                qrCodeBase64: payment.qr_code_base64,
                paymentLink: payment.ticket_url,
                message: 'Fatura gerada com sucesso via Mercado Pago'
            };

        } else if (provider === 'asaas') {
            // Placeholder para implementação Asaas no futuro
            return {
                success: false,
                message: 'Integração com Asaas ainda não implementada.'
            };

        } else if (provider === 'stripe') {
            // Placeholder para implementação Stripe no futuro
            return {
                success: false,
                message: 'Integração com Stripe ainda não implementada.'
            };

        } else {
            // Modo sem provedor ou simulado
            return {
                success: true,
                paymentId: `sim_inv_${invoiceId}`,
                paymentLink: 'https://motoja.com/faturas/simulada',
                message: 'Fatura simulada gerada com sucesso'
            };
        }
    } catch (error: any) {
        console.error('Erro ao gerar fatura:', error);
        return {
            success: false,
            message: error.message || 'Erro ao gerar fatura de pagamento'
        };
    }
};
