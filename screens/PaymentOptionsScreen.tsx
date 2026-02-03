import React, { useState } from 'react';
import { ArrowLeft, ChevronRight, Banknote, QrCode, CreditCard, Smartphone, MessageCircle, RefreshCw } from 'lucide-react';
import { User, PaymentMethod } from '../types';

interface PaymentOptionsScreenProps {
    user: User;
    selectedMethod: PaymentMethod;
    useWallet: boolean; // toggle state
    onToggleWallet: (use: boolean) => void;
    onSelectMethod: (method: PaymentMethod) => void;
    onBack: () => void;
}

export const PaymentOptionsScreen: React.FC<PaymentOptionsScreenProps> = ({
    user,
    selectedMethod,
    useWallet,
    onToggleWallet,
    onSelectMethod,
    onBack
}) => {

    const methods: { id: PaymentMethod, label: string, icon: React.ReactNode, subtitle?: string }[] = [
        { id: 'cash', label: 'Dinheiro', icon: <Banknote className="text-green-600" size={24} /> },
        { id: 'pix', label: 'Pix', icon: <div className="w-6 h-6 flex items-center justify-center bg-teal-500 rounded-full text-white"><QrCode size={16} /></div> },
        { id: 'credit_machine', label: 'Crédito (máquina)', icon: <CreditCard className="text-gray-700" size={24} />, subtitle: 'Sujeito à taxa da operadora' },
        { id: 'debit_machine', label: 'Débito (máquina)', icon: <CreditCard className="text-indigo-700" size={24} />, subtitle: 'Sujeito à taxa da operadora' },
        { id: 'picpay', label: 'PicPay', icon: <Smartphone className="text-green-500" size={24} /> },
        { id: 'whatsapp', label: 'WhatsApp', icon: <MessageCircle className="text-green-600" size={24} /> },
    ];

    return (
        <div className="flex flex-col h-full bg-gray-50 animate-fade-in-right">
            {/* Header */}
            <div className="bg-white px-4 py-4 pt-[calc(1rem+env(safe-area-inset-top))] flex items-center gap-3 shadow-sm z-10">
                <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <ArrowLeft size={24} className="text-gray-700" />
                </button>
                <h1 className="text-xl font-semibold text-gray-800">Opções de pagamento</h1>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">

                {/* Wallet Balance Card */}
                <div className="bg-gray-100 rounded-xl p-4 flex items-center justify-between">
                    <div>
                        <p className="text-gray-500 text-sm mb-1">Saldo da carteira</p>
                        <p className="text-3xl font-bold text-gray-800">R$ {(user.walletBalance || 0).toFixed(2).replace('.', ',')}</p>
                    </div>
                    <ChevronRight className="text-gray-400" />
                </div>

                {/* Cashback Banner */}
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-start gap-3">
                    <div className="mt-1">
                        <RefreshCw size={20} className="text-emerald-600" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-700 leading-tight">
                            Ganhe parte do valor da corrida de volta na sua carteira! <span className="font-bold underline text-emerald-700 cursor-pointer">Saiba mais</span>
                        </p>
                    </div>
                </div>

                {/* Use Wallet Toggle */}
                <div className="flex items-center justify-between py-2">
                    <span className="text-gray-700 font-medium">Usar saldo disponível em viagens</span>
                    <button
                        onClick={() => onToggleWallet(!useWallet)}
                        className={`w-12 h-7 rounded-full transition-colors relative flex items-center ${useWallet ? 'bg-orange-500' : 'bg-gray-300'}`}
                    >
                        <div className={`w-5 h-5 bg-white rounded-full shadow-md absolute transition-transform ${useWallet ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                </div>

                {/* Payment Methods List */}
                <div>
                    <h2 className="text-gray-600 font-semibold mb-3 mt-2">Forma de pagamento</h2>
                    <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100">
                        {methods.map((method) => {
                            const isSelected = selectedMethod === method.id;
                            return (
                                <button
                                    key={method.id}
                                    onClick={() => onSelectMethod(method.id)}
                                    className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors first:rounded-t-xl last:rounded-b-xl"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-8 flex justify-center">
                                            {method.icon}
                                        </div>
                                        <div className="text-left">
                                            <p className={`font-medium ${isSelected ? 'text-gray-900' : 'text-gray-700'}`}>{method.label}</p>
                                            {method.subtitle && <p className="text-xs text-gray-400">{method.subtitle}</p>}
                                        </div>
                                    </div>

                                    {/* Radio Button */}
                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-purple-600' : 'border-gray-300'}`}>
                                        {isSelected && <div className="w-2.5 h-2.5 bg-purple-600 rounded-full" />}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Coupon Section (Mock) */}
                <div className="pt-4">
                    <h2 className="text-gray-600 font-semibold mb-3">Cupom</h2>
                    <button className="w-full bg-white p-4 rounded-xl shadow-sm flex items-center justify-between hover:bg-gray-50 transition-colors">
                        <span className="text-gray-700 font-medium">Adicionar cupom</span>
                        <ChevronRight className="text-gray-400" size={20} />
                    </button>
                </div>

            </div>
        </div>
    );
};
