import React, { useState, useEffect } from 'react';
import { Clock, QrCode, Bell, Settings, Cloud, RefreshCw } from 'lucide-react';
import { AppSettings, ActiveTab } from '../types';

interface HeaderProps {
  settings: AppSettings;
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  pendingPermissionsCount: number;
  unprocessedLateCount: number;
  totalStudents: number;
  isSyncing?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  settings,
  activeTab,
  setActiveTab,
  pendingPermissionsCount,
  totalStudents,
  isSyncing,
}) => {
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedTime = currentTime.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const formattedDate = currentTime.toLocaleDateString('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  return (
    <header className="bg-slate-900/80 backdrop-blur-md text-white border-b border-slate-800/80 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5">
        <div className="flex items-center justify-between gap-3">
          {/* Left Branding */}
          <div
            className="flex items-center space-x-3 cursor-pointer group"
            onClick={() => setActiveTab('scanner')}
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-slate-950 font-bold shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform shrink-0">
              <QrCode className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-sm sm:text-base font-bold text-white tracking-tight leading-tight line-clamp-1">
                  {settings.schoolName}
                </h1>
                <span className="hidden sm:inline-block bg-slate-800 text-slate-300 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-slate-700">
                  Presensi SD
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate max-w-[180px] sm:max-w-xs">
                {settings.schoolAddress}
              </p>
            </div>
          </div>

          {/* Right Status: Cloud Pill + Live Clock + Notifications + Settings */}
          <div className="flex items-center space-x-2 sm:space-x-2.5">
            {/* Cloud Realtime Status Pill */}
            <div className="hidden md:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
              <span className="text-slate-400 text-[11px]">Cloud:</span>
              <span className="font-semibold text-emerald-400 text-[11px]">
                {isSyncing ? 'Sinkron...' : `${totalStudents} Siswa`}
              </span>
              {isSyncing && <RefreshCw className="w-3 h-3 text-amber-400 animate-spin ml-0.5" />}
            </div>

            {/* Live Clock Pill */}
            <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
              <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0 hidden sm:block" />
              <div className="text-right sm:text-left flex items-center gap-1.5">
                <span className="text-[10px] text-slate-400 hidden sm:inline">{formattedDate}</span>
                <span className="font-mono font-bold text-xs sm:text-sm text-emerald-300 tracking-wider">{formattedTime}</span>
              </div>
            </div>

            {/* Notification Badge for Pending Permissions */}
            {pendingPermissionsCount > 0 && (
              <button
                onClick={() => setActiveTab('permissions')}
                className="relative p-2 rounded-xl bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 transition-all cursor-pointer"
                title={`${pendingPermissionsCount} Izin Menunggu Konfirmasi`}
              >
                <Bell className="w-4 h-4" />
                <span className="absolute -top-1 -right-1 bg-amber-500 text-slate-950 font-bold text-[9px] w-4 h-4 rounded-full flex items-center justify-center">
                  {pendingPermissionsCount}
                </span>
              </button>
            )}

            {/* Quick Settings */}
            <button
              onClick={() => setActiveTab('settings')}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
              }`}
              title="Pengaturan Jadwal & Sekolah"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

