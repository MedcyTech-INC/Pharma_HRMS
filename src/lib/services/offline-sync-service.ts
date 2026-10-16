import { FieldVisitStatus } from '../../types';
import * as fieldVisitService from './field-visit-service';

const DB_NAME = 'pharma_hrms_offline_db';
const STORE_NAME = 'pending_uploads';
const DB_VERSION = 1;
const PENDING_UPLOADS_KEY = 'pharma_pending_uploads';

export interface PendingUpload {
  id: string;
  type: 'START' | 'COMPLETE';
  visitId: string;
  employeeId: string;
  photoData: string;
  lat?: number;
  lng?: number;
  address?: string;
  notes?: string;
  timestamp: number;
}

// In-memory cache for immediate synchronous access
let memoryPendingCache: PendingUpload[] = [];

function openOfflineDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported'));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save pending upload to IndexedDB with fallback to localStorage.
 */
export async function savePendingUpload(upload: Omit<PendingUpload, 'id' | 'timestamp'>): Promise<string> {
  const item: PendingUpload = {
    ...upload,
    id: crypto.randomUUID(),
    timestamp: Date.now()
  };
  memoryPendingCache.push(item);

  try {
    const db = await openOfflineDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    return item.id;
  } catch (idbErr) {
    console.warn('IndexedDB unavailable, falling back to localStorage:', idbErr);
    try {
      const existing = getPendingUploadsSync();
      existing.push(item);
      localStorage.setItem(PENDING_UPLOADS_KEY, JSON.stringify(existing));
    } catch (lsErr) {
      console.error('LocalStorage quota exceeded for offline photo:', lsErr);
    }
    return item.id;
  }
}

/**
 * Synchronous fetch from memory or localStorage.
 */
function getPendingUploadsSync(): PendingUpload[] {
  try {
    const data = localStorage.getItem(PENDING_UPLOADS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

/**
 * Retrieve all pending uploads from IndexedDB, migrating legacy localStorage items.
 */
export async function getPendingUploads(): Promise<PendingUpload[]> {
  try {
    const db = await openOfflineDB();
    const idbItems: PendingUpload[] = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    // Migrate any legacy items from localStorage
    const legacy = getPendingUploadsSync();
    if (legacy.length > 0) {
      for (const leg of legacy) {
        if (!idbItems.find(i => i.id === leg.id)) {
          idbItems.push(leg);
        }
      }
      localStorage.removeItem(PENDING_UPLOADS_KEY);
    }

    memoryPendingCache = idbItems;
    return idbItems;
  } catch {
    return memoryPendingCache.length > 0 ? memoryPendingCache : getPendingUploadsSync();
  }
}

async function removePendingUpload(id: string) {
  memoryPendingCache = memoryPendingCache.filter(i => i.id !== id);
  try {
    const db = await openOfflineDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
  } catch (err) {
    console.warn('Could not remove item from IndexedDB:', err);
  }

  try {
    const legacy = getPendingUploadsSync().filter(i => i.id !== id);
    localStorage.setItem(PENDING_UPLOADS_KEY, JSON.stringify(legacy));
  } catch {}
}

/**
 * Process all queued offline field visits when online.
 */
export async function processPendingUploads() {
  if (!navigator.onLine) return;
  
  const pending = await getPendingUploads();
  if (pending.length === 0) return;

  for (const upload of pending) {
    try {
      if (upload.type === 'START') {
        await fieldVisitService.startCallWithPhoto(
          upload.visitId,
          upload.employeeId,
          upload.photoData,
          upload.lat,
          upload.lng,
          upload.address,
          upload.notes
        );
      } else if (upload.type === 'COMPLETE') {
        await fieldVisitService.completeCallWithPhoto(
          upload.visitId,
          upload.employeeId,
          upload.photoData,
          upload.lat,
          upload.lng,
          upload.notes
        );
      }
      // Successfully synced: remove from durable store
      await removePendingUpload(upload.id);
    } catch (err: any) {
      console.warn('Failed to sync offline upload', upload.id, err);
      // Keep in store to retry on next cycle
    }
  }
}

// Auto-sync listeners
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    processPendingUploads();
  });
  // Periodic retry every 3 minutes
  setInterval(processPendingUploads, 3 * 60 * 1000);
}

