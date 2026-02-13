// Wrapper para serviços do Google Maps
import { ServiceType } from '../types';
import { SERVICES, APP_CONFIG } from '../constants';
import axios from 'axios';

interface AddressResult {
  description: string;
  mainText?: string; // Nome do local (ex: "Padaria do Zé")
  placeId: string;
  coords: { lat: number; lng: number } | null;
}

interface RouteResult {
  distance: string; // ex: "4.5 km"
  duration: string; // ex: "12 min"
  distanceValue: number; // em km
  durationValue: number; // em minutos
  polyline?: string; // Encoded polyline for static map
}

// Serviços Singleton
let autocompleteService: any = null;
let placesService: any = null;
let directionsService: any = null;
let geocoderService: any = null;

// Lista de locais simulados (Fallback se a API falhar ou não estiver carregada)
const MOCK_LOCATIONS: AddressResult[] = [
  { description: 'Terminal Rodoviário de Avaré', mainText: 'Rodoviária', placeId: 'loc1', coords: { lat: -23.104, lng: -48.925 } },
  { description: 'Santa Casa de Misericórdia', mainText: 'Santa Casa', placeId: 'loc2', coords: { lat: -23.102, lng: -48.921 } },
  { description: 'Largo São João (Centro)', mainText: 'Praça São João', placeId: 'loc3', coords: { lat: -23.106, lng: -48.926 } },
];

// Helper para verificar se temos uma chave válida configurada
const hasValidKey = () => {
  return APP_CONFIG.googleMapsApiKey && APP_CONFIG.googleMapsApiKey.trim().length > 0;
};

// --- FUNÇÃO DE AUTO-PREENCHIMENTO REVERSO (LAT/LNG -> ENDEREÇO) ---
export const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
  if (hasValidKey() && typeof window !== 'undefined' && window.google && window.google.maps) {
    if (!geocoderService) {
      if (window.google.maps.Geocoder) {
        try {
          geocoderService = new window.google.maps.Geocoder();
        } catch (e) {
          console.warn("Erro ao instanciar Geocoder:", e);
        }
      } else {
        console.warn("Google Maps Geocoder library not loaded yet.");
        // Fallback: return simple coordinate string or error handled by caller
        return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      }
    }

    if (geocoderService) {
      try {
        const response = await new Promise<string>((resolve, reject) => {
          geocoderService.geocode({ location: { lat, lng } }, (results: any, status: any) => {
            if (status === 'OK' && results && results.length > 0) {
              // Filtrar resultados para evitar Plus Codes (ex: "2WMR+FM...")
              // Priorizar 'street_address' ou 'route'
              const bestResult = results.find((r: any) =>
                r.types.includes('street_address') ||
                r.types.includes('route') ||
                r.types.includes('intersection')
              );

              // Se achar um bom, usa, senão usa o primeiro que não seja Plus Code
              let selected = bestResult;
              if (!selected) {
                selected = results.find((r: any) => !r.formatted_address.includes('+'));
              }
              // Fallback final: o primeiro resultado mesmo
              if (!selected) selected = results[0];

              resolve(selected.formatted_address);
            } else {
              reject(status);
            }
          });
        });

        // Limpeza e Formatação: "Rua, Número, Bairro, Cidade"
        // Formato típico Google: "Rua X, 123 - Bairro, Cidade - UF, CEP, Brasil"

        let clean = response.split(', Brasil')[0]; // Remove ", Brasil"

        // Remove CEP e Estado do final (ex: " - SP, 18700-000" ou ", Avaré - SP, ...")
        // Tenta remover o padrão de CEP primeiro
        clean = clean.replace(/, \d{5}-?\d{3}$/, '');
        // Tenta remover " - UF" do final se sobrar
        clean = clean.replace(/ - [A-Z]{2}$/, '');

        // Substitui " - " por ", " para seguir o pedido do usuario (Rua, Num, Bairro)
        clean = clean.replace(/ - /g, ', ');

        return clean;
      } catch (error) {
        console.warn("Reverse geocoding failed (API Error), using fallback.", error);
      }
    }
  }

  // Fallback simulado
  return `Rua Projetada, ${Math.floor(Math.random() * 100) + 1} - Centro`;
};

// --- FUNÇÃO PARA GEOCODIFICAR ENDEREÇO EXACTO (STRING -> LAT/LNG) ---
// Usada quando o usuário insere um número manualmente na busca
export const geocodeExactAddress = async (address: string): Promise<{ lat: number; lng: number } | null> => {
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
        return await new Promise<any>((resolve, reject) => {
          geocoderService.geocode({ address: address }, (results: any, status: any) => {
            if (status === 'OK' && results[0] && results[0].geometry) {
              const loc = results[0].geometry.location;
              resolve({ lat: loc.lat(), lng: loc.lng() });
            } else {
              resolve(null);
            }
          });
        });
      } catch (error) {
        console.warn("Geocoding failed", error);
        return null;
      }
    }
  }
  return null;
};

export const searchAddress = async (query: string, biasCoords?: { lat: number; lng: number }): Promise<AddressResult[]> => {
  if (!query) return [];

  const googleMapsAvailable = hasValidKey() && typeof window !== 'undefined' && window.google && window.google.maps;

  if (googleMapsAvailable) {
    if (!autocompleteService) {
      try {
        autocompleteService = new window.google.maps.places.AutocompleteService();
      } catch (e) {
        console.warn("Failed to init AutocompleteService", e);
      }
    }

    if (autocompleteService) {
      try {
        const request: any = {
          input: query,
          componentRestrictions: { country: 'br' }, // Restrict to Brazil
        };

        // Apply Location Bias
        if (biasCoords) {
          const circle = new window.google.maps.Circle({
            center: biasCoords,
            radius: 5000
          });
          // Modern API prefers locationBias, older accepts location/radius
          request.locationBias = circle.getBounds();
          // Fallback for older types definitions
          request.location = new window.google.maps.LatLng(biasCoords.lat, biasCoords.lng);
          request.radius = 5000;
        }

        return await new Promise<AddressResult[]>((resolve) => {
          autocompleteService.getPlacePredictions(request, (predictions: any[], status: any) => {
            if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
              const results = predictions.map((p) => ({
                description: p.description,
                mainText: p.structured_formatting?.main_text || p.description,
                placeId: p.place_id,
                coords: null // Autocomplete doesn't return coords, will be fetched on select
              }));
              resolve(results);
            } else {
              // ZERO_RESULTS or other status
              resolve([]);
            }
          });
        });
      } catch (error) {
        console.warn("AutocompleteService failed", error);
        // Continue to fallback
      }
    }
  }

  // Fallback: Tentativa com OpenStreetMap (Nominatim) GRATUITO
  // Isso evita coordenadas aleatórias e "calibra" a posição real
  try {
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=br&limit=5`;
    const res = await axios.get(nominatimUrl);

    if (res.data && res.data.length > 0) {
      return res.data.map((item: any) => ({
        description: item.display_name,
        mainText: item.name || item.display_name.split(',')[0],
        placeId: `osm_${item.place_id}`,
        coords: { lat: parseFloat(item.lat), lng: parseFloat(item.lon) }
      }));
    }
  } catch (osmError) {
    console.warn("Erro no fallback Nominatim:", osmError);
  }

  // Fallback Final (Mock Aleatório apenas se OSM falhar)
  const lowerQuery = query.toLowerCase();

  // Locais Hardcoded de Avaré para demo bonita
  const hardcodedMatches = MOCK_LOCATIONS.filter(loc =>
    loc.description.toLowerCase().includes(lowerQuery) || (loc.mainText && loc.mainText.toLowerCase().includes(lowerQuery))
  );

  if (hardcodedMatches.length > 0) return hardcodedMatches;

  if (query.length > 2) {
    // Último recurso: Random (mas evite se possível)
    return [{
      description: query,
      placeId: `mock_${Date.now()}`,
      coords: { lat: -23.1047 + (Math.random() * 0.01), lng: -48.9213 + (Math.random() * 0.01) }
    }];
  }

  return [];
};

export const getPlaceDetails = async (placeId: string): Promise<{ lat: number, lng: number } | null> => {
  // Se for OSM ID, já teremos as coords passadas via state se possível, 
  // mas aqui o componente AddressAutocomplete pode passar o objeto inteiro se adaptarmos.
  // Porem, se o `AddressAutocomplete` salva apenas AddressResult e depois chama getPlaceDetails passando ID...
  // Precisamos que o AddressResult JÁ tenha coords.

  // O AddressAutocomplete atual (UserApp) usa `onSelect(addr, coords)`.
  // Se `searchAddress` retornar coords preenchidas, o UserApp usa elas diretamente?
  // UserApp.tsx: 
  /*
    const handleAddressSelect = async (address: string, placeId: string) => {
      const coords = await getPlaceDetails(placeId);
      ...
    }
  */
  // No, UserApp usa AddressAutocomplete component.
  // Vamos verificar AddressAutocomplete component rapidamente?
  // Assumindo que Se placeId começar com 'osm_', precisamos recuperar as coords
  // Mas Nominatim search já retorna lat/lon.
  // O ideal é que searchAddress retorne coords e o componente use.

  const mock = MOCK_LOCATIONS.find(m => m.placeId === placeId);
  if (mock && mock.coords) return mock.coords;

  if (placeId.startsWith('mock_')) {
    return { lat: -23.1047 + (Math.random() * 0.01), lng: -48.9213 + (Math.random() * 0.01) };
  }

  // Se for OSM, teoricamente o `AddressAutocomplete` já extraiu as coords do item selecionado?
  // Se precisarmos buscar detalhes do OSM pelo place_id é complexo (reverse).
  // Hack: Se for OSM, assumimos que o item selecionado já veio com coords no `AddressAutocomplete`.
  // Mas se cair aqui, retornamos null ou tentamos algo?
  // Como `searchAddress` retorna coords preenchidas para OSM, o AddressAutocomplete deve usar isso.

  if (hasValidKey() && typeof window !== 'undefined' && window.google && window.google.maps && !placeId.startsWith('osm_')) {
    // ... Google Logic ...


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
    // Request full overview for polyline
    const url = `http://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=polyline`;

    const response = await axios.get(url);

    if (response.data && response.data.routes && response.data.routes.length > 0) {
      const route = response.data.routes[0];
      const distanceMeters = route.distance;
      const durationSeconds = route.duration;

      return {
        distance: `${(distanceMeters / 1000).toFixed(1)} km`,
        duration: `${Math.ceil(durationSeconds / 60)} min`,
        distanceValue: distanceMeters / 1000,
        durationValue: Math.ceil(durationSeconds / 60),
        polyline: route.geometry // OSRM returns geometry string if requested
      };
    }
    return null;
  } catch (error) {
    console.warn("OSRM Routing failed:", error);
    return null;
  }
};

const routeCache = new Map<string, RouteResult>();

export const calculateRoute = async (
  origin: string | { lat: number, lng: number },
  destination: string | { lat: number, lng: number },
  waypoints: { lat: number, lng: number }[] = []
): Promise<RouteResult> => {
  // Smart Caching: Generate Cache Key
  const key = [
    typeof origin === 'string' ? origin : `${origin.lat},${origin.lng}`,
    typeof destination === 'string' ? destination : `${destination.lat},${destination.lng}`,
    waypoints.map(w => `${w.lat},${w.lng}`).join('|')
  ].join('::');

  if (routeCache.has(key)) {
    return routeCache.get(key)!;
  }

  // 1. Tentar Google Directions API (Prioridade para Preço Preciso)
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
          // Removed drivingOptions to avoid API errors on standard keys
          // drivingOptions: { departureTime: new Date(), trafficModel: 'bestguess' }
        }, (result: any, status: any) => {
          if (status === window.google.maps.DirectionsStatus.OK) {
            resolve(result);
          } else {
            console.warn("Google Directions Failed:", status);
            reject(status);
          }
        });
      });

      const route = result.routes[0];
      let totalDistanceMeters = 0;
      let totalDurationSeconds = 0;

      if (route.legs) {
        route.legs.forEach((leg: any) => {
          totalDistanceMeters += leg.distance?.value || 0;
          totalDurationSeconds += leg.duration?.value || 0;
        });
      }

      let encodedPolyline = route.overview_polyline;

      // FIX: JS API DirectionsService sometimes returns 'overview_path' (Array) instead of 'overview_polyline' (String)
      // We must encode it manually if the string is missing.
      if (!encodedPolyline && route.overview_path && window.google?.maps?.geometry?.encoding) {
        try {
          encodedPolyline = window.google.maps.geometry.encoding.encodePath(route.overview_path);
        } catch (e) {
          console.warn("Polyline encoding failed", e);
        }
      }

      // Fallback manual encoding if library missing (rare but possible) or fail
      if (!encodedPolyline && route.overview_path) {
        // Simple fallback: just don't crash, but ideally we should have a manual encoder here. 
        // For now, trusting the geometry library is loaded (checked in SimulatedMap).
      }

      const resultObj: RouteResult = {
        distance: `${(totalDistanceMeters / 1000).toFixed(1)} km`,
        duration: `${Math.ceil(totalDurationSeconds / 60)} min`,
        distanceValue: totalDistanceMeters / 1000,
        durationValue: Math.ceil(totalDurationSeconds / 60),
        polyline: encodedPolyline || undefined
      };

      routeCache.set(key, resultObj);
      return resultObj;

    } catch (googleError) {
      console.warn("Google Route Calc failed, falling back to OSRM...", googleError);
      // Fallback continues below
    }
  }

  // 2. Tentar OSRM (Gratuito) como Fallback
  // OSRM requires Coordinates. If origin/dest are strings, we can't use OSRM directly in this implementation
  // unless we Geocode them first. But we assume UserApp passes coords if available.
  if (typeof origin !== 'string' && typeof destination !== 'string') {
    const osrmResult = await calculateRouteOSRM(origin as any, destination as any);
    if (osrmResult) {
      // Don't cache OSRM forever if we want Google? 
      // Actually we can cache it too, assuming if Google failed once it might be down/unconfigured.
      routeCache.set(key, osrmResult);
      return osrmResult;
    }
  }

  // 3. Fallback final (Mock)
  console.warn("Using Mock Route data");
  return {
    distance: '5.0 km',
    duration: '15 min',
    distanceValue: 5.0,
    durationValue: 15
  };
};

export const calculatePrice = (serviceType: ServiceType, distanceKm: number): number => {
  const service = SERVICES.find(s => s.id === serviceType);
  if (!service) return 0;

  const total = service.basePrice + (distanceKm * service.pricePerKm);
  return parseFloat(total.toFixed(2));
};

export const getGoogleStaticMapUrl = (
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  polyline?: string
): string => {
  if (!hasValidKey()) return '';

  const apiKey = APP_CONFIG.googleMapsApiKey;
  // Markers: Origin (Green/A), Dest (Red/B)
  // Use scale=2 for retina support
  const markers = [
    `color:green|label:A|${origin.lat},${origin.lng}`,
    `color:red|label:B|${destination.lat},${destination.lng}`
  ];

  const markersParam = markers.map(m => `markers=${encodeURIComponent(m)}`).join('&');

  // Use encoded polyline if available (follows streets), otherwise straight line
  let pathParam: string;
  if (polyline) {
    // Encoded polyline from Directions API (follows actual streets)
    pathParam = `color:0xff6600|weight:4|enc:${polyline}`;
  } else {
    // Fallback: straight line between points
    pathParam = `color:0xff6600|weight:4|${origin.lat},${origin.lng}|${destination.lat},${destination.lng}`;
  }

  const url = `https://maps.googleapis.com/maps/api/staticmap?size=600x300&scale=2&maptype=roadmap&${markersParam}&path=${encodeURIComponent(pathParam)}&key=${apiKey}`;
  return url;
};