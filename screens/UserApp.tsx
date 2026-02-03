import React, { useState, useEffect, useRef } from 'react';
import {
  MapPin, Search, Wallet, Star, Info, X, AlertCircle, CheckCircle,
  MessageSquare, Phone, History, User as UserIcon, CreditCard, LogOut,
  Menu, Loader2, ChevronDown, ChevronUp, Calendar, ArrowLeft, Clock,
  RefreshCw, Package, Bike, Plus, Trash2, HelpCircle, ChevronRight,
  FileQuestion, ExternalLink, Crosshair, ArrowDownUp, Navigation, Lock,
  GripVertical, ShieldCheck, Eye, EyeOff, Map as MapIcon, Copy, QrCode,
  Ticket, Bell, Home, Briefcase, Pencil, Building2, AlertTriangle, Banknote, UserCircle, Heart, Smartphone, MessageCircle, Pin
} from 'lucide-react';
import { PaymentOptionsScreen } from './PaymentOptionsScreen';
import { logout } from '../services/auth';
import { Button, Card, Badge, Input } from '../components/UI';
import { AddressAutocomplete } from '../components/AddressAutocomplete'; // Import here
import { ToastItem } from '../components/Toast';

// React Icons
import { FaMotorcycle, FaBox } from 'react-icons/fa';
import { MdDeliveryDining, MdPedalBike } from 'react-icons/md';

// Settings Service
import { subscribeToSettings, DEFAULT_SETTINGS, SystemSettings } from '../services/settings';

import { SimulatedMap } from '../components/SimulatedMap';
import { ChatModal } from '../components/ChatModal';
import { ProfileScreen } from './ProfileScreen';
import { AccountScreen } from './AccountScreen';
import { WalletScreen } from './WalletScreen';
import { CouponsScreen } from './CouponsScreen';
import { ReferralScreen } from './ReferralScreen';
import { FavoriteDriversScreen } from './FavoriteDriversScreen';
import { SERVICES, APP_CONFIG, MOCK_DRIVER } from '../constants';
import { ServiceType, RideRequest, User, Coords, PaymentMethod, Company, WalletTransaction, Coupon, SavedAddress } from '../types';
import { createRideRequest, subscribeToRide, cancelRide, getRideHistory } from '../services/ride';
import { createPixPayment, checkPayment } from '../services/mercadopago';
import { getOrCreateUserProfile, updateUserProfile } from '../services/user';
import { getCompany } from '../services/company';
import { calculateRoute, calculatePrice, reverseGeocode, searchAddress, getGoogleStaticMapUrl } from '../services/map';
import { useAuth } from '../context/AuthContext';
import { useGeoLocation } from '../hooks/useGeoLocation';
import { playSound, initAudio } from '../services/audio';
import { showNotification, ensureNotificationPermission } from '../services/notifications';
// Note: useJsApiLoader is handled internally by SimulatedMap component

import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface RoutePoint {
  id: string;
  address: string;
  coords: Coords | null;
}

interface SortableRouteItemProps {
  id: string; // Add ID explicitly for key/sortable
  point: RoutePoint;
  index: number;
  isOrigin: boolean;
  isDest: boolean;
  isStop: boolean;
  isFavorite: boolean;
  routePointsLength: number;
  onUpdatePoint: (index: number, val: string, coords: Coords | null) => void;
  onRemoveStop: (index: number) => void;
  onAddStop: () => void;
  onSwapOrigin: () => void;
  onFavoriteClick: () => void;
  userLocation: Coords | null;
}

const SortableRouteItem = ({
  id, point, index, isOrigin, isDest, isStop, isFavorite, routePointsLength,
  onUpdatePoint, onRemoveStop, onAddStop, onSwapOrigin, onFavoriteClick, userLocation
}: SortableRouteItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 50 - index,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative flex items-start gap-4 transition-all bg-white ${isDragging ? 'shadow-lg ring-2 ring-orange-500 rounded-lg' : ''}`}
    >
      {/* Drag Handle & Timeline Dot */}
      <div className="pt-3 flex items-center gap-1 cursor-grab active:cursor-grabbing touch-none" {...attributes} {...listeners}>
        <GripVertical size={16} className="text-gray-300" />
        {isOrigin ? (
          <div className="w-4 h-4 rounded-full border-[3px] border-gray-500 bg-white"></div>
        ) : (
          <div className={`w-4 h-4 rounded-full border-[3px] ${isDest ? 'border-orange-500 bg-orange-500' : 'border-gray-400 bg-white'}`}></div>
        )}
      </div>

      {/* Input Field Area */}
      <div className="flex-1 min-w-0 border-b border-gray-100 pb-2">
        <label className="text-xs text-gray-400 font-medium block mb-1">
          {isOrigin ? 'Partida' : isDest ? 'Destino' : `Parada ${index}`}
        </label>

        <div className="flex items-center gap-2">
          <div className="flex-1">
            <AddressAutocomplete
              value={point.address}
              onChange={(val) => onUpdatePoint(index, val, null)}
              onSelect={(addr, coords) => onUpdatePoint(index, addr, coords)}
              placeholder={isOrigin ? "Local de partida" : "Qual o destino?"}
              userLocation={userLocation}
            />
          </div>

          {/* Row Actions */}
          <div className="flex items-center gap-2 text-gray-400">
            {/* Star for Favorites - Add Only */}
            {point.address.length > 5 && (
              <button
                onClick={onFavoriteClick}
                className={`transition-colors ${isFavorite ? 'text-amber-400' : 'text-gray-300 hover:text-amber-400'}`}
                title="Salvar nos favoritos"
              >
                <Star size={20} fill={isFavorite ? "currentColor" : "none"} />
              </button>
            )}

            {/* Origin: Swap button */}
            {isOrigin && routePointsLength === 2 && (
              <button onClick={onSwapOrigin} className="hover:text-gray-600" title="Inverter origem/destino">
                <ArrowDownUp size={20} />
              </button>
            )}

            {/* Stops: Move Up/Down (Keep buttons as alternative) & Remove */}
            {isStop && (
              <button onClick={() => onRemoveStop(index)} className="hover:text-red-500 bg-gray-100 rounded-full p-1" title="Remover parada">
                <X size={16} />
              </button>
            )}

            {/* Destination: Plus Button */}
            {isDest && (
              <button
                onClick={onAddStop}
                disabled={routePointsLength >= 8}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${routePointsLength >= 8 ? 'bg-gray-100 text-gray-300' : 'bg-gray-800 text-white hover:bg-black'}`}
                title="Adicionar parada"
              >
                <Plus size={20} />
              </button>
            )}
          </div>
        </div>

        {/* Stop Tolerance Info */}
        {isStop && (
          <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
            <Clock size={10} />
            Tolerância: 5 min.
          </p>
        )}
      </div>
    </div>
  );
};

export const UserApp = () => {
  const { user: authUser } = useAuth();
  const { location: userLocation, getCurrentLocation, loading: loadingLocation } = useGeoLocation();

  // Maps loading is handled by SimulatedMap component internally

  const [step, setStep] = useState<'home' | 'select_dest' | 'confirm' | 'searching' | 'ride' | 'rating' | 'history' | 'profile' | 'payments' | 'help' | 'favorites_list'>('home');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const [routePoints, setRoutePoints] = useState<RoutePoint[]>([
    { id: 'origin', address: 'Localizando...', coords: null },
    { id: 'dest', address: '', coords: null }
  ]);


  const [selectedHistoryRide, setSelectedHistoryRide] = useState<RideRequest | null>(null);

  // Settings State
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    // Subscribe to dynamic settings (pricing, radius, etc)
    const unsubscribe = subscribeToSettings((updated) => {
      setSettings(updated);
    });
    return () => unsubscribe();
  }, []);

  // handleDragEnd updated for dnd-kit
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setRoutePoints((points) => {
        const oldIndex = points.findIndex((p) => p.id === active.id);
        const newIndex = points.findIndex((p) => p.id === over.id);
        return arrayMove(points, oldIndex, newIndex);
      });
    }
  };

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
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>('cash'); // Default to cash
  const [useWalletBalance, setUseWalletBalance] = useState(false);
  const [userCompany, setUserCompany] = useState<Company | null>(null);
  const [rideStatus, setRideStatus] = useState('');
  const [routeInfo, setRouteInfo] = useState<{ distance: string, duration: string, distanceVal: number, polyline?: string } | null>(null);
  const [calculatingRoute, setCalculatingRoute] = useState(false);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [showRideDetails, setShowRideDetails] = useState(false);
  const [mapImageError, setMapImageError] = useState(false);


  const [currentRideId, setCurrentRideId] = useState<string | null>(null);
  const [currentRide, setCurrentRide] = useState<RideRequest | null>(null);
  const [isFavoriteDriver, setIsFavoriteDriver] = useState(false); // Favorite Driver Toggle
  const [historyRides, setHistoryRides] = useState<RideRequest[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [isBooking, setIsBooking] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [paymentFeedback, setPaymentFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  // PIX Payment State
  const [showPixModal, setShowPixModal] = useState(false);

  // Toast System
  const [toast, setToast] = useState<{ message: string, type: 'error' | 'success' | 'info' } | null>(null);

  const showToast = (message: string, type: 'error' | 'success' | 'info' = 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };



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
  const [recenterCount, setRecenterCount] = useState(0);
  const [mapMoved, setMapMoved] = useState(false);

  // --- PERSISTENCE LOGIC START ---
  const nearbyDrivers = [MOCK_DRIVER]; // Fix: Define Mock Drivers for Map

  useEffect(() => {
    // Restore state from localStorage on mount
    const savedRideId = localStorage.getItem('motoja_current_ride_id');
    const savedStep = localStorage.getItem('motoja_step');
    const savedBookingMode = localStorage.getItem('motoja_booking_mode');

    if (savedRideId) {
      setCurrentRideId(savedRideId);
      // If we have a ride ID, we should be in 'searching' or 'ride' mode
      if (savedStep && (savedStep === 'searching' || savedStep === 'ride')) {
        setStep(savedStep as any);
      } else {
        setStep('searching'); // Default to searching if we have an ID but lost step
      }
    } else if (savedStep === 'searching') {
      // Edge case: searching but no ID yet (maybe just clicked button before ID returned)
      // For now, if no ID, clearer to reset to home to avoid stuck state
      localStorage.removeItem('motoja_step');
      setStep('home');
    }

    if (savedBookingMode) {
      setBookingMode(savedBookingMode as any);
    }
  }, []);

  // Sync state to localStorage
  useEffect(() => {
    if (currentRideId) {
      localStorage.setItem('motoja_current_ride_id', currentRideId);
    } else {
      localStorage.removeItem('motoja_current_ride_id');
    }
  }, [currentRideId]);

  useEffect(() => {
    localStorage.setItem('motoja_step', step);
  }, [step]);

  // Reset service selection whenever route is recalculated
  useEffect(() => {
    if (routeInfo) {
      setSelectedService(null);
    }
  }, [routeInfo]);

  useEffect(() => {
    localStorage.setItem('motoja_booking_mode', bookingMode);
  }, [bookingMode]);

  // Force reset service when entering confirmation screen
  useEffect(() => {
    if (step === 'confirm') {
      setSelectedService(null);
    }
  }, [step]);
  // --- PERSISTENCE LOGIC END ---

  // --- NOTIFICATIONS START ---
  // Request permission when entering search/ride mode
  useEffect(() => {
    if ((step === 'searching' || step === 'ride') && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }, [step]);

  // Trigger Notification on Driver Found
  useEffect(() => {
    if (currentRide?.status === 'accepted' && 'Notification' in window && Notification.permission === 'granted') {
      // Check if we haven't already notified for this specific ride/status interaction
      // Simple implementation: just fire. Browser usually allows.
      try {
        new Notification("Motorista Encontrado! 🏍️", {
          body: `${currentRide.driver?.name} aceitou sua corrida e está a caminho!`,
          icon: '/pwa-192x192.png', // Optional: requires valid path
          vibrate: [200, 100, 200]
        } as any);
      } catch (e) {
        console.error("Erro ao enviar notificação:", e);
      }
    }
  }, [currentRide?.status, currentRide?.driver?.name]);
  // --- NOTIFICATIONS END ---

  // UI Toggles
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isRouteOpen, setIsRouteOpen] = useState(false);


  const [showRecent, setShowRecent] = useState(true);

  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  // Map Picker & Favorites State
  const [pickingForIndex, setPickingForIndex] = useState<number>(0);
  const [tempPickedCoords, setTempPickedCoords] = useState<Coords | null>(null);

  // Refactored Persistent Favorites State
  const [favorites, setFavorites] = useState<SavedAddress[]>(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('motoja_favorites');
        if (saved) return JSON.parse(saved);
      }
    } catch (e) { console.error('Failed to load favorites', e); }
    return [
      { id: 'fav_home', label: 'Casa', address: '', coords: null, type: 'home' },
      { id: 'fav_work', label: 'Trabalho', address: '', coords: null, type: 'work' }
    ];
  });

  useEffect(() => {
    localStorage.setItem('motoja_favorites', JSON.stringify(favorites));

    // Sync to Firestore if user is logged in (Debounced)
    if (currentUser?.id) {
      const timer = setTimeout(() => {
        updateUserProfile(currentUser.id, { savedAddresses: favorites });
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [favorites, currentUser?.id]);

  // Favorites Modal State (for adding/editing)
  const [editingFavoriteId, setEditingFavoriteId] = useState<string | null>(null);
  const [editingFavoriteLabel, setEditingFavoriteLabel] = useState('');
  const [editingFavoriteAddress, setEditingFavoriteAddress] = useState('');
  const [editingFavoriteCoords, setEditingFavoriteCoords] = useState<Coords | null>(null);


  const openMapPicker = (index: number) => {
    setPickingForIndex(index);
    setStep('map_picker');
  };

  const handleCameraChange = (coords: Coords) => {
    setTempPickedCoords(coords);
  };

  const confirmMapPicker = async () => {
    if (!tempPickedCoords) return;
    const address = await reverseGeocode(tempPickedCoords.lat, tempPickedCoords.lng);
    handlePointUpdate(pickingForIndex, address, tempPickedCoords);
    setStep('select_dest');
  };



  const handleRemoveFavorite = (id: string) => {
    setFavorites(prev => prev.filter(f => f.id !== id));
  };

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
    setRecenterCount(c => c + 1);
    setRoutePoints(prev => {
      const newPoints = [...prev];
      newPoints[0] = { ...newPoints[0], address: "Atualizando GPS..." };
      return newPoints;
    });

    if (userLocation) {
      setOriginCoords(userLocation);
      setMapMoved(false); // <--- FORCE HIDE GPS BUTTON
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
      setMapMoved(false); // <--- FORCE HIDE GPS BUTTON
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

      // Sync Favorites from Cloud
      if ((profile as User).savedAddresses && (profile as User).savedAddresses!.length > 0) {
        setFavorites((profile as User).savedAddresses!);
        localStorage.setItem('motoja_favorites', JSON.stringify((profile as User).savedAddresses));
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
        totalRides: 0,
        avatar: `https://ui-avatars.com/api/?name=${authUser.email}`,
        type: 'passenger'
      } as User;
      setCurrentUser(mockUser);
    } finally {
      setLoadingProfile(false);
    }
  };

  // Ref to track if profile is loaded (avoids stale closure in timeout)
  const isProfileLoadedRef = useRef(false);

  // Efeito com Timeout de Segurança para evitar travamento eterno
  useEffect(() => {
    let mounted = true;
    isProfileLoadedRef.current = false;

    // Inicia carregamento
    loadUserProfile().then(() => {
      if (mounted) isProfileLoadedRef.current = true;
    });

    // Timeout de segurança: se em 4 segundos não carregar, libera a UI
    const safetyTimeout = setTimeout(() => {
      if (mounted && !isProfileLoadedRef.current) {
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
            totalRides: 0,
            avatar: `https://ui-avatars.com/api/?name=${authUser.email}`,
            type: 'passenger'
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
            // Clear route from map
            setRouteInfo(null);
            setDestCoords(null);
            setDestCoords(null);
            showToast('A corrida foi cancelada.', 'info');
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
    setRouteInfo(null); // Force reset to avoid stale data display

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
      distanceVal: route.distanceValue,
      polyline: route.polyline
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
    setRecenterCount(prev => prev + 1); // Force map to fit bounds
    setSelectedService(null); // <--- GARANTIA: Reseta serviço ao calcular rota
    setStep('confirm');
  };

  const handleBook = async () => {
    if (!routePoints[routePoints.length - 1].address) return alert("Defina o destino!");

    // Validar serviço selecionado
    if (!selectedService) {
      showToast("Selecione um serviço para continuar!", "info");
      return;
    }

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
        selectedPaymentMethod === 'corporate' && userCompany ? userCompany.id : undefined,
        routeInfo.polyline
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
    setSecurityToken(null);

    // Reset points to just origin to clear map traces
    if (routePoints.length > 0) {
      setRoutePoints([
        { id: 'origin', address: routePoints[0].address, coords: routePoints[0].coords },
        { id: 'dest_init', address: '', coords: null }
      ]);
    }
  };

  const submitRating = () => {
    // Logic to save favorite driver
    if (isFavoriteDriver && currentRide?.driver && currentUser) {
      const driverId = currentRide.driver.id;
      const currentFavorites = currentUser.favoriteDrivers || [];

      if (!currentFavorites.includes(driverId)) {
        const updatedUser = {
          ...currentUser,
          favoriteDrivers: [...currentFavorites, driverId]
        };
        setCurrentUser(updatedUser);
        localStorage.setItem(`motoja_user_${currentUser.id}`, JSON.stringify(updatedUser));
        setToast({ message: 'Motorista adicionado aos favoritos!', type: 'success', visible: true });
        setTimeout(() => setToast(null), 3000);
      }
    }

    setStep('home');
    setRouteInfo(null);
    setRating(0);
    setIsFavoriteDriver(false); // Reset toggle
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
      case 'passenger': return <div className="relative flex items-center justify-center p-3 bg-orange-100 text-orange-600 rounded-full"><UserIcon size={24} fill="currentColor" className="opacity-20" /><UserIcon size={24} className="absolute" /></div>;
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

  const handleSelectRecent = () => {
    // Simula a seleção da "Rodoviária de Avaré"
    const avareRodoviaria: RoutePoint = {
      id: 'dest_recent',
      address: "Rodoviária de Avaré",
      coords: {
        lat: -23.1026,
        lng: -48.9247
      }
    };

    setRoutePoints(prev => [prev[0], avareRodoviaria]);
    setStep('select_dest');
  };

  const RenderPayments = () => <div className="p-4"><Button onClick={() => setStep('home')}>Voltar</Button><h1>Pagamentos</h1></div>;
  const RenderHelp = () => <div className="p-4"><Button onClick={() => setStep('home')}>Voltar</Button><h1>Ajuda</h1></div>;

  const RenderHome = () => (
    <>
      {/* --- NEW HEADER LAYOUT (Competitor Style) --- */}
      {step !== 'map_picker' && (
        <>
          {/* Top Left: Brand Pill */}
          <div className="absolute top-12 left-6 z-20 animate-fade-in-down">
            <div className="bg-orange-500 text-white px-6 py-2 rounded-full shadow-lg shadow-orange-500/30 flex items-center gap-2">
              <span className="font-bold text-lg">MotoJá</span>
            </div>
          </div>

          {/* Top Right: Action Buttons */}
          <div className="absolute top-12 right-6 z-20 flex gap-3 animate-fade-in-down">
            <button className="w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center text-gray-700 active:scale-90 transition-transform">
              <Ticket size={20} />
            </button>
            <button className="w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center text-gray-700 active:scale-90 transition-transform relative">
              <Bell size={20} />
              <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
          </div>
        </>
      )}


      {/* Map Layer */}
      <div className="absolute inset-0 z-0">
        <SimulatedMap
          showDriver={!!currentRide && step === 'ride'}
          showRoute={!!routeInfo && bookingMode}
          status={rideStatus === 'searching' ? 'Procurando motorista...' : rideStatus === 'accepted' ? 'Motorista a caminho' : rideStatus === 'in_progress' ? 'Em viagem' : undefined}
          origin={originCoords}
          destination={destCoords}
          driverLocation={currentRide?.driverLocation || MOCK_DRIVER.location}
          // Fix: Hide drivers in Confirm/Searching/Home mode to keep map clean
          drivers={step === 'confirm' || step === 'searching' || step === 'home' ? [] : nearbyDrivers}

          // New Custom Marker Props
          originAddress={routePoints[0]?.address || ''}
          destinationAddress={routePoints[routePoints.length - 1]?.address || ''}
          tripProfile={routeInfo ? { distance: routeInfo.distance, duration: routeInfo.duration } : undefined}
          onEditOrigin={() => setStep('select_dest')}
          onEditDestination={() => setStep('select_dest')}

          recenterTrigger={recenterCount}
          onCameraChange={(coords, isUserInteraction) => {
            // Update temp coords for picker
            handleCameraChange(coords);

            // Only show GPS button if moved by USER interaction (drag)
            if (isUserInteraction) {
              setMapMoved(true);
            }
          }}
          // Padding de segurança dinâmico (Aumentado bottom para 550px no confirm)
          fitBoundsPadding={step === 'confirm' ? { top: 120, right: 40, bottom: 580, left: 40 } : { top: 40, right: 40, bottom: 40, left: 40 }}
        />

        {/* Map Picker Overlay */}
        {step === 'map_picker' && (
          <div className="absolute inset-0 z-[50] pointer-events-none flex flex-col">
            {/* Back Button */}
            <div className="absolute top-4 left-4 pointer-events-auto">
              <button
                onClick={() => setStep('select_dest')}
                className="bg-white p-2 rounded-full shadow-lg text-gray-700 hover:bg-gray-50"
              >
                <ArrowLeft size={24} />
              </button>
            </div>

            {/* Center Pin Assembly */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none mb-10">
              <div className="relative flex flex-col items-center group">
                {/* The Pin */}
                <div className="relative z-10 -mb-1 text-orange-600 drop-shadow-2xl filter transform transition-transform duration-300">
                  {/* Solid Fill Pin */}
                  <Pin size={56} fill="currentColor" strokeWidth={0} className="block" />

                  {/* Glare/Reflection (Simulating the image style) */}
                  <div className="absolute top-2 right-3 w-3 h-2 bg-white/40 rounded-full blur-[1px] rotate-45"></div>
                </div>

                {/* The Shadow/Target on the floor */}
                <div className="w-2 h-1 bg-black/40 rounded-[100%] blur-[1px] mt-[-4px]"></div>

                {/* Precision Crosshair (Subtle) */}
                <div className="absolute top-[48px] -z-10 w-[200px] h-[1px] bg-gradient-to-r from-transparent via-gray-400/50 to-transparent"></div>
                <div className="absolute top-[-25px] -z-10 h-[100px] w-[1px] bg-gradient-to-b from-transparent via-gray-400/50 to-transparent"></div>
              </div>
            </div>

            {/* Top Hint */}
            <div className="absolute top-24 left-0 right-0 flex justify-center px-4">
              <span className="bg-gray-900/80 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg animate-fade-in">
                Mova o mapa para ajustar o local
              </span>
            </div>

            {/* Confirm Button */}
            <div className="absolute bottom-8 left-6 right-6 pointer-events-auto">
              <Button onClick={confirmMapPicker} className="w-full shadow-xl py-4 text-lg font-bold">
                Confirmar Local
              </Button>
            </div>
          </div>
        )}
      </div>


      {step !== 'map_picker' && (
        <>
          {/* GPS Recenter Floating Button - Only when map moved */}
          {mapMoved && (
            <div className="absolute bottom-96 right-6 z-20">
              <button
                onClick={() => {
                  handleCenterLocation();
                  setMapMoved(false);
                }}
                className="bg-white p-3 rounded-full shadow-xl text-gray-700 active:bg-gray-100 active:scale-95 transition-all text-orange-500"
              >
                {loadingLocation ? <Loader2 size={24} className="animate-spin" /> : <Crosshair size={24} />}
              </button>
            </div>
          )}

          {/* --- NEW BOTTOM SHEET LAYOUT --- */}
          <div className={`absolute bottom-0 left-0 right-0 z-20 bg-white rounded-t-[2rem] shadow-[0_-10px_40px_rgba(0,0,0,0.1)] animate-slide-up pb-safe transition-all duration-300 ${showRecent ? 'h-auto' : 'h-auto'}`}>

            {/* Handle Bar */}
            <div
              onClick={() => setShowRecent(!showRecent)}
              className="w-full flex justify-center pt-3 pb-2 cursor-pointer active:opacity-50"
            >
              <div className={`w-12 h-1.5 bg-gray-200 rounded-full transition-colors ${!showRecent ? 'bg-orange-200' : ''}`}></div>
            </div>

            <div className="px-6 pb-2 pt-2">
              <h2 className="text-xl font-bold text-gray-800 mb-6 text-center select-none">
                Boa tarde, {currentUser?.name?.split(' ')[0] || 'Passageiro'}
              </h2>

              <div
                onClick={() => setStep('select_dest')}
                className="bg-gray-100 rounded-2xl p-4 flex items-center gap-4 cursor-pointer hover:bg-gray-200 transition-colors mb-6"
              >
                <Search size={24} className="text-gray-500" />
                <span className="text-gray-500 font-bold text-lg">Buscar destino</span>
              </div>

              <div className={`overflow-hidden transition-all duration-300 ${showRecent ? 'max-h-40 opacity-100 mb-0' : 'max-h-0 opacity-0 mb-0'}`}>
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectRecent();
                  }}
                  className="flex items-center gap-4 px-2 cursor-pointer hover:bg-gray-50 p-2 rounded-xl -mx-2 transition-colors active:bg-gray-100"
                >
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 shrink-0">
                    <Clock size={20} />
                  </div>
                  <div className="flex-1 overflow-hidden border-b border-gray-100 pb-2">
                    <span className="block text-sm font-bold text-gray-800 truncate">Rodoviária de Avaré</span>
                    <span className="block text-xs text-gray-400">Última viagem</span>
                  </div>
                </div>
              </div>

              {/* Bottom Nav */}
              <div className="flex justify-between items-center border-t border-gray-100 pt-1 mt-0">
                <div className="flex flex-col items-center gap-1 cursor-pointer text-orange-600">
                  <div className="bg-orange-50 p-2 rounded-full px-5">
                    <Home size={24} fill="currentColor" />
                  </div>
                  <span className="text-xs font-bold">Início</span>
                </div>

                <div onClick={() => setStep('history')} className="flex flex-col items-center gap-1 cursor-pointer text-gray-400 hover:text-gray-600 transition">
                  <div className="p-2">
                    <History size={24} />
                  </div>
                  <span className="text-xs font-medium">Atividade</span>
                </div>

                <button onClick={() => setStep('account')} className={`flex flex-col items-center gap-1 ${step === 'account' ? 'text-orange-600 font-bold' : 'text-gray-400'}`}>
                  <div className="p-2">
                    <UserCircle size={24} />
                  </div>
                  <span className="text-xs font-medium">Conta</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );

  /* Otimização: Overlay de busca reaproveitável dentro do RenderConfirm para não remontar o mapa */
  const SearchingOverlayContent = () => (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center animate-fade-in text-center overflow-hidden">

      {/* Overlay Gradient for better text readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/90 via-white/80 to-white/90 backdrop-blur-sm -z-10"></div>

      <div className="relative z-10 w-full max-w-md px-6 flex flex-col items-center">
        {/* Radar Animation */}
        <div className="relative mb-12">
          <div className="absolute inset-0 bg-orange-500 rounded-full animate-ping opacity-20 duration-1000"></div>
          <div className="absolute inset-0 bg-orange-500 rounded-full animate-ping opacity-15 duration-2000 delay-300"></div>
          <div className="absolute inset-0 bg-orange-400 rounded-full animate-ping opacity-10 duration-3000 delay-700"></div>
          <div className="relative z-10 bg-gradient-to-br from-orange-400 to-orange-600 p-6 rounded-full shadow-2xl shadow-orange-500/40 border-4 border-white">
            <Bike size={48} className="text-white" />
          </div>
        </div>

        <h3 className="text-2xl font-bold text-gray-800 mb-2">Localizando Piloto</h3>
        <p className="text-gray-500 mb-8 max-w-xs leading-relaxed font-medium">
          Estamos conectando você ao parceiro mais próximo. Isso leva poucos segundos.
        </p>

        {/* Card do Código de Segurança */}
        {currentRide?.securityCode && (
          <div className="bg-white/80 backdrop-blur-md px-6 py-4 rounded-2xl mb-8 border border-white/50 shadow-lg w-full max-w-xs relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-orange-500"></div>
            <p className="text-[10px] text-gray-400 uppercase font-bold mb-2 flex items-center justify-center gap-1 group-hover:text-orange-500 transition-colors">
              <ShieldCheck size={12} className="text-green-500" /> Código de Segurança
            </p>
            <p className="text-4xl font-mono font-bold tracking-[0.2em] text-gray-800 mb-1">
              {currentRide.securityCode}
            </p>
            <p className="text-[10px] text-gray-400 font-medium border-t border-gray-100 pt-2 mt-2">
              {bookingMode === 'delivery' ? "Informe ao entregar" : "Informe ao embarcar"}
            </p>
          </div>
        )}

        <Button
          variant="outline"
          onClick={() => setShowCancelConfirm(true)}
          className="px-8 py-3 rounded-full border-gray-300 bg-white/50 text-gray-600 font-semibold hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-all shadow-sm"
        >
          Cancelar Busca
        </Button>
      </div>
    </div>
  );

  const RenderConfirm = () => {
    // Modificado: Mostrar TODOS os serviços (Moto, Entrega, Bike) independentemente do modo inicial
    const filteredServices = SERVICES;



    return (
      <>
        {/* Map visualization for Confirm Screen - MANTÉM MONTADO MESMO EM BUSCA */}
        {/* Map visualization for Confirm Screen */}
        <div className="absolute top-0 left-0 right-0 h-[50%] z-0 bg-gray-100">
          <SimulatedMap
            showRoute
            origin={originCoords}
            destination={destCoords}
            waypoints={routePoints.slice(1, routePoints.length - 1).map(p => p.coords).filter((c): c is Coords => c !== null)}
            recenterTrigger={recenterCount}
            fitBoundsPadding={{ top: 50, bottom: 50, left: 50, right: 50 }}

            // Pass Custom Props for Bubble Formatting
            originAddress={routePoints[0]?.address || ''}
            destinationAddress={routePoints[routePoints.length - 1]?.address || ''}
            tripProfile={routeInfo ? { distance: routeInfo.distance, duration: routeInfo.duration } : undefined}
            drivers={[]} // Keep clean
            isLoading={loadingLocation && !originCoords}
          />
        </div>

        {step === 'searching' ? (
          <SearchingOverlayContent />
        ) : (
          <div className="absolute bottom-0 left-0 right-0 z-20 bg-white rounded-t-3xl shadow-xl p-5 pb-[calc(2rem+env(safe-area-inset-bottom))] max-h-[85vh] overflow-y-auto animate-slide-up">
            <div className="flex items-center gap-2 mb-4">
              <button onClick={() => { setStep('select_dest'); setRouteInfo(null); }} className="p-2 hover:bg-gray-100 rounded-full"><ArrowLeft size={20} /></button>
              <h3 className="font-bold text-lg">Confirmar {bookingMode === 'ride' ? 'Viagem' : 'Entrega'}</h3>
            </div>



            {/* 1. COLLAPSIBLE ROUTE DETAILS */}
            <div className="mb-4 text-sm bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">
              <div
                onClick={() => setIsRouteOpen(!isRouteOpen)}
                className="p-3 flex items-center justify-between cursor-pointer hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <MapPin size={16} className="text-orange-500" />
                  <span className="font-bold text-gray-700">Detalhes da Rota</span>
                </div>
                {isRouteOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
              </div>

              {isRouteOpen && (
                <div className="px-3 pb-3 pt-0 flex flex-col gap-3 animate-slide-down">
                  {/* Route Points Loop */}
                  <div className="relative">
                    {/* Connecting Line */}
                    <div className="absolute left-[3.5px] top-[14px] bottom-[14px] w-[2px] bg-gray-200"></div>

                    <div className="space-y-4">
                      {routePoints.map((point, index) => {
                        const isOrigin = index === 0;
                        const isDest = index === routePoints.length - 1;
                        const isStop = !isOrigin && !isDest;

                        return (
                          <div key={index} className="flex items-start gap-2 relative z-10">
                            <div className={`w-2 h-2 mt-1.5 rounded-full shrink-0 ${isOrigin ? 'bg-green-500' : isDest ? 'bg-red-500' : 'bg-orange-400'}`} />
                            <div className="flex-1 min-w-0">
                              <span className="text-xs font-bold text-gray-500 uppercase block">
                                {isOrigin ? 'Local de Partida' : isDest ? 'Destino Final' : `Parada ${index}`}
                              </span>
                              <span className="text-gray-800 font-medium leading-tight block truncate">
                                {point.address}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {/* Show contact fields if delivery */}
                  {bookingMode === 'delivery' && (
                    <div className="mt-2 bg-white p-3 rounded-lg border border-gray-200 animate-fade-in">
                      <p className="text-xs font-bold text-gray-500 uppercase mb-3">Detalhes da Entrega</p>

                      {/* Send/Receive Toggle */}
                      <div className="flex bg-gray-100 p-1 rounded-lg mb-4">
                        <button
                          onClick={() => setDeliveryType('send')}
                          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-bold transition-all ${deliveryType === 'send' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                          <Navigation size={16} className="rotate-45" /> Enviar
                        </button>
                        <button
                          onClick={() => setDeliveryType('receive')}
                          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-bold transition-all ${deliveryType === 'receive' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                          <Package size={16} /> Receber
                        </button>
                      </div>

                      <div className="space-y-3">
                        <p className="text-xs text-gray-400 font-medium">
                          {deliveryType === 'send' ? 'Quem irá receber a encomenda?' : 'Quem irá entregar a encomenda?'} <span className="text-red-500">*</span>
                        </p>
                        <Input
                          placeholder={deliveryType === 'send' ? "Nome do Destinatário" : "Nome do Remetente"}
                          value={contactName}
                          onChange={(e) => setContactName(e.target.value)}
                          className="bg-gray-50 border-gray-200 text-sm"
                        />
                        <Input
                          placeholder="Telefone de Contato"
                          value={contactPhone}
                          onChange={(e) => setContactPhone(e.target.value)}
                          className="bg-gray-50 border-gray-200 text-sm"
                        />

                        {/* Security Code Toggle */}
                        <div className="pt-2 border-t border-gray-100">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <ShieldCheck size={16} className={useSecurityCode ? "text-green-500" : "text-gray-400"} />
                              <span className="text-sm font-bold text-gray-700">Código de Segurança</span>
                            </div>
                            <button
                              onClick={() => {
                                const newValue = !useSecurityCode;
                                setUseSecurityCode(newValue);
                                if (newValue) {
                                  setSecurityToken(Math.floor(1000 + Math.random() * 9000).toString());
                                } else {
                                  setSecurityToken(null);
                                }
                              }}
                              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-300 ${useSecurityCode ? 'bg-green-500' : 'bg-gray-300'}`}
                            >
                              <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-300 ${useSecurityCode ? 'translate-x-5' : 'translate-x-0'}`}></div>
                            </button>
                          </div>
                          <p className="text-xs text-gray-400 leading-tight">
                            Exige o código para finalizar a entrega. Garante que o pacote foi entregue à pessoa certa.
                          </p>

                          {/* Display generated code inline */}
                          {useSecurityCode && securityToken && (
                            <div className="mt-4 bg-orange-50 border border-orange-200 p-3 rounded-xl flex flex-col items-center justify-center animate-fade-in text-center shadow-sm">
                              <div className="text-3xl font-mono font-bold text-gray-900 tracking-widest bg-white px-4 py-1 rounded-lg border border-orange-100 mb-1">
                                {securityToken}
                              </div>
                              <p className="text-[10px] text-orange-700 max-w-[240px] leading-tight">
                                Compartilhe com quem receberá a encomenda.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Delivery Alert Guide */}
            {bookingMode === 'delivery' && (
              <div
                onClick={() => setIsRouteOpen(true)}
                className="mb-6 bg-blue-50 border border-blue-200 p-3 rounded-xl flex items-start gap-3 cursor-pointer hover:bg-blue-100 transition-colors animate-fade-in"
              >
                <div className="bg-blue-100 p-2 rounded-full text-blue-600 shrink-0">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <p className="font-bold text-blue-800 text-sm">Atenção: Detalhes da Entrega</p>
                  <p className="text-xs text-blue-600 leading-tight mt-0.5">
                    Preencha quem vai entregar/receber e o código de segurança nos detalhes acima.
                  </p>
                </div>
              </div>
            )}

            {/* Service List with Premium Feel */}
            <div className="flex flex-col gap-2 mb-3">
              {filteredServices.map((service) => {
                let price = 0;
                if (routeInfo) {
                  const dist = routeInfo.distanceVal;
                  if (service.id === ServiceType.MOTO_TAXI) {
                    price = (settings.basePrice || 5.00) + (dist * (settings.pricePerKm || 2.00));
                  } else if (service.id === ServiceType.DELIVERY_MOTO) {
                    price = (settings.deliveryMotoBasePrice || 6.00) + (dist * (settings.deliveryMotoPricePerKm || 2.20));
                  } else if (service.id === ServiceType.DELIVERY_BIKE) {
                    price = (settings.bikeBasePrice || 3.00) + (dist * (settings.bikePricePerKm || 1.50));
                  } else {
                    price = (service.basePrice || 5) + (dist * (service.pricePerKm || 2));
                  }
                }

                const isBike = service.id === ServiceType.DELIVERY_BIKE;
                const maxDist = settings.bikeMaxDistance || 2.0;
                const isDistanceTooFar = routeInfo && routeInfo.distanceVal > maxDist;
                const isDisabled = isBike && isDistanceTooFar;

                const renderServiceIcon = () => {
                  const iconClass = selectedService === service.id ? "text-orange-600" : "text-gray-600";
                  const bikeClass = selectedService === service.id ? "text-green-600" : "text-gray-600";

                  if (service.id === ServiceType.MOTO_TAXI) return <span className={iconClass}><FaMotorcycle size={24} /></span>;
                  if (service.id === ServiceType.DELIVERY_MOTO) return <span className={iconClass}><Package size={24} /></span>;
                  if (service.id === ServiceType.DELIVERY_BIKE) return <span className={bikeClass}><MdPedalBike size={24} /></span>;
                  return getServiceIcon(service.icon);
                };

                if (isDisabled) return null;

                const isSelected = selectedService === service.id;

                return (
                  <div
                    key={service.id}
                    onClick={() => {
                      setSelectedService(service.id);
                      setBookingMode(service.category as 'ride' | 'delivery');
                      if (service.category === 'delivery') {
                        setIsRouteOpen(true);
                      }
                    }}
                    className={`relative flex items-center justify-between p-3 rounded-xl transition-all duration-300 cursor-pointer overflow-hidden group
                      ${isSelected
                        ? 'bg-white ring-2 ring-orange-500 shadow-lg scale-[1.01] z-10'
                        : 'bg-white border border-gray-100 hover:border-orange-200 hover:shadow-sm'}`}
                  >
                    <div className="flex items-center gap-3 relative z-10">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors duration-300
                        ${isSelected ? 'bg-orange-50' : 'bg-gray-50 group-hover:bg-orange-50/50'}`}>
                        {renderServiceIcon()}
                      </div>
                      <div>
                        <p className={`font-bold text-base leading-tight ${isSelected ? 'text-gray-900' : 'text-gray-700'}`}>{service.name}</p>
                        <p className="text-[10px] text-gray-400 font-medium">{service.description}</p>
                      </div>
                    </div>
                    <div className="text-right relative z-10">
                      <p className={`font-bold text-lg ${isSelected ? 'text-gray-900' : 'text-gray-600'}`}>R$ {(price || 0).toFixed(2).replace('.', ',')}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* PAYMENT METHOD SELECTOR (Redesigned) */}
            <div
              onClick={() => setStep('payment_options')}
              className="mb-4 bg-white border border-gray-100 p-3 rounded-xl flex items-center justify-between shadow-sm cursor-pointer hover:border-orange-200 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="bg-green-50 p-2.5 rounded-full text-green-600">
                  {selectedPaymentMethod === 'cash' && <Banknote size={20} />}
                  {selectedPaymentMethod === 'pix' && <QrCode size={20} />}
                  {(selectedPaymentMethod === 'credit_machine' || selectedPaymentMethod === 'debit_machine' || selectedPaymentMethod === 'card') && <CreditCard size={20} />}
                  {selectedPaymentMethod === 'picpay' && <Smartphone size={20} />}
                  {selectedPaymentMethod === 'whatsapp' && <MessageCircle size={20} />}
                  {selectedPaymentMethod === 'corporate' && <Briefcase size={20} />}
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Forma de Pagamento</p>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-gray-800 text-base">
                      {selectedPaymentMethod === 'cash' && 'Dinheiro'}
                      {selectedPaymentMethod === 'pix' && 'Pix'}
                      {selectedPaymentMethod === 'credit_machine' && 'Crédito (máquina)'}
                      {selectedPaymentMethod === 'debit_machine' && 'Débito (máquina)'}
                      {selectedPaymentMethod === 'card' && 'Cartão'}
                      {selectedPaymentMethod === 'picpay' && 'PicPay'}
                      {selectedPaymentMethod === 'whatsapp' && 'WhatsApp'}
                      {selectedPaymentMethod === 'corporate' && 'Corporativo'}
                    </p>
                    {useWalletBalance && (
                      <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-bold border border-orange-200">
                        + SALDO
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-gray-400">
                <span className="text-xs font-medium">Alterar</span>
                <ChevronRight size={18} />
              </div>
            </div>

            <Button
              fullWidth
              onClick={handleBook}
              disabled={isBooking}
              className={`text-lg shadow-xl shadow-orange-500/20 py-4 ${bookingMode === 'delivery' && (!contactName.trim() || !contactPhone.trim()) ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              Confirmar {SERVICES.find(s => s.id === selectedService)?.name}
            </Button>
          </div>
        )}
      </>
    );
  };



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
      {/* Map Layer */}
      <div className="absolute inset-0 z-0">
        <SimulatedMap
          showDriver={!!currentRide && step === 'ride'}
          showRoute={!!routeInfo && bookingMode}
          status={rideStatus === 'searching' ? 'Procurando motorista...' : rideStatus === 'accepted' ? 'Motorista a caminho' : rideStatus === 'in_progress' ? 'Em viagem' : undefined}
          origin={originCoords}
          destination={destCoords}
          driverLocation={currentRide?.driverLocation || MOCK_DRIVER.location}
          recenterTrigger={recenterCount}
          fitBoundsPadding={{ top: 150, bottom: 380, left: 70, right: 70 }}
        />
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-20 bg-white rounded-t-3xl shadow-2xl p-5 pb-[calc(2rem+env(safe-area-inset-bottom))]">
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

  const handleSelectFavorite = (address: string) => {
    setRoutePoints(prev => {
      const newPoints = [...prev];
      // Always update the LAST point (Destination)
      const lastIdx = newPoints.length - 1;
      newPoints[lastIdx] = { ...newPoints[lastIdx], address };
      return newPoints;
    });
  };



  /* --- Handle Saving Favorites (Persist to LocalStorage) --- */
  const handleSaveFavorite = (id: string | null, label: string, address: string, coords: Coords | null) => {
    if (!label || !address) return;

    setFavorites(prev => {
      let newFavs;
      if (id) {
        // Edit existing
        newFavs = prev.map(f => f.id === id ? { ...f, label, address, coords } : f);
      } else {
        // Create new
        const newFav = {
          id: `fav_${Date.now()}`,
          label,
          address,
          coords,
          type: 'other' as const
        };
        newFavs = [...prev, newFav];
      }

      // PERSIST TO STORAGE
      localStorage.setItem('motoja_favorites', JSON.stringify(newFavs));
      return newFavs;
    });

    setEditingFavoriteId(null);
    setEditingFavoriteLabel('');
    setEditingFavoriteAddress('');
    setEditingFavoriteCoords(null);
  };

  /* --- Favorites Management Screen --- */
  const RenderFavorites = () => (
    <div className="h-full bg-white flex flex-col font-sans animate-fade-in z-50 absolute inset-0">
      <div className="p-4 flex items-center gap-4 bg-white border-b border-gray-100 shadow-sm z-10">
        <button onClick={() => setStep(step === 'favorites_list' ? 'account' : 'select_dest')} className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft size={24} className="text-gray-700" />
        </button>
        <h2 className="text-xl font-bold text-gray-800">Meus Favoritos</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-24">
        {favorites.map((fav) => (
          <div key={fav.id} className="flex items-center gap-4 p-4 bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-shadow">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${fav.type === 'home' ? 'bg-blue-100 text-blue-600' : fav.type === 'work' ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-600'}`}>
              {fav.type === 'home' ? <Home size={24} /> : fav.type === 'work' ? <Briefcase size={24} /> : <Star size={24} />}
            </div>

            <div className="flex-1 min-w-0" onClick={() => {
              if (!fav.address) {
                setEditingFavoriteId(fav.id);
                setEditingFavoriteLabel(fav.label);
                setEditingFavoriteAddress('');
                setEditingFavoriteCoords(null);
              } else {
                // Force update to DESTINATION (last point)
                const destIndex = routePoints.length - 1;
                handlePointUpdate(destIndex, fav.address, fav.coords);
                setStep('select_dest');
              }
            }}>
              <p className="font-bold text-gray-800 text-lg">{fav.label}</p>
              <p className="text-gray-500 truncate">{fav.address || 'Toque para adicionar endereço'}</p>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                setEditingFavoriteId(fav.id);
                setEditingFavoriteLabel(fav.label);
                setEditingFavoriteAddress(fav.address);
                setEditingFavoriteCoords(fav.coords);
              }}
              className="p-3 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-full transition-colors"
            >
              <Pencil size={20} />
            </button>

            {fav.type === 'other' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm('Remover favorito?')) handleRemoveFavorite(fav.id);
                }}
                className="p-3 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
              >
                <Trash2 size={20} />
              </button>
            )}
          </div>
        ))}

        <button
          onClick={() => {
            setEditingFavoriteId('new');
            setEditingFavoriteLabel('');
            setEditingFavoriteAddress('');
            setEditingFavoriteCoords(null);
          }}
          className="w-full py-4 flex items-center justify-center gap-2 text-orange-600 font-bold bg-orange-50 rounded-xl hover:bg-orange-100 transition-colors border border-dashed border-orange-200"
        >
          <Plus size={20} />
          Adicionar Novo Favorito
        </button>
      </div>
    </div>
  );

  const RenderSelectDest = () => (
    <div className="h-full bg-white flex flex-col font-sans">
      {/* Header */}
      <div className="p-4 flex items-center gap-4">
        <button onClick={() => setStep('home')} className="p-2 hover:bg-gray-100 rounded-full transition-colors -ml-2">
          <ArrowLeft size={24} className="text-gray-700" />
        </button>
        <h2 className="text-xl font-bold text-gray-800 flex-1 text-center pr-8">Escolha seu destino</h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-6 pb-4">

          {/* Timeline Container */}
          <div className="relative">
            {/* Connecting Line (drawn behind) */}
            <div className="absolute left-[15px] top-[24px] bottom-[30px] w-[2px] bg-gray-300 z-0"></div>

            <div className="space-y-4">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={routePoints.map(p => p.id)} strategy={verticalListSortingStrategy}>
                  {routePoints.map((point, index) => {
                    const isOrigin = index === 0;
                    const isDest = index === routePoints.length - 1;
                    const isStop = !isOrigin && !isDest;
                    const isFavorite = favorites.some(f => f.address === point.address && point.address.length > 5);

                    return (
                      <SortableRouteItem
                        key={point.id}
                        id={point.id}
                        point={point}
                        index={index}
                        isOrigin={isOrigin}
                        isDest={isDest}
                        isStop={isStop}
                        isFavorite={isFavorite}
                        routePointsLength={routePoints.length}
                        onUpdatePoint={(idx, val, coords) => handlePointUpdate(idx, val, coords)}
                        onRemoveStop={(idx) => handleRemoveStop(idx)}
                        onAddStop={handleAddStop}
                        onSwapOrigin={() => {
                          const newPoints = [...routePoints];
                          const temp = newPoints[0];
                          newPoints[0] = newPoints[1];
                          newPoints[1] = temp;
                          setRoutePoints(newPoints);
                        }}
                        onFavoriteClick={() => {
                          if (isFavorite) {
                            alert('Este endereço já está nos seus favoritos!');
                          } else {
                            // Add new favorite
                            setEditingFavoriteId('new');
                            setEditingFavoriteLabel('Novo Favorito');
                            setEditingFavoriteAddress(point.address);
                            setEditingFavoriteCoords(point.coords);
                          }
                        }}
                        userLocation={userLocation}
                      />
                    );
                  })}
                </SortableContext>
              </DndContext>
            </div>
          </div>
        </div>

        {/* --- Favorites Link Section --- */}
        <div className="border-t border-gray-100 mt-2">
          <button
            onClick={() => setStep('favorites_list')}
            className="w-full p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center group-hover:bg-orange-200 transition-colors">
                <Star size={20} fill="currentColor" />
              </div>
              <div className="text-left">
                <h3 className="font-bold text-gray-800">Meus Favoritos</h3>
                <p className="text-xs text-gray-500">Gerenciar todos os endereços salvos</p>
              </div>
            </div>
            <ChevronRight size={20} className="text-gray-400 group-hover:text-orange-500" />
          </button>

          {/* Quick Access to Home/Work if available */}
          <div className="px-4 pb-4 flex gap-3 overflow-x-auto no-scrollbar">
            {favorites.slice(0, 10).map(fav => (
              <button
                key={fav.id}
                onClick={() => {
                  // Force update to DESTINATION (last point)
                  const destIndex = routePoints.length - 1;
                  handlePointUpdate(destIndex, fav.address, fav.coords);
                }}
                className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-full border border-gray-100 whitespace-nowrap hover:bg-orange-50 hover:border-orange-200 hover:text-orange-700 transition-colors"
              >
                {fav.type === 'home' ? <Home size={14} /> : fav.type === 'work' ? <Briefcase size={14} /> : <Star size={14} />}
                <span className="text-sm font-medium">{fav.label}</span>
              </button>
            ))}
          </div>
        </div>


        {/* --- Choose on Map --- */}
        <div className="border-t border-gray-100">
          <div
            onClick={() => openMapPicker(routePoints.length - 1)}
            className="p-4 flex items-center gap-4 cursor-pointer hover:bg-gray-50 text-gray-700 font-bold"
          >
            <MapPin size={24} className="text-gray-600" />
            <span>Escolher no mapa</span>
          </div>
        </div>
      </div>

      {/* Footer Fixed Button */}
      <div className="p-6 bg-white border-t border-gray-100 z-20">
        <Button
          fullWidth
          onClick={handleConfirmRoute}
          isLoading={calculatingRoute}
          disabled={calculatingRoute}
          className="h-14 text-lg bg-orange-500 hover:bg-orange-600 shadow-xl shadow-orange-500/20 text-white"
        >
          Confirmar
        </Button>
      </div>
    </div>
  );

  const RenderHistory = () => {
    if (selectedHistoryRide) {
      const ride = selectedHistoryRide;
      return (
        <div className="h-full bg-gray-50 flex flex-col animate-fade-in font-sans">
          {/* Header Detalhes */}
          <div className="bg-white p-4 shadow-sm sticky top-0 z-10 flex items-center gap-3 border-b border-gray-100">
            <button
              onClick={() => setSelectedHistoryRide(null)}
              className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ArrowLeft size={24} className="text-gray-700" />
            </button>
            <h2 className="text-xl font-bold text-gray-800">Detalhes da Corrida</h2>
          </div>

          <div className="flex-1 overflow-y-auto bg-gray-50 p-4 space-y-4">

            {/* Map Snapshot (Static Image with CSS Fallback) */}
            {ride.originCoords && ride.destinationCoords && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden h-48 relative z-0 group">
                {!mapImageError ? (
                  <img
                    src={getGoogleStaticMapUrl(ride.originCoords, ride.destinationCoords, ride.routePolyline)}
                    alt="Rota da Corrida"
                    className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                    onError={() => setMapImageError(true)}
                  />
                ) : (
                  // Fallback: Esquema Visual CSS (Sem Custo)
                  <div className="w-full h-full bg-slate-50 relative flex items-center justify-center p-8">
                    <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:16px_16px]"></div>

                    <div className="relative w-full max-w-[200px] h-24 flex items-center justify-between z-10">
                      {/* Linha Conectora */}
                      <div className="absolute left-4 right-4 top-1/2 h-0.5 border-t-2 border-dashed border-gray-300 -translate-y-1/2"></div>

                      {/* Ponto A */}
                      <div className="relative flex flex-col items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-white border-4 border-green-500 shadow-sm flex items-center justify-center z-10">
                          <span className="text-[10px] font-bold text-green-700">A</span>
                        </div>
                        <span className="text-[10px] font-bold text-gray-400 bg-white/80 px-1 rounded">Origem</span>
                      </div>

                      {/* Ponto B */}
                      <div className="relative flex flex-col items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-white border-4 border-orange-500 shadow-sm flex items-center justify-center z-10">
                          <span className="text-[10px] font-bold text-orange-700">B</span>
                        </div>
                        <span className="text-[10px] font-bold text-gray-400 bg-white/80 px-1 rounded">Destino</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Overlay simples */}
                {!mapImageError && <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent pointer-events-none"></div>}

                <div className="absolute bottom-3 right-3 bg-white/95 backdrop-blur px-3 py-1.5 rounded-lg text-xs font-bold text-gray-600 shadow-sm z-10 flex items-center gap-1.5 border border-gray-100">
                  <MapIcon size={12} className="text-orange-500" />
                  Rota Registrada
                </div>
              </div>
            )}

            {/* Status Card */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Data e Hora</span>
                  <p className="font-medium text-gray-800 flex items-center gap-2 mt-1">
                    <Calendar size={16} className="text-orange-500" />
                    {new Date(ride.createdAt).toLocaleDateString()}
                    <span className="text-gray-300">|</span>
                    <Clock size={16} className="text-orange-500" />
                    {new Date(ride.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <Badge color={ride.status === 'completed' ? 'green' : ride.status === 'cancelled' ? 'red' : 'yellow'}>
                  {ride.status === 'completed' ? 'Finalizada' : ride.status === 'cancelled' ? 'Cancelada' : 'Em andamento'}
                </Badge>
              </div>

              <div className="space-y-6 pt-4 border-t border-gray-50 relative">
                {/* Linha conectora */}
                <div className="absolute left-[7px] top-[24px] bottom-[10px] w-0.5 bg-gray-200"></div>

                <div className="relative pl-6">
                  <div className="absolute left-0 top-1.5 w-4 h-4 rounded-full border-[3px] border-gray-400 bg-white z-10"></div>
                  <p className="text-xs text-gray-400 font-bold uppercase mb-1">Partida</p>
                  <p className="text-gray-800 font-medium leading-tight">{ride.origin}</p>
                </div>

                <div className="relative pl-6">
                  <div className="absolute left-0 top-1.5 w-4 h-4 rounded-full border-[3px] border-orange-500 bg-orange-500 z-10"></div>
                  <p className="text-xs text-gray-400 font-bold uppercase mb-1">Destino</p>
                  <p className="text-gray-800 font-medium leading-tight">{ride.destination}</p>
                </div>
              </div>
            </div>

            {/* Pagamento e Distância */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs text-gray-400 font-bold uppercase mb-1">Valor Total</p>
                  <p className="text-2xl font-bold text-gray-900">R$ {ride.price.toFixed(2)}</p>
                </div>
                <div className="bg-green-50 text-green-700 px-3 py-1 rounded-lg text-sm font-bold flex items-center gap-2">
                  <CheckCircle size={16} /> Pago
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                {/* Distância */}
                <div>
                  <p className="text-xs text-gray-400 font-bold uppercase mb-1">Distância</p>
                  <p className="text-gray-800 font-semibold">{ride.distance || '-'}</p>
                </div>

                {/* Forma de Pagamento */}
                <div>
                  <p className="text-xs text-gray-400 font-bold uppercase mb-1">Pagamento</p>
                  <p className="text-gray-800 font-semibold flex items-center gap-1.5">
                    {ride.paymentMethod === 'pix' && <><QrCode size={14} className="text-orange-500" /> PIX</>}
                    {ride.paymentMethod === 'cash' && <><Banknote size={14} className="text-green-500" /> Dinheiro</>}
                    {ride.paymentMethod === 'debit' && <><CreditCard size={14} className="text-blue-500" /> Débito</>}
                    {ride.paymentMethod === 'credit' && <><CreditCard size={14} className="text-purple-500" /> Crédito</>}
                    {ride.paymentMethod === 'wallet' && <><Wallet size={14} className="text-cyan-500" /> Carteira Digital</>}
                    {ride.paymentMethod === 'bonus' && <><Ticket size={14} className="text-pink-500" /> Bônus</>}
                    {ride.paymentMethod === 'corporate' && <><Building2 size={14} className="text-indigo-500" /> Faturada</>}
                    {!ride.paymentMethod && '-'}
                  </p>
                </div>
              </div>
            </div>

            {/* Motorista Info (se houver) */}
            {ride.driver && (
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                <p className="text-xs text-gray-400 font-bold uppercase mb-3">Motorista Parceiro</p>
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-gray-200 overflow-hidden shadow-inner">
                    <img src={ride.driver.avatar || "https://via.placeholder.com/150"} alt={ride.driver.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-gray-800 text-lg">{ride.driver.name}</h4>
                    <p className="text-sm text-gray-500">{ride.driver.vehicle} • {ride.driver.plate}</p>
                  </div>
                  <div className="flex flex-col items-end">
                    <div className="flex items-center gap-1 bg-yellow-50 px-2 py-1 rounded-lg border border-yellow-100">
                      <Star size={14} className="text-yellow-500 fill-yellow-500" />
                      <span className="font-bold text-sm text-yellow-700">{ride.driver.rating.toFixed(1)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    // LIST VIEW
    return (
      <div className="h-full bg-gray-50 flex flex-col animate-fade-in">
        <div className="bg-white p-4 shadow-sm sticky top-0 z-10 flex items-center gap-3">
          <button onClick={() => setStep('home')} className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft size={24} className="text-gray-700" />
          </button>
          <h2 className="text-xl font-bold text-gray-800">Minhas Viagens</h2>
        </div>
        <div className="p-4 flex-1 overflow-y-auto">
          {historyRides.map(ride => (
            <Card
              key={ride.id}
              className="mb-3 cursor-pointer hover:shadow-md transition-all active:scale-[0.98] border border-gray-100"
              onClick={() => {
                setMapImageError(false);
                setSelectedHistoryRide(ride);
              }}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1 pr-2">
                  <p className="font-bold text-gray-800 line-clamp-1">{ride.destination}</p>
                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                    <Calendar size={12} />
                    {new Date(ride.createdAt).toLocaleDateString()}
                    <span>•</span>
                    {new Date(ride.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <Badge color={ride.status === 'completed' ? 'green' : 'red'}>
                  {ride.status === 'completed' ? 'Finalizada' : 'Cancelada'}
                </Badge>
              </div>
              <div className="text-sm text-gray-600 font-medium flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                <span>R$ {ride.price.toFixed(2)}</span>
                <span className="text-gray-400 text-xs">{ride.distance}</span>
              </div>
            </Card>
          ))}
          {historyRides.length === 0 && (
            <div className="flex flex-col items-center justify-center mt-20 text-gray-400">
              <History size={48} className="mb-4 opacity-20" />
              <p>Sem histórico recente.</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="h-full w-full relative bg-gray-50 overflow-hidden font-sans">



      {RenderSideMenu()}
      {/* Toast Wrapper - Fixed Position & High Z-Index */}
      {toast && (
        <div className="absolute top-6 left-0 right-0 z-[100] flex justify-center pointer-events-none px-4">
          <ToastItem toast={{ id: 'toast-u', message: toast.message, type: toast.type }} onRemove={() => setToast(null)} />
        </div>
      )}

      {/* CORREÇÃO CRÍTICA: Chamar como função {RenderHome()} e não componente <RenderHome/> */}
      {(step === 'home' || step === 'map_picker') && RenderHome()}
      {step === 'select_dest' && RenderSelectDest()}
      {(step === 'confirm' || step === 'searching') && RenderConfirm()}
      {step === 'ride' && RenderRide()}
      {step === 'history' && RenderHistory()}
      {step === 'payments' && RenderPayments()}
      {step === 'help' && RenderHelp()}

      {step === 'wallet' && (
        <WalletScreen
          balance={currentUser?.walletBalance || 0}
          history={currentUser?.walletHistory || []}
          onBack={() => setStep('account')}
          onAddFunds={(amount) => {
            if (!currentUser) return;

            // Create Transaction
            const newTx: WalletTransaction = {
              id: Date.now().toString(),
              type: 'credit',
              amount: amount,
              date: Date.now(),
              description: 'Recarga via Pix'
            };

            // Update User
            const updatedUser = {
              ...currentUser,
              walletBalance: (currentUser.walletBalance || 0) + amount,
              walletHistory: [...(currentUser.walletHistory || []), newTx]
            };

            setCurrentUser(updatedUser);

            // Persist to localStorage (backup)
            localStorage.setItem(`motoja_user_${currentUser.id}`, JSON.stringify(updatedUser));

            // SYNC TO FIRESTORE SERVER
            import('../services/user').then(({ updateUserProfile }) => {
              updateUserProfile(currentUser.id, {
                walletBalance: updatedUser.walletBalance,
                walletHistory: updatedUser.walletHistory
              }).catch(err => console.error("Firestore wallet sync failed:", err));
            });

            // Show Toast
            setToast({ message: `Recarga de R$ ${amount.toFixed(2)} realizada com sucesso!`, type: 'success', visible: true });
            setTimeout(() => setToast(null), 3000);
          }}
        />
      )}

      {step === 'coupons' && (
        <CouponsScreen
          coupons={currentUser?.coupons || []}
          onBack={() => setStep('account')}
          onRedeem={async (code) => {
            // Mock Validation
            if (code === 'BEMVINDO' || code === 'MOTOJA10') {
              const newCoupon: Coupon = {
                id: Date.now().toString(),
                code: code,
                description: code === 'BEMVINDO' ? 'Desconto de boas-vindas' : 'Desconto especial',
                discount: code === 'BEMVINDO' ? 10 : 5,
                type: 'percent',
                expiresAt: Date.now() + 86400000 * 7 // 7 days
              };

              // Check if already exists
              if (currentUser?.coupons?.some(c => c.code === code)) {
                setToast({ message: 'Você já resgatou este cupom!', type: 'error', visible: true });
                setTimeout(() => setToast(null), 3000);
                return false;
              }

              const updatedUser = {
                ...currentUser!,
                coupons: [...(currentUser?.coupons || []), newCoupon]
              };

              setCurrentUser(updatedUser);
              localStorage.setItem(`motoja_user_${currentUser!.id}`, JSON.stringify(updatedUser));

              setToast({ message: 'Cupom resgatado com sucesso!', type: 'success', visible: true });
              setTimeout(() => setToast(null), 3000);
              return true;
            }
            return false;
          }}
        />
      )}

      {step === 'referral' && (
        <ReferralScreen
          referralCode={currentUser?.referralCode || 'MOTOJA123'}
          referralStats={{ total: 2, earnings: 2.00, pending: 1 }}
          onBack={() => setStep('account')}
        />
      )}

      {step === 'driver_favorites' && (
        <FavoriteDriversScreen
          favoriteDriverIds={currentUser?.favoriteDrivers || []}
          onBack={() => setStep('account')}
          onRemoveFavorite={(driverId) => {
            if (currentUser) {
              const updatedUser = {
                ...currentUser,
                favoriteDrivers: (currentUser.favoriteDrivers || []).filter(id => id !== driverId)
              };
              setCurrentUser(updatedUser);
              localStorage.setItem(`motoja_user_${currentUser.id}`, JSON.stringify(updatedUser));
              // Optional: Toast message
            }
          }}
        />
      )}

      {step === 'payment_options' && (
        <div className="absolute inset-0 z-50 bg-white">
          <PaymentOptionsScreen
            user={currentUser || { name: 'Passageiro', walletBalance: 0 } as User}
            selectedMethod={selectedPaymentMethod}
            onSelectMethod={(method) => {
              setSelectedPaymentMethod(method);
              setStep('confirm');
            }}
            useWallet={useWalletBalance}
            onToggleWallet={setUseWalletBalance}
            onBack={() => setStep('confirm')}
          />
        </div>
      )}

      {step === 'account' && (
        <AccountScreen
          user={currentUser || { name: 'Usuário', email: '' }}
          onBack={() => setStep('home')}
          onNavigate={(screen) => setStep(screen as any)}
          onLogout={() => setShowLogoutConfirm(true)}
        />
      )}

      {step === 'profile' && <ProfileScreen
        user={currentUser!}
        isDriver={false}
        userLocation={userLocation}
        onBack={() => setStep('account')} /* Back to Account, not Home */
        onSave={(updated) => {
          // Update state
          setCurrentUser(updated);

          // FORCE localStorage persistence (backup)
          if (updated && updated.id) {
            localStorage.setItem(`motoja_user_${updated.id}`, JSON.stringify(updated));
            console.log("Profile saved to localStorage:", updated);
          }

          // Sync Address to Favorites (Home)
          if (updated.address) {
            setFavorites(prev => {
              const hasHome = prev.some(f => f.type === 'home');
              let newFavs;
              if (hasHome) {
                newFavs = prev.map(f => f.type === 'home' ? { ...f, address: updated.address, coords: null } : f);
              } else {
                newFavs = [...prev, { id: 'fav_home', label: 'Casa', address: updated.address, coords: null, type: 'home' }];
              }
              // Persist Update Immediately
              localStorage.setItem('motoja_favorites', JSON.stringify(newFavs));
              return newFavs;
            });
          }
          setStep('account'); /* Return to Account screen after save */
        }} />}
      {step === 'rating' && (
        <div className="h-full flex flex-col items-center justify-center p-6 bg-white animate-fade-in relative z-50">
          <div className="text-center w-full max-w-sm">
            <div className="w-24 h-24 bg-gray-200 rounded-full mx-auto mb-4 overflow-hidden shadow-lg border-4 border-white">
              <img src={currentRide?.driver?.avatar || "https://via.placeholder.com/150"} alt="Motorista" className="w-full h-full object-cover" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-1">{currentRide?.driver?.name || 'Motorista'}</h2>
            <p className="text-gray-500 mb-8">{currentRide?.driver?.vehicle}</p>

            <p className="text-lg font-bold text-gray-700 mb-4">Como foi sua viagem?</p>

            {/* Star Rating */}
            <div className="flex justify-center gap-2 mb-8">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  className="transition-transform active:scale-90"
                >
                  <Star
                    size={32}
                    className={star <= rating ? "text-yellow-400 fill-yellow-400" : "text-gray-300"}
                  />
                </button>
              ))}
            </div>

            {/* Favorite Toggle */}
            <div
              onClick={() => setIsFavoriteDriver(!isFavoriteDriver)}
              className={`flex items-center justify-center gap-3 p-4 rounded-xl cursor-pointer transition-all border mb-8 ${isFavoriteDriver ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-100'}`}
            >
              <div className={`p-2 rounded-full ${isFavoriteDriver ? 'bg-white text-red-500 shadow-sm' : 'bg-gray-200 text-gray-400'}`}>
                <Heart size={24} className={isFavoriteDriver ? "fill-red-500" : ""} />
              </div>
              <span className={`font-bold ${isFavoriteDriver ? 'text-red-600' : 'text-gray-500'}`}>
                {isFavoriteDriver ? 'Adicionado aos favoritos' : 'Adicionar aos favoritos'}
              </span>
            </div>

            <Button fullWidth onClick={submitRating} disabled={rating === 0}>
              Avaliar e Concluir
            </Button>
          </div>
        </div>
      )}

      {showCancelConfirm && <div className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center p-6"><div className="bg-white rounded-2xl p-6 w-full max-w-sm"><h3 className="text-lg font-bold mb-4">Cancelar corrida?</h3><div className="grid grid-cols-2 gap-3"><Button variant="outline" onClick={() => setShowCancelConfirm(false)}>Não</Button><Button variant="danger" onClick={handleCancelRide}>Sim</Button></div></div></div>}

      {showLogoutConfirm && <div className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center p-6"><div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center"><h3 className="text-lg font-bold mb-2">Sair do App?</h3><p className="text-gray-500 mb-6">Você terá que fazer login novamente.</p><div className="grid grid-cols-2 gap-3"><Button variant="outline" onClick={() => setShowLogoutConfirm(false)}>Não</Button><Button variant="danger" onClick={confirmLogout}>Sim, Sair</Button></div></div></div>}

      {showChat && currentRide && currentUser && <ChatModal rideId={currentRide.id} currentUserId={currentUser.id} otherUserName={currentRide.driver?.name || "Motorista"} onClose={() => setShowChat(false)} />}

      {/* Favorites Edit Modal - moved to main return for proper z-index */}
      {step === 'favorites_list' && RenderFavorites()}

      {/* Favorites Edit Modal - moved to main return for proper z-index */}
      {editingFavoriteId !== null && (
        <div className="absolute inset-0 z-50 bg-black/50 flex items-end justify-center">
          <div className="bg-white w-full max-w-lg rounded-t-2xl p-6 animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800">
                {editingFavoriteLabel ? `Editar ${editingFavoriteLabel}` : 'Novo Favorito'}
              </h3>
              <button
                onClick={() => {
                  setEditingFavoriteId(null);
                  setEditingFavoriteLabel('');
                  setEditingFavoriteAddress('');
                  setEditingFavoriteCoords(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            <div className="mb-4 space-y-4">
              <div>
                <label className="text-sm text-gray-600 mb-2 block">Nome (Ex: Casa, Academia)</label>
                <input
                  type="text"
                  value={editingFavoriteLabel}
                  onChange={(e) => setEditingFavoriteLabel(e.target.value)}
                  className="w-full p-3 bg-gray-50 rounded-xl border border-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="Nome do local"
                />
              </div>

              <div>
                <label className="text-sm text-gray-600 mb-2 block">Endereço</label>
                <AddressAutocomplete
                  value={editingFavoriteAddress}
                  onChange={(val) => setEditingFavoriteAddress(val)}
                  onSelect={(addr, coords) => {
                    setEditingFavoriteAddress(addr);
                    setEditingFavoriteCoords(coords);
                  }}
                  placeholder="Digite o endereço..."
                  userLocation={userLocation}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setEditingFavoriteId(null);
                  setEditingFavoriteLabel('');
                  setEditingFavoriteAddress('');
                  setEditingFavoriteCoords(null);
                }}
                className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </Button>
              <Button
                onClick={() => handleSaveFavorite(editingFavoriteId === 'new' ? null : editingFavoriteId, editingFavoriteLabel, editingFavoriteAddress, editingFavoriteCoords)}
                className="flex-1 bg-orange-500 text-white hover:bg-orange-600"
                disabled={!editingFavoriteAddress || !editingFavoriteLabel}
              >
                Salvar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
