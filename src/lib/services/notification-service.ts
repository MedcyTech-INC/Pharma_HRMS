import { supabase } from '../supabase-client';
import { Employee } from '../../types';

export interface AppNotification {
  id?: string;
  recipient_id: string;
  sender_id?: string;
  title: string;
  message: string;
  type?: 'leave' | 'visit' | 'assignment' | 'system' | 'report';
  read?: boolean;
  created_at?: string;
}

const LOCAL_NOTIF_KEY = 'pharma_hrms_local_notifications';

function saveLocalNotification(notification: AppNotification) {
  try {
    const existing = localStorage.getItem(LOCAL_NOTIF_KEY);
    const list: AppNotification[] = existing ? JSON.parse(existing) : [];
    const newRecord: AppNotification = {
      id: notification.id || 'notif_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      recipient_id: notification.recipient_id,
      sender_id: notification.sender_id || '',
      title: notification.title,
      message: notification.message,
      type: notification.type || 'system',
      read: false,
      created_at: notification.created_at || new Date().toISOString()
    };
    list.unshift(newRecord);
    localStorage.setItem(LOCAL_NOTIF_KEY, JSON.stringify(list.slice(0, 100)));
    
    // Broadcast window event for instant UI update
    window.dispatchEvent(new CustomEvent('new_notification', { detail: newRecord }));
  } catch (err) {
    console.warn('Failed to save local notification:', err);
  }
}

/**
 * Send a notification to a specific recipient (BE, RSM, ZSM, Admin, etc.)
 */
export async function sendNotification(notification: AppNotification): Promise<void> {
  const notifPayload = {
    recipient_id: notification.recipient_id,
    sender_id: notification.sender_id || null,
    title: notification.title,
    message: notification.message,
    type: notification.type || 'system',
    is_read: false,
    created_at: new Date().toISOString()
  };

  // Always save locally first for instant guaranteed UI response
  saveLocalNotification({
    ...notification,
    created_at: notifPayload.created_at
  });

  try {
    const { error } = await supabase
      .from('pharma_hrms_notifications')
      .insert([notifPayload]);

    if (error) {
      console.warn('Supabase notification insert warning:', error.message);
    }
  } catch (err) {
    console.warn('Failed to send notification to Supabase:', err);
  }
}

/**
 * Broadcast notification to all managers/RSMs of a given employee
 */
export async function notifyReportingManagers(empId: string, title: string, message: string, type: AppNotification['type'] = 'system'): Promise<void> {
  try {
    const recipientIds = new Set<string>();

    // 1. Fetch employee details to get reporting_to (RSM / Manager)
    const { data: emp } = await supabase
      .from('pharma_hrms_employees')
      .select('id, employee_code, reporting_to, branch, zone')
      .or(`id.eq.${empId},employee_code.eq.${empId}`)
      .maybeSingle();

    if (emp?.reporting_to) recipientIds.add(emp.reporting_to);

    // 2. Fetch ZSM / Admin / Executive recipients
    const { data: admins } = await supabase
      .from('pharma_hrms_employees')
      .select('id, employee_code')
      .in('hierarchy_level', ['admin', 'executive', 'zsm', 'rsm']);

    if (admins && admins.length > 0) {
      admins.forEach(a => {
        if (a.id) recipientIds.add(a.id);
        if (a.employee_code) recipientIds.add(a.employee_code);
      });
    }

    // Always include broadcast keys
    recipientIds.add('all_leadership');
    recipientIds.add('admin');
    recipientIds.add('OL002');
    recipientIds.add('OL023');
    recipientIds.add('OL015');

    // Filter out sender
    if (empId) recipientIds.delete(empId);
    if (emp?.id) recipientIds.delete(emp.id);
    if (emp?.employee_code) recipientIds.delete(emp.employee_code);

    const nowStr = new Date().toISOString();
    const dbRecords = Array.from(recipientIds).map(recipientId => ({
      recipient_id: recipientId,
      sender_id: empId,
      title,
      message,
      type,
      is_read: false,
      created_at: nowStr
    }));

    // Save locally for all recipients
    Array.from(recipientIds).forEach(recipientId => {
      saveLocalNotification({
        recipient_id: recipientId,
        sender_id: empId,
        title,
        message,
        type,
        read: false,
        created_at: nowStr
      });
    });

    if (dbRecords.length > 0) {
      const { error } = await supabase.from('pharma_hrms_notifications').insert(dbRecords);
      if (error) console.warn('Supabase bulk notification warning:', error.message);
    }
  } catch (err) {
    console.warn('Failed to notify reporting managers:', err);
  }
}

/**
 * Fetch notifications for a user (Combines Supabase DB + Local Cache with case-insensitive matching)
 */
export async function getUserNotifications(user: string | Employee | null | undefined): Promise<AppNotification[]> {
  if (!user) return [];

  const userId = typeof user === 'string' ? user : user.id;
  const userCode = typeof user === 'string' ? user : (user.employeeCode || user.id);
  const userEmail = typeof user === 'string' ? '' : (user.email || '');
  const userRole = typeof user === 'string' ? '' : (user.role || '');
  const userLevel = typeof user === 'string' ? '' : (user.hierarchyLevel || '');

  const targetIds = new Set<string>([
    (userId || '').toLowerCase(),
    (userCode || '').toLowerCase(),
    (userEmail || '').toLowerCase(),
    'all'
  ]);

  if (['admin', 'executive', 'zsm', 'rsm', 'manager'].includes(userRole.toLowerCase()) || ['admin', 'executive', 'zsm', 'rsm', 'manager'].includes(userLevel.toLowerCase())) {
    targetIds.add('all_leadership');
    targetIds.add('admin');
  }

  let dbNotifs: AppNotification[] = [];

  try {
    const { data, error } = await supabase
      .from('pharma_hrms_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (!error && data) {
      dbNotifs = data
        .filter(row => row.recipient_id && targetIds.has(row.recipient_id.toLowerCase()))
        .map(row => ({
          id: row.id,
          recipient_id: row.recipient_id,
          sender_id: row.sender_id,
          title: row.title,
          message: row.message,
          type: row.type,
          read: row.is_read || false,
          created_at: row.created_at
        }));
    }
  } catch (err) {
    console.warn('Error fetching Supabase notifications:', err);
  }

  // Combine with local cache
  let localNotifs: AppNotification[] = [];
  try {
    const cached = localStorage.getItem(LOCAL_NOTIF_KEY);
    if (cached) {
      const allLocal: AppNotification[] = JSON.parse(cached);
      localNotifs = allLocal.filter(n => n.recipient_id && targetIds.has(n.recipient_id.toLowerCase()));
    }
  } catch (err) {
    console.warn('Error fetching local notifications:', err);
  }

  // Merge and deduplicate by id/timestamp
  const map = new Map<string, AppNotification>();
  dbNotifs.forEach(n => map.set(n.id || (n.created_at + '_' + n.title), n));
  localNotifs.forEach(n => {
    const key = n.id || (n.created_at + '_' + n.title);
    if (!map.has(key)) map.set(key, n);
  });

  return Array.from(map.values()).sort((a, b) => {
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
  });
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(id: string): Promise<void> {
  try {
    // Update local cache
    const cached = localStorage.getItem(LOCAL_NOTIF_KEY);
    if (cached) {
      const list: AppNotification[] = JSON.parse(cached);
      const updated = list.map(n => n.id === id ? { ...n, read: true } : n);
      localStorage.setItem(LOCAL_NOTIF_KEY, JSON.stringify(updated));
    }

    // Update Supabase
    await supabase
      .from('pharma_hrms_notifications')
      .update({ is_read: true })
      .eq('id', id);
  } catch (err) {
    console.warn('Failed to mark notification read:', err);
  }
}
