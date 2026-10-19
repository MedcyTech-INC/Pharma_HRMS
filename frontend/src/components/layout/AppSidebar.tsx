import React from 'react';
import { 
  Home, 
  Users, 
  Calendar, 
  Moon, 
  MapPin, 
  MessageSquare, 
  CheckSquare, 
  Settings, 
  Activity, 
  Power,
  Camera,
  Menu,
  GitBranch,
  Clock,
  UserCheck
} from 'lucide-react';
import { Employee, isExemptAdmin } from '../../types';

interface AppSidebarProps {
  currentUser: Employee;
  activeTab: string;
  onSelectTab: (tab: string) => void;
  onOpenProfile: () => void;
  onLogout: () => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  currentUser,
  activeTab,
  onSelectTab,
  onLogout,
}) => {
  const level = currentUser.hierarchyLevel || 'be';
  const isCorporateAdmin = isExemptAdmin(currentUser);
  const isExecutive = level === 'executive' || isCorporateAdmin;
  const isZSM = level === 'zsm';
  const isRSM = level === 'rsm' || level === 'team_lead' || level === 'manager';
  const isManagerOrZSM = isZSM || isRSM;
  const isAdmin = isExecutive || isManagerOrZSM;

  const [hasCompletedTour, setHasCompletedTour] = React.useState<boolean>(() => {
    return localStorage.getItem(`has_completed_tour_${currentUser.id}`) === 'true';
  });

  React.useEffect(() => {
    const checkStatus = () => {
      setHasCompletedTour(localStorage.getItem(`has_completed_tour_${currentUser.id}`) === 'true');
    };
    window.addEventListener('tour_completed', checkStatus);
    window.addEventListener('storage', checkStatus);
    return () => {
      window.removeEventListener('tour_completed', checkStatus);
      window.removeEventListener('storage', checkStatus);
    };
  }, [currentUser.id]);

  // Common button class generator matching VizagIVF_HRMS exactly
  const getBtnClass = (tabId: string) => {
    const isActive = activeTab === tabId;
    if (isActive) {
      return "w-full flex items-center px-6 py-2.5 bg-teal-50 text-teal-600 font-semibold transition-colors cursor-pointer group/btn relative before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-teal-600";
    }
    return "w-full flex items-center px-6 py-2.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors font-medium cursor-pointer group/btn relative";
  };

  const getIconClass = (tabId: string) => {
    const isActive = activeTab === tabId;
    return `shrink-0 w-6 flex justify-center ${isActive ? 'text-teal-600' : 'text-slate-400 group-hover/btn:text-slate-600'}`;
  };

  return (
    <aside id="desktop-sidebar" className="hidden lg:flex flex-col bg-white border-r border-slate-100 h-full no-print w-[80px] hover:w-64 transition-all duration-300 overflow-hidden group z-50 shrink-0">
      
      {/* Top Toggle Area */}
      <div className="h-16 flex items-center px-6 shrink-0 border-b border-slate-50">
        <div className="w-6 flex justify-center">
          <Menu className="w-6 h-6 text-slate-800 shrink-0 cursor-pointer" />
        </div>
        <span className="ml-4 font-bold text-lg text-slate-800 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          Menu
        </span>
      </div>

      {/* Nav Items Container with scrolling enabled */}
      <div className="flex-1 py-3 flex flex-col gap-4 overflow-y-auto custom-scrollbar overflow-x-hidden">
        
        {/* ================= PART 1: DESIGNATED USER MODULES ================= */}
        <div className="flex flex-col gap-0.5">
          <div className="px-6 py-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              My Workspace
            </span>
          </div>

          {/* Punch In / Duty for non-exempt leadership (ZSM & RSM) */}
          {isManagerOrZSM && (
            <button onClick={() => onSelectTab('dashboard')} className={getBtnClass('dashboard')}>
              <div className={getIconClass('dashboard')}>
                <Clock size={22} />
              </div>
              <span className="ml-4 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-[13px]">
                {currentUser.isCheckedIn ? 'My Duty (Active)' : 'Punch In / Duty'}
              </span>
            </button>
          )}

          {/* Core Dashboard */}
          <button onClick={() => onSelectTab(isAdmin ? 'adminDashboard' : 'dashboard')} className={getBtnClass(isAdmin ? 'adminDashboard' : 'dashboard')}>
            <div className={getIconClass(isAdmin ? 'adminDashboard' : 'dashboard')}>
              <Home size={22} />
            </div>
            <span className="ml-4 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-[13px]">
              Dashboard
            </span>
          </button>

          {/* Doctor Plans with Persistent Tour Indicator */}
          <button onClick={() => onSelectTab('doctorPlanner')} className={getBtnClass('doctorPlanner')}>
            <div className={`relative ${getIconClass('doctorPlanner')}`}>
              <Calendar size={22} />
              {!hasCompletedTour && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-slate-900 ring-2 ring-white animate-ping" title="Interactive Tour Available" />
              )}
            </div>
            <span className="ml-4 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-[13px] flex items-center justify-between w-full pr-2">
              <span>Doctor Plans</span>
              {!hasCompletedTour && (
                <span className="w-2 h-2 rounded-full bg-slate-900 animate-pulse shrink-0 ml-1" />
              )}
            </span>
          </button>

          {/* Visit Log */}
          <button onClick={() => onSelectTab('callCapture')} className={getBtnClass('callCapture')}>
            <div className={getIconClass('callCapture')}>
              <Camera size={22} />
            </div>
            <span className="ml-4 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-[13px]">
              Visit Log
            </span>
          </button>

          {/* Attendance */}
          <button onClick={() => onSelectTab(isAdmin ? 'attendanceOverview' : 'attendance')} className={getBtnClass(isAdmin ? 'attendanceOverview' : 'attendance')}>
            <div className={getIconClass(isAdmin ? 'attendanceOverview' : 'attendance')}>
              <Calendar size={22} />
            </div>
            <span className="ml-4 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-[13px]">
              Attendance
            </span>
          </button>

          {/* Leaves */}
          <button onClick={() => onSelectTab(isAdmin ? 'leaveApprovals' : 'leave')} className={getBtnClass(isAdmin ? 'leaveApprovals' : 'leave')}>
            <div className={getIconClass(isAdmin ? 'leaveApprovals' : 'leave')}>
              <Moon size={22} />
            </div>
            <span className="ml-4 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-[13px]">
              Leaves
            </span>
          </button>

          {/* Navigation / Field Duty */}
          <button onClick={() => onSelectTab('fieldDuty')} className={getBtnClass('fieldDuty')}>
            <div className={getIconClass('fieldDuty')}>
              <MapPin size={22} />
            </div>
            <span className="ml-4 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-[13px]">
              Navigation
            </span>
          </button>
        </div>

        {/* Divider */}
        <div className="my-1 border-t border-slate-100 mx-4" />

        {/* ================= PART 2: TEAM RELATED MODULES ================= */}
        <div className="flex flex-col gap-0.5">
          <div className="px-6 py-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Team Management
            </span>
          </div>

          {/* Team Hierarchy */}
          <button onClick={() => onSelectTab('orgChart')} className={getBtnClass('orgChart')}>
            <div className={getIconClass('orgChart')}>
              <GitBranch size={22} />
            </div>
            <span className="ml-4 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-[13px]">
              Team Hierarchy
            </span>
          </button>

          {/* Team Hub */}
          <button onClick={() => onSelectTab('teamHub')} className={getBtnClass('teamHub')}>
            <div className={getIconClass('teamHub')}>
              <UserCheck size={22} />
            </div>
            <span className="ml-4 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-[13px]">
              Team Hub
            </span>
          </button>

          {/* Assignments */}
          <button onClick={() => onSelectTab(isAdmin ? 'adminTasks' : 'tasks')} className={getBtnClass(isAdmin ? 'adminTasks' : 'tasks')}>
            <div className={getIconClass(isAdmin ? 'adminTasks' : 'tasks')}>
              <CheckSquare size={22} />
            </div>
            <span className="ml-4 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-[13px]">
              Assignments
            </span>
          </button>

          {/* Messages */}
          <button onClick={() => onSelectTab('messages')} className={getBtnClass('messages')}>
            <div className={getIconClass('messages')}>
              <MessageSquare size={22} />
            </div>
            <span className="ml-4 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-[13px]">
              Messages
            </span>
          </button>

          {/* Directory */}
          <button onClick={() => onSelectTab('directory')} className={getBtnClass('directory')}>
            <div className={getIconClass('directory')}>
              <Users size={22} />
            </div>
            <span className="ml-4 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-[13px]">
              Directory
            </span>
          </button>

          {/* Executive Overview (Role specific) */}
          {isExecutive && (
            <button onClick={() => onSelectTab('executiveOverview')} className={getBtnClass('executiveOverview')}>
              <div className={getIconClass('executiveOverview')}>
                <Activity size={22} />
              </div>
              <span className="ml-4 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-[13px]">
                Executive Overview
              </span>
            </button>
          )}

          {/* Field Register (Role specific) */}
          {isExecutive && (
            <button onClick={() => onSelectTab('fieldOps')} className={getBtnClass('fieldOps')}>
              <div className={getIconClass('fieldOps')}>
                <MapPin size={22} />
              </div>
              <span className="ml-4 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-[13px]">
                Field Register
              </span>
            </button>
          )}

          {/* Settings (Role specific) */}
          {isExecutive && (
            <button onClick={() => onSelectTab('adminSettings')} className={getBtnClass('adminSettings')}>
              <div className={getIconClass('adminSettings')}>
                <Settings size={22} />
              </div>
              <span className="ml-4 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-[13px]">
                Settings
              </span>
            </button>
          )}
        </div>

      </div>

      {/* Footer / Power */}
      <div className="pb-4">
        <button onClick={onLogout} className="w-full flex items-center px-6 py-2.5 text-slate-400 hover:text-rose-500 transition-colors cursor-pointer group/btn">
          <div className="w-6 flex justify-center shrink-0">
            <Power size={22} />
          </div>
          <span className="ml-4 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 font-medium">Log out</span>
        </button>
      </div>

    </aside>
  );
};

export default AppSidebar;
