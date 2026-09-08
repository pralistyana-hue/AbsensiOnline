import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AttendanceRecord, Student, AppSettings, ScanFailureLog } from '../types';
import { generate1DBarcodeDataUrl } from './barcodeGenerator';
import { generateStudentQRCode } from './qrGenerator';

export function exportToExcel(
  records: AttendanceRecord[],
  students: Student[],
  monthYearStr: string, // e.g. "2026-08" or custom period
  className: string
) {
  exportToExcelFlexible(
    records,
    students,
    monthYearStr,
    (date) => date.startsWith(monthYearStr),
    className
  );
}

export function exportToExcelFlexible(
  records: AttendanceRecord[],
  students: Student[],
  periodLabel: string,
  dateFilterFn: (date: string) => boolean,
  className: string
) {
  const filteredStudents = className === 'ALL'
    ? students
    : students.filter(s => s.class === className);

  // Group records by student
  const studentStats = filteredStudents.map((std, idx) => {
    const stdRecords = records.filter(r => r.studentId === std.id && dateFilterFn(r.date));
    const hadir = stdRecords.filter(r => r.status === 'HADIR').length;
    const terlambat = stdRecords.filter(r => r.status === 'TERLAMBAT').length;
    const izin = stdRecords.filter(r => r.status === 'IZIN').length;
    const sakit = stdRecords.filter(r => r.status === 'SAKIT').length;
    const alpa = stdRecords.filter(r => r.status === 'ALPA').length;
    const totalDays = stdRecords.length || 1;
    const rate = Math.round(((hadir + terlambat) / totalDays) * 100);

    return {
      'No': idx + 1,
      'NISN': std.nisn,
      'Nama Siswa': std.name,
      'Kelas': std.class,
      'No. HP Ortu': std.parentPhone,
      'Hadir (H)': hadir,
      'Terlambat (T)': terlambat,
      'Izin (I)': izin,
      'Sakit (S)': sakit,
      'Alpa (A)': alpa,
      'Persentase Kehadiran': `${rate}%`,
    };
  });

  // Detailed Log
  const detailedLogs = records
    .filter(r => dateFilterFn(r.date) && (className === 'ALL' || r.class === className))
    .map((r, idx) => ({
      'No': idx + 1,
      'Tanggal': r.date,
      'Waktu Scan': r.time,
      'NISN': r.nisn,
      'Nama Siswa': r.studentName,
      'Kelas': r.class,
      'Status': r.status,
      'Metode': r.method,
      'Keterangan': r.notes || '-',
    }));

  const wb = XLSX.utils.book_new();
  const wsSummary = XLSX.utils.json_to_sheet(studentStats);
  const wsDetails = XLSX.utils.json_to_sheet(detailedLogs);

  // Set column widths
  wsSummary['!cols'] = [
    { wch: 5 },  // No
    { wch: 14 }, // NISN
    { wch: 25 }, // Nama
    { wch: 12 }, // Kelas
    { wch: 16 }, // HP Ortu
    { wch: 10 }, // H
    { wch: 12 }, // T
    { wch: 10 }, // I
    { wch: 10 }, // S
    { wch: 10 }, // A
    { wch: 18 }, // %
  ];

  XLSX.utils.book_append_sheet(wb, wsSummary, 'Rekap Kehadiran');
  XLSX.utils.book_append_sheet(wb, wsDetails, 'Log Detail Presensi');

  const safePeriod = periodLabel.replace(/[/\\?%*:|"<>]/g, '_');
  const fileName = `Rekap_Presensi_${className}_${safePeriod}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

export function exportToPDF(
  records: AttendanceRecord[],
  students: Student[],
  monthYearStr: string, // e.g. "2026-08"
  className: string,
  settings: AppSettings
) {
  exportToPDFFlexible(
    records,
    students,
    monthYearStr,
    (date) => date.startsWith(monthYearStr),
    className,
    settings
  );
}

export function exportToPDFFlexible(
  records: AttendanceRecord[],
  students: Student[],
  periodLabel: string,
  dateFilterFn: (date: string) => boolean,
  className: string,
  settings: AppSettings
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const filteredStudents = className === 'ALL'
    ? students
    : students.filter(s => s.class === className);

  // School Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(settings.schoolName.toUpperCase(), 105, 18, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(settings.schoolAddress, 105, 24, { align: 'center' });
  doc.text('Aplikasi Presensi Barcode & Notifikasi Real-Time', 105, 29, { align: 'center' });

  // Line Divider
  doc.setLineWidth(0.8);
  doc.line(14, 33, 196, 33);
  doc.setLineWidth(0.2);
  doc.line(14, 34, 196, 34);

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('LAPORAN REKAPITULASI KEHADIRAN SISWA', 105, 42, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Periode: ${periodLabel}   |   Kelas: ${className === 'ALL' ? 'Semua Kelas' : className}`, 105, 48, { align: 'center' });

  // Table Data Preparation
  const tableData = filteredStudents.map((std, idx) => {
    const stdRecords = records.filter(r => r.studentId === std.id && dateFilterFn(r.date));
    const hadir = stdRecords.filter(r => r.status === 'HADIR').length;
    const terlambat = stdRecords.filter(r => r.status === 'TERLAMBAT').length;
    const izin = stdRecords.filter(r => r.status === 'IZIN').length;
    const sakit = stdRecords.filter(r => r.status === 'SAKIT').length;
    const alpa = stdRecords.filter(r => r.status === 'ALPA').length;
    const totalDays = stdRecords.length || 1;
    const rate = Math.round(((hadir + terlambat) / totalDays) * 100);

    return [
      idx + 1,
      std.nisn,
      std.name,
      std.class,
      hadir,
      terlambat,
      izin,
      sakit,
      alpa,
      `${rate}%`,
    ];
  });

  // Render Table
  autoTable(doc, {
    startY: 54,
    head: [['No', 'NISN', 'Nama Siswa', 'Kelas', 'H', 'T', 'I', 'S', 'A', '% Hadir']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'center', cellWidth: 26 },
      2: { halign: 'left' },
      3: { halign: 'center', cellWidth: 22 },
      4: { halign: 'center', cellWidth: 12 },
      5: { halign: 'center', cellWidth: 12 },
      6: { halign: 'center', cellWidth: 12 },
      7: { halign: 'center', cellWidth: 12 },
      8: { halign: 'center', cellWidth: 12 },
      9: { halign: 'center', cellWidth: 20 },
    },
    styles: {
      fontSize: 9,
      cellPadding: 2.5,
    },
  });

  // Footer Signatures
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finalY = (doc as any).lastAutoTable.finalY + 15 || 220;
  
  if (finalY < 240) {
    const todayStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Dicetak pada: ${todayStr}`, 14, finalY);

    // Wali Kelas Signature
    doc.text('Mengetahui,', 140, finalY);
    doc.text('Kepala Sekolah / Wali Kelas', 140, finalY + 5);
    doc.text('( .................................... )', 140, finalY + 28);
    doc.text('NIP. ................................', 140, finalY + 33);
  }

  const safePeriod = periodLabel.replace(/[/\\?%*:|"<>]/g, '_');
  doc.save(`Laporan_Absensi_${className}_${safePeriod}.pdf`);
}

/**
 * Export Permission Requests List to PDF
 */
export function exportPermissionsToPDF(
  permissions: import('../types').PermissionRequest[],
  settings: AppSettings,
  filterDescription: string = 'Semua Data Perizinan'
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // School Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(settings.schoolName.toUpperCase(), 105, 18, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(settings.schoolAddress, 105, 24, { align: 'center' });
  doc.text('Rekapitulasi Izin & Sakit Siswa (WhatsApp Gateway)', 105, 29, { align: 'center' });

  // Line Divider
  doc.setLineWidth(0.8);
  doc.line(14, 33, 196, 33);
  doc.setLineWidth(0.2);
  doc.line(14, 34, 196, 34);

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('DAFTAR PERMOHONAN IZIN & SAKIT SISWA', 105, 42, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Filter: ${filterDescription}   |   Total: ${permissions.length} Pengajuan`, 105, 48, { align: 'center' });

  const tableData = permissions.map((p, idx) => [
    idx + 1,
    p.date,
    p.studentName,
    p.class,
    p.type,
    p.reason,
    p.parentPhone,
    p.status === 'APPROVED' ? 'Disetujui' : p.status === 'REJECTED' ? 'Ditolak' : 'Menunggu',
  ]);

  autoTable(doc, {
    startY: 54,
    head: [['No', 'Tanggal', 'Nama Siswa', 'Kelas', 'Jenis', 'Alasan / Pesan Ortu', 'No. WA Ortu', 'Status']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 118, 110], // teal-700
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { halign: 'center', cellWidth: 22 },
      2: { halign: 'left', cellWidth: 32 },
      3: { halign: 'center', cellWidth: 16 },
      4: { halign: 'center', cellWidth: 14 },
      5: { halign: 'left' },
      6: { halign: 'center', cellWidth: 26 },
      7: { halign: 'center', cellWidth: 20 },
    },
    styles: {
      fontSize: 8.5,
      cellPadding: 2.5,
    },
  });

  // Footer Signatures
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finalY = (doc as any).lastAutoTable.finalY + 15 || 220;
  if (finalY < 240) {
    const todayStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Dicetak pada: ${todayStr}`, 14, finalY);

    doc.text('Petugas Kesiswaan,', 140, finalY);
    doc.text('( .................................... )', 140, finalY + 28);
  }

  doc.save(`Laporan_Perizinan_Siswa_${Date.now()}.pdf`);
}

/**
 * Generate PDF for Student ID Cards with Barcode 1D / QR Code
 */
export async function exportStudentCardsToPDF(
  students: Student[],
  settings: AppSettings,
  barcodeStyle: '1D' | 'QR' | 'BOTH' = '1D'
) {
  if (students.length === 0) return;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // A4 dimensions: 210mm x 297mm
  // Card dimensions: 85mm x 54mm (Standard CR80 ID Card)
  // Grid layout: 2 columns, 4 rows (8 cards per A4 page)
  const cardW = 85;
  const cardH = 54;
  const marginX = 14;
  const marginY = 12;
  const gapX = 12;
  const gapY = 8;
  const cardsPerPage = 8;

  for (let i = 0; i < students.length; i++) {
    const std = students[i];
    const cardOnPage = i % cardsPerPage;

    if (i > 0 && cardOnPage === 0) {
      doc.addPage('a4', 'portrait');
    }

    const col = cardOnPage % 2; // 0 or 1
    const row = Math.floor(cardOnPage / 2); // 0, 1, 2, 3

    const x = marginX + col * (cardW + gapX);
    const y = marginY + row * (cardH + gapY);

    // 1. Draw Card Outer Border & Background
    doc.setDrawColor(30, 41, 59); // slate-800
    doc.setFillColor(248, 250, 252); // slate-50 background for card
    doc.roundedRect(x, y, cardW, cardH, 3, 3, 'FD');

    // 2. Draw Card Header
    doc.setFillColor(15, 23, 42); // slate-900 header
    doc.roundedRect(x, y, cardW, 11, 3, 3, 'F');
    doc.rect(x, y + 8, cardW, 3, 'F');

    // Header Text
    doc.setTextColor(245, 158, 11); // amber-500
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.text('KARTU PRESENSI SISWA', x + cardW / 2, y + 4, { align: 'center' });

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    const schoolTitle = settings.schoolName.toUpperCase();
    doc.text(schoolTitle.length > 32 ? schoolTitle.substring(0, 30) + '..' : schoolTitle, x + cardW / 2, y + 8, { align: 'center' });

    // 3. Student Photo Box
    const photoX = x + 3;
    const photoY = y + 13;
    const photoW = 16;
    const photoH = 20;

    doc.setDrawColor(16, 185, 129); // emerald-500
    doc.setFillColor(226, 232, 240);
    doc.roundedRect(photoX, photoY, photoW, photoH, 2, 2, 'FD');

    // Draw student photo if available as base64 dataUrl
    if (std.photoUrl && std.photoUrl.startsWith('data:image')) {
      try {
        doc.addImage(std.photoUrl, 'PNG', photoX, photoY, photoW, photoH);
      } catch {
        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(std.name.charAt(0), photoX + photoW / 2, photoY + photoH / 2 + 1, { align: 'center' });
      }
    } else {
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(std.name.charAt(0), photoX + photoW / 2, photoY + photoH / 2 + 1, { align: 'center' });
    }

    // 4. Student Details
    const infoX = x + 21;
    let infoY = y + 15;

    doc.setTextColor(100, 116, 139); // slate-500
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5);
    doc.text('NAMA LENGKAP:', infoX, infoY);

    infoY += 3.5;
    doc.setTextColor(15, 23, 42); // slate-900
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    const truncatedName = std.name.length > 25 ? std.name.substring(0, 23) + '..' : std.name;
    doc.text(truncatedName, infoX, infoY);

    infoY += 4;
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5);
    doc.text('NISN:', infoX, infoY);
    doc.text('KELAS:', infoX + 32, infoY);

    infoY += 3.5;
    doc.setTextColor(5, 150, 105); // emerald-600
    doc.setFont('courier', 'bold');
    doc.setFontSize(7.5);
    doc.text(std.nisn, infoX, infoY);

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text(std.class, infoX + 32, infoY);

    // 5. Barcode & QR Code Section
    const barcodeBoxX = x + 3;
    const barcodeBoxY = y + 35;
    const barcodeBoxW = cardW - 6; // 79mm
    const barcodeBoxH = 12;

    doc.setDrawColor(203, 213, 225); // slate-300
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(barcodeBoxX, barcodeBoxY, barcodeBoxW, barcodeBoxH, 1.5, 1.5, 'FD');

    // Generate 1D barcode & QR Code
    const barcode1DUrl = generate1DBarcodeDataUrl(std.nisn);
    const qrCodeUrl = await generateStudentQRCode(std.nisn);

    if (barcodeStyle === '1D' && barcode1DUrl) {
      doc.addImage(barcode1DUrl, 'PNG', barcodeBoxX + 2, barcodeBoxY + 1, barcodeBoxW - 4, barcodeBoxH - 2);
    } else if (barcodeStyle === 'QR' && qrCodeUrl) {
      doc.addImage(qrCodeUrl, 'PNG', barcodeBoxX + (barcodeBoxW - 10) / 2, barcodeBoxY + 1, 10, 10);
    } else if (barcodeStyle === 'BOTH') {
      if (barcode1DUrl) {
        doc.addImage(barcode1DUrl, 'PNG', barcodeBoxX + 2, barcodeBoxY + 1, 58, barcodeBoxH - 2);
      }
      if (qrCodeUrl) {
        doc.addImage(qrCodeUrl, 'PNG', barcodeBoxX + 63, barcodeBoxY + 1, 10, 10);
      }
    }

    // 6. Footer Text
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(4.5);
    doc.text('Berlaku Selama Menjadi Siswa', x + 3, y + 51);

    doc.setFontSize(4.5);
    doc.text(`${settings.principalName}`, x + cardW - 3, y + 49.5, { align: 'right' });
    doc.text(`NIP. ${settings.principalNip}`, x + cardW - 3, y + 51.5, { align: 'right' });
  }

  const cleanSchoolName = settings.schoolName.replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`Kartu_Siswa_${cleanSchoolName}.pdf`);
}

export async function exportSingleCardToPDF(
  student: Student,
  settings: AppSettings,
  barcodeStyle: '1D' | 'QR' | 'BOTH' = '1D'
) {
  await exportStudentCardsToPDF([student], settings, barcodeStyle);
}

export function exportScanFailuresToExcel(
  logs: ScanFailureLog[],
  schoolName: string = 'SD Negeri 1 Nusantara'
) {
  const data = logs.map((item, idx) => ({
    'No': idx + 1,
    'Tanggal': item.date,
    'Waktu': item.time,
    'Nama Siswa': item.studentName || '(Tidak Teridentifikasi)',
    'NISN': item.nisn || item.rawCode,
    'Kelas': item.class || '-',
    'Nomor HP Ortu': item.parentPhone || '-',
    'Kode Terbaca / Dicari': item.rawCode,
    'Penyebab Kendala':
      item.failureReason === 'BARCODE_RUSAK'
        ? 'Barcode Fisik Rusak / Pudar'
        : item.failureReason === 'TIDAK_TERBACA_KAMERA'
        ? 'Kamera Tidak Dapat Baca'
        : item.failureReason === 'KODE_TIDAK_TERDAFTAR'
        ? 'Kode Tidak Terdaftar'
        : item.failureReason === 'KARTU_HILANG_TERTINGGAL'
        ? 'Kartu Hilang / Tidak Dibawa'
        : item.failureReason === 'FORMAT_TIDAK_VALID'
        ? 'Format Tidak Valid'
        : 'Laporan Manual',
    'Status Tindak Lanjut':
      item.resolutionStatus === 'PERLU_CETAK_ULANG'
        ? 'Perlu Cetak Ulang Kartu'
        : item.resolutionStatus === 'DALAM_PROSES'
        ? 'Dalam Proses Cetak'
        : 'Selesai / Sudah Diganti',
    'Keterangan & Catatan': item.notes || '-',
    'Dicatat Melalui': item.reportedBy || 'Scanner',
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);

  ws['!cols'] = [
    { wch: 5 },  // No
    { wch: 12 }, // Tanggal
    { wch: 10 }, // Waktu
    { wch: 24 }, // Nama Siswa
    { wch: 16 }, // NISN
    { wch: 12 }, // Kelas
    { wch: 16 }, // No HP
    { wch: 22 }, // Kode Terbaca
    { wch: 26 }, // Penyebab
    { wch: 24 }, // Status Tindak Lanjut
    { wch: 35 }, // Keterangan
    { wch: 18 }, // Dicatat Melalui
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Log Barcode Rusak');
  const dateStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `Laporan_Barcode_Rusak_${schoolName.replace(/[^a-zA-Z0-9]/g, '_')}_${dateStr}.xlsx`);
}

export function exportScanFailuresToPDF(
  logs: ScanFailureLog[],
  settings: AppSettings
) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  // Header Sekolah
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(settings.schoolName.toUpperCase(), 148, 14, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(settings.schoolAddress, 148, 19, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('LAPORAN LOG SISWA GAGAL PINDAI & BARCODE KARTU RUSAK', 148, 26, { align: 'center' });

  doc.setLineWidth(0.5);
  doc.line(14, 29, 283, 29);

  const tableData = logs.map((l, idx) => [
    idx + 1,
    `${l.date}\n${l.time}`,
    l.studentName || '(Belum Terdata)',
    l.nisn || l.rawCode,
    l.class || '-',
    l.failureReason === 'BARCODE_RUSAK'
      ? 'Barcode Fisik Rusak'
      : l.failureReason === 'TIDAK_TERBACA_KAMERA'
      ? 'Gagal Baca Kamera'
      : l.failureReason === 'KODE_TIDAK_TERDAFTAR'
      ? 'Kode Tidak Terdaftar'
      : l.failureReason === 'KARTU_HILANG_TERTINGGAL'
      ? 'Kartu Hilang'
      : 'Laporan Manual',
    l.resolutionStatus === 'PERLU_CETAK_ULANG'
      ? 'PERLU CETAK ULANG'
      : l.resolutionStatus === 'DALAM_PROSES'
      ? 'DALAM PROSES'
      : 'SELESAI DIGANTI',
    l.notes || '-',
  ]);

  autoTable(doc, {
    startY: 32,
    head: [['No', 'Waktu', 'Nama Siswa', 'NISN / Kode', 'Kelas', 'Penyebab', 'Status Kartu', 'Keterangan']],
    body: tableData,
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'center', cellWidth: 24 },
      2: { cellWidth: 46 },
      3: { halign: 'center', cellWidth: 30 },
      4: { halign: 'center', cellWidth: 20 },
      5: { cellWidth: 38 },
      6: { halign: 'center', cellWidth: 36, fontStyle: 'bold' },
      7: { cellWidth: 65 },
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 12;
  if (finalY < 180) {
    const today = new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    doc.setFontSize(8.5);
    doc.text(`Mengetahui,`, 225, finalY);
    doc.text(`Kepala ${settings.schoolName}`, 225, finalY + 4);
    doc.setFont('helvetica', 'bold');
    doc.text(settings.principalName, 225, finalY + 22);
    doc.setFont('helvetica', 'normal');
    doc.text(`NIP. ${settings.principalNip}`, 225, finalY + 26);
  }

  const dateStr = new Date().toISOString().split('T')[0];
  doc.save(`Laporan_Barcode_Rusak_${dateStr}.pdf`);
}


