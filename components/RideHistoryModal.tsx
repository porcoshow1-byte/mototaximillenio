import React from 'react';
import { X, Calendar, MapPin, DollarSign } from 'lucide-react';
import { RideRequest } from '../types';
import { APP_CONFIG } from '../constants';

interface RideHistoryModalProps {
    rides: RideRequest[];
    onClose: () => void;
    earnings?: number; // Optional for passenger
    mode?: 'driver' | 'passenger'; // Default: 'driver'
}

export const RideHistoryModal = ({ rides, onClose, earnings, mode = 'driver' }: RideHistoryModalProps) => {
    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
            <div className="bg-white dark:bg-gray-900 w-full sm:max-w-md h-[85vh] sm:h-[80vh] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-slide-up">

                {/* Header */}
                <div className="p-6 pb-2">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                                {mode === 'driver' ? 'Seus Ganhos' : 'Minhas Viagens'}
                            </h2>
                            <p className="text-gray-500 text-sm">
                                {mode === 'driver' ? 'Resumo da atividade recente' : 'Histórico de corridas realizadas'}
                            </p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                            <X size={24} className="text-gray-500" />
                        </button>
                    </div>

                    {/* Earnings Card - Only for Driver */}
                    {mode === 'driver' && (
                        <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-6 text-white shadow-lg shadow-green-500/20 mb-4">
                            <div className="flex items-center gap-3 mb-1">
                                <div className="p-2 bg-white/20 rounded-full">
                                    <DollarSign size={20} className="text-white" />
                                </div>
                                <span className="font-medium opacity-90">Ganhos Hoje</span>
                            </div>
                            <div className="text-4xl font-bold tracking-tight">
                                {APP_CONFIG.currency} {(earnings || 0).toFixed(2)}
                            </div>
                            <div className="mt-2 text-sm opacity-80 flex items-center gap-2">
                                <span>{rides.length} corridas realizadas</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* History List */}
                <div className="flex-1 overflow-y-auto px-6 pb-6">
                    <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-4 sticky top-0 bg-white dark:bg-gray-900 py-2 z-10">
                        Histórico de Corridas
                    </h3>

                    {rides.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-400 text-center">
                            <Calendar size={48} className="mb-4 opacity-20" />
                            <p>Nenhuma corrida realizada hoje.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {rides.map((ride) => (
                                <div key={ride.id} className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                                    <div className="flex justify-between items-start mb-3">
                                        <span className="text-xs font-medium text-gray-500 bg-white dark:bg-gray-700 px-2 py-1 rounded-md border border-gray-100 dark:border-gray-600">
                                            {new Date(ride.completedAt || ride.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        <span className="text-green-600 dark:text-green-400 font-bold">
                                            + {APP_CONFIG.currency} {(ride.price || 0).toFixed(2)}
                                        </span>
                                    </div>

                                    <div className="space-y-3 relative pl-2">
                                        {/* Timeline Line */}
                                        <div className="absolute left-[5px] top-2 bottom-6 w-0.5 bg-gray-200 dark:bg-gray-700"></div>

                                        <div className="flex gap-3 relative">
                                            <div className="w-3 h-3 rounded-full bg-green-500 mt-1 relative z-10 ring-2 ring-white dark:ring-gray-800"></div>
                                            <div>
                                                <p className="text-xs text-gray-500 font-bold uppercase">Origem</p>
                                                <p className="text-sm font-medium text-gray-900 dark:text-gray-200 line-clamp-1">{ride.origin}</p>
                                            </div>
                                        </div>

                                        <div className="flex gap-3 relative">
                                            <div className="w-3 h-3 rounded-full bg-gray-400 mt-1 relative z-10 ring-2 ring-white dark:ring-gray-800"></div>
                                            <div>
                                                <p className="text-xs text-gray-500 font-bold uppercase">Destino</p>
                                                <p className="text-sm font-medium text-gray-900 dark:text-gray-200 line-clamp-1">{ride.destination}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
