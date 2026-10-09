import React, { useState, useEffect } from 'react';
import { Menu, Bell, Search, X, CheckCircle } from 'lucide-react';
import { Employee } from '../../types';
import { OrcaLogo } from '../OrcaLogo';
import { getUserNotifications, markNotificationAsRead, AppNotification } from '../../lib/services/notification-service';

interface AppHeaderProps {
  currentUser: Employee;
  onOpenProfile: () => void;
  onLogout: () => void;
  onLogoClick?: () => void;
  onOpenMenu?: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  currentUser,
  onOpenProfile,
  onLogoClick,
  onOpenMenu
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = async () => {
    if (!currentUser) return;
    const list = await getUserNotifications(currentUser);
    setNotifications(list);
    setUnreadCount(list.filter(n => !n.read).length);
  };

  useEffect(() => {
    loadNotifications();
    window.addEventListener('new_notification', loadNotifications);
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'pharma_hrms_local_notifications') {
        loadNotifications();
      }
    };
    window.addEventListener('storage', handleStorage);
    const interval = setInterval(loadNotifications, 3000);
    return () => {
      window.removeEventListener('new_notification', loadNotifications);
      window.removeEventListener('storage', handleStorage);
      clearInterval(interval);
    };
  }, [currentUser]);

  const getAvatarInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').slice(0, 2);
  };

  const level = currentUser.hierarchyLevel || 'be';
  let roleText = 'Business Executive';
  if (level === 'admin' || currentUser.role === 'admin') roleText = 'Corporate Admin';
  if (level === 'executive') roleText = 'General Manager';
  if (level === 'zsm') roleText = `ZSM (${currentUser.zone || 'Zone'})`;
  if (level === 'rsm') roleText = `RSM (${currentUser.zone || 'Region'})`;
  if (level === 'be') roleText = 'Field Executive (BE)';

  return (
    <header id="global-portal-header" className="sticky top-0 z-40 no-print pt-6 pb-2">
      <div className="w-full max-w-[1600px] mx-auto px-6 flex items-center justify-between">

        {/* Brand / Logo Area */}
        <div className="flex items-center gap-4">
          {/* Mobile Hamburger */}
          <button
            onClick={onOpenMenu}
            className="lg:hidden p-2 text-slate-700 hover:text-teal-600 hover:bg-teal-50 rounded-xl transition-all cursor-pointer border border-transparent flex items-center justify-center shrink-0"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Orca Logo */}
          <div
            className="flex items-center cursor-pointer select-none"
            onClick={onLogoClick}
          >
            <OrcaLogo size="md" variant="light" layout="horizontal" />
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-4 relative">
          
          {/* Notification Bell Button */}
          <div className="relative">
            <button
              onClick={() => {
                setShowNotifications(!showNotifications);
                loadNotifications();
              }}
              className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors relative cursor-pointer"
              title="Notifications"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <div className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white animate-pulse" />
              )}
            </button>

            {/* Notification Drawer Modal */}
            {showNotifications && (
              <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 p-4 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-slate-800">Notifications</h3>
                    {unreadCount > 0 && (
                      <span className="bg-teal-100 text-teal-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  <button 
                    onClick={() => setShowNotifications(false)}
                    className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-50"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="max-h-80 overflow-y-auto custom-scrollbar space-y-2 pr-1">
                  {notifications.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-xs">
                      No notifications yet
                    </div>
                  ) : (
                    notifications.map(n => (
                      <div
                        key={n.id}
                        onClick={async () => {
                          if (n.id && !n.read) {
                            await markNotificationAsRead(n.id);
                            loadNotifications();
                          }
                        }}
                        className={`p-3 rounded-xl border transition-all cursor-pointer ${
                          !n.read 
                            ? 'bg-teal-50/50 border-teal-100 hover:bg-teal-50' 
                            : 'bg-slate-50/60 border-slate-100 hover:bg-slate-100/60 opacity-80'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-teal-500 shrink-0" />}
                            <span>{n.title}</span>
                          </h4>
                          {n.created_at && (
                            <span className="text-[10px] text-slate-400 shrink-0">
                              {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-600 mt-1 leading-snug">{n.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <button className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer hidden sm:flex">
            <Search size={18} />
          </button>

          {/* User Profile Pill */}
          <button
            onClick={onOpenProfile}
            className="flex items-center gap-3 bg-slate-100 hover:bg-slate-200 py-1.5 pl-1.5 pr-4 rounded-full transition-colors cursor-pointer ml-2"
          >
            <div className="bg-slate-700 text-white w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
              {getAvatarInitials(currentUser.name)}
            </div>
            <div className="text-left hidden sm:block">
              <span className="text-[13px] font-bold text-slate-800 block leading-tight">{currentUser.name}</span>
              <span className="text-[10px] text-slate-500 font-medium block leading-none mt-0.5">{roleText}</span>
            </div>
          </button>

        </div>
      </div>
    </header>
  );
};

export default AppHeader;
