import { supabase, isMockMode } from './supabase';
import { ChatMessage } from '../types';

export const CHAT_TABLE = 'chat_messages';

// Helpers
const mapToAppMessage = (data: any): ChatMessage => {
  return {
    id: data.id,
    rideId: data.ride_id,
    senderId: data.sender_id,
    text: data.text,
    status: data.status,
    createdAt: data.created_at ? new Date(data.created_at).getTime() : Date.now()
  };
};

export const sendMessage = async (rideId: string, senderId: string, text: string) => {
  if (!text.trim()) return;

  if (isMockMode || !supabase) {
    // Mock Mode not fully implemented for chat in this file previously, 
    // but we can simulate it if needed. 
    // For now, adhering to "if (!rtdb) return" pattern from original file (effectively no-op if no db).
    return;
  }

  const { error } = await supabase
    .from(CHAT_TABLE)
    .insert({
      ride_id: rideId,
      sender_id: senderId,
      text: text,
      status: 'sent'
    });

  if (error) console.error("Error sending message:", error);
};

export const markMessageAsRead = async (rideId: string, messageId: string) => {
  if (isMockMode || !supabase) return;

  const { error } = await supabase
    .from(CHAT_TABLE)
    .update({ status: 'read' })
    .eq('id', messageId);

  if (error) console.error("Error marking message as read:", error);
};

export const subscribeToChat = (rideId: string, onUpdate: (messages: ChatMessage[]) => void) => {
  if (isMockMode || !supabase) return () => { };

  let messages: ChatMessage[] = [];

  const handleNewMessage = (payload: any) => {
    const newMessage = mapToAppMessage(payload.new);
    // Avoid duplicates
    if (!messages.find(m => m.id === newMessage.id)) {
      messages.push(newMessage);
      messages.sort((a, b) => a.createdAt - b.createdAt);
      onUpdate([...messages]);
    }
  };

  const handleUpdateMessage = (payload: any) => {
    const updated = mapToAppMessage(payload.new);
    const index = messages.findIndex(m => m.id === updated.id);
    if (index !== -1) {
      messages[index] = updated;
      onUpdate([...messages]);
    }
  };

  // 1. Initial Fetch
  supabase
    .from(CHAT_TABLE)
    .select('*')
    .eq('ride_id', rideId)
    .order('created_at', { ascending: true })
    .then(({ data }) => {
      if (data) {
        messages = data.map(mapToAppMessage);
        onUpdate([...messages]);
      }
    });

  // 2. Realtime Subscription
  const channel = supabase
    .channel(`chat_${rideId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: CHAT_TABLE, filter: `ride_id=eq.${rideId}` },
      handleNewMessage
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: CHAT_TABLE, filter: `ride_id=eq.${rideId}` },
      handleUpdateMessage
    )
    .subscribe();

  return () => {
    channel.unsubscribe();
  };
};
