import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { X, CheckCircle, AlertTriangle, Info, AlertOctagon } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
    id: string;
    type: ToastType;
    title?: string;
    message: string;
    duration?: number;
}

interface ToastContextType {
    addToast: (toast: Omit<Toast, 'id'>) => void;
    removeToast: (id: string) => void;
    toast: {
        success: (message: string, title?: string, duration?: number) => void;
        error: (message: string, title?: string, duration?: number) => void;
        warning: (message: string, title?: string, duration?: number) => void;
        info: (message: string, title?: string, duration?: number) => void;
    };
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const addToast = useCallback((toastData: Omit<Toast, 'id'>) => {
        const id = Math.random().toString(36).substr(2, 9);
        const duration = toastData.duration || 5000;

        setToasts((prev) => [...prev, { ...toastData, id, duration }]);

        if (duration > 0) {
            setTimeout(() => {
                removeToast(id);
            }, duration);
        }
    }, [removeToast]);

    const toastHelpers = {
        success: (message: string, title?: string, duration?: number) => addToast({ type: 'success', message, title, duration }),
        error: (message: string, title?: string, duration?: number) => addToast({ type: 'error', message, title, duration }),
        warning: (message: string, title?: string, duration?: number) => addToast({ type: 'warning', message, title, duration }),
        info: (message: string, title?: string, duration?: number) => addToast({ type: 'info', message, title, duration }),
    };

    return (
        <ToastContext.Provider value={{ addToast, removeToast, toast: toastHelpers }}>
            {children}
            <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
                {toasts.map((t) => (
                    <ToastItem key={t.id} toast={t} onRemove={() => removeToast(t.id)} />
                ))}
            </div>
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

const ToastItem = ({ toast, onRemove }: { toast: Toast; onRemove: () => void }) => {
    const [isExiting, setIsExiting] = useState(false);

    const handleRemove = () => {
        setIsExiting(true);
        setTimeout(onRemove, 300); // Wait for animation
    };

    const icons = {
        success: <CheckCircle className="w-5 h-5 text-green-500" />,
        error: <AlertOctagon className="w-5 h-5 text-red-500" />,
        warning: <AlertTriangle className="w-5 h-5 text-orange-500" />,
        info: <Info className="w-5 h-5 text-blue-500" />,
    };

    const borderColors = {
        success: 'border-green-100',
        error: 'border-red-100',
        warning: 'border-orange-100',
        info: 'border-blue-100',
    };

    const bgColors = {
        success: 'bg-green-50',
        error: 'bg-red-50',
        warning: 'bg-orange-50',
        info: 'bg-blue-50',
    };

    return (
        <div
            className={`pointer-events-auto flex items-start w-80 md:w-96 p-4 rounded-xl bg-white shadow-lg border ${borderColors[toast.type]} transform transition-all duration-300 ease-in-out ${isExiting ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100 animate-slide-in-right'
                }`}
        >
            <div className={`p-2 rounded-full flex-shrink-0 ${bgColors[toast.type]} mr-3`}>
                {icons[toast.type]}
            </div>
            <div className="flex-1 mr-2">
                {toast.title && <h4 className="text-sm font-semibold text-gray-900">{toast.title}</h4>}
                <p className={`text-sm text-gray-600 ${toast.title ? 'mt-1' : ''}`}>{toast.message}</p>
            </div>
            <button
                onClick={handleRemove}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1"
            >
                <X size={16} />
            </button>
        </div>
    );
};
