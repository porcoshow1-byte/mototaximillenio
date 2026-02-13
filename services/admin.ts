import { supabase, isMockMode } from './supabase';
import { Driver, RideRequest, User, Occurrence } from '../types';
import { MOCK_DRIVER } from '../constants';
import { USERS_TABLE } from './user';
import { RIDES_TABLE } from './ride';
// import { TABLE_NAME as OCCURRENCES_TABLE } from './support'; // occurrences table is 'occurrences' in Schema, not support_tickets.

const OCCURRENCES_TABLE = 'occurrences';

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
  occurrences: Occurrence[];
  error?: string;
}

// Helpers
const mapToAppOccurrence = (data: any): Occurrence => ({
  id: data.id,
  type: data.type,
  title: data.title,
  message: data.message,
  time: data.created_at ? new Date(data.created_at).getTime() : Date.now(),
  read: data.read,
  protocol: data.protocol,
  priority: data.priority,
  status: data.status,
  rideId: data.ride_id,
  passengerId: data.passenger_id,
  driverId: data.driver_id,
  ticketId: data.ticket_id,
  timeline: data.timeline, // JSONB
});

const mapToDbOccurrence = (data: Partial<Occurrence>): any => {
  const mapped: any = { ...data };
  if (data.rideId) mapped.ride_id = data.rideId;
  if (data.passengerId) mapped.passenger_id = data.passengerId;
  if (data.driverId) mapped.driver_id = data.driverId;
  if (data.ticketId) mapped.ticket_id = data.ticketId;
  // time -> created_at? 
  // Schema has created_at default now.

  delete mapped.rideId;
  delete mapped.passengerId;
  delete mapped.driverId;
  delete mapped.ticketId;
  delete mapped.time;
  delete mapped.id;

  return mapped;
};

// --- Occurrence Service Functions ---

export const createOccurrence = async (occurrence: Omit<Occurrence, 'id'>) => {
  if (isMockMode || !supabase) return { id: `mock-${Date.now()}`, ...occurrence };

  const dbData = mapToDbOccurrence(occurrence);
  const { data, error } = await supabase.from(OCCURRENCES_TABLE).insert(dbData).select().single();

  if (error) {
    console.error("Erro ao criar ocorrência:", error);
    throw error;
  }
  return mapToAppOccurrence(data);
};

export const deleteOccurrence = async (id: string) => {
  if (isMockMode || !supabase) return;
  const { error } = await supabase.from(OCCURRENCES_TABLE).delete().eq('id', id);
  if (error) {
    console.error("Erro ao excluir ocorrência:", error);
    throw error;
  }
};

export const updateOccurrence = async (id: string, data: Partial<Occurrence> & { timeline?: any[] }) => {
  if (isMockMode || !supabase) return; // mock logic omitted for brevity

  const dbData = mapToDbOccurrence(data);
  const { error } = await supabase.from(OCCURRENCES_TABLE).update(dbData).eq('id', id);
  if (error) {
    console.error("Erro ao atualizar ocorrência:", error);
    throw error;
  }
};

export const fetchDashboardData = async (): Promise<DashboardData> => {
  if (isMockMode || !supabase) {
    // Mock Data (Simplified fallback)
    return {
      stats: { totalRides: 150, revenue: 1250, activeDrivers: 2, pendingRides: 1 },
      chartData: [],
      drivers: [],
      passengers: [],
      recentRides: [],
      occurrences: []
    };
  }

  try {
    // 1. Stats (Count)
    // Active Drivers
    const { count: activeDrivers } = await supabase
      .from(USERS_TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('type', 'driver')
      .eq('driver_status', 'online');

    // Pending Rides
    const { count: pendingRides } = await supabase
      .from(RIDES_TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');

    // Total Rides
    const { count: totalRides } = await supabase
      .from(RIDES_TABLE)
      .select('id', { count: 'exact', head: true });

    // Revenue (Sum price of completed rides)
    // Supabase doesn't have direct SUM in JS client select easily.
    // We can use .rpc() if we created a function, or fetch all prices (expensive but fine for MVP).
    // Or fetch recent and extrapolate? No, user wants real revenue.
    // Let's fetch 'price' of all completed rides?
    // If dataset is huge, this crashes.
    // BETTER: Create a Postgres view or RPC.
    // FOR NOW: Fetch last 1000 completed rides prices? Or just 0 if too hard?
    // I'll fetch 'price' for status=completed.

    const { data: revenueData } = await supabase
      .from(RIDES_TABLE)
      .select('price')
      .eq('status', 'completed');

    const revenue = (revenueData || []).reduce((acc, curr) => acc + (curr.price || 0), 0);

    // 2. Lists
    // Recent Rides
    const { data: recentRidesData } = await supabase
      .from(RIDES_TABLE)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    // Drivers (Top 10 or all? Dashboard usually shows all or paginated. Admin wants list.)
    // Fetching all drivers might be okay for now (startup scale).
    const { data: driversData } = await supabase
      .from(USERS_TABLE)
      .select('*')
      .eq('type', 'driver')
      .limit(50);

    // Passengers (Recent 50?)
    const { data: passengersData } = await supabase
      .from(USERS_TABLE)
      .select('*')
      .eq('type', 'passenger')
      .limit(50);

    // Occurrences
    const { data: occurrencesData } = await supabase
      .from(OCCURRENCES_TABLE)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    // 3. Chart Data (Previous 7 days)
    // We need to group rides by day.
    // We already fetched 'revenueData' (all completed rides). 
    // If we want chart validation, we need 'created_at' too for that revenue query?
    // Let's re-fetch with created_at for chart aggregation.

    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() - 7);

    const { data: chartSource } = await supabase
      .from(RIDES_TABLE)
      .select('created_at, price')
      .eq('status', 'completed')
      .gte('created_at', limitDate.toISOString());

    // Aggregate
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
    const chartMap = new Map<string, { rides: number, revenue: number }>();

    // Initialize map
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayName = days[d.getDay()];
      chartMap.set(dayName, { rides: 0, revenue: 0 });
    }

    (chartSource || []).forEach(r => {
      const d = new Date(r.created_at);
      const dayName = days[d.getDay()];
      if (chartMap.has(dayName)) {
        const curr = chartMap.get(dayName)!;
        curr.rides++;
        curr.revenue += r.price || 0;
        chartMap.set(dayName, curr);
      }
    });

    const chartData = Array.from(chartMap.entries()).map(([name, val]) => ({ name, ...val }));

    // Mapping
    // We need to map DB objects to App objects (camelCase)
    // Since logic is repetitive, I'll allow 'any' cast here or use a quick mapper.
    // Specifically for User/Driver, we need to map snake_case props.

    const mapUser = (u: any) => ({
      ...u,
      earningsToday: u.earnings_today,
      driverStatus: u.driver_status,
      // Fix: Map 'status' to driver availability for UI if it's a driver
      status: u.type === 'driver' ? (u.driver_status || 'offline') : (u.status || 'active'),
      verificationStatus: u.verification_status,
      cnhUrl: u.cnh_url,
      walletBalance: u.wallet_balance,
      totalRides: u.total_rides,
      rejectionReason: u.rejection_reason
    });

    const mapRide = (r: any) => ({
      ...r,
      // map JSONB passenger/driver if needed, but they are JSONB so likely camelCase inside.
      createdAt: new Date(r.created_at).getTime(),
      paymentMethod: r.payment_method,
      paymentStatus: r.payment_status,
      serviceType: r.service_type
    });

    return {
      stats: {
        totalRides: totalRides || 0,
        revenue,
        activeDrivers: activeDrivers || 0,
        pendingRides: pendingRides || 0
      },
      chartData,
      drivers: (driversData || []).map(mapUser) as Driver[],
      passengers: (passengersData || []).map(mapUser) as User[],
      recentRides: (recentRidesData || []).map(mapRide) as RideRequest[],
      occurrences: (occurrencesData || []).map(mapToAppOccurrence),
    };

  } catch (error: any) {
    console.error("Dashboard Fetch Error:", error);
    return {
      stats: { totalRides: 0, revenue: 0, activeDrivers: 0, pendingRides: 0 },
      chartData: [],
      drivers: [],
      passengers: [],
      recentRides: [],
      occurrences: [],
      error: error.message
    };
  }
};