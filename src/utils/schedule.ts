import { AppSettings, DailySchedule, DayOfWeek, ScheduleProfile } from '../types';

export const DAY_KEYS: DayOfWeek[] = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];

export const ALL_DAYS: { key: DayOfWeek; label: string; short: string }[] = [
  { key: 'SENIN', label: 'Senin', short: 'Sen' },
  { key: 'SELASA', label: 'Selasa', short: 'Sel' },
  { key: 'RABU', label: 'Rabu', short: 'Rab' },
  { key: 'KAMIS', label: 'Kamis', short: 'Kam' },
  { key: 'JUMAT', label: 'Jumat', short: 'Jum' },
  { key: 'SABTU', label: 'Sabtu', short: 'Sab' },
  { key: 'MINGGU', label: 'Minggu', short: 'Min' },
];

export const DAY_NAMES: Record<DayOfWeek, string> = {
  SENIN: 'Senin',
  SELASA: 'Selasa',
  RABU: 'Rabu',
  KAMIS: 'Kamis',
  JUMAT: 'Jumat',
  SABTU: 'Sabtu',
  MINGGU: 'Minggu',
};

export const DEFAULT_SCHEDULE_PROFILES: ScheduleProfile[] = [
  {
    id: 'prof-sd-bawah',
    name: 'Kelas Bawah (Kelas 1 - 2)',
    isDefault: false,
    assignedClasses: ['Kelas 1', 'Kelas 2'],
    regularSchedule: {
      name: 'Reguler Kelas Bawah',
      days: ['SENIN', 'SELASA', 'RABU', 'KAMIS'],
      entryTime: '07:00',
      cutoffTime: '07:15',
      homeTime: '10:30',
    },
    enableSpecialSchedule: true,
    specialSchedule: {
      name: 'Jumat Senam & Kepulangan Pagi',
      days: ['JUMAT'],
      entryTime: '07:00',
      cutoffTime: '07:15',
      homeTime: '10:00',
    },
  },
  {
    id: 'prof-sd-atas',
    name: 'Kelas Atas (Kelas 3 - 6)',
    isDefault: true,
    assignedClasses: ['Kelas 3', 'Kelas 4', 'Kelas 5', 'Kelas 6'],
    regularSchedule: {
      name: 'Reguler Kelas Atas',
      days: ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'SABTU'],
      entryTime: '07:00',
      cutoffTime: '07:15',
      homeTime: '12:30',
    },
    enableSpecialSchedule: true,
    specialSchedule: {
      name: 'Jumat Khusus Kepulangan Awal',
      days: ['JUMAT'],
      entryTime: '07:00',
      cutoffTime: '07:15',
      homeTime: '10:45',
    },
  },
];

export interface ActiveScheduleResult {
  profileId: string;
  profileName: string;
  scheduleName: string;
  isSpecial: boolean;
  isSchoolDay: boolean;
  currentDayKey: DayOfWeek;
  currentDayName: string;
  entryTime: string;
  cutoffTime: string;
  homeTime: string;
  activeSchedule: DailySchedule;
}

export function getCurrentDayKey(date: Date = new Date()): DayOfWeek {
  const dayIndex = date.getDay(); // 0 = Minggu, 1 = Senin, ..., 6 = Sabtu
  return DAY_KEYS[dayIndex];
}

/**
 * Normalizes schedule profiles from AppSettings, guaranteeing at least one valid profile
 */
export function getNormalizedProfiles(settings: AppSettings): ScheduleProfile[] {
  if (settings.scheduleProfiles && settings.scheduleProfiles.length > 0) {
    return settings.scheduleProfiles;
  }

  // Synthesize from legacy settings if available
  const legacyDefault = settings.defaultSchedule || {
    name: 'Jadwal Harian Reguler',
    days: ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'SABTU'] as DayOfWeek[],
    entryTime: settings.entryTime || '07:00',
    cutoffTime: settings.cutoffTime || '07:15',
    homeTime: settings.homeTime || '12:30',
  };

  const legacySpecial = settings.specialSchedule || {
    name: 'Jadwal Khusus Hari Jumat',
    days: ['JUMAT'] as DayOfWeek[],
    entryTime: '07:00',
    cutoffTime: '07:15',
    homeTime: '10:45',
  };

  return [
    {
      id: 'prof-default',
      name: 'Profil Standar Sekolah',
      isDefault: true,
      assignedClasses: [],
      regularSchedule: legacyDefault,
      enableSpecialSchedule: settings.enableSpecialSchedule ?? true,
      specialSchedule: legacySpecial,
    },
  ];
}

/**
 * Returns the matching ScheduleProfile for a given class name
 */
export function getProfileForClass(settings: AppSettings, className?: string): ScheduleProfile {
  const profiles = getNormalizedProfiles(settings);

  if (className && className !== 'ALL') {
    const trimmed = className.trim().toLowerCase();
    const cleanCls = trimmed.replace(/([1-6])[a-z]/i, '$1');

    // 1. Direct match in assignedClasses
    const matched = profiles.find((p) =>
      p.assignedClasses &&
      p.assignedClasses.some((c) => {
        const cLower = c.trim().toLowerCase();
        const cClean = cLower.replace(/([1-6])[a-z]/i, '$1');
        return cLower === trimmed || cClean === cleanCls || cLower.includes(trimmed) || trimmed.includes(cLower);
      })
    );
    if (matched) return matched;
  }

  // 2. Default profile
  const defaultProf = profiles.find((p) => p.isDefault);
  if (defaultProf) return defaultProf;

  // 3. Fallback to first profile
  return profiles[0];
}

/**
 * Returns the effective active schedule for a specific class on a given date
 */
export function getActiveScheduleForClass(
  settings: AppSettings,
  className?: string,
  date: Date = new Date()
): ActiveScheduleResult {
  const dayKey = getCurrentDayKey(date);
  const dayName = DAY_NAMES[dayKey] || 'Hari Ini';
  const profile = getProfileForClass(settings, className);

  const regularSched = profile.regularSchedule || {
    name: 'Jadwal Reguler',
    days: ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'SABTU'] as DayOfWeek[],
    entryTime: '07:00',
    cutoffTime: '07:15',
    homeTime: '12:30',
  };

  const specialSched = profile.specialSchedule || {
    name: 'Jadwal Khusus',
    days: ['JUMAT'] as DayOfWeek[],
    entryTime: '07:00',
    cutoffTime: '07:15',
    homeTime: '10:45',
  };

  const isSpecialActive = profile.enableSpecialSchedule && specialSched.days && specialSched.days.includes(dayKey);

  // 1. Check Special Schedule for today
  if (isSpecialActive) {
    return {
      profileId: profile.id,
      profileName: profile.name,
      scheduleName: specialSched.name || 'Jadwal Khusus',
      isSpecial: true,
      isSchoolDay: true,
      currentDayKey: dayKey,
      currentDayName: dayName,
      entryTime: specialSched.entryTime || '07:00',
      cutoffTime: specialSched.cutoffTime || '07:15',
      homeTime: specialSched.homeTime || '10:45',
      activeSchedule: specialSched,
    };
  }

  // 2. Check Regular Schedule for today
  const isRegularActive = regularSched.days && regularSched.days.includes(dayKey);
  if (isRegularActive) {
    return {
      profileId: profile.id,
      profileName: profile.name,
      scheduleName: regularSched.name || 'Jadwal Reguler',
      isSpecial: false,
      isSchoolDay: true,
      currentDayKey: dayKey,
      currentDayName: dayName,
      entryTime: regularSched.entryTime || '07:00',
      cutoffTime: regularSched.cutoffTime || '07:15',
      homeTime: regularSched.homeTime || '12:30',
      activeSchedule: regularSched,
    };
  }

  // 3. Fallback for non-school day (e.g. Sunday / holiday)
  return {
    profileId: profile.id,
    profileName: profile.name,
    scheduleName: regularSched.name || 'Jadwal Reguler',
    isSpecial: false,
    isSchoolDay: false,
    currentDayKey: dayKey,
    currentDayName: dayName,
    entryTime: regularSched.entryTime || '07:00',
    cutoffTime: regularSched.cutoffTime || '07:15',
    homeTime: regularSched.homeTime || '12:30',
    activeSchedule: regularSched,
  };
}

export interface ProfileActiveStatus {
  profileId: string;
  profileName: string;
  assignedClasses: string[];
  scheduleResult: ActiveScheduleResult;
  isHomeWindow: boolean;
  statusLabel: string;
  statusColor: 'emerald' | 'amber' | 'sky' | 'slate';
}

/**
 * Returns the active status for all configured profiles running concurrently today
 */
export function getAllConcurrentProfilesStatus(
  settings: AppSettings,
  date: Date = new Date()
): ProfileActiveStatus[] {
  const profiles = getNormalizedProfiles(settings);
  const currentMins = date.getHours() * 60 + date.getMinutes();

  return profiles.map((prof) => {
    const assigned = prof.assignedClasses || [];
    const repClass = assigned[0] || undefined;
    const schedResult = getActiveScheduleForClass(settings, repClass, date);

    const effectiveHome = schedResult.homeTime || '12:00';
    const [hHome, mHome] = effectiveHome.split(':').map(Number);
    const homeMins = hHome * 60 + mHome;

    const [hCutoff, mCutoff] = (schedResult.cutoffTime || '07:15').split(':').map(Number);
    const cutoffMins = hCutoff * 60 + mCutoff;

    const [hEntry, mEntry] = (schedResult.entryTime || '07:00').split(':').map(Number);
    const entryMins = hEntry * 60 + mEntry;

    // Home window starts 60 mins before scheduled homeTime until 180 mins after
    const homeStartMins = homeMins - 60;
    const homeEndMins = homeMins + 180;

    let isHomeWindow = false;
    let statusLabel = 'KBM Berlangsung';
    let statusColor: 'emerald' | 'amber' | 'sky' | 'slate' = 'emerald';

    if (!schedResult.isSchoolDay) {
      statusLabel = 'Hari Libur';
      statusColor = 'slate';
    } else if (currentMins >= homeStartMins && currentMins <= homeEndMins) {
      isHomeWindow = true;
      statusLabel = 'Jam Pulang Aktif';
      statusColor = 'sky';
    } else if (currentMins > homeEndMins) {
      statusLabel = 'Selesai / Pulang';
      statusColor = 'slate';
    } else if (currentMins <= cutoffMins + 15) {
      statusLabel = 'Jam Masuk Presensi';
      statusColor = 'emerald';
    } else {
      statusLabel = 'KBM Aktif di Kelas';
      statusColor = 'amber';
    }

    return {
      profileId: prof.id,
      profileName: prof.name,
      assignedClasses: assigned,
      scheduleResult: schedResult,
      isHomeWindow,
      statusLabel,
      statusColor,
    };
  });
}

/**
 * Returns the effective schedule for general/default use
 */
export function getActiveSchedule(settings: AppSettings, date: Date = new Date()): ActiveScheduleResult {
  return getActiveScheduleForClass(settings, undefined, date);
}
