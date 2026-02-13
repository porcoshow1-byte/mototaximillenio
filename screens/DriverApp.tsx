
import React, { useState, useEffect, useRef } from 'react';
import { Shield, Power, DollarSign, User, MessageSquare, Phone, History, Calendar, X, Settings, Loader2, AlertCircle, RefreshCw, Lock, ArrowRight, Navigation, MapPin, LogOut, Star, Sun, Moon, ThumbsUp, Flag, LifeBuoy, Send, CheckCircle, Trash2, Image as ImageIcon, ChevronRight, Bell, Menu, Zap } from 'lucide-react';
import { Button, Badge, Card, Input } from '../components/UI';
import { SimulatedMap } from '../components/SimulatedMap';
import { ChatModal } from '../components/ChatModal';
import { ProfileScreen } from './ProfileScreen';
import { NotificationsScreen } from './NotificationsScreen';
import { RideHistoryModal } from '../components/RideHistoryModal';
import { SwipeableButton } from '../components/SwipeableButton';
import { APP_CONFIG } from '../constants';
import { useAuth } from '../context/AuthContext';
import { subscribeToPendingRides, acceptRide, startRide, completeRide, getRideHistory, subscribeToRide, updateDriverLocation, cancelRide } from '../services/ride';
import { createSupportTicket } from '../services/support';
import { logout } from '../services/auth';
import { getOrCreateUserProfile, updateUserProfile, registerSession, validateSession, clearSession } from '../services/user';
import { RideRequest, Driver, Coords } from '../types';
import { playSound, initAudio } from '../services/audio';
import { useGeoLocation } from '../hooks/useGeoLocation';
import { showNotification, ensureNotificationPermission, registerServiceWorker } from '../services/notifications';
import { supabase, isMockMode } from '../services/supabase';

export const DriverApp = () => {
  const { user: authUser } = useAuth();

  // Helper: Remove state, CEP, and country from addresses for cleaner display
  const cleanAddress = (addr: string | undefined): string => {
    if (!addr) return '';
    let clean = addr;
    clean = clean.replace(/,?\s*Brazil$/i, '');
    clean = clean.replace(/,?\s*Brasil$/i, '');
    clean = clean.replace(/\s*-\s*State of [^,]+/gi, '');
    clean = clean.replace(/,?\s*\d{5}-?\d{3}/g, '');       // CEP
    clean = clean.replace(/,?\s*[A-Z]{2}\s*$/g, '');         // trailing state abbr
    clean = clean.replace(/\s*-\s*[A-Z]{2}\s*$/g, '');       // " - SP" at end
    clean = clean.replace(/,\s*,/g, ',');                    // double commas
    clean = clean.replace(/,\s*$/g, '').trim();              // trailing comma
    return clean;
  };
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
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showPerformance, setShowPerformance] = useState(false);
  const [performanceTab, setPerformanceTab] = useState<'stats' | 'support'>('stats');
  const [supportForm, setSupportForm] = useState({ title: '', description: '', urgency: 'medium' as any, rideId: '' as string | undefined });
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [showApprovalCelebration, setShowApprovalCelebration] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');

  // Support UI State
  const [ticketAttachments, setTicketAttachments] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const [historyRides, setHistoryRides] = useState<RideRequest[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showNavOptions, setShowNavOptions] = useState(false);
  const [showActiveRideDetails, setShowActiveRideDetails] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

  // Controle de Animação do Modal de Corrida
  const [requestAnimation, setRequestAnimation] = useState('animate-slide-in-bottom');

  // Referência para rastrear contagem anterior de corridas (para tocar som)
  const prevIncomingCountRef = useRef(0);

  // GPS em tempo real do motorista
  const { location: driverGpsLocation, accuracy: gpsAccuracy, error: gpsError } = useGeoLocation();
  const [currentDriverLocation, setCurrentDriverLocation] = useState<Coords | null>(null);
  const lastLocationUpdateRef = useRef<number>(0);

  const [isLocationReady, setIsLocationReady] = useState(false);

  const loadDriverProfile = async () => {
    if (!authUser) return;
    setLoadingProfile(true);
    setProfileError(null);
    try {
      const profile = await getOrCreateUserProfile(authUser.uid, authUser.email || '', 'driver');
      setCurrentDriver(profile as Driver);

      // RESTORE ONLINE STATUS from DB
      if (profile.status === 'online') {
        setIsOnline(true);
        ensureNotificationPermission();
      }
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
    registerServiceWorker(); // Ensure SW is registered
    ensureNotificationPermission();
  }, [authUser]);

  // Real-time listener for verification status changes (approval/rejection)
  useEffect(() => {
    if (!authUser || !supabase || isMockMode) return;
    const channel = supabase.channel(`driver - verification - ${authUser.uid} `)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users', filter: `id = eq.${authUser.uid} ` }, (payload: any) => {
        const newData = payload.new;
        if (newData.verification_status === 'approved') {
          playSound('rideCompleted');
          showNotification('driverApproved', undefined, true);
          setShowApprovalCelebration(true);
          setTimeout(() => { setShowApprovalCelebration(false); loadDriverProfile(); }, 3500);
        } else if (newData.verification_status === 'rejected') {
          showNotification('driverRejected', { reason: newData.rejection_reason }, true);
          loadDriverProfile();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
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
        if (rides.length > 0 && prevIncomingCountRef.current === 0) {
          playSound('newRequest');
          setRequestAnimation('animate-slide-in-bottom');
          const firstRide = rides[0];
          showNotification('newRideRequest', {
            price: firstRide.price,
            origin: firstRide.origin,
            destination: firstRide.destination
          });
        }
        prevIncomingCountRef.current = rides.length;
        setIncomingRides(rides);
      }, currentDriverLocation || undefined, 20, currentDriver.id);
    } else {
      setIncomingRides([]);
      prevIncomingCountRef.current = 0;
    }
    return () => { if (unsubscribe) unsubscribe(); };
  }, [isOnline, activeRide, currentDriverLocation, currentDriver?.id]);

  // Subscribe to active ride updates
  useEffect(() => {
    let unsubscribe: any;
    if (activeRide) {
      unsubscribe = subscribeToRide(activeRide.id, (updatedRide) => {
        if (updatedRide.status === 'cancelled') {
          setActiveRide(null);
          alert("A corrida foi cancelada pelo passageiro.");
        } else {
          setActiveRide(prev => prev ? { ...prev, ...updatedRide } : null);
        }
      });
    }
    return () => { if (unsubscribe) unsubscribe(); };
  }, [activeRide?.id]);

  // Fetch earnings
  useEffect(() => {
    if (currentDriver) {
      const fetchTotal = async () => {
        const rides = await getRideHistory(currentDriver.id, 'driver');
        const safeRides = rides || [];
        setEarnings(safeRides.reduce((acc, ride) => ride.status === 'completed' ? acc + ride.price : acc, 0));
        setHistoryRides(safeRides);
      };
      if (showHistory || showPerformance) fetchTotal();
    }
  }, [showHistory, currentDriver]);

  // Atualizar localização do motorista localmente quando GPS muda
  useEffect(() => {
    if (driverGpsLocation) {
      setCurrentDriverLocation(driverGpsLocation);

      // Só considera pronto se tiver precisão decente ou se já tiver passado um tempo
      // Para evitar o "pulo" inicial de um location cacheado antigo/errado
      if (!isLocationReady) {
        // Se a precisão for boa (< 100m) ou se já tiver local (assumindo que o primeiro pode ser cache, mas se for null n mostra)
        // Vamos aceitar qualquer location por enquanto, mas garantir que não é 0,0
        if (driverGpsLocation.lat !== 0 && driverGpsLocation.lng !== 0) {
          setIsLocationReady(true);
        }
      }

      // Atualiza também o driver local para mostrar no mapa
      if (currentDriver) {
        setCurrentDriver(prev => prev ? { ...prev, location: driverGpsLocation } : null);
      }
    }
  }, [driverGpsLocation]);

  // Send Location Update
  useEffect(() => {
    if (!activeRide || !currentDriverLocation) return;
    const now = Date.now();
    if (now - lastLocationUpdateRef.current < 3000) return;
    lastLocationUpdateRef.current = now;
    updateDriverLocation(activeRide.id, currentDriverLocation).catch(console.warn);
  }, [activeRide?.id, currentDriverLocation]);

  const handleLogout = async () => {
    if (isOnline) {
      alert("Fique offline antes de sair.");
      return;
    }
    await logout();
  };

  const handleToggleOnlineClick = () => {
    if (isOnline) setShowOfflineConfirm(true);
    else goOnline();
  };

  const goOnline = async () => {
    if (!currentDriver) return;
    initAudio();
    ensureNotificationPermission();
    setIsOnline(true);
    try {
      await registerSession(currentDriver.id);
      await updateUserProfile(currentDriver.id, { status: 'online', location: currentDriverLocation || undefined });
    } catch (error) { console.error("Erro ao ficar online:", error); }
  };

  const confirmGoOffline = async () => {
    if (!currentDriver) return;
    setShowOfflineConfirm(false);
    setIsOnline(false);
    try { await updateUserProfile(currentDriver.id, { status: 'offline' }); } catch (error) { console.error("Erro ao ficar offline:", error); }
  };

  // Rejection Logic
  const rejectRideProp = async (rideId: string) => {
    if (currentDriver) {
      const { rejectRide } = await import('../services/ride');
      await rejectRide(rideId, currentDriver.id);
    }
    setIncomingRides(prev => prev.filter(r => r.id !== rideId));
    prevIncomingCountRef.current = Math.max(0, prevIncomingCountRef.current - 1);
  };

  const handleRejectRide = () => {
    if (incomingRides.length > 0) {
      const rideId = incomingRides[0].id;
      rejectRideProp(rideId);
    }
    setRequestAnimation('animate-fade-out-down');
    setTimeout(() => { setRequestAnimation('animate-slide-in-bottom'); }, 500);
  };

  const handleAcceptRide = async (ride: RideRequest) => {
    if (!currentDriver) return;
    setProcessingId(ride.id);
    setRequestAnimation('animate-slide-out-right'); // Animate out

    // Simulate slight delay for interaction feel
    await new Promise(r => setTimeout(r, 600));

    try {
      await acceptRide(ride.id, currentDriver);
      playSound('rideAccepted');
      setActiveRide({ ...ride, status: 'accepted', driver: currentDriver });
      setIncomingRides([]);
      setVerificationCode('');
    } catch (error) {
      playSound('error');
      alert("Erro ao aceitar. Talvez outro motorista já tenha aceitado.");
      setRequestAnimation('animate-slide-in-bottom');
    } finally {
      setProcessingId(null);
    }
  };

  const handleStartRide = async () => {
    if (!activeRide) return;
    if (activeRide.securityCode && verificationCode !== activeRide.securityCode) {
      playSound('error');
      alert("Código incorreto.");
      return;
    }
    setProcessingId('starting');
    try {
      await startRide(activeRide.id);
      playSound('rideStarted');
    } catch (error) {
      console.error(error);
      alert("Erro ao iniciar corrida.");
    } finally {
      setProcessingId(null);
    }
  };

  const [showRatingModal, setShowRatingModal] = useState(false);
  const [paymentProblem, setPaymentProblem] = useState<'none' | 'partial' | 'unpaid'>('none');
  const [partialAmount, setPartialAmount] = useState('');

  const handleFinishRide = () => {
    setShowPaymentModal(true);
    setPaymentProblem('none');
    setPartialAmount('');
  };

  const confirmFinishRide = async () => {
    if (!activeRide) return;
    setProcessingId('finishing');
    try {
      // Implement debt logic if needed (omitted for brevity, assume full payment or manual debt handling)
      // ... (Debt logic from previous version)

      await completeRide(activeRide.id);
      playSound('rideCompleted');
      setShowPaymentModal(false);
      setShowRatingModal(true);
    } catch (error) {
      console.error(error);
      alert("Erro ao finalizar corrida.");
    } finally {
      setProcessingId(null);
    }
  };

  const submitPassengerRating = async () => {
    setShowRatingModal(false);
    setActiveRide(null);
  };

  // UI Components
  if (loadingProfile) return <div className="h-full bg-gray-900 flex flex-col items-center justify-center text-white"><Loader2 className="animate-spin mb-4" size={40} /><p>Carregando perfil...</p></div>;
  if (profileError || !currentDriver) return <div className="h-full bg-gray-900 flex flex-col items-center justify-center text-white p-6 text-center"><AlertCircle className="text-red-500 mb-4" size={48} /><h2 className="text-xl font-bold mb-2">Erro</h2><Button onClick={loadDriverProfile}>Tentar Novamente</Button></div>;

  const currentRequest = incomingRides.length > 0 ? incomingRides[0] : null;

  return (
    <div className={`h-full relative overflow-hidden flex flex-col ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>

      {/* 1. Map Layer (Full Background) */}
      <div className="absolute inset-0 z-0">
        {!isLocationReady && !activeRide ? (
          <div className={`absolute inset-0 flex flex-col items-center justify-center ${darkMode ? 'bg-gray-900' : 'bg-gray-100'}`}>
            <Loader2 size={48} className="text-orange-500 animate-spin mb-4" />
            <p className="text-gray-500 font-medium">Buscando GPS...</p>
          </div>
        ) : (
          <SimulatedMap
            showDriver={true}
            status={activeRide?.status === 'in_progress' ? "Em viagem" : activeRide ? "A caminho" : "Online"}
            driverLocation={currentDriverLocation || currentDriver.location}
            initialCenter={currentDriverLocation || currentDriver.location || undefined}
            origin={activeRide?.originCoords}
            destination={activeRide?.destinationCoords}
            showRoute={!!activeRide}
            isLoading={!driverGpsLocation}
            navigationMode={isNavigating}
          />
        )}
      </div>

      {/* 2. Floating Header */}
      <div className="absolute top-0 left-0 right-0 z-20 px-4 pt-safe-4 pb-2 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
        <div className="flex justify-between items-start pointer-events-auto">
          {/* User Profile Pill */}
          <div
            onClick={() => setShowProfile(true)}
            className="flex items-center gap-3 bg-gray-900/80 backdrop-blur-md border border-gray-700 rounded-full pl-1 pr-4 py-1 shadow-lg cursor-pointer active:scale-95 transition-transform"
          >
            <img
              src={currentDriver?.avatar || "https://ui-avatars.com/api/?background=000&color=fff&name=Motorista"}
              className="w-10 h-10 rounded-full border-2 border-orange-500 object-cover"
              alt="Avatar"
            />
            <div className="flex flex-col">
              <span className="font-bold text-sm leading-tight text-white">{currentDriver?.name?.split(' ')[0] || 'Motorista'}</span>
              <div className="flex items-center gap-1">
                <Star size={10} className="text-yellow-400 fill-yellow-400" />
                <span className="text-xs text-gray-300 font-medium">{(currentDriver?.rating || 5.0).toFixed(1)}</span>
              </div>
            </div>
          </div>

          {/* Right Side Actions */}
          <div className="flex gap-2">
            {/* Notifications Bell (New) */}
            <button
              onClick={() => setShowNotifications(true)}
              className="w-10 h-10 bg-gray-900/80 backdrop-blur-md border border-gray-700 rounded-full flex items-center justify-center text-white shadow-lg active:scale-95 transition-transform relative"
            >
              <Bell size={20} />
              <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-gray-900"></span>
            </button>

            {/* Earnings Pill */}
            <button
              onClick={() => setShowHistory(true)}
              className="flex flex-col items-end bg-gray-900/80 backdrop-blur-md border border-gray-700 rounded-2xl px-3 py-1.5 shadow-lg active:scale-95 transition-transform"
            >
              <span className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Ganhos</span>
              <span className="text-green-400 font-mono font-bold text-sm">
                {APP_CONFIG.currency}{earnings.toFixed(2)}
              </span>
            </button>

            {/* Power Button */}
            <button
              onClick={handleToggleOnlineClick}
              className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg border-2 active:scale-95 transition-all ${isOnline ? 'bg-green-500 border-green-400 text-white' : 'bg-red-500 border-red-400 text-white animate-pulse'}`}
            >
              <Power size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* 3. Offline Overlay */}
      {
        !isOnline && (
          <div className="absolute inset-0 z-30 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-2xl w-full max-w-sm flex flex-col items-center text-center border border-gray-200 dark:border-gray-700">
              <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4 relative">
                <Power size={40} className="text-gray-400" />
                <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 rounded-full border-2 border-white dark:border-gray-800"></span>
              </div>
              <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">Você está Offline</h2>
              <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">
                Fique online para começar a receber corridas próximas a você.
              </p>
              <Button onClick={goOnline} className="w-full py-4 text-lg font-bold shadow-green-500/30 shadow-lg" variant="success">
                Ficar Online Agora
              </Button>
            </div>
          </div>
        )
      }

      {/* 4. Searching State */}
      {
        isOnline && !activeRide && !currentRequest && (
          <div className="absolute bottom-10 left-0 right-0 z-10 flex flex-col items-center pointer-events-none">
            <div className="bg-gray-900/90 backdrop-blur-xl px-6 py-3 rounded-full shadow-2xl border border-gray-700 flex items-center gap-3 animate-slide-up">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span>
              </span>
              <span className="text-white font-medium text-sm">Procurando passageiros...</span>
            </div>
          </div>
        )
      }

      {/* 5. Ride Request Bottom Sheet (The Main Event) */}
      {
        currentRequest && !activeRide && (
          <div className={`absolute inset-x-0 bottom-0 z-50 bg-white dark:bg-gray-900 rounded-t-[2rem] shadow-[0_-10px_40px_rgba(0,0,0,0.5)] border-t border-gray-200 dark:border-gray-800 p-6 pb-safe-4 ${requestAnimation}`}>
            {/* Handle Bar */}
            <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mb-6"></div>

            <div className="flex justify-between items-start mb-6">
              <div>
                <Badge className="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 mb-2 border-none px-3 py-1">
                  Nova Corrida • {currentRequest.distance}km
                </Badge>
                <h2 className="text-3xl font-black text-gray-900 dark:text-white">
                  R$ {(currentRequest.price || 0).toFixed(2)}
                </h2>
              </div>
              <img
                src={currentRequest.passenger?.avatar || `https://ui-avatars.com/api/?background=f97316&color=fff&name=${encodeURIComponent(currentRequest.passenger?.name || 'P')}`}
                className="w-14 h-14 rounded-full border-[3px] border-orange-500 object-cover shadow-md"
                alt="Passageiro"
              />
            </div>

            {/* Route Timeline */}
            <div className="space-y-6 mb-8 relative pl-2">
              {/* Vertical Line */}
              <div className="absolute left-[7px] top-3 bottom-4 w-0.5 bg-gray-200 dark:bg-gray-700"></div>

              <div className="relative flex gap-4">
                <div className="w-4 h-4 rounded-full bg-green-500 mt-1 relative z-10 shadow-[0_0_0_4px_white] dark:shadow-[0_0_0_4px_#111827]"></div>
                <div>
                  <label className="text-xs uppercase font-bold text-gray-400 tracking-wider">Origem</label>
                  <p className="font-semibold text-gray-900 dark:text-gray-100 text-lg leading-tight mt-0.5">
                    {cleanAddress(currentRequest.origin)}
                  </p>
                  {currentRequest.pickupReference && (
                    <p className="text-xs text-orange-500 mt-1 flex items-center gap-1">
                      <MapPin size={10} /> {currentRequest.pickupReference}
                    </p>
                  )}
                </div>
              </div>

              <div className="relative flex gap-4">
                <div className="w-4 h-4 rounded-full bg-gray-900 dark:bg-white mt-1 relative z-10 shadow-[0_0_0_4px_white] dark:shadow-[0_0_0_4px_#111827] border-2 border-gray-900 dark:border-white"></div>
                <div>
                  <label className="text-xs uppercase font-bold text-gray-400 tracking-wider">Destino</label>
                  <p className="font-semibold text-gray-900 dark:text-gray-100 text-lg leading-tight mt-0.5">
                    {cleanAddress(currentRequest.destination)}
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <SwipeableButton
                label="Deslize para aceitar"
                successLabel="Aceitando..."
                onSwipeSuccess={() => handleAcceptRide(currentRequest)}
                isLoading={!!processingId}
                color="green"
              />

              <button
                disabled={!!processingId}
                onClick={handleRejectRide}
                className="w-full py-4 rounded-full font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
              >
                <X size={20} /> Rejeitar Corrida
              </button>
            </div>
          </div>
        )
      }

      {/* 6. Active Ride Status Panel */}
      {
        activeRide && (
          <div className="absolute inset-x-0 bottom-0 z-40 bg-white dark:bg-gray-900 rounded-t-[2rem] shadow-[0_-10px_40px_rgba(0,0,0,0.3)] p-5 pb-safe-4 border-t border-gray-200 dark:border-gray-800 animate-slide-up">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                  <User size={24} className="text-gray-600 dark:text-gray-300" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-gray-900 dark:text-white">{activeRide.passenger.name}</h3>
                  <div className="flex items-center gap-2">
                    <Badge color="blue" size="sm">Passageiro</Badge>
                    <span className="text-xs text-gray-400">4.9 ★</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 flex items-center justify-center hover:bg-green-200 transition">
                  <Phone size={20} />
                </button>
                <button onClick={() => setShowChat(true)} className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center hover:bg-blue-200 transition relative">
                  <MessageSquare size={20} />
                  {/* Badge mock */}
                  <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-white dark:border-gray-900"></span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              {activeRide.status === 'accepted' && (
                <SwipeableButton
                  label="Iniciar Corrida"
                  successLabel="Iniciando"
                  onSwipeSuccess={handleStartRide}
                  isLoading={processingId === 'starting'}
                  className="col-span-2"
                  color="blue"
                />
              )}

              {activeRide.status === 'in_progress' && (
                <SwipeableButton
                  label="Finalizar Corrida"
                  successLabel="Finalizando"
                  onSwipeSuccess={handleFinishRide}
                  color="red"
                  className="col-span-2"
                />
              )}
            </div>

            {/* Ride Details Toggle */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 mb-3">
              <div
                onClick={() => setShowActiveRideDetails(!showActiveRideDetails)}
                className="p-3 flex items-center justify-between cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 transition"
              >
                <div className="flex items-center gap-3">
                  <MapPin size={18} className="text-orange-500" />
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 max-w-[220px] truncate">
                    {cleanAddress(activeRide.status === 'in_progress' ? activeRide.destination : activeRide.origin)}
                  </p>
                </div>
                {showActiveRideDetails
                  ? <X size={16} className="text-gray-400" />
                  : <ChevronRight size={16} className="text-gray-400" />}
              </div>

              {showActiveRideDetails && (
                <div className="px-4 pb-4 space-y-3 animate-fade-in border-t border-gray-200 dark:border-gray-700 pt-3">
                  {/* Origin / Destination */}
                  <div className="space-y-2">
                    <div className="flex gap-3">
                      <div className="flex flex-col items-center mt-1">
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                        <div className="w-0.5 h-5 bg-gray-300 dark:bg-gray-600 my-0.5" />
                        <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                      </div>
                      <div className="flex-1 space-y-2">
                        <div>
                          <p className="text-[10px] uppercase font-bold text-gray-400">Partida</p>
                          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 line-clamp-1">{cleanAddress(activeRide.origin)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-bold text-gray-400">Destino</p>
                          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 line-clamp-1">{cleanAddress(activeRide.destination)}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Price, Payment, Distance, Time */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <div className="bg-white dark:bg-gray-900 p-2.5 rounded-lg">
                      <p className="text-[10px] text-gray-400 font-bold uppercase">Valor</p>
                      <p className="text-lg font-black text-gray-900 dark:text-white">R$ {(activeRide.price || 0).toFixed(2)}</p>
                    </div>
                    <div className="bg-white dark:bg-gray-900 p-2.5 rounded-lg">
                      <p className="text-[10px] text-gray-400 font-bold uppercase">Pagamento</p>
                      <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
                        {activeRide.paymentMethod === 'cash' ? 'Dinheiro' :
                          activeRide.paymentMethod === 'pix' ? 'PIX' :
                            activeRide.paymentMethod === 'credit_machine' ? 'Crédito' :
                              activeRide.paymentMethod === 'debit_machine' ? 'Débito' :
                                activeRide.paymentMethod === 'corporate' ? 'Corporativo' : 'Outro'}
                      </p>
                    </div>
                    <div className="bg-white dark:bg-gray-900 p-2.5 rounded-lg">
                      <p className="text-[10px] text-gray-400 font-bold uppercase">Distância</p>
                      <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{activeRide.distance || '—'} km</p>
                    </div>
                    <div className="bg-white dark:bg-gray-900 p-2.5 rounded-lg">
                      <p className="text-[10px] text-gray-400 font-bold uppercase">Tempo Est.</p>
                      <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{activeRide.duration || '—'}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Compact Navigation Button */}
            <button
              onClick={() => setShowNavOptions(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold text-sm transition active:scale-[0.98] shadow-lg shadow-blue-500/20 mb-1"
            >
              <Navigation size={16} />
              Navegar
            </button>

            {/* Navigation Options Bottom Sheet */}
            {showNavOptions && (() => {
              const targetCoords = activeRide.status === 'in_progress' ? activeRide.destinationCoords : activeRide.originCoords;
              const targetAddr = activeRide.status === 'in_progress' ? activeRide.destination : activeRide.origin;
              const lat = targetCoords?.lat || 0;
              const lng = targetCoords?.lng || 0;
              return (
                <>
                  <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setShowNavOptions(false)} />
                  <div className="fixed inset-x-0 bottom-0 z-[61] bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl p-6 pb-safe-4 animate-slide-up">
                    <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Como deseja navegar?</h3>
                    <p className="text-sm text-gray-500 mb-5 truncate">Destino: {targetAddr}</p>
                    <div className="space-y-3">
                      {/* Option 1: MotoJá Internal */}
                      <button
                        onClick={() => {
                          setShowNavOptions(false);
                          setIsNavigating(true);
                        }}
                        className="w-full flex items-center gap-4 p-4 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/40 rounded-2xl transition border border-orange-200 dark:border-orange-800"
                      >
                        <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
                          <MapPin size={24} className="text-white" />
                        </div>
                        <div className="text-left">
                          <p className="font-bold text-gray-900 dark:text-white">MotoJá</p>
                          <p className="text-xs text-gray-500">Navegar pelo app</p>
                        </div>
                        <ChevronRight size={16} className="text-gray-300 ml-auto" />
                      </button>

                      {/* Option 2: Waze */}
                      <button
                        onClick={() => {
                          window.open(`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`, '_blank');
                          setShowNavOptions(false);
                        }}
                        className="w-full flex items-center gap-4 p-4 bg-sky-50 dark:bg-sky-900/20 hover:bg-sky-100 dark:hover:bg-sky-900/40 rounded-2xl transition border border-sky-200 dark:border-sky-800"
                      >
                        <div className="w-12 h-12 bg-sky-500 rounded-xl flex items-center justify-center shadow-lg shadow-sky-500/20">
                          <Navigation size={24} className="text-white" />
                        </div>
                        <div className="text-left">
                          <p className="font-bold text-gray-900 dark:text-white">Waze</p>
                          <p className="text-xs text-gray-500">Abrir rota no Waze</p>
                        </div>
                        <ChevronRight size={16} className="text-gray-300 ml-auto" />
                      </button>

                      {/* Option 3: Google Maps */}
                      <button
                        onClick={() => {
                          window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`, '_blank');
                          setShowNavOptions(false);
                        }}
                        className="w-full flex items-center gap-4 p-4 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/40 rounded-2xl transition border border-green-200 dark:border-green-800"
                      >
                        <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/20">
                          <MapPin size={24} className="text-white" />
                        </div>
                        <div className="text-left">
                          <p className="font-bold text-gray-900 dark:text-white">Google Maps</p>
                          <p className="text-xs text-gray-500">Abrir rota no Google Maps</p>
                        </div>
                        <ChevronRight size={16} className="text-gray-300 ml-auto" />
                      </button>
                    </div>

                    <button
                      onClick={() => setShowNavOptions(false)}
                      className="w-full mt-4 py-3 text-gray-500 font-medium text-sm hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl transition"
                    >
                      Cancelar
                    </button>
                  </div>
                </>
              );
            })()}



            {/* Mensagem de Áudio Init (Invisível) */}
            <button id="init-audio-btn" className="hidden" onClick={initAudio}>Init Audio</button>
            <button
              onClick={() => setShowCancelModal(true)}
              className="w-full mt-4 py-3 text-red-500 font-medium text-sm hover:bg-red-50 rounded-xl transition border border-transparent hover:border-red-100"
            >
              Cancelar Corrida
            </button>
          </div>
        )
      }




      {/* Cancellation Modal */}
      {
        showCancelModal && activeRide && (
          <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-fade-in">
            <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-slide-up">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Cancelar Corrida?</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">Selecione o motivo do cancelamento:</p>

              <div className="space-y-3 mb-6">
                {[
                  "Passageiro não encontrado",
                  "Endereço errado/inacessível",
                  "Passageiro solicitou cancelamento",
                  "Problema mecânico/pneu furado",
                  "Trânsito intenso/Bloqueio",
                  "Outro motivo"
                ].map(reason => (
                  <button
                    key={reason}
                    onClick={async () => {
                      await cancelRide(activeRide.id, reason, 'driver');
                      setShowCancelModal(false);
                      setActiveRide(null); // Force clear active ride to return to map
                      showNotification('rideCancelled');
                    }}
                    className="w-full p-4 text-left text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl border border-gray-100 dark:border-gray-600 transition flex justify-between items-center group"
                  >
                    <span className="font-medium text-sm">{reason}</span>
                    <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-500" />
                  </button>
                ))}
              </div>

              <Button variant="outline" className="w-full py-3" onClick={() => setShowCancelModal(false)}>
                Voltar
              </Button>
            </div>
          </div>
        )
      }

      {/* Modals (Profile, History, Chat, Payment) */}
      {showProfile && <ProfileScreen user={currentDriver} isDriver={true} onBack={() => setShowProfile(false)} onSave={(u) => { setCurrentDriver(u); setShowProfile(false); }} />}

      {showChat && activeRide && <ChatModal rideId={activeRide.id} currentUserId={currentDriver.id} onClose={() => setShowChat(false)} otherUserName={activeRide.passenger.name} />}
      {showHistory && <RideHistoryModal rides={historyRides} earnings={earnings} onClose={() => setShowHistory(false)} />}
      {showNotifications && <NotificationsScreen onBack={() => setShowNotifications(false)} />}

      {/* Offline Confirmation */}
      {
        showOfflineConfirm && (
          <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-2xl w-full max-w-sm">
              <h3 className="text-xl font-bold mb-2">Ficar Offline?</h3>
              <p className="text-gray-500 mb-6">Você deixará de receber novas corridas.</p>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowOfflineConfirm(false)} className="flex-1">Cancelar</Button>
                <Button onClick={confirmGoOffline} className="flex-1 bg-red-500 hover:bg-red-600">Sim, Sair</Button>
              </div>
            </div>
          </div>
        )
      }

      {/* Payment Confirmation Modal - Simple Version */}
      {
        showPaymentModal && (
          <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-6 animate-fade-in">
            <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 w-full max-w-sm text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={32} className="text-green-600" />
              </div>
              <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">Corrida Finalizada!</h2>
              <p className="text-gray-500 mb-6">Confirme o recebimento do pagamento em dinheiro ou PIX.</p>

              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl mb-6">
                <span className="text-gray-500 text-sm">Valor Total</span>
                <p className="text-3xl font-black text-gray-900 dark:text-white">R$ {activeRide?.price?.toFixed(2)}</p>
              </div>

              <div className="flex gap-3">
                <Button onClick={() => setShowPaymentModal(false)} variant="outline" className="flex-1"> Cancelar </Button>
                <Button onClick={confirmFinishRide} className="flex-1 text-lg font-bold">
                  Confirmar
                </Button>
              </div>
            </div>
          </div>
        )
      }

      {/* Full Screen Navigation Overlay */}
      {isNavigating && activeRide && (
        <div className="absolute inset-0 z-[100] flex flex-col pointer-events-none">
          {/* Top HUD: Direction */}
          <div className="bg-gray-900/90 backdrop-blur-md p-4 pt-safe-top pb-6 rounded-b-[2rem] shadow-2xl pointer-events-auto animate-slide-down">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 bg-green-500 rounded-2xl flex items-center justify-center shadow-lg shadow-green-500/20 shrink-0">
                <ArrowRight size={32} className="text-white -rotate-45" />
              </div>
              <div className="flex-1">
                <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Em 200 metros</p>
                <h2 className="text-white text-2xl font-black leading-tight">
                  Vire à direita na {cleanAddress(activeRide.status === 'in_progress' ? activeRide.destination : activeRide.origin).split(',')[0]}
                </h2>
              </div>
            </div>
          </div>

          <div className="flex-1" />

          {/* Bottom HUD: Trip Info */}
          <div className="bg-white dark:bg-gray-900 p-5 pb-safe-4 rounded-t-[2rem] shadow-[0_-10px_40px_rgba(0,0,0,0.4)] pointer-events-auto animate-slide-up">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-3xl font-black text-green-500">{(activeRide.duration || '12 min').replace(' mins', ' min')}</p>
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 font-bold">
                  <span>{activeRide.distance || '4.5'} km</span>
                  <span>•</span>
                  <span>12:42</span>
                </div>
              </div>

              <button
                onClick={() => setIsNavigating(false)}
                className="w-14 h-14 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center text-red-600 hover:bg-red-200 dark:hover:bg-red-900/50 transition active:scale-90"
              >
                <X size={28} />
              </button>
            </div>

            <div className="w-full bg-gray-200 dark:bg-gray-800 h-1.5 rounded-full mt-4 overflow-hidden">
              <div className="h-full bg-green-500 w-[45%]" />
            </div>
            <p className="text-center text-xs text-gray-400 font-bold mt-2 uppercase tracking-widest">Navegando com MotoJá</p>
          </div>
        </div>
      )}

    </div>
  );
};