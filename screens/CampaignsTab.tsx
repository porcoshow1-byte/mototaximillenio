import React, { useState, useRef } from 'react';
import { Plus, Trash2, ImageIcon, ExternalLink, CheckCircle, X, Loader2, Megaphone } from 'lucide-react';
import { Card, Button, Input } from '../components/UI';
import { SystemSettings, CampaignBanner } from '../services/settings';
import { uploadFile } from '../services/storage';

interface CampaignsTabProps {
    settings: SystemSettings;
    setSettings: React.Dispatch<React.SetStateAction<SystemSettings>>;
    onSave: () => Promise<void>;
    savingSettings: boolean;
}

export const CampaignsTab: React.FC<CampaignsTabProps> = ({
    settings,
    setSettings,
    onSave,
    savingSettings
}) => {
    const [isUploading, setIsUploading] = useState(false);
    const [newCampaign, setNewCampaign] = useState<{
        title: string;
        imageUrl: string;
        linkUrl: string;
    }>({
        title: '',
        imageUrl: '',
        linkUrl: ''
    });
    const fileInputRef = useRef<HTMLInputElement>(null);

    const campaigns = settings.campaigns || [];

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            // Upload to Firebase Storage
            const url = await uploadFile(file, `campaigns/${Date.now()}_${file.name}`);
            setNewCampaign(prev => ({ ...prev, imageUrl: url }));
        } catch (error) {
            console.error('Failed to upload banner:', error);
            // Fallback: use base64
            const reader = new FileReader();
            reader.onloadend = () => {
                setNewCampaign(prev => ({ ...prev, imageUrl: reader.result as string }));
            };
            reader.readAsDataURL(file);
        } finally {
            setIsUploading(false);
        }
    };

    const handleAddCampaign = () => {
        if (!newCampaign.title || !newCampaign.imageUrl) return;

        const campaign: CampaignBanner = {
            id: `campaign-${Date.now()}`,
            title: newCampaign.title,
            imageUrl: newCampaign.imageUrl,
            linkUrl: newCampaign.linkUrl || undefined,
            active: true,
            createdAt: new Date().toISOString()
        };

        setSettings(prev => ({
            ...prev,
            campaigns: [...(prev.campaigns || []), campaign],
            // Auto-activate if it's the first campaign
            activeCampaignBanner: !prev.activeCampaignBanner ? campaign.imageUrl : prev.activeCampaignBanner
        }));

        setNewCampaign({ title: '', imageUrl: '', linkUrl: '' });
    };

    const handleDeleteCampaign = (id: string) => {
        const campaignToDelete = campaigns.find(c => c.id === id);
        setSettings(prev => {
            const newCampaigns = (prev.campaigns || []).filter(c => c.id !== id);
            return {
                ...prev,
                campaigns: newCampaigns,
                // Clear active banner if it was the deleted one
                activeCampaignBanner: prev.activeCampaignBanner === campaignToDelete?.imageUrl
                    ? (newCampaigns.find(c => c.active)?.imageUrl || null)
                    : prev.activeCampaignBanner
            };
        });
    };

    const handleToggleActive = (id: string) => {
        setSettings(prev => ({
            ...prev,
            campaigns: (prev.campaigns || []).map(c =>
                c.id === id ? { ...c, active: !c.active } : c
            )
        }));
    };

    const handleSetActiveMain = (imageUrl: string) => {
        setSettings(prev => ({
            ...prev,
            activeCampaignBanner: imageUrl
        }));
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                        <Megaphone className="text-orange-500" size={28} />
                        Gestão de Campanhas
                    </h2>
                    <p className="text-gray-500 text-sm mt-1">
                        Configure banners publicitários que aparecem durante a busca por piloto.
                    </p>
                </div>
                <Button
                    onClick={onSave}
                    disabled={savingSettings}
                    className="!bg-green-600 hover:!bg-green-700"
                >
                    {savingSettings ? <Loader2 size={18} className="animate-spin mr-2" /> : null}
                    💾 Salvar Campanhas
                </Button>
            </div>

            {/* Add New Campaign */}
            <Card className="p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Plus size={20} className="text-orange-500" />
                    Adicionar Nova Campanha
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Left: Form */}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Título da Campanha *
                            </label>
                            <Input
                                value={newCampaign.title}
                                onChange={(e) => setNewCampaign(prev => ({ ...prev, title: e.target.value }))}
                                placeholder="Ex: Promoção Parceiro Local"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Link (opcional)
                            </label>
                            <Input
                                value={newCampaign.linkUrl}
                                onChange={(e) => setNewCampaign(prev => ({ ...prev, linkUrl: e.target.value }))}
                                placeholder="https://exemplo.com.br"
                                icon={<ExternalLink size={16} className="text-gray-400" />}
                            />
                            <p className="text-xs text-gray-400 mt-1">
                                URL para direcionar ao clicar no banner
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Imagem do Banner *
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="file"
                                    accept="image/*"
                                    ref={fileInputRef}
                                    onChange={handleImageUpload}
                                    className="hidden"
                                />
                                <Button
                                    variant="secondary"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isUploading}
                                >
                                    {isUploading ? (
                                        <Loader2 size={16} className="animate-spin mr-2" />
                                    ) : (
                                        <ImageIcon size={16} className="mr-2" />
                                    )}
                                    Selecionar Imagem
                                </Button>
                            </div>
                            <p className="text-xs text-gray-400 mt-1">
                                Tamanho recomendado: 360x120px (proporção 3:1)
                            </p>
                        </div>

                        <Button
                            onClick={handleAddCampaign}
                            disabled={!newCampaign.title || !newCampaign.imageUrl || isUploading}
                            className="w-full"
                        >
                            <Plus size={16} className="mr-2" />
                            Adicionar Campanha
                        </Button>
                    </div>

                    {/* Right: Preview */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Pré-visualização
                        </label>
                        <div className="bg-gray-900 rounded-2xl p-4 min-h-[200px] flex items-center justify-center">
                            {newCampaign.imageUrl ? (
                                <img
                                    src={newCampaign.imageUrl}
                                    alt="Preview"
                                    className="max-h-32 rounded-xl object-cover shadow-lg"
                                />
                            ) : (
                                <div className="text-gray-500 text-center">
                                    <ImageIcon size={48} className="mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">Nenhuma imagem selecionada</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </Card>

            {/* Active Campaigns */}
            <Card className="p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">
                    Campanhas Ativas ({campaigns.filter(c => c.active).length})
                </h3>

                {campaigns.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                        <Megaphone size={48} className="mx-auto mb-3 opacity-30" />
                        <p>Nenhuma campanha cadastrada.</p>
                        <p className="text-sm">Adicione sua primeira campanha acima.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {campaigns.map((campaign) => (
                            <div
                                key={campaign.id}
                                className={`relative rounded-xl overflow-hidden border-2 transition-all ${settings.activeCampaignBanner === campaign.imageUrl
                                        ? 'border-orange-500 shadow-lg'
                                        : campaign.active
                                            ? 'border-green-200'
                                            : 'border-gray-200 opacity-60'
                                    }`}
                            >
                                {/* Banner Image */}
                                <img
                                    src={campaign.imageUrl}
                                    alt={campaign.title}
                                    className="w-full h-28 object-cover"
                                />

                                {/* Active Indicator */}
                                {settings.activeCampaignBanner === campaign.imageUrl && (
                                    <div className="absolute top-2 left-2 bg-orange-500 text-white px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1">
                                        <CheckCircle size={12} />
                                        Principal
                                    </div>
                                )}

                                {/* Info */}
                                <div className="p-3 bg-white">
                                    <h4 className="font-bold text-sm text-gray-900 truncate">
                                        {campaign.title}
                                    </h4>
                                    {campaign.linkUrl && (
                                        <a
                                            href={campaign.linkUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-blue-500 hover:underline truncate block"
                                        >
                                            {campaign.linkUrl}
                                        </a>
                                    )}

                                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => handleSetActiveMain(campaign.imageUrl)}
                                                className={`px-2 py-1 text-xs rounded font-medium transition ${settings.activeCampaignBanner === campaign.imageUrl
                                                        ? 'bg-orange-100 text-orange-600'
                                                        : 'bg-gray-100 text-gray-600 hover:bg-orange-50 hover:text-orange-600'
                                                    }`}
                                                title="Definir como principal"
                                            >
                                                ⭐ Principal
                                            </button>
                                            <button
                                                onClick={() => handleToggleActive(campaign.id)}
                                                className={`px-2 py-1 text-xs rounded font-medium transition ${campaign.active
                                                        ? 'bg-green-100 text-green-600'
                                                        : 'bg-gray-100 text-gray-500 hover:bg-green-50'
                                                    }`}
                                            >
                                                {campaign.active ? '✓ Ativo' : 'Inativo'}
                                            </button>
                                        </div>
                                        <button
                                            onClick={() => handleDeleteCampaign(campaign.id)}
                                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition"
                                            title="Excluir campanha"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>

            {/* Tips */}
            <Card className="p-4 bg-blue-50 border-blue-200">
                <h4 className="font-bold text-blue-800 text-sm mb-2">💡 Dicas</h4>
                <ul className="text-xs text-blue-700 space-y-1">
                    <li>• O banner "Principal" é exibido destacado durante a busca por piloto.</li>
                    <li>• Banners ativos aparecem em um carrossel horizontal na tela de busca.</li>
                    <li>• Use imagens com proporção 3:1 (ex: 360x120) para melhor visualização.</li>
                    <li>• Adicione links para direcionar usuários a promoções ou sites de parceiros.</li>
                </ul>
            </Card>
        </div>
    );
};

export default CampaignsTab;
