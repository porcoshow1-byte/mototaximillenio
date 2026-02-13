import { Driver, User, ServiceType } from './types';

// Helper function to safely access environment variables
const getEnvVar = (key: string): string => {
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore
      return import.meta.env[key] || '';
    }
  } catch (e) {
    console.warn('Error reading env var:', e);
  }
  return '';
};

// Chave fornecida pelo usuário
const USER_PROVIDED_KEY = "AIzaSyA-2urd4CmIJrOD-53lTCOGvykDwfGk07M";
const envKey = getEnvVar('VITE_GOOGLE_MAPS_API_KEY');

// Prioriza a variável de ambiente, mas usa a chave fornecida como fallback
const googleKey = envKey || USER_PROVIDED_KEY;

if (!googleKey) {
  console.warn("⚠️ Chave do Google Maps (VITE_GOOGLE_MAPS_API_KEY) não encontrada. O mapa pode não carregar corretamente.");
}

// Mapbox Token
const mapboxEnvKey = getEnvVar('VITE_MAPBOX_TOKEN');
const mapboxKey = mapboxEnvKey || '';

if (!mapboxKey) {
  console.warn("⚠️ Token do Mapbox (VITE_MAPBOX_TOKEN) não encontrado. O mapa precisará de configuração.");
}

export const APP_CONFIG = {
  name: "MotoJá",
  city: "Avaré - SP",
  currency: "R$",
  primaryColor: "orange",
  googleMapsApiKey: googleKey,
  mapboxToken: mapboxKey,
  logoUrl: '/icon-192.png'
};

export const MOCK_USER: User = {
  id: 'u1',
  name: 'João Silva',
  phone: '(14) 99999-9999',
  rating: 4.8,
  avatar: 'https://picsum.photos/100/100?random=1',
  totalRides: 0,
  type: 'passenger'
};

export const MOCK_DRIVER: Driver = {
  id: 'd1',
  name: 'Carlos Oliveira',
  vehicle: 'Honda CG 160 Titan',
  plate: 'ABC-1234',
  rating: 4.9,
  avatar: 'https://picsum.photos/100/100?random=2',
  location: { lat: -23.1047, lng: -48.9213 }, // Approx Avaré coords
  status: 'online',
  earningsToday: 145.50,
  phone: '(14) 98888-7777'
};

export const SERVICES = [
  {
    id: ServiceType.MOTO_TAXI,
    name: 'Mototáxi',
    description: 'Rápido e econômico',
    icon: 'passenger',
    image: '/icons/mototaxi.png',
    category: 'ride',
    basePrice: 5.00,
    pricePerKm: 2.00
  },
  {
    id: ServiceType.DELIVERY_MOTO,
    name: 'Moto entregas',
    description: 'Pacotes pequenos e médios',
    icon: 'package',
    image: '/icons/delivery_moto.png',
    category: 'delivery',
    basePrice: 6.00,
    pricePerKm: 2.20
  },
  {
    id: ServiceType.DELIVERY_BIKE,
    name: 'Bike entregas',
    description: 'Ecológico para curta distância',
    icon: 'bike',
    image: '/icons/delivery_bike.png',
    category: 'delivery',
    basePrice: 4.00,
    pricePerKm: 1.50
  }
];

export const MOCK_HISTORY = [
  { id: 1, date: '10 Out, 14:30', origin: 'Centro', dest: 'Bairro Alto', price: 'R$ 8,50', status: 'Finalizado' },
  { id: 2, date: '08 Out, 09:15', origin: 'Rodoviária', dest: 'Santa Casa', price: 'R$ 12,00', status: 'Finalizado' },
];