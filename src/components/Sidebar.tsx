import React from 'react';
import { 
  LayoutDashboard, 
  Clock, 
  FileText, 
  Calendar, 
  Settings, 
  LogOut, 
  User,
  BarChart3,
  ShieldAlert,
  Eye,
  Activity,
  ChevronRight,
  Plane,
  Bot,
  Lightbulb,
  Skull,
  Users
} from 'lucide-react';
import { cn } from '../lib/utils';
import { APP_CONFIG } from '../constants';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  user: any;
  profile: any;
  onLogout: () => void;
}

const menuItems = [
  { id: 'dashboard', label: 'My Dashboard', icon: LayoutDashboard },
  { id: 'attendance', label: 'Attendance Log', icon: Clock },
  { id: 'leaves', label: 'Leave & WFH', icon: Plane },
  { id: 'reports', label: 'Daily Reports', icon: FileText },
  { id: 'brainstorm', label: `${APP_CONFIG.BRAND_NAME.split(' ')[0]} Brainstorm`, icon: Lightbulb },
  { id: 'analytics', label: 'Team Analytics', icon: BarChart3 },
  { id: 'bot', label: 'AI Analytics Bot', icon: Bot },
  { id: 'team-management', label: 'Team Management', icon: Users },
  { id: 'chopping-block', label: 'The Chopping Block', icon: Skull },
];

export function Sidebar({ activeTab, setActiveTab, user, profile, onLogout }: SidebarProps) {
  const filteredMenuItems = menuItems.filter(item => {
    if (item.id === 'analytics') {
      return profile?.role === 'admin' || profile?.role === 'founder';
    }
    if (item.id === 'team-management') {
      return profile?.role === 'admin';
    }
    if (item.id === 'chopping-block') {
      return profile?.role === 'admin' || profile?.role === 'founder';
    }
    if (item.id === 'bot') {
      return profile?.role === 'admin' || profile?.role === 'founder';
    }
    if (item.id === 'dashboard') {
      // Admin doesn't need personal dashboard for check-in
      return profile?.role !== 'admin';
    }
    return true;
  });

  const [brandFirst, brandSecond] = APP_CONFIG.BRAND_NAME.split(' ');

  return (
    <div className="flex h-screen w-64 flex-col bg-[#0a0a0a] text-white">
      <div className="flex items-center gap-2 p-6">
        <div className="h-8 w-8 rounded bg-primary flex items-center justify-center font-bold text-black">{brandFirst?.[0] || 'K'}</div>
        <h1 className="text-xl font-bold tracking-tight">{brandFirst} <span className="text-primary">{brandSecond || ''}</span></h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        <p className="mb-4 px-2 text-[10px] font-semibold uppercase tracking-widest text-gray-500">Menu</p>
        <nav className="space-y-1">
          {filteredMenuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors",
                activeTab === item.id 
                  ? "bg-[#1a1a1a] text-white border-r-2 border-primary" 
                  : "text-gray-400 hover:bg-[#1a1a1a] hover:text-white"
              )}
            >
              <div className="flex items-center gap-3">
                <item.icon size={18} />
                <span>{item.label}</span>
              </div>
              {activeTab === item.id && <div className="h-1.5 w-1.5 rounded-full bg-primary" />}
            </button>
          ))}
        </nav>
      </div>

      <div className="border-t border-gray-800 p-4">
        <div className="mb-4 flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-800 text-xs font-bold">
            {user?.displayName?.split(' ').map((n: string) => n[0]).join('') || 'U'}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="truncate text-sm font-medium">{user?.displayName || 'User'}</p>
            <p className="truncate text-[10px] text-gray-500">{user?.email || 'user@example.com'}</p>
          </div>
          <button onClick={onLogout} className="text-gray-500 hover:text-white">
            <LogOut size={16} />
          </button>
        </div>
        <button 
          onClick={() => setActiveTab('settings')}
          className={cn(
            "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
            activeTab === 'settings' 
              ? "bg-[#1a1a1a] text-white border-r-2 border-primary" 
              : "text-gray-400 hover:bg-[#1a1a1a] hover:text-white"
          )}
        >
          <Settings size={18} />
          <span>Settings</span>
        </button>
      </div>
    </div>
  );
}
