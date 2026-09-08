import React from 'react';
import {
  QrCode,
  LayoutDashboard,
  FileSpreadsheet,
  MessageSquareText,
  Users,
  Send,
  Radio,
  FileUp,
  ExternalLink,
  HelpCircle,
  AlertTriangle,
} from 'lucide-react';
import { ActiveTab } from '../types';

interface NavigationProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  pendingPermissionsCount: number;
  brokenCardsCount?: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  setActiveTab,
  pendingPermissionsCount,
  brokenCardsCount = 0,
}) => {
  const primaryTabs = [
    {
      id: 'scanner' as ActiveTab,
      label: 'Scan Kartu',
      icon: QrCode,
    },
    {
      id: 'dashboard' as ActiveTab,
      label: 'Ringkasan',
      icon: LayoutDashboard,
    },
    {
      id: 'recap' as ActiveTab,
      label: 'Rekap Presensi',
      icon: FileSpreadsheet,
    },
    {
      id: 'permissions' as ActiveTab,
      label: 'Izin Siswa',
      icon: MessageSquareText,
      badge: pendingPermissionsCount > 0 ? pendingPermissionsCount : null,
      badgeColor: 'amber',
    },
    {
      id: 'scan_failures' as ActiveTab,
      label: 'Barcode Rusak',
      icon: AlertTriangle,
      badge: brokenCardsCount > 0 ? brokenCardsCount : null,
      badgeColor: 'rose',
    },
    {
      id: 'students' as ActiveTab,
      label: 'Data Siswa',
      icon: Users,
    },
  ];

  const secondaryTabs = [
    {
      id: 'notifications' as ActiveTab,
      label: 'WhatsApp',
      icon: Send,
    },
    {
      id: 'batch_import' as ActiveTab,
      label: 'Import Excel',
      icon: FileUp,
    },
    {
      id: 'wa_gateway' as ActiveTab,
      label: 'Bot Gateway',
      icon: Radio,
    },
    {
      id: 'help' as ActiveTab,
      label: 'Panduan',
      icon: HelpCircle,
    },
  ];

  const standaloneUrl = '?view=standalone-scanner';

  return (
    <div className="bg-slate-900/60 backdrop-blur-md border-b border-slate-800/70 sticky top-[57px] z-20">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-2 gap-2 overflow-x-auto scrollbar-none">
          {/* Main Primary Tabs */}
          <nav className="flex items-center space-x-1 sm:space-x-1.5 shrink-0">
            {primaryTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center space-x-1.5 transition-all cursor-pointer shrink-0 ${
                    isActive
                      ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm shadow-emerald-500/20'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-slate-950' : 'text-slate-400'}`} />
                  <span>{tab.label}</span>

                  {tab.badge && (
                    <span
                      className={`ml-1 text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                        tab.badgeColor === 'rose'
                          ? isActive
                            ? 'bg-slate-950 text-rose-400'
                            : 'bg-rose-500 text-white animate-pulse'
                          : isActive
                            ? 'bg-slate-950 text-amber-400'
                            : 'bg-amber-500 text-slate-950'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Secondary Utilities */}
          <div className="flex items-center space-x-1 pl-2 border-l border-slate-800 shrink-0">
            {/* Standalone Tab Link - Opens directly in a separate browser tab, keeping main menu untouched */}
            <a
              href={standaloneUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Buka Terminal Scanner Ringan di Tab Baru Browser (Menu Utama Tetap Aktif)"
              className="px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1 text-slate-400 hover:text-emerald-400 hover:bg-slate-800/60 transition-all cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Tab Baru</span>
            </a>

            {secondaryTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  title={tab.label}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1 transition-all cursor-pointer ${
                    isActive
                      ? 'bg-slate-800 text-emerald-400 font-bold border border-slate-700'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

