import React, { useState, useRef } from 'react';
import { User as UserIcon, Phone, Car, Save, ArrowLeft, Camera, MapPin, Info } from 'lucide-react';
import { Button, Input, Card } from '../components/UI';
import { User, Driver, Coords } from '../types';
import { updateUserProfile } from '../services/user';
import { AddressAutocomplete } from '../components/AddressAutocomplete';
import { uploadFile } from '../services/storage';
import { getDriverReviews } from '../services/rating';
import { getDriverTickets, SupportTicket } from '../services/support';
import { Review } from '../types';
import { Star, AlertTriangle, Check, Clock, CheckCircle, XCircle } from 'lucide-react';


interface ProfileScreenProps {
  user: User | Driver;
  isDriver: boolean;
  onBack: () => void;
  onSave: (updatedUser: any) => void;
  userLocation?: Coords | null;
}

export const ProfileScreen = ({ user, isDriver, onBack, onSave, userLocation }: ProfileScreenProps) => {
  const [formData, setFormData] = useState({
    name: user.name,
    phone: user.phone || '',
    address: (user as User).address || '',
    avatar: user.avatar || '',
    vehicle: isDriver ? (user as Driver).vehicle : '',
    plate: isDriver ? (user as Driver).plate : '',
  });
  const [loading, setLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'reviews' | 'occurrences'>('details');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (activeTab === 'reviews' && isDriver) {
      setLoadingReviews(true);
      getDriverReviews(user.id).then(data => {
        setReviews(data);
        setLoadingReviews(false);
      });
    }
    if (activeTab === 'occurrences' && isDriver) {
      setLoadingTickets(true);
      getDriverTickets(user.id).then(data => {
        setTickets(data);
        setLoadingTickets(false);
      });
    }
  }, [activeTab, isDriver, user.id]);

  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        setIsUploading(true);

        // Import compression utility
        const { compressImage } = await import('../services/storage');

        // Compress image first (max 800px, quality 0.7)
        const compressedFile = await compressImage(file, 800, 0.7);
        console.log(`Original: ${(file.size / 1024).toFixed(1)}KB, Compressed: ${(compressedFile.size / 1024).toFixed(1)}KB`);

        // Use a timeout race to prevent infinite hanging
        const uploadPromise = uploadFile(compressedFile, `avatars/${user.id}_${Date.now()}`);
        const timeoutPromise = new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error("Timeout")), 20000)
        );

        const url = await Promise.race([uploadPromise, timeoutPromise]);
        setFormData(prev => ({ ...prev, avatar: url }));
      } catch (error) {
        console.error("Profile image upload error:", error);
        // Fallback: Use base64 locally if Firebase fails or timeouts
        // Also compress for base64 fallback
        try {
          const { compressImage } = await import('../services/storage');
          const compressedFile = await compressImage(file, 400, 0.6); // Smaller for base64
          const reader = new FileReader();
          reader.onloadend = () => {
            setFormData(prev => ({ ...prev, avatar: reader.result as string }));
          };
          reader.readAsDataURL(compressedFile);
        } catch {
          // Last resort: use original file
          const reader = new FileReader();
          reader.onloadend = () => {
            setFormData(prev => ({ ...prev, avatar: reader.result as string }));
          };
          reader.readAsDataURL(file);
        }
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      // Ensure we merge with existing user data to avoid losing fields
      const updatedProfile = { ...user, ...formData };

      // 1. Call Service
      await updateUserProfile(user.id, formData);

      // 2. BACKUP: Direct LocalStorage Save (Fix for Persistence Issues)
      if (typeof localStorage !== 'undefined') {
        const key = `motoja_user_${user.id}`;
        const existing = localStorage.getItem(key);
        const parsed = existing ? JSON.parse(existing) : {};
        const merged = { ...parsed, ...updatedProfile };
        localStorage.setItem(key, JSON.stringify(merged));
      }

      onSave(updatedProfile);
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar perfil.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-gray-50 flex flex-col animate-fade-in">
      {/* Header */}
      <div className="bg-white p-4 shadow-sm sticky top-0 z-10 flex items-center gap-3">
        <button onClick={onBack} className="p-2 -ml-2 hover:bg-gray-100 rounded-full text-gray-700">
          <ArrowLeft size={24} />
        </button>
        <h2 className="text-xl font-bold text-gray-800">Meu Perfil</h2>
      </div>

      {isDriver && (
        <div className="flex border-b border-gray-200 bg-white">
          <button
            onClick={() => setActiveTab('details')}
            className={`flex-1 py-3 text-sm font-semibold ${activeTab === 'details' ? 'text-orange-600 border-b-2 border-orange-600' : 'text-gray-500'}`}
          >
            Dados Pessoais
          </button>
          <button
            onClick={() => setActiveTab('reviews')}
            className={`flex-1 py-3 text-sm font-semibold ${activeTab === 'reviews' ? 'text-orange-600 border-b-2 border-orange-600' : 'text-gray-500'}`}
          >
            Avaliações
          </button>
          <button
            onClick={() => setActiveTab('occurrences')}
            className={`flex-1 py-3 text-sm font-semibold ${activeTab === 'occurrences' ? 'text-orange-600 border-b-2 border-orange-600' : 'text-gray-500'}`}
          >
            Ocorrências
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-col items-center mb-8 mt-4">
          <div className="relative">
            <img
              src={formData.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.name.split(' ').slice(0, 2).join('+'))}&background=E5E7EB&color=374151&size=128&bold=true`}
              alt="Avatar"
              className="w-24 h-24 rounded-full border-4 border-white shadow-lg object-cover"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 bg-orange-500 text-white p-2 rounded-full shadow-md hover:bg-orange-600 transition-colors"
            >
              <Camera size={16} />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImagePick}
              className="hidden"
              accept="image/*"
            />
          </div>
          <p className="mt-3 text-gray-500 text-sm">Toque para alterar foto</p>
        </div>

        {activeTab === 'details' ? (
          <Card className="space-y-4 p-6">
            <h3 className="font-bold text-gray-800 mb-2">Dados Pessoais</h3>

            <Input
              label="Nome Completo"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              icon={<UserIcon size={18} />}
              placeholder="Seu nome"
              readOnly={isDriver}
              className={isDriver ? "bg-gray-100 text-gray-500" : ""}
            />

            <Input
              label="Telefone / WhatsApp"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              icon={<Phone size={18} />}
              placeholder="(00) 00000-0000"
              readOnly={isDriver}
              className={isDriver ? "bg-gray-100 text-gray-500" : ""}
            />

            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700 block mb-1">Endereço Residencial</label>
              <div className="relative">
                <AddressAutocomplete
                  value={formData.address}
                  onChange={(val) => setFormData({ ...formData, address: val })}
                  onSelect={(addr) => setFormData({ ...formData, address: addr })}
                  placeholder="Seu endereço (será salvo como Casa)"
                  userLocation={userLocation}
                  leftIcon={<MapPin size={18} />}
                  readOnly={isDriver} // Add readOnly support to AddressAutocomplete if possible, or just disable
                />
                {isDriver && <div className="absolute inset-0 bg-gray-100/50 cursor-not-allowed z-10" />}
              </div>
            </div>

            {isDriver && (
              <>
                <div className="my-6 border-t border-gray-100"></div>
                <h3 className="font-bold text-gray-800 mb-2">Dados do Veículo</h3>

                <Input
                  label="Modelo da Moto"
                  value={formData.vehicle}
                  onChange={(e) => setFormData({ ...formData, vehicle: e.target.value })}
                  icon={<Car size={18} />}
                  placeholder="Ex: Honda CG 160 Titan"
                  readOnly={true}
                  className="bg-gray-100 text-gray-500"
                />

                <Input
                  label="Placa"
                  value={formData.plate}
                  onChange={(e) => setFormData({ ...formData, plate: e.target.value })}
                  icon={<div className="font-bold text-xs border border-gray-400 rounded px-0.5">ABC</div>}
                  placeholder="ABC-1234"
                  readOnly={true}
                  className="bg-gray-100 text-gray-500"
                />

                <div className="mt-4 p-3 bg-blue-50 text-blue-700 text-xs rounded-lg flex items-start gap-2">
                  <Info size={16} className="shrink-0 mt-0.5" />
                  <p>Para alterar seus dados pessoais ou do veículo, entre em contato com o suporte ou aguarde a validação do administrador.</p>
                </div>
              </>
            )}

            <div className="pt-4">
              <Button fullWidth onClick={handleSave} isLoading={loading} disabled={isUploading}>
                <Save size={20} /> {isUploading ? 'Enviando Foto...' : 'Salvar Alterações'}
              </Button>
            </div>
          </Card>
        ) : activeTab === 'reviews' ? (
          <div className="pb-10">
            <div className="bg-white p-4 rounded-xl shadow-sm mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Nota Geral</p>
                <div className="flex items-center gap-1">
                  <span className="text-3xl font-bold text-gray-800">{(user as Driver).rating?.toFixed(1) || '5.0'}</span>
                  <Star fill="#FBBF24" stroke="#FBBF24" size={24} />
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">{reviews.length} avaliações</p>
                <p className="text-xs text-gray-400">Últimos 30 dias</p>
              </div>
            </div>

            <div className="space-y-3">
              {loadingReviews ? (
                <div className="text-center py-10 text-gray-400">Carregando avaliações...</div>
              ) : reviews.length === 0 ? (
                <div className="text-center py-10 text-gray-400">Nenhuma avaliação ainda.</div>
              ) : (
                reviews.map(review => (
                  <div key={review.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
                          {review.reviewerName.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-800">{review.reviewerName}</p>
                          <p className="text-[10px] text-gray-400">{new Date(review.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="flex bg-yellow-50 px-2 py-0.5 rounded text-yellow-700 text-xs font-bold items-center gap-1">
                        {review.rating.toFixed(1)} <Star size={10} fill="currentColor" stroke="currentColor" />
                      </div>
                    </div>
                    <p className="text-gray-600 text-sm leading-relaxed">"{review.comment}"</p>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="pb-10">
            <div className="bg-white p-4 rounded-xl shadow-sm mb-4">
              <h3 className="font-bold text-gray-800 mb-1">Histórico de Ocorrências</h3>
              <p className="text-xs text-gray-500">Tickets abertos por você ou reportados.</p>
            </div>

            <div className="space-y-3">
              {loadingTickets ? (
                <div className="text-center py-10 text-gray-400">Carregando ocorrências...</div>
              ) : tickets.length === 0 ? (
                <div className="text-center py-10 text-gray-400">Nenhuma ocorrência encontrada.</div>
              ) : (
                tickets.map(ticket => (
                  <div key={ticket.id} className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-l-orange-500 border-gray-100 relative overflow-hidden">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${ticket.status === 'resolved' ? 'bg-green-100 text-green-700' :
                          ticket.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                          {ticket.status === 'resolved' ? 'Resolvido' : ticket.status === 'in_progress' ? 'Em Análise' : 'Pendente'}
                        </span>
                        <h4 className="font-bold text-gray-800 mt-1">{ticket.title}</h4>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-gray-400 block">{new Date(ticket.createdAt).toLocaleDateString()}</span>
                        {ticket.urgency === 'high' && <span className="text-[10px] text-red-500 font-bold flex items-center justify-end gap-1"><AlertTriangle size={10} /> URGENTE</span>}
                      </div>
                    </div>
                    <p className="text-gray-600 text-sm leading-relaxed mb-3">{ticket.description}</p>

                    <div className="flex items-center gap-2 text-xs text-gray-500 pt-2 border-t border-gray-50">
                      <span className="bg-gray-100 px-2 py-1 rounded">Protocolo: #{ticket.id.slice(0, 8)}</span>
                      {ticket.type && <span className="bg-gray-100 px-2 py-1 rounded capitalize">{ticket.type.replace('_', ' ')}</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div >
  );
};