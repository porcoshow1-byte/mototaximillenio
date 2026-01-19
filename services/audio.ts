/**
 * MotoJá Audio Service
 * Sistema de efeitos sonoros profissionais para notificações
 * Utiliza Web Audio API para gerar tons suaves e modernos
 */

// Contexto de áudio singleton
let audioContext: AudioContext | null = null;

// Inicializa o contexto de áudio (deve ser chamado após interação do usuário)
const getAudioContext = (): AudioContext => {
    if (!audioContext) {
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    // Resume se estiver suspenso (política de autoplay dos browsers)
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    return audioContext;
};

// Configurações de som por tipo
type SoundType =
    | 'newRequest'      // Nova solicitação de corrida (motorista)
    | 'rideAccepted'    // Corrida aceita (passageiro)
    | 'driverArrived'   // Motorista chegou (passageiro)
    | 'newMessage'      // Nova mensagem no chat
    | 'rideCompleted'   // Corrida finalizada
    | 'rideStarted'     // Corrida iniciada
    | 'payment'         // Pagamento confirmado
    | 'error'           // Erro/problema
    | 'notification'    // Notificação genérica (admin)
    | 'click';          // Click suave para feedback

interface SoundConfig {
    frequencies: number[];    // Frequências das notas
    durations: number[];      // Duração de cada nota em ms
    type: OscillatorType;     // Tipo de onda
    volume: number;           // Volume (0-1)
    delay: number;            // Delay entre notas em ms
}

// Configurações de sons profissionais e suaves
const soundConfigs: Record<SoundType, SoundConfig> = {
    // Nova solicitação - tom duplo ascendente suave (para motorista)
    newRequest: {
        frequencies: [440, 554, 659], // A4, C#5, E5 (acorde maior)
        durations: [150, 150, 200],
        type: 'sine',
        volume: 0.3,
        delay: 80
    },

    // Corrida aceita - tom de confirmação positivo
    rideAccepted: {
        frequencies: [523, 659], // C5, E5
        durations: [120, 180],
        type: 'sine',
        volume: 0.25,
        delay: 60
    },

    // Motorista chegou - tom de chegada suave
    driverArrived: {
        frequencies: [587, 740, 880], // D5, F#5, A5
        durations: [100, 100, 250],
        type: 'sine',
        volume: 0.3,
        delay: 100
    },

    // Nova mensagem - tom curto e discreto
    newMessage: {
        frequencies: [880, 1047], // A5, C6
        durations: [60, 100],
        type: 'sine',
        volume: 0.15,
        delay: 40
    },

    // Corrida finalizada - tom de celebração suave
    rideCompleted: {
        frequencies: [523, 659, 784, 1047], // C5, E5, G5, C6
        durations: [100, 100, 100, 300],
        type: 'sine',
        volume: 0.25,
        delay: 80
    },

    // Corrida iniciada - tom de partida
    rideStarted: {
        frequencies: [392, 523], // G4, C5
        durations: [100, 150],
        type: 'sine',
        volume: 0.2,
        delay: 50
    },

    // Pagamento confirmado - tom de sucesso
    payment: {
        frequencies: [659, 784, 1047], // E5, G5, C6
        durations: [80, 80, 200],
        type: 'sine',
        volume: 0.2,
        delay: 60
    },

    // Erro - tom de alerta suave
    error: {
        frequencies: [330, 294], // E4, D4 (descendente)
        durations: [150, 200],
        type: 'sine',
        volume: 0.2,
        delay: 100
    },

    // Click - feedback tátil
    notification: {
        frequencies: [659, 880], // E5, A5
        durations: [100, 200],
        type: 'sine',
        volume: 0.25,
        delay: 60
    },
    click: {
        frequencies: [1200],
        durations: [30],
        type: 'sine',
        volume: 0.08,
        delay: 0
    }
};

/**
 * Toca uma nota individual com envelope ADSR suave
 */
const playNote = (
    ctx: AudioContext,
    frequency: number,
    startTime: number,
    duration: number,
    type: OscillatorType,
    volume: number
): void => {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startTime);

    // Envelope ADSR suave para som profissional
    const attack = 0.02;
    const decay = 0.1;
    const sustain = volume * 0.7;
    const release = duration / 1000 * 0.5;

    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(volume, startTime + attack);
    gainNode.gain.linearRampToValueAtTime(sustain, startTime + attack + decay);
    gainNode.gain.linearRampToValueAtTime(0, startTime + duration / 1000 + release);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(startTime);
    oscillator.stop(startTime + duration / 1000 + release + 0.1);
};

/**
 * Toca um som de notificação
 * @param soundType - Tipo do som a ser tocado
 */
export const playSound = (soundType: SoundType): void => {
    try {
        const ctx = getAudioContext();
        const config = soundConfigs[soundType];

        if (!config) {
            console.warn(`Som não encontrado: ${soundType}`);
            return;
        }

        let currentTime = ctx.currentTime;

        config.frequencies.forEach((freq, index) => {
            playNote(
                ctx,
                freq,
                currentTime,
                config.durations[index] || config.durations[0],
                config.type,
                config.volume
            );
            currentTime += (config.durations[index] || config.durations[0]) / 1000 + config.delay / 1000;
        });
    } catch (error) {
        console.warn('Erro ao tocar som:', error);
    }
};

/**
 * Pré-inicializa o áudio (chamar após primeira interação do usuário)
 * Isso evita bloqueios de autoplay nos browsers
 */
export const initAudio = (): void => {
    try {
        getAudioContext();
    } catch (error) {
        console.warn('Áudio não suportado neste navegador');
    }
};

/**
 * Verifica se o áudio está disponível
 */
export const isAudioSupported = (): boolean => {
    return !!(window.AudioContext || (window as any).webkitAudioContext);
};

// Exporta os tipos de som disponíveis
export type { SoundType };
