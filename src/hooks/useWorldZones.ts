import { useState, useEffect, useRef, useCallback } from 'react';
import type { GenerativeZone } from '@/types/world';

const LOCAL_STORAGE_KEY = 'pokaimon-zones';

function loadLocalZones(): GenerativeZone[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalZones(zones: GenerativeZone[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(zones));
  } catch {
    // localStorage full or unavailable
  }
}

export function useWorldZones() {
  const [zones, setZones] = useState<GenerativeZone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const mountedRef = useRef(true);
  const isElectron = typeof window !== 'undefined' && !!window.electronAPI?.world;

  useEffect(() => {
    mountedRef.current = true;

    if (isElectron) {
      // Electron mode: load via IPC
      async function loadZones() {
        try {
          const result = await window.electronAPI?.world?.listZones();
          if (result?.zones && mountedRef.current) {
            setZones(result.zones as GenerativeZone[]);
          }
        } catch {
          // Ignore errors
        } finally {
          if (mountedRef.current) setIsLoading(false);
        }
      }

      loadZones();

      // Subscribe to live updates
      const unsubUpdate = window.electronAPI?.world?.onZoneUpdated((zone: unknown) => {
        if (!mountedRef.current) return;
        const z = zone as GenerativeZone;
        setZones(prev => {
          const idx = prev.findIndex(p => p.id === z.id);
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = z;
            return updated;
          }
          return [...prev, z];
        });
      });

      const unsubDelete = window.electronAPI?.world?.onZoneDeleted((event: { id: string }) => {
        if (!mountedRef.current) return;
        setZones(prev => prev.filter(z => z.id !== event.id));
      });

      return () => {
        mountedRef.current = false;
        unsubUpdate?.();
        unsubDelete?.();
      };
    } else {
      // Web mode: load from localStorage
      setZones(loadLocalZones());
      setIsLoading(false);

      return () => {
        mountedRef.current = false;
      };
    }
  }, [isElectron]);

  // Add a zone (web mode: persist to localStorage)
  const addZone = useCallback((zone: GenerativeZone) => {
    setZones(prev => {
      const idx = prev.findIndex(z => z.id === zone.id);
      let updated: GenerativeZone[];
      if (idx >= 0) {
        updated = [...prev];
        updated[idx] = zone;
      } else {
        updated = [...prev, zone];
      }
      if (!isElectron) saveLocalZones(updated);
      return updated;
    });
  }, [isElectron]);

  // Delete a zone (web mode)
  const deleteZone = useCallback((zoneId: string) => {
    if (isElectron) {
      window.electronAPI?.world?.deleteZone(zoneId);
    } else {
      setZones(prev => {
        const updated = prev.filter(z => z.id !== zoneId);
        saveLocalZones(updated);
        return updated;
      });
    }
  }, [isElectron]);

  return { zones, isLoading, addZone, deleteZone };
}
