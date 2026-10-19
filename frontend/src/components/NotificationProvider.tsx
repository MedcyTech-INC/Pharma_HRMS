import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase-client';
import { Employee } from '../types';
import { Bell, X } from 'lucide-react';

// Play a simple "ding" using Web Audio API
const playDing = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(0.5, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch (e) {
    console.log('Audio disabled or failed');
  }
};

interface NotificationProviderProps {
  currentUser: Employee | null;
}

export default function NotificationProvider({ currentUser }: NotificationProviderProps) {
  const [toasts, setToasts] = useState<any[]>([]);

  useEffect(() => {
    if (!currentUser) return;

    const myId = (currentUser.id || '').toLowerCase();
    const myCode = (currentUser.employeeCode || '').toLowerCase();
    const myEmail = (currentUser.email || '').toLowerCase();
    const isLeadership = ['admin', 'executive', 'zsm', 'rsm', 'manager'].includes((currentUser.role || '').toLowerCase()) ||
                        ['admin', 'executive', 'zsm', 'rsm', 'manager'].includes((currentUser.hierarchyLevel || '').toLowerCase());

    const isRecipient = (recipId?: string) => {
      if (!recipId) return false;
      const target = recipId.toLowerCase();
      if (target === myId || target === myCode || target === myEmail || target === 'all') return true;
      if (isLeadership && (target === 'all_leadership' || target === 'admin')) return true;
      return false;
    };

    const handleNewNotif = (e: any) => {
      const notification = e.detail;
      if (notification && isRecipient(notification.recipient_id)) {
        playDing();
        const id = Date.now() + Math.random();
        setToasts(prev => [...prev, { id, ...notification }]);
        setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== id));
        }, 5000);
      }
    };

    window.addEventListener('new_notification', handleNewNotif);

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'pharma_hrms_local_notifications' && e.newValue) {
        try {
          const list = JSON.parse(e.newValue);
          const latest = list[0];
          if (latest && isRecipient(latest.recipient_id)) {
            playDing();
            const id = Date.now() + Math.random();
            setToasts(prev => [...prev, { id, ...latest }]);
            setTimeout(() => {
              setToasts(prev => prev.filter(t => t.id !== id));
            }, 5000);
          }
        } catch (err) {}
      }
    };
    window.addEventListener('storage', handleStorage);

    // Subscribe to notifications for the current user
    const channel = supabase
      .channel('public:pharma_hrms_notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'pharma_hrms_notifications'
      }, (payload) => {
        const notification = payload.new;
        if (notification && isRecipient(notification.recipient_id)) {
          playDing();
          const id = Date.now() + Math.random();
          setToasts(prev => [...prev, { id, ...notification }]);
          setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
          }, 5000);
        }
      })
      .subscribe();

    return () => {
      window.removeEventListener('new_notification', handleNewNotif);
      window.removeEventListener('storage', handleStorage);
      supabase.removeChannel(channel);
    };
  }, [currentUser]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map(toast => (
        <div key={toast.id} className="bg-white border-l-4 border-blue-500 rounded-lg shadow-xl p-4 w-80 animate-slideDown flex items-start gap-3 pointer-events-auto">
          <div className="text-blue-500 bg-blue-50 p-2 rounded-full shrink-0">
            <Bell size={18} />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-bold text-slate-800">{toast.title}</h4>
            <p className="text-xs text-slate-600 mt-1">{toast.message}</p>
          </div>
          <button 
            onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
            className="text-slate-400 hover:text-slate-600 shrink-0 p-1"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
