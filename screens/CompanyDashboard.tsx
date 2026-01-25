import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getCompany, updateCompanyStatus, getCompanyByOwner, saveCompany } from '../services/company';
import { getRideHistory, injectMockCorporateRides } from '../services/ride';
import { generateInvoicePayment } from '../services/billing';
import { Company, RideRequest, User } from '../types';
import { Button, Card, Badge, Input } from '../components/UI';
import {
    Building2, Users, CreditCard, Calendar, ArrowLeft,
    TrendingUp, Download, Search, CheckCircle, Clock, AlertCircle, Plus, X,
    FileText, AlertTriangle, ChevronDown, ChevronUp, History, Lock, LayoutDashboard, Settings, Map, LogOut, ArrowRight, Video, Camera
} from 'lucide-react';

export const CompanyDashboard = ({ onBack, companyId, isAdminView }: { onBack: () => void, companyId?: string, isAdminView?: boolean }) => {
    const { user, role } = useAuth();
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

    // State for new Tabs
    const [subTab, setSubTab] = useState<'overview' | 'new_ride' | 'users' | 'settings' | 'history' | 'financial'>('overview');

    // --- New Features State ---

    // Users Management
    const [companyUsers, setCompanyUsers] = useState<User[]>([]);
    const [userModalOpen, setUserModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [userData, setUserData] = useState({ name: '', email: '', phone: '', password: '' });

    // History Filters
    const [historyFilter, setHistoryFilter] = useState({ start: '', end: '', user: '' });

    // Settings
    const [settings, setSettings] = useState({
        billingDay: 10,
        autoBlockOverdue: false,
        blockToleranceDays: 5
    });

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

    const openInvoices = rides.filter(r => r.paymentStatus === 'pending').reduce((acc, r) => acc + (r.price || 0), 0);

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

    // ... (logic) ...

    useEffect(() => {
        // Force close if admin or isAdminView prop is true
        if (role === 'admin' || isAdminView) {
            setShowPasswordReset(false);
            return;
        }

        // Only for non-admins (companies)
        const needsReset = localStorage.getItem('motoja_needs_password_reset') === 'true';
        const targetCompanyId = localStorage.getItem('motoja_company_id');

        // Ensure the prompt is for THIS company context (if ID stored) or generic
        if (needsReset && (!targetCompanyId || targetCompanyId === companyId)) {
            // EXTRA CHECK: Double ensure role is not admin (in case of race condition)
            if (role !== 'admin' && !isAdminView) {
                setShowPasswordReset(true);
            }
        }
    }, [companyId, role, isAdminView]);

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
            // 1. Update Firestore (App Logic)
            const updatedCompany = {
                ...company,
                passwordHash: newPassword,
                isTempPassword: false
            };
            await saveCompany(updatedCompany);

            // 2. Update Firebase Auth (Actual Login Credential)
            // We can only do this if we are logged in as the company (not admin)
            if (role === 'company') {
                const { updateCurrentUserPassword } = await import('../services/auth');
                await updateCurrentUserPassword(newPassword);
            }

            setCompany(updatedCompany);
            setShowPasswordReset(false);
            setNewPassword('');

            // Clear flag
            localStorage.removeItem('motoja_needs_password_reset');
            localStorage.removeItem('motoja_company_id');

            alert('Senha atualizada com sucesso!');
        } catch (error: any) {
            console.error('Erro ao redefinir senha:', error);
            if (error.code === 'auth/requires-recent-login') {
                alert('Por segurança, faça logout e login novamente antes de trocar a senha.');
            } else {
                alert('Erro ao atualizar senha. Tente novamente.');
            }
        } finally {
            setSavingPassword(false);
        }
    };


    useEffect(() => {
        let attempts = 0;
        const maxAttempts = 5;

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

                // Retry Logic for Race Condition (Post-Registration)
                if (!companyData) {
                    if (attempts < maxAttempts) {
                        attempts++;
                        console.log(`[CompanyDashboard] Company not found, retrying... (${attempts}/${maxAttempts})`);
                        setTimeout(loadData, 1500); // Wait 1.5s before retry
                        return;
                    }

                    console.error('[CompanyDashboard] No company found for user after retries');
                    setCompany(null);
                    setLoading(false);
                    return;
                }

                setCompany(companyData);
                if (companyData) {
                    targetId = companyData.id;
                    // Load Settings
                    if (companyData.settings) {
                        setSettings({
                            billingDay: companyData.settings.billingDay ?? 10,
                            autoBlockOverdue: companyData.settings.autoBlockOverdue ?? false,
                            blockToleranceDays: companyData.settings.blockToleranceDays ?? 5
                        });
                    }

                    // Load Mock Users
                    const savedUsers = JSON.parse(localStorage.getItem('motoja_mock_users') || '[]');
                    const employees = savedUsers.filter((u: User) => u.companyId === companyData!.id);
                    setCompanyUsers(employees);
                }

                if (companyData && targetId) injectMockCorporateRides(targetId);

                // Check if company needs to reset password
                // Only enforce for the actual company user, not for Admins viewing the dashboard
                // We use 'role' from auth context or check if user.email matches company.email
                if (companyData && companyData.isTempPassword && role !== 'admin' && !isAdminView) {
                    setShowPasswordReset(true);
                    // Clear the localStorage flag
                    localStorage.removeItem('motoja_needs_password_reset');
                }

                // Mock rides for demo purposes
                const storedRides = JSON.parse(localStorage.getItem('motoja_mock_rides') || '[]');
                const companyRides = storedRides.filter((r: RideRequest) => r.companyId === targetId).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

                setRides(companyRides);

                // --- Business Rule: Auto Block if Overdue ---
                /* 
                   DISABLED: Aggressive auto-blocking was disabling companies upon simple viewing.
                   In a real scenario, this should be a backend job, not a frontend side-effect.
                */
            } catch (error) {
                console.error(error);
            } finally {
                if (attempts >= maxAttempts || (companyId || user)) {
                    setLoading(false);
                }
            }
        };
        loadData();
    }, [user, companyId]);

    const handleSaveUser = async () => {
        // Mock save user logic
        if (!userData.name || !userData.email) return alert('Preencha os campos obrigatórios');

        const newUser: User = {
            id: editingUser?.id || `user_${Date.now()}`,
            name: userData.name,
            email: userData.email,
            phone: userData.phone,
            type: 'passenger',
            rating: 5,
            totalRides: 0,
            companyId: company?.id,
            status: 'active',
            avatar: `https://ui-avatars.com/api/?name=${userData.name}&background=random`
        };

        // Update local storage mock
        const allUsers = JSON.parse(localStorage.getItem('motoja_mock_users') || '[]');
        let updatedUsers;
        if (editingUser) {
            updatedUsers = allUsers.map((u: User) => u.id === editingUser.id ? newUser : u);
        } else {
            updatedUsers = [...allUsers, newUser];
        }
        localStorage.setItem('motoja_mock_users', JSON.stringify(updatedUsers));
        setCompanyUsers(updatedUsers.filter((u: User) => u.companyId === company?.id));

        setUserModalOpen(false);
        setUserData({ name: '', email: '', phone: '', password: '' });
        setEditingUser(null);
        alert('Colaborador salvo com sucesso!');
    };

    const handleSaveSettings = async () => {
        if (!company) return;
        const updatedCompany = {
            ...company,
            settings: settings
        };
        await saveCompany(updatedCompany);
        setCompany(updatedCompany);
        alert('Configurações salvas!');
    };

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
    // openInvoices is already defined above

    return (
        <div className="flex h-screen bg-gray-50 font-sans">
            {/* Sidebar */}
            <div className="w-64 bg-white border-r border-gray-200 flex flex-col shrink-0 transition-all duration-300">
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center text-orange-600 overflow-hidden shrink-0">
                            {company.logoUrl ? <img src={company.logoUrl} className="w-full h-full object-contain" /> : <Building2 size={24} />}
                        </div>
                        <div className="min-w-0">
                            <h1 className="font-bold text-gray-800 leading-tight truncate" title={company.name}>{company.name}</h1>
                            <p className="text-xs text-gray-500 truncate">Painel Corporativo</p>
                        </div>
                    </div>
                </div>

                <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
                    <button
                        onClick={() => setSubTab('overview')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${subTab === 'overview' ? 'bg-orange-50 text-orange-700' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        <LayoutDashboard size={18} /> Visão Geral
                    </button>
                    <button
                        onClick={() => setSubTab('new_ride')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${subTab === 'new_ride' ? 'bg-orange-50 text-orange-700' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        <Plus size={18} /> Nova Corrida
                    </button>
                    <button
                        onClick={() => setSubTab('history')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${subTab === 'history' ? 'bg-orange-50 text-orange-700' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        <History size={18} /> Histórico
                    </button>
                    <button
                        onClick={() => setSubTab('users')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${subTab === 'users' ? 'bg-orange-50 text-orange-700' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        <Users size={18} /> Colaboradores
                    </button>
                    {(role === 'admin' || isAdminView) && (
                        <button
                            onClick={() => setSubTab('settings')}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${subTab === 'settings' ? 'bg-orange-50 text-orange-700' : 'text-gray-600 hover:bg-gray-50'}`}
                        >
                            <Settings size={18} /> Configurações
                        </button>
                    )}
                </nav>

                <div className="p-4 border-t border-gray-100">
                    <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 w-full px-4 py-2 hover:bg-gray-50 rounded-lg transition-colors">
                        <LogOut size={16} /> Voltar / Sair
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto bg-gray-50/50">
                <header className="bg-white h-16 border-b border-gray-200 flex items-center justify-between px-8 sticky top-0 z-10 shadow-sm">
                    <h2 className="text-xl font-bold text-gray-800 capitalize">
                        {subTab === 'overview' ? 'Visão Geral' :
                            subTab === 'new_ride' ? 'Solicitar Corrida' :
                                subTab === 'history' ? 'Atividades Recentes' :
                                    subTab === 'users' ? 'Gestão de Colaboradores' : 'Configurações'}
                    </h2>
                    <div className="flex items-center gap-4">
                        <div className="text-right hidden md:block">
                            <p className="text-sm font-bold text-gray-900">{company?.tradeName || company?.name}</p>
                            <p className="text-xs text-gray-500">CNPJ: {company?.cnpj}</p>
                        </div>
                    </div>
                </header>

                <main className="p-8 max-w-7xl mx-auto w-full">
                    {/* Render Content Based on Tab */}
                    {subTab === 'overview' && (
                        <div className="space-y-6 animate-fade-in">
                            {/* Warning Banner */}
                            {company.status === 'blocked' && (
                                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                                    <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={20} />
                                    <div>
                                        <h3 className="font-bold text-red-800">Conta Temporariamente Suspensa</h3>
                                        <p className="text-sm text-red-600 mt-1">Identificamos faturas em aberto. Regularize para desbloquear novos pedidos.</p>
                                    </div>
                                </div>
                            )}

                            {/* Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <Card className="p-6 border-l-4 border-blue-500">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-sm text-gray-500 mb-1">Total Gasto (Mês)</p>
                                            <h3 className="text-3xl font-bold text-gray-900">
                                                R$ {rides.filter(r => r.paymentStatus === 'pending_invoice').reduce((acc, r) => acc + r.price, 0).toFixed(2)}
                                            </h3>
                                        </div>
                                        <div className="p-3 bg-blue-50 rounded-lg text-blue-600"><TrendingUp size={24} /></div>
                                    </div>
                                </Card>

                                <Card className="p-6 border-l-4 border-orange-500">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-sm text-gray-500 mb-1">Faturas em Aberto</p>
                                            <h3 className="text-3xl font-bold text-gray-900">
                                                R$ {rides.filter(r => r.paymentStatus === 'pending_invoice').reduce((acc, r) => acc + r.price, 0).toFixed(2)}
                                            </h3>
                                            <p className="text-xs text-orange-600 mt-1">Vencimento: Dia {settings.billingDay}</p>
                                        </div>
                                        <div className="p-3 bg-orange-50 rounded-lg text-orange-600"><CreditCard size={24} /></div>
                                    </div>
                                </Card>

                                <Card className="p-6 border-l-4 border-green-500">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-sm text-gray-500 mb-1">Colaboradores</p>
                                            <h3 className="text-3xl font-bold text-gray-900">{companyUsers.length}</h3>
                                            <p className="text-xs text-green-600 mt-1">Ativos no app</p>
                                        </div>
                                        <div className="p-3 bg-green-50 rounded-lg text-green-600"><Users size={24} /></div>
                                    </div>
                                </Card>
                            </div>

                            <h3 className="text-lg font-bold text-gray-800 mt-4 mb-2">Faturas Recentes</h3>
                            <Card className="p-6 text-center text-gray-400 border-dashed border-2">
                                <FileText size={48} className="mx-auto mb-4 opacity-20" />
                                <p>Veja o detalhamento completo na aba <button onClick={() => setSubTab('history')} className="text-orange-600 font-bold hover:underline">Histórico</button></p>
                            </Card>
                        </div>
                    )}

                    {subTab === 'users' && (
                        <div className="animate-fade-in space-y-6">
                            <div className="flex justify-between">
                                <div className="relative w-64">
                                    <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                                    <input className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none" placeholder="Buscar colaborador..." />
                                </div>
                                <Button onClick={() => { setUserData({ name: '', email: '', phone: '', password: '' }); setEditingUser(null); setUserModalOpen(true); }}>
                                    <Plus size={18} className="mr-2" /> Novo Colaborador
                                </Button>
                            </div>

                            <Card className="overflow-hidden shadow-sm">
                                <table className="w-full text-left text-sm text-gray-600">
                                    <thead className="bg-gray-50 text-gray-900 font-semibold border-b">
                                        <tr>
                                            <th className="p-4">Colaborador</th>
                                            <th className="p-4">Email</th>
                                            <th className="p-4">Telefone</th>
                                            <th className="p-4">Status</th>
                                            <th className="p-4 text-right">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {companyUsers.map(u => (
                                            <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="p-4 flex items-center gap-3">
                                                    <img src={u.avatar} className="w-8 h-8 rounded-full bg-gray-200" />
                                                    <span className="font-medium text-gray-900">{u.name}</span>
                                                </td>
                                                <td className="p-4">{u.email}</td>
                                                <td className="p-4">{u.phone}</td>
                                                <td className="p-4"><Badge color={u.status === 'blocked' ? 'red' : 'green'}>{u.status === 'blocked' ? 'Bloqueado' : 'Ativo'}</Badge></td>
                                                <td className="p-4 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            onClick={() => { setEditingUser(u); setUserData({ ...u, password: '' } as any); setUserModalOpen(true); }}
                                                            className="p-2 hover:bg-gray-100 rounded-full text-blue-600 transition-colors" title="Editar"
                                                        >
                                                            <Settings size={16} />
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                if (confirm(`Tem certeza que deseja remover ${u.name}?`)) {
                                                                    // Mock remove
                                                                    const updated = companyUsers.filter(user => user.id !== u.id);
                                                                    setCompanyUsers(updated);
                                                                    const all = JSON.parse(localStorage.getItem('motoja_mock_users') || '[]');
                                                                    localStorage.setItem('motoja_mock_users', JSON.stringify(all.filter((user: User) => user.id !== u.id)));
                                                                }
                                                            }}
                                                            className="p-2 hover:bg-gray-100 rounded-full text-red-600 transition-colors" title="Remover"
                                                        >
                                                            <X size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {companyUsers.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-gray-400">Nenhum colaborador cadastrado.</td></tr>}
                                    </tbody>
                                </table>
                            </Card>
                        </div>
                    )}

                    {subTab === 'settings' && (role === 'admin' || isAdminView) && (
                        <div className="max-w-2xl animate-fade-in">
                            <Card className="p-6 space-y-6">
                                <div className="flex items-center gap-2 border-b pb-4 mb-4">
                                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-gray-600">
                                        <Settings size={24} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-800">Configurações Administrativas</h3>
                                        <p className="text-xs text-gray-500">Apenas administradores podem alterar estes dados.</p>
                                    </div>
                                </div>

                                <h4 className="font-bold text-gray-700 text-sm uppercase tracking-wide">Faturamento & Cobrança</h4>

                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Período de Faturamento</label>
                                        <select
                                            value={(settings as any).billingPeriod || 'monthly'}
                                            onChange={(e) => setSettings({ ...settings, billingPeriod: e.target.value } as any)}
                                            className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-orange-500 outline-none"
                                        >
                                            <option value="weekly">Semanal</option>
                                            <option value="biweekly">Quinzenal</option>
                                            <option value="monthly">Mensal</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Dia de Fechamento</label>
                                        <select
                                            value={settings.billingDay}
                                            onChange={(e) => setSettings({ ...settings, billingDay: Number(e.target.value) })}
                                            className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-orange-500 outline-none"
                                        >
                                            {[1, 5, 10, 15, 20, 25].map(d => <option key={d} value={d}>Dia {d}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Tolerância de Atraso (Dias)</label>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            type="number"
                                            value={settings.blockToleranceDays}
                                            onChange={(e: any) => setSettings({ ...settings, blockToleranceDays: Number(e.target.value) })}
                                            containerClassName="w-32"
                                        />
                                        <span className="text-sm text-gray-500">dias após o vencimento</span>
                                    </div>
                                </div>

                                <div className="bg-orange-50 p-4 rounded-xl flex items-start gap-3">
                                    <AlertTriangle className="text-orange-600 shrink-0 mt-0.5" size={18} />
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <input
                                                type="checkbox"
                                                id="autoBlock"
                                                checked={settings.autoBlockOverdue}
                                                onChange={(e) => setSettings({ ...settings, autoBlockOverdue: e.target.checked })}
                                                className="w-4 h-4 text-orange-600 rounded cursor-pointer"
                                            />
                                            <label htmlFor="autoBlock" className="font-bold text-gray-800 cursor-pointer text-sm">Bloqueio Automático</label>
                                        </div>
                                        <p className="text-xs text-gray-600">Se ativado, o sistema bloqueará novos pedidos automaticamente caso existam faturas em aberto além do período de tolerância.</p>
                                    </div>
                                </div>

                                <div className="pt-4 flex justify-end border-t">
                                    <Button onClick={handleSaveSettings}>Salvar Alterações</Button>
                                </div>
                            </Card>
                        </div>
                    )}

                    {subTab === 'financial' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Card className="p-6 border-l-4 border-orange-500">
                                    <h3 className="text-lg font-bold text-gray-800 mb-2">Faturas em Aberto</h3>
                                    {Object.entries(groupedRides)
                                        .filter(([_, rides]: [string, RideRequest[]]) => rides.some(r => r.paymentStatus === 'pending_invoice'))
                                        .map(([month, monthRides]: [string, RideRequest[]]) => {
                                            const total = monthRides.reduce((acc, r) => acc + r.price, 0);
                                            return (
                                                <div key={month} className="flex justify-between items-center p-4 bg-orange-50 rounded-xl mb-3">
                                                    <div>
                                                        <p className="font-bold text-gray-900 capitalize">{month}</p>
                                                        <p className="text-xs text-orange-700">{monthRides.length} corridas</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="font-bold text-gray-900">R$ {total.toFixed(2)}</p>
                                                        <Button className="py-1 px-3 text-xs h-auto" onClick={() => handlePayInvoice(month, monthRides)}>Pagar Agora</Button>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    {Object.entries(groupedRides).filter(([_, rides]: [string, RideRequest[]]) => rides.some(r => r.paymentStatus === 'pending_invoice')).length === 0 && (
                                        <p className="text-gray-400 text-sm text-center py-4">Nenhuma fatura em aberto.</p>
                                    )}
                                </Card>

                                <Card className="p-6 border-l-4 border-green-500">
                                    <h3 className="text-lg font-bold text-gray-800 mb-2">Histórico de Pagamentos</h3>
                                    {Object.entries(groupedRides)
                                        .filter(([_, rides]: [string, RideRequest[]]) => rides.every(r => r.paymentStatus === 'completed'))
                                        .map(([month, monthRides]: [string, RideRequest[]]) => {
                                            const total = monthRides.reduce((acc, r) => acc + r.price, 0);
                                            return (
                                                <div key={month} className="flex justify-between items-center p-4 bg-green-50/50 rounded-xl mb-3 border border-green-100">
                                                    <div className="flex items-center gap-3">
                                                        <CheckCircle size={20} className="text-green-500" />
                                                        <div>
                                                            <p className="font-bold text-gray-900 capitalize">{month}</p>
                                                            <p className="text-xs text-green-700">Pago</p>
                                                        </div>
                                                    </div>
                                                    <p className="font-bold text-gray-900">R$ {total.toFixed(2)}</p>
                                                </div>
                                            )
                                        })}
                                    {Object.entries(groupedRides).filter(([_, rides]: [string, RideRequest[]]) => rides.every(r => r.paymentStatus === 'completed')).length === 0 && (
                                        <p className="text-gray-400 text-sm text-center py-4">Nenhum pagamento registrado.</p>
                                    )}
                                </Card>
                            </div>
                        </div>
                    )}

                    {subTab === 'new_ride' && (
                        <div className="max-w-2xl mx-auto animate-fade-in pb-10">
                            <Card className="p-8 shadow-sm">
                                <div className="text-center mb-8">
                                    <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                        <Map size={24} />
                                    </div>
                                    <h2 className="text-2xl font-bold text-gray-900">Solicitar Corrida Corporativa</h2>
                                    <p className="text-gray-500 text-sm">Preencha os dados abaixo para iniciar um deslocamento.</p>
                                </div>

                                <div className="space-y-6">
                                    {/* Passenger Selection */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Passageiro</label>
                                        <select className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all">
                                            <option value="">Selecione um colaborador...</option>
                                            {companyUsers.map(u => <option key={u.id} value={u.id}>{u.name} - {u.phone}</option>)}
                                        </select>
                                    </div>

                                    {/* Route Inputs */}
                                    <div className="relative">
                                        <div className="absolute left-3 top-3 bottom-3 w-0.5 bg-gray-200/60 z-0"></div>
                                        <div className="space-y-4 relative z-10">
                                            <div className="group">
                                                <div className="absolute left-0 top-3 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white shadow-sm"></div>
                                                <Input
                                                    placeholder="Ponto de Partida"
                                                    containerClassName="pl-6"
                                                    className="bg-gray-50 border-gray-200 focus:bg-white"
                                                />
                                            </div>
                                            <div className="group">
                                                <div className="absolute left-0 top-3 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white shadow-sm"></div>
                                                <Input
                                                    placeholder="Destino"
                                                    containerClassName="pl-6"
                                                    className="bg-gray-50 border-gray-200 focus:bg-white"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Service Type Selection */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <button className="p-4 border-2 border-orange-500 bg-orange-50/50 rounded-xl flex flex-col items-center gap-2 transition-all">
                                            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-orange-600">
                                                <img src="https://cdn-icons-png.flaticon.com/512/3082/3082383.png" className="w-6 h-6 object-contain" />
                                            </div>
                                            <span className="font-bold text-gray-800">MotoComum</span>
                                            <span className="text-xs font-bold text-green-600">R$ 12,50</span>
                                        </button>
                                        <button className="p-4 border border-gray-200 hover:border-orange-200 hover:bg-orange-50 rounded-xl flex flex-col items-center gap-2 transition-all opacity-60">
                                            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-400">
                                                <img src="https://cdn-icons-png.flaticon.com/512/2972/2972185.png" className="w-6 h-6 object-contain grayscale opacity-50" />
                                            </div>
                                            <span className="font-bold text-gray-600">Entrega</span>
                                            <span className="text-xs text-gray-400">R$ 15,90</span>
                                        </button>
                                    </div>

                                    <Button fullWidth className="py-4 text-base shadow-lg shadow-orange-500/20" onClick={() => alert('Feature em desenvolvimento: Integração real com API de solicitação.')}>
                                        <div className="flex items-center justify-center gap-2">
                                            <span>Confirmar Solicitação</span>
                                            <ArrowRight size={18} />
                                        </div>
                                    </Button>
                                </div>
                            </Card>
                        </div>
                    )}

                    {/* Ride Details Modal */}
                    {selectedRide && (
                        <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 animate-fade-in" onClick={() => setSelectedRide(null)}>
                            <div className="bg-white w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl animate-scale-in" onClick={e => e.stopPropagation()}>
                                {/* Map Header Placeholder */}
                                <div className="h-40 bg-gray-100 relative">
                                    <div className="absolute inset-0 opacity-50" style={{ backgroundImage: 'url(https://maps.googleapis.com/maps/api/staticmap?center=-23.550520,-46.633308&zoom=14&size=600x300&key=YOUR_KEY)' }}></div> {/* Placeholder Pattern */}
                                    <button
                                        onClick={() => setSelectedRide(null)}
                                        className="absolute top-4 right-4 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-md hover:bg-gray-50 transition-colors"
                                    >
                                        <X size={16} />
                                    </button>
                                    <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-lg text-xs font-bold shadow-sm">
                                        ID: {selectedRide.id}
                                    </div>
                                </div>

                                <div className="p-6">
                                    <div className="flex justify-between items-start mb-6">
                                        <div>
                                            <h3 className="text-xl font-bold text-gray-900">Detalhes da Corrida</h3>
                                            <p className="text-sm text-gray-500">{new Date(selectedRide.createdAt).toLocaleString()}</p>
                                        </div>
                                        <Badge color={selectedRide.status === 'completed' ? 'green' : selectedRide.status === 'cancelled' ? 'red' : 'blue'} size="lg">
                                            {selectedRide.status === 'completed' ? 'Finalizada' : selectedRide.status === 'cancelled' ? 'Cancelada' : 'Em Rota'}
                                        </Badge>
                                    </div>

                                    <div className="space-y-6">
                                        {/* Route */}
                                        <div className="relative pl-6 space-y-4">
                                            <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-gray-200"></div>
                                            <div>
                                                <div className="absolute left-1 top-2 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white shadow-sm"></div>
                                                <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Origem</p>
                                                <p className="text-gray-900 font-medium">{selectedRide.origin}</p>
                                            </div>
                                            <div>
                                                <div className="absolute left-1 top-10 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white shadow-sm"></div>
                                                <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Destino</p>
                                                <p className="text-gray-900 font-medium">{selectedRide.destination}</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                                            <div>
                                                <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Passageiro</p>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-bold">
                                                        {selectedRide.passenger?.name?.[0] || 'U'}
                                                    </div>
                                                    <span className="text-sm text-gray-900 font-medium">{selectedRide.passenger?.name}</span>
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Piloto</p>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-xs font-bold">
                                                        {selectedRide.driver?.name?.[0] || '-'}
                                                    </div>
                                                    <span className="text-sm text-gray-900 font-medium">{selectedRide.driver?.name || 'Aguardando'}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-gray-50 rounded-xl p-4 flex justify-between items-center border border-gray-100">
                                            <span className="font-bold text-gray-600">Valor Total</span>
                                            <span className="text-2xl font-bold text-gray-900">R$ {selectedRide.price.toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {subTab === 'history' && (
                        <div className="animate-fade-in space-y-6">
                            {/* Filter Bar */}
                            <Card className="p-4">
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                                    <Input
                                        type="date"
                                        label="Início"
                                        value={historyFilter.start}
                                        onChange={(e: any) => setHistoryFilter({ ...historyFilter, start: e.target.value })}
                                    />
                                    <Input
                                        type="date"
                                        label="Fim"
                                        value={historyFilter.end}
                                        onChange={(e: any) => setHistoryFilter({ ...historyFilter, end: e.target.value })}
                                    />
                                    <div className="relative">
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Colaborador</label>
                                        <select
                                            value={historyFilter.user}
                                            onChange={(e) => setHistoryFilter({ ...historyFilter, user: e.target.value })}
                                            className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                                        >
                                            <option value="">Todos</option>
                                            {companyUsers.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
                                        </select>
                                    </div>
                                    <Button variant="outline" onClick={() => setHistoryFilter({ start: '', end: '', user: '' })}>
                                        Limpar Filtros
                                    </Button>
                                </div>
                            </Card>

                            {/* Enhanced Table */}
                            <Card className="overflow-hidden shadow-sm border border-gray-200">
                                <div className="max-h-[600px] overflow-y-auto">
                                    <table className="w-full text-left text-sm text-gray-600">
                                        <thead className="bg-gray-50 text-gray-800 font-bold uppercase text-xs tracking-wider sticky top-0 z-10 border-b border-gray-200">
                                            <tr>
                                                <th className="p-4">Data</th>
                                                <th className="p-4">Passageiro</th>
                                                <th className="p-4">Trajeto</th>
                                                <th className="p-4">Valor</th>
                                                <th className="p-4">Status</th>
                                                <th className="p-4 text-center">Detalhes</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 bg-white">
                                            {rides
                                                .filter(r => !historyFilter.user || (r.passenger?.name || '').includes(historyFilter.user))
                                                .filter(r => !historyFilter.start || new Date(r.createdAt) >= new Date(historyFilter.start))
                                                .filter(r => !historyFilter.end || new Date(r.createdAt) <= new Date(historyFilter.end + 'T23:59:59'))
                                                .map(r => (
                                                    <tr key={r.id} className="hover:bg-gray-50 transition-colors group cursor-default">
                                                        <td className="p-4 whitespace-nowrap">
                                                            <div className="font-medium text-gray-900">{new Date(r.createdAt).toLocaleDateString()}</div>
                                                            <div className="text-xs text-gray-400">{new Date(r.createdAt).toLocaleTimeString()}</div>
                                                        </td>
                                                        <td className="p-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                                                                    {r.passenger?.name?.[0] || 'U'}
                                                                </div>
                                                                <div>
                                                                    <div className="font-medium text-gray-900">{r.passenger?.name || 'Usuario'}</div>
                                                                    <div className="text-xs text-gray-400">Corporativo</div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="p-4 max-w-xs">
                                                            <div className="flex flex-col gap-1 text-xs">
                                                                <div className="flex items-center gap-2 text-gray-700 truncate" title={r.origin}>
                                                                    <div className="w-2 h-2 rounded-full bg-green-500 shrink-0"></div>
                                                                    {r.origin}
                                                                </div>
                                                                <div className="h-4 border-l border-gray-200 ml-1 border-dashed"></div>
                                                                <div className="flex items-center gap-2 text-gray-700 truncate" title={r.destination}>
                                                                    <div className="w-2 h-2 rounded-full bg-red-500 shrink-0"></div>
                                                                    {r.destination}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="p-4 font-bold text-gray-900">R$ {r.price.toFixed(2)}</td>
                                                        <td className="p-4">
                                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${r.status === 'completed' ? 'bg-green-100 text-green-800' :
                                                                r.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                                                    'bg-blue-100 text-blue-800'
                                                                }`}>
                                                                {r.status === 'completed' ? 'Concluída' : r.status === 'cancelled' ? 'Cancelada' : 'Em Rota'}
                                                            </span>
                                                        </td>
                                                        <td className="p-4 text-center">
                                                            <button
                                                                onClick={() => setSelectedRide(r)}
                                                                className="text-gray-400 hover:text-orange-600 transition-colors p-2 rounded-full hover:bg-orange-50"
                                                            >
                                                                <ArrowRight size={18} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            {rides.length === 0 && (
                                                <tr>
                                                    <td colSpan={6} className="p-12 text-center">
                                                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                                                            <History size={24} />
                                                        </div>
                                                        <p className="text-gray-500">Nenhuma corrida encontrada com os filtros atuais.</p>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </Card>
                        </div>
                    )}
                </main>
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

            {/* Modal for User Editing */}
            {userModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in">
                    <Card className="w-full max-w-md p-6 bg-white animate-slide-up">
                        <h3 className="text-lg font-bold mb-4">{editingUser ? 'Editar Colaborador' : 'Novo Colaborador'}</h3>
                        <div className="space-y-4">
                            <Input label="Nome Completo" value={userData.name} onChange={(e: any) => setUserData({ ...userData, name: e.target.value })} placeholder="Ex: João Silva" />
                            <Input label="Email Corporativo" value={userData.email} onChange={(e: any) => setUserData({ ...userData, email: e.target.value })} placeholder="joao@empresa.com" />
                            <Input label="Telefone" value={userData.phone} onChange={(e: any) => setUserData({ ...userData, phone: e.target.value })} placeholder="(11) 99999-9999" />
                            {!editingUser && (
                                <Input label="Senha de Acesso" type="password" value={userData.password} onChange={(e: any) => setUserData({ ...userData, password: e.target.value })} placeholder="******" />
                            )}

                            {/* Profile Picture Upload Placeholder */}
                            <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center">
                                <p className="text-xs text-gray-500 mb-2">Foto de Perfil (Opcional)</p>
                                <Button variant="outline" className="py-1 px-3 text-xs h-auto" onClick={() => alert('Simulação: Upload de foto')}>
                                    <Camera size={14} className="mr-2" /> Carregar Foto
                                </Button>
                            </div>

                            {/* Password Management */}
                            {editingUser && (
                                <div className="mt-4 pt-4 border-t border-gray-200">
                                    <h4 className="text-sm font-bold text-gray-700 mb-2">Segurança</h4>
                                    <Button variant="outline" className="w-full text-red-600 border-red-200 hover:bg-red-50 py-1 px-3 text-xs h-auto" onClick={() => alert('Simulação: Email de redefinição enviado.')}>
                                        <Lock size={14} className="mr-2" /> Redefinir Senha
                                    </Button>
                                </div>
                            )}
                        </div>
                        <div className="mt-8 flex justify-end gap-3">
                            <Button variant="outline" onClick={() => setUserModalOpen(false)}>Cancelar</Button>
                            <Button onClick={handleSaveUser}>{editingUser ? 'Salvar Alterações' : 'Criar Colaborador'}</Button>
                        </div>
                    </Card>
                </div>
            )}

            {/* Password Reset Modal (Initial Login) goes here, same as before... */}
            {showPasswordReset && (
                <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                    <Card className="max-w-md w-full p-8 animate-slide-up relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-2 bg-orange-500"></div>
                        <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                            <Lock size={32} />
                        </div>
                        <h2 className="text-2xl font-bold text-center text-gray-800 mb-2">Redefinir Senha</h2>
                        <p className="text-center text-gray-500 mb-8">Você está utilizando uma senha temporária. Por segurança, defina uma nova senha.</p>
                        <div className="space-y-4">
                            <Input type="password" label="Nova Senha" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                            <Input type="password" label="Confirmar Senha" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                        </div>
                        <Button className="w-full mt-8 py-3" onClick={handlePasswordReset}>{savingPassword ? 'Salvando...' : 'Salvar Nova Senha'}</Button>
                    </Card>
                </div>
            )}
        </div>
    );
};
