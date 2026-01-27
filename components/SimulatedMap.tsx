import React, { useEffect, useState, useCallback, useRef } from 'react';
import { GoogleMap, useJsApiLoader, Marker as GoogleMarker, DirectionsRenderer } from '@react-google-maps/api';
import { MapContainer, TileLayer, Marker as LeafletMarker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

import { APP_CONFIG } from '../constants';
import { Coords, Driver } from '../types';
import { Loader2, AlertTriangle, Leaf } from 'lucide-react';

// Fix for Leaflet default icons in Webpacking
import iconMarker from 'leaflet/dist/images/marker-icon.png';
import iconRetina from 'leaflet/dist/images/marker-icon-2x.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: iconMarker,
  iconRetinaUrl: iconRetina,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Custom Icons for Leaflet
const driverIcon = L.divIcon({
  html: '<div style="background-color: #16a34a; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.3);"></div>',
  className: 'custom-driver-icon',
  iconSize: [12, 12],
  iconAnchor: [6, 6]
});

const userIcon = L.divIcon({
  html: '<div style="background-color: #f97316; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.3);"></div>',
  className: 'custom-user-icon',
  iconSize: [16, 16],
  iconAnchor: [8, 8]
});


// Fix for Google Maps types when @types/google.maps is not installed
declare global {
  interface Window {
    google: any;
  }
}

// IMPORTANTE: Definir bibliotecas fora do componente para manter referência estável
const libraries: ("places" | "geometry")[] = ['places', 'geometry'];

interface MapProps {
  showDriver?: boolean;
  showRoute?: boolean;
  status?: string;
  origin?: Coords | null;
  destination?: Coords | null;
  waypoints?: Coords[];
  driverLocation?: Coords | null;
  drivers?: Driver[];
  recenterTrigger?: number;
  onCameraChange?: (coords: Coords) => void;
}

const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

// Ponto central padrão (Avaré - SP)
const defaultCenter = {
  lat: -23.1047,
  lng: -48.9213,
};

// --- LEAFLET COMPONENT (FREE / OPTIMIZED) ---

// --- LEAFLET COMPONENT (FREE / OPTIMIZED) ---

const LeafletMapInner: React.FC<MapProps> = ({ showDriver, showRoute, origin, destination, driverLocation, drivers, waypoints, recenterTrigger, onCameraChange }) => {
  const map = useMap();

  useMapEvents({
    moveend: () => {
      if (onCameraChange) {
        const center = map.getCenter();
        onCameraChange({ lat: center.lat, lng: center.lng });
      }
    }
  });

  // Auto-fit bounds
  useEffect(() => {
    if (!map) return;
    const bounds = L.latLngBounds([]);
    let hasPoints = false;

    if (origin) { bounds.extend([origin.lat, origin.lng]); hasPoints = true; }
    if (destination) { bounds.extend([destination.lat, destination.lng]); hasPoints = true; }
    if (driverLocation && showDriver) { bounds.extend([driverLocation.lat, driverLocation.lng]); hasPoints = true; }
    if (drivers) {
      drivers.forEach(d => {
        if (d.location && d.location.lat !== 0) {
          bounds.extend([d.location.lat, d.location.lng]);
          hasPoints = true;
        }
      });
    }

    if (hasPoints) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [map, origin, destination, driverLocation, drivers, showDriver]);

  // Decoding simple OSRM geometry (if we had the polyline string). 
  // Since we don't have the polyline string from the service yet (we only got distance/duration),
  // we will draw a straight line for now or we would need to fetch the route geometry again here.
  // Optimization: Draw simple straight line for visual feedback if route data missing, 
  // OR fetch OSRM route geometry here for display.

  const [routePositions, setRoutePositions] = useState<[number, number][]>([]);

  useEffect(() => {
    if (showRoute && origin && destination) {
      // Fetch geometry for display
      const fetchRoute = async () => {
        try {
          const url = `http://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`;
          const res = await fetch(url);
          const data = await res.json();
          if (data.routes && data.routes[0]) {
            const coords = data.routes[0].geometry.coordinates; // [lon, lat]
            setRoutePositions(coords.map((c: any) => [c[1], c[0]])); // Convert to [lat, lon]
          }
        } catch (e) { console.warn("Erro rota leaflet", e); }
      };
      fetchRoute();
    } else {
      setRoutePositions([]);
    }
  }, [showRoute, origin, destination]);

  return (
    <>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {origin && !drivers && (
        <LeafletMarker position={[origin.lat, origin.lng]} icon={userIcon} />
      )}
      {destination && showRoute && (
        <LeafletMarker position={[destination.lat, destination.lng]} />
      )}
      {showDriver && driverLocation && !drivers && (
        <LeafletMarker position={[driverLocation.lat, driverLocation.lng]} icon={driverIcon} />
      )}
      {drivers && drivers.map(d => (
        d.location && d.location.lat !== 0 && (
          <LeafletMarker key={d.id} position={[d.location.lat, d.location.lng]} icon={driverIcon}>
            <Popup>{d.name} - {d.status}</Popup>
          </LeafletMarker>
        )
      ))}
      {routePositions.length > 0 && (
        <Polyline positions={routePositions} color="#f97316" weight={5} />
      )}
    </>
  );
};

// --- GOOGLE MAPS COMPONENT (LEGACY / PRECISE) ---

// ... (imports remain the same)

// CUSTOM GOOGLE MAPS STYLE (Clean/Uber-like)
const GOOGLE_MAP_STYLES = [
  {
    "featureType": "administrative",
    "elementType": "geometry",
    "stylers": [{ "visibility": "off" }]
  },
  {
    "featureType": "poi",
    "stylers": [{ "visibility": "off" }]
  },
  {
    "featureType": "road",
    "elementType": "labels.icon",
    "stylers": [{ "visibility": "off" }]
  },
  {
    "featureType": "transit",
    "stylers": [{ "visibility": "off" }]
  },
  {
    "featureType": "water",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#515c6d" }]
  },
  {
    "featureType": "water",
    "elementType": "labels.text.stroke",
    "stylers": [{ "color": "#17263c" }]
  },
  // Customize colors to match "Uni Mobilidade" screenshot
  {
    "featureType": "water",
    "elementType": "geometry",
    "stylers": [{ "color": "#e9e9e9" }, { "lightness": 17 }]
  },
  {
    "featureType": "landscape",
    "elementType": "geometry",
    "stylers": [{ "color": "#f5f5f5" }, { "lightness": 20 }]
  },
  {
    "featureType": "road.highway",
    "elementType": "geometry.fill",
    "stylers": [{ "color": "#ffffff" }, { "lightness": 17 }]
  },
  {
    "featureType": "road.highway",
    "elementType": "geometry.stroke",
    "stylers": [{ "color": "#ffffff" }, { "lightness": 29 }, { "weight": 0.2 }]
  },
  {
    "featureType": "road.arterial",
    "elementType": "geometry",
    "stylers": [{ "color": "#ffffff" }, { "lightness": 18 }]
  },
  {
    "featureType": "road.local",
    "elementType": "geometry",
    "stylers": [{ "color": "#ffffff" }, { "lightness": 16 }]
  },
  {
    "featureType": "poi",
    "elementType": "geometry",
    "stylers": [{ "color": "#f5f5f5" }, { "lightness": 21 }]
  },
  {
    "featureType": "poi.park",
    "elementType": "geometry",
    "stylers": [{ "color": "#dedede" }, { "lightness": 21 }]
  },
  {
    "elementType": "labels.text.stroke",
    "stylers": [{ "visibility": "on" }, { "color": "#ffffff" }, { "lightness": 16 }]
  },
  {
    "elementType": "labels.text.fill",
    "stylers": [{ "saturation": 36 }, { "color": "#333333" }, { "lightness": 40 }]
  },
  {
    "elementType": "labels.icon",
    "stylers": [{ "visibility": "off" }]
  }
];

// ... (LeafletMapInner remains the same)

const GoogleMapInner: React.FC<MapProps> = ({ showDriver, showRoute, status, origin, destination, driverLocation, drivers, waypoints, recenterTrigger, onCameraChange }) => {
  const [map, setMap] = useState<any | null>(null);
  const [directionsResponse, setDirectionsResponse] = useState<any | null>(null);

  // Estado para animação suave do marcador do motorista
  const [animatedDriverLocation, setAnimatedDriverLocation] = useState<Coords | null>(null);
  const [driverRotation, setDriverRotation] = useState(0);
  const prevDriverLocationRef = useRef<Coords | null>(null);

  const onLoad = useCallback((map: any) => {
    setMap(map);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  // Calcular Rota
  useEffect(() => {
    if (showRoute && origin && destination && window.google) {
      const directionsService = new window.google.maps.DirectionsService();

      const formattedWaypoints = waypoints ? waypoints.map(p => ({
        location: p,
        stopover: true
      })) : [];

      directionsService.route({
        origin: origin,
        destination: destination,
        waypoints: formattedWaypoints,
        optimizeWaypoints: true,
        travelMode: window.google.maps.TravelMode.DRIVING,
      }, (result: any, status: any) => {
        if (status === window.google.maps.DirectionsStatus.OK) {
          setDirectionsResponse(result);
        } else {
          console.error(`Erro ao buscar rota: ${status}`);
        }
      });
    } else {
      setDirectionsResponse(null);
      // Limpa directions se a rota não deve ser mostrada
      if (directionsResponse) setDirectionsResponse(null);
    }
  }, [showRoute, origin, destination, waypoints]); // Removido directionsResponse da dependência para evitar loop se não setado null corretamente

  // Animar movimento do motorista suavemente
  useEffect(() => {
    if (!driverLocation) {
      setAnimatedDriverLocation(null);
      return;
    }

    const prev = prevDriverLocationRef.current;

    // Calcular rotação baseado na direção do movimento
    if (prev && (prev.lat !== driverLocation.lat || prev.lng !== driverLocation.lng)) {
      const deltaLat = driverLocation.lat - prev.lat;
      const deltaLng = driverLocation.lng - prev.lng;
      const angle = Math.atan2(deltaLng, deltaLat) * (180 / Math.PI);
      setDriverRotation(angle);
    }

    // Animação suave com interpolação
    if (prev && animatedDriverLocation) {
      const startLat = animatedDriverLocation.lat;
      const startLng = animatedDriverLocation.lng;
      const endLat = driverLocation.lat;
      const endLng = driverLocation.lng;

      let startTime: number | null = null;
      const duration = 1000; // 1 segundo de animação

      const animate = (timestamp: number) => {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing suave (ease-in-out)
        const easeProgress = progress < 0.5
          ? 2 * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;

        const currentLat = startLat + (endLat - startLat) * easeProgress;
        const currentLng = startLng + (endLng - startLng) * easeProgress;

        setAnimatedDriverLocation({ lat: currentLat, lng: currentLng });

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };

      requestAnimationFrame(animate);
    } else {
      // Primeira vez, define direto
      setAnimatedDriverLocation(driverLocation);
    }

    prevDriverLocationRef.current = driverLocation;
  }, [driverLocation]);

  // Ajustar Zoom e Centralização
  useEffect(() => {
    if (!map) return;

    if (drivers && drivers.length > 0) {
      // Modo Admin: Fit bounds para todos os motoristas
      const bounds = new window.google.maps.LatLngBounds();
      let hasValidLoc = false;
      drivers.forEach(d => {
        if (d.location && d.location.lat !== 0) {
          bounds.extend(d.location);
          hasValidLoc = true;
        }
      });
      if (hasValidLoc) {
        map.fitBounds(bounds);
      } else {
        map.panTo(defaultCenter);
        map.setZoom(13);
      }
    } else if (showDriver && driverLocation) {
      // Driver Mode: Follow Driver
      map.panTo(driverLocation);
      map.setZoom(16);
    } else if (origin && !destination && !showRoute) {
      // Modo Acompanhar Usuário (Home) - Força recentralizar se trigger mudar
      map.panTo(origin);
      map.setZoom(15);
    }
  }, [map, origin, destination, showRoute, drivers, driverLocation, showDriver, recenterTrigger]);

  return (
    <GoogleMap
      mapContainerStyle={mapContainerStyle}
      center={origin || defaultCenter}
      zoom={14}
      onLoad={onLoad}
      onUnmount={onUnmount}
      onDragEnd={() => {
        if (map && onCameraChange) {
          const c = map.getCenter();
          onCameraChange({ lat: c.lat(), lng: c.lng() });
        }
      }}
      onIdle={() => {
        if (map && onCameraChange) {
          const c = map.getCenter();
          onCameraChange({ lat: c.lat(), lng: c.lng() });
        }
      }}
      options={{
        disableDefaultUI: true,
        zoomControl: false, // Clean UI
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
        rotateControl: false,
        clickableIcons: false,
        styles: GOOGLE_MAP_STYLES
      }}
    >
      {/* User Marker (Origin) */}
      {origin && !drivers && (
        <GoogleMarker position={origin} icon={{
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: "#f97316",
          fillOpacity: 1,
          strokeWeight: 2,
          strokeColor: "#ffffff",
        }} />
      )}

      {/* Destination Marker */}
      {destination && showRoute && (
        <GoogleMarker position={destination} />
      )}

      {/* Single Driver Marker - Com animação suave */}
      {showDriver && animatedDriverLocation && !drivers && (
        <GoogleMarker
          position={animatedDriverLocation}
          icon={{
            path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            scale: 6,
            fillColor: "#16a34a",
            fillOpacity: 1,
            strokeWeight: 1,
            strokeColor: "#ffffff",
            rotation: driverRotation
          }}
        />
      )}

      {/* Multiple Drivers Markers (Admin) */}
      {drivers && drivers.map(driver => (
        driver.location && driver.location.lat !== 0 && (
          <GoogleMarker
            key={driver.id}
            position={driver.location}
            title={`${driver.name} - ${driver.status}`}
            icon={{
              path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
              scale: 6,
              fillColor: driver.status === 'online' ? "#16a34a" : driver.status === 'busy' ? "#f59e0b" : "#9ca3af",
              fillOpacity: 1,
              strokeWeight: 2,
              strokeColor: "#ffffff",
              rotation: Math.random() * 360
            }}
          />
        )
      ))}

      {/* Route Line */}
      {directionsResponse && (
        <DirectionsRenderer
          directions={directionsResponse}
          options={{
            suppressMarkers: true,
            polylineOptions: {
              strokeColor: "#f97316",
              strokeWeight: 5
            }
          }}
        />
      )}
    </GoogleMap>
  );
};


// Componente Principal que gerencia o carregamento da API
export const SimulatedMap: React.FC<MapProps> = (props) => {
  const apiKey = APP_CONFIG.googleMapsApiKey;

  // Use Leaflet by default is FALSE now, to show Google Map style requested by user
  // If API key is missing, it will fallback to Leaflet automatically below.
  const [useLeaflet, setUseLeaflet] = useState(false);

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey || '',
    preventGoogleFontsLoading: true,
    libraries: libraries
  });

  // Se não tiver API Key, forçamos Leaflet
  useEffect(() => {
    if (!apiKey) setUseLeaflet(true);
  }, [apiKey]);


  if (useLeaflet) {
    return (
      <div className="relative w-full h-full animate-fade-in bg-gray-100 z-0">
        <MapContainer center={[defaultCenter.lat, defaultCenter.lng]} zoom={13} style={mapContainerStyle} zoomControl={false}>
          <LeafletMapInner {...props} />
        </MapContainer>

        {/* Status Badge Overlay */}
        {props.status && (
          <div className="absolute top-12 left-4 right-4 z-[400]" style={{ pointerEvents: 'none' }}>
            <div className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-lg shadow-sm border-l-4 border-orange-500 text-sm font-medium text-gray-800 inline-block pointer-events-auto">
              {props.status}
            </div>
          </div>
        )}

        <div className="absolute bottom-1 right-1 z-[400] bg-white/80 px-1 rounded text-[10px] text-gray-500">
          OpenStreetMap (Free)
        </div>
      </div>
    )
  }
  // ...

  // Fallback to Google Maps if Leaflet disabled
  if (loadError) {
    return (
      <div className="w-full h-full bg-gray-100 flex flex-col items-center justify-center text-red-500">
        <AlertTriangle size={32} className="mb-2" />
        <p>Erro ao carregar Google Maps API.</p>
        <button onClick={() => setUseLeaflet(true)} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded">Usar Mapa Alternativo</button>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="w-full h-full bg-gray-50 flex flex-col items-center justify-center text-orange-500">
        <Loader2 size={32} className="animate-spin mb-2" />
        <p className="text-sm font-medium">Carregando Mapa...</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full animate-fade-in">
      <GoogleMapInner {...props} />

      {props.status && (
        <div className="absolute top-12 left-4 right-4 z-30">
          <div className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-lg shadow-sm border-l-4 border-orange-500 text-sm font-medium text-gray-800">
            {props.status}
          </div>
        </div>
      )}
    </div>
  );
};