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
  BookOpen,
  GraduationCap,
  Layers,
} from 'lucide-react';
import {
  AppSettings,
  DayOfWeek,
  ScheduleProfile,
  Student,
  HomeroomTeacher,
  ClassRombel,
} from '../types';
import {
  ALL_DAYS,
  getNormalizedProfiles,
  getActiveSchedule,
} from '../utils/schedule';
import { INITIAL_CLASSES, INITIAL_ROMBELS } from '../data/initialData';
import { sanitizeClass } from '../utils/storage';
import { getTeacherForClass } from '../utils/whatsapp';

interface SettingsViewProps {
  settings: AppSettings;
  students?: Student[];
  teachers?: HomeroomTeacher[];
  onSaveSettings: (newSettings: AppSettings) => void;
  onResetData: () => void;
}

type SettingsTab = 'profiles' | 'rombels' | 'school' | 'whatsapp' | 'system';

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  students = [],
  teachers = [],
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

  // Managed Rombels state
  const [managedRombels, setManagedRombels] = useState<ClassRombel[]>(() => {
    if (settings.managedRombels && settings.managedRombels.length > 0) {
      return settings.managedRombels;
    }
    return INITIAL_ROMBELS;
  });

  // New rombel form state
  const [newRombelGrade, setNewRombelGrade] = useState<string>('1');
  const [newRombelSuffix, setNewRombelSuffix] = useState<string>('C');
  const [rombelFeedback, setRombelFeedback] = useState<string | null>(null);

  const [formData, setFormData] = useState<AppSettings>({
    ...settings,
    scheduleProfiles: profiles,
    managedRombels: managedRombels,
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

  // Derived all available classes/rombels
  const allAvailableClasses = useMemo(() => {
    return Array.from(
      new Set([
        ...managedRombels.map((r) => r.name),
        ...(settings.customClasses || []),
        ...INITIAL_CLASSES,
        ...(students?.map((s) => s.class) || []),
      ])
    )
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [managedRombels, settings.customClasses, students]);

  // Group classes by grade
  const classesByGrade = useMemo(() => {
    const groups: { [grade: string]: string[] } = {};
    allAvailableClasses.forEach((cls) => {
      const match = cls.match(/^(Kelas\s*\d+)/i);
      const grade = match ? match[1] : 'Lainnya';
      if (!groups[grade]) groups[grade] = [];
      groups[grade].push(cls);
    });
    return groups;
  }, [allAvailableClasses]);

  // Quick class presets
  const handleQuickAssignClasses = (type: 'ALL' | '1-2' | '3-4' | '5-6' | 'CLEAR') => {
    handleUpdateCurrentProfile((prev) => {
      let newClasses: string[] = [];
      if (type === 'ALL') {
        newClasses = [...allAvailableClasses];
      } else if (type === '1-2') {
        newClasses = allAvailableClasses.filter((c) => /Kelas\s*[1-2]/i.test(c));
      } else if (type === '3-4') {
        newClasses = allAvailableClasses.filter((c) => /Kelas\s*[3-4]/i.test(c));
      } else if (type === '5-6') {
        newClasses = allAvailableClasses.filter((c) => /Kelas\s*[5-6]/i.test(c));
      } else {
        newClasses = [];
      }
      return { ...prev, assignedClasses: newClasses };
    });
  };

  // Rombel Management Handlers
  const handleAddRombel = (e: React.FormEvent) => {
    e.preventDefault();
    const gradeNum = parseInt(newRombelGrade, 10);
    const suffix = newRombelSuffix.trim().toUpperCase();
    if (!suffix) return;

    const formattedName = sanitizeClass(
      isNaN(gradeNum) ? `${newRombelGrade} ${suffix}` : `Kelas ${gradeNum}-${suffix}`
    );

    if (managedRombels.some((r) => r.name.toLowerCase() === formattedName.toLowerCase())) {
      setRombelFeedback(`Rombel "${formattedName}" sudah ada dalam daftar.`);
      setTimeout(() => setRombelFeedback(null), 3000);
      return;
    }

    const newRombel: ClassRombel = {
      id: `rombel-${Date.now()}`,
      name: formattedName,
      grade: isNaN(gradeNum) ? 1 : gradeNum,
      rombelSuffix: suffix,
    };

    const updated = [...managedRombels, newRombel].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true })
    );
    setManagedRombels(updated);
    setFormData((prev) => ({ ...prev, managedRombels: updated }));

    setRombelFeedback(`Berhasil menambahkan rombel ${formattedName}!`);
    setTimeout(() => setRombelFeedback(null), 3000);
  };

  const handleDeleteRombel = (rombelId: string, rombelName: string) => {
    const studentCount = students.filter((s) => s.class === rombelName).length;
    if (studentCount > 0) {
      if (
        !confirm(
          `Peringatan: Masih ada ${studentCount} siswa terdaftar di ${rombelName}. Apakah Anda yakin ingin menghapus rombel ini?`
        )
      ) {
        return;
      }
    } else {
      if (!confirm(`Hapus rombel ${rombelName}?`)) return;
    }

    const updated = managedRombels.filter((r) => r.id !== rombelId);
    setManagedRombels(updated);
    setFormData((prev) => ({ ...prev, managedRombels: updated }));

    // Also remove from profiles
    setProfiles((prev) =>
      prev.map((prof) => ({
        ...prof,
        assignedClasses: (prof.assignedClasses || []).filter((c) => c !== rombelName),
      }))
    );
  };

  const handleGeneratePresetRombels = (format: 'SINGLE' | '2_ROMBELS' | '3_ROMBELS') => {
    let generated: ClassRombel[] = [];
    if (format === 'SINGLE') {
      generated = [1, 2, 3, 4, 5, 6].map((g) => ({
        id: `rombel-k${g}`,
        name: `Kelas ${g}`,
        grade: g,
        rombelSuffix: '',
      }));
    } else if (format === '2_ROMBELS') {
      const list: ClassRombel[] = [];
      [1, 2, 3, 4, 5, 6].forEach((g) => {
        ['A', 'B'].forEach((sfx) => {
          list.push({
            id: `rombel-k${g}-${sfx.toLowerCase()}`,
            name: `Kelas ${g}-${sfx}`,
            grade: g,
            rombelSuffix: sfx,
          });
        });
      });
      generated = list;
    } else if (format === '3_ROMBELS') {
      const list: ClassRombel[] = [];
      [1, 2, 3, 4, 5, 6].forEach((g) => {
        ['A', 'B', 'C'].forEach((sfx) => {
          list.push({
            id: `rombel-k${g}-${sfx.toLowerCase()}`,
            name: `Kelas ${g}-${sfx}`,
            grade: g,
            rombelSuffix: sfx,
          });
        });
      });
      generated = list;
    }

    if (
      !confirm(
        `Generate template rombel otomatis ini? Rombel saat ini akan digantikan oleh preset ${
          format === 'SINGLE' ? '1 Rombel' : format === '2_ROMBELS' ? '2 Rombel (A & B)' : '3 Rombel (A, B, C)'
        }.`
      )
    ) {
      return;
    }

    setManagedRombels(generated);
    setFormData((prev) => ({ ...prev, managedRombels: generated }));
    setRombelFeedback(`Preset berhasil dimuat (${generated.length} rombel dibuat)!`);
    setTimeout(() => setRombelFeedback(null), 3000);
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
      managedRombels: managedRombels,
      customClasses: allAvailableClasses,
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
          onClick={() => setActiveTab('rombels')}
          className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
            activeTab === 'rombels'
              ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Kelas & Rombel</span>
          <span
            className={`px-1.5 py-0.2 rounded text-[10px] ${
              activeTab === 'rombels' ? 'bg-slate-950/20 text-slate-950 font-black' : 'bg-slate-800 text-slate-400'
            }`}
          >
            {managedRombels.length}
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

      {/* TAB 1: PROFIL JADWAL (SEDERHANA, MUDAH & INTUITIF) */}
      {activeTab === 'profiles' && (
        <div className="space-y-4">
          {/* Top Profile Selector Tabs */}
          <div className="bg-slate-900 p-3.5 sm:p-4 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-400" />
                  Pilih Profil Jadwal Kelas
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Setiap profil otomatis berjalan serentak sesuai rombel kelas siswa.
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddProfile}
                className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold rounded-xl flex items-center gap-1.5 transition self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-400" />
                <span>+ Tambah Profil Baru</span>
              </button>
            </div>

            {/* Profile Selection Horizontal Button List */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
              {profiles.map((prof) => {
                const isSelected = prof.id === selectedProfileId;
                const classCount = prof.assignedClasses?.length || 0;

                return (
                  <button
                    key={prof.id}
                    type="button"
                    onClick={() => setSelectedProfileId(prof.id)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 border ${
                      isSelected
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/20'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700 hover:bg-slate-800/60'
                    }`}
                  >
                    <span>{prof.name}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                        isSelected
                          ? 'bg-slate-950/20 text-slate-950 font-bold'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {classCount} Kelas
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ACTIVE PROFILE EDITOR */}
          {currentProfile && (
            <div className="bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-800 space-y-5">
              {/* Profile Header & Name */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div className="flex-1 max-w-md">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Nama Profil Jadwal:
                  </label>
                  <input
                    type="text"
                    value={currentProfile.name}
                    onChange={(e) =>
                      handleUpdateCurrentProfile((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="Misal: Kelas Bawah (Kelas 1 - 2)"
                    className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs font-medium text-white focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={() => handleDuplicateProfile(currentProfile)}
                    title="Duplikat profil ini"
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition flex items-center gap-1.5"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Duplikat</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteProfile(currentProfile.id)}
                    title="Hapus profil ini"
                    disabled={profiles.length <= 1}
                    className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold rounded-xl border border-rose-500/30 transition disabled:opacity-30 flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus</span>
                  </button>
                </div>
              </div>

              {/* 1. KELAS YANG MENGGUNAKAN JADWAL INI */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-emerald-400" />
                      1. Kelas yang Ditugaskan ({currentProfile.assignedClasses?.length || 0} Kelas)
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Klik rombel di bawah untuk mengaktifkan atau menonaktifkan jadwal profil ini.
                    </p>
                  </div>

                  {/* Simple Quick Presets */}
                  <div className="flex items-center gap-1 text-[11px] flex-wrap">
                    <span className="text-[10px] text-slate-500 mr-1">Preset Cepat:</span>
                    <button
                      type="button"
                      onClick={() => handleQuickAssignClasses('ALL')}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition"
                    >
                      Semua
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickAssignClasses('1-2')}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition"
                    >
                      Kelas 1 - 2
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickAssignClasses('3-4')}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition"
                    >
                      Kelas 3 - 4
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickAssignClasses('5-6')}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition"
                    >
                      Kelas 5 - 6
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickAssignClasses('CLEAR')}
                      className="px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg text-xs font-semibold transition"
                    >
                      Kosongkan
                    </button>
                  </div>
                </div>

                {/* Compact Interactive Chips for Classes */}
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 pt-1">
                  {allAvailableClasses.map((cls) => {
                    const isAssigned = currentProfile.assignedClasses?.includes(cls);
                    return (
                      <button
                        type="button"
                        key={cls}
                        onClick={() => toggleClassAssignment(cls)}
                        className={`p-2 rounded-xl text-xs font-bold transition flex items-center justify-between border ${
                          isAssigned
                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-sm'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'
                        }`}
                      >
                        <span>{cls}</span>
                        <div
                          className={`w-4 h-4 rounded-md flex items-center justify-center text-[10px] ${
                            isAssigned
                              ? 'bg-emerald-500 text-slate-950 font-bold'
                              : 'border border-slate-700'
                          }`}
                        >
                          {isAssigned && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. JAM MASUK & PULANG REGULER */}
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                      2. Aturan Jam Masuk & Pulang Reguler
                    </h4>
                  </div>
                  <span className="text-[11px] text-slate-400">Hari Masuk Reguler</span>
                </div>

                {/* Day selector & presets */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-xs font-semibold text-slate-300">
                      Hari Masuk Sekolah:
                    </label>
                    <div className="flex items-center gap-1.5 text-xs">
                      <button
                        type="button"
                        onClick={() => setRegularDaysPreset('SENIN_JUMAT')}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-semibold transition text-xs"
                      >
                        Senin - Jumat (5 Hari)
                      </button>
                      <button
                        type="button"
                        onClick={() => setRegularDaysPreset('SENIN_SABTU')}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-semibold transition text-xs"
                      >
                        Senin - Sabtu (6 Hari)
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
                          className={`py-1.5 px-2 rounded-xl text-xs font-bold border flex items-center justify-between transition ${
                            isChecked
                              ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300'
                              : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700'
                          }`}
                        >
                          <span>{day.short}</span>
                          {isChecked && <Check className="w-3 h-3 text-emerald-400 stroke-[3]" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3 Main Time Setting Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                  {/* Jam Masuk */}
                  <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Jam Masuk</span>
                      </label>
                      <span className="text-[10px] text-slate-400 font-mono">Pagi</span>
                    </div>
                    <input
                      type="time"
                      value={currentProfile.regularSchedule.entryTime}
                      onChange={(e) =>
                        handleUpdateCurrentProfile((prev) => ({
                          ...prev,
                          regularSchedule: { ...prev.regularSchedule, entryTime: e.target.value },
                        }))
                      }
                      className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-lg px-3 py-1.5 text-sm font-mono font-bold text-white focus:outline-none"
                    />
                    <div className="flex gap-1">
                      {['06:45', '07:00', '07:15'].map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() =>
                            handleUpdateCurrentProfile((prev) => ({
                              ...prev,
                              regularSchedule: { ...prev.regularSchedule, entryTime: t },
                            }))
                          }
                          className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-[10px] font-mono text-slate-300 transition"
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Batas Terlambat */}
                  <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>Batas Toleransi Terlambat</span>
                      </label>
                      <span className="text-[10px] text-slate-400 font-mono">Toleransi</span>
                    </div>
                    <input
                      type="time"
                      value={currentProfile.regularSchedule.cutoffTime}
                      onChange={(e) =>
                        handleUpdateCurrentProfile((prev) => ({
                          ...prev,
                          regularSchedule: { ...prev.regularSchedule, cutoffTime: e.target.value },
                        }))
                      }
                      className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-lg px-3 py-1.5 text-sm font-mono font-bold text-white focus:outline-none"
                    />
                    <div className="flex gap-1">
                      {['07:10', '07:15', '07:20', '07:30'].map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() =>
                            handleUpdateCurrentProfile((prev) => ({
                              ...prev,
                              regularSchedule: { ...prev.regularSchedule, cutoffTime: t },
                            }))
                          }
                          className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-[10px] font-mono text-slate-300 transition"
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Jam Pulang Reguler */}
                  <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Jam Pulang Standar</span>
                      </label>
                      <span className="text-[10px] text-slate-400 font-mono">Siang</span>
                    </div>
                    <input
                      type="time"
                      value={currentProfile.regularSchedule.homeTime}
                      onChange={(e) =>
                        handleUpdateCurrentProfile((prev) => ({
                          ...prev,
                          regularSchedule: { ...prev.regularSchedule, homeTime: e.target.value },
                        }))
                      }
                      className="w-full bg-slate-950 border border-slate-700 focus:border-sky-500 rounded-lg px-3 py-1.5 text-sm font-mono font-bold text-white focus:outline-none"
                    />
                    <div className="flex gap-1 flex-wrap">
                      {['10:30', '11:30', '12:00', '12:30', '13:00'].map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() =>
                            handleUpdateCurrentProfile((prev) => ({
                              ...prev,
                              regularSchedule: { ...prev.regularSchedule, homeTime: t },
                            }))
                          }
                          className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-[10px] font-mono text-slate-300 transition"
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. JADWAL KHUSUS (HARI JUMAT / PULANG AWAL) */}
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">
                        3. Jam Khusus Hari Jumat (Pulang Lebih Awal)
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Untuk kepulangan lebih awal hari Jumat sebelum waktu Sholat Jumat.
                      </p>
                    </div>
                  </div>

                  {/* Switch Toggle */}
                  <label className="flex items-center cursor-pointer space-x-2 shrink-0">
                    <span className="text-xs font-semibold text-slate-300">
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
                    <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                  </label>
                </div>

                {currentProfile.enableSpecialSchedule ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 space-y-2">
                      <label className="block text-xs font-semibold text-slate-300">
                        Nama Keterangan Khusus:
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
                        placeholder="Contoh: Hari Jumat (Pulang Awal)"
                        className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                      />
                      <div className="flex items-center gap-1.5 pt-1">
                        <span className="text-[11px] text-slate-400">Berlaku di:</span>
                        {ALL_DAYS.map((day) => {
                          const isChecked = currentProfile.specialSchedule?.days?.includes(day.key);
                          return (
                            <button
                              type="button"
                              key={day.key}
                              onClick={() => toggleSpecialDay(day.key)}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border transition ${
                                isChecked
                                  ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                                  : 'bg-slate-950 border-slate-800 text-slate-500'
                              }`}
                            >
                              {day.short}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Jam Pulang Khusus (WIB)</span>
                        </label>
                        <span className="text-[10px] text-amber-400/80 font-mono">Lebih Awal</span>
                      </div>
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
                        className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-lg px-3 py-1.5 text-sm font-mono font-bold text-white focus:outline-none"
                      />
                      <div className="flex gap-1">
                        {['10:15', '10:30', '10:45', '11:00', '11:15'].map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() =>
                              handleUpdateCurrentProfile((prev) => ({
                                ...prev,
                                specialSchedule: {
                                  ...prev.specialSchedule,
                                  homeTime: t,
                                },
                              }))
                            }
                            className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-[10px] font-mono text-slate-300 transition"
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">
                    Jam khusus dinonaktifkan. Semua hari sekolah mengikuti Jam Reguler.
                  </p>
                )}
              </div>

              {/* 4. RINGKASAN MINGGUAN */}
              <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-2">
                <h5 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Ringkasan Jadwal Mingguan Profil Ini:</span>
                </h5>

                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-1">
                  {ALL_DAYS.slice(0, 6).map((day) => {
                    const isSpecial =
                      currentProfile.enableSpecialSchedule &&
                      currentProfile.specialSchedule?.days?.includes(day.key);
                    const isRegular = currentProfile.regularSchedule.days?.includes(day.key);

                    if (isSpecial) {
                      return (
                        <div
                          key={day.key}
                          className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-center space-y-0.5"
                        >
                          <div className="text-xs font-bold text-amber-300">{day.label}</div>
                          <div className="text-[11px] text-amber-200 font-mono font-semibold">
                            Pulang {currentProfile.specialSchedule?.homeTime}
                          </div>
                          <span className="inline-block text-[9px] px-1.5 py-0.2 bg-amber-500/20 text-amber-300 rounded font-semibold">
                            Khusus
                          </span>
                        </div>
                      );
                    }

                    if (isRegular) {
                      return (
                        <div
                          key={day.key}
                          className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-0.5"
                        >
                          <div className="text-xs font-bold text-emerald-300">{day.label}</div>
                          <div className="text-[11px] text-emerald-200 font-mono font-semibold">
                            Pulang {currentProfile.regularSchedule?.homeTime}
                          </div>
                          <span className="inline-block text-[9px] px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 rounded font-semibold">
                            Reguler
                          </span>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={day.key}
                        className="p-2 rounded-xl bg-slate-900/60 border border-slate-800 text-center opacity-60"
                      >
                        <div className="text-xs font-medium text-slate-400">{day.label}</div>
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

      {/* TAB: MANAJEMEN KELAS & ROMBEL */}
      {activeTab === 'rombels' && (
        <div className="space-y-4">
          {/* Feedback message */}
          {rombelFeedback && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs font-semibold text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{rombelFeedback}</span>
            </div>
          )}

          {/* Top Banner / Description */}
          <div className="bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-emerald-400" />
                  Manajemen Rombongan Belajar (Rombel)
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Kelola struktur rombel sekolah (misal: Kelas 1-A, Kelas 1-B) yang terhubung ke presensi barcode, laporan rekapitulasi, dan notifikasi WhatsApp wali murid.
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold">
                  {managedRombels.length} Rombel Terdaftar
                </span>
              </div>
            </div>

            {/* Quick Generator & Presets */}
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2.5">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <h4 className="text-xs font-bold text-slate-200">
                  Generator Cepat Format Rombel (1-Klik)
                </h4>
              </div>
              <p className="text-[11px] text-slate-400">
                Pilih susunan standar rombel untuk sekolah Anda secara instan:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleGeneratePresetRombels('SINGLE')}
                  className="p-2.5 bg-slate-900 hover:bg-slate-850 hover:border-slate-700 border border-slate-800 rounded-xl text-left transition group"
                >
                  <div className="text-xs font-bold text-white group-hover:text-emerald-400 transition">
                    Format 1 Rombel
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Kelas 1 s/d 6 (6 Rombel Tunggal)
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleGeneratePresetRombels('2_ROMBELS')}
                  className="p-2.5 bg-slate-900 hover:bg-slate-850 hover:border-emerald-500/50 border border-slate-800 rounded-xl text-left transition group"
                >
                  <div className="text-xs font-bold text-white group-hover:text-emerald-400 transition">
                    Format 2 Rombel (A & B)
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Kelas 1-A s/d 6-B (12 Rombel)
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleGeneratePresetRombels('3_ROMBELS')}
                  className="p-2.5 bg-slate-900 hover:bg-slate-850 hover:border-emerald-500/50 border border-slate-800 rounded-xl text-left transition group"
                >
                  <div className="text-xs font-bold text-white group-hover:text-emerald-400 transition">
                    Format 3 Rombel (A, B, C)
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Kelas 1-A s/d 6-C (18 Rombel)
                  </div>
                </button>
              </div>
            </div>

            {/* Tambah Rombel Manual Form */}
            <form onSubmit={handleAddRombel} className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-emerald-400" />
                  <h4 className="text-xs font-bold text-slate-200">
                    Tambah Rombel Kustom
                  </h4>
                </div>
                <div className="text-[11px] text-slate-400">
                  Pratinjau: <span className="font-mono font-bold text-emerald-400">{sanitizeClass(isNaN(parseInt(newRombelGrade, 10)) ? `${newRombelGrade} ${newRombelSuffix}` : `Kelas ${newRombelGrade}-${newRombelSuffix}`)}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-end">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Tingkat Kelas:
                  </label>
                  <select
                    value={newRombelGrade}
                    onChange={(e) => setNewRombelGrade(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
                  >
                    <option value="1">Kelas 1</option>
                    <option value="2">Kelas 2</option>
                    <option value="3">Kelas 3</option>
                    <option value="4">Kelas 4</option>
                    <option value="5">Kelas 5</option>
                    <option value="6">Kelas 6</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Kode / Suffix Rombel:
                  </label>
                  <input
                    type="text"
                    value={newRombelSuffix}
                    onChange={(e) => setNewRombelSuffix(e.target.value)}
                    placeholder="Contoh: A, B, C, Tahfidz, ICP"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-medium uppercase"
                  />
                </div>

                <div>
                  <button
                    type="submit"
                    className="w-full px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambahkan Rombel</span>
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Daftar Rombel Terdaftar (Grouped by Grade) */}
          <div className="space-y-3">
            {Object.entries(classesByGrade).map(([grade, classList]) => {
              return (
                <div key={grade} className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                    <div className="flex items-center gap-2">
                      <GraduationCap className="w-4 h-4 text-emerald-400" />
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                        {grade}
                      </h4>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-semibold">
                        {classList.length} Rombel
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400">
                      Total Siswa: <strong className="text-white">{students.filter((s) => s.class.startsWith(grade)).length}</strong>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {classList.map((clsName) => {
                      const matchedRombel = managedRombels.find((r) => r.name === clsName);
                      const studentCount = students.filter((s) => s.class === clsName).length;
                      const teacher = getTeacherForClass(teachers, clsName);
                      const assignedProfile = profiles.find((p) =>
                        p.assignedClasses?.includes(clsName)
                      );

                      return (
                        <div
                          key={clsName}
                          className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 flex flex-col justify-between space-y-2 hover:border-slate-700 transition"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="text-xs font-bold text-white">
                                {clsName}
                              </span>
                              <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                                <Users className="w-3 h-3 text-slate-500" />
                                <span>{studentCount} Siswa terdaftar</span>
                              </div>
                            </div>

                            {matchedRombel && (
                              <button
                                type="button"
                                onClick={() => handleDeleteRombel(matchedRombel.id, clsName)}
                                title="Hapus rombel ini"
                                className="p-1 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 rounded-lg transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          <div className="pt-2 border-t border-slate-800/60 space-y-1 text-[10px]">
                            <div className="flex items-center justify-between text-slate-400">
                              <span>Wali Kelas:</span>
                              <span className={`font-semibold truncate max-w-[130px] ${teacher ? 'text-emerald-300' : 'text-slate-500 italic'}`}>
                                {teacher ? teacher.name : 'Belum ditentukan'}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-slate-400">
                              <span>Profil Jam:</span>
                              <span className="font-semibold text-slate-300 truncate max-w-[130px]">
                                {assignedProfile ? assignedProfile.name : 'Profil Default'}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
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
