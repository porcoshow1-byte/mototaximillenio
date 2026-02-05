import React, { useState, useRef } from 'react';
import { Plus, Trash2, ImageIcon, ExternalLink, CheckCircle, X, Loader2, Megaphone, Pencil } from 'lucide-react';
import { Card, Button, Input } from '../components/UI';
import { SystemSettings, CampaignBanner } from '../services/settings';
import { uploadFile } from '../services/storage';
import { compressImage } from '../services/image';

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
    const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
    const [newCampaign, setNewCampaign] = useState<{
        title: string;
        imageUrl: string;
        linkUrl: string;
        showCta: boolean;
        ctaType: 'saiba_mais' | 'ligar' | 'whatsapp' | 'eu_quero' | 'comprar' | 'pedir_agora' | 'chamar_zap' | 'zap' | 'chama';
    }>({
        title: '',
        imageUrl: '',
        linkUrl: '',
        showCta: false,
        ctaType: 'saiba_mais'
    });
    const fileInputRef = useRef<HTMLInputElement>(null);

    const campaigns = settings.campaigns || [];

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            // Compress image if needed (max 1MB, max width 1280px)
            const processedFile = await compressImage(file);

            // Upload to Firebase Storage
            const url = await uploadFile(processedFile, `campaigns/${Date.now()}_${processedFile.name}`);
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

    const handleSaveInput = () => {
        if (!newCampaign.title || !newCampaign.imageUrl) return;

        if (editingCampaignId) {
            // Update existing
            setSettings(prev => ({
                ...prev,
                campaigns: (prev.campaigns || []).map(c =>
                    c.id === editingCampaignId ? {
                        ...c,
                        title: newCampaign.title,
                        imageUrl: newCampaign.imageUrl,
                        linkUrl: newCampaign.linkUrl || undefined,
                        showCta: newCampaign.showCta,
                        ctaType: newCampaign.ctaType
                    } : c
                )
            }));
            setEditingCampaignId(null);
        } else {
            // Create new
            const campaign: CampaignBanner = {
                id: `campaign-${Date.now()}`,
                title: newCampaign.title,
                imageUrl: newCampaign.imageUrl,
                linkUrl: newCampaign.linkUrl || undefined,
                showCta: newCampaign.showCta,
                ctaType: newCampaign.ctaType,
                active: true,
                createdAt: new Date().toISOString()
            };

            setSettings(prev => ({
                ...prev,
                campaigns: [...(prev.campaigns || []), campaign],
                activeCampaignBanner: !prev.activeCampaignBanner ? campaign.imageUrl : prev.activeCampaignBanner
            }));
        }

        // Reset form
        setNewCampaign({
            title: '',
            imageUrl: '',
            linkUrl: '',
            showCta: false,
            ctaType: 'saiba_mais'
        });
    };

    const handleEditCampaign = (campaign: CampaignBanner) => {
        setEditingCampaignId(campaign.id);
        setNewCampaign({
            title: campaign.title,
            imageUrl: campaign.imageUrl,
            linkUrl: campaign.linkUrl || '',
            showCta: campaign.showCta || false,
            ctaType: campaign.ctaType || 'saiba_mais'
        });
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCancelEdit = () => {
        setEditingCampaignId(null);
        setNewCampaign({
            title: '',
            imageUrl: '',
            linkUrl: '',
            showCta: false,
            ctaType: 'saiba_mais'
        });
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
            <Card className={`p-6 ${editingCampaignId ? 'border-2 border-orange-500 bg-orange-50/10' : ''}`}>
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    {editingCampaignId ? (
                        <>
                            <Pencil size={20} className="text-orange-500" />
                            Editar Campanha
                        </>
                    ) : (
                        <>
                            <Plus size={20} className="text-orange-500" />
                            Adicionar Nova Campanha
                        </>
                    )}
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

                        <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-xl border border-gray-100">
                            <div className="flex items-center h-5">
                                <input
                                    id="showCta"
                                    type="checkbox"
                                    checked={newCampaign.showCta}
                                    onChange={(e) => setNewCampaign(prev => ({ ...prev, showCta: e.target.checked }))}
                                    className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                                />
                            </div>
                            <div className="flex-1">
                                <label htmlFor="showCta" className="text-sm font-medium text-gray-700 select-none cursor-pointer">
                                    Exibir Botão de Ação
                                </label>
                                <p className="text-xs text-gray-500">
                                    Adiciona um botão chamativo sobre o banner.
                                </p>
                            </div>
                        </div>

                        {newCampaign.showCta && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Texto do Botão
                                </label>
                                <select
                                    value={newCampaign.ctaType}
                                    onChange={(e) => setNewCampaign(prev => ({ ...prev, ctaType: e.target.value as any }))}
                                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                >
                                    <option value="saiba_mais">Saiba mais</option>
                                    <option value="ligar">Ligar agora</option>
                                    <option value="whatsapp">WhatsApp</option>
                                    <option value="chamar_zap">Chamar no zap</option>
                                    <option value="zap">Zap</option>
                                    <option value="chama">Chama</option>
                                    <option value="eu_quero">Eu quero!</option>
                                    <option value="comprar">Comprar agora</option>
                                    <option value="pedir_agora">Pedir agora</option>
                                </select>
                            </div>
                        )}

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
                                Tamanho recomendado: 840x360px (proporção 21:9)
                            </p>
                        </div>

                        <div className="flex gap-2">
                            {editingCampaignId && (
                                <Button
                                    variant="secondary"
                                    onClick={handleCancelEdit}
                                    className="flex-1"
                                >
                                    Cancelar
                                </Button>
                            )}
                            <Button
                                onClick={handleSaveInput}
                                disabled={!newCampaign.title || !newCampaign.imageUrl || isUploading}
                                className="flex-1"
                            >
                                {editingCampaignId ? (
                                    <>
                                        <CheckCircle size={16} className="mr-2" />
                                        Salvar Alterações
                                    </>
                                ) : (
                                    <>
                                        <Plus size={16} className="mr-2" />
                                        Adicionar Campanha
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>

                    {/* Right: Preview */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Pré-visualização
                        </label>
                        <div className={`rounded-2xl flex items-center justify-center ${newCampaign.imageUrl ? 'bg-transparent' : 'bg-gray-900 p-4 min-h-[200px]'}`}>
                            {newCampaign.imageUrl ? (
                                <img
                                    src={newCampaign.imageUrl}
                                    alt="Preview"
                                    className="w-full h-auto rounded-xl object-contain shadow-lg border border-gray-200"
                                />
                            ) : (
                                <div className="text-gray-500 text-center">
                                    <ImageIcon size={48} className="mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">Nenhuma imagem selecionada</p>
                                </div>
                            )}

                            {/* Preview CTA Button */}
                            {newCampaign.imageUrl && newCampaign.showCta && (
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <span className="bg-white text-orange-600 px-6 py-2 rounded-full text-sm font-bold shadow-lg uppercase tracking-wide transform hover:scale-105 transition-transform">
                                        {newCampaign.ctaType === 'saiba_mais' && 'Saiba mais'}
                                        {newCampaign.ctaType === 'ligar' && 'Ligar'}
                                        {newCampaign.ctaType === 'whatsapp' && 'WhatsApp'}
                                        {newCampaign.ctaType === 'chamar_zap' && 'Chamar no zap'}
                                        {newCampaign.ctaType === 'zap' && 'Zap'}
                                        {newCampaign.ctaType === 'chama' && 'Chama'}
                                        {newCampaign.ctaType === 'eu_quero' && 'Eu quero!'}
                                        {newCampaign.ctaType === 'comprar' && 'Comprar'}
                                        {newCampaign.ctaType === 'pedir_agora' && 'Pedir agora'}
                                    </span>
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
                                            <button
                                                onClick={() => handleEditCampaign(campaign)}
                                                className="px-2 py-1 text-xs rounded font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition flex items-center gap-1"
                                                title="Editar campanha"
                                            >
                                                <Pencil size={12} />
                                                Editar
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
