import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getCompany, updateCompanyStatus, getCompanyByOwner, saveCompany } from '../services/company';
import { getRideHistory, injectMockCorporateRides } from '../services/ride';
import { generateInvoicePayment } from '../services/billing';
import { Company, RideRequest } from '../types';
import { Button, Card, Badge, Input } from '../components/UI';
import {
    Building2, Users, CreditCard, Calendar, ArrowLeft,
    TrendingUp, Download, Search, CheckCircle, Clock, AlertCircle, Plus, X,
    FileText, AlertTriangle, ChevronDown, ChevronUp, History, Lock
} from 'lucide-react';

export const CompanyDashboard = ({ onBack, companyId }: { onBack: () => void, companyId?: string }) => {
    const { user } = useAuth();
    const [company, setCompany] = useState<Company | null>(null);
    const [rides, setRides] = useState<RideRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [isPaying, setIsPaying] = useState(false);
    const [invoicePayment, setInvoicePayment] = useState<any>(null);
    const [showAddCollaborator, setShowAddCollaborator] = useState(false);
    const [newCollaborator, setNewCollaborator] = useState({ name: '', phone: '', email: '', cpf: '' });

    // Password reset state
    const [showPasswordReset, setShowPasswordReset] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [savingPassword, setSavingPassword] = useState(false);

    const [selectedRide, setSelectedRide] = useState<RideRequest | null>(null);
    const [activeTab, setActiveTab] = useState<'open' | 'history'>('open');

    // Group rides by Month/Year for Invoices
    const groupedRides = rides.reduce<Record<string, RideRequest[]>>((groups, ride) => {
        const date = new Date(ride.createdAt);
        const monthYear = date.toLocaleString('default', { month: 'long', year: 'numeric' });
        if (!groups[monthYear]) {
            groups[monthYear] = [];
        }
        groups[monthYear].push(ride);
        return groups;
    }, {});
    // const groupedRides: Record<string, RideRequest[]> = {}; // Fallback empty

    const handlePayInvoice = async (monthKey?: string, monthRides?: RideRequest[]) => {
        if (!company) return;
        setIsPaying(true);
        // If specific month not provided, mock generic invoice (or handle logic to pay all)
        const invoiceId = monthKey ? `inv_${monthKey.replace(/\s/g, '_')}` : `inv_ALL_${Date.now()}`;
        const amount = monthRides ? monthRides.reduce((acc, r) => acc + (r.price || 0), 0) : openInvoices;

        try {
            const result = await generateInvoicePayment(company.id, invoiceId, amount, company.email);
            if (result.success) {
                setInvoicePayment(result);
            } else {
                alert('Erro ao gerar fatura: ' + result.message);
            }
        } catch (error) {
            console.error(error);
            alert('Erro ao processar pagamento');
        } finally {
            setIsPaying(false);
        }
    };

    const handleManualWriteOff = async (ridesToPay: RideRequest[]) => {
        if (!confirm('Confirmar baixa manual desta fatura? Isso marcará todas as corridas como pagas.')) return;

        const storedRides = JSON.parse(localStorage.getItem('motoja_mock_rides') || '[]');
        const updatedRides = storedRides.map((r: RideRequest) => {
            if (ridesToPay.some(pay => pay.id === r.id)) {
                return { ...r, paymentStatus: 'completed' };
            }
            return r;
        });

        localStorage.setItem('motoja_mock_rides', JSON.stringify(updatedRides));

        // Refresh local state logic implies re-fetch or manual update. For now, manual update:
        setRides(prev => prev.map(r => {
            if (ridesToPay.some(pay => pay.id === r.id)) {
                return { ...r, paymentStatus: 'completed' };
            }
            return r;
        }));

        // Check if unblock is needed
        // We need to check if there are ANY OTHER overdue invoices left.
        // Simplified: If this was the only one, or valid check.
        // Ideally we re-run the check logic from useEffect.
        // For prototype: If current status is blocked, we can try to set to active and let the useEffect re-block if needed on next load, 
        // OR we just set to active directly if we trust this clears the blockage.
        // Let's force update status to active if user confirms.
        if (company?.status === 'blocked') {
            if (confirm('Deseja desbloquear a empresa automaticamente?')) {
                if (company) {
                    updateCompanyStatus(company.id, 'active');
                    setCompany(prev => prev ? { ...prev, status: 'active' } : null);
                }
            }
        }

        alert('Fatura baixada manualmente com sucesso!');
    };

    const handlePasswordReset = async () => {
        if (!company) return;

        if (!newPassword || newPassword.length < 6) {
            alert('A nova senha deve ter pelo menos 6 caracteres.');
            return;
        }

        if (newPassword !== confirmPassword) {
            alert('As senhas não conferem.');
            return;
        }

        setSavingPassword(true);
        try {
            const updatedCompany = {
                ...company,
                passwordHash: newPassword,
                isTempPassword: false
            };
            await saveCompany(updatedCompany);
            setCompany(updatedCompany);
            setShowPasswordReset(false);
            setNewPassword('');
            setConfirmPassword('');
            alert('Senha alterada com sucesso! Use a nova senha no próximo login.');
        } catch (error) {
            console.error('Error updating password:', error);
            alert('Erro ao alterar senha. Tente novamente.');
        } finally {
            setSavingPassword(false);
        }
    };

    useEffect(() => {
        const loadData = async () => {
            try {
                // Use passed companyId (Admin View) or find company for logged-in user
                let targetId = companyId;
                let companyData: Company | null = null;

                // If companyId was passed directly (admin view), use it
                if (targetId) {
                    companyData = await getCompany(targetId);
                }

                // Otherwise, find company for logged-in user
                if (!companyData && user) {
                    console.log('[CompanyDashboard] Looking for company for user:', user.uid, user.email);

                    // Try to find by ownerUid
                    companyData = await getCompanyByOwner(user.uid);

                    // If not found, try by ID = uid
                    if (!companyData) {
                        companyData = await getCompany(user.uid);
                    }

                    if (companyData) {
                        targetId = companyData.id;
                    }
                }

                // If still no company found, show error (don't use fake fallback)
                if (!companyData) {
                    console.error('[CompanyDashboard] No company found for user');
                    setCompany(null);
                    setLoading(false);
                    return;
                }

                setCompany(companyData);
                targetId = companyData.id;

                // Check if company needs to reset password
                if (companyData.isTempPassword) {
                    setShowPasswordReset(true);
                    // Clear the localStorage flag
                    localStorage.removeItem('motoja_needs_password_reset');
                }

                // Inject mock corporate rides if needed
                injectMockCorporateRides(targetId!);

                // Mock rides for demo purposes
                const storedRides = JSON.parse(localStorage.getItem('motoja_mock_rides') || '[]');
                const companyRides = storedRides.filter((r: RideRequest) => r.companyId === targetId).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

                setRides(companyRides);

                // --- Business Rule: Auto Block if Overdue ---
                // We need to calculate groupedRides here to check status without waiting for render
                const tempGroups = (companyRides as RideRequest[]).reduce<Record<string, RideRequest[]>>((groups, ride) => {
                    const date = new Date(ride.createdAt);
                    const monthYear = date.toLocaleString('default', { month: 'long', year: 'numeric' });
                    if (!groups[monthYear]) groups[monthYear] = [];
                    groups[monthYear].push(ride);
                    return groups;
                }, {});

                let hasOverdue = false;
                Object.entries(tempGroups).forEach(([monthKey, monthRides]) => {
                    const isPaid = monthRides.every((r: RideRequest) => r.paymentStatus === 'completed');
                    const isCurrentMonth = monthKey === new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
                    if (!isCurrentMonth && !isPaid) {
                        hasOverdue = true;
                    }
                });

                if (hasOverdue && companyData && companyData.status !== 'blocked') {
                    console.log('Auto-blocking company due to overdue invoices');
                    updateCompanyStatus(targetId, 'blocked');
                    setCompany(prev => prev ? { ...prev, status: 'blocked' } : null);
                }

            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [user, companyId]);

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 animate-fade-in">
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-100/50 rounded-full blur-3xl animate-pulse"></div>
                </div>
                <div className="relative z-10 flex flex-col items-center">
                    <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                    <h2 className="text-xl font-bold text-gray-800">Carregando Painel Corporativo</h2>
                    <p className="text-sm text-gray-500 animate-pulse">Sincronizando dados...</p>
                </div>
            </div>
        );
    }

    if (!company) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6">
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-gray-100">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
                        <AlertCircle size={32} />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Empresa não encontrada</h2>
                    <p className="text-gray-500 mb-6">Não conseguimos localizar os dados desta empresa. Verifique se o cadastro está ativo.</p>
                    <Button fullWidth onClick={onBack}>
                        <ArrowLeft size={18} className="mr-2" />
                        Voltar
                    </Button>
                </div>
            </div>
        );
    }

    const totalSpent = rides.reduce((acc, r) => acc + (r.price || 0), 0);
    const openInvoices = totalSpent; // Mock concept: all recent rides are pending invoice

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-8 py-5 flex items-center justify-between sticky top-0 z-30">
                <div className="flex items-center gap-4">
                    <Button variant="outline" className="border-none shadow-none hover:bg-gray-100 p-2" onClick={onBack}><ArrowLeft size={20} /></Button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                            {company.logoUrl ? (
                                <img src={company.logoUrl} alt={company.name} className="w-10 h-10 rounded-lg object-contain border border-gray-100 bg-gray-50 p-1" />
                            ) : (
                                <Building2 className="text-blue-600 w-10 h-10" />
                            )}
                            {company.name}
                        </h1>
                        <p className="text-sm text-gray-500">Painel de Gestão Corporativa • CNPJ: {company.cnpj}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-right">
                        <p className="text-xs text-gray-500 font-medium uppercase">Limite de Crédito</p>
                        <p className="font-bold text-gray-900">R$ {company.creditLimit?.toFixed(2) || '0.00'}</p>
                    </div>
                    <div className="h-8 w-px bg-gray-200 mx-2"></div>
                    <Button variant="outline" className="flex items-center gap-2"><Download size={16} /> Exportar Relatório</Button>
                </div>
            </div>

            <div className="p-8 max-w-7xl w-full mx-auto space-y-8 animate-fade-in">

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="p-6 border-l-4 border-blue-500 shadow-sm hover:shadow-md transition">
                        <div className="flex items-start justify-between mb-4">
                            <div className="bg-blue-50 p-3 rounded-xl text-blue-600"><TrendingUp size={24} /></div>
                            <Badge color="blue">Mês Atual</Badge>
                        </div>
                        <p className="text-gray-500 text-sm font-medium">Total Gasto</p>
                        <h3 className="text-3xl font-bold text-gray-900 mt-1">R$ {(totalSpent || 0).toFixed(2)}</h3>
                        <p className="text-xs text-gray-400 mt-2">+12% vs mês anterior</p>
                    </Card>

                    <Card className="p-6 border-l-4 border-orange-500 shadow-sm hover:shadow-md transition">
                        <div className="flex items-start justify-between mb-4">
                            <div className="bg-orange-50 p-3 rounded-xl text-orange-600"><CreditCard size={24} /></div>
                            <Badge color="orange">A Vencer</Badge>
                        </div>
                        <p className="text-gray-500 text-sm font-medium">Faturas em Aberto</p>
                        <h3 className="text-3xl font-bold text-gray-900 mt-1">R$ {(openInvoices || 0).toFixed(2)}</h3>
                        <div className="flex justify-between items-center mt-2">
                            <p className="text-xs text-gray-400">Vencimento: 10/06</p>
                            {openInvoices > 0 && (
                                <Button className="py-1 px-3 text-sm" onClick={handlePayInvoice} disabled={isPaying}>
                                    {isPaying ? 'Gerando...' : 'Pagar Agora'}
                                </Button>
                            )}
                        </div>
                    </Card>

                    <Card className="p-6 border-l-4 border-green-500 shadow-sm hover:shadow-md transition cursor-pointer relative group" onClick={() => setShowAddCollaborator(true)}>
                        <div className="flex items-start justify-between mb-4">
                            <div className="bg-green-50 p-3 rounded-xl text-green-600"><Users size={24} /></div>
                            <Badge color="green">Ativos</Badge>
                        </div>
                        <p className="text-gray-500 text-sm font-medium">Colaboradores</p>
                        <h3 className="text-3xl font-bold text-gray-900 mt-1">12</h3>
                        <p className="text-xs text-green-600 mt-2">+2 novos este mês</p>

                        <div className="absolute inset-0 bg-green-500/10 opacity-0 group-hover:opacity-100 transition flex items-center justify-center rounded-xl backdrop-blur-[1px]">
                            <Button className="shadow-lg" onClick={(e) => { e.stopPropagation(); setShowAddCollaborator(true); }}><Plus size={16} className="mr-2" /> Novo Colaborador</Button>
                        </div>
                    </Card>
                </div>

                {/* Ride Details Modal */}
                {selectedRide && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl p-6 max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                    <FileText size={24} className="text-blue-600" /> Detalhes da Corrida
                                </h3>
                                <button onClick={() => setSelectedRide(null)} className="text-gray-400 hover:text-gray-600">
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-6 pr-2">
                                {/* Status Banner */}
                                <div className={`p-4 rounded-xl flex items-center justify-between ${selectedRide.status === 'completed' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                                    <div className="flex items-center gap-3">
                                        {selectedRide.status === 'completed' ? <CheckCircle size={24} /> : <Clock size={24} />}
                                        <div>
                                            <p className="font-bold text-lg uppercase">{selectedRide.status}</p>
                                            <p className="text-sm opacity-80">{new Date(selectedRide.createdAt).toLocaleString()}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs uppercase font-bold tracking-wider opacity-70">Valor Final</p>
                                        <p className="text-2xl font-bold">R$ {(selectedRide.price || 0).toFixed(2)}</p>
                                    </div>
                                </div>

                                {/* Trip Info */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-xs font-bold text-gray-500 uppercase">Passageiro / Solicitante</label>
                                            <div className="flex items-center gap-2 mt-1">
                                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-600">
                                                    {selectedRide.passenger.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-gray-900">{selectedRide.passenger.name}</p>
                                                    <p className="text-xs text-gray-500">{selectedRide.passenger.phone}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-xs font-bold text-gray-500 uppercase">Motorista</label>
                                            {selectedRide.driver ? (
                                                <div className="flex items-center gap-2 mt-1">
                                                    <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden">
                                                        {selectedRide.driver.avatar ? <img src={selectedRide.driver.avatar} className="w-full h-full object-cover" /> : <span className="flex items-center justify-center h-full font-bold text-gray-500">{selectedRide.driver.name.charAt(0)}</span>}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-gray-900">{selectedRide.driver.name}</p>
                                                        <p className="text-xs text-gray-500">{selectedRide.driver.vehicle} • {selectedRide.driver.plate}</p>
                                                    </div>
                                                </div>
                                            ) : (
                                                <p className="text-sm text-gray-400 italic">Não atribuído</p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-4 border-l border-gray-100 pl-6">
                                        <div className="relative pl-6 border-l-2 border-gray-200 space-y-6">
                                            <div className="relative">
                                                <div className="absolute -left-[31px] top-1 w-4 h-4 rounded-full border-2 border-gray-400 bg-white"></div>
                                                <label className="text-xs font-bold text-gray-500 uppercase">Origem</label>
                                                <p className="font-medium text-gray-900">{selectedRide.origin}</p>
                                            </div>
                                            <div className="relative">
                                                <div className="absolute -left-[31px] top-1 w-4 h-4 rounded-full border-2 border-gray-800 bg-gray-800"></div>
                                                <label className="text-xs font-bold text-gray-500 uppercase">Destino</label>
                                                <p className="font-medium text-gray-900">{selectedRide.destination}</p>
                                            </div>
                                        </div>

                                        <div className="flex gap-4 pt-2">
                                            <div>
                                                <label className="text-xs font-bold text-gray-500 uppercase">Distância</label>
                                                <p className="font-medium text-gray-900">{selectedRide.distance}</p>
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-gray-500 uppercase">Duração</label>
                                                <p className="font-medium text-gray-900">{selectedRide.duration}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6 pt-6 border-t border-gray-100 flex justify-end">
                                <Button fullWidth onClick={() => setSelectedRide(null)}>Fechar</Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Invoices Section */}
                <div className="space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <h3 className="font-bold text-xl text-gray-800 flex items-center gap-2">
                            <FileText size={24} className="text-blue-600" /> Faturas e Corridas
                        </h3>

                        {/* Tabs */}
                        <div className="bg-gray-100 p-1 rounded-xl flex items-center self-start md:self-auto">
                            <button
                                onClick={() => setActiveTab('open')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'open' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Em Aberto
                            </button>
                            <button
                                onClick={() => setActiveTab('history')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'history' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                <History size={14} /> Histórico
                            </button>
                        </div>
                    </div>

                    <div className="space-y-6">
                        {Object.entries(groupedRides).sort((a: [string, RideRequest[]], b: [string, RideRequest[]]) => {
                            // Sort logic: Recent first
                            // Mock date parsing from "Month Year" string
                            // For production, suggest using ISO keys like "2023-10".
                            return 0; // Keeping original order (insertion order) or implementing improved sort later
                        }).filter(([monthKey, monthRides]: [string, RideRequest[]]) => {
                            const isPaid = monthRides.every((r: RideRequest) => r.paymentStatus === 'completed');
                            const isCurrentMonth = monthKey === new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

                            if (activeTab === 'open') {
                                return !isPaid; // Strict: Only unpaid in Open
                            } else {
                                return isPaid; // Strict: Only paid in History
                            }
                        }).map(([monthKey, monthRides]: [string, RideRequest[]]) => {
                            const totalMonth = monthRides.reduce((sum, r) => sum + r.price, 0);
                            const isCurrentMonth = monthKey === new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
                            const isPaid = monthRides.every((r: RideRequest) => r.paymentStatus === 'completed');

                            let status: 'open' | 'closed' | 'overdue' = isCurrentMonth ? 'open' : (isPaid ? 'closed' : 'overdue');

                            // Mock due date logic
                            const dueDate = new Date();
                            dueDate.setDate(10);

                            return (
                                <div key={monthKey} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden transition-all hover:shadow-md animate-fade-in text-left">
                                    {/* Modern Header */}
                                    <div className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${status === 'open' ? 'bg-blue-50 text-blue-600' :
                                                status === 'overdue' ? 'bg-red-50 text-red-500' :
                                                    'bg-green-50 text-green-600'
                                                }`}>
                                                {status === 'closed' ? <CheckCircle size={24} /> : <FileText size={24} />}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-lg text-gray-900 capitalize leading-tight">{monthKey}</h4>
                                                <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                                                    <span className="flex items-center gap-1"><Clock size={12} /> Vencimento: 10/{new Date().getMonth() + 2}</span>
                                                    <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                                    <span>{monthRides.length} corrida(s)</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex flex-row md:flex-col items-center md:items-end gap-3 md:gap-1 w-full md:w-auto justify-between md:justify-start pl-16 md:pl-0">
                                            <div className="text-right">
                                                <span className="text-xs font-medium text-gray-400 uppercase tracking-wider block">Total</span>
                                                <span className="text-xl font-bold text-gray-900 block">R$ {(totalMonth || 0).toFixed(2)}</span>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <Badge color={status === 'open' ? 'blue' : (status === 'overdue' ? 'red' : 'green')}>
                                                    {status === 'open' ? 'EM ABERTO' : (status === 'overdue' ? 'VENCIDA' : 'PAGA')}
                                                </Badge>
                                                {status !== 'open' && (
                                                    <button className="text-gray-400 hover:text-gray-600 transition p-1" title="Baixar Fatura">
                                                        <Download size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Alert for Due Soon */}
                                    {status === 'open' && (
                                        <div className="bg-orange-50/50 border-t border-b border-orange-100 px-6 py-2 flex items-center gap-2 text-orange-700 text-xs font-medium">
                                            <AlertTriangle size={14} />
                                            <span>Fatura fecha em 5 dias. Evite bloqueios.</span>
                                        </div>
                                    )}

                                    {/* Modern Table */}
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead className="bg-gray-50/50 text-gray-400 uppercase text-[10px] tracking-wider font-semibold">
                                                <tr>
                                                    <th className="px-6 py-3 pl-20">Data</th>
                                                    <th className="px-6 py-3">Colaborador</th>
                                                    <th className="px-6 py-3">Rota</th>
                                                    <th className="px-6 py-3 text-right">Valor</th>
                                                    <th className="px-6 py-3"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50">
                                                {monthRides.map(ride => (
                                                    <tr key={ride.id} className="hover:bg-gray-50/80 transition-colors group">
                                                        <td className="px-6 py-3 pl-20 whitespace-nowrap">
                                                            <div className="text-gray-900 text-sm font-medium">{new Date(ride.createdAt).toLocaleDateString()}</div>
                                                            <div className="text-gray-400 text-xs">{new Date(ride.createdAt).toLocaleTimeString().slice(0, 5)}</div>
                                                        </td>
                                                        <td className="px-6 py-3 whitespace-nowrap">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500 uppercase">
                                                                    {ride.passenger.name.charAt(0)}
                                                                </div>
                                                                <span className="text-sm text-gray-700">{ride.passenger.name.split(' ')[0]}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-3 max-w-[200px]">
                                                            <div className="flex flex-col gap-0.5">
                                                                <div className="flex items-center gap-1.5 text-xs text-gray-500 truncate">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-gray-300"></div>
                                                                    {ride.origin.split(',')[0]}
                                                                </div>
                                                                <div className="flex items-center gap-1.5 text-xs text-gray-900 font-medium truncate">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                                                    {ride.destination.split(',')[0]}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-3 text-right font-mono text-sm font-medium text-gray-900">
                                                            R$ {(ride.price || 0).toFixed(2)}
                                                        </td>
                                                        <td className="px-6 py-3 text-right">
                                                            <button
                                                                className="text-blue-600 hover:text-blue-800 text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity"
                                                                onClick={() => setSelectedRide(ride)}
                                                            >
                                                                Ver Detalhes
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Footer Summary */}
                                    {status !== 'closed' && (
                                        <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                                            {companyId && (
                                                <Button variant="outline" className="text-xs py-1.5 h-auto shadow-sm" onClick={() => handleManualWriteOff(monthRides)}>
                                                    Baixa Manual
                                                </Button>
                                            )}
                                            <Button className="text-xs py-1.5 h-auto shadow-sm" onClick={() => handlePayInvoice(monthKey, monthRides)} disabled={isPaying}>
                                                {isPaying ? 'Processando...' : 'Pagar Fatura'}
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {Object.keys(groupedRides).length === 0 && (
                            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-300">
                                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                                    <Clock size={32} />
                                </div>
                                <h3 className="text-lg font-medium text-gray-900">Nenhuma fatura encontrada</h3>
                                <p className="text-gray-500 mt-1">Não há registros para o filtro selecionado.</p>
                            </div>
                        )}
                    </div>
                </div>
                {/* Payment Modal */}
                {invoicePayment && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl animate-scale-in">
                            <div className="text-center mb-6">
                                <h3 className="text-xl font-bold text-gray-900">Pagamento de Fatura</h3>
                                <p className="text-gray-500 mt-1">Escaneie o QR Code para pagar</p>
                            </div>

                            {invoicePayment.qrCodeBase64 ? (
                                <div className="flex justify-center mb-6">
                                    <img src={`data:image/png;base64,${invoicePayment.qrCodeBase64}`} alt="QR Code PIX" className="w-64 h-64" />
                                </div>
                            ) : (
                                <div className="bg-gray-100 p-4 rounded-lg mb-6 break-all text-xs font-mono text-gray-600">
                                    {invoicePayment.qrCode || invoicePayment.paymentLink}
                                </div>
                            )}

                            <div className="space-y-3">
                                <Button fullWidth onClick={() => {
                                    navigator.clipboard.writeText(invoicePayment.qrCode || invoicePayment.paymentLink);
                                    alert('Código copiado!');
                                }}>
                                    Copiar Código PIX
                                </Button>
                                <Button variant="outline" fullWidth onClick={() => setInvoicePayment(null)}>
                                    Fechar
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
                {/* Add Collaborator Modal */}
                {showAddCollaborator && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl animate-scale-in">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-gray-900">Novo Colaborador</h3>
                                <button onClick={() => setShowAddCollaborator(false)} className="text-gray-400 hover:text-gray-600">
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                                    <Input
                                        value={newCollaborator.name}
                                        onChange={(e) => setNewCollaborator({ ...newCollaborator, name: e.target.value })}
                                        placeholder="Ex: João da Silva"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Email Corporativo</label>
                                    <Input
                                        value={newCollaborator.email}
                                        onChange={(e) => setNewCollaborator({ ...newCollaborator, email: e.target.value })}
                                        placeholder="joao@empresa.com"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Telefone / WhatsApp</label>
                                    <Input
                                        value={newCollaborator.phone}
                                        onChange={(e) => setNewCollaborator({ ...newCollaborator, phone: e.target.value })}
                                        placeholder="(11) 99999-9999"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">CPF (Opcional)</label>
                                    <Input
                                        value={newCollaborator.cpf}
                                        onChange={(e) => setNewCollaborator({ ...newCollaborator, cpf: e.target.value })}
                                        placeholder="000.000.000-00"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 mt-6">
                                <Button variant="outline" onClick={() => setShowAddCollaborator(false)}>Cancelar</Button>
                                <Button onClick={() => {
                                    alert('Colaborador adicionado com sucesso!');
                                    setShowAddCollaborator(false);
                                }}>Cadastrar</Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Password Reset Modal */}
                {showPasswordReset && (
                    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl animate-scale-in">
                            <div className="text-center mb-6">
                                <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Lock size={32} className="text-orange-600" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900">Redefinir Senha</h3>
                                <p className="text-gray-500 mt-2">
                                    Você está utilizando uma senha temporária.
                                    Por segurança, defina uma nova senha.
                                </p>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Nova Senha</label>
                                    <Input
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="Mínimo 6 caracteres"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar Senha</label>
                                    <Input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Digite novamente"
                                    />
                                </div>
                            </div>

                            <div className="mt-6">
                                <Button
                                    fullWidth
                                    onClick={handlePasswordReset}
                                    disabled={savingPassword || !newPassword || newPassword !== confirmPassword}
                                >
                                    {savingPassword ? 'Salvando...' : 'Salvar Nova Senha'}
                                </Button>
                                <p className="text-xs text-center text-gray-400 mt-3">
                                    Sua nova senha será usada para acessar o painel de qualquer dispositivo.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
