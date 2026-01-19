import React, { useState, useEffect, useRef } from 'react';
import {
  MapPin, Search, Wallet, Star, Info, X, AlertCircle, CheckCircle,
  MessageSquare, Phone, History, User as UserIcon, CreditCard, LogOut,
  Menu, Loader2, ChevronDown, ChevronUp, Calendar, ArrowLeft, Clock,
  RefreshCw, Package, Bike, Plus, Trash2, HelpCircle, ChevronRight,
  FileQuestion, ExternalLink, Crosshair, ArrowDownUp, Navigation, Lock,
  GripVertical, ShieldCheck, Eye, EyeOff, Map as MapIcon, Copy, QrCode
} from 'lucide-react';
import { logout } from '../services/auth';
import { Button, Card, Badge, Input } from '../components/UI';
import { AddressAutocomplete } from '../components/AddressAutocomplete';
import { SimulatedMap } from '../components/SimulatedMap';
import { ChatModal } from '../components/ChatModal';
import { ProfileScreen } from './ProfileScreen';
import { SERVICES, APP_CONFIG, MOCK_DRIVER } from '../constants';
import { ServiceType, RideRequest, User, Coords, PaymentMethod, Company } from '../types';
import { createRideRequest, subscribeToRide, cancelRide, getRideHistory } from '../services/ride';
import { createPixPayment, checkPayment } from '../services/mercadopago';
import { getOrCreateUserProfile } from '../services/user';
import { getCompany } from '../services/company';
import { calculateRoute, calculatePrice, reverseGeocode, searchAddress } from '../services/map';
import { useAuth } from '../context/AuthContext';
import { useGeoLocation } from '../hooks/useGeoLocation';
import { playSound, initAudio } from '../services/audio';
import { showNotification, ensureNotificationPermission } from '../services/notifications';
// Note: useJsApiLoader is handled internally by SimulatedMap component

interface RoutePoint {
  id: string;
  address: string;
  coords: Coords | null;
}

export const UserApp = () => {
  const { user: authUser } = useAuth();
  const { location: userLocation, getCurrentLocation, loading: loadingLocation } = useGeoLocation();

  // Maps loading is handled by SimulatedMap component internally
  // This avoids duplicate loading and race conditions that cause white screen

  const [step, setStep] = useState<'home' | 'select_dest' | 'confirm' | 'searching' | 'ride' | 'rating' | 'history' | 'profile' | 'payments' | 'help'>('home');

  const [routePoints, setRoutePoints] = useState<RoutePoint[]>([
    { id: 'origin', address: 'Localizando...', coords: null },
    { id: 'dest_final', address: '', coords: null }
  ]);

  const [originCoords, setOriginCoords] = useState<Coords | null>(null);
  const [destCoords, setDestCoords] = useState<Coords | null>(null);
  const [bookingMode, setBookingMode] = useState<'ride' | 'delivery'>('ride');
  const [deliveryType, setDeliveryType] = useState<'send' | 'receive'>('send');

  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [useSecurityCode, setUseSecurityCode] = useState(false);
  const [securityToken, setSecurityToken] = useState<string | null>(null);

  const [showDeliveryInfo, setShowDeliveryInfo] = useState(false);
  const [selectedService, setSelectedService] = useState<ServiceType>(ServiceType.MOTO_TAXI);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>('pix');
  const [userCompany, setUserCompany] = useState<Company | null>(null);
  const [rideStatus, setRideStatus] = useState('');
  const [routeInfo, setRouteInfo] = useState<{ distance: string, duration: string, distanceVal: number } | null>(null);
  const [calculatingRoute, setCalculatingRoute] = useState(false);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [currentRideId, setCurrentRideId] = useState<string | null>(null);
  const [currentRide, setCurrentRide] = useState<RideRequest | null>(null);
  const [historyRides, setHistoryRides] = useState<RideRequest[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [isBooking, setIsBooking] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [paymentFeedback, setPaymentFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  // PIX Payment State
  const [showPixModal, setShowPixModal] = useState(false);
  const [pixData, setPixData] = useState<{
    qr_code: string;
    qr_code_base64: string;
    ticket_url: string;
  } | null>(null);
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);

  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [rating, setRating] = useState(0);

  const [showRideDetails, setShowRideDetails] = useState(false);

  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  useEffect(() => {
    if (userLocation && step === 'home') {
      setOriginCoords(userLocation);
      const fetchAddress = async () => {
        // reverseGeocode has internal fallback if Maps is not loaded
        const address = await reverseGeocode(userLocation.lat, userLocation.lng);
        setRoutePoints(prev => {
          const newPoints = [...prev];
          if (newPoints[0]) {
            newPoints[0] = { ...newPoints[0], address, coords: userLocation };
          }
          return newPoints;
        });
      };
      fetchAddress();
    }
  }, [userLocation, step]);

  const handleCenterLocation = () => {
    setRoutePoints(prev => {
      const newPoints = [...prev];
      newPoints[0] = { ...newPoints[0], address: "Atualizando GPS..." };
      return newPoints;
    });

    if (userLocation) {
      setOriginCoords(userLocation);
      // reverseGeocode has internal fallback if Maps is not loaded
      reverseGeocode(userLocation.lat, userLocation.lng).then(address => {
        setRoutePoints(prev => {
          const newPoints = [...prev];
          newPoints[0] = { ...newPoints[0], address, coords: userLocation };
          return newPoints;
        });
      });
    } else {
      getCurrentLocation();
    }
  };

  const loadUserProfile = async () => {
    if (!authUser) return;
    setLoadingProfile(true);
    setProfileError(null);
    try {
      const profile = await getOrCreateUserProfile(authUser.uid, authUser.email || '', 'user');
      setCurrentUser(profile as User);

      // Check for company
      if (profile && 'companyId' in profile && profile.companyId) {
        getCompany(profile.companyId).then(setUserCompany);
      }
    } catch (err: any) {
      console.error("Erro crítico ao carregar perfil:", err);
      // Fallback robusto para evitar tela branca
      const mockUser = {
        id: authUser.uid,
        name: authUser.email?.split('@')[0] || 'Usuario Demo',
        email: authUser.email || '',
        phone: '',
        rating: 5,
        avatar: `https://ui-avatars.com/api/?name=${authUser.email}`,
        role: 'user'
      } as User;
      setCurrentUser(mockUser);
    } finally {
      setLoadingProfile(false);
    }
  };

  // Efeito com Timeout de Segurança para evitar travamento eterno
  useEffect(() => {
    let mounted = true;

    // Inicia carregamento
    loadUserProfile();

    // Timeout de segurança: se em 4 segundos não carregar, libera a UI
    const safetyTimeout = setTimeout(() => {
      if (mounted && loadingProfile) {
        console.warn("⚠️ Perfil demorou muito para carregar. Liberando UI.");
        setLoadingProfile(false);
        if (!currentUser && authUser) {
          // Define um usuário temporário se falhou tudo
          setCurrentUser({
            id: authUser.uid,
            name: authUser.email?.split('@')[0] || 'Usuario',
            email: authUser.email || '',
            phone: '',
            rating: 5,
            avatar: `https://ui-avatars.com/api/?name=${authUser.email}`,
            role: 'user'
          } as User);
        }
      }
    }, 4000);

    return () => {
      mounted = false;
      clearTimeout(safetyTimeout);
    };
  }, [authUser]);

  useEffect(() => {
    if (step === 'history' && currentUser) {
      const fetchHistory = async () => {
        setLoadingHistory(true);
        const rides = await getRideHistory(currentUser.id, 'passenger');
        setHistoryRides(rides);
        setLoadingHistory(false);
      };
      fetchHistory();
    }
  }, [step, currentUser]);

  // Referência para rastrear o status anterior da corrida
  const prevRideStatusRef = useRef<string | null>(null);

  useEffect(() => {
    if (currentRideId) {
      const unsubscribe = subscribeToRide(currentRideId, (updatedRide) => {
        const prevStatus = prevRideStatusRef.current;
        const newStatus = updatedRide.status;

        setCurrentRide(updatedRide);

        // Tocar sons e mostrar notificações baseado na mudança de status
        if (prevStatus !== newStatus) {
          if (newStatus === 'accepted' && prevStatus !== 'accepted') {
            playSound('rideAccepted');
            showNotification('rideAccepted', {
              driverName: updatedRide.driver?.name
            });
            setStep('ride');
            setRideStatus('Seu piloto está a caminho!');
          } else if (newStatus === 'in_progress' && prevStatus !== 'in_progress') {
            playSound('rideStarted');
            showNotification('rideStarted');
            setRideStatus('Em viagem para o destino');
          } else if (newStatus === 'completed') {
            playSound('rideCompleted');
            showNotification('rideCompleted');
            setStep('rating');
            setCurrentRideId(null);
            setShowChat(false);
            setShowRideDetails(false);
          } else if (newStatus === 'cancelled') {
            playSound('error');
            showNotification('rideCancelled');
            setStep('home');
            setCurrentRideId(null);
            setShowChat(false);
            setShowRideDetails(false);
            alert('A corrida foi cancelada.');
          }
          prevRideStatusRef.current = newStatus;
        }
      });
      return () => unsubscribe();
    }
  }, [currentRideId]);

  const handleDragSort = () => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    const _routePoints = [...routePoints];
    const draggedItemContent = _routePoints[dragItem.current];
    _routePoints.splice(dragItem.current, 1);
    _routePoints.splice(dragOverItem.current, 0, draggedItemContent);
    dragItem.current = null;
    dragOverItem.current = null;
    setRoutePoints(_routePoints);
  };

  const handleAddStop = () => {
    if (routePoints.length >= 4) return;
    const newStop: RoutePoint = {
      id: `stop_${Date.now()}`,
      address: '',
      coords: null
    };
    const newPoints = [...routePoints];
    newPoints.splice(newPoints.length - 1, 0, newStop);
    setRoutePoints(newPoints);
  };

  const handleRemoveStop = (index: number) => {
    if (routePoints.length <= 2) return;
    const newPoints = routePoints.filter((_, i) => i !== index);
    setRoutePoints(newPoints);
  };

  const handlePointUpdate = (index: number, address: string, coords: Coords | null) => {
    const newPoints = [...routePoints];
    newPoints[index] = { ...newPoints[index], address, coords };
    setRoutePoints(newPoints);
  };

  const handleConfirmRoute = async () => {
    const updatedPoints = [...routePoints];
    let hasUpdates = false;

    updatedPoints.forEach((point) => {
      if (point.address && point.address.length > 3 && !point.coords) {
        // Gera coordenada simulada perto da origem (ou Avaré)
        const baseLat = originCoords?.lat || -23.1047;
        const baseLng = originCoords?.lng || -48.9213;
        point.coords = {
          lat: baseLat + (Math.random() - 0.5) * 0.05,
          lng: baseLng + (Math.random() - 0.5) * 0.05
        };
        hasUpdates = true;
      }
    });

    if (hasUpdates) {
      setRoutePoints(updatedPoints);
      await new Promise(r => setTimeout(r, 100));
    }

    const missingPoint = updatedPoints.some(p => !p.address);
    if (missingPoint) {
      alert("Por favor, preencha o endereço.");
      return;
    }

    setCalculatingRoute(true);

    const origin = updatedPoints[0];
    const destination = updatedPoints[updatedPoints.length - 1];

    const safeOriginCoords = origin.coords || { lat: -23.1047, lng: -48.9213 };
    const safeDestCoords = destination.coords || { lat: -23.1100, lng: -48.9300 };

    const waypoints = updatedPoints.slice(1, updatedPoints.length - 1).map(p => p.coords!).filter(Boolean);

    setDestCoords(safeDestCoords);
    setOriginCoords(safeOriginCoords);

    const route = await calculateRoute(safeOriginCoords, safeDestCoords, waypoints);

    setRouteInfo({
      distance: route.distance,
      duration: route.duration,
      distanceVal: route.distanceValue
    });

    // --- LÓGICA DE SEGURANÇA ADICIONADA ---
    // Geramos o token agora para exibi-lo na próxima tela
    if (useSecurityCode) {
      setSecurityToken(Math.floor(1000 + Math.random() * 9000).toString());
    } else {
      setSecurityToken(null);
    }
    // --------------------------------------

    setCalculatingRoute(false);
    setStep('confirm');
  };

  const handleBook = async () => {
    if (!routePoints[routePoints.length - 1].address) return alert("Defina o destino!");
    if (!currentUser) return;
    if (!routeInfo) return;

    if (bookingMode === 'delivery') {
      if (!contactName.trim()) return alert("Informe o nome do contato.");
      if (!contactPhone.trim()) return alert("Informe o telefone do contato.");
    }

    // Solicitar permissão de notificação quando usuário faz primeira corrida
    ensureNotificationPermission();

    setIsBooking(true);
    try {
      const price = calculatePrice(selectedService, routeInfo.distanceVal);
      const originP = routePoints[0];
      const destP = routePoints[routePoints.length - 1];

      // Usa o token gerado anteriormente na tela de confirmação
      const finalSecurityCode = securityToken || undefined;

      const deliveryDetails = bookingMode === 'delivery' ? {
        type: deliveryType,
        contactName,
        contactPhone
      } : undefined;

      let displayDestination = destP.address;
      if (routePoints.length > 2) {
        const stopsCount = routePoints.length - 2;
        displayDestination = `${destP.address} (+${stopsCount} parada${stopsCount > 1 ? 's' : ''})`;
      }

      const rideId = await createRideRequest(
        currentUser,
        originP.address,
        displayDestination,
        originP.coords || originCoords,
        destP.coords || destCoords,
        selectedService,
        price,
        routeInfo.distance,
        routeInfo.duration,
        deliveryDetails,
        finalSecurityCode,
        selectedPaymentMethod,
        selectedPaymentMethod === 'corporate' && userCompany ? userCompany.id : undefined
      );

      setCurrentRideId(rideId);
      setStep('searching');
    } catch (error) {
      alert("Erro ao solicitar corrida.");
      console.error(error);
    } finally {
      setIsBooking(false);
    }
  };

  const handlePay = async () => {
    if (!currentRide) return;

    if (currentRide.paymentMethod === 'corporate') {
      alert('Esta corrida será faturada para sua empresa.');
      return;
    }

    setIsPaying(true);

    try {
      const payment = await createPixPayment(
        currentRide.id,
        currentRide.price || 0,
        currentUser?.email || 'user@motoja.com'
      );

      setPixData(payment);
      setShowPixModal(true);
    } catch (e) {
      console.error(e);
      setPaymentFeedback({ type: 'error', message: 'Erro ao gerar pagamento PIX. Tente novamente.' });
      setTimeout(() => setPaymentFeedback(null), 3000);
      setIsPaying(false);
    }
  };

  const handleCheckPayment = async (manual = true) => {
    if (!pixData || !currentRide) return;

    if (manual) setIsCheckingPayment(true);

    try {
      const status = await checkPayment(pixData.id || "sim_" + currentRide.id);

      if (status === 'approved' || status === 'unknown') {
        setShowPixModal(false);
        setPaymentFeedback({ type: 'success', message: 'Pagamento confirmado!' });
        playSound('payment');
      } else {
        if (manual) alert("Pagamento ainda não confirmado. Aguarde alguns instantes.");
      }
    } catch (error) {
      console.error(error);
    } finally {
      if (manual) setIsCheckingPayment(false);
    }
  };

  const handleCancelRide = async () => {
    if (currentRideId) {
      await cancelRide(currentRideId);
    }
    setShowCancelConfirm(false);
    setStep('home');
    setRouteInfo(null);
    setCurrentRideId(null);
    setDestCoords(null);
  };

  const submitRating = () => {
    setStep('home');
    setRouteInfo(null);
    setRating(0);
    setCurrentRide(null);
    setDestCoords(null);
    setRoutePoints([
      { id: 'origin', address: routePoints[0].address, coords: routePoints[0].coords },
      { id: 'dest_final', address: '', coords: null }
    ]);
    setContactName('');
    setContactPhone('');
    setSecurityToken(null);
    setPaymentFeedback(null);
  };

  const confirmLogout = async () => {
    try { await logout(); window.location.reload(); } catch (error) { console.error(error); }
  };

  const getServiceIcon = (type: string) => {
    switch (type) {
      case 'passenger': return <div className="p-3 bg-orange-100 text-orange-600 rounded-full"><UserIcon size={24} fill="currentColor" className="opacity-20" /><UserIcon size={24} className="absolute" /></div>;
      case 'package': return <div className="p-3 bg-blue-100 text-blue-600 rounded-full"><Package size={24} /></div>;
      case 'bike': return <div className="p-3 bg-green-100 text-green-600 rounded-full"><Bike size={24} /></div>;
      default: return <div className="p-3 bg-gray-100 text-gray-600 rounded-full"><Search size={24} /></div>;
    }
  };

  if (loadingProfile) {
    return <div className="h-full flex flex-col items-center justify-center bg-gray-50"><Loader2 className="animate-spin text-orange-500 mb-4" size={48} /><p className="text-gray-500 font-medium">Carregando seu perfil...</p></div>;
  }

  const RenderSideMenu = () => (
    <>
      <div className={`absolute inset-0 z-40 bg-black/50 transition-opacity duration-300 ${showMenu ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setShowMenu(false)} />
      <div className={`absolute top-0 left-0 bottom-0 w-3/4 max-w-xs bg-white z-50 shadow-2xl transition-transform duration-300 transform ${showMenu ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 bg-orange-500 text-white pt-12">
          <div className="flex items-center gap-4 mb-4">
            <img src={currentUser?.avatar} alt="User" className="w-16 h-16 rounded-full border-4 border-white/30 object-cover" />
            <div><h3 className="font-bold text-lg capitalize">{currentUser?.name}</h3><div className="flex items-center gap-1 text-orange-100 text-sm"><Star size={12} fill="currentColor" /><span>{currentUser?.rating}</span></div></div>
          </div>
        </div>
        <div className="p-4 space-y-2">
          <div onClick={() => { setStep('profile'); setShowMenu(false); }} className="flex items-center gap-3 p-3 text-gray-700 hover:bg-gray-50 rounded-xl cursor-pointer"><UserIcon size={20} /> <span className="font-medium">Meu Perfil</span></div>
          <div onClick={() => { setStep('payments'); setShowMenu(false); }} className="flex items-center gap-3 p-3 text-gray-700 hover:bg-gray-50 rounded-xl cursor-pointer"><CreditCard size={20} /> <span className="font-medium">Pagamentos</span></div>
          <div onClick={() => { setStep('history'); setShowMenu(false); }} className="flex items-center gap-3 p-3 text-gray-700 hover:bg-gray-50 rounded-xl cursor-pointer"><History size={20} /> <span className="font-medium">Histórico</span></div>
          <div onClick={() => { setStep('help'); setShowMenu(false); }} className="flex items-center gap-3 p-3 text-gray-700 hover:bg-gray-50 rounded-xl cursor-pointer"><HelpCircle size={20} /> <span className="font-medium">Ajuda</span></div>
          <div className="border-t border-gray-100 my-2"></div>
          <div onClick={() => { setShowMenu(false); setShowLogoutConfirm(true); }} className="flex items-center gap-3 p-3 text-red-500 hover:bg-red-50 rounded-xl cursor-pointer"><LogOut size={20} /> <span className="font-medium">Sair</span></div>
        </div>
      </div>
    </>
  );

  const RenderPayments = () => <div className="p-4"><Button onClick={() => setStep('home')}>Voltar</Button><h1>Pagamentos</h1></div>;
  const RenderHelp = () => <div className="p-4"><Button onClick={() => setStep('home')}>Voltar</Button><h1>Ajuda</h1></div>;

  const RenderHome = () => (
    <>
      <div className="absolute top-0 left-0 right-0 z-20 p-4 flex justify-between items-start bg-gradient-to-b from-black/50 to-transparent pb-12 pointer-events-none">
        <button onClick={() => { initAudio(); setShowMenu(true); }} className="bg-white p-2 rounded-full shadow-md text-gray-700 pointer-events-auto active:scale-90 transition"><Menu size={24} /></button>
      </div>
      <div className="absolute inset-0 z-0"><SimulatedMap origin={originCoords} /></div>
      <div className="absolute bottom-52 right-4 z-20">
        <button onClick={handleCenterLocation} className="bg-white p-3 rounded-full shadow-lg text-gray-700 active:bg-gray-100 active:scale-95 transition-all flex items-center justify-center border border-gray-100">
          {loadingLocation ? <Loader2 size={24} className="animate-spin text-orange-500" /> : <Crosshair size={24} />}
        </button>
      </div>
      <div className="absolute bottom-0 left-0 right-0 z-20 bg-white rounded-t-3xl shadow-[0_-5px_20px_rgba(0,0,0,0.1)] p-5 pb-8 animate-slide-up max-h-[75vh] overflow-y-auto">
        <div className="mb-4 flex items-center gap-2 text-sm text-gray-500 bg-gray-50 p-2 rounded-lg border border-gray-100">
          <div className="bg-green-100 p-1 rounded-full"><MapPin size={12} className="text-green-600" /></div>
          <span className="truncate flex-1 font-medium">{routePoints[0].address}</span>
        </div>
        <div className="flex bg-gray-100 p-1 rounded-xl mb-4">
          <button className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${bookingMode === 'ride' ? 'bg-white shadow text-orange-600' : 'text-gray-500'}`} onClick={() => setBookingMode('ride')}>Viagem</button>
          <button className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${bookingMode === 'delivery' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`} onClick={() => setBookingMode('delivery')}>Entrega</button>
        </div>
        {bookingMode === 'delivery' && (
          <div className="animate-fade-in">
            <div className="flex gap-3 mb-4">
              <button onClick={() => setDeliveryType('send')} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-sm font-medium transition-all ${deliveryType === 'send' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-gray-200 text-gray-600'}`}><ArrowUpIcon size={16} /> Enviar</button>
              <button onClick={() => setDeliveryType('receive')} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-sm font-medium transition-all ${deliveryType === 'receive' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-gray-200 text-gray-600'}`}><ArrowDownIcon size={16} /> Receber</button>
            </div>
            <div className="bg-gray-50 p-4 rounded-xl mb-4 border border-gray-100 shadow-inner">
              <div className="flex items-start gap-2 text-xs text-blue-700 bg-blue-50 p-2 rounded-lg mb-3 border border-blue-100"><Info size={14} className="mt-0.5 flex-shrink-0 text-blue-600" /><span>A função entrega é apenas para pequenos pacotes que comportam uma moto ou bike levar.</span></div>
              <p className="text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-2"><UserIcon size={12} /> Contato de quem vai {deliveryType === 'send' ? 'receber' : 'entregar'}</p>
              <div className="grid grid-cols-2 gap-3">
                <Input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Nome" />
                <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="Telefone" />
              </div>
            </div>
          </div>
        )}
        <div className="flex items-center gap-3 mb-4 px-1 py-1">
          <div onClick={() => setUseSecurityCode(!useSecurityCode)} className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-300 ${useSecurityCode ? 'bg-green-500' : 'bg-gray-300'}`}><div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${useSecurityCode ? 'translate-x-5' : ''}`} /></div>
          <div className="flex-1 cursor-pointer" onClick={() => setUseSecurityCode(!useSecurityCode)}>
            <span className="text-sm font-medium text-gray-700 flex items-center gap-1">{useSecurityCode ? <ShieldCheck size={16} className="text-green-600" /> : <Lock size={16} className="text-gray-400" />} Gerar código de confirmação?</span>
            <p className="text-[10px] text-gray-400 leading-tight">{bookingMode === 'delivery' ? 'Código para finalizar a entrega' : 'Código para iniciar a viagem'}</p>
          </div>
        </div>
        <h2 className="text-xl font-bold mb-4 text-gray-800">{bookingMode === 'ride' ? 'Para onde vamos?' : deliveryType === 'send' ? 'Onde entregar?' : 'Onde buscar?'}</h2>
        <div className="bg-gray-100 p-3 rounded-xl flex items-center gap-3 mb-2 cursor-pointer hover:bg-gray-200 transition" onClick={() => setStep('select_dest')}>
          <Search className="text-gray-500" />
          <span className="text-gray-500 font-medium">Buscar endereço ou rota...</span>
        </div>
      </div>
    </>
  );

  const RenderConfirm = () => {
    const filteredServices = SERVICES.filter(service => {
      if (bookingMode === 'ride') return service.category === 'ride';
      return service.category === 'delivery';
    });

    // Obter os waypoints para passar para o mapa
    const waypoints = routePoints.slice(1, routePoints.length - 1).map(p => p.coords!).filter(Boolean);

    return (
      <>
        {/* Passamos os waypoints para o mapa para visualização correta */}
        <div className="absolute inset-0 z-0"><SimulatedMap showRoute origin={originCoords} destination={destCoords} waypoints={waypoints} /></div>
        <div className="absolute bottom-0 left-0 right-0 z-20 bg-white rounded-t-3xl shadow-xl p-5 pb-8 max-h-[85vh] overflow-y-auto">
          <div className="flex items-center gap-2 mb-4">
            <button onClick={() => setStep('select_dest')} className="p-2 hover:bg-gray-100 rounded-full"><ArrowLeft size={20} /></button>
            <h3 className="font-bold text-lg">Confirmar {bookingMode === 'ride' ? 'Viagem' : 'Entrega'}</h3>
          </div>

          {/* EXIBIÇÃO CLARA DO CÓDIGO DE SEGURANÇA NA TELA DE CONFIRMAÇÃO */}
          {securityToken && (
            <div className="mb-4 bg-orange-50 border border-orange-200 p-4 rounded-xl flex flex-col items-center justify-center animate-fade-in text-center shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck size={20} className="text-orange-600" />
                <span className="text-orange-800 font-bold text-sm uppercase">Código de Segurança</span>
              </div>
              <div className="text-4xl font-mono font-bold text-gray-900 tracking-widest my-2 bg-white px-4 py-1 rounded-lg border border-orange-100">
                {securityToken}
              </div>
              <p className="text-xs text-orange-700 max-w-[240px] leading-tight">
                Este código garante sua segurança. Informe-o ao motorista apenas no início da corrida.
              </p>
            </div>
          )}

          {bookingMode === 'delivery' && (
            <div className="mb-4 text-sm bg-gray-50 p-3 rounded-lg border border-gray-100 flex flex-col gap-3">
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 mt-1.5 rounded-full bg-green-500 shrink-0" />
                <div>
                  <span className="text-xs font-bold text-gray-500 uppercase block">Local de Partida</span>
                  <span className="text-gray-800 font-medium leading-tight block">{routePoints[0].address}</span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 mt-1.5 rounded-sm bg-orange-500 shrink-0" />
                <div>
                  <span className="text-xs font-bold text-gray-500 uppercase block">Destino Final</span>
                  <span className="text-gray-800 font-medium leading-tight block">{routePoints[routePoints.length - 1].address}</span>
                </div>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-100">
            <div>
              <h3 className="text-sm font-bold text-gray-500 uppercase mb-1">Destino Final</h3>
              <p className="text-base text-gray-900 font-semibold max-w-[220px] leading-tight truncate">{routePoints[routePoints.length - 1].address}</p>
              {routePoints.length > 2 && (<p className="text-xs text-orange-600 mt-1 font-medium">+ {routePoints.length - 2} parada(s)</p>)}
            </div>
            {routeInfo && (<div className="text-right bg-gray-50 p-2 rounded-lg"><div className="flex items-center gap-1 text-gray-800 justify-end font-bold"><Clock size={16} className="text-orange-500" /> {routeInfo.duration}</div><p className="text-xs text-gray-500">{routeInfo.distance}</p></div>)}
          </div>
          <div className="flex flex-col gap-3 mb-6">
            {filteredServices.map((service) => {
              const price = routeInfo ? calculatePrice(service.id, routeInfo.distanceVal) : 0;
              const isBike = service.id === ServiceType.DELIVERY_BIKE;
              const isDistanceTooFar = routeInfo && routeInfo.distanceVal > 2.0;
              const isDisabled = isBike && isDistanceTooFar;
              return (
                <div key={service.id} onClick={() => !isDisabled && setSelectedService(service.id)} className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all cursor-pointer relative overflow-hidden group ${selectedService === service.id ? 'border-orange-500 bg-orange-50' : 'border-gray-100 hover:border-gray-200'} ${isDisabled ? 'opacity-60 grayscale cursor-not-allowed bg-gray-50' : ''}`}>
                  <div className="flex items-center gap-4 relative z-10">
                    <div className="flex-shrink-0 flex items-center justify-center">{getServiceIcon(service.icon)}</div>
                    <div>
                      <p className="font-bold text-gray-800">{service.name}</p>
                      <p className="text-xs text-gray-500">{service.description}</p>
                      {isDisabled && <p className="text-[10px] text-red-500 font-bold mt-1">Apenas até 2km</p>}
                    </div>
                  </div>
                  <div className="text-right relative z-10"><p className="font-bold text-gray-900 text-lg">R$ {(price || 0).toFixed(2).replace('.', ',')}</p></div>
                  {isDisabled && (<div className="absolute inset-0 bg-white/40 z-0"></div>)}
                </div>
              );
            })}
          </div>

          {/* Payment Method Selector */}
          {userCompany && (
            <div className="mb-6">
              <h3 className="font-bold text-gray-800 mb-2">Forma de Pagamento</h3>
              <div className="flex gap-3">
                <div
                  onClick={() => setSelectedPaymentMethod('pix')}
                  className={`flex-1 p-3 rounded-xl border-2 cursor-pointer flex items-center justify-center gap-2 ${selectedPaymentMethod === 'pix' ? 'border-orange-500 bg-orange-50' : 'border-gray-100'}`}
                >
                  <QrCode size={20} className={selectedPaymentMethod === 'pix' ? 'text-orange-600' : 'text-gray-400'} />
                  <span className={`font-bold ${selectedPaymentMethod === 'pix' ? 'text-gray-900' : 'text-gray-500'}`}>Pix / Dinheiro</span>
                </div>
                <div
                  onClick={() => setSelectedPaymentMethod('corporate')}
                  className={`flex-1 p-3 rounded-xl border-2 cursor-pointer flex items-center justify-center gap-2 ${selectedPaymentMethod === 'corporate' ? 'border-blue-500 bg-blue-50' : 'border-gray-100'}`}
                >
                  <div className="bg-blue-600 text-white text-[10px] items-center justify-center flex w-5 h-5 rounded-full font-bold">E</div>
                  <div className="flex flex-col items-start leading-none">
                    <span className={`font-bold ${selectedPaymentMethod === 'corporate' ? 'text-gray-900' : 'text-gray-500'}`}>Corporativo</span>
                    <span className="text-[10px] text-gray-400 max-w-[80px] truncate">{userCompany.name}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <Button fullWidth onClick={handleBook} isLoading={isBooking} className="text-lg shadow-xl shadow-orange-500/20 py-4">Confirmar {SERVICES.find(s => s.id === selectedService)?.name}</Button>
        </div>
      </>
    );
  };

  const SearchingOverlay = () => (
    // Efeito Glassmorphism com Mapa ao fundo
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center p-6 bg-white/85 backdrop-blur-xl animate-fade-in text-center">

      {/* Radar Animation - Mais sofisticada */}
      <div className="relative mb-12">
        <div className="absolute inset-0 bg-orange-500 rounded-full animate-ping opacity-20 duration-1000"></div>
        <div className="absolute inset-0 bg-orange-500 rounded-full animate-ping opacity-15 duration-2000 delay-300"></div>
        <div className="absolute inset-0 bg-orange-400 rounded-full animate-ping opacity-10 duration-3000 delay-700"></div>
        <div className="relative z-10 bg-gradient-to-br from-orange-400 to-orange-600 p-6 rounded-full shadow-2xl shadow-orange-500/40 border-4 border-white">
          <Bike size={48} className="text-white" />
        </div>
      </div>

      <h3 className="text-2xl font-bold text-gray-800 mb-2">Localizando Piloto</h3>
      <p className="text-gray-500 mb-8 max-w-xs leading-relaxed">
        Aguarde um momento, estamos conectando você ao parceiro mais próximo.
      </p>

      {/* Card do Código de Segurança (Se existir) */}
      {currentRide?.securityCode && (
        <div className="bg-white px-6 py-4 rounded-2xl mb-8 border border-gray-100 shadow-lg w-full max-w-xs relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-orange-500"></div>
          <p className="text-[10px] text-gray-400 uppercase font-bold mb-2 flex items-center justify-center gap-1">
            <ShieldCheck size={12} className="text-green-500" /> Código de Segurança
          </p>
          <p className="text-4xl font-mono font-bold tracking-[0.2em] text-gray-800 mb-1">
            {currentRide.securityCode}
          </p>
          <p className="text-[10px] text-gray-400 font-medium border-t border-gray-50 pt-2 mt-2">
            {bookingMode === 'delivery' ? "Informe ao entregar" : "Informe ao embarcar"}
          </p>
        </div>
      )}

      <Button
        variant="outline"
        onClick={() => setShowCancelConfirm(true)}
        className="px-8 rounded-full border-gray-300 text-gray-500 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-all"
      >
        Cancelar Busca
      </Button>
    </div>
  );

  const RenderPixModal = () => {
    if (!showPixModal || !pixData) return null;

    const copyToClipboard = () => {
      navigator.clipboard.writeText(pixData.qr_code);
      alert("Código PIX copiado!");
    };

    // Tratamento seguro para base64
    const hasBase64 = pixData.qr_code_base64 && pixData.qr_code_base64.length > 20;
    const imgSrc = hasBase64 ? `data:image/png;base64,${pixData.qr_code_base64}` : null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
        <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden flex flex-col max-h-[90vh]">
          <div className="p-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <QrCode className="text-green-600" /> Pagamento via PIX
            </h3>
            <button onClick={() => { setShowPixModal(false); setIsPaying(false); }} className="p-2 hover:bg-gray-200 rounded-full text-gray-500"><X size={20} /></button>
          </div>

          <div className="p-6 flex flex-col items-center overflow-y-auto">
            <div className="mb-2 text-center">
              <p className="text-gray-500 text-sm">Valor a pagar</p>
              <p className="text-3xl font-bold text-gray-900">R$ {(currentRide?.price || 0).toFixed(2)}</p>
            </div>

            {/* QR Code Container */}
            <div className="bg-white p-4 rounded-xl border-2 border-dashed border-gray-300 mb-6 flex items-center justify-center min-h-[200px] w-full max-w-[240px]">
              {imgSrc ? (
                <img src={imgSrc} alt="QR Code PIX" className="w-full h-full object-contain" />
              ) : (
                <div className="text-gray-400 text-center text-sm p-4">
                  <QrCode size={48} className="mx-auto mb-2 opacity-50" />
                  <p>QR Code Simulado</p>
                </div>
              )}
            </div>

            <div className="w-full space-y-3">
              <div className="bg-gray-100 p-3 rounded-lg flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase text-gray-500 font-bold mb-1">Código PIX Copia e Cola</p>
                  <p className="text-xs text-gray-800 font-mono truncate">{pixData.qr_code.substring(0, 30)}...</p>
                </div>
                <button onClick={copyToClipboard} className="p-2 bg-white rounded-md shadow-sm text-green-600 hover:text-green-700 active:scale-95 transition-transform"><Copy size={18} /></button>
              </div>

              <Button fullWidth onClick={() => handleCheckPayment(true)} disabled={isCheckingPayment} className="bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-200">
                {isCheckingPayment ? <Loader2 className="animate-spin" /> : "Já fiz o pagamento"}
              </Button>
            </div>
          </div>

          <div className="p-4 bg-blue-50 text-blue-800 text-xs text-center border-t border-blue-100">
            Ambiente Seguro
          </div>
        </div>
      </div>
    );
  };



  const RenderRide = () => (
    <>
      {showPixModal && <RenderPixModal />}
      <div className="absolute inset-0 z-0"><SimulatedMap showDriver={!!currentRide?.driver} showRoute status={rideStatus} origin={originCoords} destination={destCoords} driverLocation={currentRide?.driver?.location} /></div>
      <div className="absolute bottom-0 left-0 right-0 z-20 bg-white rounded-t-3xl shadow-2xl p-5 pb-8">
        <div className="flex items-center justify-between mb-4">
          {currentRide?.securityCode ? (<div className="bg-orange-50 px-3 py-1.5 rounded-lg border border-orange-100 flex items-center gap-2 shadow-sm"><Lock size={16} className="text-orange-600" /><div className="flex flex-col"><span className="text-[10px] text-orange-800 font-bold leading-none">Código</span><span className="text-lg font-mono font-bold leading-none text-orange-900">{currentRide.securityCode}</span></div></div>) : <div></div>}
          <div className="flex gap-2">
            {currentRide?.paymentMethod === 'corporate' && <Badge color="orange">Corporativo</Badge>}
            <Badge color="blue">{currentRide?.serviceType?.replace('_', ' ')}</Badge>
          </div>
        </div>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="relative"><img src={currentRide?.driver?.avatar || MOCK_DRIVER.avatar} className="w-14 h-14 rounded-full border-2 border-orange-500 p-0.5 object-cover" alt="Driver" /></div>
            <div><h3 className="font-bold text-lg text-gray-900">{currentRide?.driver?.name || "Motorista"}</h3><p className="text-sm text-gray-500">{currentRide?.driver?.vehicle || "Veículo"}</p></div>
          </div>

          {/* Botão Toggle para Detalhes da Corrida */}
          <button
            onClick={() => setShowRideDetails(!showRideDetails)}
            className="flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
          >
            {showRideDetails ? <EyeOff size={14} /> : <Eye size={14} />}
            {showRideDetails ? 'Ocultar' : 'Detalhes'}
          </button>
        </div>

        {/* Card de Detalhes da Corrida */}
        {showRideDetails && (
          <div className="mb-4 animate-fade-in">
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 shadow-inner">
              <div className="mb-2 pb-2 border-b border-gray-200">
                <p className="text-[10px] uppercase text-gray-400 font-bold mb-1">Origem</p>
                <p className="text-sm text-gray-800 font-medium leading-tight">{routePoints[0].address}</p>
              </div>
              <div className="mb-2 pb-2 border-b border-gray-200">
                <p className="text-[10px] uppercase text-gray-400 font-bold mb-1">Destino</p>
                <p className="text-sm text-gray-800 font-medium leading-tight">{routePoints[routePoints.length - 1].address}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-gray-400 font-bold mb-1">Motorista</p>
                <p className="text-sm text-gray-800 font-medium">{currentRide?.driver?.name}</p>
              </div>
            </div>
          </div>
        )}

        {/* FEEDBACK DE PAGAMENTO */}
        {paymentFeedback && (
          <div className={`mb-4 p-4 rounded-xl flex items-center gap-3 animate-fade-in ${paymentFeedback.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
            <div className={`p-2 rounded-full ${paymentFeedback.type === 'success' ? 'bg-green-100' : 'bg-red-100'}`}>
              {paymentFeedback.type === 'success' ? <CheckCircle size={20} className="text-green-600" /> : <AlertCircle size={20} className="text-red-600" />}
            </div>
            <span className="font-bold text-sm">{paymentFeedback.message}</span>
          </div>
        )}

        <Button fullWidth onClick={handlePay} disabled={isPaying || currentRide?.paymentStatus === 'completed'} className={`mb-2 ${currentRide?.paymentStatus === 'completed' ? 'bg-green-500 hover:bg-green-600' : ''}`}>{currentRide?.paymentStatus === 'completed' ? <><CheckCircle size={20} /> Pagamento Realizado</> : "Pagar Agora"}</Button>
        <div className="grid grid-cols-2 gap-3"><Button variant="secondary" onClick={() => setShowChat(true)}><MessageSquare size={18} /> Chat</Button><Button variant="secondary"><Phone size={18} /> Ligar</Button></div>
      </div>
    </>
  );

  const RenderSelectDest = () => (
    <div className="h-full bg-white flex flex-col">
      <div className="p-4 shadow-sm z-10 flex items-center gap-3 bg-white">
        <button onClick={() => setStep('home')} className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft size={24} className="text-gray-700" />
        </button>
        <h2 className="text-lg font-bold text-gray-800">Definir Rota</h2>
      </div>

      <div className="p-4 flex-1 overflow-y-auto bg-gray-50">
        {/* Maps loading indicator is handled by SimulatedMap component */}

        <div className="space-y-3 relative">
          {/* Linha conectora contínua no fundo */}
          <div className="absolute left-[29px] top-[24px] bottom-[24px] w-[2px] bg-gray-200 z-0"></div>

          {routePoints.map((point, index) => {
            const isOrigin = index === 0;
            const isDest = index === routePoints.length - 1;

            return (
              <div
                key={point.id}
                draggable
                onDragStart={() => (dragItem.current = index)}
                onDragEnter={() => (dragOverItem.current = index)}
                onDragEnd={handleDragSort}
                onDragOver={(e) => e.preventDefault()}
                className="relative z-10 group bg-white rounded-xl shadow-sm border border-transparent hover:border-gray-200 transition-all active:scale-[0.99] overflow-hidden"
              >
                <div className="flex items-start p-3 gap-3">
                  {/* Ícone de Grip e Indicador de Ponto */}
                  <div className="flex flex-col items-center gap-2 pt-2">
                    <div className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500"><GripVertical size={16} /></div>
                    {isOrigin ? (
                      <div className="w-3 h-3 rounded-full border-[3px] border-green-500 bg-white ring-4 ring-green-50 z-10"></div>
                    ) : isDest ? (
                      <div className="w-3 h-3 rounded-sm border-[3px] border-orange-500 bg-white ring-4 ring-orange-50 z-10"></div>
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-gray-300 ring-4 ring-gray-100 z-10"></div>
                    )}
                  </div>

                  {/* Input Area */}
                  <div className="flex-1 min-w-0">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1 ml-1">
                      {isOrigin ? 'Ponto de Partida' : isDest ? 'Destino Final' : `Parada ${index}`}
                    </label>
                    <AddressAutocomplete
                      value={point.address}
                      onChange={(val) => handlePointUpdate(index, val, null)}
                      onSelect={(addr, coords) => handlePointUpdate(index, addr, coords)}
                      placeholder={isOrigin ? "Onde você está?" : "Para onde vamos?"}
                    />
                  </div>

                  {/* Botão de Remover (Apenas se não for origem/destino final essencial) */}
                  {!isOrigin && !isDest && (
                    <button onClick={() => handleRemoveStop(index)} className="mt-6 p-2 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <X size={18} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {routePoints.length < 4 && (
          <div className="mt-4 flex justify-center">
            <button onClick={handleAddStop} className="flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-orange-600 transition bg-white hover:bg-orange-50 px-4 py-2 rounded-full border border-gray-200 hover:border-orange-200 shadow-sm">
              <Plus size={16} /> Adicionar Parada
            </button>
          </div>
        )}

        <div className="mt-8">
          <Button fullWidth onClick={handleConfirmRoute} isLoading={calculatingRoute} disabled={calculatingRoute} className="h-14 text-lg shadow-lg shadow-orange-500/20">
            Confirmar Trajeto
          </Button>
          {calculatingRoute && <p className="text-center text-xs text-gray-400 mt-3 animate-pulse">Calculando rota otimizada...</p>}
        </div>
      </div>
    </div>
  );

  const RenderHistory = () => (
    <div className="h-full bg-gray-50 flex flex-col animate-fade-in">
      <div className="bg-white p-4 shadow-sm sticky top-0 z-10 flex items-center gap-3"><button onClick={() => setStep('home')} className="p-2 -ml-2 hover:bg-gray-100 rounded-full"><ArrowLeft size={24} className="text-gray-700" /></button><h2 className="text-xl font-bold text-gray-800">Minhas Viagens</h2></div>
      <div className="p-4 flex-1 overflow-y-auto">
        {historyRides.map(ride => (<Card key={ride.id} className="mb-3"><p>{ride.destination}</p></Card>))}
        {historyRides.length === 0 && <p className="text-center text-gray-400 mt-10">Sem histórico.</p>}
      </div>
    </div>
  );

  return (
    <div className="h-full w-full relative bg-gray-50 overflow-hidden font-sans">
      {RenderSideMenu()}

      {/* CORREÇÃO CRÍTICA: Chamar como função {RenderHome()} e não componente <RenderHome/> */}
      {step === 'home' && RenderHome()}
      {step === 'select_dest' && RenderSelectDest()}
      {step === 'confirm' && RenderConfirm()}
      {step === 'searching' && SearchingOverlay()}
      {step === 'ride' && RenderRide()}
      {step === 'history' && RenderHistory()}
      {step === 'payments' && RenderPayments()}
      {step === 'help' && RenderHelp()}

      {step === 'profile' && <ProfileScreen user={currentUser!} isDriver={false} onBack={() => setStep('home')} onSave={(updated) => { setCurrentUser(updated); setStep('home'); }} />}
      {step === 'rating' && <div className="h-full flex items-center justify-center p-6 bg-white"><div className="text-center w-full"><h2 className="text-2xl font-bold mb-4">Corrida Finalizada!</h2><Button fullWidth onClick={submitRating}>Avaliar e Concluir</Button></div></div>}

      {showCancelConfirm && <div className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center p-6"><div className="bg-white rounded-2xl p-6 w-full max-w-sm"><h3 className="text-lg font-bold mb-4">Cancelar corrida?</h3><div className="grid grid-cols-2 gap-3"><Button variant="outline" onClick={() => setShowCancelConfirm(false)}>Não</Button><Button variant="danger" onClick={handleCancelRide}>Sim</Button></div></div></div>}

      {showLogoutConfirm && <div className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center p-6"><div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center"><h3 className="text-lg font-bold mb-2">Sair do App?</h3><p className="text-gray-500 mb-6">Você terá que fazer login novamente.</p><div className="grid grid-cols-2 gap-3"><Button variant="outline" onClick={() => setShowLogoutConfirm(false)}>Não</Button><Button variant="danger" onClick={confirmLogout}>Sim, Sair</Button></div></div></div>}

      {showChat && currentRide && currentUser && <ChatModal rideId={currentRide.id} currentUserId={currentUser.id} otherUserName={currentRide.driver?.name || "Motorista"} onClose={() => setShowChat(false)} />}
    </div>
  );
};

const ArrowUpIcon = ({ size }: { size: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5" /><path d="M5 12l7-7 7 7" /></svg>;
const ArrowDownIcon = ({ size }: { size: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14" /><path d="M19 12l-7 7-7-7" /></svg>;