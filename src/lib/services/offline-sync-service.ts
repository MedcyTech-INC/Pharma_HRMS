import { FieldVisitStatus } from '../../types';
import * as fieldVisitService from './field-visit-service';

const PENDING_UPLOADS_KEY = 'pharma_pending_uploads';

interface PendingUpload {
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

export function savePendingUpload(upload: Omit<PendingUpload, 'id' | 'timestamp'>) {
  const existing = getPendingUploads();
  existing.push({
    ...upload,
    id: crypto.randomUUID(),
    timestamp: Date.now()
  });
  localStorage.setItem(PENDING_UPLOADS_KEY, JSON.stringify(existing));
}

export function getPendingUploads(): PendingUpload[] {
  try {
    const data = localStorage.getItem(PENDING_UPLOADS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function processPendingUploads() {
  if (!navigator.onLine) return;
  
  const pending = getPendingUploads();
  if (pending.length === 0) return;

  const remaining: PendingUpload[] = [];

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
    } catch (err: any) {
      console.warn('Failed to sync offline upload', upload.id, err);
      // If it's a hard network error, keep it. If it's a 4xx error, maybe drop it.
      // For safety, we keep it if it fails so they don't lose data.
      remaining.push(upload);
    }
  }

  localStorage.setItem(PENDING_UPLOADS_KEY, JSON.stringify(remaining));
}

// Auto-sync when coming online
if (typeof window !== 'undefined') {
  window.addEventListener('online', processPendingUploads);
  // Also try periodically every 5 minutes
  setInterval(processPendingUploads, 5 * 60 * 1000);
}
