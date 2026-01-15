import React, { useState, useEffect, useRef } from 'react';
import { Shield, Power, DollarSign, User, MessageSquare, Phone, History, Calendar, X, Settings, Loader2, AlertCircle, RefreshCw, Lock, ArrowRight, Navigation, MapPin, LogOut, Star, Sun, Moon, ThumbsUp, Flag, LifeBuoy, Send, CheckCircle, Trash2, Image as ImageIcon } from 'lucide-react';
import { Button, Badge, Card, Input } from '../components/UI';
import { SimulatedMap } from '../components/SimulatedMap';
import { ChatModal } from '../components/ChatModal';
import { ProfileScreen } from './ProfileScreen';
import { APP_CONFIG } from '../constants';
import { useAuth } from '../context/AuthContext';
import { subscribeToPendingRides, acceptRide, startRide, completeRide, getRideHistory, subscribeToRide, updateDriverLocation } from '../services/ride';
import { createSupportTicket } from '../services/support';
import { logout } from '../services/auth';
import { getOrCreateUserProfile, updateUserProfile, registerSession, validateSession, clearSession } from '../services/user';
import { RideRequest, Driver, Coords } from '../types';
import { playSound, initAudio } from '../services/audio';
import { useGeoLocation } from '../hooks/useGeoLocation';
import { showNotification, ensureNotificationPermission } from '../services/notifications';

export const DriverApp = () => {
  const { user: authUser } = useAuth();
  const [currentDriver, setCurrentDriver] = useState<Driver | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [isOnline, setIsOnline] = useState(false);
  const [showOfflineConfirm, setShowOfflineConfirm] = useState(false);
  const [sessionKicked, setSessionKicked] = useState(false);
  const [incomingRides, setIncomingRides] = useState<RideRequest[]>([]);
  const [activeRide, setActiveRide] = useState<RideRequest | null>(null);
  const [earnings, setEarnings] = useState(0);

  // Modals & Inputs
  const [showChat, setShowChat] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showPerformance, setShowPerformance] = useState(false);
  const [performanceTab, setPerformanceTab] = useState<'stats' | 'support'>('stats');
  const [supportForm, setSupportForm] = useState({ title: '', description: '', urgency: 'medium' as any });
  const [darkMode, setDarkMode] = useState(true);
  const [verificationCode, setVerificationCode] = useState('');

  // Support UI State
  const [supportRecentRides, setSupportRecentRides] = useState<RideRequest[]>([]);
  const [selectedRideId, setSelectedRideId] = useState<string | null>(null);
  const [ticketAttachments, setTicketAttachments] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const [historyRides, setHistoryRides] = useState<RideRequest[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Controle de Animação do Modal de Corrida
  const [requestAnimation, setRequestAnimation] = useState('animate-slide-in-bottom');

  // Referência para rastrear contagem anterior de corridas (para tocar som)
  const prevIncomingCountRef = useRef(0);

  // GPS em tempo real do motorista
  const { location: driverGpsLocation, accuracy: gpsAccuracy, error: gpsError } = useGeoLocation();
  const [currentDriverLocation, setCurrentDriverLocation] = useState<Coords | null>(null);
  const lastLocationUpdateRef = useRef<number>(0);

  const loadDriverProfile = async () => {
    if (!authUser) return;
    setLoadingProfile(true);
    setProfileError(null);
    try {
      const profile = await getOrCreateUserProfile(authUser.uid, authUser.email || '', 'driver');
      setCurrentDriver(profile as Driver);
    } catch (err: any) {
      console.error("Erro ao carregar perfil de motorista:", err);
      setProfileError("Falha ao carregar perfil do motorista.");
    } finally {
      setLoadingProfile(false);
    }
  };

  // Fetch Driver Profile on Mount
  useEffect(() => {
    loadDriverProfile();
  }, [authUser]);

  // Warn user before leaving while online
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isOnline) {
        e.preventDefault();
        e.returnValue = 'Você está online! Deseja realmente sair?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isOnline]);

  // Session validation - check every 10 seconds if still valid
  useEffect(() => {
    if (!currentDriver || !isOnline) return;

    const checkSession = async () => {
      const isValid = await validateSession(currentDriver.id);
      if (!isValid) {
        setIsOnline(false);
        setSessionKicked(true);
      }
    };

    const interval = setInterval(checkSession, 10000);
    return () => clearInterval(interval);
  }, [currentDriver, isOnline]);

  // Subscribe to pending rides when online and no active ride
  useEffect(() => {
    let unsubscribe: any;
    if (isOnline && !activeRide) {
      unsubscribe = subscribeToPendingRides((rides) => {
        // Tocar som e mostrar notificação se chegou nova corrida
        if (rides.length > 0 && prevIncomingCountRef.current === 0) {
          playSound('newRequest');
          setRequestAnimation('animate-slide-in-bottom');

          // Mostrar notificação push se app não estiver em foco
          const firstRide = rides[0];
          showNotification('newRideRequest', {
            price: firstRide.price,
            origin: firstRide.origin,
            destination: firstRide.destination
          });
        }
        prevIncomingCountRef.current = rides.length;
        setIncomingRides(rides);
      }, currentDriverLocation || undefined, 20); // Radius 20km for now
    } else {
      setIncomingRides([]);
      prevIncomingCountRef.current = 0;
    }
    return () => { if (unsubscribe) unsubscribe(); };
  }, [isOnline, activeRide, currentDriverLocation]);

  // Subscribe to active ride updates (to detect cancellations etc)
  useEffect(() => {
    let unsubscribe: any;
    if (activeRide) {
      unsubscribe = subscribeToRide(activeRide.id, (updatedRide) => {
        // Se foi cancelada, limpa
        if (updatedRide.status === 'cancelled') {
          setActiveRide(null);
          alert("A corrida foi cancelada pelo passageiro.");
        } else {
          // Atualiza status localmente
          setActiveRide(prev => prev ? { ...prev, ...updatedRide } : null);
        }
      });
    }
    return () => { if (unsubscribe) unsubscribe(); };
  }, [activeRide?.id]);

  useEffect(() => {
    if (showHistory && currentDriver) {
      const fetchHistory = async () => {
        const rides = await getRideHistory(currentDriver.id, 'driver');
        setHistoryRides(rides);
        const total = rides.reduce((acc, ride) => ride.status === 'completed' ? acc + ride.price : acc, 0);
        setEarnings(total);
      };
      fetchHistory();
    }
  }, [showHistory, currentDriver]);

  // Fetch recent rides for support tab context
  useEffect(() => {
    if (showPerformance && performanceTab === 'support' && currentDriver) {
      const fetchRecent = async () => {
        const rides = await getRideHistory(currentDriver.id, 'driver');
        setSupportRecentRides(rides.slice(0, 5));
      };
      fetchRecent();
    }
  }, [showPerformance, performanceTab, currentDriver]);

  // Atualizar localização do motorista localmente quando GPS muda
  useEffect(() => {
    if (driverGpsLocation) {
      setCurrentDriverLocation(driverGpsLocation);
      // Atualiza também o driver local para mostrar no mapa
      if (currentDriver) {
        setCurrentDriver(prev => prev ? { ...prev, location: driverGpsLocation } : null);
      }
    }
  }, [driverGpsLocation]);

  // Enviar localização para o banco de dados durante corrida ativa
  useEffect(() => {
    if (!activeRide || !currentDriverLocation) return;

    // Limitar updates para evitar sobrecarregar o banco (máx 1x a cada 3 segundos)
    const now = Date.now();
    if (now - lastLocationUpdateRef.current < 3000) return;

    lastLocationUpdateRef.current = now;

    // Enviar localização para o Firestore/Mock
    updateDriverLocation(activeRide.id, currentDriverLocation).catch(err => {
      console.warn("Erro ao enviar localização:", err);
    });

  }, [activeRide?.id, currentDriverLocation]);

  // Handler for clicking the online/offline button
  const handleToggleOnlineClick = () => {
    if (isOnline) {
      // Show confirmation before going offline
      setShowOfflineConfirm(true);
    } else {
      // Going online - no confirmation needed
      goOnline();
    }
  };

  const goOnline = async () => {
    if (!currentDriver) return;
    initAudio();
    ensureNotificationPermission();
    setIsOnline(true);

    // Register session and sync to database
    try {
      await registerSession(currentDriver.id);
      await updateUserProfile(currentDriver.id, {
        status: 'online',
        location: currentDriverLocation || undefined
      });
    } catch (error) {
      console.error("Erro ao ficar online:", error);
    }
  };

  const confirmGoOffline = async () => {
    if (!currentDriver) return;
    setShowOfflineConfirm(false);
    setIsOnline(false);

    try {
      await updateUserProfile(currentDriver.id, {
        status: 'offline'
      });
    } catch (error) {
      console.error("Erro ao ficar offline:", error);
    }
  };

  // Legacy function kept for compatibility
  const toggleOnline = async () => {
    handleToggleOnlineClick();
  };

  // Função para rejeitar com animação de saída (descendo)
  const handleRejectRide = () => {
    setRequestAnimation('animate-fade-out-down');
    setTimeout(() => {
      setIncomingRides(prev => prev.slice(1));
      setRequestAnimation('animate-slide-in-bottom');
    }, 500); // Tempo da animação CSS
  };

  // Função para aceitar com animação de saída (direita)
  const handleAcceptRide = async (ride: RideRequest) => {
    if (!currentDriver) return;
    setProcessingId(ride.id);

    // Inicia animação de saída
    setRequestAnimation('animate-slide-out-right');

    // Aguarda animação terminar antes de processar lógica visual
    await new Promise(r => setTimeout(r, 500));

    try {
      await acceptRide(ride.id, currentDriver);
      // Som de aceitação
      playSound('rideAccepted');
      // Optimistic update
      setActiveRide({ ...ride, status: 'accepted', driver: currentDriver });
      setIncomingRides([]);
      setVerificationCode(''); // Reset code input
    } catch (error) {
      playSound('error');
      alert("Erro ao aceitar. Talvez outro motorista já tenha aceitado.");
      setRequestAnimation('animate-slide-in-bottom'); // Reseta se der erro
    } finally {
      setProcessingId(null);
    }
  };

  const handleStartRide = async () => {
    if (!activeRide) return;

    // Security Code Validation
    if (activeRide.securityCode) {
      if (verificationCode !== activeRide.securityCode) {
        playSound('error');
        alert("Código incorreto. Peça ao passageiro o código de 4 dígitos.");
        return;
      }
    }

    setProcessingId('starting');
    try {
      await startRide(activeRide.id);
      playSound('rideStarted');
    } catch (error) {
      console.error(error);
      playSound('error');
      alert("Erro ao iniciar corrida.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleFinishRide = async () => {
    if (activeRide) {
      await completeRide(activeRide.id);
      playSound('rideCompleted');
      setActiveRide(null);
    }
  };

  const handleLogout = async () => {
    if (confirm('Deseja realmente sair do aplicativo?')) {
      if (isOnline) {
        // Try to set offline status if possible
        if (currentDriver) updateUserProfile(currentDriver.id, { status: 'offline' } as any);
      }
      await logout();
    }
  };

  const handleSubmitSupport = async () => {
    if (!currentDriver) return;
    if (!supportForm.title || !supportForm.description) {
      alert('Preencha o título e a descrição.');
      return;
    }

    try {
      await createSupportTicket({
        title: supportForm.title,
        description: supportForm.description,
        urgency: supportForm.urgency,
        type: 'support_request',
        userId: currentDriver.id,
        userName: currentDriver.name,
        userRole: 'driver',
        rideDetails: selectedRideId ? (() => {
          const r = supportRecentRides.find(r => r.id === selectedRideId);
          return r ? {
            rideId: r.id,
            origin: r.origin,
            destination: r.destination,
            date: r.createdAt,
            price: r.price
          } : undefined;
        })() : undefined,
        attachments: ticketAttachments
      });
      alert('Solicitação enviada com sucesso! Nossa equipe entrará em contato.');
      setSupportForm({ title: '', description: '', urgency: 'medium' });
      setTicketAttachments([]);
      setSelectedRideId(null);
      setShowPerformance(false); // Closes the modal
    } catch (error) {
      console.error(error);
      alert('Erro ao enviar solicitação.');
    }
  };

  // Loading State
  if (loadingProfile) {
    return (
      <div className="h-full bg-gray-900 flex items-center justify-center text-white flex-col">
        <Loader2 className="animate-spin mb-4" size={40} />
        <p>Carregando perfil...</p>
      </div>
    );
  }

  // Error State
  if (profileError || !currentDriver) {
    return (
      <div className="h-full bg-gray-900 flex flex-col items-center justify-center text-white p-6 text-center">
        <AlertCircle className="text-red-500 mb-4" size={48} />
        <h2 className="text-xl font-bold mb-2">Erro de Conexão</h2>
        <p className="text-gray-400 mb-6">{profileError || "Não foi possível carregar os dados."}</p>
        <Button onClick={loadDriverProfile} className="flex items-center gap-2">
          <RefreshCw size={20} /> Tentar Novamente
        </Button>
      </div>
    );
  }

  // Verification State
  if (currentDriver && (currentDriver.verificationStatus === 'pending' || currentDriver.verificationStatus === 'rejected')) {
    return (
      <div className="h-full bg-gray-900 flex flex-col items-center justify-center text-white p-6 text-center">
        <Shield className={currentDriver.verificationStatus === 'pending' ? "text-orange-500 mb-4" : "text-red-500 mb-4"} size={64} />
        <h2 className="text-2xl font-bold mb-2">
          {currentDriver.verificationStatus === 'pending' ? 'Cadastro em Análise' : 'Cadastro Recusado'}
        </h2>
        <p className="text-gray-400 mb-6 max-w-xs mx-auto">
          {currentDriver.verificationStatus === 'pending'
            ? 'Sua documentação (CNH) foi enviada e está sendo analisada por nossa equipe. Aguarde a aprovação para entrar online.'
            : 'Infelizmente seu cadastro não foi aprovado. Entre em contato com o suporte para mais detalhes.'
          }
        </p>
        <Button onClick={loadDriverProfile} className="flex items-center gap-2">
          <RefreshCw size={20} /> Verificar Novamente
        </Button>
      </div>
    );
  }

  const currentRequest = incomingRides.length > 0 ? incomingRides[0] : null;

  if (showProfile) {
    return (
      <ProfileScreen
        user={currentDriver}
        isDriver={true}
        onBack={() => setShowProfile(false)}
        onSave={(updated) => { setCurrentDriver(updated); setShowProfile(false); }}
      />
    );
  }

  return (
    <div className={`h-full ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'} flex flex-col transition-colors duration-300`}>
      {/* Header */}
      <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} p-3 flex justify-between items-center shadow-lg z-20 border-b transition-colors`}>
        <div className="flex items-center gap-2 cursor-pointer p-1 rounded-lg hover:bg-black/10 transition" onClick={() => setShowPerformance(true)}>
          <img src={currentDriver.avatar} className="w-9 h-9 rounded-full border border-gray-600" alt="Avatar" />
          <div>
            <h3 className={`font-bold text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>{currentDriver.name}</h3>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span className="bg-orange-500 px-1.5 rounded text-white font-bold flex items-center gap-0.5">
                {currentDriver.rating.toFixed(1)} <Star size={10} fill="white" />
              </span>
              {/* GPS Status Dot */}
              <span className="flex items-center gap-1">
                <span
                  className={`w-2 h-2 rounded-full ${gpsError ? 'bg-red-500' :
                    gpsAccuracy ? (gpsAccuracy < 30 ? 'bg-green-500' : 'bg-orange-500') :
                      'bg-gray-400 animate-pulse'
                    }`}
                  title={gpsError ? 'GPS Offline' : gpsAccuracy ? (gpsAccuracy < 30 ? 'GPS OK' : 'GPS Instável') : 'Localizando...'}
                />
                <span className={`text-[10px] font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>GPS</span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className={`p-2 rounded-full ${darkMode ? 'bg-gray-700 text-yellow-400' : 'bg-gray-100 text-gray-600'}`}
          >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            onClick={() => setShowHistory(true)}
            className={`${darkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'} px-3 py-1.5 rounded-lg border flex items-center gap-2 hover:opacity-80 transition`}
          >
            <DollarSign size={14} className="text-green-500" />
            <span className="font-bold text-green-500">{APP_CONFIG.currency} {earnings.toFixed(2)}</span>
          </button>

          <button
            onClick={handleLogout}
            className="p-2 text-red-500 hover:bg-red-500/10 rounded-full transition"
            title="Sair"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 relative overflow-hidden">
        {!isOnline ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 bg-gray-900 z-10">
            <div className="bg-gray-800 p-8 rounded-full mb-8 shadow-2xl border-4 border-gray-700">
              <Power size={64} className="text-gray-500" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Você está offline</h2>
            <Button onClick={toggleOnline} className="w-full max-w-xs text-lg py-4 bg-green-500 hover:bg-green-600 shadow-green-900/50">
              Ficar Online
            </Button>
          </div>
        ) : (
          <>
            <SimulatedMap
              showDriver={true}
              status={activeRide?.status === 'in_progress' ? "Em viagem" : activeRide ? "Indo até passageiro" : "Procurando corridas..."}
              driverLocation={currentDriver.location}
              origin={activeRide?.originCoords}
              destination={activeRide?.destinationCoords}
              showRoute={!!activeRide}
            />

            {/* Estado Procurando - Moderno */}
            {!activeRide && !currentRequest && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none">
                {/* Radar Animation */}
                <div className="relative mb-8">
                  <div className="absolute inset-0 bg-orange-500 rounded-full animate-ping opacity-20 duration-1000"></div>
                  <div className="absolute inset-0 bg-orange-500 rounded-full animate-ping opacity-10 duration-2000 delay-300"></div>
                  <div className="bg-white p-5 rounded-full shadow-2xl border-4 border-orange-100 relative z-10 flex items-center justify-center">
                    <Loader2 size={32} className="text-orange-500 animate-spin" />
                  </div>
                </div>

                <div className="bg-gray-900/90 backdrop-blur-md px-6 py-3 rounded-full shadow-lg border border-gray-700 text-center animate-fade-in">
                  <p className="font-bold text-white text-lg">Procurando passageiros...</p>
                  <p className="text-xs text-gray-400">Mantenha o app aberto</p>
                </div>

                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
                  <button
                    onClick={toggleOnline}
                    className="bg-red-500/90 backdrop-blur text-white px-6 py-3 rounded-full font-bold shadow-lg flex items-center gap-2 hover:bg-red-600 transition hover:scale-105 active:scale-95"
                  >
                    <Power size={18} /> Ficar Offline
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Modal de Nova Corrida (Real) */}
        {currentRequest && !activeRide && (
          <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end p-4">
            <div className={`w-full bg-gray-800 rounded-2xl p-5 shadow-2xl border border-gray-700 ${requestAnimation}`}>
              <div className="flex justify-between items-start mb-4">
                <Badge color="orange">{currentRequest.serviceType}</Badge>
                <span className="text-xl font-bold text-white">R$ {currentRequest.price.toFixed(2)}</span>
              </div>

              <div className="flex flex-col gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full bg-green-500"></div>
                  <div>
                    <p className="text-xs text-gray-400">Origem</p>
                    <p className="font-semibold text-white">{currentRequest.origin}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full bg-orange-500"></div>
                  <div>
                    <p className="text-xs text-gray-400">Destino</p>
                    <p className="font-semibold text-white">{currentRequest.destination}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 h-14">
                <Button className="flex-1 bg-gray-700" onClick={handleRejectRide}>Recusar</Button>
                <Button
                  onClick={() => handleAcceptRide(currentRequest)}
                  isLoading={processingId === currentRequest.id}
                  className="flex-[2] bg-green-500 hover:bg-green-600 shadow-lg shadow-green-500/20 animate-pulse"
                >
                  Aceitar Corrida
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* UI de Corrida em Andamento */}
        {activeRide && (
          <div className="absolute bottom-0 left-0 right-0 z-30 bg-white text-gray-900 rounded-t-3xl p-5 shadow-2xl animate-slide-up">
            {/* Info Passageiro */}
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="bg-orange-100 p-2 rounded-full">
                  <User size={24} className="text-orange-600" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">{activeRide.passenger.name}</h3>
                  <span className="text-sm text-gray-500 flex items-center gap-1">
                    <Navigation size={12} /> {activeRide.status === 'in_progress' ? 'Em direção ao destino' : 'Buscando passageiro'}
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowChat(true)}
                  className="bg-gray-100 p-3 rounded-full text-gray-700 hover:bg-gray-200"
                >
                  <MessageSquare size={20} />
                </button>
                <button className="bg-gray-100 p-3 rounded-full text-gray-700 hover:bg-gray-200">
                  <Phone size={20} />
                </button>
              </div>
            </div>

            {/* Ações de Controle da Corrida */}
            <div className="space-y-3">
              {activeRide.status === 'accepted' ? (
                <div className="animate-fade-in">
                  {activeRide.securityCode && (
                    <div className="mb-3">
                      <label className="text-xs font-bold text-gray-500 uppercase ml-1">Código de Segurança</label>
                      <div className="flex gap-2 mt-1">
                        <div className="relative flex-1">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                          <input
                            type="tel"
                            maxLength={4}
                            placeholder="Digite o código do passageiro"
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-10 pr-4 font-mono font-bold text-lg tracking-widest focus:ring-2 focus:ring-orange-500 outline-none"
                            value={verificationCode}
                            onChange={(e) => setVerificationCode(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  <Button
                    fullWidth
                    variant="primary"
                    onClick={handleStartRide}
                    isLoading={processingId === 'starting'}
                    className={activeRide.securityCode && verificationCode.length < 4 ? 'opacity-50' : ''}
                  >
                    <ArrowRight size={20} /> Iniciar Corrida
                  </Button>
                </div>
              ) : (
                <Button fullWidth variant="success" onClick={handleFinishRide}>
                  <Shield size={20} /> Finalizar Corrida
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {showHistory && (
        <div className="absolute inset-0 z-50 bg-gray-900 flex flex-col animate-slide-up">
          <div className="p-4 bg-gray-800 flex items-center justify-between shadow-md">
            <h2 className="text-xl font-bold">Extrato de Ganhos</h2>
            <button onClick={() => setShowHistory(false)} className="p-2 bg-gray-700 rounded-full text-gray-300">
              <X size={20} />
            </button>
          </div>
          <div className="p-4 flex-1 overflow-y-auto space-y-3">
            <div className="bg-gray-800 p-6 rounded-2xl mb-6 text-center border border-gray-700">
              <p className="text-gray-400 text-sm mb-1">Ganhos Totais (Simulado)</p>
              <h3 className="text-4xl font-bold text-green-400">R$ {earnings.toFixed(2)}</h3>
            </div>
            {historyRides.length === 0 ? <p className="text-gray-500 text-center py-10">Nenhuma corrida finalizada ainda.</p> : historyRides.map((ride) => <div key={ride.id} className="bg-gray-800 p-4 rounded-xl border border-gray-700 flex justify-between items-center"><div><p className="font-bold text-white">{ride.destination}</p></div><div className="text-right"><p className="font-bold text-green-400">+ R$ {ride.price.toFixed(2)}</p></div></div>)}
          </div>
        </div>
      )}

      {showChat && activeRide && currentDriver && <ChatModal rideId={activeRide.id} currentUserId={currentDriver.id} otherUserName={activeRide.passenger.name} onClose={() => setShowChat(false)} />}

      {/* Performance Modal */}
      {showPerformance && (
        <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-fade-in">
          <div className={`w-full max-w-md ${darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'} rounded-2xl shadow-2xl overflow-hidden animate-slide-up`}>
            <div className="p-4 flex justify-between items-center border-b border-gray-700/50">
              <h2 className="font-bold text-lg">Central do Motorista</h2>
              <button onClick={() => setShowPerformance(false)} className="p-2 hover:bg-gray-700/50 rounded-full"><X size={20} /></button>
            </div>

            {/* Tabs */}
            <div className="flex p-2 gap-2 bg-gray-900/10 dark:bg-gray-100/5">
              <button
                onClick={() => setPerformanceTab('stats')}
                className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition ${performanceTab === 'stats' ? 'bg-orange-500 text-white shadow-lg' : 'text-gray-500 hover:bg-gray-800/10'}`}
              >
                <Star size={16} /> Desempenho
              </button>
              <button
                onClick={() => setPerformanceTab('support')}
                className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition ${performanceTab === 'support' ? 'bg-blue-500 text-white shadow-lg' : 'text-gray-500 hover:bg-gray-800/10'}`}
              >
                <LifeBuoy size={16} /> Suporte
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[70vh]">
              {performanceTab === 'stats' ? (
                /* Stats Content */
                <div className="text-center animate-fade-in">
                  <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-orange-500 mb-4 shadow-lg shadow-orange-500/30">
                    <span className="text-4xl font-bold text-white flex items-center gap-1">
                      {currentDriver.rating.toFixed(1)} <Star size={24} fill="white" />
                    </span>
                  </div>
                  <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'} mb-6`}>Baseado nas últimas 50 avaliações</p>

                  <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className={`p-4 rounded-xl ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                      <div className="text-2xl font-bold text-green-500">98%</div>
                      <div className="text-xs opacity-70">Taxa de Aceitação</div>
                    </div>
                    <div className={`p-4 rounded-xl ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                      <div className="text-2xl font-bold text-blue-500">4.9s</div>
                      <div className="text-xs opacity-70">Tempo de Resposta</div>
                    </div>
                  </div>

                  <h3 className="font-bold text-left mb-4 flex items-center gap-2"><ThumbsUp size={16} /> Elogios Recentes</h3>
                  <div className="space-y-3">
                    {[
                      { text: "Muito educado e rápido!", badge: "Educação" },
                      { text: "Moto limpa e segura.", badge: "Veículo" },
                      { text: "Chegou antes do horário.", badge: "Pontualidade" }
                    ].map((c, i) => (
                      <div key={i} className={`text-left p-3 rounded-lg ${darkMode ? 'bg-gray-700/50' : 'bg-gray-50'} border ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}>
                        <p className="text-sm font-medium mb-1">"{c.text}"</p>
                        <span className="text-[10px] bg-orange-500/10 text-orange-500 px-2 py-0.5 rounded-full font-bold uppercase">{c.badge}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* Support Content */
                <div className="space-y-4 animate-fade-in text-left">
                  <div className={`p-4 rounded-xl ${darkMode ? 'bg-blue-900/20 border-blue-800' : 'bg-blue-50 border-blue-100'} border mb-4`}>
                    <p className="text-sm opacity-80">Precisa de ajuda ou quer reportar um problema? Preencha o formulário abaixo que nossa equipe entrará em contato.</p>
                  </div>

                  {/* Recent Rides Selection */}
                  {supportRecentRides.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium mb-2 opacity-80">Referente a uma corrida recente? (Opcional)</label>
                      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        {supportRecentRides.map(ride => (
                          <button
                            key={ride.id}
                            onClick={() => setSelectedRideId(selectedRideId === ride.id ? null : ride.id)}
                            className={`flex-shrink-0 w-40 p-3 rounded-xl border text-left transition relative ${selectedRideId === ride.id
                              ? 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500'
                              : `${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}`
                              }`}
                          >
                            {selectedRideId === ride.id && (
                              <div className="absolute -top-2 -right-2 bg-blue-500 text-white rounded-full p-0.5">
                                <CheckCircle size={12} />
                              </div>
                            )}
                            <p className="text-[10px] opacity-60 mb-1">
                              {new Date(ride.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} • {new Date(ride.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            <p className="font-bold text-xs truncate max-w-full mb-0.5">{ride.destination}</p>
                            <p className="text-xs text-green-500 font-bold">R$ {ride.price.toFixed(2)}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium mb-1 opacity-80">Assunto</label>
                    <Input
                      value={supportForm.title}
                      onChange={(e) => setSupportForm({ ...supportForm, title: e.target.value })}
                      placeholder="Ex: Problema com pagamento"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 opacity-80">Prioridade</label>
                    <select
                      className={`w-full p-3 rounded-xl border ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'} outline-none focus:ring-2 focus:ring-blue-500`}
                      value={supportForm.urgency}
                      onChange={(e) => setSupportForm({ ...supportForm, urgency: e.target.value as any })}
                    >
                      <option value="low">Baixa</option>
                      <option value="medium">Média</option>
                      <option value="high">Alta</option>
                      <option value="critical">Crítica</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 opacity-80">Descrição detalhada</label>
                    <textarea
                      className={`w-full p-3 rounded-xl border ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'} outline-none focus:ring-2 focus:ring-blue-500 min-h-[120px] resize-none`}
                      value={supportForm.description}
                      onChange={(e) => setSupportForm({ ...supportForm, description: e.target.value })}
                      placeholder="Descreva seu problema..."
                    />
                  </div>

                  {/* Attachments */}
                  <div>
                    <label className="block text-sm font-medium mb-1 opacity-80">Anexos (Opcional - Máx 3)</label>
                    <div className="flex flex-wrap gap-2">
                      {ticketAttachments.map((url, idx) => (
                        <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-500/30 group">
                          <img src={url} alt="Attachment" className="w-full h-full object-cover" />
                          <button
                            onClick={() => setTicketAttachments(prev => prev.filter((_, i) => i !== idx))}
                            className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition text-white"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}

                      {ticketAttachments.length < 3 && (
                        <button
                          onClick={() => {
                            setIsUploading(true);
                            // Simulate upload
                            setTimeout(() => {
                              const mockUrl = `https://picsum.photos/200?random=${Date.now()}`;
                              setTicketAttachments(prev => [...prev, mockUrl]);
                              setIsUploading(false);
                            }, 1500);
                          }}
                          disabled={isUploading}
                          className={`w-16 h-16 rounded-lg border-2 border-dashed flex items-center justify-center transition ${darkMode ? 'border-gray-600 hover:border-gray-400' : 'border-gray-300 hover:border-gray-400'}`}
                        >
                          {isUploading ? <Loader2 size={20} className="animate-spin text-gray-400" /> : <ImageIcon size={20} className="text-gray-400" />}
                        </button>
                      )}
                    </div>
                  </div>

                  <Button fullWidth onClick={handleSubmitSupport} className="bg-blue-600 hover:bg-blue-700 mt-2">
                    <Send size={18} className="mr-2" /> Enviar Solicitação
                  </Button>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-700/50 bg-opacity-50">
              <Button fullWidth onClick={() => setShowProfile(true)} variant="outline">
                <Settings size={16} className="mr-2" /> Editar Perfil
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Offline Confirmation Modal */}
      {showOfflineConfirm && (
        <div className="absolute inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-gray-700 animate-slide-up">
            <div className="text-center">
              <div className="w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Power size={32} className="text-orange-500" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Deseja ficar offline?</h3>
              <p className="text-gray-400 text-sm mb-6">
                Você não receberá mais chamadas de corrida enquanto estiver offline.
              </p>
              <div className="flex gap-3">
                <Button
                  fullWidth
                  variant="outline"
                  onClick={() => setShowOfflineConfirm(false)}
                  className="border-gray-600 text-gray-300"
                >
                  Não
                </Button>
                <Button
                  fullWidth
                  onClick={confirmGoOffline}
                  className="bg-red-500 hover:bg-red-600"
                >
                  Sim
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Session Kicked Modal */}
      {sessionKicked && (
        <div className="absolute inset-0 z-[100] bg-black/90 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-red-500 animate-slide-up">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle size={32} className="text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Sessão Encerrada</h3>
              <p className="text-gray-400 text-sm mb-6">
                Sua conta foi acessada em outro dispositivo. Apenas um dispositivo pode estar conectado por vez.
              </p>
              <Button
                fullWidth
                onClick={() => { clearSession(); logout(); }}
                className="bg-red-500 hover:bg-red-600"
              >
                Entendido
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
// End of component