import React, { useEffect, useState, useCallback, useRef } from 'react';
import { GoogleMap, useJsApiLoader, Marker as GoogleMarker, DirectionsRenderer } from '@react-google-maps/api';
import Map, { Marker as MapboxMarker, Source, Layer, MapRef } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';

import { APP_CONFIG } from '../constants';
import { Coords, Driver } from '../types';
import { Loader2, AlertTriangle, Leaf, Flag, MapPin, Pencil, Clock } from 'lucide-react';




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
  onCameraChange?: (coords: Coords, isUserInteraction?: boolean) => void;
  fitBoundsPadding?: { top: number; bottom: number; left: number; right: number };
  // New Props for Custom Markers
  originAddress?: string;
  destinationAddress?: string;
  tripProfile?: { distance: string; duration: string };
  onEditOrigin?: () => void;
  onEditDestination?: () => void;
  isLoading?: boolean;
  initialCenter?: Coords;
}

const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

// Ponto central padrão (Avaré - SP)
// Ponto central padrão (Fallback se GPS falhar totalmente)
const defaultCenter = {
  lat: -23.5505, // SP Capital (better default than Avaré if needed)
  lng: -46.6333,
};

// --- LEAFLET COMPONENT (FREE / OPTIMIZED) ---



const MapboxMapInner: React.FC<MapProps> = (props) => {
  const {
    showDriver, showRoute, origin, destination, driverLocation, drivers, waypoints,
    recenterTrigger, onCameraChange, fitBoundsPadding,
    originAddress, destinationAddress, tripProfile,
    onEditOrigin, onEditDestination
  } = props;
  const mapRef = useRef<MapRef>(null);
  const [routeGeoJSON, setRouteGeoJSON] = useState<any>(null);
  const [viewState, setViewState] = useState({
    longitude: props.initialCenter?.lng || defaultCenter.lng,
    latitude: props.initialCenter?.lat || defaultCenter.lat,
    zoom: 14
  });

  const mapboxToken = APP_CONFIG.mapboxToken;

  // Memoize padding to prevent fitBounds regeneration on every render
  const safePadding = React.useMemo(() => {
    return fitBoundsPadding ?
      { top: fitBoundsPadding.top, bottom: fitBoundsPadding.bottom, left: fitBoundsPadding.left, right: fitBoundsPadding.right } :
      undefined;
  }, [fitBoundsPadding?.top, fitBoundsPadding?.bottom, fitBoundsPadding?.left, fitBoundsPadding?.right]);

  // Use Refs to access latest props in fitBounds without forcing re-renders/dep-changes
  const propsRef = useRef(props);
  useEffect(() => { propsRef.current = props; });

  // Helper function to fit bounds - READS FROM REF
  const fitBounds = useCallback((mapInstance: any) => {
    if (!mapInstance) return;

    const { origin, destination, driverLocation, showDriver, waypoints } = propsRef.current;

    const points: Coords[] = [];
    if (origin) points.push(origin);
    if (destination) points.push(destination);
    if (driverLocation && showDriver) points.push(driverLocation);
    if (waypoints) points.push(...waypoints);

    if (points.length > 0) {
      // Define padding logic first to use in both cases
      // Use provided padding or default
      const defaultPadding = showRoute
        ? { top: 120, bottom: 550, left: 60, right: 60 }
        : { top: 300, bottom: 300, left: 40, right: 40 };

      // Use efficient padding check to avoid dependency churn
      const p = fitBoundsPadding || defaultPadding;
      const padding = { top: p.top, bottom: p.bottom, left: p.left, right: p.right };

      if (points.length === 1) {
        mapInstance.flyTo({
          center: [points[0].lng, points[0].lat],
          zoom: 15.5,
          padding: padding
        });
      } else {
        const minLng = Math.min(...points.map(p => p.lng));
        const maxLng = Math.max(...points.map(p => p.lng));
        const minLat = Math.min(...points.map(p => p.lat));
        const maxLat = Math.max(...points.map(p => p.lat));

        mapInstance.resize();

        mapInstance.fitBounds(
          [[minLng, minLat], [maxLng, maxLat]],
          { padding: padding, duration: 1500, maxZoom: 16 }
        );
      }
    }
  }, [safePadding, showRoute]); // Only recreate if padding mode or route mode changes

  // Trigger fitBounds ONLY when specific triggers change
  useEffect(() => {
    if (mapRef.current) {
      fitBounds(mapRef.current);
    }
  }, [recenterTrigger, showRoute, fitBounds]); // Only re-fit on explicit trigger or route visibility toggle

  // Fetch Route from Mapbox Directions API
  useEffect(() => {
    if (showRoute && origin && destination && mapboxToken) {
      const fetchRoute = async () => {
        try {
          const points: Coords[] = [];
          if (origin) points.push(origin);
          if (waypoints) points.push(...waypoints);
          if (destination) points.push(destination);

          if (points.length < 2) return;

          const coordinates = points.map(p => `${p.lng},${p.lat}`).join(';');
          const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?geometries=geojson&overview=full&access_token=${mapboxToken}`;

          const res = await fetch(url);
          const data = await res.json();

          if (data.routes && data.routes[0]) {
            setRouteGeoJSON({
              type: 'Feature',
              properties: {},
              geometry: data.routes[0].geometry
            });
          }
        } catch (e) { console.warn("Erro rota mapbox", e); }
      };
      fetchRoute();
    } else {
      setRouteGeoJSON(null);
    }
  }, [showRoute, origin, destination, waypoints, mapboxToken]);

  if (!mapboxToken) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100 text-gray-500 flex-col p-4 text-center">
        <AlertTriangle size={32} className="mb-2 text-yellow-500" />
        <p className="font-bold">Mapbox Token Não Configurado</p>
        <p className="text-sm">Adicione VITE_MAPBOX_TOKEN ao .env</p>
      </div>
    );
  }

  return (
    <Map
      ref={mapRef}
      onLoad={(e) => {
        // Trigger fitbounds immediately on load
        fitBounds(e.target);
      }}
      initialViewState={viewState}
      onMove={evt => setViewState(evt.viewState)}
      onMoveEnd={(evt) => {
        // Check if move was caused by user interaction (drag/zoom) vs flyTo/fitBounds
        // Mapbox doesn't give a direct flag in the event object for "isUserInteraction" easily in this wrapper, 
        // but typically onMoveEnd comes from user or animation. 
        // We will assume true here for now as most 'end' events are user-driven or we can filter by event originalEvent.
        const isUser = evt.originalEvent !== undefined;
        if (onCameraChange) onCameraChange({ lat: viewState.latitude, lng: viewState.longitude }, isUser);
      }}
      style={{ width: '100%', height: '100%' }}
      mapStyle="mapbox://styles/mapbox/streets-v12"
      mapboxAccessToken={mapboxToken}
    >
      {origin && (
        <MapboxMarker longitude={origin.lng} latitude={origin.lat} anchor="bottom">
          <div className="relative flex flex-col items-center group z-20">
            {/* Address Bubble - ONLY show if we have an address string and NOT just 'Localizando...' */}
            {originAddress && originAddress !== 'Localizando...' && originAddress !== 'Atualizando GPS...' ? (
              <div
                className="absolute bottom-full mb-3 flex flex-col items-center cursor-pointer pointer-events-auto hover:scale-105 transition-transform"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onEditOrigin) onEditOrigin();
                }}
              >
                <div className="bg-white rounded-xl shadow-xl py-2 px-3 flex items-center gap-3 whitespace-nowrap border border-gray-100 min-w-[140px] max-w-[220px]">
                  <span className="text-sm font-semibold text-gray-800 truncate max-w-[180px]">{originAddress}</span>
                  <Pencil size={12} className="text-gray-400 shrink-0" />
                </div>
                <div className="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-white relative -mt-[1px] drop-shadow-sm"></div>
              </div>
            ) : null}

            {/* Marker Dot - Reverted to Orange Pulsing as requested */}
            <div className="relative flex items-center justify-center">
              <div className="w-5 h-5 rounded-full bg-orange-500 border-[3px] border-white shadow-lg z-10 flex items-center justify-center">
                <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
              </div>
              {/* Always pulse for current location/origin */}
              <div className="absolute inset-0 bg-orange-400 rounded-full animate-ping opacity-60 z-0"></div>
            </div>
          </div>
        </MapboxMarker>
      )}

      {destination && showRoute && (
        <MapboxMarker longitude={destination.lng} latitude={destination.lat} anchor="bottom">
          <div className="relative flex flex-col items-center group z-30">
            {/* Destination Bubble with Stats - Matching Competitor Exactly */}
            <div
              className="absolute bottom-full mb-4 flex flex-col items-center z-50 pointer-events-auto"
              onClick={(e) => {
                e.stopPropagation();
                if (onEditDestination) onEditDestination();
              }}
            >
              <div className="bg-white rounded-lg shadow-xl overflow-hidden min-w-[140px] max-w-[200px] border border-gray-200">
                {/* Header: Address + Pencil */}
                <div className="py-2 px-3 flex items-center justify-between gap-2 bg-white">
                  <span className="text-sm font-bold text-gray-800 truncate leading-tight">
                    {/* Format address to "Street, Number" style if possible */}
                    {destinationAddress ? (() => {
                      const parts = destinationAddress.split(',');
                      if (parts.length >= 2) return `${parts[0]},${parts[1]}`;
                      return destinationAddress;
                    })() : 'Destino'}
                  </span>
                  <Pencil size={12} className="text-gray-400 shrink-0" />
                </div>

                {/* Footer: Stats (Dark Background) */}
                {tripProfile && (
                  <div className="bg-slate-800 text-white text-xs font-bold py-1.5 px-3 flex items-center justify-center gap-2">
                    <span>{tripProfile.distance}</span>
                    <span className="text-slate-500">•</span>
                    <span>{tripProfile.duration}</span>
                  </div>
                )}
              </div>

              {/* Pointer Arrow - Dark Color to match footer */}
              <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-slate-800 -mt-[1px] drop-shadow-sm"></div>
            </div>

            {/* Flag Marker - Purple/Orange Circle */}
            <div className="w-9 h-9 bg-orange-500 rounded-full border-[3px] border-white shadow-xl flex items-center justify-center">
              <Flag size={16} className="text-white fill-white" />
            </div>
          </div>
        </MapboxMarker>
      )}

      {/* Numbered Waypoints Markers */}
      {waypoints && showRoute && waypoints.map((waypoint, index) => (
        <MapboxMarker key={`waypoint-${index}`} longitude={waypoint.lng} latitude={waypoint.lat} anchor="bottom">
          <div className="relative flex items-center justify-center">
            <div className="w-6 h-6 bg-white rounded-full border-2 border-orange-500 flex items-center justify-center shadow-md z-10">
              <span className="text-orange-600 font-bold text-xs">{index + 1}</span>
            </div>
            <div className="absolute top-5 w-0.5 h-2 bg-orange-500"></div>
          </div>
        </MapboxMarker>
      ))}

      {showDriver && driverLocation && !drivers && (
        <MapboxMarker longitude={driverLocation.lng} latitude={driverLocation.lat}>
          <div className="bg-green-500 w-4 h-4 rounded-full border-2 border-white shadow-md"></div>
        </MapboxMarker>
      )}

      {drivers && drivers.map(d => (
        d.location && (
          <MapboxMarker key={d.id} longitude={d.location.lng} latitude={d.location.lat}>
            <div className="bg-green-600 w-3 h-3 rounded-full border border-white shadow-sm"></div>
          </MapboxMarker>
        )
      ))}

      {routeGeoJSON && (
        <Source id="route" type="geojson" data={routeGeoJSON}>
          <Layer
            id="route-line"
            type="line"
            layout={{ "line-join": "round", "line-cap": "round" }}
            paint={{ "line-color": "#f97316", "line-width": 5, "line-opacity": 0.8 }}
          />
        </Source>
      )}
    </Map>
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

const GoogleMapInner: React.FC<MapProps> = ({ showDriver, showRoute, status, origin, destination, driverLocation, drivers, waypoints, recenterTrigger, onCameraChange, fitBoundsPadding, initialCenter }) => {
  const [map, setMap] = useState<any | null>(null);
  const [directionsResponse, setDirectionsResponse] = useState<any | null>(null);

  // ... (keep state) ...
  const [animatedDriverLocation, setAnimatedDriverLocation] = useState<Coords | null>(null);
  const [driverRotation, setDriverRotation] = useState(0);
  const prevDriverLocationRef = useRef<Coords | null>(null);

  const onLoad = useCallback((map: any) => {
    setMap(map);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  // ... (keep route calculation useEffect) ...

  // ... (keep driver animation useEffect) ...

  // Ajustar Zoom e Centralização
  useEffect(() => {
    if (!map) return;

    // Trigger resize to ensure map knows its dimensions
    window.google.maps.event.trigger(map, "resize");

    // Force aggressive padding
    const defaultPadding = { top: 150, right: 80, bottom: 600, left: 80 };
    const padding = fitBoundsPadding || defaultPadding;

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
        map.fitBounds(bounds, padding);
      } else {
        map.panTo(defaultCenter);
        map.setZoom(13);
      }
    } else if (showDriver && driverLocation) {
      // Driver Mode: Follow Driver
      map.panTo(driverLocation);
      map.setZoom(16);
    } else if (origin && destination) {
      // Fit bounds to include Origin + Destination (and Waypoints)
      const bounds = new window.google.maps.LatLngBounds();
      bounds.extend(origin);
      bounds.extend(destination);
      if (waypoints) waypoints.forEach(p => bounds.extend(p));

      // --- ALGORITMO DE VISUALIZAÇÃO SEGURA (SAFE VIEW) ---
      // Em vez de confiar apenas no padding do Google (que pode falhar em containers pequenos),
      // nós expandimos a área da rota matematicamente.

      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();
      const latSpan = ne.lat() - sw.lat();
      const lngSpan = ne.lng() - sw.lng();

      // Adicionamos 30% de margem extra em todas as direções
      // Isso força o mapa a dar um "Zoom Out" garantido
      const expandedBounds = new window.google.maps.LatLngBounds(
        { lat: sw.lat() - (latSpan * 0.30), lng: sw.lng() - (lngSpan * 0.30) },
        { lat: ne.lat() + (latSpan * 0.30), lng: ne.lng() + (lngSpan * 0.30) }
      );

      // Fix: Respect the passed padding!
      map.fitBounds(expandedBounds, fitBoundsPadding || 0);

    } else if (origin && !destination && !showRoute) {
      // Modo Acompanhar Usuário (Home) - Força recentralizar se trigger mudar
      map.panTo(origin);
      map.setZoom(15);
    }
  }, [map, origin, destination, showRoute, drivers, driverLocation, showDriver, recenterTrigger, fitBoundsPadding, waypoints]);

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



  return (
    <GoogleMap
      mapContainerStyle={mapContainerStyle}
      center={origin || initialCenter || defaultCenter}
      zoom={14}
      onLoad={onLoad}
      onZoomChanged={() => {
        if (map && onCameraChange) {
          const c = map.getCenter();
          // Zoom is also a user interaction
          onCameraChange({ lat: c.lat(), lng: c.lng() }, true);
        }
      }}
      onUnmount={onUnmount}
      onDragEnd={() => {
        if (map && onCameraChange) {
          const c = map.getCenter();
          onCameraChange({ lat: c.lat(), lng: c.lng() }, true);
        }
      }}
      onIdle={() => {
        if (map && onCameraChange) {
          const c = map.getCenter();
          onCameraChange({ lat: c.lat(), lng: c.lng() }, false);
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
            preserveViewport: true,
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
// Componente Principal que gerencia o carregamento da API e Escolha Visual
export const SimulatedMap: React.FC<MapProps> = (props) => {
  const apiKey = APP_CONFIG.googleMapsApiKey;
  const mapboxToken = APP_CONFIG.mapboxToken;

  // Use Leaflet by default is FALSE now. We prioritize Mapbox.

  // Load Google API for Services support (Hybrid Plan: usage for Price/Distance/Places)
  // Even if we don't render <GoogleMap>, we might need the script loaded for 'window.google.maps' 
  // usage in services/map.ts if that service checks 'window.google'.
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey || '',
    preventGoogleFontsLoading: true,
    libraries: libraries
  });

  // 0. Loading State (Prevents Avaré Jump)
  if (props.isLoading) {
    return (
      <div className="w-full h-full bg-gray-100 flex flex-col items-center justify-center animate-pulse z-50">
        <Loader2 className="w-10 h-10 text-orange-500 animate-spin mb-4" />
        <p className="text-gray-500 font-medium text-sm">Localizando GPS...</p>
      </div>
    );
  }

  // 1. Mapbox Visualization (Preferred by User)
  if (mapboxToken) {
    return (
      <div className="relative w-full h-full animate-fade-in bg-gray-100 z-0">
        <MapboxMapInner {...props} />

        {/* Status Badge */}
        {props.status && (
          <div className="absolute top-12 left-4 right-4 z-10" style={{ pointerEvents: 'none' }}>
            <div className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-lg shadow-sm border-l-4 border-orange-500 text-sm font-medium text-gray-800 inline-block pointer-events-auto">
              {props.status}
            </div>
          </div>
        )}
        <div className="absolute bottom-1 right-1 z-[400] bg-white/80 px-1 rounded text-[10px] text-gray-500">
          Mapbox GL JS
        </div>
      </div>
    );
  }

  // 2. Google Maps Fallback (if no Mapbox Token)
  // Only shows if API Key is valid and loaded.
  if (apiKey && isLoaded && !loadError) {
    return (
      <div className="relative w-full h-full animate-fade-in bg-gray-100 z-0">
        <GoogleMapInner {...props} />

        {props.status && (
          <div className="absolute top-12 left-4 right-4 z-[400]" style={{ pointerEvents: 'none' }}>
            <div className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-lg shadow-sm border-l-4 border-orange-500 text-sm font-medium text-gray-800 inline-block pointer-events-auto">
              {props.status}
            </div>
          </div>
        )}
      </div>
    );
  }

  // 3. Error State (No Mapbox, No Google)
  return (
    <div className="w-full h-full bg-gray-100 flex flex-col items-center justify-center text-gray-500 p-4 text-center">
      <p className="font-bold text-gray-800">Mapa não configurado</p>
      <p className="text-sm">Configure VITE_MAPBOX_TOKEN (preferido) ou API Google no .env</p>
    </div>
  );
};