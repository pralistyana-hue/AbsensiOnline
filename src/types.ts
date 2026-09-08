export type AttendanceStatus = 'HADIR' | 'TERLAMBAT' | 'IZIN' | 'SAKIT' | 'ALPA';
export type AttendanceType = 'MASUK' | 'PULANG';

export type DayOfWeek = 'SENIN' | 'SELASA' | 'RABU' | 'KAMIS' | 'JUMAT' | 'SABTU' | 'MINGGU';

export interface DailySchedule {
  name: string; // Nama model jadwal (e.g. "Jadwal Reguler", "Jadwal Khusus Jumat")
  days: DayOfWeek[]; // Daftar hari berlaku (e.g. ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'SABTU'])
  entryTime: string; // Jam Masuk (e.g., "07:00")
  cutoffTime: string; // Jam Batas Terlambat (e.g., "07:15")
  homeTime: string; // Jam Pulang (e.g., "12:30")
}

export interface ScheduleProfile {
  id: string; // Unique ID (e.g., 'prof-1')
  name: string; // Nama profil (e.g., 'Kelas 1 - 2 (Fase A)', 'Kelas 3 - 6 (Fase B & C)')
  isDefault?: boolean; // Profil default jika kelas tidak ditentukan
  assignedClasses: string[]; // Daftar kelas yang masuk profil ini (e.g., ['Kelas 1A', 'Kelas 1B', 'Kelas 2A'])
  
  // Model 1: Jadwal Reguler
  regularSchedule: DailySchedule;

  // Model 2: Menu Jam Khusus (misal: Hari Jumat kepulangan awal atau hari tertentu)
  enableSpecialSchedule: boolean;
  specialSchedule: DailySchedule;
}

export interface Student {
  id: string;
  nisn: string;
  name: string;
  class: string;
  gender: 'L' | 'P';
  parentPhone: string; // WhatsApp number e.g., "6281234567890"
  photoUrl?: string;
}

export interface HomeroomTeacher {
  id: string;
  name: string; // Nama guru beserta gelar, e.g. "Anisa Rahmawati, S.Pd."
  nip?: string; // NIP guru, e.g. "19880315 201402 2 004"
  phone: string; // Nomor WhatsApp Wali Kelas, e.g. "6281211112222"
  assignedClass: string; // Kelas yang diampu, e.g. "Kelas 1"
  notes?: string;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  nisn: string;
  studentName: string;
  class: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm:ss
  status: AttendanceStatus;
  type?: AttendanceType; // 'MASUK' or 'PULANG'
  notes?: string;
  method: 'BARCODE' | 'MANUAL' | 'PERIZINAN_WA';
}

export interface PermissionRequest {
  id: string;
  nisn: string;
  studentName: string;
  class: string;
  parentPhone: string;
  type: 'IZIN' | 'SAKIT';
  date: string; // YYYY-MM-DD
  reason: string;
  submittedAt: string; // ISO string or time
  rawMessage?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export interface NotificationLog {
  id: string;
  studentId: string;
  studentName: string;
  parentPhone: string;
  type: 'LATE' | 'ABSENT' | 'PERMISSION_APPROVED' | 'PULANG' | 'NOT_PICKED_UP' | 'PERMIT';
  message: string;
  sentAt: string;
  status: 'SENT' | 'FAILED' | 'QUEUED';
}

export type ScanFailureReason =
  | 'BARCODE_RUSAK' // Barcode fisik pudar / sobek / tergores
  | 'TIDAK_TERBACA_KAMERA' // Kamera tidak dapat mendeteksi garis barcode
  | 'KODE_TIDAK_TERDAFTAR' // Barcode terbaca tapi NISN/ID tidak ada di database
  | 'KARTU_HILANG_TERTINGGAL' // Kartu tidak dibawa atau hilang
  | 'FORMAT_TIDAK_VALID' // Format barcode rusak / tidak standar
  | 'MANUAL_LAPORAN'; // Laporan manual guru / admin

export type CardResolutionStatus =
  | 'PERLU_CETAK_ULANG' // Butuh cetak ulang kartu barcode baru
  | 'DALAM_PROSES' // Sedang dalam proses cetak
  | 'SELESAI'; // Selesai / kartu baru telah diserahkan ke siswa

export interface ScanFailureLog {
  id: string;
  timestamp: string; // Waktu kejadian
  date: string; // YYYY-MM-DD
  time: string; // HH:mm:ss
  rawCode: string; // Kode mentah yang terbaca atau dicari
  studentId?: string;
  nisn?: string;
  studentName?: string;
  class?: string;
  parentPhone?: string;
  failureReason: ScanFailureReason;
  resolutionStatus: CardResolutionStatus;
  notes?: string;
  reportedBy?: string; // 'Scanner Kamera', 'Scanner HP', 'Input Manual Admin', 'Wali Kelas'
}

export interface AppSettings {
  schoolName: string;
  schoolAddress: string;
  principalName: string;
  principalNip: string;
  
  // Multi Schedule Profiles
  scheduleProfiles?: ScheduleProfile[];

  // Legacy fallback fields for backward compatibility
  defaultSchedule?: DailySchedule;
  specialSchedule?: DailySchedule;
  enableSpecialSchedule?: boolean;
  entryTime: string; // Jam Masuk (e.g., "07:00")
  cutoffTime: string; // Jam Batas Terlambat (e.g., "07:15")
  homeTime: string; // Jam Pulang SD (e.g., "12:00")
  lateLimitTime: string; // e.g., "08:00"
  activeAttendanceMode: 'MASUK' | 'PULANG' | 'AUTO';
  barcodeFormat: 'BARCODE_1D' | 'QR_CODE' | 'BOTH';
  enableAutoWhatsAppAlerts: boolean;
  enableTeacherWhatsAppAlerts?: boolean;
  waGatewayToken?: string;
  waGatewayUrl?: string;
  waTemplateLate: string;
  waTemplateAbsent: string;
  waTemplateApproved: string;
  waTemplateTeacherPermAlert?: string;
  waTemplateHome: string;
  waTemplateNotPickedUp: string;
}

export type ActiveTab =
  | 'scanner'
  | 'dashboard'
  | 'recap'
  | 'permissions'
  | 'scan_failures'
  | 'students'
  | 'batch_import'
  | 'notifications'
  | 'wa_gateway'
  | 'settings'
  | 'help';

