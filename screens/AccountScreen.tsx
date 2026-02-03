import React from 'react';
import {
    User,
    ChevronRight,
    Ticket,
    UserCircle,
    Gift,
    Heart,
    Headphones,
    LogOut,
    ArrowLeft
} from 'lucide-react';
import { Button } from '../components/UI';

interface AccountScreenProps {
    user: {
        name: string;
        email: string;
        avatar?: string;
        walletBalance?: number;
    };
    onBack: () => void;
    onNavigate: (screen: string) => void;
    onLogout: () => void;
}

export const AccountScreen: React.FC<AccountScreenProps> = ({ user, onBack, onNavigate, onLogout }) => {
    return (
        <div className="h-full bg-gray-50 flex flex-col font-sans animate-fade-in">
            {/* Header Branco com Safe Area Correction */}
            <div className="bg-white p-4 pt-safe-12 pb-6 shadow-sm z-10 sticky top-0">
                <div className="flex items-center gap-3 mb-4">
                    <button onClick={onBack} className="p-2 -ml-2 text-gray-700 hover:bg-gray-100 rounded-full">
                        <ArrowLeft size={24} />
                    </button>
                    <h2 className="text-xl font-bold text-gray-800">Conta</h2>
                </div>

                <div className="flex items-center gap-4">
                    <div className="relative">
                        <img
                            src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name.split(' ').slice(0, 2).join('+'))}&background=E5E7EB&color=374151&size=128&bold=true`}
                            alt="Avatar"
                            className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-md"
                        />
                        <div className="absolute bottom-0 right-0 bg-white p-1 rounded-full shadow-sm border border-gray-100">
                            <div className="bg-gray-100 p-1 rounded-full">
                                <User size={12} className="text-gray-600" />
                            </div>
                        </div>
                    </div>
                    <div onClick={() => onNavigate('profile')} className="cursor-pointer">
                        <h2 className="text-xl font-bold text-gray-900 leading-tight">{user.name}</h2>
                        <p className="text-sm text-gray-500">Editar perfil <ChevronRight size={14} className="inline" /></p>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Wallet Card */}
                <div
                    onClick={() => onNavigate('wallet')}
                    className="bg-gray-100 p-5 rounded-xl flex items-center justify-between shadow-sm cursor-pointer hover:bg-gray-200 transition-colors"
                >
                    <div>
                        <p className="text-xs text-gray-500 font-medium uppercase mb-1">Saldo da carteira</p>
                        <h3 className="text-3xl font-bold text-gray-800">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(user.walletBalance || 0)}
                        </h3>
                    </div>
                    <ChevronRight size={20} className="text-gray-400" />
                </div>

                {/* Menu Options */}
                <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
                    <MenuItem icon={<Ticket size={20} />} label="Cupons" onClick={() => onNavigate('coupons')} />
                    <div className="h-[1px] bg-gray-50 mx-4" />
                    <MenuItem icon={<UserCircle size={20} />} label="Meus dados" onClick={() => onNavigate('profile')} />
                    <div className="h-[1px] bg-gray-50 mx-4" />
                    <MenuItem icon={<Gift size={20} />} label="Indique e ganhe R$ 1" onClick={() => onNavigate('referral')} iconColor="text-orange-600" />
                    <div className="h-[1px] bg-gray-50 mx-4" />
                    <MenuItem icon={<Heart size={20} />} label="Mototaxistas favoritos" onClick={() => onNavigate('driver_favorites')} />
                    <div className="h-[1px] bg-gray-50 mx-4" />
                    <MenuItem icon={<Headphones size={20} />} label="Fale conosco" onClick={() => onNavigate('help')} />
                </div>

                {/* Logout Section */}
                <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100 mt-4">
                    <button
                        onClick={onLogout}
                        className="w-full text-left p-4 flex items-center justify-between hover:bg-red-50 group transition-colors"
                    >
                        <span className="font-bold text-red-600">Sair da conta</span>
                        <ChevronRight size={20} className="text-red-400 group-hover:text-red-600" />
                    </button>
                </div>

                <div className="text-center pt-4 pb-8">
                    <p className="text-xs text-gray-400">Versão 24.8.0</p>
                </div>
            </div>

            {/* Bottom Navigation Fake (If needed, but usually Account is a full screen modal or tab) */}
        </div>
    );
};

const MenuItem = ({ icon, label, onClick, iconColor = "text-gray-700" }: { icon: React.ReactNode, label: string, onClick: () => void, iconColor?: string }) => (
    <button
        onClick={onClick}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors group"
    >
        <div className="flex items-center gap-3">
            <div className={`${iconColor}`}>
                {icon}
            </div>
            <span className="font-medium text-gray-700 text-sm group-hover:text-gray-900">{label}</span>
        </div>
        <ChevronRight size={20} className="text-gray-300 group-hover:text-gray-500" />
    </button>
);
