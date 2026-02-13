import React, { useState, useEffect, useRef } from 'react';
import { X, Send, User, Check, CheckCheck } from 'lucide-react';
import { subscribeToChat, sendMessage, markMessageAsRead } from '../services/chat';
import { ChatMessage } from '../types';
import { Button } from './UI';
import { playSound } from '../services/audio';

interface ChatModalProps {
  rideId: string;
  currentUserId: string;
  otherUserName: string;
  onClose: () => void;
}

export const ChatModal = ({ rideId, currentUserId, otherUserName, onClose }: ChatModalProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);

  useEffect(() => {
    const unsubscribe = subscribeToChat(rideId, (msgs) => {
      // Logic to mark unread messages from the other user as read
      msgs.forEach(msg => {
        if (msg.senderId !== currentUserId && msg.status !== 'read') {
          markMessageAsRead(rideId, msg.id);
        }
      });

      // Play sound if new message received from other user
      if (msgs.length > prevMessageCountRef.current) {
        const lastMsg = msgs[msgs.length - 1];
        if (lastMsg && lastMsg.senderId !== currentUserId) {
          playSound('newMessage');
        }
      }
      prevMessageCountRef.current = msgs.length;
      setMessages(msgs);
    });
    return () => unsubscribe();
  }, [rideId, currentUserId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim()) return;
    const text = newMessage;
    setNewMessage(''); // Clear input immediately for UX
    await sendMessage(rideId, currentUserId, text);
  };

  const renderStatusIcon = (status?: 'sent' | 'delivered' | 'read') => {
    if (!status || status === 'sent') return <Check size={12} className="text-gray-300" />;
    if (status === 'delivered') return <CheckCheck size={12} className="text-gray-300" />;
    if (status === 'read') return <CheckCheck size={12} className="text-blue-200" />; // Blue ticks for read (on orange bg)
    return null;
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 sm:p-6 animate-fade-in">
      <div className="bg-white w-full max-w-md h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="bg-orange-500 p-4 flex items-center justify-between text-white shadow-md z-10">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-full">
              <User size={20} />
            </div>
            <div>
              <p className="text-xs opacity-90">Conversando com</p>
              <h3 className="font-bold">{otherUserName}</h3>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition">
            <X size={24} />
          </button>
        </div>

        {/* Messages List */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-3">
          {messages.length === 0 && (
            <div className="text-center text-gray-400 mt-10 text-sm">
              Nenhuma mensagem ainda.<br />Diga olá! 👋
            </div>
          )}
          {messages.map((msg) => {
            const isMe = msg.senderId === currentUserId;
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] p-3 rounded-2xl text-sm shadow-sm ${isMe
                    ? 'bg-orange-500 text-white rounded-tr-none'
                    : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'
                    }`}
                >
                  <p>{msg.text}</p>
                  <div className={`flex items-center justify-end gap-1 mt-1 ${isMe ? 'opacity-80' : 'opacity-50'}`}>
                    <span className={`text-[10px] ${isMe ? 'text-orange-100' : 'text-gray-400'}`}>
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {isMe && renderStatusIcon(msg.status)}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-3 bg-white border-t border-gray-100">
          <form
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Digite sua mensagem..."
              className="flex-1 bg-gray-100 text-gray-800 rounded-full px-4 py-3 outline-none focus:ring-2 focus:ring-orange-500 transition"
            />
            <button
              type="submit"
              disabled={!newMessage.trim()}
              className="p-3 bg-orange-500 text-white rounded-full hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-500/30 transition-all active:scale-95"
            >
              <Send size={20} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};