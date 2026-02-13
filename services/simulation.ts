import { isMockMode } from './supabase';
import { RideRequest, Driver } from '../types';
import { acceptRide, updateDriverLocation, startRide, completeRide } from './ride';

// Mock Driver Profile
const MOCK_DRIVER: Driver = {
    id: 'mock_driver_001',
    name: 'Carlos Oliveira',
    phone: '11999887766',
    email: 'motorista@motoja.com',
    rating: 4.9,
    totalRides: 1240,
    vehicle: 'Honda CG 160',
    plate: 'ABC-1234',
    avatar: 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=400&h=400&fit=crop',
    status: 'online',
    location: { lat: -23.1047, lng: -48.9213 },
    verificationStatus: 'verified',
    earningsToday: 150.50,
    createdAt: Date.now()
};

const SIMULATION_INTERVAL_MS = 2000;

export const initSimulation = () => {
    if (!isMockMode) return () => { };

    console.log('🤖 Mock Simulation Initialized');

    const interval = setInterval(() => {
        checkAndSimulate();
    }, SIMULATION_INTERVAL_MS);

    return () => clearInterval(interval);
};

const checkAndSimulate = () => {
    try {
        const ridesStr = localStorage.getItem('motoja_mock_rides');
        if (!ridesStr) return;

        const rides: RideRequest[] = JSON.parse(ridesStr);
        let changed = false;

        rides.forEach(ride => {
            // 1. Auto-Accept Pending Rides (after 3s)
            if (ride.status === 'pending') {
                const timePending = Date.now() - (ride.createdAt || 0);
                if (timePending > 3000) {
                    console.log(`🤖 Simulating Driver Accept for ride ${ride.id}`);
                    // Update local object first to avoid oscillation
                    ride.status = 'accepted';
                    ride.driver = MOCK_DRIVER;
                    ride.acceptedAt = Date.now();
                    changed = true;

                    // Trigger Service (simulates RTDB/Firestore update)
                    acceptRide(ride.id, MOCK_DRIVER);
                }
            }

            // 2. Auto-Arrive / Start Ride (after 8s total)
            if (ride.status === 'accepted') {
                const timeAccepted = Date.now() - (ride.acceptedAt || 0);
                if (timeAccepted > 5000) {
                    console.log(`🤖 Simulating Driver Arrival/Start for ride ${ride.id}`);
                    ride.status = 'in_progress';
                    ride.startedAt = Date.now();
                    changed = true;
                    startRide(ride.id);
                }
            }

            // 3. Move Driver (Simple interpolation)
            if (ride.status === 'in_progress' && ride.driver) {
                // Simulate movement... 
                // For simplicity, we just complete it after 10s
                const timeStarted = Date.now() - (ride.startedAt || 0);
                if (timeStarted > 10000) {
                    console.log(`🤖 Simulating Ride Completion for ride ${ride.id}`);
                    ride.status = 'completed';
                    ride.completedAt = Date.now();
                    ride.paymentStatus = 'completed'; // Auto-pay in mock
                    changed = true;
                    completeRide(ride.id);
                }
            }
        });

    } catch (e) {
        console.error("Simulation error", e);
    }
};
