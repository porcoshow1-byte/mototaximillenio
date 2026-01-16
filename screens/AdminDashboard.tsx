import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard, Users, Bike, Settings, FileText, Bell, Search,
  TrendingUp, MoreVertical, LogOut, Map, Filter, ChevronDown, ArrowUpDown,
  Loader2, RefreshCcw, AlertTriangle, Download, Calendar, CheckSquare, Square,
  X, Phone, Car, Star, Shield, Plus, History, MessageSquare, Send, ChevronRight, ChevronLeft,
  Leaf, Building2, DollarSign, Calculator, GripVertical, MapPin, Package, Navigation, Clock, Route,
  AlertCircle, CheckCircle, Paperclip, Trash2, Edit2, Zap, Mail, Share2, Palette, Image as ImageIcon, Smartphone, LifeBuoy
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line, ResponsiveContainer } from 'recharts';
import { Card, Button, Badge, Input } from '../components/UI';
import { fetchDashboardData, DashboardData } from '../services/admin';
import { updateUserProfile } from '../services/user';
import { getAllCompanies, saveCompany } from '../services/company';
import { subscribeToTickets, SupportTicket } from '../services/support';
import { db, isMockMode } from '../services/firebase';
import { playSound } from '../services/audio';
import { CompanyDashboard } from './CompanyDashboard';
import { SimulatedMap } from '../components/SimulatedMap';
import { Driver, RideRequest, User } from '../types';
import { useJsApiLoader } from '@react-google-maps/api';
import { APP_CONFIG } from '../constants';
import { collection, getDocs, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { getSettings, saveSettings, SystemSettings } from '../services/settings';
import { sendEmail, testSMTPConnection } from '../services/email';

const libraries: ("places" | "geometry")[] = ['places', 'geometry'];

export const RechartsWrapper = ({ children }: { children?: React.ReactNode }) => (
  <div style={{ width: '100%', height: 300 }}>
    <ResponsiveContainer width="100%" height="100%">
      {children as any}
    </ResponsiveContainer>
  </div>
);

const SimpleTooltip = ({ content, children }: { content: string, children?: React.ReactNode }) => (
  <div className="relative group flex items-center justify-center">
    {children}
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-md">
      {content}
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
    </div>
  </div>
);

// --- Subcomponent: Driver Details Modal ---
const DriverDetailModal = ({ driver, onClose }: { driver: Driver, onClose: () => void }) => {
  const [loading, setLoading] = useState(false);

  const handleAction = async (action: 'approve' | 'block') => {
    if (!confirm(`Tem certeza que deseja ${action === 'approve' ? 'APROVAR' : 'BLOQUEAR'} este motorista?`)) return;
    setLoading(true);
    try {
      await updateUserProfile(driver.id, {
        verificationStatus: action === 'approve' ? 'approved' : 'rejected',
        status: action === 'approve' ? 'offline' : 'offline' // If blocked, force offline
      });
      onClose();
      window.location.reload(); // Simple reload to refresh data
    } catch (e) {
      alert("Erro ao atualizar status");
    } finally {
      setLoading(false);
    }
  };

  if (!driver) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-slide-up max-h-[90vh] overflow-y-auto">
        <div className="bg-gray-900 p-6 flex justify-between items-start text-white">
          <div className="flex items-center gap-4">
            <div className="relative group cursor-pointer" onClick={() => alert('Alteração de foto do motorista (simulação)')}>
              <img src={driver.avatar} className="w-16 h-16 rounded-full border-2 border-white object-cover" />
              <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-white text-xs font-bold">Alterar</span>
              </div>
            </div>
            <div>
              <h2 className="text-xl font-bold">{driver.name}</h2>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <span className="flex items-center gap-1"><Star size={12} className="text-yellow-400 fill-current" /> {driver.rating}</span>
                <span>•</span>
                <span className="capitalize">{driver.status}</span>
              </div>
              <Badge color={driver.verificationStatus === 'approved' ? 'green' : driver.verificationStatus === 'rejected' ? 'red' : 'orange'}>
                {driver.verificationStatus === 'approved' ? 'Verificado' : driver.verificationStatus === 'rejected' ? 'Rejeitado' : 'Pendente'}
              </Badge>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-full transition"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-6">
          {/* CNH Verification Area */}
          {driver.verificationStatus === 'pending' && (
            <div className="bg-orange-50 border border-orange-200 p-4 rounded-xl">
              <h3 className="font-bold text-orange-800 mb-2 flex items-center gap-2"><AlertTriangle size={18} /> Verificação Pendente</h3>
              <p className="text-sm text-gray-600 mb-3">Este motorista enviou a CNH e aguarda aprovação.</p>
              {driver.cnhUrl ? (
                <div className="rounded-lg overflow-hidden border border-gray-300 mb-3">
                  <img src={driver.cnhUrl} alt="CNH" className="w-full h-auto object-contain max-h-64 bg-gray-100" />
                </div>
              ) : (
                <p className="text-red-500 text-sm italic mb-3">Nenhuma foto de CNH encontrada.</p>
              )}
              <div className="flex gap-2">
                <Button fullWidth variant="success" onClick={() => handleAction('approve')} isLoading={loading}>Aprovar Cadastro</Button>
                <Button fullWidth variant="danger" onClick={() => handleAction('block')} isLoading={loading}>Rejeitar</Button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
              <p className="text-xs text-gray-500 uppercase mb-1">Veículo</p>
              <div className="flex items-center gap-2">
                <Car size={16} className="text-orange-500" />
                <div>
                  <p className="font-bold text-gray-800">{driver.plate}</p>
                  <p className="text-xs text-gray-500">{driver.vehicle}</p>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
              <p className="text-xs text-gray-500 uppercase mb-1">Contato</p>
              <div className="flex items-center gap-2">
                <Phone size={16} className="text-green-500" />
                <p className="font-bold text-gray-800">{driver.phone || "N/A"}</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2"><FileText size={18} /> Histórico Recente</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm p-2 bg-gray-50 rounded-lg">
                <span>Faturamento Hoje</span>
                <span className="font-bold text-green-600">R$ {driver.earningsToday?.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button fullWidth variant="outline" onClick={onClose}>Fechar</Button>
            {driver.verificationStatus === 'approved' && (
              <Button fullWidth variant="danger" onClick={() => handleAction('block')} isLoading={loading}>Bloquear</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const UserDetailModal = ({ user, onClose, rides }: { user: User; onClose: () => void; rides: RideRequest[] }) => {
  const [activeTab, setActiveTab] = useState<'info' | 'history' | 'wallet'>('info');
  const [amountToAdd, setAmountToAdd] = useState('');
  const [isBlocked, setIsBlocked] = useState(user.isBlocked || false);
  const [walletBalance, setWalletBalance] = useState(user.walletBalance || 0);

  const userRides = rides.filter(r => r.passenger.id === user.id);

  const handleAddCredit = () => {
    const amount = parseFloat(amountToAdd);
    if (amount > 0) {
      const newBalance = walletBalance + amount;
      setWalletBalance(newBalance);
      setAmountToAdd('');
      alert(`R$ ${amount.toFixed(2)} adicionados com sucesso! Novo saldo: R$ ${newBalance.toFixed(2)}`);
      // TODO: Persist logic here
    }
  };

  const handleToggleBlock = () => {
    setIsBlocked(!isBlocked);
    // TODO: Persist logic here
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-xl animate-slide-up">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex justify-between items-start bg-gray-50">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-2xl font-bold overflow-hidden border-2 border-white shadow-sm">
              {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover" /> : user.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                {user.name}
                {isBlocked && <span className="bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full">Bloqueado</span>}
              </h2>
              <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                <span>ID: {user.id}</span>
                <span className="flex items-center gap-1"><Star size={12} className="text-yellow-400 fill-current" /> {user.rating}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition">
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <div className="flex border-b border-gray-100 px-6">
          <button onClick={() => setActiveTab('info')} className={`pb-3 pt-4 px-2 text-sm font-medium border-b-2 transition ${activeTab === 'info' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Dados Pessoais</button>
          <button onClick={() => setActiveTab('wallet')} className={`pb-3 pt-4 px-2 text-sm font-medium border-b-2 transition ${activeTab === 'wallet' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Carteira Digital</button>
          <button onClick={() => setActiveTab('history')} className={`pb-3 pt-4 px-2 text-sm font-medium border-b-2 transition ${activeTab === 'history' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Histórico de Corridas</button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {activeTab === 'info' && (
            <div className="space-y-4">
              {/* Avatar Upload */}
              <div className="flex justify-center mb-4">
                <div className="relative group cursor-pointer" onClick={() => (document.getElementById('avatar-upload') as HTMLInputElement)?.click()}>
                  <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-3xl font-bold overflow-hidden border-4 border-white shadow-md">
                    {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover" /> : user.name.charAt(0)}
                  </div>
                  <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-white text-xs font-bold">Alterar</span>
                  </div>
                  <input type="file" id="avatar-upload" className="hidden" accept="image/*" onChange={() => alert('Funcionalidade de upload simulada!')} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                  <Input value={user.name} readOnly className="bg-gray-50" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                  <Input value={user.phone} readOnly className="bg-gray-50" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                  <Input value={user.email || 'Não informado'} readOnly className="bg-gray-50" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Endereço</label>
                  <Input value={user.address || 'Não informado'} readOnly className="bg-gray-50" />
                </div>
              </div>

              <div className="pt-6 border-t border-gray-100">
                <h4 className="text-sm font-bold text-gray-900 mb-3">Gerenciamento de Acesso</h4>
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <div>
                    <p className="font-medium text-gray-900">{isBlocked ? 'Usuário Bloqueado' : 'Usuário Ativo'}</p>
                    <p className="text-xs text-gray-500">{isBlocked ? 'Este usuário não pode solicitar corridas.' : 'Acesso total liberado.'}</p>
                  </div>
                  <button
                    onClick={handleToggleBlock}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${isBlocked ? 'bg-red-500 focus:ring-red-500' : 'bg-green-500 focus:ring-green-500'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isBlocked ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-6 border-t border-gray-100 flex gap-3">
                <Button
                  variant="danger"
                  className="flex-1"
                  onClick={() => {
                    if (confirm('Tem certeza que deseja EXCLUIR este passageiro? Esta ação não pode ser desfeita.')) {
                      alert('Passageiro excluído (simulação)');
                      onClose();
                    }
                  }}
                >
                  Excluir Passageiro
                </Button>
                <Button
                  variant="success"
                  className="flex-1"
                  onClick={() => {
                    alert('Alterações salvas com sucesso!');
                    onClose();
                  }}
                >
                  Salvar Alterações
                </Button>
              </div>
            </div>
          )}

          {activeTab === 'wallet' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-6 text-white shadow-lg">
                <p className="text-gray-400 text-sm mb-1">Saldo em Carteira</p>
                <h3 className="text-3xl font-bold">R$ {walletBalance.toFixed(2)}</h3>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Adicionar Crédito</label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={amountToAdd}
                    onChange={e => setAmountToAdd(e.target.value)}
                    icon={<span className="text-gray-500 font-bold">R$</span>}
                  />
                  <Button onClick={handleAddCredit}><Plus size={18} /> Adicionar</Button>
                </div>
                <p className="text-xs text-gray-500 mt-2">O valor será creditado imediatamente na conta do usuário.</p>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-3">
              {userRides.length > 0 ? (
                userRides.map(ride => (
                  <div key={ride.id} className="border border-gray-100 rounded-lg p-3 flex justify-between items-center bg-gray-50">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`w-2 h-2 rounded-full ${ride.status === 'completed' ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                        <span className="font-medium text-sm text-gray-900">{new Date(ride.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p className="text-xs text-gray-500 truncate w-48">{ride.origin} ➔ {ride.destination}</p>
                    </div>
                    <div className="text-right">
                      <span className="block font-bold text-gray-900">R$ {ride.price.toFixed(2)}</span>
                      <span className="text-[10px] uppercase font-bold text-gray-400">{ride.status}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <History size={32} className="mx-auto mb-2 opacity-50" />
                  <p>Nenhuma corrida registrada.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const AddDriverModal = ({ onClose }: { onClose: () => void }) => {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);

  const handleSendInvite = async () => {
    if (!email.trim()) return alert("Digite um e-mail válido");
    setSending(true);
    // Simulate API call
    await new Promise(r => setTimeout(r, 1500));
    setSending(false);
    alert(`Convite enviado com sucesso para ${email}!`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 animate-slide-up">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-gray-800">Adicionar Motorista</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full"><X size={20} /></button>
        </div>

        <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 mb-6">
          <p className="text-sm text-orange-800 flex items-start gap-2">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            Para garantir a segurança e a verificação de documentos (CNH), recomendamos que o motorista faça o cadastro diretamente pelo aplicativo.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Enviar Convite por E-mail</label>
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="exemplo@motorista.com"
                />
              </div>
              <Button onClick={handleSendInvite} isLoading={sending}>Enviar</Button>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100">
            <label className="block text-sm font-medium text-gray-700 mb-2">Ou compartilhe o link de cadastro</label>
            <div className="bg-gray-100 p-3 rounded-lg flex items-center justify-between font-mono text-xs text-gray-600">
              <span>{window.location.origin}/cadastro-motorista</span>
              <button
                className="text-orange-600 font-bold hover:underline"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/cadastro-motorista`);
                  alert('Link copiado!');
                }}
              >
                COPIAR
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Subcomponent: Address Input with Google Places Autocomplete ---
const AddressInput = ({
  value,
  onChange,
  placeholder,
  className
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}) => {
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!inputRef.current || !window.google || !window.google.maps || !window.google.maps.places) return;

    const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: 'br' },
      fields: ['formatted_address', 'geometry', 'name'],
    });

    // Bias to user location if available (GPS)
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        const geolocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        const circle = new window.google.maps.Circle({
          center: geolocation,
          radius: 50000 // 50km radius to cover the entire city/region
        });
        autocomplete.setBounds(circle.getBounds());
      });
    }

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (place.formatted_address) {
        onChange(place.formatted_address);
      } else if (place.name) {
        onChange(place.name);
      }
    });
  }, [onChange]); // Removed inputRef.current dependency to avoid re-binding loop, initialized once

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoComplete="off"
      className={`w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none transition-all ${className || ''}`}
    />
  );
};

// --- Subcomponent: Searching Overlay ---
const SearchingOverlay = ({ show }: { show: boolean }) => {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-[100] bg-gray-900/95 backdrop-blur-sm flex flex-col items-center justify-center text-white animate-fade-in">
      <div className="relative w-32 h-32 mb-8 flex items-center justify-center">
        <div className="absolute inset-0 bg-orange-500/30 rounded-full animate-ping"></div>
        <div className="absolute inset-2 bg-orange-500/50 rounded-full animate-pulse delay-75"></div>
        <div className="relative bg-orange-500 p-6 rounded-full shadow-lg shadow-orange-500/50">
          <Search size={40} className="text-white animate-bounce-slight" />
        </div>
      </div>
      <h2 className="text-2xl font-bold mb-2">Procurando MotoJá...</h2>
      <p className="text-gray-400 text-sm animate-pulse">Contatando motoristas próximos</p>
    </div>
  );
};

const CompanyFormModal = ({ company, onClose, onSave }: { company?: any; onClose: () => void; onSave: (data: any) => void }) => {
  const [formData, setFormData] = useState({
    name: company?.name || '',
    cnpj: company?.cnpj || '',
    email: company?.email || '',
    phone: company?.phone || '',
    creditLimit: company?.creditLimit || 1000,
    address: company?.address || '',
    // Address decomposition (initially empty or parsed if possible, simplified here)
    cep: '',
    street: '',
    number: '',
    neighborhood: '',
    city: '',
    state: '',
    complement: '',
    logoUrl: company?.logoUrl || '',
    password: '',
    confirmPassword: ''
  });

  const [loadingCep, setLoadingCep] = useState(false);

  // If editing, try to fill address fields if they adhere to the format, 
  // otherwise just leave them for manual correction (or keep main address string as fallback)
  useEffect(() => {
    if (company && company.address) {
      // Basic attempt to parse or just leave mostly empty for user to refine
      // Ideally, the backend would return structured data. For now, we respect the string.
      setFormData(prev => ({ ...prev, address: company.address }));
    }
  }, [company]);

  const handleCepBlur = async () => {
    const cep = formData.cep.replace(/\D/g, '');
    if (cep.length === 8) {
      setLoadingCep(true);
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await response.json();
        if (!data.erro) {
          setFormData(prev => ({
            ...prev,
            street: data.logradouro,
            neighborhood: data.bairro,
            city: data.localidade,
            state: data.uf,
            // Focus number field logic could go here
          }));
        } else {
          alert('CEP não encontrado.');
        }
      } catch (error) {
        console.error("Erro ao buscar CEP", error);
        alert('Erro ao buscar CEP.');
      } finally {
        setLoadingCep(false);
      }
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) return alert("Máximo 2MB");
      const reader = new FileReader();
      reader.onloadend = () => setFormData({ ...formData, logoUrl: reader.result as string });
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.cnpj || !formData.email) return alert('Preencha os campos obrigatórios (*)');

    // Password validation
    if (!company && !formData.password) return alert('Defina uma senha de acesso para a empresa');
    if (formData.password && formData.password !== formData.confirmPassword) return alert('As senhas não conferem');

    // Build the full address string from components if CEP was used, otherwise fallback to existing address field
    let fullAddress = formData.address;
    if (formData.cep && formData.street && formData.number) {
      fullAddress = `${formData.street}, ${formData.number} - ${formData.neighborhood} - ${formData.city} - ${formData.state} | CEP ${formData.cep}`;
      if (formData.complement) fullAddress += ` | Complemento: ${formData.complement}`;
    }

    onSave({
      ...formData,
      address: fullAddress,
      id: company?.id
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl p-6 animate-slide-up max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-gray-800">{company ? 'Editar Empresa' : 'Nova Empresa'}</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full"><X size={20} /></button>
        </div>

        <div className="space-y-4">
          {/* Logo */}
          <div className="flex justify-center mb-4">
            <div className="relative group cursor-pointer w-32 h-32 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center bg-gray-50 hover:border-orange-500 transition-colors overflow-hidden">
              {formData.logoUrl ? (
                <img src={formData.logoUrl} className="w-full h-full object-contain p-2" />
              ) : (
                <>
                  <ImageIcon className="text-gray-400 mb-2" />
                  <span className="text-xs text-gray-500">Upload Logo</span>
                </>
              )}
              <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" onChange={handleLogoUpload} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Empresa *</label>
              <Input value={formData.name} onChange={(e: any) => setFormData({ ...formData, name: e.target.value })} placeholder="Razão Social" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ *</label>
              <Input value={formData.cnpj} onChange={(e: any) => setFormData({ ...formData, cnpj: e.target.value })} placeholder="00.000.000/0000-00" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
              <Input value={formData.phone} onChange={(e: any) => setFormData({ ...formData, phone: e.target.value })} placeholder="(00) 0000-0000" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-mail Corporativo *</label>
            <Input value={formData.email} onChange={(e: any) => setFormData({ ...formData, email: e.target.value })} placeholder="financeiro@empresa.com" />
          </div>

          {/* Detailed Address Section */}
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-3">
            <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2"><MapPin size={16} /> Endereço</h4>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1">
                <label className="block text-xs font-medium text-gray-500 mb-1">CEP</label>
                <div className="relative">
                  <Input
                    value={formData.cep}
                    onChange={(e: any) => setFormData({ ...formData, cep: e.target.value })}
                    onBlur={handleCepBlur}
                    placeholder="00000-000"
                  />
                  {loadingCep && <div className="absolute right-3 top-2.5"><Loader2 size={16} className="animate-spin text-orange-500" /></div>}
                </div>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">Rua / Logradouro</label>
                <Input value={formData.street} onChange={(e: any) => setFormData({ ...formData, street: e.target.value })} placeholder="Av. Paulista, etc." />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1">
                <label className="block text-xs font-medium text-gray-500 mb-1">Número</label>
                <Input value={formData.number} onChange={(e: any) => setFormData({ ...formData, number: e.target.value })} placeholder="123" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">Bairro</label>
                <Input value={formData.neighborhood} onChange={(e: any) => setFormData({ ...formData, neighborhood: e.target.value })} placeholder="Centro" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">Cidade</label>
                <Input value={formData.city} onChange={(e: any) => setFormData({ ...formData, city: e.target.value })} placeholder="São Paulo" />
              </div>
              <div className="col-span-1">
                <label className="block text-xs font-medium text-gray-500 mb-1">UF</label>
                <Input value={formData.state} onChange={(e: any) => setFormData({ ...formData, state: e.target.value })} placeholder="SP" maxLength={2} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Complemento (Opcional)</label>
              <Input value={formData.complement} onChange={(e: any) => setFormData({ ...formData, complement: e.target.value })} placeholder="Apto 101, Sala 5, etc." />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Limite de Crédito Mensal (R$)</label>
            <div className="flex gap-2 items-center">
              <Input
                type="number"
                value={formData.creditLimit}
                onChange={(e: any) => setFormData({ ...formData, creditLimit: parseFloat(e.target.value) || 0 })}
                className="font-bold text-lg text-green-700"
              />
            </div>
            <div className="flex gap-2 mt-2">
              {[1000, 2000, 5000, 10000].map(val => (
                <button
                  key={val}
                  onClick={() => setFormData({ ...formData, creditLimit: val })}
                  className={`px-3 py-1 text-xs rounded-full border transition ${formData.creditLimit === val ? 'bg-green-100 border-green-500 text-green-700 font-bold' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
                >
                  R$ {val}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
            <h4 className="font-bold text-orange-800 mb-3 flex items-center gap-2">
              <Shield size={16} /> Credenciais de Acesso
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{company ? 'Nova Senha (Opcional)' : 'Senha de Acesso *'}</label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e: any) => setFormData({ ...formData, password: e.target.value })}
                  placeholder={company ? "Manter atual" : "********"}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar Senha</label>
                <Input
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e: any) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  placeholder={company ? "Manter atual" : "********"}
                />
              </div>
            </div>
            {!company && <p className="text-xs text-orange-600 mt-2">A empresa receberá um e-mail de confirmação, mas a senha definida aqui já permite acesso imediato.</p>}
          </div>

          <div className="pt-4 flex gap-3">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
            <Button onClick={handleSubmit} className="flex-1">Salvar Alterações</Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const AdminDashboard = ({ onLogout }: { onLogout?: () => void }) => {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: APP_CONFIG.googleMapsApiKey,
    libraries
  });

  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);

  // Companies Tab State
  const [companies, setCompanies] = useState<any[]>([]); // Mock list of companies
  const [showCompanyList, setShowCompanyList] = useState(false);
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState<any>(null);
  const [viewingCompanyId, setViewingCompanyId] = useState<string | null>(null);

  const handleSaveCompany = async (data: any) => {
    try {
      if (editingCompany) {
        // Update local list optimistically
        setCompanies(companies.map(c => c.id === data.id ? data : c));
        // Save to storage
        await saveCompany(data);
        alert('Empresa atualizada com sucesso!');
      } else {
        const newCompany = { ...data, id: String(Date.now()), usedCredit: 0, status: 'active' };
        // Update local list
        setCompanies([...companies, newCompany]);
        // Save to storage
        await saveCompany(newCompany);
        alert(`Empresa ${data.name} cadastrada com sucesso! Senha de acesso definida.`);
      }
      setShowCompanyModal(false);
    } catch (error) {
      console.error(error);
      alert('Erro ao salvar empresa.');
    }
  };

  useEffect(() => {
    // Load companies from shared service
    if (activeTab === 'companies') {
      const loadCompanies = async () => {
        const data = await getAllCompanies();
        setCompanies(data);
      };
      loadCompanies();
    }
  }, [activeTab]);

  // Dashboard Date Filter
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Drivers Tab State
  const [filterStatus, setFilterStatus] = useState<'all' | 'online' | 'offline' | 'busy' | 'pending'>('all');
  const [sortField, setSortField] = useState<'name' | 'rating'>('name');
  const [selectedDriverIds, setSelectedDriverIds] = useState<string[]>([]);
  const [viewDriver, setViewDriver] = useState<Driver | null>(null);
  const [viewUser, setViewUser] = useState<User | null>(null);
  const [showAddDriver, setShowAddDriver] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showDriverPanel, setShowDriverPanel] = useState(true);
  const [chatDriver, setChatDriver] = useState<Driver | null>(null);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<{ from: string, text: string, time: Date }[]>([]);

  // Notifications State
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  // Subscribe to real tickets
  const prevTicketsCountRef = React.useRef(0);

  useEffect(() => {
    const unsubscribe = subscribeToTickets((tickets) => {
      // Play sound if new tickets arrived (simple length check)
      if (prevTicketsCountRef.current > 0 && tickets.length > prevTicketsCountRef.current) {
        playSound('newRequest');
      }
      prevTicketsCountRef.current = tickets.length;

      // Convert tickets to notification format
      const ticketNotifications = tickets.map(ticket => ({
        id: ticket.id,
        type: ticket.type, // 'support_request' etc
        title: ticket.title,
        message: ticket.description,
        time: new Date(ticket.createdAt),
        read: ticket.read || ticket.status === 'resolved',
        driver: ticket.userRole === 'driver' ? ticket.userName : undefined,
        urgency: ticket.urgency,
        status: ticket.status,
        originalTicket: ticket // Keep ref
      }));

      // Merge with existing mock notifications (filtering out old duplicates if any, though IDs match ticket_xxx)
      // For this demo, we append real tickets to the hardcoded ones
      setNotifications(prev => {
        const hardcoded = prev.filter(n => !n.id.startsWith('ticket_'));
        return [...ticketNotifications, ...hardcoded].sort((a, b) => b.time.getTime() - a.time.getTime());
      });
    });
    return () => unsubscribe();
  }, []);

  // Listen for Pending Drivers (New Applications)
  const knownDriversRef = React.useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!db) return;

    // Initial fetch to populate known drivers so we don't notify for existing ones immediately (optional, or notify for all pending)
    // For now, we'll notify for any "added" event which happens on initial load for existing docs too
    // To avoid spam on reload, we could check timestamp, but simple approach is fine for now

    const q = query(collection(db, 'users'), where('role', '==', 'driver'), where('verificationStatus', '==', 'pending'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const driver = change.doc.data();
          const id = change.doc.id;

          // Avoid notifying if we already know this driver (locally) - optional
          if (!knownDriversRef.current.has(id)) {
            knownDriversRef.current.add(id);
            playSound('newRequest'); // Sound

            const newNotif = {
              id: `driver-${id}`,
              type: 'new_driver',
              title: 'Novo piloto aguardando aprovação',
              message: `${driver.name} enviou documentos.`,
              time: new Date(),
              read: false,
              driver: driver.name
            };
            setNotifications(prev => [newNotif, ...prev]);
          }
        }
      });
    });
    return () => unsubscribe();
  }, []);

  const deleteNotification = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // Occurrences filter state
  const [occurrenceSearch, setOccurrenceSearch] = useState('');
  const [occurrenceTypeFilter, setOccurrenceTypeFilter] = useState<'all' | 'ride_issue' | 'payment' | 'feedback' | 'support_request'>('all');
  const [occurrenceStatusFilter, setOccurrenceStatusFilter] = useState<'all' | 'pending' | 'resolved'>('all');
  const [occurrenceDateFrom, setOccurrenceDateFrom] = useState('');
  const [occurrenceDateTo, setOccurrenceDateTo] = useState('');
  const [selectedOccurrence, setSelectedOccurrence] = useState<any | null>(null);
  const [occurrenceTimeline, setOccurrenceTimeline] = useState<Record<string, Array<{
    id: string;
    type: 'comment' | 'status_change' | 'attachment';
    content: string;
    author: string;
    timestamp: Date;
    attachmentUrl?: string;
  }>>>({});
  const [newTimelineComment, setNewTimelineComment] = useState('');

  // Consultation/Simulation State
  const [simStep, setSimStep] = useState<'type' | 'route' | 'result'>('type');
  const [simServiceType, setSimServiceType] = useState<'ride' | 'delivery' | null>(null);
  const [simVehicle, setSimVehicle] = useState<'moto' | 'bike'>('moto');
  const [simWaypoints, setSimWaypoints] = useState<{ id: string; address: string; type: 'origin' | 'stop' | 'destination' }[]>([
    { id: 'wp1', address: '', type: 'origin' },
    { id: 'wp2', address: '', type: 'destination' }
  ]);
  const [simDraggedIndex, setSimDraggedIndex] = useState<number | null>(null);
  const [simCalculating, setSimCalculating] = useState(false);
  const [simResult, setSimResult] = useState<{ distance: number; duration: number; price: { moto: number; bike: number; } } | null>(null);
  const [simUser, setSimUser] = useState<User | null>(null);
  const [simUserSearch, setSimUserSearch] = useState('');
  const [simDeliveryMode, setSimDeliveryMode] = useState<'sending' | 'receiving'>('sending');
  const [simReceiverName, setSimReceiverName] = useState('');
  const [simReceiverPhone, setSimReceiverPhone] = useState('');
  const [showQuickRegister, setShowQuickRegister] = useState(false);
  const [newClientData, setNewClientData] = useState({
    name: '',
    phone: '',
    cpf: '',
    email: '',
    address: ''
  });

  // Multi-Call Queue System
  interface ActiveCall {
    id: string;
    protocol: string;
    client: User;
    origin: string;
    destination: string;
    waypoints: string[];
    serviceType: 'ride' | 'delivery';
    vehicle: 'moto' | 'bike';
    price: number;
    distance: number;
    duration: number;
    status: 'requesting' | 'in_progress' | 'cancelled' | 'completed';
    driver?: Driver;
    createdAt: Date;
    updatedAt: Date;
  }
  const [activeCalls, setActiveCalls] = useState<ActiveCall[]>([]);
  const [callsTab, setCallsTab] = useState<'requesting' | 'in_progress' | 'cancelled' | 'completed'>('requesting');
  const [dispatchingCall, setDispatchingCall] = useState<string | null>(null); // ID of call being animated

  // Enhanced Occurrences
  const [showNewOccurrenceModal, setShowNewOccurrenceModal] = useState(false);
  const [showSearchingOverlay, setShowSearchingOverlay] = useState(false);
  const [newOccurrence, setNewOccurrence] = useState({
    type: 'ride_issue' as 'ride_issue' | 'payment' | 'feedback' | 'accident' | 'lost_item' | 'other',
    title: '',
    message: '',
    selectedPassengerId: '' as string,
    selectedRideId: '' as string,
    priority: 'medium' as 'low' | 'medium' | 'high' | 'critical'
  });

  // Protocol generator
  const generateProtocol = (prefix: string = 'OC') => {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${dateStr}-${random}`;
  };


  // Settings State using Global Service
  const [settings, setSettings] = useState<SystemSettings>(getSettings());
  const [savingSettings, setSavingSettings] = useState(false);
  const [smtpTestResult, setSmtpTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Load latest settings on mount
  useEffect(() => {
    setSettings(getSettings());
  }, []);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    // Simulate API call
    await new Promise(r => setTimeout(r, 800));
    saveSettings(settings); // Persist to local storage via service
    setSavingSettings(false);
    alert('Configurações e Integrações salvas com sucesso!');
  };

  const handleTestSMTP = async () => {
    setSmtpTestResult(null);
    const result = await testSMTPConnection();
    setSmtpTestResult(result);
    if (result.success) alert(result.message);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchDashboardData();
      setDashboardData(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Faster refresh (5 seconds) for real-time feel on Live Map
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  // Load occurrence timeline from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('motoja_occurrence_timeline');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Convert timestamp strings back to Date objects
        const restored: typeof occurrenceTimeline = {};
        for (const [key, entries] of Object.entries(parsed)) {
          restored[key] = (entries as any[]).map(e => ({ ...e, timestamp: new Date(e.timestamp) }));
        }
        setOccurrenceTimeline(restored);
      } catch (e) {
        console.error("Failed to load occurrence timeline", e);
      }
    }
  }, []);

  // Save occurrence timeline to localStorage when it changes
  useEffect(() => {
    if (Object.keys(occurrenceTimeline).length > 0) {
      localStorage.setItem('motoja_occurrence_timeline', JSON.stringify(occurrenceTimeline));
    }
  }, [occurrenceTimeline]);

  // Function to add timeline entry
  const addTimelineEntry = (occurrenceId: string, type: 'comment' | 'status_change' | 'attachment', content: string, attachmentUrl?: string) => {
    const entry = {
      id: `te-${Date.now()}`,
      type,
      content,
      author: 'Admin',
      timestamp: new Date(),
      attachmentUrl
    };
    setOccurrenceTimeline(prev => ({
      ...prev,
      [occurrenceId]: [...(prev[occurrenceId] || []), entry]
    }));
  };

  const deleteTimelineEntry = (occurrenceId: string, entryId: string) => {
    if (confirm('Tem certeza que deseja excluir este item?')) {
      setOccurrenceTimeline(prev => ({
        ...prev,
        [occurrenceId]: prev[occurrenceId].filter(e => e.id !== entryId)
      }));
    }
  };

  const editTimelineEntry = (occurrenceId: string, entryId: string, newContent: string) => {
    setOccurrenceTimeline(prev => ({
      ...prev,
      [occurrenceId]: prev[occurrenceId].map(e => e.id === entryId ? { ...e, content: newContent } : e)
    }));
  };

  const SidebarItem = ({ id, icon, label, badge }: { id: string, icon: React.ReactNode, label: string, badge?: number }) => (
    <div
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all mb-1 ${activeTab === id ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
    >
      {icon}
      <span className="font-medium flex-1">{label}</span>
      {badge && badge > 0 && (
        <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${activeTab === id ? 'bg-white text-orange-500' : 'bg-red-500 text-white'}`}>
          {badge}
        </span>
      )}
    </div>
  );

  if (loading && !dashboardData) {
    return <div className="h-screen flex items-center justify-center bg-gray-50 text-orange-500"><Loader2 size={48} className="animate-spin" /></div>;
  }

  if (viewingCompanyId) {
    return <CompanyDashboard companyId={viewingCompanyId} onBack={() => setViewingCompanyId(null)} />;
  }

  // Fallback se não houver dados
  const safeData: DashboardData = dashboardData || {
    stats: { totalRides: 0, revenue: 0, activeDrivers: 0, pendingRides: 0 },
    chartData: [],
    drivers: [],
    passengers: [],
    recentRides: []
  };

  // --- Logic for Filters & Actions ---

  // 1. Date Filtering for Recent Rides
  const filteredRides = safeData.recentRides.filter(ride => {
    if (!ride.createdAt) return true;
    const rideDate = new Date(ride.createdAt);

    // Reset hours for comparison
    const start = startDate ? new Date(startDate) : null;
    if (start) start.setHours(0, 0, 0, 0);

    const end = endDate ? new Date(endDate) : null;
    if (end) end.setHours(23, 59, 59, 999);

    if (start && rideDate < start) return false;
    if (end && rideDate > end) return false;
    return true;
  });

  // 2. Driver Filtering & Sorting
  const filteredDrivers = safeData.drivers
    .filter(d => {
      if (filterStatus === 'all') return true;
      if (filterStatus === 'pending') return d.verificationStatus === 'pending';
      return d.status === filterStatus;
    })
    .sort((a, b) => {
      if (sortField === 'name') return a.name.localeCompare(b.name);
      return b.rating - a.rating; // Descending for rating
    });

  // 3. Bulk Selection Logic
  const handleSelectAll = () => {
    if (selectedDriverIds.length === filteredDrivers.length) {
      setSelectedDriverIds([]);
    } else {
      setSelectedDriverIds(filteredDrivers.map(d => d.id));
    }
  };

  const handleSelectDriver = (id: string) => {
    if (selectedDriverIds.includes(id)) {
      setSelectedDriverIds(selectedDriverIds.filter(sid => sid !== id));
    } else {
      setSelectedDriverIds([...selectedDriverIds, id]);
    }
  };

  const handleBulkAction = (action: 'approve' | 'block') => {
    alert(`${action === 'approve' ? 'Aprovando' : 'Bloqueando'} ${selectedDriverIds.length} motoristas.`);
    // Here you would call an API function
    setSelectedDriverIds([]);
  };

  // 4. Export Functionality
  const handleExport = (type: 'csv' | 'pdf') => {
    if (type === 'pdf') {
      alert("Exportação PDF iniciada (simulado).");
      return;
    }

    // Simple CSV implementation
    const headers = ["ID", "Passageiro", "Origem", "Destino", "Valor", "Status", "Data"];
    const rows = safeData.recentRides.map(r => [
      r.id,
      r.passenger.name,
      `"${r.origin}"`,
      `"${r.destination}"`,
      r.price.toFixed(2),
      r.status,
      new Date(r.createdAt).toLocaleDateString()
    ]);

    const csvContent = "data:text/csv;charset=utf-8,"
      + headers.join(",") + "\n"
      + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `relatorio_corridas_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Waypoint management
  const addStop = () => {
    if (simWaypoints.length >= 5) return; // origin + 3 stops + destination = 5 max
    const newId = `wp${Date.now()}`;
    const newWaypoints = [...simWaypoints];
    newWaypoints.splice(simWaypoints.length - 1, 0, { id: newId, address: '', type: 'stop' });
    setSimWaypoints(newWaypoints);
  };

  const removeStop = (index: number) => {
    if (simWaypoints[index].type !== 'stop') return;
    setSimWaypoints(simWaypoints.filter((_, i) => i !== index));
  };

  const updateWaypointAddress = (index: number, address: string) => {
    const updated = [...simWaypoints];
    updated[index].address = address;
    setSimWaypoints(updated);
  };

  // Drag and drop handlers
  const handleDragStart = (index: number) => {
    setSimDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (simDraggedIndex === null || simDraggedIndex === index) return;

    const newWaypoints = [...simWaypoints];
    const draggedItem = newWaypoints[simDraggedIndex];
    newWaypoints.splice(simDraggedIndex, 1);
    newWaypoints.splice(index, 0, draggedItem);

    // Update types based on position
    newWaypoints.forEach((wp, i) => {
      if (i === 0) wp.type = 'origin';
      else if (i === newWaypoints.length - 1) wp.type = 'destination';
      else wp.type = 'stop';
    });

    setSimWaypoints(newWaypoints);
    setSimDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setSimDraggedIndex(null);
  };

  // Calculate route using Google Maps Directions API
  const calculateRoute = () => {
    console.log("=== calculateRoute START ===");
    console.log("Settings:", settings);
    console.log("simUser:", simUser);
    console.log("simUserSearch:", simUserSearch);
    console.log("simWaypoints:", simWaypoints);
    console.log("isLoaded:", isLoaded);
    console.log("window.google:", typeof window !== 'undefined' ? !!(window as any).google : 'N/A');

    // 1. Verify if settings are configured
    if (!settings.basePrice || !settings.pricePerKm || !settings.bikeBasePrice || !settings.bikePricePerKm) {
      console.log("BLOCKED: Settings incomplete");
      alert('⚠️ Configuração de preços incompleta!\n\nPor favor, vá em "Ajustes da Plataforma" e defina todos os preços antes de simular.');
      return;
    }
    console.log("PASS: Settings OK");

    // 2. Client is required
    if (!simUser) {
      console.log("BLOCKED: No simUser");
      if (simUserSearch.trim().length > 0) {
        console.log("ACTION: Opening quick register modal for:", simUserSearch);
        // Smart UX: User typed a name but didn't register. Open modal for them.
        setNewClientData(prev => ({ ...prev, name: simUserSearch }));
        setShowQuickRegister(true);
        return; // Stop calculation to let them register
      }

      alert('⚠️ Selecione ou cadastre um cliente antes de calcular o valor.');
      return;
    }
    console.log("PASS: simUser OK:", simUser.name);

    const filledWaypoints = simWaypoints.filter(wp => wp.address.trim() !== '');
    console.log("filledWaypoints:", filledWaypoints.length, filledWaypoints.map(w => w.address));
    if (filledWaypoints.length < 2) {
      console.log("BLOCKED: Not enough waypoints");
      alert('Preencha pelo menos origem e destino');
      return;
    }
    console.log("PASS: Waypoints OK");

    // @ts-ignore - Google might not be typed in window
    if (!isLoaded || !window.google || !window.google.maps) {
      console.log("BLOCKED: Google Maps not loaded. isLoaded:", isLoaded);
      alert('API do Google Maps não carregada. Verifique sua conexão ou chave de API.');
      return;
    }
    console.log("PASS: Google Maps API OK");

    console.log(">>> Calling setSimCalculating(true) and starting Directions request...");
    setSimCalculating(true);

    const origin = filledWaypoints[0].address;
    const destination = filledWaypoints[filledWaypoints.length - 1].address;
    const intermediate = filledWaypoints.slice(1, -1).map(wp => ({
      location: wp.address,
      stopover: true
    }));

    // @ts-ignore
    const directionsService = new window.google.maps.DirectionsService();

    directionsService.route({
      origin,
      destination,
      waypoints: intermediate,
      optimizeWaypoints: false,
      // @ts-ignore
      travelMode: window.google.maps.TravelMode.DRIVING,
    }, (result: any, status: any) => {
      console.log("Directions result:", status, result);
      // @ts-ignore
      if (status === window.google.maps.DirectionsStatus.OK && result) {
        let totalDistCoords = 0;
        let totalDurationSecs = 0;

        result.routes[0].legs.forEach((leg: any) => {
          totalDistCoords += leg.distance?.value || 0;
          totalDurationSecs += leg.duration?.value || 0;
        });

        const distKm = Math.round(totalDistCoords / 100) / 10;
        const durationMin = Math.round(totalDurationSecs / 60);

        // Calculate prices for both
        const motoPrice = Math.max(settings.basePrice + (distKm * settings.pricePerKm), 0);

        let bikePrice = 0;
        if (distKm <= settings.bikeMaxDistance) {
          bikePrice = Math.max(settings.bikeBasePrice + (distKm * settings.bikePricePerKm), 0);
        } else {
          bikePrice = -1; // -1 indicates unavailable due to distance
        }

        setSimResult({
          distance: distKm,
          duration: durationMin,
          price: {
            moto: Math.round(motoPrice * 100) / 100,
            bike: bikePrice === -1 ? -1 : Math.round(bikePrice * 100) / 100
          }
        });
        setSimStep('result');
      } else {
        console.error('Directions request failed due to ' + status);
        alert('Não foi possível calcular a rota. Verifique os endereços. O Google Maps requer endereços válidos (Rua, Cidade).');
      }
      setSimCalculating(false);
    });
  };

  const resetSimulation = () => {
    setSimStep('type');
    setSimServiceType(null);
    setSimVehicle('moto');
    setSimWaypoints([
      { id: 'wp1', address: '', type: 'origin' },
      { id: 'wp2', address: '', type: 'destination' }
    ]);
    setSimResult(null);
    setSimUser(null);
    setSimUserSearch('');
    setSimDeliveryMode('sending');
    setSimReceiverName('');
    setSimReceiverPhone('');
  };

  const handleCreateOrder = () => {
    if (!simUser || !simResult) return;

    // Check maximum concurrent calls
    const activeCount = activeCalls.filter(c => c.status === 'requesting' || c.status === 'in_progress').length;
    if (activeCount >= 5) {
      alert('⚠️ Limite de 5 chamadas simultâneas atingido!\n\nAguarde uma chamada finalizar antes de criar outra.');
      return;
    }

    const finalPrice = simServiceType === 'ride' ? simResult.price.moto : (simVehicle === 'moto' ? simResult.price.moto : simResult.price.bike);
    const filledWaypoints = simWaypoints.filter(wp => wp.address.trim() !== '');

    // Create new call
    const newCall: ActiveCall = {
      id: `call-${Date.now()}`,
      protocol: generateProtocol('CH'),
      client: simUser,
      origin: filledWaypoints[0]?.address || '',
      destination: filledWaypoints[filledWaypoints.length - 1]?.address || '',
      waypoints: filledWaypoints.slice(1, -1).map(wp => wp.address),
      serviceType: simServiceType || 'ride',
      vehicle: simVehicle,
      price: finalPrice,
      distance: simResult.distance,
      duration: simResult.duration,
      status: 'requesting',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    setActiveCalls(prev => [...prev, newCall]);
    setDispatchingCall(newCall.id);

    // Simulate driver assignment after 3-8 seconds
    const assignDelay = 3000 + Math.random() * 5000;
    setTimeout(() => {
      setActiveCalls(prev => prev.map(c =>
        c.id === newCall.id
          ? { ...c, status: 'in_progress' as const, driver: safeData.drivers[Math.floor(Math.random() * safeData.drivers.length)], updatedAt: new Date() }
          : c
      ));
      setDispatchingCall(null);
    }, assignDelay);

    // Show success and reset form (but keep dispatch animation visible)
    alert(`🎉 Chamada criada!\n\nProtocolo: ${newCall.protocol}\nCliente: ${simUser.name}\nValor: R$ ${finalPrice.toFixed(2)}`);
    resetSimulation();
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
      <SearchingOverlay show={showSearchingOverlay} />
      {viewDriver && <DriverDetailModal driver={viewDriver} onClose={() => setViewDriver(null)} />}
      {showAddDriver && <AddDriverModal onClose={() => setShowAddDriver(false)} />}

      {/* Occurrence Detail Modal */}
      {/* Enhanced Occurrence Detail Modal */}
      {selectedOccurrence && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col md:flex-row">

            {/* Left Col: Details */}
            <div className="w-full md:w-1/2 p-6 overflow-y-auto border-b md:border-b-0 md:border-r border-gray-100 bg-gray-50/50">
              <div className={`p-4 rounded-xl mb-6 flex items-center gap-3 ${selectedOccurrence.type === 'ride_issue' ? 'bg-red-500' :
                selectedOccurrence.type === 'payment' ? 'bg-green-500' :
                  selectedOccurrence.type === 'accident' ? 'bg-red-600' :
                    'bg-orange-500'
                } text-white shadow-lg`}>
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                  {selectedOccurrence.type === 'ride_issue' && <AlertTriangle size={24} />}
                  {selectedOccurrence.type === 'payment' && <DollarSign size={24} />}
                  {selectedOccurrence.type === 'accident' && <AlertTriangle size={24} />}
                  {selectedOccurrence.type === 'feedback' && <Star size={24} />}
                  {!['ride_issue', 'payment', 'accident', 'feedback'].includes(selectedOccurrence.type) && <AlertCircle size={24} />}
                </div>
                <div>
                  <h3 className="font-bold text-lg leading-tight">{selectedOccurrence.title}</h3>
                  <p className="text-sm opacity-90">
                    {selectedOccurrence.id} • {selectedOccurrence.time.toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                {/* Main Description */}
                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Descrição do Incidente</h4>
                  <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm text-gray-700 leading-relaxed">
                    {selectedOccurrence.message}
                  </div>
                </div>

                {/* Ride Details Lookup */}
                {(() => {
                  // Strategy: Find ride in recentRides OR activeCalls
                  const ride = safeData.recentRides.find(r => r.id === selectedOccurrence.rideId || (selectedOccurrence.message && selectedOccurrence.message.includes(r.id)))
                    || activeCalls.find(c => c.id === selectedOccurrence.rideId);

                  // Helper to safely get strings
                  const getOrigin = (r: any) => typeof r?.origin === 'string' ? r.origin : r?.origin?.address || 'N/A';
                  const getDest = (r: any) => typeof r?.destination === 'string' ? r.destination : r?.destination?.address || 'N/A';
                  const getPhone = (r: any) => {
                    if (r?.passenger?.phone) return r.passenger.phone;
                    if (r?.client?.phone) return r.client.phone;
                    // Try finding by name in registered users
                    const pName = selectedOccurrence.passenger;
                    if (pName) {
                      const found = safeData.passengers.find(u => u.name === pName);
                      if (found) return found.phone;
                    }
                    return 'Não informado';
                  };
                  const getPassengerName = (r: any) => r?.passenger?.name || r?.client?.name || selectedOccurrence.passenger || 'N/A';
                  const getDriverName = (r: any) => r?.driver?.name || selectedOccurrence.driver || 'Não atribuído';

                  return (
                    <div className="grid grid-cols-1 gap-4">
                      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-3">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 pb-2 mb-2">Detalhes da Corrida</h4>

                        {selectedOccurrence.rideId && (
                          <div className="grid grid-cols-3 gap-2">
                            <div className="col-span-1 text-gray-500 text-xs">ID da Corrida</div>
                            <div className="col-span-2 font-mono text-sm font-bold text-gray-800">#{selectedOccurrence.rideId}</div>
                          </div>
                        )}

                        <div className="grid grid-cols-3 gap-2">
                          <div className="col-span-1 text-gray-500 text-xs">Passageiro</div>
                          <div className="col-span-2 text-sm font-medium text-gray-900">
                            {getPassengerName(ride)}
                            <div className="text-gray-400 text-xs font-normal">{getPhone(ride)}</div>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <div className="col-span-1 text-gray-500 text-xs">Motorista</div>
                          <div className="col-span-2 text-sm font-medium text-gray-900">{getDriverName(ride)}</div>
                        </div>

                        {(ride || selectedOccurrence.rideId) && (
                          <>
                            <div className="pt-2 mt-2 border-t border-gray-50">
                              <div className="flex items-start gap-2 mb-2">
                                <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 shrink-0" />
                                <div>
                                  <div className="text-[10px] text-gray-400 uppercase">Origem</div>
                                  <div className="text-sm text-gray-700 leading-snug">{ride ? getOrigin(ride) : 'Endereço de partida não disponível'}</div>
                                </div>
                              </div>
                              <div className="flex items-start gap-2">
                                <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 shrink-0" />
                                <div>
                                  <div className="text-[10px] text-gray-400 uppercase">Destino</div>
                                  <div className="text-sm text-gray-700 leading-snug">{ride ? getDest(ride) : 'Endereço de destino não disponível'}</div>
                                </div>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Status & Actions */}
                <div className="flex flex-wrap gap-2 pt-2">
                  <div className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide ${selectedOccurrence.read ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                    {selectedOccurrence.read ? 'Status: Resolvido' : 'Status: Pendente'}
                  </div>
                  {selectedOccurrence.amount && (
                    <div className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-xs font-bold">
                      Valor: R$ {selectedOccurrence.amount.toFixed(2)}
                    </div>
                  )}
                </div>

              </div>
            </div>

            {/* Right Col: Timeline */}
            <div className="w-full md:w-1/2 flex flex-col bg-white h-[600px] md:h-auto">
              <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  <Clock size={18} className="text-gray-400" />
                  Linha do Tempo
                </h3>
                <button onClick={() => setSelectedOccurrence(null)} className="p-2 hover:bg-gray-200 rounded-full transition text-gray-500">
                  <X size={20} />
                </button>
              </div>

              {/* Feed */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/30">
                {/* Initial System Entry */}
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                    <AlertCircle size={14} className="text-gray-500" />
                  </div>
                  <div>
                    <div className="bg-white p-3 rounded-tr-xl rounded-br-xl rounded-bl-xl shadow-sm border border-gray-100">
                      <p className="text-sm text-gray-700">Ocorrência criada no sistema.</p>
                    </div>
                    <span className="text-[10px] text-gray-400 pl-1">{selectedOccurrence.time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} - Sistema</span>
                  </div>
                </div>

                {/* User Timeline Entries */}
                {(occurrenceTimeline[selectedOccurrence.id] || []).map((entry) => (
                  <div key={entry.id} className={`flex gap-3 ${entry.author === 'Admin' ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${entry.author === 'Admin' ? 'bg-orange-100' : 'bg-blue-100'}`}>
                      {entry.type === 'comment' && <MessageSquare size={14} className={entry.author === 'Admin' ? 'text-orange-600' : 'text-blue-600'} />}
                      {entry.type === 'status_change' && <CheckCircle size={14} className="text-green-600" />}
                      {entry.type === 'attachment' && <Paperclip size={14} className="text-purple-600" />}
                    </div>
                    <div className={`max-w-[85%]`}>
                      <div className={`p-3 rounded-xl shadow-sm border ${entry.author === 'Admin' ? 'bg-orange-50 border-orange-100 rounded-tr-none' : 'bg-white border-gray-100 rounded-tl-none'} group relative`}>
                        <p className="text-sm text-gray-800 whitespace-pre-wrap">{entry.content}</p>
                        {entry.attachmentUrl && (
                          <div className="mt-2 text-xs bg-black/5 p-2 rounded flex items-center gap-2 overflow-hidden max-w-[200px]">
                            <Paperclip size={12} className="shrink-0" />
                            <a href={entry.attachmentUrl} target="_blank" rel="noopener noreferrer" className="truncate hover:underline text-blue-600">{entry.attachmentUrl.split('/').pop() || 'anexo'}</a>
                          </div>
                        )}

                        {/* Actions for Admin entries */}
                        {entry.author === 'Admin' && (
                          <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-white/80 rounded p-0.5 shadow-sm">
                            {entry.type === 'comment' && (
                              <button onClick={() => {
                                const newVal = prompt("Editar comentário:", entry.content);
                                if (newVal !== null && newVal.trim()) editTimelineEntry(selectedOccurrence.id, entry.id, newVal);
                              }} className="p-1 hover:bg-blue-50 text-gray-400 hover:text-blue-500 rounded transition" title="Editar">
                                <Edit2 size={12} />
                              </button>
                            )}
                            <button onClick={() => deleteTimelineEntry(selectedOccurrence.id, entry.id)} className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded transition" title="Excluir">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                      <div className={`text-[10px] text-gray-400 mt-1 flex gap-2 ${entry.author === 'Admin' ? 'justify-end' : 'justify-start'}`}>
                        <span>{new Date(entry.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                        <span>•</span>
                        <span>{entry.author}</span>
                      </div>
                    </div>
                  </div>
                ))}

                {/* End of list spacer */}
                <div className="h-4" />
              </div>

              {/* Input Area */}
              <div className="p-4 bg-white border-t border-gray-100">
                <div className="relative">
                  <textarea
                    className="w-full pl-4 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all text-sm resize-none"
                    placeholder="Escrever atualização ou comentário..."
                    rows={3}
                    value={newTimelineComment}
                    onChange={(e) => setNewTimelineComment(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (newTimelineComment.trim()) {
                          addTimelineEntry(selectedOccurrence.id, 'comment', newTimelineComment);
                          setNewTimelineComment('');
                        }
                      }
                    }}
                  />
                  <div className="absolute top-2 right-2 flex flex-col gap-1">
                    <input
                      type="file"
                      id="timeline-file-input"
                      className="hidden"
                      accept="image/png, image/jpeg, application/pdf"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          const file = e.target.files[0];
                          // Simulate upload by using a fake URL or blob
                          const fakeUrl = URL.createObjectURL(file);
                          addTimelineEntry(selectedOccurrence.id, 'attachment', `Anexou arquivo: ${file.name}`, fakeUrl);
                        }
                      }}
                    />
                    <button
                      onClick={() => document.getElementById('timeline-file-input')?.click()}
                      className="p-1.5 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition"
                      title="Anexar arquivo (JPG, PNG, PDF)"
                    >
                      <Paperclip size={16} />
                    </button>
                  </div>
                </div>

                <div className="flex justify-between items-center mt-3">
                  {!selectedOccurrence.read ? (
                    <button
                      onClick={() => {
                        setNotifications(notifications.map(n => n.id === selectedOccurrence.id ? { ...n, read: true } : n));
                        setSelectedOccurrence({ ...selectedOccurrence, read: true });
                        addTimelineEntry(selectedOccurrence.id, 'status_change', 'Marcou a ocorrência como resolvida.');
                      }}
                      className="text-xs font-bold text-green-600 hover:text-green-700 bg-green-50 px-3 py-2 rounded-lg transition flex items-center gap-2"
                    >
                      <CheckCircle size={14} /> Marcar como Resolvido
                    </button>
                  ) : (
                    <span className="text-xs font-bold text-green-600 flex items-center gap-2">
                      <CheckCircle size={14} /> Ocorrência Resolvida
                    </span>
                  )}

                  <Button
                    onClick={() => {
                      if (newTimelineComment.trim()) {
                        addTimelineEntry(selectedOccurrence.id, 'comment', newTimelineComment);
                        setNewTimelineComment('');
                      }
                    }}
                    disabled={!newTimelineComment.trim()}
                  >
                    Enviar <Send size={14} className="ml-2" />
                  </Button>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* New Occurrence Modal */}
      {showNewOccurrenceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="p-4 bg-orange-500 text-white flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <Plus size={24} />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg">Nova Ocorrência</h3>
                <p className="text-sm opacity-80">Registrar manualmente um incidente</p>
              </div>
              <button onClick={() => setShowNewOccurrenceModal(false)} className="p-2 hover:bg-white/20 rounded-full transition">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Ocorrência *</label>
                <select
                  value={newOccurrence.type}
                  onChange={(e) => setNewOccurrence({ ...newOccurrence, type: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
                >
                  <option value="ride_issue">🚨 Problema em Corrida</option>
                  <option value="payment">💰 Pagamento</option>
                  <option value="feedback">⭐ Avaliação</option>
                  <option value="accident">🚑 Acidente</option>
                  <option value="lost_item">📦 Objeto Perdido</option>
                  <option value="other">📋 Outro</option>
                </select>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
                <Input
                  value={newOccurrence.title}
                  onChange={(e) => setNewOccurrence({ ...newOccurrence, title: e.target.value })}
                  placeholder="Resumo breve do incidente"
                />
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prioridade</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['low', 'medium', 'high', 'critical'] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setNewOccurrence({ ...newOccurrence, priority: p })}
                      className={`py-2 px-3 rounded-lg text-sm font-bold transition-all ${newOccurrence.priority === p
                        ? p === 'low' ? 'bg-blue-100 text-blue-700 border-2 border-blue-500'
                          : p === 'medium' ? 'bg-yellow-100 text-yellow-700 border-2 border-yellow-500'
                            : p === 'high' ? 'bg-orange-100 text-orange-700 border-2 border-orange-500'
                              : 'bg-red-100 text-red-700 border-2 border-red-500'
                        : 'bg-gray-100 text-gray-600 border-2 border-transparent'
                        }`}
                    >
                      {p === 'low' && 'Baixa'}
                      {p === 'medium' && 'Média'}
                      {p === 'high' && 'Alta'}
                      {p === 'critical' && 'Crítica'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Passenger/Client Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">👤 Passageiro/Cliente</label>
                <select
                  value={newOccurrence.selectedPassengerId}
                  onChange={(e) => setNewOccurrence({ ...newOccurrence, selectedPassengerId: e.target.value, selectedRideId: '' })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
                >
                  <option value="">-- Selecionar passageiro --</option>
                  {/* Passengers from safeData.passengers */}
                  {safeData.passengers.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.name} - {user.phone}
                    </option>
                  ))}
                  {/* Also include clients from manual calls who might not be in users list */}
                  {activeCalls
                    .filter(call => !safeData.passengers.some(u => u.phone === call.client.phone))
                    .map(call => (
                      <option key={`call-client-${call.id}`} value={`call-client-${call.id}`}>
                        📞 {call.client.name} - {call.client.phone}
                      </option>
                    ))}
                </select>
              </div>

              {/* Trip Selector - filtered by selected passenger */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">🚗 Viagem Relacionada (opcional)</label>
                <select
                  value={newOccurrence.selectedRideId}
                  onChange={(e) => setNewOccurrence({ ...newOccurrence, selectedRideId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
                  disabled={!newOccurrence.selectedPassengerId}
                >
                  <option value="">
                    {newOccurrence.selectedPassengerId ? '-- Selecionar viagem --' : '-- Selecione um passageiro primeiro --'}
                  </option>
                  {newOccurrence.selectedPassengerId && (
                    <>
                      {/* Manual calls for this passenger */}
                      {activeCalls
                        .filter(call =>
                          newOccurrence.selectedPassengerId === `call-client-${call.id}` ||
                          safeData.passengers.find(u => u.id === newOccurrence.selectedPassengerId)?.phone === call.client.phone
                        )
                        .map(call => (
                          <option key={call.id} value={call.id}>
                            📞 {call.protocol} - {(call.origin || '').substring(0, 25)}... → {(call.destination || '').substring(0, 20)}...
                          </option>
                        ))}
                      {/* App rides for this passenger */}
                      {safeData.recentRides
                        .filter(r => r.origin && r.passenger.id === newOccurrence.selectedPassengerId)
                        .map(ride => (
                          <option key={ride.id} value={ride.id}>
                            📱 #{ride.id} - {(ride.origin || '').substring(0, 25)}... → {(ride.destination || '').substring(0, 20)}...
                          </option>
                        ))}
                    </>
                  )}
                </select>
                {newOccurrence.selectedPassengerId &&
                  activeCalls.filter(c => newOccurrence.selectedPassengerId === `call-client-${c.id}` || safeData.passengers.find(u => u.id === newOccurrence.selectedPassengerId)?.phone === c.client.phone).length === 0 &&
                  safeData.recentRides.filter(r => r.passenger.id === newOccurrence.selectedPassengerId).length === 0 && (
                    <p className="text-xs text-gray-500 mt-1 italic">Nenhuma viagem encontrada para este passageiro</p>
                  )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição Detalhada *</label>
                <textarea
                  value={newOccurrence.message}
                  onChange={(e) => setNewOccurrence({ ...newOccurrence, message: e.target.value })}
                  placeholder="Descreva o incidente em detalhes..."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                />
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3">
              <Button variant="outline" onClick={() => setShowNewOccurrenceModal(false)} className="flex-1">
                Cancelar
              </Button>
              <Button
                disabled={!newOccurrence.title || !newOccurrence.message}
                onClick={() => {
                  const protocol = generateProtocol('OC');
                  const newNotification = {
                    id: `occ-${Date.now()}`,
                    type: newOccurrence.type,
                    title: newOccurrence.title,
                    message: newOccurrence.message,
                    time: new Date(),
                    read: false,
                    protocol,
                    priority: newOccurrence.priority,
                    rideId: newOccurrence.selectedRideId || undefined
                  };
                  setNotifications(prev => [newNotification, ...prev]);
                  alert(`✅ Ocorrência registrada!\n\nProtocolo: ${protocol}`);
                  setNewOccurrence({ type: 'ride_issue', title: '', message: '', selectedRideId: '', priority: 'medium' });
                  setShowNewOccurrenceModal(false);
                }}
                className="flex-1"
              >
                Registrar Ocorrência
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <div className="w-64 bg-gray-900 text-white flex flex-col shadow-2xl z-20 hidden md:flex">
        <div className="p-6">
          {settings.visual?.appLogoUrl ? (
            <img
              src={settings.visual.appLogoUrl}
              alt={APP_CONFIG.name}
              className="h-12 object-contain w-auto mb-2"
            />
          ) : (
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <span className="text-orange-500">Moto</span>Já
            </h1>
          )}
          <p className="text-gray-500 text-xs mt-1">Painel Administrativo v1.0</p>
        </div>

        <div className="flex-1 px-4 overflow-y-auto no-scrollbar">
          <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-3 px-2">Principal</p>
          <SidebarItem id="dashboard" icon={<LayoutDashboard size={20} />} label="Visão Geral" />
          <SidebarItem id="companies" icon={<Building2 size={20} />} label="Empresas (B2B)" />
          <SidebarItem id="consultation" icon={<Calculator size={20} />} label="Simulação / Pedido" />
          <SidebarItem id="live_map" icon={<Map size={20} />} label="Mapa ao Vivo" />

          <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-3 mt-6 px-2">Gestão</p>
          <SidebarItem id="drivers" icon={<Bike size={20} />} label="Pilotos" />
          <SidebarItem id="users" icon={<Users size={20} />} label="Passageiros" />
          <SidebarItem id="reports" icon={<FileText size={20} />} label="Relatórios" />

          <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-3 mt-6 px-2">Configuração</p>
          <SidebarItem id="settings" icon={<Settings size={20} />} label="Ajustes" />
          <SidebarItem id="integrations" icon={<Zap size={20} />} label="Integrações" />
        </div>

        <div className="p-4 border-t border-gray-800">
          <div
            className="flex items-center gap-3 cursor-pointer hover:bg-gray-800 p-2 rounded-lg transition"
            onClick={() => onLogout ? onLogout() : window.location.reload()}
          >
            <img src="https://ui-avatars.com/api/?background=random&color=fff&name=Admin" className="w-8 h-8 rounded-full" alt="Admin" />
            <div className="flex-1">
              <p className="text-sm font-bold">Admin</p>
              <p className="text-xs text-gray-500">Sair do Sistema</p>
            </div>
            <LogOut size={16} className="text-gray-500" />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Navbar */}
        <div className="bg-white h-16 border-b border-gray-200 flex items-center justify-between px-6 z-10">
          <h2 className="text-xl font-bold text-gray-800 capitalize flex items-center gap-2">
            {activeTab.replace('_', ' ')}
            {loading && <Loader2 size={16} className="animate-spin text-orange-500" />}
          </h2>
          <div className="flex items-center gap-4">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
              <input className="pl-10 pr-4 py-2 bg-gray-50 border-none rounded-lg text-sm w-64 focus:ring-2 focus:ring-orange-500 outline-none" placeholder="Buscar..." />
            </div>
            <button
              onClick={() => {
                setIsRefreshing(true);
                loadData();
                setTimeout(() => setIsRefreshing(false), 2000);
              }}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-full"
              title="Atualizar dados"
              disabled={isRefreshing}
            >
              <RefreshCcw size={20} className={isRefreshing ? 'animate-spin text-orange-500' : ''} />
            </button>

            {/* --- COMPANIES TAB CONTENT --- */}
            {activeTab === 'companies' && (
              <div className="fixed inset-0 top-16 left-64 z-10 bg-gray-100 p-8 overflow-y-auto transform transition-all duration-300">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800">Gestão de Empresas Parceiras</h2>
                    <p className="text-gray-500">Gerencie clientes corporativos e limites de crédito.</p>
                  </div>
                  <Button onClick={() => { setEditingCompany(null); setShowCompanyModal(true); }}><Plus size={20} /> Nova Empresa</Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {companies.map(company => (
                    <div key={company.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className="bg-blue-100 p-3 rounded-xl text-blue-600">
                            <Building2 size={24} />
                          </div>
                          <div>
                            <h3 className="font-bold text-lg text-gray-900">{company.name}</h3>
                            <p className="text-sm text-gray-500">{company.cnpj}</p>
                          </div>
                        </div>
                        <Badge color={company.usedCredit > company.creditLimit * 0.9 ? 'red' : 'green'}>{company.usedCredit > company.creditLimit * 0.9 ? 'Limite Crítico' : 'Ativo'}</Badge>
                      </div>

                      <div className="space-y-3 mb-6">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Limite de Crédito</span>
                          <span className="font-bold">R$ {company.creditLimit.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Utilizado</span>
                          <span className="font-bold text-gray-800">R$ {company.usedCredit.toFixed(2)}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                          <div className="bg-blue-600 h-full rounded-full" style={{ width: `${(company.usedCredit / company.creditLimit) * 100}%` }}></div>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <Button fullWidth variant="outline" onClick={() => { setEditingCompany(company); setShowCompanyModal(true); }}>Editar</Button>
                        <Button fullWidth onClick={() => setViewingCompanyId(company.id)}>Ver Painel</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notifications Bell */}
            <div className="flex items-center gap-3">
              <span className={`px-2 py-1 rounded text-xs font-bold ${isMockMode || !db ? 'bg-yellow-500 text-black' : 'bg-blue-500 text-white'}`} title={isMockMode ? 'Variáveis de ambiente ausentes' : !db ? 'Falha na conexão DB' : 'Conectado ao Firebase'}>
                {isMockMode ? 'DEMO-ENV' : !db ? 'DEMO-DB' : 'LIVE'}
              </span>
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2 text-gray-500 hover:bg-gray-100 rounded-full"
                >
                  <Bell size={20} />
                  {notifications.filter(n => !n.read).length > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-white text-[10px] flex items-center justify-center font-bold">
                      {notifications.filter(n => !n.read).length}
                    </span>
                  )}
                </button>


                {/* Notification Dropdown */}
                {showNotifications && (
                  <>
                    {/* Backdrop to close on click outside */}
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowNotifications(false)}
                    />
                    <div className="absolute right-0 top-12 w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden z-50 animate-slide-up">
                      <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                        <h3 className="font-bold text-gray-900">Notificações</h3>
                        <button
                          onClick={(e) => { e.stopPropagation(); setNotifications(notifications.map(n => ({ ...n, read: true }))); }}
                          className="text-xs text-orange-600 hover:underline"
                        >
                          Marcar todas como lidas
                        </button>
                      </div>
                      <div className="max-h-96 overflow-y-auto divide-y divide-gray-100">
                        {notifications.map(notif => (
                          <div
                            key={notif.id}
                            className={`p-4 hover:bg-gray-50 transition cursor-pointer ${!notif.read ? 'bg-orange-50/50' : ''}`}
                            onClick={() => {
                              // Mark as read
                              setNotifications(notifications.map(n => n.id === notif.id ? { ...n, read: true } : n));
                              // Close dropdown
                              setShowNotifications(false);
                              // Navigate to appropriate tab based on type
                              if (notif.type === 'new_driver') {
                                setActiveTab('drivers');
                                setFilterStatus('pending');
                              } else if (notif.type === 'ride_issue' || notif.type === 'payment' || notif.type === 'feedback') {
                                setActiveTab('occurrences');
                              } else if (notif.type === 'system') {
                                setActiveTab('settings');
                              }
                            }}
                          >
                            <div className="flex gap-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${notif.type === 'new_driver' ? 'bg-blue-100 text-blue-600' :
                                notif.type === 'ride_issue' ? 'bg-red-100 text-red-600' :
                                  notif.type === 'payment' ? 'bg-green-100 text-green-600' :
                                    notif.type === 'feedback' ? 'bg-yellow-100 text-yellow-600' :
                                      'bg-gray-100 text-gray-600'
                                }`}>
                                {notif.type === 'new_driver' && <Users size={18} />}
                                {notif.type === 'ride_issue' && <AlertTriangle size={18} />}
                                {notif.type === 'payment' && <DollarSign size={18} />}
                                {notif.type === 'feedback' && <Star size={18} />}
                                {notif.type === 'system' && <Settings size={18} />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <p className={`text-sm ${!notif.read ? 'font-bold text-gray-900' : 'text-gray-700'}`}>{notif.title}</p>
                                  <div className="flex items-center gap-1">
                                    {!notif.read && <span className="w-2 h-2 bg-orange-500 rounded-full flex-shrink-0"></span>}
                                    <button onClick={(e) => deleteNotification(e, notif.id)} className="text-gray-400 hover:text-red-500 p-1"><Trash2 size={12} /></button>
                                  </div>
                                </div>
                                <p className="text-xs text-gray-500 mt-0.5 truncate">{notif.message}</p>
                                <p className="text-[10px] text-gray-400 mt-1">
                                  {Math.floor((Date.now() - notif.time.getTime()) / 60000) < 60
                                    ? `${Math.floor((Date.now() - notif.time.getTime()) / 60000)} min atrás`
                                    : `${Math.floor((Date.now() - notif.time.getTime()) / 3600000)} h atrás`
                                  }
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="p-3 border-t border-gray-100 bg-gray-50">
                        <button
                          onClick={() => { setShowNotifications(false); setActiveTab('occurrences'); }}
                          className="w-full text-center text-sm text-orange-600 hover:underline font-medium"
                        >
                          Ver todas as notificações
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
          {!dashboardData && !loading ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 animate-fade-in">
              <AlertTriangle size={64} className="mb-4 text-orange-200" />
              <h3 className="text-xl font-medium text-gray-600">Erro ao carregar dados</h3>
              <p className="text-sm mb-4">Verifique sua conexão ou se o banco de dados está vazio.</p>
              <Button onClick={loadData}>Tentar Novamente</Button>
            </div>
          ) : activeTab === 'dashboard' ? (
            <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card className="p-6 border-l-4 border-l-orange-500">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-gray-500 text-sm font-medium">Corridas Totais</p>
                      <h3 className="text-3xl font-bold text-gray-900 mt-1">{safeData.stats.totalRides}</h3>
                    </div>
                    <div className="bg-orange-100 p-2 rounded-lg text-orange-600">
                      <Bike size={24} />
                    </div>
                  </div>
                </Card>

                <Card className="p-6 border-l-4 border-l-blue-500">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-gray-500 text-sm font-medium">Receita Total</p>
                      <h3 className="text-3xl font-bold text-gray-900 mt-1">R$ {safeData.stats.revenue.toFixed(2)}</h3>
                    </div>
                    <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                      <DollarSign />
                    </div>
                  </div>
                </Card>

                <Card className="p-6 border-l-4 border-l-green-500">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-gray-500 text-sm font-medium">Pilotos Online</p>
                      <h3 className="text-3xl font-bold text-gray-900 mt-1">{safeData.stats.activeDrivers}</h3>
                    </div>
                    <div className="bg-green-100 p-2 rounded-lg text-green-600">
                      <Users size={24} />
                    </div>
                  </div>
                </Card>

                <Card className="p-6 border-l-4 border-l-red-500">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-gray-500 text-sm font-medium">Pendentes</p>
                      <h3 className="text-3xl font-bold text-gray-900 mt-1">{safeData.stats.pendingRides}</h3>
                    </div>
                    <div className="bg-red-100 p-2 rounded-lg text-red-600">
                      <FileText size={24} />
                    </div>
                  </div>
                </Card>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-6">
                  <h3 className="text-lg font-bold mb-6">Volume de Corridas (7 dias)</h3>
                  <RechartsWrapper>
                    <BarChart data={safeData.chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} />
                      <YAxis axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                      <Bar dataKey="rides" fill="#f97316" radius={[4, 4, 0, 0]} barSize={30} />
                    </BarChart>
                  </RechartsWrapper>
                </Card>

                <Card className="p-6">
                  <h3 className="text-lg font-bold mb-6">Faturamento (R$)</h3>
                  <RechartsWrapper>
                    <LineChart data={safeData.chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} />
                      <YAxis axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                      <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 8 }} />
                    </LineChart>
                  </RechartsWrapper>
                </Card>
              </div>

              {/* Recent Activity Table with Date Filters */}
              <Card className="overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <h3 className="text-lg font-bold">Corridas Recentes</h3>

                  {/* Date Filter Inputs */}
                  <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg">
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <Calendar size={16} />
                      <span>De:</span>
                      <input type="date" className="bg-transparent border-none outline-none text-xs" value={startDate} onChange={e => setStartDate(e.target.value)} />
                    </div>
                    <div className="w-px h-4 bg-gray-300"></div>
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <span>Até:</span>
                      <input type="date" className="bg-transparent border-none outline-none text-xs" value={endDate} onChange={e => setEndDate(e.target.value)} />
                    </div>
                    {(startDate || endDate) && (
                      <button onClick={() => { setStartDate(''); setEndDate(''); }} className="text-red-500 hover:bg-red-50 p-1 rounded">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-600">
                    <thead className="bg-gray-50 text-gray-900 font-semibold">
                      <tr>
                        <th className="p-4">ID</th>
                        <th className="p-4">Origem &rarr; Destino</th>
                        <th className="p-4">Passageiro</th>
                        <th className="p-4">Status</th>
                        <th className="p-4">Valor</th>
                        <th className="p-4">Data</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredRides.length === 0 ? (
                        <tr><td colSpan={6} className="p-4 text-center text-gray-400">Nenhuma corrida encontrada no período.</td></tr>
                      ) : (
                        filteredRides.map((ride) => (
                          <tr key={ride.id} className="hover:bg-gray-50 transition">
                            <td className="p-4 font-mono text-xs">#{ride.id.substring(0, 6)}</td>
                            <td className="p-4">
                              <div className="max-w-[200px] truncate" title={`${ride.origin} -> ${ride.destination}`}>
                                {ride.origin.split(',')[0]} &rarr; {ride.destination.split(',')[0]}
                              </div>
                            </td>
                            <td className="p-4 flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-gray-200 overflow-hidden">
                                <img src={ride.passenger?.avatar || `https://ui-avatars.com/api/?name=${ride.passenger?.name || 'U'}`} alt="" className="w-full h-full object-cover" />
                              </div>
                              <span>{ride.passenger?.name?.split(' ')[0] || 'Usuario'}</span>
                            </td>
                            <td className="p-4">
                              <Badge color={
                                ride.status === 'completed' ? 'green' :
                                  ride.status === 'cancelled' ? 'red' :
                                    ride.status === 'in_progress' ? 'blue' : 'orange'
                              }>
                                {ride.status === 'completed' ? 'Concluído' :
                                  ride.status === 'cancelled' ? 'Cancelado' :
                                    ride.status === 'in_progress' ? 'Em andamento' : 'Pendente'}
                              </Badge>
                            </td>
                            <td className="p-4 font-bold text-gray-900">R$ {ride.price?.toFixed(2)}</td>
                            <td className="p-4 text-xs text-gray-400">
                              {ride.createdAt ? new Date(ride.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          ) : activeTab === 'live_map' ? (
            <div className="h-full flex gap-4 animate-fade-in relative">
              {/* Map Container */}
              <div className="flex-1 rounded-2xl overflow-hidden shadow-2xl relative border border-gray-200">
                <div className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur p-4 rounded-xl shadow-lg border-l-4 border-green-500 max-w-xs">
                  <h3 className="font-bold text-gray-900 mb-1">Mapa ao Vivo</h3>
                  <p className="text-sm text-gray-500 mb-3">Monitorando {safeData.drivers.filter(d => d.status === 'online').length} pilotos online em tempo real.</p>
                  <div className="flex gap-3">
                    <div className="flex items-center gap-1 text-xs"><div className="w-2 h-2 rounded-full bg-green-500"></div> Online</div>
                    <div className="flex items-center gap-1 text-xs"><div className="w-2 h-2 rounded-full bg-yellow-500"></div> Ocupado</div>
                    <div className="flex items-center gap-1 text-xs"><div className="w-2 h-2 rounded-full bg-gray-400"></div> Offline</div>
                  </div>
                </div>

                {/* Toggle Panel Button */}
                <button
                  onClick={() => setShowDriverPanel(!showDriverPanel)}
                  className="absolute top-4 right-4 z-10 bg-white p-2 rounded-lg shadow-lg hover:bg-gray-50 transition"
                  title={showDriverPanel ? 'Ocultar painel' : 'Mostrar pilotos'}
                >
                  {showDriverPanel ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
                </button>

                <SimulatedMap drivers={safeData.drivers} />
              </div>

              {/* Driver List Panel - Collapsible */}
              <div className={`bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden flex flex-col transition-all duration-300 ${showDriverPanel ? 'w-80 opacity-100' : 'w-0 opacity-0 overflow-hidden'}`}>
                <div className="p-4 border-b border-gray-100 bg-gray-50">
                  <h3 className="font-bold text-gray-900">Pilotos ({safeData.drivers.length})</h3>
                  <p className="text-xs text-gray-500">{safeData.drivers.filter(d => d.status === 'online').length} online agora</p>
                </div>
                <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
                  {safeData.drivers.map(driver => (
                    <div key={driver.id} className="p-3 hover:bg-gray-50 transition cursor-pointer group">
                      <div className="flex items-center gap-3">
                        <div className="relative" onClick={() => setViewDriver(driver)}>
                          <img src={driver.avatar || `https://ui-avatars.com/api/?name=${driver.name}`} className="w-10 h-10 rounded-full object-cover" />
                          <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${driver.status === 'online' ? 'bg-green-500' : driver.status === 'busy' ? 'bg-yellow-500' : 'bg-gray-400'}`}></span>
                        </div>
                        <div className="flex-1 min-w-0" onClick={() => setViewDriver(driver)}>
                          <div className="flex items-center gap-1.5">
                            <p className="font-medium text-gray-900 text-sm truncate">{driver.name}</p>
                            {driver.vehicle?.toLowerCase().includes('bike') || driver.vehicle?.toLowerCase().includes('bicicleta')
                              ? <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18.5" cy="17.5" r="3.5" /><circle cx="5.5" cy="17.5" r="3.5" /><circle cx="15" cy="5" r="1" /><path d="M12 17.5V14l-3-3 4-3 2 3h2" /></svg>
                              : <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#ea580c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 17.5c0 1.4 1.1 2.5 2.5 2.5s2.5-1.1 2.5-2.5-1.1-2.5-2.5-2.5-2.5 1.1-2.5 2.5z" /><path d="M15 17.5c0 1.4 1.1 2.5 2.5 2.5s2.5-1.1 2.5-2.5-1.1-2.5-2.5-2.5-2.5 1.1-2.5 2.5z" /><path d="M6.5 15l2-5h6l2.5 5" /><path d="M15 10l-2-4h4l1 2" /><path d="M9.5 10l1.5 5" /></svg>
                            }
                          </div>
                          <p className="text-xs text-gray-400">{driver.vehicle || 'Moto'} • ⭐ {driver.rating}</p>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                          <button
                            onClick={(e) => { e.stopPropagation(); setChatDriver(driver); setChatHistory([]); }}
                            className="p-2 rounded-full bg-orange-100 text-orange-600 hover:bg-orange-200"
                            title="Enviar mensagem"
                          >
                            <MessageSquare size={14} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); window.open(`tel:${driver.phone || '11999999999'}`); }}
                            className="p-2 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200"
                            title="Ligar"
                          >
                            <Phone size={14} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); window.open(`https://wa.me/55${(driver.phone || '11999999999').replace(/\D/g, '')}`, '_blank'); }}
                            className="p-2 rounded-full bg-green-100 text-green-600 hover:bg-green-200"
                            title="WhatsApp"
                          >
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chat Modal */}
              {chatDriver && (
                <div className="absolute bottom-4 right-4 w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col animate-slide-up z-20">
                  <div className="p-3 border-b border-gray-100 bg-gray-900 text-white flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <img src={chatDriver.avatar || `https://ui-avatars.com/api/?name=${chatDriver.name}`} className="w-8 h-8 rounded-full" />
                      <div>
                        <p className="font-medium text-sm">{chatDriver.name}</p>
                        <p className="text-xs text-gray-400">{chatDriver.status === 'online' ? 'Online' : 'Offline'}</p>
                      </div>
                    </div>
                    <button onClick={() => setChatDriver(null)} className="p-1 hover:bg-gray-800 rounded"><X size={18} /></button>
                  </div>
                  <div className="flex-1 h-48 overflow-y-auto p-3 space-y-2 bg-gray-50">
                    {chatHistory.length === 0 ? (
                      <p className="text-center text-gray-400 text-sm py-8">Inicie uma conversa</p>
                    ) : (
                      chatHistory.map((msg, i) => (
                        <div key={i} className={`flex ${msg.from === 'admin' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[80%] p-2 rounded-lg text-sm ${msg.from === 'admin' ? 'bg-orange-500 text-white' : 'bg-white border border-gray-200'}`}>
                            {msg.text}
                            <div className={`text-[10px] mt-1 ${msg.from === 'admin' ? 'text-orange-200' : 'text-gray-400'}`}>
                              {msg.time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="p-3 border-t border-gray-100 flex gap-2">
                    <input
                      type="text"
                      value={chatMessage}
                      onChange={(e) => setChatMessage(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && chatMessage.trim()) {
                          setChatHistory([...chatHistory, { from: 'admin', text: chatMessage.trim(), time: new Date() }]);
                          setChatMessage('');
                          setTimeout(() => {
                            setChatHistory(prev => [...prev, { from: 'driver', text: 'Mensagem recebida! 👍', time: new Date() }]);
                          }, 1000);
                        }
                      }}
                      placeholder="Digite uma mensagem..."
                      className="flex-1 p-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-500"
                    />
                    <button
                      onClick={() => {
                        if (chatMessage.trim()) {
                          setChatHistory([...chatHistory, { from: 'admin', text: chatMessage.trim(), time: new Date() }]);
                          setChatMessage('');
                          setTimeout(() => {
                            setChatHistory(prev => [...prev, { from: 'driver', text: 'Mensagem recebida! 👍', time: new Date() }]);
                          }, 1000);
                        }
                      }}
                      className="p-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition"
                    >
                      <Send size={18} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : activeTab === 'drivers' ? (
            <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800">Gerenciar Pilotos</h2>
                <Button className="py-2" onClick={() => setShowAddDriver(true)}>Adicionar Novo</Button>
              </div>

              <Card className="p-6">
                {/* Filters */}
                <div className="flex flex-col md:flex-row gap-4 mb-6 justify-between">
                  <div className="flex gap-2">
                    <SimpleTooltip content="Filtrar por Status">
                      <div className="relative">
                        <Filter className="absolute left-3 top-2.5 text-gray-400" size={18} />
                        <select
                          className="pl-10 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-lg appearance-none outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
                          value={filterStatus}
                          onChange={(e) => setFilterStatus(e.target.value as any)}
                        >
                          <option value="all">Todos os Status</option>
                          <option value="pending">Pendentes Aprovação</option>
                          <option value="online">Online</option>
                          <option value="busy">Ocupado</option>
                          <option value="offline">Offline</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-3 text-gray-400 pointer-events-none" size={14} />
                      </div>
                    </SimpleTooltip>
                  </div>
                </div>

                {/* Bulk Actions Bar */}
                {selectedDriverIds.length > 0 && (
                  <div className="bg-orange-50 border border-orange-200 p-3 rounded-xl mb-4 flex items-center justify-between animate-fade-in">
                    <span className="text-sm text-orange-800 font-bold ml-2">{selectedDriverIds.length} selecionados</span>
                    <div className="flex gap-2">
                      <Button variant="outline" className="py-1 px-3 h-8 text-xs bg-white" onClick={() => setSelectedDriverIds([])}>Cancelar</Button>
                      <Button variant="danger" className="py-1 px-3 h-8 text-xs" onClick={() => handleBulkAction('block')}>Bloquear</Button>
                      <Button variant="success" className="py-1 px-3 h-8 text-xs" onClick={() => handleBulkAction('approve')}>Aprovar</Button>
                    </div>
                  </div>
                )}

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-600 min-w-[800px]">
                    <thead className="bg-gray-50 text-gray-900 font-semibold border-b border-gray-200">
                      <tr>
                        <th className="p-4 w-10">
                          <button onClick={handleSelectAll} className="text-gray-400 hover:text-orange-500">
                            {selectedDriverIds.length === filteredDrivers.length && filteredDrivers.length > 0 ? <CheckSquare size={20} className="text-orange-500" /> : <Square size={20} />}
                          </button>
                        </th>
                        {/* Coluna Nome com Ordenação */}
                        <th
                          className={`p-4 whitespace-nowrap cursor-pointer hover:bg-gray-100 transition rounded-lg ${sortField === 'name' ? 'text-orange-600' : ''}`}
                          onClick={() => setSortField('name')}
                        >
                          <div className="flex items-center gap-1">
                            Piloto <ArrowUpDown size={14} />
                          </div>
                        </th>
                        <th className="p-4 whitespace-nowrap">Status</th>
                        {/* Coluna Avaliação com Ordenação */}
                        <th
                          className={`p-4 flex items-center gap-1 cursor-pointer hover:bg-gray-100 transition rounded-lg whitespace-nowrap ${sortField === 'rating' ? 'text-orange-600' : ''}`}
                          onClick={() => setSortField('rating')}
                        >
                          Avaliação <ArrowUpDown size={14} />
                        </th>
                        <th className="p-4 whitespace-nowrap">Ganhos Hoje</th>
                        <th className="p-4 whitespace-nowrap">Placa / Veículo</th>
                        <th className="p-4 text-right whitespace-nowrap">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredDrivers.map((driver) => (
                        <tr key={driver.id} className={`hover:bg-gray-50 transition group cursor-pointer ${selectedDriverIds.includes(driver.id) ? 'bg-orange-50' : ''}`} onClick={() => setViewDriver(driver)}>
                          <td className="p-4" onClick={(e) => { e.stopPropagation(); handleSelectDriver(driver.id); }}>
                            {selectedDriverIds.includes(driver.id) ? <CheckSquare size={20} className="text-orange-500" /> : <Square size={20} className="text-gray-300" />}
                          </td>
                          <td className="p-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold shrink-0 overflow-hidden">
                                {driver.avatar ? <img src={driver.avatar} className="w-full h-full object-cover" /> : driver.name.charAt(0)}
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900">{driver.name}</p>
                                <p className="text-xs text-gray-400">ID: {driver.id.substring(0, 8)}...</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 whitespace-nowrap">
                            <Badge color={driver.status === 'online' ? 'green' : driver.status === 'busy' ? 'orange' : 'gray'}>
                              {driver.status === 'online' ? 'Online' : driver.status === 'busy' ? 'Em corrida' : 'Offline'}
                            </Badge>
                          </td>
                          <td className="p-4 whitespace-nowrap">
                            <div className="flex items-center gap-1 font-medium text-gray-900">
                              <span className="text-yellow-500">★</span> {driver.rating}
                            </div>
                          </td>
                          <td className="p-4 font-mono text-gray-900 whitespace-nowrap">R$ {driver.earningsToday?.toFixed(2) || '0.00'}</td>
                          <td className="p-4 whitespace-nowrap text-xs">
                            <span className="font-bold block">{driver.plate}</span>
                            <span className="text-gray-400">{driver.vehicle}</span>
                          </td>
                          <td className="p-4 text-right whitespace-nowrap">
                            <button className="p-2 hover:bg-gray-200 rounded-full transition text-gray-400 hover:text-gray-600">
                              <MoreVertical size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredDrivers.length === 0 && (
                    <div className="p-8 text-center text-gray-500">
                      Nenhum piloto encontrado com os filtros atuais.
                    </div>
                  )}
                </div>
              </Card>
            </div>
          ) : activeTab === 'occurrences' ? (
            <div className="max-w-5xl mx-auto animate-fade-in space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">Ocorrências</h2>
                  <p className="text-gray-500 text-sm">Gerencie problemas, reclamações e incidentes</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-500">
                    {notifications.filter(n => !n.read && (n.type === 'ride_issue' || n.type === 'payment' || n.type === 'feedback')).length} pendentes
                  </span>
                  <Button onClick={() => setShowNewOccurrenceModal(true)} className="flex items-center gap-2">
                    <Plus size={18} />
                    Nova Ocorrência
                  </Button>
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="p-4 border-l-4 border-red-500">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                      <AlertTriangle size={20} className="text-red-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{notifications.filter(n => n.type === 'ride_issue').length}</p>
                      <p className="text-xs text-gray-500">Problemas em Corridas</p>
                    </div>
                  </div>
                </Card>
                <Card className="p-4 border-l-4 border-yellow-500">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                      <Star size={20} className="text-yellow-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{notifications.filter(n => n.type === 'feedback').length}</p>
                      <p className="text-xs text-gray-500">Avaliações Baixas</p>
                    </div>
                  </div>
                </Card>
                <Card className="p-4 border-l-4 border-green-500">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <DollarSign size={20} className="text-green-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{notifications.filter(n => n.type === 'payment').length}</p>
                      <p className="text-xs text-gray-500">Pagamentos Pendentes</p>
                    </div>
                  </div>
                </Card>
                <Card className="p-4 border-l-4 border-blue-500">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <LifeBuoy size={20} className="text-blue-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{notifications.filter(n => n.type === 'support_request' && !n.read).length}</p>
                      <p className="text-xs text-gray-500">Solicitações de Suporte</p>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Filters */}
              <Card className="p-4">
                <div className="flex flex-wrap gap-4 items-end">
                  <div className="flex-1 min-w-[200px]">
                    <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Buscar</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                      <input
                        type="text"
                        value={occurrenceSearch}
                        onChange={(e) => setOccurrenceSearch(e.target.value)}
                        placeholder="Buscar por título, mensagem, motorista..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Tipo</label>
                    <select
                      value={occurrenceTypeFilter}
                      onChange={(e) => setOccurrenceTypeFilter(e.target.value as any)}
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
                    >
                      <option value="all">Todos os tipos</option>
                      <option value="ride_issue">Problemas em Corridas</option>
                      <option value="payment">Pagamentos</option>
                      <option value="feedback">Avaliações</option>
                      <option value="support_request">Suporte (Pilotos)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Status</label>
                    <select
                      value={occurrenceStatusFilter}
                      onChange={(e) => setOccurrenceStatusFilter(e.target.value as any)}
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
                    >
                      <option value="all">Todos</option>
                      <option value="pending">Pendentes</option>
                      <option value="resolved">Resolvidos</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">De</label>
                    <input
                      type="date"
                      value={occurrenceDateFrom}
                      onChange={(e) => setOccurrenceDateFrom(e.target.value)}
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Até</label>
                    <input
                      type="date"
                      value={occurrenceDateTo}
                      onChange={(e) => setOccurrenceDateTo(e.target.value)}
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <button
                    onClick={() => { setOccurrenceSearch(''); setOccurrenceTypeFilter('all'); setOccurrenceStatusFilter('all'); setOccurrenceDateFrom(''); setOccurrenceDateTo(''); }}
                    className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
                  >
                    Limpar filtros
                  </button>
                </div>
              </Card>

              {/* Occurrences List */}
              <Card className="overflow-hidden">
                <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                  <h3 className="font-bold text-gray-800">
                    Lista de Ocorrências
                    <span className="font-normal text-gray-500 text-sm ml-2">
                      ({notifications
                        .filter(n => (n.type === 'ride_issue' || n.type === 'payment' || n.type === 'feedback' || n.type === 'support_request'))
                        .filter(n => occurrenceTypeFilter === 'all' || n.type === occurrenceTypeFilter)
                        .filter(n => occurrenceStatusFilter === 'all' || (occurrenceStatusFilter === 'pending' ? !n.read : n.read))
                        .filter(n => !occurrenceSearch || n.title.toLowerCase().includes(occurrenceSearch.toLowerCase()) || n.message.toLowerCase().includes(occurrenceSearch.toLowerCase()) || (n as any).driver?.toLowerCase().includes(occurrenceSearch.toLowerCase()))
                        .filter(n => !occurrenceDateFrom || n.time >= new Date(occurrenceDateFrom))
                        .filter(n => !occurrenceDateTo || n.time <= new Date(occurrenceDateTo + 'T23:59:59'))
                        .length} resultados)
                    </span>
                  </h3>
                  <button
                    onClick={() => setNotifications(notifications.map(n => ({ ...n, read: true })))}
                    className="text-xs text-orange-600 hover:underline"
                  >
                    Marcar todas como resolvidas
                  </button>
                </div>
                <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
                  {notifications
                    .filter(n => n.type === 'ride_issue' || n.type === 'payment' || n.type === 'feedback' || n.type === 'support_request')
                    .filter(n => occurrenceTypeFilter === 'all' || n.type === occurrenceTypeFilter)
                    .filter(n => occurrenceStatusFilter === 'all' || (occurrenceStatusFilter === 'pending' ? !n.read : n.read))
                    .filter(n => !occurrenceSearch || n.title.toLowerCase().includes(occurrenceSearch.toLowerCase()) || n.message.toLowerCase().includes(occurrenceSearch.toLowerCase()) || (n as any).driver?.toLowerCase().includes(occurrenceSearch.toLowerCase()))
                    .filter(n => !occurrenceDateFrom || n.time >= new Date(occurrenceDateFrom))
                    .filter(n => !occurrenceDateTo || n.time <= new Date(occurrenceDateTo + 'T23:59:59'))
                    .sort((a, b) => b.time.getTime() - a.time.getTime())
                    .map(occurrence => (
                      <div
                        key={occurrence.id}
                        className={`p-4 hover:bg-gray-50 transition ${!occurrence.read ? 'bg-orange-50/30' : ''}`}
                      >
                        <div className="flex gap-4">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${occurrence.type === 'ride_issue' ? 'bg-red-100 text-red-600' :
                            occurrence.type === 'payment' ? 'bg-green-100 text-green-600' :
                              occurrence.type === 'support_request' ? 'bg-blue-100 text-blue-600' :
                                'bg-yellow-100 text-yellow-600'
                            }`}>
                            {occurrence.type === 'ride_issue' && <AlertTriangle size={24} />}
                            {occurrence.type === 'payment' && <DollarSign size={24} />}
                            {occurrence.type === 'feedback' && <Star size={24} />}
                            {occurrence.type === 'support_request' && <LifeBuoy size={24} />}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className={`font-bold ${!occurrence.read ? 'text-gray-900' : 'text-gray-700'}`}>
                                    {occurrence.title}
                                  </h4>
                                  {!occurrence.read && (
                                    <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-[10px] font-bold rounded-full">
                                      NOVO
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-600 mb-2">{occurrence.message}</p>

                                {/* Support Ticket Extra Context */}
                                {(occurrence as any).originalTicket?.rideDetails && (
                                  <div className="mb-2 p-2 bg-gray-50 rounded border border-gray-100 text-xs">
                                    <p className="font-bold text-gray-700 flex items-center gap-1">
                                      <History size={12} /> Contexto da Corrida
                                    </p>
                                    <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-1">
                                      <span className="text-gray-500">Destino:</span> <span className="font-medium text-gray-800 truncate">{(occurrence as any).originalTicket.rideDetails.destination}</span>
                                      <span className="text-gray-500">Data:</span> <span className="font-medium text-gray-800">{new Date((occurrence as any).originalTicket.rideDetails.date).toLocaleDateString('pt-BR')}</span>
                                      <span className="text-gray-500">Valor:</span> <span className="font-medium text-green-600">R$ {(occurrence as any).originalTicket.rideDetails.price.toFixed(2)}</span>
                                    </div>
                                  </div>
                                )}

                                {(occurrence as any).originalTicket?.attachments && (occurrence as any).originalTicket.attachments.length > 0 && (
                                  <div className="mb-2 flex gap-2">
                                    {(occurrence as any).originalTicket.attachments.map((url: string, idx: number) => (
                                      <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="block w-12 h-12 rounded overflow-hidden border border-gray-200 hover:opacity-80 transition">
                                        <img src={url} alt="Anexo" className="w-full h-full object-cover" />
                                      </a>
                                    ))}
                                  </div>
                                )}

                                <p className="text-xs text-gray-400">
                                  {occurrence.time.toLocaleDateString('pt-BR')} às {occurrence.time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                              <div className="flex gap-2 flex-shrink-0">
                                <button
                                  onClick={() => setNotifications(notifications.map(n => n.id === occurrence.id ? { ...n, read: true } : n))}
                                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${occurrence.read ? 'bg-green-100 text-green-700' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
                                >
                                  {occurrence.read ? '✓ Resolvido' : 'Marcar Resolvido'}
                                </button>
                                <button
                                  className="px-3 py-1.5 text-xs font-medium bg-orange-100 hover:bg-orange-200 text-orange-700 rounded-lg transition"
                                  onClick={() => setSelectedOccurrence(occurrence)}
                                >
                                  Ver Detalhes
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  {notifications
                    .filter(n => n.type === 'ride_issue' || n.type === 'payment' || n.type === 'feedback')
                    .filter(n => occurrenceTypeFilter === 'all' || n.type === occurrenceTypeFilter)
                    .filter(n => occurrenceStatusFilter === 'all' || (occurrenceStatusFilter === 'pending' ? !n.read : n.read))
                    .filter(n => !occurrenceSearch || n.title.toLowerCase().includes(occurrenceSearch.toLowerCase()) || n.message.toLowerCase().includes(occurrenceSearch.toLowerCase()))
                    .filter(n => !occurrenceDateFrom || n.time >= new Date(occurrenceDateFrom))
                    .filter(n => !occurrenceDateTo || n.time <= new Date(occurrenceDateTo + 'T23:59:59'))
                    .length === 0 && (
                      <div className="p-12 text-center text-gray-400">
                        <AlertTriangle size={48} className="mx-auto mb-4 opacity-30" />
                        <p className="font-medium">Nenhuma ocorrência encontrada</p>
                        <p className="text-sm">Tente ajustar os filtros</p>
                      </div>
                    )}
                </div>
              </Card>
            </div>
          ) : activeTab === 'reports' ? (
            <div className="max-w-4xl mx-auto animate-fade-in">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Relatórios & Exportação</h2>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <Card className="p-6">
                  <div className="bg-orange-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                    <FileText className="text-orange-600" />
                  </div>
                  <h3 className="text-lg font-bold mb-2">Relatório de Corridas</h3>
                  <p className="text-gray-500 text-sm mb-6">Exporte o histórico completo de corridas, incluindo valores, rotas e status em formato CSV para análise em planilhas.</p>
                  <Button onClick={() => handleExport('csv')} className="w-full flex items-center justify-center gap-2">
                    <Download size={18} /> Baixar CSV
                  </Button>
                </Card>

                <Card className="p-6">
                  <div className="bg-blue-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                    <TrendingUp className="text-blue-600" />
                  </div>
                  <h3 className="text-lg font-bold mb-2">Fechamento Financeiro</h3>
                  <p className="text-gray-500 text-sm mb-6">Gere um PDF com o resumo financeiro, comissões de motoristas e faturamento da plataforma.</p>
                  <Button variant="secondary" onClick={() => handleExport('pdf')} className="w-full flex items-center justify-center gap-2">
                    <FileText size={18} /> Gerar PDF
                  </Button>
                </Card>
              </div>
            </div>
          ) : activeTab === 'consultation' ? (
            <div className="max-w-5xl mx-auto space-y-8 animate-fade-in pb-20">
              <div className="text-center space-y-2">
                <h2 className="text-3xl font-bold text-gray-800">Nova Simulação</h2>
                <p className="text-gray-500">Calcule rotas e valores para atendimento via telefone/WhatsApp</p>
              </div>

              {/* Progress Steps */}
              <div className="flex justify-center mb-8">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${simStep === 'type' ? 'bg-orange-500 text-white shadow-lg scale-110' : 'bg-green-500 text-white'
                    }`}>1</div>
                  <div className={`w-20 h-1 bg-gray-200 rounded-full overflow-hidden`}>
                    <div className={`h-full bg-green-500 transition-all duration-500 ${simStep === 'type' ? 'w-0' : 'w-full'}`} />
                  </div>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${simStep === 'route' ? 'bg-orange-500 text-white shadow-lg scale-110' : simStep === 'result' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
                    }`}>2</div>
                  <div className={`w-20 h-1 bg-gray-200 rounded-full overflow-hidden`}>
                    <div className={`h-full bg-green-500 transition-all duration-500 ${simStep === 'result' ? 'w-full' : 'w-0'}`} />
                  </div>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${simStep === 'result' ? 'bg-orange-500 text-white shadow-lg scale-110' : 'bg-gray-200 text-gray-500'
                    }`}>3</div>
                </div>
              </div>

              {simStep === 'type' && (
                <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto animate-slide-up">
                  <button
                    onClick={() => { setSimServiceType('ride'); setSimVehicle('moto'); setSimStep('route'); }}
                    className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-xl border-2 border-transparent hover:border-orange-500 transition-all group text-left"
                  >
                    <div className="bg-orange-100 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                      <Bike className="text-orange-600 w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Corrida (Mototaxi)</h3>
                    <p className="text-gray-500">Transporte de passageiros com rapidez e segurança.</p>
                  </button>

                  <button
                    onClick={() => { setSimServiceType('delivery'); setSimStep('route'); }}
                    className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-xl border-2 border-transparent hover:border-green-500 transition-all group text-left"
                  >
                    <div className="bg-green-100 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                      <Package className="text-green-600 w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Entrega (Delivery)</h3>
                    <p className="text-gray-500">Envio de encomendas e documentos via Moto ou Bike.</p>
                  </button>
                </div>
              )}

              {simStep === 'route' && (
                <div className="grid md:grid-cols-3 gap-6 animate-slide-up">
                  <div className="md:col-span-2 space-y-6">
                    <Card className="p-6">
                      <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold flex items-center gap-2">
                          <MapPin className="text-orange-500" />
                          Rota e Paradas
                        </h3>
                        {simServiceType === 'delivery' && (
                          <div className="flex bg-gray-100 p-1 rounded-lg">
                            <button
                              onClick={() => setSimVehicle('moto')}
                              className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${simVehicle === 'moto' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
                            >Moto</button>
                            <button
                              onClick={() => setSimVehicle('bike')}
                              className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${simVehicle === 'bike' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
                            >Bike</button>
                          </div>
                        )}
                      </div>

                      <div className="space-y-4">
                        {simWaypoints.map((wp, index) => (
                          <div
                            key={wp.id}
                            className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${simDraggedIndex === index ? 'opacity-50 border-orange-300 bg-orange-50' : 'border-transparent hover:border-gray-200 bg-gray-50'
                              }`}
                            draggable
                            onDragStart={() => handleDragStart(index)}
                            onDragOver={(e) => handleDragOver(e, index)}
                            onDragEnd={handleDragEnd}
                          >
                            <div className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600">
                              <GripVertical size={20} />
                            </div>

                            <div className="flex-1">
                              <div className="relative">
                                <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold px-1.5 py-0.5 rounded ${wp.type === 'origin' ? 'bg-green-100 text-green-700' :
                                  wp.type === 'destination' ? 'bg-red-100 text-red-700' :
                                    'bg-blue-100 text-blue-700'
                                  }`}>
                                  {wp.type === 'origin' ? 'A' : wp.type === 'destination' ? String.fromCharCode(65 + simWaypoints.length - 1) : String.fromCharCode(65 + index)}
                                </span>
                                <AddressInput
                                  value={wp.address}
                                  onChange={(val) => updateWaypointAddress(index, val)}
                                  placeholder={wp.type === 'origin' ? "Endereço de retirada" : wp.type === 'destination' ? "Endereço de entrega" : "Parada intermediária"}
                                  className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                                />
                              </div>
                            </div>

                            {wp.type === 'stop' && (
                              <button onClick={() => removeStop(index)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors">
                                <X size={20} />
                              </button>
                            )}
                          </div>
                        ))}

                        {simWaypoints.length < 5 && (
                          <button
                            onClick={addStop}
                            className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-gray-500 font-bold hover:border-orange-500 hover:text-orange-500 hover:bg-orange-50 transition-all flex items-center justify-center gap-2"
                          >
                            <Plus size={20} /> Adicionar Parada
                          </button>
                        )}
                      </div>
                    </Card>
                  </div>

                  <div className="space-y-6">
                    <Card className="p-6">
                      <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <Users className="text-blue-500" />
                        Cliente
                      </h3>

                      {simServiceType === 'delivery' && (
                        <div className="flex gap-2 mb-4 p-1 bg-gray-100 rounded-lg">
                          <button
                            onClick={() => setSimDeliveryMode('sending')}
                            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${simDeliveryMode === 'sending' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
                          >
                            Enviar (Entrega)
                          </button>
                          <button
                            onClick={() => setSimDeliveryMode('receiving')}
                            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${simDeliveryMode === 'receiving' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
                          >
                            Retirar (Coleta)
                          </button>
                        </div>
                      )}

                      <div className="space-y-4">
                        <div className="relative">
                          <div className="flex gap-2">
                            <Input
                              value={simUserSearch}
                              onChange={(e) => {
                                setSimUserSearch(e.target.value);
                                // Always clear selected user when typing to ensure state consistency
                                setSimUser(null);
                              }}
                              placeholder="Buscar por nome ou telefone..."
                              className="flex-1"
                            />
                            <Button
                              onClick={() => {
                                setNewClientData(prev => ({ ...prev, name: simUserSearch }));
                                setShowQuickRegister(true);
                              }}
                              className="px-4 bg-orange-500 hover:bg-orange-600 text-white"
                            >
                              <Plus />
                            </Button>
                          </div>

                          {/* Dropdown Results */}
                          {simUserSearch && !simUser && (
                            <div className="absolute top-full left-0 w-full bg-white shadow-xl rounded-xl mt-1 border border-gray-100 max-h-48 overflow-y-auto z-50">
                              {safeData.passengers && safeData.passengers
                                .filter(u => u.name.toLowerCase().includes(simUserSearch.toLowerCase()) || u.phone.includes(simUserSearch))
                                .map(user => (
                                  <div
                                    key={user.id}
                                    onClick={() => {
                                      setSimUser(user);
                                      setSimUserSearch(user.name);
                                    }}
                                    className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0"
                                  >
                                    <p className="font-bold text-sm text-gray-800">{user.name}</p>
                                    <p className="text-xs text-gray-500">{user.phone}</p>
                                  </div>
                                ))}
                              {safeData.passengers && safeData.passengers.filter(u => u.name.toLowerCase().includes(simUserSearch.toLowerCase()) || u.phone.includes(simUserSearch)).length === 0 && (
                                <div className="p-3 text-center">
                                  <p className="text-sm text-gray-400 mb-2">Nenhum cliente encontrado</p>
                                  <button
                                    onClick={() => {
                                      setNewClientData(prev => ({ ...prev, name: simUserSearch }));
                                      setShowQuickRegister(true);
                                    }}
                                    className="text-sm font-bold text-orange-500 hover:text-orange-600 hover:bg-orange-50 px-3 py-1.5 rounded-lg transition-colors w-full"
                                  >
                                    + Cadastrar "{simUserSearch}"
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Quick Register Modal */}
                        {showQuickRegister && (
                          <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
                            <div className="bg-white rounded-2xl w-full max-w-md p-6 animate-slide-up shadow-2xl overflow-y-auto max-h-[90vh]">
                              <h3 className="text-lg font-bold text-gray-900 mb-4">Novo Cliente Rápido</h3>

                              <div className="space-y-4">
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                                  <Input
                                    value={newClientData.name}
                                    onChange={(e) => setNewClientData({ ...newClientData, name: e.target.value })}
                                    placeholder="Nome do cliente"
                                    autoFocus
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Telefone / WhatsApp</label>
                                    <Input
                                      value={newClientData.phone}
                                      onChange={(e) => setNewClientData({ ...newClientData, phone: e.target.value })}
                                      placeholder="(00) 00000-0000"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">CPF</label>
                                    <Input
                                      value={newClientData.cpf}
                                      onChange={(e) => setNewClientData({ ...newClientData, cpf: e.target.value })}
                                      placeholder="000.000.000-00"
                                    />
                                  </div>
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                  <Input
                                    value={newClientData.email}
                                    onChange={(e) => setNewClientData({ ...newClientData, email: e.target.value })}
                                    placeholder="email@exemplo.com"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">Endereço (Opcional)</label>
                                  <AddressInput
                                    value={newClientData.address}
                                    onChange={(val) => setNewClientData({ ...newClientData, address: val })}
                                    placeholder="Endereço residencial"
                                  />
                                </div>

                                <div className="flex gap-3 pt-2">
                                  <Button variant="outline" onClick={() => setShowQuickRegister(false)} className="flex-1">
                                    Cancelar
                                  </Button>
                                  <Button
                                    variant="primary"
                                    disabled={!newClientData.name || !newClientData.phone}
                                    onClick={() => {
                                      // VALIDATION: Check duplicates
                                      if (safeData.passengers) {
                                        const exists = safeData.passengers.find(p =>
                                          (newClientData.cpf && p.cpf === newClientData.cpf) ||
                                          (newClientData.phone && p.phone === newClientData.phone) ||
                                          (newClientData.email && p.email === newClientData.email)
                                        );

                                        if (exists) {
                                          alert(`⚠️ Impossível cadastrar!\n\nJá existe um cliente com estes dados:\nNome: ${exists.name}\nCPF: ${exists.cpf || '-'}\nTel: ${exists.phone}`);
                                          return;
                                        }
                                      }

                                      // Save new client
                                      const newClient = {
                                        id: `u${Date.now()}`,
                                        name: newClientData.name,
                                        phone: newClientData.phone,
                                        cpf: newClientData.cpf,
                                        address: newClientData.address,
                                        email: newClientData.email || `${newClientData.name.toLowerCase().replace(/\s/g, '.')}@email.com`,
                                        type: 'passenger' as const,
                                        rating: 5.0,
                                        totalRides: 0,
                                        createdAt: new Date(),
                                        status: 'active' as const,
                                        avatar: `https://ui-avatars.com/api/?name=${newClientData.name}&background=random`
                                      };

                                      // Update dashboardData state
                                      if (dashboardData) {
                                        setDashboardData({
                                          ...dashboardData,
                                          passengers: [...dashboardData.passengers, newClient]
                                        });
                                      }

                                      // Select the new client
                                      setSimUser(newClient);
                                      setSimUserSearch(newClient.name);

                                      // Reset and close
                                      setNewClientData({ name: '', phone: '', cpf: '', email: '', address: '' });
                                      setShowQuickRegister(false);
                                    }}
                                    className="flex-1"
                                  >
                                    Salvar
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {simServiceType === 'delivery' && (
                          <div className="pt-4 border-t border-gray-100 animate-slide-up">
                            <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                              <Package size={16} className="text-orange-500" />
                              {simDeliveryMode === 'sending' ? 'Dados do Destinatário' : 'Dados do Remetente'}
                            </h4>
                            <div className="grid grid-cols-2 gap-3">
                              <Input
                                value={simReceiverName}
                                onChange={(e) => setSimReceiverName(e.target.value)}
                                placeholder="Nome"
                                icon={<Users size={14} className="text-gray-400" />}
                              />
                              <Input
                                value={simReceiverPhone}
                                onChange={(e) => setSimReceiverPhone(e.target.value)}
                                placeholder="Telefone"
                                icon={<Phone size={14} className="text-gray-400" />}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </Card>

                    <div className="flex gap-3">
                      <Button variant="outline" onClick={() => setSimStep('type')} className="flex-1">
                        Voltar
                      </Button>
                      <Button
                        onClick={calculateRoute}
                        disabled={simCalculating}
                        className="flex-[2]"
                        isLoading={simCalculating}
                      >
                        {simCalculating ? 'Calculando Rota...' : 'Calcular Valor'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {simStep === 'result' && simResult && (
                <div className="max-w-2xl mx-auto animate-fade-in">
                  <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
                    <div className="bg-gray-900 text-white p-8 text-center relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
                      <p className="text-gray-400 font-medium uppercase tracking-widest text-xs mb-2">Simulação Realizada</p>

                      {simServiceType === 'ride' ? (
                        <div className="mt-2">
                          <h2 className="text-4xl font-black mb-1">R$ {simResult.price.moto.toFixed(2)}</h2>
                          <p className="text-sm opacity-60">Mototaxi</p>
                        </div>
                      ) : (
                        <div className="flex justify-center gap-4 mt-4 relative z-10 w-full">
                          {/* Moto Option */}
                          <div
                            onClick={() => setSimVehicle('moto')}
                            className={`flex-1 p-4 rounded-xl border-2 cursor-pointer transition-all ${simVehicle === 'moto' ? 'border-orange-500 bg-white/10' : 'border-gray-700 bg-gray-800/50 hover:bg-gray-800'}`}
                          >
                            <div className="flex flex-col items-center">
                              <Bike size={24} className="text-orange-500 mb-2" />
                              <h3 className="text-2xl font-bold">R$ {simResult.price.moto.toFixed(2)}</h3>
                              <p className="text-xs text-gray-400">Entrega Moto</p>
                            </div>
                          </div>

                          {/* Bike Option */}
                          <div
                            onClick={() => simResult.price.bike !== -1 && setSimVehicle('bike')}
                            className={`flex-1 p-4 rounded-xl border-2 transition-all ${simResult.price.bike === -1 ? 'opacity-50 cursor-not-allowed border-gray-800' : simVehicle === 'bike' ? 'cursor-pointer border-green-500 bg-white/10' : 'cursor-pointer border-gray-700 bg-gray-800/50 hover:bg-gray-800'}`}
                          >
                            <div className="flex flex-col items-center">
                              <Leaf size={24} className={simResult.price.bike === -1 ? "text-gray-500 mb-2" : "text-green-500 mb-2"} />
                              {simResult.price.bike === -1 ? (
                                <>
                                  <h3 className="text-lg font-bold text-gray-400 mt-1">Indisponível</h3>
                                  <p className="text-[10px] text-gray-500 mt-1">Distância excedida</p>
                                </>
                              ) : (
                                <>
                                  <h3 className="text-2xl font-bold">R$ {simResult.price.bike.toFixed(2)}</h3>
                                  <p className="text-xs text-gray-400">Entrega Bike</p>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="p-8">
                      <div className="grid grid-cols-3 gap-4 mb-8">
                        <div className="text-center p-4 bg-gray-50 rounded-2xl">
                          <Route className="w-6 h-6 text-orange-500 mx-auto mb-2" />
                          <p className="text-xs text-gray-500 uppercase font-bold">Distância</p>
                          <p className="text-xl font-bold text-gray-900">{simResult.distance} km</p>
                        </div>
                        <div className="text-center p-4 bg-gray-50 rounded-2xl">
                          <Clock className="w-6 h-6 text-blue-500 mx-auto mb-2" />
                          <p className="text-xs text-gray-500 uppercase font-bold">Tempo</p>
                          <p className="text-xl font-bold text-gray-900">{simResult.duration} min</p>
                        </div>
                        <div className="text-center p-4 bg-gray-50 rounded-2xl">
                          <MapPin className="w-6 h-6 text-green-500 mx-auto mb-2" />
                          <p className="text-xs text-gray-500 uppercase font-bold">Paradas</p>
                          <p className="text-xl font-bold text-gray-900">{simWaypoints.filter(wp => wp.address).length}</p>
                        </div>
                      </div>

                      <div className="space-y-4 mb-8">
                        {simWaypoints.filter(wp => wp.address).map((wp, i) => (
                          <div key={wp.id} className="flex items-start gap-4">
                            <div className="flex flex-col items-center gap-1 mt-1">
                              <div className={`w-3 h-3 rounded-full ${i === 0 ? 'bg-green-500' : 'bg-gray-300'}`} />
                              {i < simWaypoints.filter(w => w.address).length - 1 && <div className="w-0.5 h-6 bg-gray-200" />}
                            </div>
                            <div>
                              <p className="text-xs text-gray-400 font-bold uppercase">
                                {i === 0 ? 'Retirada' : i === simWaypoints.filter(w => w.address).length - 1 ? 'Entrega' : 'Parada'}
                              </p>
                              <p className="font-medium text-gray-800">{wp.address}</p>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-4">
                        <Button
                          variant="outline"
                          onClick={() => setSimStep('route')}
                          fullWidth
                        >
                          Editar Rota
                        </Button>
                        <Button
                          variant="success"
                          onClick={handleCreateOrder}
                          disabled={!simUser}
                          fullWidth
                          className="py-4 text-lg"
                        >
                          {simUser ? 'Confirmar Pedido' : 'Selecione um Cliente'}
                        </Button>
                      </div>
                      {!simUser && (
                        <p className="text-center text-xs text-red-400 mt-2 font-medium">
                          * Selecione um cliente na etapa anterior para finalizar
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="text-center mt-6">
                    <button onClick={resetSimulation} className="text-gray-400 text-sm hover:text-gray-600 underline">
                      Cancelar e iniciar nova simulação
                    </button>
                  </div>
                </div>
              )}

              {/* Active Calls Panel */}
              {activeCalls.length > 0 && (
                <div className="mt-12 animate-fade-in">
                  <Card className="overflow-hidden">
                    <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                      <div>
                        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                          <Phone className="text-orange-500" size={20} />
                          Chamadas Ativas
                          <span className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">
                            {activeCalls.filter(c => c.status === 'requesting' || c.status === 'in_progress').length}
                          </span>
                        </h3>
                        <p className="text-sm text-gray-500">Gerencie pedidos manuais via telefone/WhatsApp</p>
                      </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-gray-100">
                      {(['requesting', 'in_progress', 'completed', 'cancelled'] as const).map(tab => (
                        <button
                          key={tab}
                          onClick={() => setCallsTab(tab)}
                          className={`flex-1 py-3 text-sm font-bold transition-all relative ${callsTab === tab
                            ? 'text-orange-600 bg-orange-50'
                            : 'text-gray-500 hover:bg-gray-50'
                            }`}
                        >
                          {tab === 'requesting' && '🔄 Solicitando'}
                          {tab === 'in_progress' && '🚀 Em Andamento'}
                          {tab === 'completed' && '✅ Concluído'}
                          {tab === 'cancelled' && '❌ Cancelado'}
                          <span className="ml-1 opacity-60">
                            ({activeCalls.filter(c => c.status === tab).length})
                          </span>
                          {callsTab === tab && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-500" />
                          )}
                        </button>
                      ))}
                    </div>

                    {/* Call Cards */}
                    <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
                      {activeCalls.filter(c => c.status === callsTab).length === 0 ? (
                        <p className="text-center text-gray-400 py-8">Nenhuma chamada nesta categoria</p>
                      ) : (
                        activeCalls.filter(c => c.status === callsTab).map(call => (
                          <div
                            key={call.id}
                            className={`p-4 rounded-xl border-2 transition-all ${dispatchingCall === call.id
                              ? 'border-orange-400 bg-orange-50 animate-pulse'
                              : 'border-gray-100 bg-white hover:shadow-md'
                              }`}
                          >
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <p className="font-mono text-xs text-gray-400">{call.protocol}</p>
                                <h4 className="font-bold text-gray-900">{call.client.name}</h4>
                                <p className="text-sm text-gray-500">{call.client.phone}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xl font-bold text-green-600">R$ {call.price.toFixed(2)}</p>
                                <p className="text-xs text-gray-400">{call.distance}km • {call.duration}min</p>
                              </div>
                            </div>

                            <div className="text-sm space-y-1 mb-3">
                              <p className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-green-500" />
                                <span className="text-gray-600 truncate">{call.origin}</span>
                              </p>
                              <p className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-red-500" />
                                <span className="text-gray-600 truncate">{call.destination}</span>
                              </p>
                            </div>

                            {call.driver && (
                              <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg mb-3">
                                <img src={call.driver.avatar} className="w-8 h-8 rounded-full" alt="" />
                                <div>
                                  <p className="text-sm font-bold text-gray-800">{call.driver.name}</p>
                                  <p className="text-xs text-gray-500">Motorista atribuído</p>
                                </div>
                              </div>
                            )}

                            {dispatchingCall === call.id && (
                              <div className="flex items-center justify-center gap-2 text-orange-600 py-2">
                                <Loader2 className="animate-spin" size={16} />
                                <span className="text-sm font-bold">Procurando motorista...</span>
                              </div>
                            )}

                            {call.status === 'in_progress' && (
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  onClick={() => setActiveCalls(prev => prev.map(c => c.id === call.id ? { ...c, status: 'completed', updatedAt: new Date() } : c))}
                                  className="flex-1 py-2 text-sm"
                                >
                                  ✅ Concluir
                                </Button>
                                <Button
                                  variant="danger"
                                  onClick={() => setActiveCalls(prev => prev.map(c => c.id === call.id ? { ...c, status: 'cancelled', updatedAt: new Date() } : c))}
                                  className="flex-1 py-2 text-sm"
                                >
                                  ❌ Cancelar
                                </Button>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </Card>
                </div>
              )}
            </div>
          ) : activeTab === 'settings' ? (
            <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">Ajustes da Plataforma</h2>
                  <p className="text-gray-500 text-sm">Configure taxas, preços e dados da empresa</p>
                </div>
                <Button onClick={handleSaveSettings} isLoading={savingSettings}>Salvar Alterações</Button>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Visual Customization */}
                <Card className="p-6 md:col-span-2 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 mb-6 border-b border-gray-100 pb-4">
                    <div className="bg-purple-100 p-2 rounded-lg">
                      <Palette className="text-purple-600" size={24} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Personalização Visual</h3>
                      <p className="text-sm text-gray-500">Personalize a identidade visual e tela de login do painel administrativo.</p>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-8">
                    {/* App Logo */}
                    <div className="space-y-4">
                      <label className="block text-sm font-medium text-gray-700">Logo da Aplicação</label>
                      <div className="relative h-32 w-full rounded-xl overflow-hidden border-2 border-dashed border-gray-300 bg-gray-50 group hover:border-orange-500 transition-colors cursor-pointer flex items-center justify-center shadow-sm">
                        {settings.visual?.appLogoUrl ? (
                          <img src={settings.visual.appLogoUrl} className="h-full object-contain p-2" alt="App Logo" />
                        ) : (
                          <div className="text-center text-gray-400">
                            <ImageIcon size={24} className="mx-auto mb-1 opacity-50" />
                            <span className="text-xs">Sem logo</span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white">
                          <span className="text-xs font-bold">Alterar Logo</span>
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          className="absolute inset-0 opacity-0 cursor-pointer"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              if (file.size > 1024 * 1024) { alert("O logo deve ter no máximo 1MB."); return; }
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setSettings({
                                  ...settings,
                                  visual: {
                                    ...(settings.visual || { loginBackgroundImage: '', primaryColor: '' }),
                                    appLogoUrl: reader.result as string
                                  }
                                });
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </div>
                      <p className="text-xs text-gray-400">Usado no topo do login e menu lateral.</p>
                    </div>

                    {/* Login Background */}
                    <div className="space-y-4">
                      <label className="block text-sm font-medium text-gray-700">Imagem de Fundo do Login</label>
                      <div className="relative aspect-video rounded-xl overflow-hidden border-2 border-dashed border-gray-300 bg-gray-50 group hover:border-orange-500 transition-colors cursor-pointer shadow-inner">
                        {settings.visual?.loginBackgroundImage ? (
                          <div className="relative w-full h-full group">
                            <img src={settings.visual.loginBackgroundImage} className="w-full h-full object-cover" alt="Login Background" />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm('Remover imagem de fundo do login?')) {
                                  setSettings({
                                    ...settings,
                                    visual: { ...(settings.visual || {}), loginBackgroundImage: '' }
                                  });
                                }
                              }}
                              className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 z-10"
                              title="Remover Imagem"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                            <div className="text-center">
                              <ImageIcon size={32} className="mx-auto mb-2 opacity-50" />
                              <span className="text-xs">Sem imagem selecionada</span>
                            </div>
                          </div>
                        )}
                        {!settings.visual?.loginBackgroundImage && (
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white">
                            <ImageIcon size={32} className="mb-2" />
                            <span className="text-sm font-bold">Clique para alterar imagem</span>
                            <span className="text-xs opacity-75 mt-1">Trocar Plano de Fundo</span>
                          </div>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          className="absolute inset-0 opacity-0 cursor-pointer"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              if (file.size > 3 * 1024 * 1024) {
                                alert("A imagem deve ter no máximo 3MB.");
                                return;
                              }
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setSettings({
                                  ...settings,
                                  visual: {
                                    ...(settings.visual || { appLogoUrl: '', primaryColor: '' }),
                                    loginBackgroundImage: reader.result as string
                                  }
                                });
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </div>
                      <div className="flex justify-between items-center text-xs text-gray-500">
                        <span>Recomendado: 1920x1080px (JPG/PNG)</span>
                        {settings.visual?.loginBackgroundImage?.startsWith('data:') && (
                          <span className="text-orange-600 font-bold">Nova imagem selecionada (não salva)</span>
                        )}
                      </div>
                    </div>

                    {/* Mobile Background */}
                    <div className="space-y-4">
                      <label className="block text-sm font-medium text-gray-700">Imagem de Fundo (Mobile)</label>
                      <div className="relative aspect-[9/16] w-1/2 mx-auto rounded-xl overflow-hidden border-2 border-dashed border-gray-300 bg-gray-50 group hover:border-orange-500 transition-colors cursor-pointer shadow-inner">
                        {settings.visual?.mobileBackgroundImage ? (
                          <div className="relative w-full h-full group">
                            <img src={settings.visual.mobileBackgroundImage} className="w-full h-full object-cover" alt="Mobile Background" />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm('Remover imagem de fundo mobile?')) {
                                  setSettings({
                                    ...settings,
                                    visual: { ...(settings.visual as any), mobileBackgroundImage: '' }
                                  });
                                }
                              }}
                              className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 z-10"
                              title="Remover Imagem"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                            <div className="text-center">
                              <Smartphone size={32} className="mx-auto mb-2 opacity-50" />
                              <span className="text-xs">Sem imagem mobile</span>
                            </div>
                          </div>
                        )}
                        {!settings.visual?.mobileBackgroundImage && (
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white">
                            <Smartphone size={32} className="mb-2" />
                            <span className="text-sm font-bold">Alterar Fundo Mobile</span>
                          </div>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          className="absolute inset-0 opacity-0 cursor-pointer"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              if (file.size > 2 * 1024 * 1024) { alert("A imagem deve ter no máximo 2MB."); return; }
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setSettings({
                                  ...settings,
                                  visual: {
                                    ...(settings.visual as any),
                                    mobileBackgroundImage: reader.result as string
                                  }
                                });
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </div>
                      <div className="text-center text-xs text-gray-500">
                        <span>Recomendado: 1080x1920px (Vertical)</span>
                      </div>
                    </div>

                    {/* Login Messages */}
                    <div className="space-y-4 md:col-span-2 border-t border-gray-100 pt-6">
                      <label className="block text-sm font-medium text-gray-700 uppercase tracking-wider mb-2">Mensagens de Boas-vindas</label>
                      <div className="grid md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Título Principal</label>
                          <Input
                            value={settings.visual?.loginTitle || 'MotoJá'}
                            onChange={(e) => setSettings({
                              ...settings,
                              visual: { ...(settings.visual as any), loginTitle: e.target.value }
                            })}
                            placeholder="Ex: MotoJá"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Subtítulo / Slogan</label>
                          <Input
                            value={settings.visual?.loginSubtitle || 'Gestão completa da plataforma.'}
                            onChange={(e) => setSettings({
                              ...settings,
                              visual: { ...(settings.visual as any), loginSubtitle: e.target.value }
                            })}
                            placeholder="Ex: Gestão completa..."
                          />
                        </div>
                      </div>
                    </div>

                    {/* Primary Color & Preview */}
                    <div className="space-y-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Cor de Destaque (Branding)</label>
                        <div className="flex items-center gap-3">
                          <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-gray-200 shadow-sm cursor-pointer hover:scale-105 transition-transform">
                            <input
                              type="color"
                              value={settings.visual?.primaryColor || '#f97316'}
                              onChange={(e) => setSettings({
                                ...settings,
                                visual: {
                                  ...(settings.visual || { appLogoUrl: '', loginBackgroundImage: '' }),
                                  primaryColor: e.target.value
                                }
                              })}
                              className="absolute inset-[-50%] w-[200%] h-[200%] cursor-pointer p-0 m-0 border-0"
                            />
                          </div>
                          <div className="flex-1">
                            <Input
                              value={settings.visual?.primaryColor || '#f97316'}
                              onChange={(e) => setSettings({
                                ...settings,
                                visual: {
                                  ...(settings.visual || { appLogoUrl: '', loginBackgroundImage: '' }),
                                  primaryColor: e.target.value
                                }
                              })}
                              placeholder="#000000"
                            />
                          </div>
                        </div>
                        <p className="text-xs text-gray-400 mt-2">Esta cor será utilizada em botões e destaques na tela de login do administrador.</p>
                      </div>

                      <div className="bg-gray-100 p-4 rounded-lg border border-gray-200">
                        <p className="text-xs font-bold text-gray-500 uppercase mb-2">Pré-visualização do Botão</p>
                        <button
                          className="px-4 py-2 rounded-lg text-white font-bold shadow-lg transition-transform hover:scale-105"
                          style={{ backgroundColor: settings.visual?.primaryColor || '#f97316' }}
                        >
                          Entrar no Painel
                        </button>
                      </div>
                    </div>
                  </div>
                </Card>
                {/* Moto Pricing */}
                <Card className="p-6">
                  <div className="flex items-center gap-3 mb-6 border-b border-gray-100 pb-4">
                    <div className="bg-orange-100 p-2 rounded-lg">
                      <Bike className="text-orange-600" size={24} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Preços: Mototaxi</h3>
                      <p className="text-sm text-gray-500">Configuração para corridas de moto</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Preço Base (R$)</label>
                        <Input
                          type="number"
                          value={settings.basePrice}
                          onChange={(e) => setSettings({ ...settings, basePrice: parseFloat(e.target.value) })}
                          placeholder="0.00"
                          icon={<span className="text-gray-400 text-sm">R$</span>}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Preço por KM (R$)</label>
                        <Input
                          type="number"
                          value={settings.pricePerKm}
                          onChange={(e) => setSettings({ ...settings, pricePerKm: parseFloat(e.target.value) })}
                          placeholder="0.00"
                          icon={<span className="text-gray-400 text-sm">R$</span>}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Comissão da Plataforma (%)</label>
                      <Input
                        type="number"
                        value={settings.platformFee}
                        onChange={(e) => setSettings({ ...settings, platformFee: parseFloat(e.target.value) })}
                        placeholder="0"
                        icon={<span className="text-gray-400 text-sm">%</span>}
                      />
                    </div>
                  </div>
                </Card>

                {/* Bike Pricing */}
                <Card className="p-6">
                  <div className="flex items-center gap-3 mb-6 border-b border-gray-100 pb-4">
                    <div className="bg-green-100 p-2 rounded-lg">
                      <Leaf className="text-green-600" size={24} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Preços: Bike (Entregas)</h3>
                      <p className="text-sm text-gray-500">Configuração para entregas ecológicas</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Preço Base (R$)</label>
                        <Input
                          type="number"
                          value={settings.bikeBasePrice}
                          onChange={(e) => setSettings({ ...settings, bikeBasePrice: parseFloat(e.target.value) })}
                          placeholder="0.00"
                          icon={<span className="text-gray-400 text-sm">R$</span>}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Preço por KM (R$)</label>
                        <Input
                          type="number"
                          value={settings.bikePricePerKm}
                          onChange={(e) => setSettings({ ...settings, bikePricePerKm: parseFloat(e.target.value) })}
                          placeholder="0.00"
                          icon={<span className="text-gray-400 text-sm">R$</span>}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Distância Máxima (KM)</label>
                      <Input
                        type="number"
                        value={settings.bikeMaxDistance}
                        onChange={(e) => setSettings({ ...settings, bikeMaxDistance: parseFloat(e.target.value) })}
                        placeholder="5"
                        icon={<span className="text-gray-400 text-sm">KM</span>}
                      />
                      <p className="text-xs text-gray-400 mt-1">Bicicletas não farão entregas acima desta distância.</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Comissão da Plataforma (%)</label>
                      <Input
                        type="number"
                        value={settings.bikePlatformFee}
                        onChange={(e) => setSettings({ ...settings, bikePlatformFee: parseFloat(e.target.value) })}
                        placeholder="0"
                        icon={<span className="text-gray-400 text-sm">%</span>}
                      />
                    </div>
                  </div>
                </Card>

                {/* Company Data */}
                <Card className="p-6 md:col-span-2">
                  <div className="flex items-center gap-3 mb-6 border-b border-gray-100 pb-4">
                    <div className="bg-blue-100 p-2 rounded-lg">
                      <Building2 className="text-blue-600" size={24} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Dados da Empresa</h3>
                      <p className="text-sm text-gray-500">Informações legais e endereço da central</p>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Razão Social</label>
                        <Input
                          value={settings.companyName}
                          onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                          placeholder="Nome da Empresa"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ</label>
                        <Input
                          value={settings.companyCnpj}
                          onChange={(e) => setSettings({ ...settings, companyCnpj: e.target.value })}
                          placeholder="00.000.000/0000-00"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Email Contato</label>
                          <Input
                            value={settings.companyEmail}
                            onChange={(e) => setSettings({ ...settings, companyEmail: e.target.value })}
                            placeholder="email@empresa.com"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                          <Input
                            value={settings.companyPhone}
                            onChange={(e) => setSettings({ ...settings, companyPhone: e.target.value })}
                            placeholder="(00) 0000-0000"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Endereço Completo</label>
                        <AddressInput
                          value={settings.companyAddress}
                          onChange={(val) => setSettings({ ...settings, companyAddress: val })}
                          placeholder="Rua, Número, Bairro"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-1">
                          <label className="block text-sm font-medium text-gray-700 mb-1">CEP</label>
                          <Input
                            value={settings.companyCep}
                            onChange={(e) => setSettings({ ...settings, companyCep: e.target.value })}
                            placeholder="00000-000"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Cidade</label>
                          <Input
                            value={settings.companyCity}
                            onChange={(e) => setSettings({ ...settings, companyCity: e.target.value })}
                            placeholder="Cidade"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                          <Input
                            value={settings.companyState}
                            onChange={(e) => setSettings({ ...settings, companyState: e.target.value })}
                            placeholder="UF"
                            maxLength={2}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email Suporte App</label>
                        <Input
                          value={settings.supportEmail}
                          onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
                          placeholder="suporte@app.com"
                        />
                      </div>
                    </div>
                  </div>
                </Card>
              </div>

              <div className="flex justify-end pt-4 border-t border-gray-200">
                <Button onClick={handleSaveSettings} isLoading={savingSettings} className="w-full md:w-auto px-8">
                  Salvar Todas as Alterações
                </Button>
              </div>
            </div>
          ) : activeTab === 'integrations' ? (
            <div className="max-w-5xl mx-auto space-y-6 animate-fade-in p-6">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">Integrações do Sistema</h2>
                  <p className="text-gray-500 text-sm">Configure gateways de pagamento, automações e email.</p>
                </div>
                <Button onClick={handleSaveSettings} isLoading={savingSettings}>Salvar Integrações</Button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Payment Gateways */}
                <Card className="p-6">
                  <div className="flex items-center gap-3 mb-6 border-b border-gray-100 pb-4">
                    <div className="bg-green-100 p-2 rounded-lg text-green-600"><DollarSign size={24} /></div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Gateway de Pagamento</h3>
                      <p className="text-sm text-gray-500">Para cobrança de faturas B2B</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Provedor</label>
                      <select
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-500"
                        value={settings.paymentGateway.provider}
                        onChange={(e) => setSettings({ ...settings, paymentGateway: { ...settings.paymentGateway, provider: e.target.value as any } })}
                      >
                        <option value="none">Desativado</option>
                        <option value="mercadopago">Mercado Pago</option>
                        <option value="asaas">Asaas</option>
                        <option value="stripe">Stripe</option>
                      </select>
                    </div>
                    {settings.paymentGateway.provider !== 'none' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Chave de API (Public Key)</label>
                          <Input
                            value={settings.paymentGateway.apiKey}
                            onChange={(e) => setSettings({ ...settings, paymentGateway: { ...settings.paymentGateway, apiKey: e.target.value } })}
                            placeholder="Ex: APP_USR-..."
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Chave Secreta (Access Token)</label>
                          <Input
                            type="password"
                            value={settings.paymentGateway.secretKey || ''}
                            onChange={(e) => setSettings({ ...settings, paymentGateway: { ...settings.paymentGateway, secretKey: e.target.value } })}
                            placeholder="Ex: APP_USR-..."
                          />
                        </div>
                      </>
                    )}
                  </div>
                </Card>

                {/* Email SMTP */}
                <Card className="p-6">
                  <div className="flex items-center gap-3 mb-6 border-b border-gray-100 pb-4">
                    <div className="bg-blue-100 p-2 rounded-lg text-blue-600"><Mail size={24} /></div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Servidor de Email (SMTP)</h3>
                      <p className="text-sm text-gray-500">Para envio de notificações do sistema</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Host SMTP</label>
                        <Input
                          value={settings.smtp.host}
                          onChange={(e) => setSettings({ ...settings, smtp: { ...settings.smtp, host: e.target.value } })}
                          placeholder="smtp.gmail.com"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Porta</label>
                        <Input
                          type="number"
                          value={settings.smtp.port}
                          onChange={(e) => setSettings({ ...settings, smtp: { ...settings.smtp, port: parseInt(e.target.value) } })}
                          placeholder="587"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email Remetente</label>
                        <Input
                          value={settings.smtp.fromEmail}
                          onChange={(e) => setSettings({ ...settings, smtp: { ...settings.smtp, fromEmail: e.target.value } })}
                          placeholder="noreply@app.com"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nome Remetente</label>
                        <Input
                          value={settings.smtp.fromName}
                          onChange={(e) => setSettings({ ...settings, smtp: { ...settings.smtp, fromName: e.target.value } })}
                          placeholder="Suporte MotoJá"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Usuário</label>
                        <Input
                          value={settings.smtp.user}
                          onChange={(e) => setSettings({ ...settings, smtp: { ...settings.smtp, user: e.target.value } })}
                          placeholder="user@email.com"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
                        <Input
                          type="password"
                          value={settings.smtp.pass}
                          onChange={(e) => setSettings({ ...settings, smtp: { ...settings.smtp, pass: e.target.value } })}
                          placeholder="••••••••"
                        />
                      </div>
                    </div>
                    <div className="pt-2">
                      <Button variant="outline" fullWidth onClick={handleTestSMTP}>
                        Testar Conexão SMTP
                      </Button>
                      {smtpTestResult && (
                        <div className={`mt-2 text-xs font-bold ${smtpTestResult.success ? 'text-green-600' : 'text-red-500'}`}>
                          {smtpTestResult.success ? '✅ ' : '❌ '}{smtpTestResult.message}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>

                {/* N8N Automation */}
                <Card className="p-6 md:col-span-2">
                  <div className="flex items-center gap-3 mb-6 border-b border-gray-100 pb-4">
                    <div className="bg-purple-100 p-2 rounded-lg text-purple-600"><Share2 size={24} /></div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Automação com N8N</h3>
                      <p className="text-sm text-gray-500">Webhooks para eventos do sistema</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="mt-2">
                      <input
                        type="checkbox"
                        checked={settings.n8n.enabled}
                        onChange={(e) => setSettings({ ...settings, n8n: { ...settings.n8n, enabled: e.target.checked } })}
                        className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500"
                      />
                    </div>
                    <div className="flex-1 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-1">Ativar Integração N8N</label>
                        <p className="text-xs text-gray-500 mb-3">Envia webhooks para o fluxo do N8N quando eventos ocorrem (ex: nova corrida, novo motorista).</p>
                        <Input
                          value={settings.n8n.webhookUrl}
                          onChange={(e) => setSettings({ ...settings, n8n: { ...settings.n8n, webhookUrl: e.target.value } })}
                          placeholder="https://n8n.seuserver.com/webhook/..."
                          disabled={!settings.n8n.enabled}
                        />
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          ) : activeTab === 'users' ? (
            <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800">Passageiros Cadastrados</h2>
                <div className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm font-bold">
                  {safeData.passengers?.length || 0} Total
                </div>
              </div>

              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-600">
                    <thead className="bg-gray-50 text-gray-900 font-semibold border-b border-gray-200">
                      <tr>
                        <th className="p-4">Passageiro</th>
                        <th className="p-4">Telefone</th>
                        <th className="p-4">Avaliação</th>
                        <th className="p-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {safeData.passengers && safeData.passengers.length > 0 ? (
                        safeData.passengers.map((user) => (
                          <tr key={user.id} className="hover:bg-gray-50 transition cursor-pointer" onClick={() => setViewUser(user)}>
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold overflow-hidden">
                                  {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover" /> : user.name.charAt(0)}
                                </div>
                                <div>
                                  <p className="font-semibold text-gray-900">{user.name}</p>
                                  <p className="text-xs text-gray-400">ID: {user.id.substring(0, 8)}...</p>
                                </div>
                              </div>
                            </td>
                            <td className="p-4 font-mono">{user.phone}</td>
                            <td className="p-4">
                              <div className="flex items-center gap-1 font-medium text-gray-900">
                                <Star size={14} className="text-yellow-400 fill-current" /> {user.rating}
                              </div>
                            </td>
                            <td className="p-4 text-right">
                              <button className="text-gray-400 hover:text-orange-500 transition">
                                <MoreVertical size={18} />
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="p-8 text-center text-gray-400">
                            Nenhum passageiro encontrado.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <Users size={64} className="mb-4 text-gray-200" />
              <h3 className="text-xl font-medium text-gray-500">Módulo em desenvolvimento</h3>
              <p className="text-sm">A tela de <b>{activeTab}</b> faz parte do protótipo completo.</p>
            </div>
          )}
        </div>
      </div >

      {showCompanyModal && <CompanyFormModal company={editingCompany} onClose={() => setShowCompanyModal(false)} onSave={handleSaveCompany} />}
      {viewDriver && <DriverDetailModal driver={viewDriver} onClose={() => setViewDriver(null)} />}
      {viewUser && <UserDetailModal user={viewUser} rides={safeData.recentRides} onClose={() => setViewUser(null)} />}
      {showAddDriver && <AddDriverModal onClose={() => setShowAddDriver(false)} />}
    </div >
  );

  function DollarSign({ size = 24, className }: { size?: number, className?: string }) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="12" x2="12" y1="2" y2="22" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
    )
  }
};