import { Student, HomeroomTeacher, AppSettings } from '../types';
import * as XLSX from 'xlsx';

export interface BackupPayload {
  app: string;
  system: string;
  version: string;
  exportedAt: string;
  exportedTimestamp: number;
  schoolInfo: {
    schoolName: string;
    schoolAddress?: string;
    principalName: string;
    principalNip?: string;
  };
  summary: {
    totalStudents: number;
    totalTeachers: number;
    classes: string[];
  };
  students: Student[];
  teachers: HomeroomTeacher[];
}

/**
 * Downloads a complete JSON backup of Students & Homeroom Teachers
 */
export function downloadFullBackupJSON(
  students: Student[],
  teachers: HomeroomTeacher[],
  settings: AppSettings
): void {
  const dateStr = new Date().toISOString().split('T')[0];
  const timeStr = new Date().toTimeString().slice(0, 5).replace(':', '');
  const classes = Array.from(new Set([...students.map((s) => s.class), ...teachers.map((t) => t.assignedClass)])).filter(Boolean).sort();

  const payload: BackupPayload = {
    app: 'EduScan SD Presensi Barcode',
    system: 'Sistem Presensi Siswa & Manajemen Wali Kelas',
    version: '2.0',
    exportedAt: new Date().toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'medium' }),
    exportedTimestamp: Date.now(),
    schoolInfo: {
      schoolName: settings.schoolName || 'SD Negeri',
      schoolAddress: settings.schoolAddress || '-',
      principalName: settings.principalName || '-',
      principalNip: settings.principalNip || '-',
    },
    summary: {
      totalStudents: students.length,
      totalTeachers: teachers.length,
      classes,
    },
    students,
    teachers,
  };

  const jsonStr = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const sanitizedSchool = (settings.schoolName || 'SDN').replace(/[^a-zA-Z0-9]/g, '_');
  link.download = `Backup_EduScan_${sanitizedSchool}_${dateStr}_${timeStr}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exports Students data to Excel (.xlsx) / CSV with proper formatting
 */
export function downloadStudentsSpreadsheet(
  students: Student[],
  settings: AppSettings,
  format: 'xlsx' | 'csv' = 'xlsx'
): void {
  const dateStr = new Date().toISOString().split('T')[0];
  const rows = students.map((std, idx) => ({
    'No': idx + 1,
    'NISN': std.nisn,
    'Nama Lengkap Siswa': std.name,
    'Kelas': std.class,
    'Jenis Kelamin (L/P)': std.gender,
    'No. WhatsApp Orang Tua': std.parentPhone,
    'URL Foto': std.photoUrl || '',
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{
    'No': 1,
    'NISN': '0151234001',
    'Nama Lengkap Siswa': 'Contoh Siswa',
    'Kelas': 'Kelas 1-A',
    'Jenis Kelamin (L/P)': 'L',
    'No. WhatsApp Orang Tua': '6281234567890',
    'URL Foto': '',
  }]);

  ws['!cols'] = [
    { wch: 6 },
    { wch: 16 },
    { wch: 30 },
    { wch: 14 },
    { wch: 18 },
    { wch: 24 },
    { wch: 40 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Data Siswa');

  const sanitizedSchool = (settings.schoolName || 'SDN').replace(/[^a-zA-Z0-9]/g, '_');
  if (format === 'csv') {
    XLSX.writeFile(wb, `Data_Siswa_${sanitizedSchool}_${dateStr}.csv`, { bookType: 'csv' });
  } else {
    XLSX.writeFile(wb, `Data_Siswa_${sanitizedSchool}_${dateStr}.xlsx`);
  }
}

/**
 * Exports Homeroom Teachers to Excel (.xlsx) / CSV
 */
export function downloadTeachersSpreadsheet(
  teachers: HomeroomTeacher[],
  settings: AppSettings,
  format: 'xlsx' | 'csv' = 'xlsx'
): void {
  const dateStr = new Date().toISOString().split('T')[0];
  const rows = teachers.map((tch, idx) => ({
    'No': idx + 1,
    'NIP': tch.nip || '-',
    'Nama Guru Wali Kelas': tch.name,
    'Kelas Binaan': tch.assignedClass,
    'No. WhatsApp Guru': tch.phone,
    'Catatan': tch.notes || '-',
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{
    'No': 1,
    'NIP': '198501012010011001',
    'Nama Guru Wali Kelas': 'Contoh Wali Kelas, S.Pd.',
    'Kelas Binaan': 'Kelas 1-A',
    'No. WhatsApp Guru': '6281234567890',
    'Catatan': 'Wali Kelas 1-A',
  }]);

  ws['!cols'] = [
    { wch: 6 },
    { wch: 22 },
    { wch: 32 },
    { wch: 16 },
    { wch: 24 },
    { wch: 30 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Wali Kelas');

  const sanitizedSchool = (settings.schoolName || 'SDN').replace(/[^a-zA-Z0-9]/g, '_');
  if (format === 'csv') {
    XLSX.writeFile(wb, `Data_Wali_Kelas_${sanitizedSchool}_${dateStr}.csv`, { bookType: 'csv' });
  } else {
    XLSX.writeFile(wb, `Data_Wali_Kelas_${sanitizedSchool}_${dateStr}.xlsx`);
  }
}

/**
 * Template Kosong Bersih untuk Diisi dan Di-Upload ke Rumahweb
 */
export function downloadCleanTemplate(settings: AppSettings): void {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Template Siswa
  const studentTemplate = [
    {
      'NISN': '0151112201',
      'Nama Siswa': 'Contoh Siswa 1',
      'Kelas': 'Kelas 1-A',
      'Jenis Kelamin': 'L',
      'No WA Ortu': '6281234567890',
    },
    {
      'NISN': '0151112202',
      'Nama Siswa': 'Contoh Siswi 2',
      'Kelas': 'Kelas 1-A',
      'Jenis Kelamin': 'P',
      'No WA Ortu': '6281234567891',
    },
  ];
  const wsStudents = XLSX.utils.json_to_sheet(studentTemplate);
  wsStudents['!cols'] = [{ wch: 16 }, { wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsStudents, 'Template_Siswa');

  // Sheet 2: Template Wali Kelas
  const teacherTemplate = [
    {
      'NIP': '198501012010011001',
      'Nama Guru': 'Budi Hartono, S.Pd.',
      'Kelas Binaan': 'Kelas 1-A',
      'No WA': '6281211112222',
    },
    {
      'NIP': '198702022011022002',
      'Nama Guru': 'Siti Rahmawati, S.Pd.',
      'Kelas Binaan': 'Kelas 1-B',
      'No WA': '6281233334444',
    },
  ];
  const wsTeachers = XLSX.utils.json_to_sheet(teacherTemplate);
  wsTeachers['!cols'] = [{ wch: 22 }, { wch: 28 }, { wch: 16 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsTeachers, 'Template_Wali_Kelas');

  XLSX.writeFile(wb, `Template_Data_Siswa_WaliKelas_Rumahweb.xlsx`);
}

/**
 * Validates and parses JSON backup content
 */
export function parseBackupFile(jsonString: string): {
  isValid: boolean;
  error?: string;
  students?: Student[];
  teachers?: HomeroomTeacher[];
  info?: any;
} {
  try {
    const data = JSON.parse(jsonString);
    if (!data || typeof data !== 'object') {
      return { isValid: false, error: 'File bukan format JSON yang valid.' };
    }

    const students: Student[] = Array.isArray(data.students) ? data.students : [];
    const teachers: HomeroomTeacher[] = Array.isArray(data.teachers) ? data.teachers : [];

    if (students.length === 0 && teachers.length === 0) {
      return { isValid: false, error: 'File JSON tidak mengandung data siswa atau guru wali kelas yang dapat dipulihkan.' };
    }

    return {
      isValid: true,
      students,
      teachers,
      info: {
        exportedAt: data.exportedAt || 'Tidak diketahui',
        schoolName: data.schoolInfo?.schoolName || 'SD',
        totalStudents: students.length,
        totalTeachers: teachers.length,
      },
    };
  } catch (err) {
    return { isValid: false, error: 'Gagal membaca file JSON: ' + (err instanceof Error ? err.message : String(err)) };
  }
}
