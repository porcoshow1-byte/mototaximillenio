/**
 * MotoJá Notifications Service
 * Sistema de notificações push para motoristas e passageiros
 * Usa a Notification API do browser para enviar notificações locais
 */

// Verificar se o navegador suporta notificações
export const isNotificationSupported = (): boolean => {
    return 'Notification' in window;
};

// Verificar status atual da permissão
export const getPermissionStatus = (): NotificationPermission | 'unsupported' => {
    if (!isNotificationSupported()) return 'unsupported';
    return Notification.permission;
};

/**
 * Solicita permissão para enviar notificações
 * Deve ser chamado após interação do usuário (click em botão)
 */
export const requestNotificationPermission = async (): Promise<boolean> => {
    if (!isNotificationSupported()) {
        console.warn('Notificações não são suportadas neste navegador');
        return false;
    }

    if (Notification.permission === 'granted') {
        return true;
    }

    if (Notification.permission === 'denied') {
        console.warn('Usuário negou permissão de notificações anteriormente');
        return false;
    }

    try {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
    } catch (error) {
        console.error('Erro ao solicitar permissão de notificação:', error);
        return false;
    }
};

// Ícone padrão para notificações
const DEFAULT_ICON = '/favicon.ico';

// Badge para PWA (ícone pequeno)
const DEFAULT_BADGE = '/favicon.ico';

/**
 * Tipos de notificação suportados
 */
export type NotificationType =
    | 'newRideRequest'     // Motorista: nova solicitação
    | 'rideAccepted'       // Passageiro: corrida aceita
    | 'driverArrived'      // Passageiro: motorista chegou
    | 'rideStarted'        // Passageiro: corrida iniciada
    | 'rideCompleted'      // Ambos: corrida finalizada
    | 'rideCancelled'      // Ambos: corrida cancelada
    | 'newMessage'         // Ambos: nova mensagem no chat
    | 'paymentConfirmed'   // Passageiro: pagamento confirmado
    | 'driverApproved'     // Motorista: cadastro aprovado
    | 'driverRejected'     // Motorista: cadastro rejeitado
    // Admin notifications
    | 'adminNewDriver'     // Admin: novo motorista aguardando aprovação
    | 'adminRideIssue'     // Admin: problema reportado em corrida
    | 'adminPaymentPending'// Admin: pagamento pendente
    | 'adminLowRating'     // Admin: avaliação baixa recebida
    | 'adminSystemAlert';  // Admin: alerta do sistema

interface NotificationData {
    title: string;
    body: string;
    icon?: string;
    tag?: string;          // Agrupa notificações do mesmo tipo
    requireInteraction?: boolean;  // Não fecha automaticamente
    data?: any;            // Dados extras para click handler
}

/**
 * Configurações de notificação por tipo
 */
const notificationConfigs: Record<NotificationType, (data?: any) => NotificationData> = {
    newRideRequest: (data) => ({
        title: '🏍️ Nova corrida disponível!',
        body: `R$ ${data?.price?.toFixed(2) || '0,00'} - ${data?.origin || 'Origem'} → ${data?.destination || 'Destino'}`,
        tag: 'new-ride',
        requireInteraction: true,
    }),

    rideAccepted: (data) => ({
        title: '✅ Motorista a caminho!',
        body: `${data?.driverName || 'Seu motorista'} está indo até você`,
        tag: 'ride-status',
    }),

    driverArrived: (data) => ({
        title: '📍 Motorista chegou!',
        body: `${data?.driverName || 'Seu motorista'} está te esperando`,
        tag: 'ride-status',
        requireInteraction: true,
    }),

    rideStarted: () => ({
        title: '🚀 Corrida iniciada',
        body: 'Boa viagem! Aproveite o trajeto.',
        tag: 'ride-status',
    }),

    rideCompleted: () => ({
        title: '🎉 Corrida concluída!',
        body: 'Obrigado por usar o MotoJá. Avalie sua experiência!',
        tag: 'ride-status',
    }),

    rideCancelled: () => ({
        title: '❌ Corrida cancelada',
        body: 'A corrida foi cancelada.',
        tag: 'ride-status',
    }),

    newMessage: (data) => ({
        title: `💬 ${data?.senderName || 'Nova mensagem'}`,
        body: data?.message || 'Você recebeu uma nova mensagem',
        tag: 'chat-message',
    }),

    paymentConfirmed: (data) => ({
        title: '💰 Pagamento confirmado!',
        body: `R$ ${data?.amount?.toFixed(2) || '0,00'} processado com sucesso`,
        tag: 'payment',
    }),

    // Driver verification notifications
    driverApproved: () => ({
        title: '🎉 Cadastro Aprovado!',
        body: 'Parabéns! Seu cadastro foi aprovado. Você já pode ficar online e aceitar corridas!',
        tag: 'driver-verification',
        requireInteraction: true,
    }),

    driverRejected: (data) => ({
        title: '❌ Cadastro Não Aprovado',
        body: data?.reason
            ? `Seu cadastro não foi aprovado. Motivo: ${data.reason}`
            : 'Seu cadastro não foi aprovado. Entre em contato com o suporte.',
        tag: 'driver-verification',
        requireInteraction: true,
    }),

    // Admin Notifications
    adminNewDriver: (data) => ({
        title: '🆕 Novo piloto aguardando',
        body: `${data?.driverName || 'Um novo piloto'} enviou documentos para verificação`,
        tag: 'admin-driver',
        requireInteraction: true,
    }),

    adminRideIssue: (data) => ({
        title: '⚠️ Problema reportado',
        body: `Corrida #${data?.rideId || 'N/A'} tem um problema reportado pelo passageiro`,
        tag: 'admin-issue',
        requireInteraction: true,
    }),

    adminPaymentPending: (data) => ({
        title: '💳 Pagamento pendente',
        body: `Transferência de R$ ${data?.amount?.toFixed(2) || '0,00'} pendente há ${data?.days || 1} dias`,
        tag: 'admin-payment',
    }),

    adminLowRating: (data) => ({
        title: '⭐ Avaliação baixa',
        body: `${data?.driverName || 'Um piloto'} recebeu avaliação ${data?.rating || '2.0'}`,
        tag: 'admin-rating',
    }),

    adminSystemAlert: (data) => ({
        title: '🔔 Alerta do Sistema',
        body: data?.message || 'Nova atualização disponível',
        tag: 'admin-system',
    }),
};

/**
 * Envia uma notificação local para o usuário
 * Usa o Service Worker quando disponível para funcionar mesmo com app fechado
 * @param type Tipo da notificação
 * @param data Dados opcionais para personalizar a mensagem
 * @param forceShow Se true, mostra mesmo que a página esteja em foco
 */
export const showNotification = async (
    type: NotificationType,
    data?: Record<string, any>,
    forceShow?: boolean
): Promise<boolean> => {
    // Verificar permissão
    if (Notification.permission !== 'granted') {
        console.warn('Permissão de notificação não concedida');
        return false;
    }

    // Não mostrar se a página estiver visível e em foco (a menos que forçado)
    if (!forceShow && document.visibilityState === 'visible' && document.hasFocus()) {
        return false;
    }

    try {
        const config = notificationConfigs[type](data);

        // PERSISTENCE: Save to Supabase if user is logged in
        // We need to dynamically import supabase to avoid circular deps and get current session
        import('./supabase').then(({ supabase, isMockMode }) => {
            if (!isMockMode && supabase) {
                supabase.auth.getSession().then(({ data: sessionData }) => {
                    if (sessionData.session?.user) {
                        persistNotification(sessionData.session.user.id, type, config);
                    }
                });
            }
        });

        // Try using Service Worker for persistent notifications
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            const registration = await navigator.serviceWorker.ready;
            await registration.showNotification(config.title, {
                body: config.body,
                icon: config.icon || '/icon-192.png',
                badge: DEFAULT_BADGE,
                tag: config.tag,
                requireInteraction: config.requireInteraction || false,
                data: { ...config.data, url: window.location.href },
                silent: false,
            } as NotificationOptions);
            return true;
        }

        // Fallback: regular Notification API
        const notification = new Notification(config.title, {
            body: config.body,
            icon: config.icon || DEFAULT_ICON,
            badge: DEFAULT_BADGE,
            tag: config.tag,
            requireInteraction: config.requireInteraction || false,
            data: config.data,
            silent: false,
        });

        notification.onclick = () => {
            window.focus();
            notification.close();
        };

        return true;
    } catch (error) {
        console.error('Erro ao mostrar notificação:', error);
        return false;
    }
};

/**
 * Verifica e solicita permissão se necessário
 * Retorna true se permissão foi concedida
 */
export const ensureNotificationPermission = async (): Promise<boolean> => {
    const status = getPermissionStatus();

    if (status === 'granted') return true;
    if (status === 'denied' || status === 'unsupported') return false;

    return requestNotificationPermission();
};

/**
 * Registra o Service Worker para notificações push
 * Deve ser chamado no início do app
 */
export const registerServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
    if (!('serviceWorker' in navigator)) {
        console.warn('Service Worker não suportado neste navegador');
        return null;
    }

    try {
        const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        console.log('Service Worker registrado com sucesso:', registration.scope);
        return registration;
    } catch (error) {
        console.error('Erro ao registrar Service Worker:', error);
        return null;
    }
};

// ==========================================
// PERSISTÊNCIA (SUPABASE)
// ==========================================

export interface NotificationItem {
    id: string;
    user_id: string;
    title: string;
    body: string;
    type: NotificationType;
    read: boolean;
    created_at: string;
    data?: any;
}

/**
 * Busca notificações do usuário no Supabase
 */
export const getNotifications = async (userId: string): Promise<NotificationItem[]> => {
    // Importar supabase dinamicamente para evitar ciclo de dependência se houver
    const { supabase, isMockMode } = await import('./supabase');

    if (isMockMode || !supabase) {
        return []; // Mock return if needed
    }

    const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

    if (error) {
        console.error('Erro ao buscar notificações:', error);
        return [];
    }

    return data as NotificationItem[];
};

/**
 * Marca uma notificação como lida
 */
export const markAsRead = async (notificationId: string) => {
    const { supabase, isMockMode } = await import('./supabase');
    if (isMockMode || !supabase) return;

    await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);
};

/**
 * Envia uma notificação para um usuário específico (persiste no Supabase)
 * @param userId ID do usuário destino
 * @param type Tipo da notificação
 * @param data Dados da notificação (title, body, etc)
 */
export const sendNotification = async (userId: string, type: NotificationType, data: { title: string, body: string, data?: any }) => {
    try {
        const { supabase, isMockMode } = await import('./supabase');
        if (isMockMode || !supabase) {
            console.log(`[Mock] Notification sent to ${userId}:`, data);
            return true;
        }

        const { error } = await supabase.from('notifications').insert({
            user_id: userId,
            type: type,
            title: data.title,
            body: data.body,
            read: false,
            data: data.data,
            created_at: new Date().toISOString()
        });

        if (error) {
            console.error('Erro ao enviar notificação:', error);
            return false;
        }
        return true;

    } catch (err) {
        console.error('Falha ao persistir notificação:', err);
        return false;
    }
};

/**
 * Helper interno para persistir notificação vinda do showNotification
 */
const persistNotification = async (userId: string, type: NotificationType, config: NotificationData) => {
    return sendNotification(userId, type, {
        title: config.title,
        body: config.body,
        data: config.data
    });
};
