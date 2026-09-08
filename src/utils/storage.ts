import { Student, AttendanceRecord, PermissionRequest, NotificationLog, AppSettings, HomeroomTeacher, ScanFailureLog } from '../types';
import { INITIAL_STUDENTS, INITIAL_SETTINGS, INITIAL_PERMISSIONS, INITIAL_TEACHERS, INITIAL_SCAN_FAILURES, generateInitialAttendance } from '../data/initialData';

const STORAGE_KEYS = {
  STUDENTS: 'absensi_students_v1',
  TEACHERS: 'absensi_teachers_v1',
  ATTENDANCE: 'absensi_records_v1',
  PERMISSIONS: 'absensi_permissions_v1',
  LOGS: 'absensi_notification_logs_v1',
  SCAN_FAILURES: 'absensi_scan_failures_v1',
  SETTINGS: 'absensi_settings_v1',
  RECENT_SCANS: 'absensi_recent_scans_cache_v1',
};

export const checkScanThrottle = (
  studentId: string,
  cooldownSeconds: number = 60
): { throttled: boolean; remainingSec: number; elapsedSec: number } => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.RECENT_SCANS);
    const cache: Record<string, number> = raw ? JSON.parse(raw) : {};
    const lastScan = cache[studentId];
    if (!lastScan) return { throttled: false, remainingSec: 0, elapsedSec: 999 };

    const elapsedSec = Math.floor((Date.now() - lastScan) / 1000);
    if (elapsedSec < cooldownSeconds) {
      return { throttled: true, remainingSec: cooldownSeconds - elapsedSec, elapsedSec };
    }
    return { throttled: false, remainingSec: 0, elapsedSec };
  } catch {
    return { throttled: false, remainingSec: 0, elapsedSec: 999 };
  }
};

export const recordScanTimestamp = (studentId: string): void => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.RECENT_SCANS);
    const cache: Record<string, number> = raw ? JSON.parse(raw) : {};
    const now = Date.now();

    // Prune entries older than 5 minutes
    const pruned: Record<string, number> = {};
    Object.entries(cache).forEach(([id, timestamp]) => {
      if (now - timestamp < 5 * 60 * 1000) {
        pruned[id] = timestamp;
      }
    });

    pruned[studentId] = now;
    localStorage.setItem(STORAGE_KEYS.RECENT_SCANS, JSON.stringify(pruned));
  } catch (err) {
    console.error('Failed to update recent scans cache:', err);
  }
};

const sanitizeClass = (cls: string): string => {
  if (!cls) return 'Kelas 1';
  // Remove suffix letters like A, B, C from Kelas 1A, 2B, etc.
  return cls.replace(/(Kelas\s*[1-6])[A-Za-z]/i, '$1').trim();
};

export const Storage = {
  getStudents(): Student[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.STUDENTS);
      if (!data) return INITIAL_STUDENTS;
      const parsed: Student[] = JSON.parse(data);
      return parsed.map((s) => ({
        ...s,
        class: sanitizeClass(s.class),
      }));
    } catch {
      return INITIAL_STUDENTS;
    }
  },

  saveStudents(students: Student[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
    } catch (e) {
      console.error('Failed to save students to localStorage', e);
    }
  },

  getTeachers(): HomeroomTeacher[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TEACHERS);
      if (!data) return INITIAL_TEACHERS;
      const parsed: HomeroomTeacher[] = JSON.parse(data);
      return parsed.map((t) => ({
        ...t,
        assignedClass: sanitizeClass(t.assignedClass),
      }));
    } catch {
      return INITIAL_TEACHERS;
    }
  },

  saveTeachers(teachers: HomeroomTeacher[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.TEACHERS, JSON.stringify(teachers));
    } catch (e) {
      console.error('Failed to save teachers to localStorage', e);
    }
  },

  getAttendance(): AttendanceRecord[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ATTENDANCE);
      if (data) {
        const records: AttendanceRecord[] = JSON.parse(data);
        return records.map((r) => ({
          ...r,
          class: sanitizeClass(r.class),
        }));
      }
      const initial = generateInitialAttendance(INITIAL_STUDENTS);
      localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(initial));
      return initial;
    } catch {
      return generateInitialAttendance(INITIAL_STUDENTS);
    }
  },

  saveAttendance(records: AttendanceRecord[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(records));
    } catch (e) {
      console.error('Failed to save attendance', e);
    }
  },

  getPermissions(): PermissionRequest[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PERMISSIONS);
      if (data) {
        const perms: PermissionRequest[] = JSON.parse(data);
        return perms.map((p) => ({
          ...p,
          class: sanitizeClass(p.class),
        }));
      }
      return INITIAL_PERMISSIONS;
    } catch {
      return INITIAL_PERMISSIONS;
    }
  },

  savePermissions(permissions: PermissionRequest[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.PERMISSIONS, JSON.stringify(permissions));
    } catch (e) {
      console.error('Failed to save permissions', e);
    }
  },

  getNotificationLogs(): NotificationLog[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.LOGS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveNotificationLogs(logs: NotificationLog[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs));
    } catch (e) {
      console.error('Failed to save notification logs', e);
    }
  },

  getScanFailureLogs(): ScanFailureLog[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SCAN_FAILURES);
      if (data) {
        return JSON.parse(data);
      }
      return INITIAL_SCAN_FAILURES;
    } catch {
      return INITIAL_SCAN_FAILURES;
    }
  },

  saveScanFailureLogs(logs: ScanFailureLog[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.SCAN_FAILURES, JSON.stringify(logs));
    } catch (e) {
      console.error('Failed to save scan failure logs', e);
    }
  },

  addScanFailureLog(log: ScanFailureLog): ScanFailureLog[] {
    try {
      const current = this.getScanFailureLogs();
      // Avoid duplicate logs for the same student on the same date within 1 hour
      const isDuplicate = current.some(
        (l) =>
          l.studentId &&
          l.studentId === log.studentId &&
          l.date === log.date &&
          Math.abs(new Date(l.timestamp).getTime() - new Date(log.timestamp).getTime()) < 3600000
      );

      if (isDuplicate) return current;

      const updated = [log, ...current];
      this.saveScanFailureLogs(updated);
      return updated;
    } catch {
      return [];
    }
  },

  getSettings(): AppSettings {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (!data) return INITIAL_SETTINGS;
      const settings: AppSettings = JSON.parse(data);
      if (settings.scheduleProfiles) {
        settings.scheduleProfiles = settings.scheduleProfiles.map((p) => ({
          ...p,
          assignedClasses: (p.assignedClasses || []).map(sanitizeClass),
        }));
      }
      return settings;
    } catch {
      return INITIAL_SETTINGS;
    }
  },

  saveSettings(settings: AppSettings): void {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save settings', e);
    }
  },

  resetAllData(): void {
    localStorage.removeItem(STORAGE_KEYS.STUDENTS);
    localStorage.removeItem(STORAGE_KEYS.TEACHERS);
    localStorage.removeItem(STORAGE_KEYS.ATTENDANCE);
    localStorage.removeItem(STORAGE_KEYS.PERMISSIONS);
    localStorage.removeItem(STORAGE_KEYS.LOGS);
    localStorage.removeItem(STORAGE_KEYS.SCAN_FAILURES);
    localStorage.removeItem(STORAGE_KEYS.SETTINGS);
  }
};
