import React, { useState, useMemo } from 'react';
import {
  Save,
  RotateCcw,
  Check,
  Clock,
  Calendar,
  Sparkles,
  CalendarRange,
  School,
  MessageSquare,
  Settings2,
  Plus,
  Trash2,
  Copy,
  Star,
  CheckCircle2,
  AlertCircle,
  Users,
  CalendarCheck,
} from 'lucide-react';
import { AppSettings, DayOfWeek, ScheduleProfile } from '../types';
import {
  ALL_DAYS,
  getNormalizedProfiles,
  getActiveSchedule,
} from '../utils/schedule';
import { INITIAL_CLASSES } from '../data/initialData';

interface SettingsViewProps {
  settings: AppSettings;
  onSaveSettings: (newSettings: AppSettings) => void;
  onResetData: () => void;
}

type SettingsTab = 'profiles' | 'school' | 'whatsapp' | 'system';

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onSaveSettings,
  onResetData,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profiles');
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Initialize schedule profiles
  const [profiles, setProfiles] = useState<ScheduleProfile[]>(() =>
    getNormalizedProfiles(settings)
  );
  const [selectedProfileId, setSelectedProfileId] = useState<string>(() => {
    const norm = getNormalizedProfiles(settings);
    return norm[0]?.id || 'prof-sd-bawah';
  });

  const [formData, setFormData] = useState<AppSettings>({
    ...settings,
    scheduleProfiles: profiles,
  });

  // Selected profile helper
  const currentProfile = useMemo(() => {
    return profiles.find((p) => p.id === selectedProfileId) || profiles[0];
  }, [profiles, selectedProfileId]);

  // Keep formData.scheduleProfiles in sync with local profiles
  const updateProfilesList = (newProfiles: ScheduleProfile[]) => {
    setProfiles(newProfiles);
    setFormData((prev) => ({
      ...prev,
      scheduleProfiles: newProfiles,
    }));
  };

  // Profile operations
  const handleAddProfile = () => {
    const newId = `prof-${Date.now()}`;
    const newProfile: ScheduleProfile = {
      id: newId,
      name: `Profil Jadwal ${profiles.length + 1}`,
      isDefault: profiles.length === 0,
      assignedClasses: [],
      regularSchedule: {
        name: 'Jadwal Reguler',
        days: ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'SABTU'],
        entryTime: '07:00',
        cutoffTime: '07:15',
        homeTime: '12:00',
      },
      enableSpecialSchedule: true,
      specialSchedule: {
        name: 'Jadwal Khusus Hari Jumat',
        days: ['JUMAT'],
        entryTime: '07:00',
        cutoffTime: '07:15',
        homeTime: '10:45',
      },
    };

    const updated = [...profiles, newProfile];
    updateProfilesList(updated);
    setSelectedProfileId(newId);
  };

  const handleDuplicateProfile = (prof: ScheduleProfile) => {
    const newId = `prof-${Date.now()}`;
    const duplicated: ScheduleProfile = {
      ...JSON.parse(JSON.stringify(prof)),
      id: newId,
      name: `${prof.name} (Salinan)`,
      isDefault: false,
      assignedClasses: [],
    };
    const updated = [...profiles, duplicated];
    updateProfilesList(updated);
    setSelectedProfileId(newId);
  };

  const handleDeleteProfile = (profId: string) => {
    if (profiles.length <= 1) {
      return;
    }
    const target = profiles.find((p) => p.id === profId);
    const filtered = profiles.filter((p) => p.id !== profId);
    if (target?.isDefault && filtered.length > 0) {
      filtered[0].isDefault = true;
    }
    updateProfilesList(filtered);
    setSelectedProfileId(filtered[0].id);
  };

  const handleSetDefaultProfile = (profId: string) => {
    const updated = profiles.map((p) => ({
      ...p,
      isDefault: p.id === profId,
    }));
    updateProfilesList(updated);
  };

  // Modify current profile fields
  const handleUpdateCurrentProfile = (updater: (prev: ScheduleProfile) => ScheduleProfile) => {
    if (!currentProfile) return;
    const updated = profiles.map((p) => (p.id === currentProfile.id ? updater(p) : p));
    updateProfilesList(updated);
  };

  // Class assignment toggle
  const toggleClassAssignment = (clsName: string) => {
    handleUpdateCurrentProfile((prev) => {
      const assigned = prev.assignedClasses || [];
      const newAssigned = assigned.includes(clsName)
        ? assigned.filter((c) => c !== clsName)
        : [...assigned, clsName];
      return { ...prev, assignedClasses: newAssigned };
    });
  };

  // Quick class presets
  const handleQuickAssignClasses = (type: 'ALL' | '1-2' | '3-4' | '5-6' | 'CLEAR') => {
    handleUpdateCurrentProfile((prev) => {
      let newClasses: string[] = [];
      if (type === 'ALL') {
        newClasses = [...INITIAL_CLASSES];
      } else if (type === '1-2') {
        newClasses = ['Kelas 1', 'Kelas 2'];
      } else if (type === '3-4') {
        newClasses = ['Kelas 3', 'Kelas 4'];
      } else if (type === '5-6') {
        newClasses = ['Kelas 5', 'Kelas 6'];
      } else {
        newClasses = [];
      }
      return { ...prev, assignedClasses: newClasses };
    });
  };

  // Regular days toggle
  const toggleRegularDay = (day: DayOfWeek) => {
    handleUpdateCurrentProfile((prev) => {
      const currentDays = prev.regularSchedule.days || [];
      const newDays = currentDays.includes(day)
        ? currentDays.filter((d) => d !== day)
        : [...currentDays, day];
      return {
        ...prev,
        regularSchedule: {
          ...prev.regularSchedule,
          days: newDays,
        },
      };
    });
  };

  const setRegularDaysPreset = (preset: 'SENIN_KAMIS' | 'SENIN_JUMAT' | 'SENIN_SABTU' | 'ALL') => {
    handleUpdateCurrentProfile((prev) => {
      let days: DayOfWeek[] = [];
      if (preset === 'SENIN_KAMIS') {
        days = ['SENIN', 'SELASA', 'RABU', 'KAMIS'];
      } else if (preset === 'SENIN_JUMAT') {
        days = ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT'];
      } else if (preset === 'SENIN_SABTU') {
        days = ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
      } else {
        days = ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU', 'MINGGU'];
      }
      return {
        ...prev,
        regularSchedule: {
          ...prev.regularSchedule,
          days,
        },
      };
    });
  };

  // Special days toggle
  const toggleSpecialDay = (day: DayOfWeek) => {
    handleUpdateCurrentProfile((prev) => {
      const currentDays = prev.specialSchedule.days || [];
      const newDays = currentDays.includes(day)
        ? currentDays.filter((d) => d !== day)
        : [...currentDays, day];
      return {
        ...prev,
        specialSchedule: {
          ...prev.specialSchedule,
          days: newDays,
        },
      };
    });
  };

  // Submit and Save
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const primaryProfile = profiles.find((p) => p.isDefault) || profiles[0];

    const payload: AppSettings = {
      ...formData,
      scheduleProfiles: profiles,
      defaultSchedule: primaryProfile.regularSchedule,
      specialSchedule: primaryProfile.specialSchedule,
      enableSpecialSchedule: primaryProfile.enableSpecialSchedule,
      entryTime: primaryProfile.regularSchedule.entryTime,
      cutoffTime: primaryProfile.regularSchedule.cutoffTime,
      homeTime: primaryProfile.regularSchedule.homeTime,
    };

    onSaveSettings(payload);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  // Today active summary simulation
  const todayActive = getActiveSchedule(formData);

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Top Header & Save Action */}
      <div className="bg-slate-900/90 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-emerald-400" />
            Pengaturan Sekolah
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Atur profil jadwal kelas (reguler & khusus), identitas sekolah, dan templat WhatsApp.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center space-x-2 transition-all shrink-0 ${
            savedSuccess
              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
              : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20'
          }`}
        >
          {savedSuccess ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Tersimpan</span>
            </>
          ) : (
            <>
              <Save className="w-3.5 h-3.5" />
              <span>Simpan Pengaturan</span>
            </>
          )}
        </button>
      </div>

      {/* Minimalist Tab Navigation */}
      <div className="flex items-center space-x-1 bg-slate-900/90 p-1.5 rounded-xl border border-slate-800 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveTab('profiles')}
          className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
            activeTab === 'profiles'
              ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <CalendarRange className="w-3.5 h-3.5" />
          <span>Profil Jadwal</span>
          <span
            className={`px-1.5 py-0.2 rounded text-[10px] ${
              activeTab === 'profiles' ? 'bg-slate-950/20 text-slate-950 font-black' : 'bg-slate-800 text-slate-400'
            }`}
          >
            {profiles.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('school')}
          className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
            activeTab === 'school'
              ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <School className="w-3.5 h-3.5" />
          <span>Identitas Sekolah</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('whatsapp')}
          className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
            activeTab === 'whatsapp'
              ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Templat WhatsApp</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('system')}
          className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
            activeTab === 'system'
              ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Settings2 className="w-3.5 h-3.5" />
          <span>Sistem & Reset</span>
        </button>
      </div>

      {/* TAB 1: PROFIL JADWAL */}
      {activeTab === 'profiles' && (
        <div className="space-y-4">
          {/* Multi-Profile Concurrent Banner */}
          <div className="bg-slate-900/90 p-4 rounded-2xl border border-emerald-500/30 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <h3 className="font-bold text-white text-sm">Semua Profil Aktif & Berjalan Beriringan</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Multi-Tingkat Otomatis
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                Setiap profil berstatus aktif secara default dan berjalan bersamaan (beriringan). Jam masuk, batas toleransi, dan jam pulang akan otomatis berlaku sesuai tingkatan kelas siswa (misal: Kelas 1–2 pulang pukul 10.30 WIB, Kelas 3–6 pulang pukul 12.30 WIB).
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleAddProfile}
                className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl flex items-center space-x-1.5 transition-all shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Profil Kelas</span>
              </button>
            </div>
          </div>

          {/* Profile Cards Grid */}
          <div className="bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-emerald-400" />
                  Daftar Profil Jadwal Berjalan Serentak ({profiles.length} Profil)
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Klik pada profil di bawah untuk mengedit pengaturan jam dan kelas yang ditugaskan.
                </p>
              </div>
            </div>

            {/* Profiles Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {profiles.map((prof) => {
                const isSelected = prof.id === selectedProfileId;
                const classCount = prof.assignedClasses?.length || 0;

                return (
                  <div
                    key={prof.id}
                    onClick={() => setSelectedProfileId(prof.id)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all relative text-left ${
                      isSelected
                        ? 'bg-slate-800/90 border-emerald-500 shadow-sm'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-bold text-xs sm:text-sm text-white truncate">{prof.name}</h4>
                          <span className="px-1.5 py-0.2 bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded text-[9px] font-semibold shrink-0">
                            Aktif
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                          <Users className="w-3 h-3 text-slate-500" />
                          <span className="truncate">
                            {classCount > 0
                              ? `${prof.assignedClasses.join(', ')}`
                              : 'Semua Kelas / Cadangan'}
                          </span>
                        </p>
                      </div>

                      {isSelected && (
                        <div className="w-4 h-4 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center shrink-0">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      )}
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span>Masuk: <strong className="text-emerald-400">{prof.regularSchedule?.entryTime}</strong></span>
                      <span>Pulang: <strong className="text-sky-400">{prof.regularSchedule?.homeTime}</strong></span>
                      {prof.enableSpecialSchedule && (
                        <span>Khusus: <strong className="text-amber-400">{prof.specialSchedule?.homeTime}</strong></span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ACTIVE PROFILE EDITOR */}
          {currentProfile && (
            <div className="bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-800 space-y-5">
              {/* Profile Top Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div className="flex-1 max-w-sm">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Nama Profil:
                  </label>
                  <input
                    type="text"
                    value={currentProfile.name}
                    onChange={(e) =>
                      handleUpdateCurrentProfile((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="Contoh: Kelas Bawah (Kelas 1 - 2)"
                    className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-lg px-3 py-1.5 text-xs font-medium text-white focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-1.5 self-end sm:self-auto">
                  <span className="px-2.5 py-1.5 bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-xs font-semibold rounded-lg flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>Aktif Berjalan Beriringan</span>
                  </span>

                  <button
                    type="button"
                    onClick={() => handleDuplicateProfile(currentProfile)}
                    title="Duplikat profil ini"
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition-all"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteProfile(currentProfile.id)}
                    title="Hapus profil"
                    disabled={profiles.length <= 1}
                    className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 rounded-lg border border-rose-500/30 transition-all disabled:opacity-30"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* 1. KELAS YANG DITUGASKAN (SIMPEL & MINIMALIS) */}
              <div className="space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-emerald-400" />
                      1. Pilih Kelas untuk Profil Ini:
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Pilih kelas (Kelas 1 s/d 6) yang akan menggunakan aturan jam profil ini.
                    </p>
                  </div>

                  {/* Minimalist Quick Presets */}
                  <div className="flex items-center gap-1 text-[11px]">
                    <button
                      type="button"
                      onClick={() => handleQuickAssignClasses('ALL')}
                      className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition-all"
                    >
                      Semua
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickAssignClasses('1-2')}
                      className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition-all"
                    >
                      1 - 2
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickAssignClasses('3-4')}
                      className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition-all"
                    >
                      3 - 4
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickAssignClasses('5-6')}
                      className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition-all"
                    >
                      5 - 6
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickAssignClasses('CLEAR')}
                      className="px-2 py-0.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded transition-all"
                    >
                      Reset
                    </button>
                  </div>
                </div>

                {/* Minimalist Class Choice Buttons */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-1">
                  {INITIAL_CLASSES.map((cls) => {
                    const isAssignedToThis = currentProfile.assignedClasses?.includes(cls);
                    const otherProf = profiles.find(
                      (p) => p.id !== currentProfile.id && p.assignedClasses?.includes(cls)
                    );

                    return (
                      <button
                        type="button"
                        key={cls}
                        onClick={() => toggleClassAssignment(cls)}
                        className={`px-3 py-2.5 rounded-xl text-xs font-semibold transition-all border flex items-center justify-between ${
                          isAssignedToThis
                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-sm'
                            : otherProf
                            ? 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:border-slate-700'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <span className="font-bold">{cls}</span>
                        <div
                          className={`w-4 h-4 rounded-md flex items-center justify-center text-[10px] ${
                            isAssignedToThis
                              ? 'bg-emerald-500 text-slate-950 font-bold'
                              : 'border border-slate-700'
                          }`}
                        >
                          {isAssignedToThis && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. JADWAL REGULER */}
              <div className="p-3.5 sm:p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-3.5">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <div className="flex items-center space-x-1.5">
                    <Clock className="w-3.5 h-3.5 text-emerald-400" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                      2. Jadwal Reguler (Hari Standar)
                    </h4>
                  </div>
                  <span className="text-[10px] text-slate-400">Waktu Masuk & Pulang</span>
                </div>

                {/* Day Selection */}
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <label className="text-[11px] font-semibold text-slate-300">
                      Pilih Hari Masuk Reguler:
                    </label>
                    <div className="flex items-center gap-1 text-[10px]">
                      <button
                        type="button"
                        onClick={() => setRegularDaysPreset('SENIN_KAMIS')}
                        className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition-all"
                      >
                        Sen-Kam
                      </button>
                      <button
                        type="button"
                        onClick={() => setRegularDaysPreset('SENIN_JUMAT')}
                        className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition-all"
                      >
                        Sen-Jum
                      </button>
                      <button
                        type="button"
                        onClick={() => setRegularDaysPreset('SENIN_SABTU')}
                        className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition-all"
                      >
                        Sen-Sab
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                    {ALL_DAYS.map((day) => {
                      const isChecked = currentProfile.regularSchedule.days?.includes(day.key);
                      return (
                        <button
                          type="button"
                          key={day.key}
                          onClick={() => toggleRegularDay(day.key)}
                          className={`py-1.5 px-2 rounded-lg text-xs font-medium border flex items-center justify-between transition-all ${
                            isChecked
                              ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300 font-bold'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          <span>{day.short}</span>
                          <div
                            className={`w-3 h-3 rounded flex items-center justify-center ${
                              isChecked
                                ? 'bg-emerald-500 text-slate-950 font-bold'
                                : 'border border-slate-700'
                            }`}
                          >
                            {isChecked && <Check className="w-2 h-2 stroke-[3]" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3 Time Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                  <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
                    <label className="block text-[11px] font-semibold text-emerald-400 mb-1">
                      Jam Masuk (WIB):
                    </label>
                    <input
                      type="time"
                      value={currentProfile.regularSchedule.entryTime}
                      onChange={(e) =>
                        handleUpdateCurrentProfile((prev) => ({
                          ...prev,
                          regularSchedule: { ...prev.regularSchedule, entryTime: e.target.value },
                        }))
                      }
                      className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-md px-2.5 py-1 text-xs font-mono text-white focus:outline-none"
                    />
                  </div>

                  <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
                    <label className="block text-[11px] font-semibold text-amber-400 mb-1">
                      Batas Terlambat (WIB):
                    </label>
                    <input
                      type="time"
                      value={currentProfile.regularSchedule.cutoffTime}
                      onChange={(e) =>
                        handleUpdateCurrentProfile((prev) => ({
                          ...prev,
                          regularSchedule: { ...prev.regularSchedule, cutoffTime: e.target.value },
                        }))
                      }
                      className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-md px-2.5 py-1 text-xs font-mono text-white focus:outline-none"
                    />
                  </div>

                  <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
                    <label className="block text-[11px] font-semibold text-sky-400 mb-1">
                      Jam Pulang (WIB):
                    </label>
                    <input
                      type="time"
                      value={currentProfile.regularSchedule.homeTime}
                      onChange={(e) =>
                        handleUpdateCurrentProfile((prev) => ({
                          ...prev,
                          regularSchedule: { ...prev.regularSchedule, homeTime: e.target.value },
                        }))
                      }
                      className="w-full bg-slate-950 border border-slate-700 focus:border-sky-500 rounded-md px-2.5 py-1 text-xs font-mono text-white focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* 3. JADWAL KHUSUS (MISAL: JUMAT / SENAM) */}
              <div className="p-3.5 sm:p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-3.5">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <div className="flex items-center space-x-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">
                      3. Jam Khusus (Misal: Hari Jumat / Kepulangan Awal)
                    </h4>
                  </div>

                  {/* Switch Toggle */}
                  <label className="flex items-center cursor-pointer space-x-2">
                    <span className="text-[11px] font-medium text-slate-300">
                      {currentProfile.enableSpecialSchedule ? 'Aktif' : 'Non-Aktif'}
                    </span>
                    <input
                      type="checkbox"
                      checked={currentProfile.enableSpecialSchedule}
                      onChange={(e) =>
                        handleUpdateCurrentProfile((prev) => ({
                          ...prev,
                          enableSpecialSchedule: e.target.checked,
                        }))
                      }
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-amber-500"></div>
                  </label>
                </div>

                {currentProfile.enableSpecialSchedule ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Keterangan Jam Khusus:
                      </label>
                      <input
                        type="text"
                        value={currentProfile.specialSchedule?.name || ''}
                        onChange={(e) =>
                          handleUpdateCurrentProfile((prev) => ({
                            ...prev,
                            specialSchedule: { ...prev.specialSchedule, name: e.target.value },
                          }))
                        }
                        placeholder="Contoh: Jumat Kepulangan Awal"
                        className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                      />
                    </div>

                    {/* Special Days */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-slate-300">
                        Pilih Hari Berlakunya Jam Khusus:
                      </label>
                      <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                        {ALL_DAYS.map((day) => {
                          const isChecked = currentProfile.specialSchedule?.days?.includes(day.key);
                          return (
                            <button
                              type="button"
                              key={day.key}
                              onClick={() => toggleSpecialDay(day.key)}
                              className={`py-1.5 px-2 rounded-lg text-xs font-medium border flex items-center justify-between transition-all ${
                                isChecked
                                  ? 'bg-amber-500/15 border-amber-500 text-amber-300 font-bold'
                                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                              }`}
                            >
                              <span>{day.short}</span>
                              <div
                                className={`w-3 h-3 rounded flex items-center justify-center ${
                                  isChecked
                                    ? 'bg-amber-500 text-slate-950 font-bold'
                                    : 'border border-slate-700'
                                }`}
                              >
                                {isChecked && <Check className="w-2 h-2 stroke-[3]" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* 3 Special Time Inputs */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                      <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
                        <label className="block text-[11px] font-semibold text-emerald-400 mb-1">
                          Jam Masuk Khusus (WIB):
                        </label>
                        <input
                          type="time"
                          value={currentProfile.specialSchedule?.entryTime || '07:00'}
                          onChange={(e) =>
                            handleUpdateCurrentProfile((prev) => ({
                              ...prev,
                              specialSchedule: {
                                ...prev.specialSchedule,
                                entryTime: e.target.value,
                              },
                            }))
                          }
                          className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-md px-2.5 py-1 text-xs font-mono text-white focus:outline-none"
                        />
                      </div>

                      <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
                        <label className="block text-[11px] font-semibold text-amber-400 mb-1">
                          Batas Terlambat Khusus (WIB):
                        </label>
                        <input
                          type="time"
                          value={currentProfile.specialSchedule?.cutoffTime || '07:15'}
                          onChange={(e) =>
                            handleUpdateCurrentProfile((prev) => ({
                              ...prev,
                              specialSchedule: {
                                ...prev.specialSchedule,
                                cutoffTime: e.target.value,
                              },
                            }))
                          }
                          className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-md px-2.5 py-1 text-xs font-mono text-white focus:outline-none"
                        />
                      </div>

                      <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
                        <label className="block text-[11px] font-semibold text-sky-400 mb-1">
                          Jam Pulang Khusus (WIB):
                        </label>
                        <input
                          type="time"
                          value={currentProfile.specialSchedule?.homeTime || '10:45'}
                          onChange={(e) =>
                            handleUpdateCurrentProfile((prev) => ({
                              ...prev,
                              specialSchedule: {
                                ...prev.specialSchedule,
                                homeTime: e.target.value,
                              },
                            }))
                          }
                          className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-md px-2.5 py-1 text-xs font-mono text-white focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 italic">
                    Jam khusus dinonaktifkan untuk profil ini. Semua hari sekolah mengikuti Jam Reguler.
                  </p>
                )}
              </div>

              {/* 4. RINGKASAN MINGGUAN */}
              <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-2">
                <h5 className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                  Ringkasan Hari Mingguan Profil Ini:
                </h5>

                <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5 pt-1">
                  {ALL_DAYS.map((day) => {
                    const isSpecial =
                      currentProfile.enableSpecialSchedule &&
                      currentProfile.specialSchedule?.days?.includes(day.key);
                    const isRegular = currentProfile.regularSchedule.days?.includes(day.key);

                    if (isSpecial) {
                      return (
                        <div
                          key={day.key}
                          className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-center"
                        >
                          <div className="text-[11px] font-bold text-amber-300">{day.short}</div>
                          <div className="text-[10px] text-amber-200 font-mono">
                            {currentProfile.specialSchedule?.homeTime}
                          </div>
                          <span className="text-[9px] px-1 bg-amber-500/20 text-amber-300 rounded font-semibold">
                            Khusus
                          </span>
                        </div>
                      );
                    }

                    if (isRegular) {
                      return (
                        <div
                          key={day.key}
                          className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-center"
                        >
                          <div className="text-[11px] font-bold text-emerald-300">{day.short}</div>
                          <div className="text-[10px] text-emerald-200 font-mono">
                            {currentProfile.regularSchedule?.homeTime}
                          </div>
                          <span className="text-[9px] px-1 bg-emerald-500/20 text-emerald-300 rounded font-semibold">
                            Reguler
                          </span>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={day.key}
                        className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-center opacity-50"
                      >
                        <div className="text-[11px] font-medium text-slate-400">{day.short}</div>
                        <div className="text-[10px] text-slate-500">Libur</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: IDENTITAS SEKOLAH */}
      {activeTab === 'school' && (
        <div className="bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-800 space-y-4">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
              <School className="w-3.5 h-3.5 text-emerald-400" />
              Identitas Sekolah & Kepala Sekolah
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Informasi dicetak pada KOP surat resmi, laporan rekapitulasi, dan kartu barcode presensi siswa.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Nama Sekolah:
              </label>
              <input
                type="text"
                value={formData.schoolName}
                onChange={(e) => setFormData({ ...formData, schoolName: e.target.value })}
                placeholder="Contoh: SD Negeri 1 Nusantara"
                className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Alamat Lengkap:
              </label>
              <input
                type="text"
                value={formData.schoolAddress}
                onChange={(e) => setFormData({ ...formData, schoolAddress: e.target.value })}
                placeholder="Contoh: Jl. Ki Hajar Dewantara No. 15"
                className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Nama Kepala Sekolah:
              </label>
              <input
                type="text"
                value={formData.principalName}
                onChange={(e) => setFormData({ ...formData, principalName: e.target.value })}
                placeholder="Contoh: Dra. Hj. Endang Rahayu, M.Pd."
                className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                NIP Kepala Sekolah:
              </label>
              <input
                type="text"
                value={formData.principalNip}
                onChange={(e) => setFormData({ ...formData, principalNip: e.target.value })}
                placeholder="Contoh: 19750812 199903 2 001"
                className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: TEMPLAT PESAN WHATSAPP */}
      {activeTab === 'whatsapp' && (
        <div className="bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-800 space-y-4">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
              Format Templat Pesan WhatsApp
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Placeholder tersedia: <code className="text-emerald-400 font-mono">{'{NAMA}'}</code>,{' '}
              <code className="text-emerald-400 font-mono">{'{NISN}'}</code>,{' '}
              <code className="text-emerald-400 font-mono">{'{KELAS}'}</code>,{' '}
              <code className="text-emerald-400 font-mono">{'{WAKTU}'}</code>.
            </p>
          </div>

          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-amber-400 mb-1">
                1. Pesan Peringatan Keterlambatan:
              </label>
              <textarea
                rows={2}
                value={formData.waTemplateLate}
                onChange={(e) => setFormData({ ...formData, waTemplateLate: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-lg p-2.5 text-xs text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-rose-400 mb-1">
                2. Pesan Peringatan Siswa Belum Hadir (Alpa):
              </label>
              <textarea
                rows={2}
                value={formData.waTemplateAbsent}
                onChange={(e) => setFormData({ ...formData, waTemplateAbsent: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 focus:border-rose-500 rounded-lg p-2.5 text-xs text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-sky-400 mb-1">
                3. Pesan Siswa Selesai Absen Pulang:
              </label>
              <textarea
                rows={2}
                value={formData.waTemplateHome}
                onChange={(e) => setFormData({ ...formData, waTemplateHome: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 focus:border-sky-500 rounded-lg p-2.5 text-xs text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-emerald-400 mb-1">
                4. Pesan Persetujuan Surat Izin / Sakit:
              </label>
              <textarea
                rows={2}
                value={formData.waTemplateApproved}
                onChange={(e) => setFormData({ ...formData, waTemplateApproved: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-lg p-2.5 text-xs text-white focus:outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: SISTEM & RESET */}
      {activeTab === 'system' && (
        <div className="space-y-4">
          <div className="bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-800 space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                <Settings2 className="w-3.5 h-3.5 text-emerald-400" />
                Preferensi Format Kartu & Barcode
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Format Cetak Kartu:
                </label>
                <select
                  value={formData.barcodeFormat}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      barcodeFormat: e.target.value as 'BARCODE_1D' | 'QR_CODE' | 'BOTH',
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                >
                  <option value="BARCODE_1D">Barcode 1D (Code128 Standar)</option>
                  <option value="QR_CODE">QR Code (Matrix 2D)</option>
                  <option value="BOTH">Keduanya (Dual Format)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Notifikasi WhatsApp Saat Scan:
                </label>
                <select
                  value={formData.enableAutoWhatsAppAlerts ? 'true' : 'false'}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      enableAutoWhatsAppAlerts: e.target.value === 'true',
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                >
                  <option value="true">Aktif (Kirim otomatis saat siswa terlambat/pulang)</option>
                  <option value="false">Nonaktif (Hanya rekam lokal & cloud)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Reset Danger Zone */}
          <div className="bg-rose-950/20 p-4 sm:p-5 rounded-2xl border border-rose-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-rose-300 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                Reset Data Awal
              </h4>
              <p className="text-[11px] text-rose-200/70 mt-0.5">
                Mengembalikan data siswa, rekap presensi, dan profil jadwal ke data bawaan awal.
              </p>
            </div>

            <button
              type="button"
              onClick={onResetData}
              className="px-3.5 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 hover:text-rose-200 border border-rose-500/40 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Data</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
