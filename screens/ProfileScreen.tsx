import React, { useState, useRef } from 'react';
import { User as UserIcon, Phone, Car, Save, ArrowLeft, Camera, MapPin } from 'lucide-react';
import { Button, Input, Card } from '../components/UI';
import { User, Driver, Coords } from '../types';
import { updateUserProfile } from '../services/user';
import { AddressAutocomplete } from '../components/AddressAutocomplete';
import { uploadFile } from '../services/storage';


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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        setIsUploading(true);
        // Use a timeout race to prevent infinite hanging
        const uploadPromise = uploadFile(file, `avatars/${user.id}_${Date.now()}`);
        const timeoutPromise = new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error("Timeout")), 15000)
        );

        const url = await Promise.race([uploadPromise, timeoutPromise]);
        setFormData(prev => ({ ...prev, avatar: url }));
      } catch (error) {
        console.error("Profile image upload error:", error);
        // Fallback: Use base64 locally if Firebase fails or timeouts
        const reader = new FileReader();
        reader.onloadend = () => {
          setFormData(prev => ({ ...prev, avatar: reader.result as string }));
        };
        reader.readAsDataURL(file);
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
    <div className="h-full bg-gray-50 flex flex-col animate-fade-in">
      {/* Header */}
      <div className="bg-white p-4 shadow-sm sticky top-0 z-10 flex items-center gap-3">
        <button onClick={onBack} className="p-2 -ml-2 hover:bg-gray-100 rounded-full text-gray-700">
          <ArrowLeft size={24} />
        </button>
        <h2 className="text-xl font-bold text-gray-800">Meu Perfil</h2>
      </div>

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

        <Card className="space-y-4 p-6">
          <h3 className="font-bold text-gray-800 mb-2">Dados Pessoais</h3>

          <Input
            label="Nome Completo"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            icon={<UserIcon size={18} />}
            placeholder="Seu nome"
          />

          <Input
            label="Telefone / WhatsApp"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            icon={<Phone size={18} />}
            placeholder="(00) 00000-0000"
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
              />
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
              />

              <Input
                label="Placa"
                value={formData.plate}
                onChange={(e) => setFormData({ ...formData, plate: e.target.value })}
                icon={<div className="font-bold text-xs border border-gray-400 rounded px-0.5">ABC</div>}
                placeholder="ABC-1234"
              />
            </>
          )}

          <div className="pt-4">
            <Button fullWidth onClick={handleSave} isLoading={loading} disabled={isUploading}>
              <Save size={20} /> {isUploading ? 'Enviando Foto...' : 'Salvar Alterações'}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};