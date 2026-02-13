import React, { useEffect, useState, useRef } from 'react';
import { ArrowLeft, Check, CheckCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getNotifications, markAsRead, NotificationItem } from '../services/notifications';
import { supabase } from '../services/supabase';
import { APP_CONFIG } from '../constants';

interface NotificationsScreenProps {
    onBack: () => void;
}

export const NotificationsScreen = ({ onBack }: NotificationsScreenProps) => {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [loading, setLoading] = useState(true);
    const scrollRef = useRef<HTMLDivElement>(null);

    const fetchNotifications = async () => {
        if (!user) return;
        setLoading(true);
        const data = await getNotifications(user.uid);
        // Sort by date ascending (oldest first) for chat history feel
        const sorted = data.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        setNotifications(sorted);
        setLoading(false);
    };

    useEffect(() => {
        fetchNotifications();

        if (!user) return;

        // Real-time subscription
        const channel = supabase
            .channel(`notifications-${user.uid}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${user.uid}`
            }, (payload) => {
                const newNotif = payload.new as NotificationItem;
                setNotifications(prev => [...prev, newNotif]); // Add to end
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    // Auto-scroll to bottom when notifications change
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [notifications, loading]);

    // Mark all as read when screen opens (WhatsApp style) - or keep individual?
    // User requested "history", implies reading just by being there.
    // Let's mark visible as read simply by opening the screen for simplicity, or we can do it individually.
    // implementing a "mark all as read" effect on mount for simplicity and clarity in chat UI
    useEffect(() => {
        const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
        if (unreadIds.length > 0) {
            Promise.all(unreadIds.map(id => markAsRead(id)));
            // Update local state to show blue checks
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        }
    }, [notifications.length]);


    const formatDateHeader = (dateString: string) => {
        const date = new Date(dateString);
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) return 'Hoje';
        if (date.toDateString() === yesterday.toDateString()) return 'Ontem';
        return date.toLocaleDateString('pt-BR');
    };

    const formatTime = (dateString: string) => {
        return new Date(dateString).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    };

    // Group by date
    const groupedNotifications = notifications.reduce((groups, notif) => {
        const date = new Date(notif.created_at).toDateString();
        if (!groups[date]) {
            groups[date] = [];
        }
        groups[date].push(notif);
        return groups;
    }, {} as Record<string, NotificationItem[]>);

    return (
        <div className="fixed inset-0 z-[60] bg-[#e5ddd5] flex flex-col animate-slide-in-right">
            {/* Header WhatsApp Style */}
            <div className="bg-[#008069] p-4 shadow-sm sticky top-0 z-10 flex items-center gap-3 text-white">
                <button onClick={onBack} className="p-1 -ml-1 hover:bg-[#006a57] rounded-full">
                    <ArrowLeft size={24} />
                </button>
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center overflow-hidden">
                    <img src={APP_CONFIG.logoUrl} alt="Logo" className="w-8 h-8 object-contain" />
                </div>
                <div className="flex-1">
                    <h2 className="text-lg font-bold leading-tight">Central MotoJá</h2>
                    <p className="text-xs text-white/80">suporte oficial</p>
                </div>
            </div>

            {/* Chat Area */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#e5ddd5] bg-opacity-90"
                style={{ backgroundImage: "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')", backgroundBlendMode: 'soft-light' }}
            >
                {loading ? (
                    <div className="flex justify-center py-10">
                        <div className="w-8 h-8 border-4 border-gray-200 border-t-[#008069] rounded-full animate-spin"></div>
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="flex justify-center mt-10">
                        <div className="bg-[#dcf8c6] px-4 py-2 rounded-lg shadow-sm text-sm text-gray-600 text-center">
                            As mensagens da central aparecerão aqui.
                        </div>
                    </div>
                ) : (
                    Object.keys(groupedNotifications).map(dateKey => (
                        <div key={dateKey} className="space-y-2">
                            <div className="flex justify-center sticky top-2 z-0">
                                <span className="bg-[#e1f3fb] text-gray-600 text-xs px-3 py-1 rounded-full shadow-sm uppercase font-bold tracking-wide">
                                    {formatDateHeader(groupedNotifications[dateKey][0].created_at)}
                                </span>
                            </div>

                            {groupedNotifications[dateKey].map(notif => (
                                <div key={notif.id} className="flex flex-col space-y-1">
                                    {/* Message Bubble (Incoming from Central) */}
                                    <div className="self-start max-w-[85%] bg-white rounded-lg rounded-tl-none shadow-sm p-2 relative group">
                                        {/* Explicit Title if needed, usually just text for chat */}
                                        {notif.title && notif.title !== 'Nova Mensagem' && (
                                            <p className="text-[#008069] font-bold text-xs mb-1">{notif.title}</p>
                                        )}
                                        <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">{notif.body}</p>

                                        <div className="flex items-center justify-end gap-1 mt-1">
                                            <span className="text-[10px] text-gray-500 min-w-[45px] text-right">
                                                {formatTime(notif.created_at)}
                                            </span>
                                            {/* Read Receipt (Blue Check simulation) */}
                                            {notif.read ? <CheckCheck size={14} className="text-[#53bdeb]" /> : <Check size={14} className="text-gray-400" />}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
