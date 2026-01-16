import { db, isMockMode } from './firebase';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { Driver, RideRequest, User } from '../types';
import { MOCK_DRIVER } from '../constants';

export interface DashboardData {
  stats: {
    totalRides: number;
    revenue: number;
    activeDrivers: number;
    pendingRides: number;
  };
  chartData: { name: string; rides: number; revenue: number }[];
  drivers: Driver[];
  passengers: User[];
  recentRides: RideRequest[];
  error?: string;
}

export const fetchDashboardData = async (): Promise<DashboardData> => {
  // MOCK DATA for Dashboard
  if (isMockMode || !db) {
    // Fetch REAL drivers from localStorage (those who logged in)
    const realDrivers: Driver[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('motoja_user_')) {
        try {
          const userData = JSON.parse(localStorage.getItem(key) || '{}');
          if (userData.role === 'driver') {
            realDrivers.push(userData as Driver);
          }
        } catch (e) { /* ignore */ }
      }
    }

    // Fallback mock drivers if no real ones exist
    const mockDrivers: Driver[] = realDrivers.length > 0 ? realDrivers : [
      { ...MOCK_DRIVER, id: 'd1', name: 'Carlos Oliveira', status: 'online', location: { lat: -23.1047, lng: -48.9213 }, vehicle: 'Honda CG 160', phone: '(14) 99123-4567' },
      { ...MOCK_DRIVER, id: 'd2', name: 'Marcos Santos', status: 'busy', location: { lat: -23.1060, lng: -48.9250 }, vehicle: 'Yamaha Factor', phone: '(14) 99234-5678' },
      { ...MOCK_DRIVER, id: 'd3', name: 'Ana Pereira', status: 'offline', location: { lat: -23.1025, lng: -48.9180 }, vehicle: 'Bike Caloi', phone: '(14) 99345-6789' },
    ];

    const mockPassengers: User[] = [
      { id: 'u1', name: 'João Silva', phone: '(11) 91234-5678', rating: 4.8, avatar: '', walletBalance: 25.50, isBlocked: false, email: 'joao.silva@email.com', address: 'Rua das Flores, 123 - Centro', totalRides: 15, type: 'passenger' },
      { id: 'u2', name: 'Maria Oliveira', phone: '(11) 98765-4321', rating: 4.9, avatar: '', walletBalance: 0, isBlocked: false, email: 'maria.oli@email.com', address: 'Av. Paulista, 1000 - Bela Vista', totalRides: 8, type: 'passenger' },
      { id: 'u3', name: 'Pedro Santos', phone: '(11) 95555-4444', rating: 4.5, avatar: '', walletBalance: 100.00, isBlocked: true, email: 'pedro.santos@email.com', address: 'Rua Augusta, 500 - Consolação', totalRides: 5, type: 'passenger' }
    ];

    const mockRides: any[] = JSON.parse(localStorage.getItem('motoja_mock_rides') || '[]')
      .filter((r: any) => r.status === 'completed' || r.status === 'cancelled');

    const revenue = mockRides.reduce((acc, r) => acc + (r.price || 0), 0) + 1250.00; // + base mock value

    return {
      stats: {
        totalRides: mockRides.length + 150,
        revenue: revenue,
        activeDrivers: 2,
        pendingRides: 1
      },
      chartData: [
        { name: 'Seg', rides: 12, revenue: 240 },
        { name: 'Ter', rides: 19, revenue: 380 },
        { name: 'Qua', rides: 15, revenue: 300 },
        { name: 'Qui', rides: 22, revenue: 450 },
        { name: 'Sex', rides: 30, revenue: 600 },
        { name: 'Sab', rides: 45, revenue: 900 },
        { name: 'Dom', rides: 38, revenue: 760 },
      ],
      drivers: mockDrivers,
      passengers: mockPassengers,
      recentRides: mockRides.length > 0 ? mockRides : [
        { id: '123456', origin: 'Rua A', destination: 'Rua B', price: 15.50, status: 'completed', passenger: { name: 'João' }, createdAt: Date.now() } as any
      ]
    };
  }

  try {
    let drivers: Driver[] = [];
    let passengers: User[] = [];
    let rides: RideRequest[] = [];
    let fetchError = '';

    // 1. Fetch Drivers
    try {
      const driversQuery = query(collection(db, 'users'), where('role', '==', 'driver'));
      const driversSnap = await getDocs(driversQuery);
      drivers = driversSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Driver));
    } catch (e: any) {
      console.warn("Erro ao buscar motoristas:", e);
      fetchError = `Erro Drivers: ${e.message}`;
    }

    // 1.1 Fetch Passengers
    try {
      const passengersQuery = query(collection(db, 'users'), where('role', '==', 'user'));
      const passengersSnap = await getDocs(passengersQuery);
      passengers = passengersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
    } catch (e) { console.warn("Erro ao buscar passageiros:", e); }

    // 2. Fetch Recent Rides
    try {
      const ridesQuery = query(collection(db, 'rides'), orderBy('createdAt', 'desc'), limit(100));
      const ridesSnap = await getDocs(ridesQuery);
      rides = ridesSnap.docs.map(doc => {
        const data = doc.data();
        const createdAt = data.createdAt?.seconds ? data.createdAt.seconds * 1000 : (data.createdAt || Date.now());
        return { id: doc.id, ...data, createdAt } as RideRequest;
      });
    } catch (e) {
      console.warn("Erro ao buscar corridas:", e);
    }

    const completedRides = rides.filter(r => r.status === 'completed');
    const totalRevenue = completedRides.reduce((acc, curr) => acc + (curr.price || 0), 0);
    const activeDrivers = drivers.filter(d => d.status === 'online').length;
    const pendingRides = rides.filter(r => r.status === 'pending').length;

    // 3. Prepare Chart Data
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
    const chartMap = new Map<string, { rides: number, revenue: number }>();

    // Initialize map
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayName = days[d.getDay()];
      chartMap.set(dayName, { rides: 0, revenue: 0 });
    }

    completedRides.forEach(ride => {
      if (!ride.createdAt) return;
      const date = new Date(ride.createdAt);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - date.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 7) {
        const dayName = days[date.getDay()];
        if (chartMap.has(dayName)) {
          const current = chartMap.get(dayName)!;
          chartMap.set(dayName, {
            rides: current.rides + 1,
            revenue: current.revenue + (ride.price || 0)
          });
        }
      }
    });

    const chartData = Array.from(chartMap.entries()).map(([name, val]) => ({
      name,
      rides: val.rides,
      revenue: val.revenue
    }));

    return {
      stats: { totalRides: rides.length, revenue: totalRevenue, activeDrivers, pendingRides },
      chartData,
      drivers,
      passengers,
      recentRides: rides.slice(0, 10)
    };

  } catch (error) {
    console.error("Erro dashboard:", error);
    return {
      stats: { totalRides: 0, revenue: 0, activeDrivers: 0, pendingRides: 0 },
      chartData: [],
      drivers: [],
      passengers: [],
      recentRides: []
    };
  }
};