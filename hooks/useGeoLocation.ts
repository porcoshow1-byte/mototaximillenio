import { useState, useEffect, useCallback } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

export const useGeoLocation = () => {
  const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const getCurrentLocation = useCallback(async () => {
    setLoading(true);
    try {
      // Verificar permissão
      const permission = await Geolocation.checkPermissions();
      if (permission.location !== 'granted') {
        const requested = await Geolocation.requestPermissions();
        if (requested.location !== 'granted') {
          throw new Error("Permissão de localização negada.");
        }
      }

      // Try High Accuracy with short timeout first
      try {
        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        });
        setLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        setLoading(false);
        return;
      } catch (e) {
        console.log("High accuracy GPS failed, trying low accuracy...");
      }

      // Fallback: Low Accuracy (faster, less precise but good enough for initial load)
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 30000 // Accept cached positions up to 30s old
      });

      setLocation({
        lat: position.coords.latitude,
        lng: position.coords.longitude
      });
      setLoading(false);

    } catch (err: any) {
      console.warn("Erro ao obter localização (Native/Web):", err);
      // Fallback to default center if absolutely everything fails
      setLocation({ lat: -23.5505, lng: -46.6333 }); // SP Check
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    getCurrentLocation();

    // FAILSAFE: Force stop loading after 8 seconds (Desktop/Permission hang protection)
    const failsafe = setTimeout(() => {
      setLoading(l => {
        if (l) {
          console.warn("GPS timed out (Failsafe triggered)");
          setLocation({ lat: -23.5505, lng: -46.6333 }); // SP Default
          return false;
        }
        return l;
      });
    }, 8000);

    let watcherId: string | number | null = null;
    const startWatcher = async () => {
      try {
        watcherId = await Geolocation.watchPosition({
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }, (position, err) => {
          if (err) {
            console.warn("Erro no watchPosition:", err);
            return;
          }
          if (position) {
            setLocation({
              lat: position.coords.latitude,
              lng: position.coords.longitude
            });
            setAccuracy(position.coords.accuracy);
            setLoading(false);
          }
        });
      } catch (error) {
        console.error("Falha ao iniciar Watcher GPS:", error);
      }
    };
    startWatcher();

    return () => {
      if (watcherId !== null) Geolocation.clearWatch({ id: watcherId as string });
    };
  }, [getCurrentLocation]);

  const [accuracy, setAccuracy] = useState<number | null>(null);

  return { location, accuracy, error, loading, getCurrentLocation };
};