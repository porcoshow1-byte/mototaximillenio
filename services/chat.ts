import { rtdb } from './firebase';
import { ref, push, onValue, off, serverTimestamp } from 'firebase/database';
import { ChatMessage } from '../types';

const CHATS_PATH = 'chats';

export const sendMessage = async (rideId: string, senderId: string, text: string) => {
  if (!text.trim() || !rtdb) return;

  try {
    const chatRef = ref(rtdb, `${CHATS_PATH}/${rideId}`);
    await push(chatRef, {
      senderId,
      text,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Erro ao enviar mensagem (RTDB):", error);
    throw error;
  }
};

export const subscribeToChat = (rideId: string, onUpdate: (messages: ChatMessage[]) => void) => {
  if (!rtdb) return () => { };

  const chatRef = ref(rtdb, `${CHATS_PATH}/${rideId}`);

  const onValueChange = onValue(chatRef, (snapshot) => {
    const data = snapshot.val();
    const messages: ChatMessage[] = [];

    if (data) {
      Object.entries(data).forEach(([key, value]: [string, any]) => {
        messages.push({
          id: key,
          rideId: rideId,
          senderId: value.senderId,
          text: value.text,
          createdAt: value.createdAt || Date.now()
        });
      });
    }

    // Ordenar por data (opcional, RTDB já retorna ordenado se inserido sequencialmente, mas garantimos aqui)
    messages.sort((a, b) => a.createdAt - b.createdAt);

    onUpdate(messages);
  });

  return () => off(chatRef, 'value', onValueChange);
};
