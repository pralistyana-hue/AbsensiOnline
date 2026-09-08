import { Student, AttendanceRecord, PermissionRequest, AppSettings, HomeroomTeacher, ScanFailureLog } from '../types';
import { DEFAULT_SCHEDULE_PROFILES } from '../utils/schedule';

export const INITIAL_SETTINGS: AppSettings = {
  schoolName: 'SD Negeri 1 Nusantara',
  schoolAddress: 'Jl. Ki Hajar Dewantara No. 15, Kec. Serpong, Tangerang Selatan',
  principalName: 'Dra. Hj. Endang Rahayu, M.Pd.',
  principalNip: '19750812 199903 2 001',
  scheduleProfiles: DEFAULT_SCHEDULE_PROFILES,
  defaultSchedule: {
    name: 'Jadwal Harian Reguler',
    days: ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'SABTU'],
    entryTime: '07:00',
    cutoffTime: '07:15',
    homeTime: '12:30',
  },
  specialSchedule: {
    name: 'Jadwal Khusus Hari Jumat (Kepulangan Awal)',
    days: ['JUMAT'],
    entryTime: '07:00',
    cutoffTime: '07:15',
    homeTime: '10:45',
  },
  enableSpecialSchedule: true,
  entryTime: '07:00',
  cutoffTime: '07:15',
  homeTime: '12:30',
  lateLimitTime: '08:00',
  activeAttendanceMode: 'AUTO',
  barcodeFormat: 'BARCODE_1D',
  enableAutoWhatsAppAlerts: true,
  enableTeacherWhatsAppAlerts: true,
  waTemplateLate: 'Yth. Bpk/Ibu Orang Tua dari {NAMA} ({KELAS}), memberitahukan bahwa putra/putri Anda tiba di sekolah TERLAMBAT pada pukul {WAKTU}. Mohon bimbingannya.',
  waTemplateAbsent: 'Yth. Bpk/Ibu Orang Tua dari {NAMA} ({KELAS}), memberitahukan bahwa hingga pukul {JAM_BATAS} putra/putri Anda BELUM HADIR di sekolah tanpa keterangan (ALPA). Mohon konfirmasi ke Wali Kelas.',
  waTemplateApproved: 'Yth. Bpk/Ibu Orang Tua dari {NAMA}, pengajuan izin {JENIS} ({ALASAN}) untuk tanggal {TANGGAL} telah DISETUJUI oleh pihak SD Negeri 1 Nusantara. Terima kasih.',
  waTemplateTeacherPermAlert: 'Pemberitahuan Izin Siswa:\nYth. Bpk/Ibu {NAMA_GURU} (Wali Kelas {KELAS}), memberitahukan bahwa siswa Anda a.n. {NAMA_SISWA} (NISN: {NISN}) mengajukan izin {JENIS} ({ALASAN}) untuk tanggal {TANGGAL}. Status: {STATUS}. Mohon dicatat pada presensi kelas. Terima kasih.',
  waTemplateHome: 'Yth. Bpk/Ibu Orang Tua dari {NAMA} ({KELAS}), memberitahukan bahwa siswa telah selesai mengikuti KBM dan ABSEN PULANG pada pukul {WAKTU}. Hati-hati di jalan.',
  waTemplateNotPickedUp: 'Yth. Bpk/Ibu Orang Tua dari {NAMA} ({KELAS}), memberitahukan bahwa hingga pukul {WAKTU} putra/putri Anda BELUM DIJEMPUT / BELUM ABSEN PULANG sekolah. Mohon segera dijemput. Terima kasih.',
};

export const INITIAL_CLASSES = [
  'Kelas 1',
  'Kelas 2',
  'Kelas 3',
  'Kelas 4',
  'Kelas 5',
  'Kelas 6',
];

export const INITIAL_TEACHERS: HomeroomTeacher[] = [
  {
    id: 'tch-1',
    name: 'Anisa Rahmawati, S.Pd.',
    nip: '19880315 201402 2 004',
    phone: '6281211112222',
    assignedClass: 'Kelas 1',
    notes: 'Wali Kelas 1 (Fase A)',
  },
  {
    id: 'tch-2',
    name: 'Hendra Wijaya, S.Pd.SD',
    nip: '19850620 201101 1 008',
    phone: '6281222223333',
    assignedClass: 'Kelas 2',
    notes: 'Wali Kelas 2 (Fase A)',
  },
  {
    id: 'tch-3',
    name: 'Sri Wahyuni, M.Pd.',
    nip: '19821104 200801 2 012',
    phone: '6281233334444',
    assignedClass: 'Kelas 3',
    notes: 'Wali Kelas 3 (Fase B)',
  },
  {
    id: 'tch-4',
    name: 'Bambang Pratama, S.Pd.',
    nip: '19790412 200604 1 007',
    phone: '6281244445555',
    assignedClass: 'Kelas 4',
    notes: 'Wali Kelas 4 (Fase B)',
  },
  {
    id: 'tch-5',
    name: 'Dewi Kusuma, S.Pd.',
    nip: '19900918 201503 2 006',
    phone: '6281255556666',
    assignedClass: 'Kelas 5',
    notes: 'Wali Kelas 5 (Fase C)',
  },
  {
    id: 'tch-6',
    name: 'Ahmad Fauzi, S.Pd.I',
    nip: '19840125 200902 1 003',
    phone: '6281266667777',
    assignedClass: 'Kelas 6',
    notes: 'Wali Kelas 6 (Fase C)',
  },
];

export const INITIAL_STUDENTS: Student[] = [
  {
    id: 'std-1',
    nisn: '0151234001',
    name: 'Budi Santoso',
    class: 'Kelas 1',
    gender: 'L',
    parentPhone: '6281234567890',
    photoUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'std-2',
    nisn: '0151234002',
    name: 'Siti Aminah',
    class: 'Kelas 1',
    gender: 'P',
    parentPhone: '6281298765432',
    photoUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'std-3',
    nisn: '0151234003',
    name: 'Muhammad Rizky',
    class: 'Kelas 2',
    gender: 'L',
    parentPhone: '6281311223344',
    photoUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'std-4',
    nisn: '0151234004',
    name: 'Aisyah Putri',
    class: 'Kelas 2',
    gender: 'P',
    parentPhone: '6281355667788',
    photoUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'std-5',
    nisn: '0151234005',
    name: 'Dewa Pratama',
    class: 'Kelas 3',
    gender: 'L',
    parentPhone: '6281399887766',
    photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'std-6',
    nisn: '0151234006',
    name: 'Ahmad Dahlan',
    class: 'Kelas 3',
    gender: 'L',
    parentPhone: '6281411223344',
    photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'std-7',
    nisn: '0151234007',
    name: 'Citra Lestari',
    class: 'Kelas 4',
    gender: 'P',
    parentPhone: '6281522334455',
    photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'std-8',
    nisn: '0151234008',
    name: 'Daffa Alfarizi',
    class: 'Kelas 4',
    gender: 'L',
    parentPhone: '6281633445566',
    photoUrl: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'std-9',
    nisn: '0151234009',
    name: 'Zahra Nabila',
    class: 'Kelas 5',
    gender: 'P',
    parentPhone: '6281744556677',
    photoUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'std-10',
    nisn: '0151234010',
    name: 'Fajar Nugraha',
    class: 'Kelas 6',
    gender: 'L',
    parentPhone: '6281855667788',
    photoUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80',
  },
];

// Generate past attendance records for current month up to today
export function generateInitialAttendance(students: Student[]): AttendanceRecord[] {
  const records: AttendanceRecord[] = [];
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();

  let daysAdded = 0;
  for (let i = 1; i <= 20 && daysAdded < 10; i++) {
    const dateObj = new Date(currentYear, currentMonth, i);
    if (dateObj.getDay() === 0) continue; // SD usually Monday-Saturday or Monday-Friday
    if (dateObj > today) break;

    const dateStr = dateObj.toISOString().split('T')[0];
    daysAdded++;

    students.forEach((student, index) => {
      const seed = (index + i) % 10;
      let status: 'HADIR' | 'TERLAMBAT' | 'IZIN' | 'SAKIT' | 'ALPA' = 'HADIR';
      let time = '06:55:12';

      if (seed === 1) {
        status = 'TERLAMBAT';
        time = '07:22:45';
      } else if (seed === 2 && i % 3 === 0) {
        status = 'IZIN';
        time = '07:00:00';
      } else if (seed === 3 && i % 5 === 0) {
        status = 'SAKIT';
        time = '07:00:00';
      } else if (seed === 4 && i % 7 === 0) {
        status = 'ALPA';
        time = '-';
      } else {
        const mins = 45 + ((index * 3 + i * 2) % 25);
        time = `06:${mins < 10 ? '0' + mins : mins}:30`;
      }

      records.push({
        id: `att-${dateStr}-${student.nisn}`,
        studentId: student.id,
        nisn: student.nisn,
        studentName: student.name,
        class: student.class,
        date: dateStr,
        time: status === 'ALPA' ? '-' : time,
        status,
        type: 'MASUK',
        method: status === 'IZIN' || status === 'SAKIT' ? 'PERIZINAN_WA' : 'BARCODE',
        notes: status === 'TERLAMBAT' ? 'Terlambat 7 menit' : status === 'IZIN' ? 'Acara Keluarga' : status === 'SAKIT' ? 'Demam & Pusing' : '',
      });
    });
  }

  return records;
}

export const INITIAL_PERMISSIONS: PermissionRequest[] = [
  {
    id: 'perm-1',
    nisn: '0151234002',
    studentName: 'Siti Aminah',
    class: 'Kelas 1',
    parentPhone: '6281298765432',
    type: 'SAKIT',
    date: new Date().toISOString().split('T')[0],
    reason: 'Sakit demam tinggi dan pusing sejak semalam. Mohon izin Siti Aminah tidak dapat mengikuti pelajaran hari ini.',
    submittedAt: '06:30',
    rawMessage: 'IZIN#0151234002#Sakit demam tinggi dan pusing#2026-08-13',
    status: 'PENDING',
  },
  {
    id: 'perm-2',
    nisn: '0151234007',
    studentName: 'Citra Lestari',
    class: 'Kelas 4',
    parentPhone: '6281522334455',
    type: 'IZIN',
    date: new Date().toISOString().split('T')[0],
    reason: 'Menghadiri khitanan sepupu di luar kota.',
    submittedAt: '06:15',
    rawMessage: 'IZIN#0151234007#Khitanan sepupu di luar kota#2026-08-13',
    status: 'PENDING',
  },
];

export const INITIAL_SCAN_FAILURES: ScanFailureLog[] = [
  {
    id: 'fail-1',
    timestamp: new Date().toISOString(),
    date: new Date().toISOString().split('T')[0],
    time: '06:48:15',
    rawCode: '0151234003',
    studentId: 'std-3',
    nisn: '0151234003',
    studentName: 'Budi Santoso',
    class: 'Kelas 2',
    parentPhone: '6281311223344',
    failureReason: 'BARCODE_RUSAK',
    resolutionStatus: 'PERLU_CETAK_ULANG',
    notes: 'Kartu laminasi terkelupas dan garis barcode pudar di bagian tengah. Perlu cetak ulang kartu baru.',
    reportedBy: 'Scanner Kamera',
  },
  {
    id: 'fail-2',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    date: new Date().toISOString().split('T')[0],
    time: '06:55:40',
    rawCode: '0151234008',
    studentId: 'std-8',
    nisn: '0151234008',
    studentName: 'Dimas Anggara',
    class: 'Kelas 4',
    parentPhone: '6281788990011',
    failureReason: 'BARCODE_RUSAK',
    resolutionStatus: 'DALAM_PROSES',
    notes: 'Sudah dilaporkan wali kelas 4, kartu tergores benda tajam di dalam tas.',
    reportedBy: 'Input Manual Admin',
  },
  {
    id: 'fail-3',
    timestamp: new Date(Date.now() - 86400000).toISOString(),
    date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
    time: '07:05:22',
    rawCode: '9999999999-UNRECOGNIZED',
    failureReason: 'KODE_TIDAK_TERDAFTAR',
    resolutionStatus: 'PERLU_CETAK_ULANG',
    notes: 'Kode barcode tidak cocok dengan format NISN sekolah. Kemungkinan kartu lama atau salah cetak barcode.',
    reportedBy: 'Scanner Terminal',
  },
];


