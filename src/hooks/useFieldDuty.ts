import { useState, useCallback, useEffect } from 'react';
import { FieldSession } from '../types';
import * as fieldSessionService from '../lib/services/field-session-service';
import { getCurrentLocationSafe } from '../lib/utils/location-utils';

export function useFieldDuty(employeeId: string | undefined, isLocalMode: boolean) {
  const [session, setSession] = useState<FieldSession | null>(null);
  const [loading, setLoading] = useState(false);

  const loadSession = useCallback(async () => {
    if (isLocalMode || !employeeId) return;
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const s = await fieldSessionService.getActiveSession(employeeId, today);
      setSession(s);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [employeeId, isLocalMode]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  // 30-40 Minute Periodic GPS Sync while on active field duty (Zero Battery Drain)
  useEffect(() => {
    if (!session || session.status !== 'active' || isLocalMode || !employeeId) return;

    const syncLocation = async () => {
      try {
        const loc = await getCurrentLocationSafe();
        if (loc.latitude && loc.longitude) {
          localStorage.setItem(`last_gps_ping_${employeeId}`, JSON.stringify({
            lat: loc.latitude,
            lng: loc.longitude,
            time: new Date().toISOString()
          }));
        }
      } catch {
        // Silent catch for background heartbeat
      }
    };

    // Run periodic sync every 30 minutes
    const intervalId = setInterval(syncLocation, 30 * 60 * 1000);
    return () => clearInterval(intervalId);
  }, [session, isLocalMode, employeeId]);

  const startDuty = async (): Promise<{ success: boolean; error?: string }> => {
    if (isLocalMode || !employeeId) return { success: false, error: 'Cannot start in offline mode' };
    
    setLoading(true);
    try {
      const loc = await getCurrentLocationSafe();
      if (loc.error) {
         return { success: false, error: loc.error };
      }

      const newSession = await fieldSessionService.startSession(
        employeeId,
        loc.latitude,
        loc.longitude,
        loc.address
      );
      setSession(newSession);
      return { success: true };
    } catch (err: any) {
      console.error(err);
      return { success: false, error: err.message || 'Failed to start field duty.' };
    } finally {
      setLoading(false);
    }
  };

  const endDuty = async (): Promise<{ success: boolean; error?: string }> => {
    if (isLocalMode || !employeeId || !session) return { success: false, error: 'Invalid state' };
    
    setLoading(true);
    try {
      const loc = await getCurrentLocationSafe();
      // Allow ending duty even without GPS if needed, or enforce it. We'll capture if available.
      
      await fieldSessionService.endSession(
        session.id,
        employeeId,
        loc.latitude,
        loc.longitude,
        loc.address
      );
      
      await loadSession();
      return { success: true };
    } catch (err: any) {
      console.error(err);
      return { success: false, error: err.message || 'Failed to end field duty.' };
    } finally {
      setLoading(false);
    }
  };

  return { session, loading, startDuty, endDuty, loadSession };
}
