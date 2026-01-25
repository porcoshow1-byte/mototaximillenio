// Wrapper para serviços do Google Maps
import { ServiceType } from '../types';
import { SERVICES, APP_CONFIG } from '../constants';
import axios from 'axios';

interface AddressResult {
  description: string;
  placeId: string;
  coords: { lat: number; lng: number } | null;
}

interface RouteResult {
  distance: string; // ex: "4.5 km"
  duration: string; // ex: "12 min"
  distanceValue: number; // em km
  durationValue: number; // em minutos
}

// Serviços Singleton
let autocompleteService: any = null;
let placesService: any = null;
let directionsService: any = null;
let geocoderService: any = null;

// Lista de locais simulados (Fallback se a API falhar ou não estiver carregada)
const MOCK_LOCATIONS: AddressResult[] = [
  { description: 'Terminal Rodoviário de Avaré', placeId: 'loc1', coords: { lat: -23.104, lng: -48.925 } },
  { description: 'Santa Casa de Misericórdia', placeId: 'loc2', coords: { lat: -23.102, lng: -48.921 } },
  { description: 'Largo São João (Centro)', placeId: 'loc3', coords: { lat: -23.106, lng: -48.926 } },
];

// Helper para verificar se temos uma chave válida configurada
const hasValidKey = () => {
  return APP_CONFIG.googleMapsApiKey && APP_CONFIG.googleMapsApiKey.trim().length > 0;
};

// --- FUNÇÃO DE AUTO-PREENCHIMENTO REVERSO (LAT/LNG -> ENDEREÇO) ---
export const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
  if (hasValidKey() && typeof window !== 'undefined' && window.google && window.google.maps) {
    if (!geocoderService) {
      try {
        geocoderService = new window.google.maps.Geocoder();
      } catch (e) {
        console.warn("Erro ao instanciar Geocoder:", e);
      }
    }

    if (geocoderService) {
      try {
        const response = await new Promise<any>((resolve, reject) => {
          geocoderService.geocode({ location: { lat, lng } }, (results: any, status: any) => {
            if (status === 'OK' && results[0]) {
              resolve(results[0].formatted_address);
            } else {
              reject(status);
            }
          });
        });

        // Limpar o endereço para ficar mais curto (remover CEP e País as vezes)
        return response.split(', Brasil')[0];
      } catch (error) {
        console.warn("Reverse geocoding failed (API Error), using fallback.", error);
      }
    }
  }

  // Fallback simulado
  return `Rua Projetada, ${Math.floor(Math.random() * 100) + 1} - Centro`;
};

export const searchAddress = async (query: string): Promise<AddressResult[]> => {
  if (!query) return [];

  const googleMapsAvailable = hasValidKey() && typeof window !== 'undefined' && window.google && window.google.maps;

  if (googleMapsAvailable) {
    // 1. PRIORIDADE: Places API (New) - searchByText
    // Usamos esta primeiro. Se ela estiver disponível, NÃO tentamos a antiga em caso de erro para evitar o erro de Legacy API Disabled.
    if (window.google.maps.places && window.google.maps.places.Place && window.google.maps.places.Place.searchByText) {
      try {
        // @ts-ignore - searchByText faz parte da nova biblioteca 'places'
        const { places } = await window.google.maps.places.Place.searchByText({
          textQuery: query,
          fields: ['id', 'formattedAddress', 'location'],
          maxResultCount: 5
        });

        if (places && places.length > 0) {
          return places.map((p: any) => ({
            description: p.formattedAddress,
            placeId: p.id,
            coords: p.location ? { lat: p.location.lat(), lng: p.location.lng() } : null
          }));
        }
        // Se retornou vazio mas não deu erro, retornamos vazio (não tentamos legacy)
        return [];
      } catch (newApiError) {
        console.warn("New Places API searchByText failed. Falling back to Mock.", newApiError);
        // Se a API nova falhar, vamos para o Mock, pois tentar a Legacy provavelmente causará erro de "API Not Enabled"
      }
    } else {
      // 2. TENTATIVA SECUNDÁRIA: AutocompleteService (Legacy)
      // Só entra aqui se a API nova NÃO estiver definida no objeto window (versão antiga da lib)
      try {
        if (!autocompleteService) {
          autocompleteService = new window.google.maps.places.AutocompleteService();
        }

        const predictions = await new Promise<any[]>((resolve, reject) => {
          autocompleteService.getPlacePredictions({
            input: query,
            componentRestrictions: { country: 'br' },
          }, (results: any, status: any) => {
            if (status !== window.google.maps.places.PlacesServiceStatus.OK && status !== 'ZERO_RESULTS') {
              reject(status);
            } else {
              resolve(results || []);
            }
          });
        });

        return predictions.map((p: any) => ({
          description: p.description,
          placeId: p.place_id,
          coords: null
        }));

      } catch (legacyError) {
        // Ignora erro de legacy se falhar, vai pro mock
        console.warn("Legacy API failed or not enabled:", legacyError);
      }
    }
  }

  // 3. Fallback: Simulação
  // Se tudo falhar (API Key inválida, APIs não habilitadas, erro de rede), usamos o mock
  await new Promise(r => setTimeout(r, 400));

  const lowerQuery = query.toLowerCase();
  const hardcodedMatches = MOCK_LOCATIONS.filter(loc =>
    loc.description.toLowerCase().includes(lowerQuery)
  );

  if (hardcodedMatches.length === 0 && query.length > 2) {
    return [{
      description: query,
      placeId: `mock_${Date.now()}`,
      coords: { lat: -23.1047 + (Math.random() * 0.01), lng: -48.9213 + (Math.random() * 0.01) }
    }];
  }

  return hardcodedMatches;
};

export const getPlaceDetails = async (placeId: string): Promise<{ lat: number, lng: number } | null> => {
  // Se for um ID de mock, retorna do mock
  const mock = MOCK_LOCATIONS.find(m => m.placeId === placeId);
  if (mock && mock.coords) return mock.coords;

  if (placeId.startsWith('mock_')) {
    return { lat: -23.1047 + (Math.random() * 0.01), lng: -48.9213 + (Math.random() * 0.01) };
  }

  if (hasValidKey() && typeof window !== 'undefined' && window.google && window.google.maps) {

    // PRIORIDADE 1: New Places API (Classe Place)
    // Tentamos usar a classe Place primeiro
    if (window.google.maps.places && window.google.maps.places.Place) {
      try {
        const place = new window.google.maps.places.Place({ id: placeId });
        await place.fetchFields({ fields: ['location'] });
        if (place.location) {
          return {
            lat: place.location.lat(),
            lng: place.location.lng()
          };
        }
      } catch (error: any) {
        console.warn("New Places API fetchFields failed.", error);
        // Não tentamos legacy aqui para evitar erro de API Disabled se o usuário só tem a New API
        return null;
      }
    } else {
      // PRIORIDADE 2: Legacy PlacesService
      // Fallback para serviço antigo apenas se a classe Place não existir no window
      try {
        if (!placesService) {
          placesService = new window.google.maps.places.PlacesService(document.createElement('div'));
        }

        return new Promise((resolve) => {
          placesService.getDetails({
            placeId: placeId,
            fields: ['geometry']
          }, (place: any, status: any) => {
            if (status === window.google.maps.places.PlacesServiceStatus.OK && place.geometry && place.geometry.location) {
              resolve({
                lat: place.geometry.location.lat(),
                lng: place.geometry.location.lng()
              });
            } else {
              resolve(null);
            }
          });
        });
      } catch (legacyError) {
        return null;
      }
    }
  }
  return null;
};

// --- OSRM ROUTING SERVICE (FREE) ---
const calculateRouteOSRM = async (
  origin: { lat: number, lng: number },
  destination: { lat: number, lng: number }
): Promise<RouteResult | null> => {
  try {
    // OSRM Public Server (Demo only - for production use your own docker instance or paid provider like Mapbox)
    // Format: {lon},{lat};{lon},{lat}
    const url = `http://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=false`;

    const response = await axios.get(url);

    if (response.data && response.data.routes && response.data.routes.length > 0) {
      const route = response.data.routes[0];
      const distanceMeters = route.distance;
      const durationSeconds = route.duration;

      return {
        distance: `${(distanceMeters / 1000).toFixed(1)} km`,
        duration: `${Math.ceil(durationSeconds / 60)} min`,
        distanceValue: distanceMeters / 1000,
        durationValue: Math.ceil(durationSeconds / 60)
      };
    }
    return null;
  } catch (error) {
    console.warn("OSRM Routing failed:", error);
    return null;
  }
};

export const calculateRoute = async (
  origin: string | { lat: number, lng: number },
  destination: string | { lat: number, lng: number },
  waypoints: { lat: number, lng: number }[] = []
): Promise<RouteResult> => {
  // 1. Tentar OSRM Primeiro (Gratuito)
  if (typeof origin !== 'string' && typeof destination !== 'string' && waypoints.length === 0) {
    // OSRM exige coordenadas númericas. Se for string, teríamos que geocodificar antes.
    // E OSRM demo server é simples, sem waypoints complexos nesta impl.
    const osrmResult = await calculateRouteOSRM(origin as any, destination as any);
    if (osrmResult) {
      return osrmResult;
    }
  }

  // 2. Tentar Google Directions API (Pago/Crédito)
  if (hasValidKey() && typeof window !== 'undefined' && window.google && window.google.maps) {
    try {
      if (!directionsService) {
        directionsService = new window.google.maps.DirectionsService();
      }

      const formattedWaypoints = waypoints.map(wp => ({
        location: wp,
        stopover: true
      }));

      const result: any = await new Promise((resolve, reject) => {
        directionsService.route({
          origin: origin,
          destination: destination,
          waypoints: formattedWaypoints,
          optimizeWaypoints: true,
          travelMode: window.google.maps.TravelMode.DRIVING,
          drivingOptions: {
            departureTime: new Date(),
            trafficModel: 'bestguess'
          }
        }, (result: any, status: any) => {
          if (status === window.google.maps.DirectionsStatus.OK) {
            resolve(result);
          } else {
            // Rejeita para cair no fallback se a API Directions não estiver ativa
            reject(status);
          }
        });
      });

      const route = result.routes[0];
      let totalDistanceMeters = 0;
      let totalDurationSeconds = 0;

      route.legs.forEach((leg: any) => {
        totalDistanceMeters += leg.distance.value;
        totalDurationSeconds += leg.duration.value;
      });

      return {
        distance: `${(totalDistanceMeters / 1000).toFixed(1)} km`,
        duration: `${Math.ceil(totalDurationSeconds / 60)} min`,
        distanceValue: totalDistanceMeters / 1000,
        durationValue: Math.ceil(totalDurationSeconds / 60)
      };

    } catch (error) {
      console.warn("API de Rotas Google falhou. Tentando fallback.", error);
    }
  }

  // 2. Fallback: Simulação Matemática
  // Usado se Directions API falhar ou não estiver habilitada
  await new Promise(r => setTimeout(r, 800));
  const distanceVal = Math.floor(Math.random() * (120 - 15) + 15) / 10;
  const extraDistance = waypoints.length * 2.5;
  const finalDistance = distanceVal + extraDistance;
  const durationVal = Math.floor(finalDistance * 2 + 3);

  return {
    distance: `${finalDistance.toFixed(1)} km`,
    duration: `${durationVal} min`,
    distanceValue: finalDistance,
    durationValue: durationVal
  };
};

export const calculatePrice = (serviceType: ServiceType, distanceKm: number): number => {
  const service = SERVICES.find(s => s.id === serviceType);
  if (!service) return 0;

  const total = service.basePrice + (distanceKm * service.pricePerKm);
  return parseFloat(total.toFixed(2));
};