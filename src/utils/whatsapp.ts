import { AppSettings, Student, HomeroomTeacher } from '../types';
import { getActiveSchedule, getActiveScheduleForClass } from './schedule';

/**
 * Normalizes an Indonesian phone number to standard international format without '+'
 * e.g., '08123456789' -> '628123456789'
 */
export function normalizePhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.substring(1);
  }
  return cleaned;
}

export function createWhatsAppLink(phone: string, text: string): string {
  const normalizedPhone = normalizePhoneNumber(phone);
  const encodedText = encodeURIComponent(text);
  return `https://wa.me/${normalizedPhone}?text=${encodedText}`;
}

/**
 * Find assigned Homeroom Teacher for a given class name
 */
export function getTeacherForClass(teachers: HomeroomTeacher[], className: string): HomeroomTeacher | undefined {
  if (!className || !teachers || teachers.length === 0) return undefined;
  const clean = className.trim().toLowerCase();
  return teachers.find((t) => t.assignedClass.trim().toLowerCase() === clean);
}

/**
 * Format WhatsApp alert message specifically for Homeroom Teacher when student requests absence/permission
 */
export function formatTeacherPermissionAlert(
  teacher: HomeroomTeacher,
  studentName: string,
  nisn: string,
  className: string,
  type: string,
  reason: string,
  date: string,
  status: string,
  settings: AppSettings
): string {
  const defaultTemplate =
    settings.waTemplateTeacherPermAlert ||
    'Pemberitahuan Izin Siswa:\nYth. Bpk/Ibu {NAMA_GURU} (Wali Kelas {KELAS}), memberitahukan bahwa siswa Anda a.n. {NAMA_SISWA} (NISN: {NISN}) mengajukan izin {JENIS} ({ALASAN}) untuk tanggal {TANGGAL}. Status: {STATUS}. Mohon dicatat pada presensi kelas. Terima kasih.';

  return defaultTemplate
    .replace('{NAMA_GURU}', teacher.name)
    .replace('{KELAS}', className || teacher.assignedClass)
    .replace('{NAMA_SISWA}', studentName)
    .replace('{NISN}', nisn)
    .replace('{JENIS}', type)
    .replace('{ALASAN}', reason)
    .replace('{TANGGAL}', date)
    .replace('{STATUS}', status === 'APPROVED' ? 'DISETUJUI' : status === 'REJECTED' ? 'DITOLAK' : 'MENUNGGU KONFIRMASI');
}

export function parseWhatsAppPermission(
  message: string,
  students?: Student[]
): {
  nisn?: string;
  student?: Student;
  type?: 'IZIN' | 'SAKIT';
  reason?: string;
  date?: string;
  isValid: boolean;
} {
  if (!message) return { isValid: false };

  const trimmed = message.trim();

  // Pattern 1: Structured format IZIN#NISN#ALASAN#TANGGAL or SAKIT#NISN#ALASAN#TANGGAL
  if (trimmed.includes('#')) {
    const parts = trimmed.split('#').map(p => p.trim());
    if (parts.length >= 3) {
      const typeHeader = parts[0].toUpperCase();
      const type: 'IZIN' | 'SAKIT' = typeHeader.includes('SAKIT') ? 'SAKIT' : 'IZIN';
      const nisn = parts[1];
      const reason = parts[2];
      const date = parts[3] || new Date().toISOString().split('T')[0];

      let matchedStudent: Student | undefined;
      if (students && students.length > 0) {
        matchedStudent = students.find((s) => s.nisn === nisn || s.id === nisn);
      }

      if (nisn && reason) {
        return { nisn, student: matchedStudent, type, reason, date, isValid: true };
      }
    }
  }

  // Pattern 2: Detect NISN number sequence (8 to 12 digits, or starting with 01)
  const nisnMatch = trimmed.match(/NISN[:\s]*([0-9]{8,12})/i) || trimmed.match(/\b(0[0-9]{9,11})\b/) || trimmed.match(/\b([0-9]{10})\b/);
  
  // Sickness keywords vs Permission keywords
  const sicknessKeywords = ['sakit', 'demam', 'panas', 'flu', 'batuk', 'pusing', 'mual', 'muntah', 'diare', 'rawat', 'opname', 'dokter', 'klinik', 'puskesmas', 'rsud', 'cacar', 'tifus', 'tipes', 'gigi'];
  const permissionKeywords = ['izin', 'halangan', 'acara', 'keluarga', 'kondangan', 'khitanan', 'sunatan', 'bepergian', 'pulang kampung', 'ziarah', 'lomba', 'keperluan'];

  const lowerText = trimmed.toLowerCase();
  const hasSickness = sicknessKeywords.some((kw) => lowerText.includes(kw));
  const hasPermission = permissionKeywords.some((kw) => lowerText.includes(kw));
  const type: 'IZIN' | 'SAKIT' = hasSickness ? 'SAKIT' : 'IZIN';

  let detectedNisn = nisnMatch ? nisnMatch[1] : '';
  let matchedStudent: Student | undefined;

  if (students && students.length > 0) {
    if (detectedNisn) {
      matchedStudent = students.find((s) => s.nisn === detectedNisn || s.id === detectedNisn);
    }
    
    // Fallback: If no NISN found, search by student name in message
    if (!matchedStudent) {
      const foundByName = students.find((s) => {
        const studentNameLower = s.name.toLowerCase();
        return lowerText.includes(studentNameLower) || (s.name.split(' ').length > 1 && lowerText.includes(s.name.split(' ')[0].toLowerCase() + ' ' + s.name.split(' ')[1].toLowerCase()));
      });
      if (foundByName) {
        matchedStudent = foundByName;
        detectedNisn = foundByName.nisn;
      }
    }
  }

  // Date detection (YYYY-MM-DD or DD/MM/YYYY or DD-MM-YYYY)
  let detectedDate = new Date().toISOString().split('T')[0];
  const dateMatchIso = trimmed.match(/\b(20[2-9][0-9]-[0-1][0-9]-[0-3][0-9])\b/);
  const dateMatchIndo = trimmed.match(/\b([0-3]?[0-9])[-/]([0-1]?[0-9])[-/](20[2-9][0-9])\b/);

  if (dateMatchIso) {
    detectedDate = dateMatchIso[1];
  } else if (dateMatchIndo) {
    const day = dateMatchIndo[1].padStart(2, '0');
    const month = dateMatchIndo[2].padStart(2, '0');
    const year = dateMatchIndo[3];
    detectedDate = `${year}-${month}-${day}`;
  }

  if (detectedNisn || matchedStudent) {
    return {
      nisn: detectedNisn || matchedStudent?.nisn,
      student: matchedStudent,
      type,
      reason: trimmed,
      date: detectedDate,
      isValid: true,
    };
  }

  return { isValid: false };
}

export function formatLateMessage(
  student: Student,
  time: string,
  settings: AppSettings
): string {
  return settings.waTemplateLate
    .replace('{NAMA}', student.name)
    .replace('{NISN}', student.nisn)
    .replace('{KELAS}', student.class)
    .replace('{WAKTU}', time);
}

export function formatAbsentMessage(
  student: Student,
  settings: AppSettings
): string {
  const activeSched = getActiveScheduleForClass(settings, student.class);
  const cutoff = activeSched.cutoffTime || settings.cutoffTime;
  return settings.waTemplateAbsent
    .replace('{NAMA}', student.name)
    .replace('{NISN}', student.nisn)
    .replace('{KELAS}', student.class)
    .replace('{JAM_BATAS}', cutoff);
}

export function formatApprovedMessage(
  student: Student,
  type: string,
  reason: string,
  date: string,
  settings: AppSettings
): string {
  return settings.waTemplateApproved
    .replace('{NAMA}', student.name)
    .replace('{NISN}', student.nisn)
    .replace('{KELAS}', student.class)
    .replace('{JENIS}', type)
    .replace('{ALASAN}', reason)
    .replace('{TANGGAL}', date);
}

export function formatHomeMessage(
  student: Student,
  time: string,
  settings: AppSettings
): string {
  return settings.waTemplateHome
    .replace('{NAMA}', student.name)
    .replace('{NISN}', student.nisn)
    .replace('{KELAS}', student.class)
    .replace('{WAKTU}', time);
}

export function formatNotPickedUpMessage(
  student: Student,
  time: string,
  settings: AppSettings
): string {
  return settings.waTemplateNotPickedUp
    .replace('{NAMA}', student.name)
    .replace('{NISN}', student.nisn)
    .replace('{KELAS}', student.class)
    .replace('{WAKTU}', time);
}

export function getParentTemplateMessage(nisn: string, type: 'IZIN' | 'SAKIT', reason: string, dateStr: string): string {
  return `${type}#${nisn}#${reason}#${dateStr}`;
}

/**
 * Sends WhatsApp message directly to Self-Hosted Baileys Bot REST API Endpoint
 */
export async function sendCustomWAMessage(
  phone: string,
  message: string,
  settings: AppSettings
): Promise<{ success: boolean; error?: string }> {
  const endpoint = settings.waGatewayUrl || 'http://192.168.18.155:5000/send-message';
  const token = settings.waGatewayToken || '';

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        target: normalizePhoneNumber(phone),
        number: normalizePhoneNumber(phone),
        phone: normalizePhoneNumber(phone),
        message: message,
      }),
    });

    if (response.ok) {
      return { success: true };
    }

    const data = await response.json().catch(() => ({}));
    return {
      success: false,
      error: data.message || `Gagal dari server bot WA (HTTP ${response.status})`,
    };
  } catch (error: any) {
    console.error('Error sending WA message via custom endpoint:', error);
    let errorMsg = error.message || 'Terjadi kesalahan saat menghubungi server WA Gateway.';
    if (error.name === 'TypeError' && (error.message.includes('fetch') || error.message.includes('Failed to fetch'))) {
      if (endpoint.startsWith('http://')) {
        errorMsg = `Aplikasi ini berjalan di HTTPS (Cloud), sedangkan endpoint Anda adalah HTTP (${endpoint}). Browser memblokir koneksi Mixed Content. Solusi: Gunakan LocalTunnel (npx localtunnel --port 5000) untuk mendapatkan URL HTTPS gratis!`;
      } else {
        errorMsg = `Tidak dapat menghubungi ${endpoint}. Pastikan server bot 'node server.js' di PC Piket sedang berjalan.`;
      }
    }
    return { success: false, error: errorMsg };
  }
}


