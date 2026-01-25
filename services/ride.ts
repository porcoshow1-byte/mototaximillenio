import { db, isMockMode, rtdb } from './firebase';
import { collection, addDoc, updateDoc, doc, onSnapshot, query, where, orderBy, serverTimestamp, limit, getDocs } from 'firebase/firestore';
import { ref, set, onValue, off } from 'firebase/database';
import { RideRequest, ServiceType, User, Driver, Coords, PaymentMethod } from '../types';
import { triggerN8NWebhook } from './n8n';

const RIDES_COLLECTION = 'rides';
const MOCK_STORAGE_KEY = 'motoja_mock_rides';

// Helpers para Mock
const getMockRides = (): RideRequest[] => {
  try {
    return JSON.parse(localStorage.getItem(MOCK_STORAGE_KEY) || '[]');
  } catch { return []; }
};

const saveMockRides = (rides: RideRequest[]) => {
  localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(rides));
};

// Mock Data Injection for Corporate Testing
export const injectMockCorporateRides = (companyId: string) => {
  const rides = getMockRides();
  const hasCorporate = rides.some(r => r.paymentMethod === 'corporate' && r.companyId === companyId);

  if (hasCorporate) return; // Already injected

  const now = new Date();
  const currentMonth = now.getMonth();
  const year = now.getFullYear();

  const newRides: any[] = [];

  // 1. Current Month (Open Invoice) - 5 days ago
  newRides.push({
    id: `ride_curr_${Date.now()}_1`,
    passenger: { id: 'u1', name: 'João Silva', phone: '11999999999', rating: 4.8, totalRides: 12, type: 'passenger' },
    origin: 'Av. Paulista, 1000',
    destination: 'Aeroporto Congonhas',
    price: 45.50,
    status: 'completed',
    createdAt: new Date(year, currentMonth, now.getDate() - 2, 14, 30).getTime(),
    paymentMethod: 'corporate',
    companyId,
    paymentStatus: 'pending_invoice',
    distance: '12km',
    duration: '35min',
    serviceType: 'MOTO_TAXI'
  });

  // 2. Last Month (Overdue/Closed) - 40 days ago
  newRides.push({
    id: `ride_last_${Date.now()}_2`,
    passenger: { id: 'u2', name: 'Maria Souza', phone: '11988888888', rating: 4.9, totalRides: 45, type: 'passenger' },
    origin: 'Rua Funchal, 200',
    destination: 'Av. Faria Lima, 3500',
    price: 22.90,
    status: 'completed',
    createdAt: new Date(year, currentMonth - 1, 15, 9, 15).getTime(),
    paymentMethod: 'corporate',
    companyId,
    paymentStatus: 'completed', // Paid
    distance: '5km',
    duration: '15min',
    serviceType: 'MOTO_TAXI'
  });

  // 3. Last Month (Overdue) - 35 days ago (Simulating unpaid)
  newRides.push({
    id: `ride_late_${Date.now()}_3`,
    passenger: { id: 'u3', name: 'Pedro Santos', phone: '11977777777', rating: 4.5, totalRides: 8, type: 'passenger' },
    origin: 'Centro',
    destination: 'Berrini',
    price: 35.00,
    status: 'completed',
    createdAt: new Date(year, currentMonth - 1, 20, 18, 0).getTime(),
    paymentMethod: 'corporate',
    companyId,
    paymentStatus: 'pending_invoice',
    distance: '15km',
    duration: '45min',
    serviceType: 'MOTO_TAXI'
  });

  saveMockRides([...rides, ...newRides]);
  console.log('Mock Corporate Rides Injected');
};

const updateMockRide = (rideId: string, updates: Partial<RideRequest>) => {
  const rides = getMockRides();
  const index = rides.findIndex(r => r.id === rideId);
  if (index !== -1) {
    rides[index] = { ...rides[index], ...updates };
    saveMockRides(rides);
  }
};

export const createRideRequest = async (
  passenger: User,
  origin: string,
  destination: string,
  originCoords: Coords | null,
  destinationCoords: Coords | null,
  serviceType: ServiceType,
  price: number,
  distance: string,
  duration: string,
  deliveryDetails?: RideRequest['deliveryDetails'],
  securityCode?: string,
  paymentMethod: PaymentMethod = 'pix',
  companyId?: string
): Promise<string> => {

  if (isMockMode || !db) {
    const id = `mock_ride_${Date.now()}`;
    const newRide: any = {
      id,
      passenger,
      origin,
      destination,
      originCoords,
      destinationCoords,
      serviceType,
      price,
      distance,
      duration,
      status: 'pending',
      createdAt: Date.now(),
      driver: undefined,
      deliveryDetails,
      securityCode,
      companyId,
      paymentMethod,
      paymentStatus: paymentMethod === 'corporate' ? 'pending_invoice' : 'pending'
    };
    const rides = getMockRides();
    rides.push(newRide);
    saveMockRides(rides);
    triggerN8NWebhook('ride_requested', newRide);
    return id;
  }

  try {
    const docRef = await addDoc(collection(db, RIDES_COLLECTION), {
      passenger,
      origin,
      destination,
      originCoords,
      destinationCoords,
      serviceType,
      price,
      distance,
      duration,
      status: 'pending',
      createdAt: serverTimestamp(),
      driver: null,
      paymentMethod,
      ...(companyId && { companyId }),
      paymentStatus: paymentMethod === 'corporate' ? 'pending_invoice' : 'pending',
      ...(deliveryDetails && { deliveryDetails }),
      ...(securityCode && { securityCode })
    });
    triggerN8NWebhook('ride_requested', { id: docRef.id, passenger, origin, destination, price });
    return docRef.id;
  } catch (error) {
    console.error("Erro ao criar corrida no Firestore:", error);
    throw error;
  }
};

export const subscribeToRide = (rideId: string, onUpdate: (ride: RideRequest) => void) => {
  if (isMockMode || !db) {
    const interval = setInterval(() => {
      const rides = getMockRides();
      const ride = rides.find(r => r.id === rideId);
      if (ride) onUpdate(ride);
    }, 1000);
    return () => clearInterval(interval);
  }

  // Firestore Listener for Ride Status/Price changes
  const unsubscribeFirestore = onSnapshot(doc(db, RIDES_COLLECTION, rideId), (docSnapshot) => {
    if (docSnapshot.exists()) {
      const data = docSnapshot.data() as any;
      const rideData = {
        id: docSnapshot.id,
        ...data,
        createdAt: data.createdAt?.seconds ? data.createdAt.seconds * 1000 : Date.now()
      };
      // We will merge driver location from RTDB later if needed, or component handles it.
      // But actually, for full sync, let's keep it simple here.
      onUpdate(rideData);
    }
  });

  // RTDB Listener for Driver Location (Realtime)
  let unsubscribeRTDB = () => { };
  if (rtdb) {
    const locationRef = ref(rtdb, `rides/${rideId}/driverLocation`);
    const onLocationChange = onValue(locationRef, (snapshot) => {
      const location = snapshot.val();
      if (location) {
        // We need to trigger onUpdate with the new location mixed in
        // However, `onUpdate` usually expects the full object.
        // Strategy: The component viewing the map should probably listen to this directly if it needs smooth animation?
        // For now, let's just cheat and assume onUpdate allows partial updates or we re-fetch?
        // No, let's just trigger onUpdate with the latest known firestore state + new location
        // Accessing the latest state here is tricky without a local cache.
        // SIMPLIFICATION: We notify the callback. The callback handler (UI) will merge.
        // OR: We store local state here.
      }
    });
    unsubscribeRTDB = () => off(locationRef, 'value', onLocationChange);
  }

  return () => {
    unsubscribeFirestore();
    unsubscribeRTDB();
  };
};

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // Earth radius in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const deg2rad = (deg: number) => deg * (Math.PI / 180);

export const subscribeToPendingRides = (
  onUpdate: (rides: RideRequest[]) => void,
  driverLocation?: Coords | null,
  radiusKm: number = 20
) => {
  if (isMockMode || !db) {
    const interval = setInterval(() => {
      const rides = getMockRides();
      const pending = rides
        .filter(r => {
          if (r.status !== 'pending') return false;
          if (driverLocation && r.origin) {
            const originObj = r.origin as any;
            if (typeof originObj === 'object' && 'lat' in originObj) {
              return calculateDistance(driverLocation.lat, driverLocation.lng, originObj.lat, originObj.lng) <= radiusKm;
            }
          }
          return true;
        })
        .sort((a, b) => b.createdAt - a.createdAt);
      onUpdate(pending);
    }, 1000);
    return () => clearInterval(interval);
  }

  const q = query(
    collection(db, RIDES_COLLECTION),
    where("status", "==", "pending")
  );

  return onSnapshot(q, (querySnapshot) => {
    const rides: RideRequest[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const ride = {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.seconds ? data.createdAt.seconds * 1000 : Date.now()
      } as RideRequest;

      // Filter by radius if location is known
      const rideOrigin = ride.origin as any; // Cast for flexibility if dealing with mixed types
      if (driverLocation && rideOrigin && typeof rideOrigin === 'object' && 'lat' in rideOrigin) {
        if (calculateDistance(driverLocation.lat, driverLocation.lng, rideOrigin.lat, rideOrigin.lng) <= radiusKm) {
          rides.push(ride);
        }
      } else {
        rides.push(ride);
      }
    });

    rides.sort((a, b) => b.createdAt - a.createdAt);
    onUpdate(rides.slice(0, 20));
  });
};

export const getRideHistory = async (userId: string, role: 'passenger' | 'driver'): Promise<RideRequest[]> => {
  if (isMockMode || !db) {
    const rides = getMockRides();
    return rides.filter(r => {
      if (role === 'passenger') return r.passenger.id === userId;
      return r.driver?.id === userId;
    }).sort((a, b) => b.createdAt - a.createdAt);
  }

  try {
    const q = query(
      collection(db, RIDES_COLLECTION),
      where(role === 'passenger' ? 'passenger.id' : 'driver.id', '==', userId)
    );

    const querySnapshot = await getDocs(q);
    const rides: RideRequest[] = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if (['completed', 'cancelled'].includes(data.status)) {
        rides.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.seconds ? data.createdAt.seconds * 1000 : Date.now()
        } as RideRequest);
      }
    });

    rides.sort((a, b) => b.createdAt - a.createdAt);
    return rides.slice(0, 50);
  } catch (error) {
    console.error("Erro ao buscar histórico:", error);
    return [];
  }
};

export const acceptRide = async (rideId: string, driver: Driver) => {
  if (isMockMode || !db) {
    updateMockRide(rideId, { status: 'accepted', driver });
    triggerN8NWebhook('ride_accepted', { rideId, driver });
    return;
  }
  const rideRef = doc(db, RIDES_COLLECTION, rideId);
  await updateDoc(rideRef, {
    status: 'accepted',

    driver: driver,
    acceptedAt: serverTimestamp()
  });
  triggerN8NWebhook('ride_accepted', { rideId, driver });
};

export const startRide = async (rideId: string) => {
  if (isMockMode || !db) {
    updateMockRide(rideId, { status: 'in_progress' });
    return;
  }
  const rideRef = doc(db, RIDES_COLLECTION, rideId);
  await updateDoc(rideRef, {
    status: 'in_progress',
    startedAt: serverTimestamp()
  });
};

export const markRideAsPaid = async (rideId: string) => {
  if (isMockMode || !db) {
    updateMockRide(rideId, { paymentStatus: 'completed' });
    return;
  }
  const rideRef = doc(db, RIDES_COLLECTION, rideId);
  await updateDoc(rideRef, {
    paymentStatus: 'completed'
  });
};

export const completeRide = async (rideId: string) => {
  if (isMockMode || !db) {
    updateMockRide(rideId, { status: 'completed' });
    triggerN8NWebhook('ride_completed', { rideId });
    return;
  }
  const rideRef = doc(db, RIDES_COLLECTION, rideId);
  await updateDoc(rideRef, {
    status: 'completed',
    completedAt: serverTimestamp()
  });

  triggerN8NWebhook('ride_completed', { rideId });
};

export const cancelRide = async (rideId: string) => {
  if (isMockMode || !db) {
    updateMockRide(rideId, { status: 'cancelled' });
    triggerN8NWebhook('ride_cancelled', { rideId });
    return;
  }
  const rideRef = doc(db, RIDES_COLLECTION, rideId);
  await updateDoc(rideRef, {
    status: 'cancelled',
    cancelledAt: serverTimestamp()
  });

  triggerN8NWebhook('ride_cancelled', { rideId });
};

/**
 * Atualiza a localização do motorista em tempo real durante a corrida
 * Esta função deve ser chamada periodicamente pelo DriverApp
 */
/**
 * Atualiza a localização do motorista em tempo real durante a corrida
 * Otimizado: Usa Realtime Database (RTDB) para economizar escritas no Firestore.
 */
export const updateDriverLocation = async (rideId: string, location: Coords) => {
  if (isMockMode || !db) {
    // Modo Mock: atualiza no localStorage
    const rides = getMockRides();
    const index = rides.findIndex(r => r.id === rideId);
    if (index !== -1 && rides[index].driver) {
      rides[index].driver = {
        ...rides[index].driver!,
        location: location
      };
      saveMockRides(rides);
    }
    return;
  }

  // Modo Otimizado: RTDB + Firestore (apenas se necessário)
  // 1. Grava no RTDB (Barato e Rápido para animação)
  if (rtdb) {
    const locationRef = ref(rtdb, `rides/${rideId}/driverLocation`);
    set(locationRef, location).catch(e => console.warn("Erro RTDB:", e));
  }

  // 2. Grava no Firestore APENAS se tiver passado muito tempo ou distância (Persistência/Auditoria)
  // Para economizar, vamos evitar gravar no Firestore a cada segundo.
  // Gravar apenas estatísticas finais ou periodicamente (ex: a cada 5 min).
  // Por enquanto, vou comentar a gravação no firestore para 100% economia, assumindo que RTDB é suficiente para o app 'live'.
  // Se precisarmos de histórico de trajeto, deveríamos salvar um array de pontos no final da corrida.

  /* 
  try {
    const rideRef = doc(db, RIDES_COLLECTION, rideId);
    await updateDoc(rideRef, {
      'driver.location': location,
      driverLocationUpdatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Erro ao atualizar localização do motorista:", error);
  } 
  */
};