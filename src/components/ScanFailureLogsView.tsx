import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  QrCode,
  Printer,
  FileSpreadsheet,
  FileText,
  Search,
  Filter,
  Plus,
  RefreshCw,
  CheckCircle2,
  Clock,
  Trash2,
  Edit3,
  ExternalLink,
  ChevronDown,
  X,
  AlertCircle,
  HelpCircle,
  Sparkles,
  Phone,
  UserCheck,
  Calendar,
  Layers,
  ArrowUpDown,
} from 'lucide-react';
import {
  Student,
  AppSettings,
  ScanFailureLog,
  ScanFailureReason,
  CardResolutionStatus,
} from '../types';
import { exportScanFailuresToExcel, exportScanFailuresToPDF, exportStudentCardsToPDF } from '../utils/exportUtils';
import { generate1DBarcodeDataUrl } from '../utils/barcodeGenerator';
import { generateStudentQRCode } from '../utils/qrGenerator';

interface ScanFailureLogsViewProps {
  scanFailures: ScanFailureLog[];
  students: Student[];
  settings: AppSettings;
  onAddFailureLog: (log: ScanFailureLog) => void;
  onUpdateFailureStatus: (logId: string, status: CardResolutionStatus, notes?: string) => void;
  onDeleteFailureLog: (logId: string) => void;
  onClearResolvedLogs?: () => void;
}

export const ScanFailureLogsView: React.FC<ScanFailureLogsViewProps> = ({
  scanFailures,
  students,
  settings,
  onAddFailureLog,
  onUpdateFailureStatus,
  onDeleteFailureLog,
  onClearResolvedLogs,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('ALL');
  const [selectedReason, setSelectedReason] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printingStudent, setPrintingStudent] = useState<Student | null>(null);
  const [editingNotesLog, setEditingNotesLog] = useState<ScanFailureLog | null>(null);
  const [tempNotes, setTempNotes] = useState('');
  const [isBulkPrinting, setIsBulkPrinting] = useState(false);

  // New report form state
  const [formStudentId, setFormStudentId] = useState('');
  const [formStudentSearch, setFormStudentSearch] = useState('');
  const [formReason, setFormReason] = useState<ScanFailureReason>('BARCODE_RUSAK');
  const [formStatus, setFormStatus] = useState<CardResolutionStatus>('PERLU_CETAK_ULANG');
  const [formNotes, setFormNotes] = useState('');
  const [formRawCode, setFormRawCode] = useState('');

  // Generated preview barcode URLs
  const [cardBarcode1D, setCardBarcode1D] = useState<string>('');
  const [cardQRCode, setCardQRCode] = useState<string>('');

  // Extract unique classes
  const classesList = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => {
      if (s.class) set.add(s.class);
    });
    return Array.from(set).sort();
  }, [students]);

  // Statistics
  const stats = useMemo(() => {
    const total = scanFailures.length;
    const needReprint = scanFailures.filter((f) => f.resolutionStatus === 'PERLU_CETAK_ULANG').length;
    const inProgress = scanFailures.filter((f) => f.resolutionStatus === 'DALAM_PROSES').length;
    const resolved = scanFailures.filter((f) => f.resolutionStatus === 'SELESAI').length;

    // Class with most damaged barcodes
    const classCountMap: Record<string, number> = {};
    scanFailures.forEach((f) => {
      if (f.class && f.resolutionStatus !== 'SELESAI') {
        classCountMap[f.class] = (classCountMap[f.class] || 0) + 1;
      }
    });

    let topClass = '-';
    let maxCount = 0;
    Object.entries(classCountMap).forEach(([cls, count]) => {
      if (count > maxCount) {
        maxCount = count;
        topClass = `${cls} (${count} kartu)`;
      }
    });

    return { total, needReprint, inProgress, resolved, topClass };
  }, [scanFailures]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return scanFailures.filter((item) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = item.studentName?.toLowerCase().includes(q);
        const matchNisn = item.nisn?.toLowerCase().includes(q);
        const matchRaw = item.rawCode?.toLowerCase().includes(q);
        const matchNotes = item.notes?.toLowerCase().includes(q);
        const matchClass = item.class?.toLowerCase().includes(q);
        if (!matchName && !matchNisn && !matchRaw && !matchNotes && !matchClass) {
          return false;
        }
      }

      // Class Filter
      if (selectedClass !== 'ALL' && item.class !== selectedClass) {
        return false;
      }

      // Reason Filter
      if (selectedReason !== 'ALL' && item.failureReason !== selectedReason) {
        return false;
      }

      // Status Filter
      if (selectedStatus !== 'ALL' && item.resolutionStatus !== selectedStatus) {
        return false;
      }

      // Date Filter
      if (dateFilter && item.date !== dateFilter) {
        return false;
      }

      return true;
    });
  }, [scanFailures, searchQuery, selectedClass, selectedReason, selectedStatus, dateFilter]);

  // Students needing reprint
  const studentsNeedingReprint = useMemo(() => {
    const list: Student[] = [];
    const addedIds = new Set<string>();

    scanFailures.forEach((f) => {
      if (f.resolutionStatus === 'PERLU_CETAK_ULANG' && f.studentId) {
        const std = students.find((s) => s.id === f.studentId);
        if (std && !addedIds.has(std.id)) {
          addedIds.add(std.id);
          list.push(std);
        }
      }
    });

    return list;
  }, [scanFailures, students]);

  // Handle open card preview modal
  const handleOpenPrintModal = async (student: Student) => {
    setPrintingStudent(student);
    const b1d = generate1DBarcodeDataUrl(student.nisn);
    const qr = await generateStudentQRCode(student.nisn);
    setCardBarcode1D(b1d);
    setCardQRCode(qr);
    setIsPrintModalOpen(true);
  };

  // Bulk print all damaged cards
  const handleBulkPrintDamagedCards = async () => {
    if (studentsNeedingReprint.length === 0) {
      alert('Tidak ada siswa dengan kartu berstatus "Perlu Cetak Ulang".');
      return;
    }

    try {
      setIsBulkPrinting(true);
      await exportStudentCardsToPDF(studentsNeedingReprint, settings, 'BOTH');
    } catch (err) {
      console.error('Failed to export damaged cards PDF:', err);
      alert('Gagal membuat PDF kartu siswa.');
    } finally {
      setIsBulkPrinting(false);
    }
  };

  // Handle manual new report submit
  const handleCreateReport = (e: React.FormEvent) => {
    e.preventDefault();

    let student: Student | undefined;
    if (formStudentId) {
      student = students.find((s) => s.id === formStudentId);
    }

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const newLog: ScanFailureLog = {
      id: `fail-${Date.now()}`,
      timestamp: now.toISOString(),
      date: dateStr,
      time: timeStr,
      rawCode: student?.nisn || formRawCode.trim() || 'MANUAL_ENTRY',
      studentId: student?.id,
      nisn: student?.nisn,
      studentName: student?.name,
      class: student?.class,
      parentPhone: student?.parentPhone,
      failureReason: formReason,
      resolutionStatus: formStatus,
      notes: formNotes.trim() || (formReason === 'BARCODE_RUSAK' ? 'Barcode kartu fisik rusak/tergores, perlu cetak baru.' : ''),
      reportedBy: 'Input Manual Admin',
    };

    onAddFailureLog(newLog);
    setIsAddModalOpen(false);

    // Reset form
    setFormStudentId('');
    setFormStudentSearch('');
    setFormNotes('');
    setFormRawCode('');
    setFormReason('BARCODE_RUSAK');
    setFormStatus('PERLU_CETAK_ULANG');
  };

  // Filter students for autocomplete in modal
  const searchedStudents = useMemo(() => {
    if (!formStudentSearch.trim()) return students.slice(0, 10);
    const q = formStudentSearch.toLowerCase();
    return students.filter(
      (s) => s.name.toLowerCase().includes(q) || s.nisn.includes(q) || s.class.toLowerCase().includes(q)
    ).slice(0, 15);
  }, [students, formStudentSearch]);

  const getReasonBadge = (reason: ScanFailureReason) => {
    switch (reason) {
      case 'BARCODE_RUSAK':
        return {
          label: 'Barcode Fisik Rusak',
          bg: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
          dot: 'bg-rose-400',
        };
      case 'TIDAK_TERBACA_KAMERA':
        return {
          label: 'Kamera Gagal Baca',
          bg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
          dot: 'bg-amber-400',
        };
      case 'KODE_TIDAK_TERDAFTAR':
        return {
          label: 'Kode Tidak Terdaftar',
          bg: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
          dot: 'bg-orange-400',
        };
      case 'KARTU_HILANG_TERTINGGAL':
        return {
          label: 'Kartu Hilang/Tertinggal',
          bg: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
          dot: 'bg-purple-400',
        };
      case 'FORMAT_TIDAK_VALID':
        return {
          label: 'Format Tidak Valid',
          bg: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
          dot: 'bg-slate-400',
        };
      default:
        return {
          label: 'Laporan Manual',
          bg: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
          dot: 'bg-blue-400',
        };
    }
  };

  const getStatusBadge = (status: CardResolutionStatus) => {
    switch (status) {
      case 'PERLU_CETAK_ULANG':
        return {
          label: 'Perlu Cetak Ulang',
          bg: 'bg-red-500/15 text-red-300 border-red-500/30 font-bold',
          icon: AlertCircle,
        };
      case 'DALAM_PROSES':
        return {
          label: 'Dalam Proses Cetak',
          bg: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
          icon: Clock,
        };
      case 'SELESAI':
        return {
          label: 'Sudah Selesai / Diganti',
          bg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
          icon: CheckCircle2,
        };
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-rose-950/40 to-slate-900 border border-rose-900/40 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className="w-12 h-12 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center shrink-0 text-rose-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  Log Barcode Rusak & Gagal Pindai
                </h1>
                {stats.needReprint > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-rose-500 text-white animate-pulse">
                    {stats.needReprint} Butuh Cetak
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-400 mt-1 max-w-2xl">
                Daftar siswa yang mengalami kendala saat scan kartu absensi, barcode fisik tergores, pudar, atau tidak terbaca scanner. Admin dapat langsung mencetak ulang kartu barcode baru.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs sm:text-sm font-semibold flex items-center space-x-1.5 transition-all shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4 text-emerald-400" />
              <span>+ Catat Kartu Rusak</span>
            </button>

            <button
              onClick={handleBulkPrintDamagedCards}
              disabled={isBulkPrinting || studentsNeedingReprint.length === 0}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center space-x-2 transition-all shadow-lg cursor-pointer ${
                studentsNeedingReprint.length > 0
                  ? 'bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white shadow-rose-900/30'
                  : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
              }`}
            >
              <Printer className="w-4 h-4" />
              <span>
                {isBulkPrinting ? 'Menyiapkan PDF...' : `Cetak Massal (${studentsNeedingReprint.length} Kartu)`}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Need Reprint */}
        <div
          onClick={() => setSelectedStatus('PERLU_CETAK_ULANG')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            selectedStatus === 'PERLU_CETAK_ULANG'
              ? 'bg-rose-950/40 border-rose-500 ring-2 ring-rose-500/20'
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-rose-400 mb-1">
            <span>Perlu Cetak Ulang</span>
            <AlertCircle className="w-4 h-4" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-rose-300">
            {stats.needReprint}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Kartu fisik rusak / butuh kartu baru
          </div>
        </div>

        {/* Card 2: In Progress */}
        <div
          onClick={() => setSelectedStatus('DALAM_PROSES')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            selectedStatus === 'DALAM_PROSES'
              ? 'bg-blue-950/40 border-blue-500 ring-2 ring-blue-500/20'
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-blue-400 mb-1">
            <span>Sedang Diproses</span>
            <Clock className="w-4 h-4" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-blue-300">
            {stats.inProgress}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Dalam tahap cetak / laminasi
          </div>
        </div>

        {/* Card 3: Resolved */}
        <div
          onClick={() => setSelectedStatus('SELESAI')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            selectedStatus === 'SELESAI'
              ? 'bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/20'
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-400 mb-1">
            <span>Selesai Diganti</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-300">
            {stats.resolved}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Kartu baru telah diserahkan
          </div>
        </div>

        {/* Card 4: Total & Top Class */}
        <div
          onClick={() => setSelectedStatus('ALL')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            selectedStatus === 'ALL'
              ? 'bg-slate-800/80 border-slate-600'
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-1">
            <span>Total Riwayat</span>
            <QrCode className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-100">
            {stats.total}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 truncate">
            Terbanyak: <span className="text-amber-400 font-semibold">{stats.topClass}</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama siswa, NISN, kode barcode, catatan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick Status Buttons */}
          <div className="flex items-center space-x-1.5 overflow-x-auto scrollbar-none shrink-0">
            {[
              { id: 'ALL', label: 'Semua Status' },
              { id: 'PERLU_CETAK_ULANG', label: `🚨 Perlu Cetak (${stats.needReprint})` },
              { id: 'DALAM_PROSES', label: `⏳ Proses (${stats.inProgress})` },
              { id: 'SELESAI', label: `✅ Selesai (${stats.resolved})` },
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setSelectedStatus(st.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  selectedStatus === st.id
                    ? 'bg-rose-500 text-white font-bold shadow-sm'
                    : 'bg-slate-950/80 text-slate-400 border border-slate-800 hover:text-slate-200'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {/* Second row filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
          <div className="flex flex-wrap items-center gap-2">
            {/* Class Filter */}
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-rose-500 cursor-pointer"
            >
              <option value="ALL">Semua Kelas</option>
              {classesList.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            {/* Reason Filter */}
            <select
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value)}
              className="bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-rose-500 cursor-pointer"
            >
              <option value="ALL">Semua Penyebab Kendala</option>
              <option value="BARCODE_RUSAK">Barcode Fisik Rusak / Pudar</option>
              <option value="TIDAK_TERBACA_KAMERA">Kamera Gagal Baca</option>
              <option value="KODE_TIDAK_TERDAFTAR">Kode Tidak Terdaftar</option>
              <option value="KARTU_HILANG_TERTINGGAL">Kartu Hilang / Tertinggal</option>
              <option value="FORMAT_TIDAK_VALID">Format Tidak Standar</option>
              <option value="MANUAL_LAPORAN">Laporan Manual Guru/Admin</option>
            </select>

            {/* Date filter */}
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="bg-slate-950/80 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-rose-500 cursor-pointer"
            />
            {dateFilter && (
              <button
                onClick={() => setDateFilter('')}
                className="text-xs text-slate-400 hover:text-slate-200 underline cursor-pointer"
              >
                Reset Tgl
              </button>
            )}
          </div>

          {/* Export and Clear Actions */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => exportScanFailuresToExcel(filteredLogs, settings.schoolName)}
              className="px-2.5 py-1.5 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-800/60 text-emerald-400 text-xs font-semibold flex items-center space-x-1 transition-all cursor-pointer"
              title="Unduh Laporan Barcode Rusak format Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Excel</span>
            </button>

            <button
              onClick={() => exportScanFailuresToPDF(filteredLogs, settings)}
              className="px-2.5 py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/50 border border-rose-800/60 text-rose-400 text-xs font-semibold flex items-center space-x-1 transition-all cursor-pointer"
              title="Unduh Laporan Barcode Rusak format PDF Resmi"
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">PDF</span>
            </button>

            {onClearResolvedLogs && stats.resolved > 0 && (
              <button
                onClick={() => {
                  if (confirm('Bersihkan semua riwayat kartu rusak yang sudah berstatus Selesai?')) {
                    onClearResolvedLogs();
                  }
                }}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs font-medium transition-all cursor-pointer"
                title="Hapus riwayat yang sudah selesai diganti"
              >
                Bersihkan Selesai
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main List Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {filteredLogs.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center mx-auto text-slate-500 mb-3">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
            <h3 className="text-base font-bold text-slate-200">
              Tidak Ada Data Barcode Rusak / Gagal Pindai
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
              {searchQuery || selectedClass !== 'ALL' || selectedStatus !== 'ALL' || selectedReason !== 'ALL'
                ? 'Tidak ada data yang sesuai dengan filter pencarian.'
                : 'Semua kartu siswa berfungsi normal dan tidak ada laporan barcode rusak.'}
            </p>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold inline-flex items-center space-x-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 text-emerald-400" />
              <span>Tambah Laporan Kartu Rusak</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">No</th>
                  <th className="py-3 px-4">Siswa / NISN</th>
                  <th className="py-3 px-4">Waktu Kejadian</th>
                  <th className="py-3 px-4">Penyebab Kendala</th>
                  <th className="py-3 px-4">Status Kartu</th>
                  <th className="py-3 px-4">Catatan Kendala</th>
                  <th className="py-3 px-4 text-right">Tindakan Admin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {filteredLogs.map((item, idx) => {
                  const studentObj = item.studentId ? students.find((s) => s.id === item.studentId) : undefined;
                  const reasonMeta = getReasonBadge(item.failureReason);
                  const statusMeta = getStatusBadge(item.resolutionStatus);
                  const StatusIcon = statusMeta.icon;

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        item.resolutionStatus === 'PERLU_CETAK_ULANG' ? 'bg-rose-950/10' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4 text-center text-slate-500 font-mono text-xs">
                        {idx + 1}
                      </td>

                      {/* Student Info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-3">
                          {studentObj?.photoUrl ? (
                            <img
                              src={studentObj.photoUrl}
                              alt={item.studentName || 'Student'}
                              className="w-9 h-9 rounded-xl object-cover border border-slate-700 shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-bold shrink-0 text-xs">
                              {item.studentName ? item.studentName.charAt(0) : '?'}
                            </div>
                          )}
                          <div>
                            <div className="font-bold text-slate-100 flex items-center space-x-1.5">
                              <span>{item.studentName || '(Tidak Teridentifikasi)'}</span>
                              {item.class && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700">
                                  {item.class}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono flex items-center space-x-2 mt-0.5">
                              <span>NISN: {item.nisn || item.rawCode}</span>
                              {item.parentPhone && (
                                <span className="text-slate-500">· HP: {item.parentPhone}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Timestamp */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="text-xs font-medium text-slate-200">
                          {item.date}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {item.time} WIB ({item.reportedBy || 'Scanner'})
                        </div>
                      </td>

                      {/* Failure Reason */}
                      <td className="py-3.5 px-4">
                        <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${reasonMeta.bg}">
                          <span className={`w-1.5 h-1.5 rounded-full ${reasonMeta.dot}`} />
                          <span>{reasonMeta.label}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center space-x-1.5">
                          <select
                            value={item.resolutionStatus}
                            onChange={(e) =>
                              onUpdateFailureStatus(
                                item.id,
                                e.target.value as CardResolutionStatus,
                                item.notes
                              )
                            }
                            className={`px-2.5 py-1 rounded-xl text-xs border font-semibold focus:outline-none cursor-pointer transition-all ${statusMeta.bg}`}
                          >
                            <option value="PERLU_CETAK_ULANG" className="bg-slate-900 text-red-300">
                              🚨 Perlu Cetak Ulang
                            </option>
                            <option value="DALAM_PROSES" className="bg-slate-900 text-blue-300">
                              ⏳ Sedang Diproses Cetak
                            </option>
                            <option value="SELESAI" className="bg-slate-900 text-emerald-300">
                              ✅ Selesai & Diberikan
                            </option>
                          </select>
                        </div>
                      </td>

                      {/* Notes */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="text-xs text-slate-300 line-clamp-2">
                          {item.notes || '-'}
                        </div>
                        <button
                          onClick={() => {
                            setEditingNotesLog(item);
                            setTempNotes(item.notes || '');
                          }}
                          className="text-[11px] text-slate-400 hover:text-slate-200 underline mt-0.5 inline-flex items-center space-x-1 cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Ubah Catatan</span>
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-1.5">
                          {studentObj && (
                            <button
                              onClick={() => handleOpenPrintModal(studentObj)}
                              className="px-2.5 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/30 text-xs font-semibold flex items-center space-x-1 transition-all cursor-pointer"
                              title="Pratinjau & Cetak Kartu Barcode Siswa"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>Cetak Kartu</span>
                            </button>
                          )}

                          <button
                            onClick={() => {
                              if (confirm('Hapus entri log ini?')) {
                                onDeleteFailureLog(item.id);
                              }
                            }}
                            className="p-1.5 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors cursor-pointer"
                            title="Hapus Log"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: Tambah Laporan Kartu Rusak Manual */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Catat Laporan Kartu Siswa Rusak
                  </h3>
                  <p className="text-xs text-slate-400">
                    Masukkan siswa yang kartunya rusak atau tidak dapat dipindai.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateReport} className="p-5 space-y-4">
              {/* Student Picker with Autocomplete */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Pilih Siswa (Ketik Nama / NISN / Kelas) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Ketik nama siswa..."
                  value={formStudentSearch}
                  onChange={(e) => {
                    setFormStudentSearch(e.target.value);
                    setFormStudentId('');
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />

                {/* Suggestions dropdown */}
                {searchedStudents.length > 0 && !formStudentId && (
                  <div className="mt-1 max-h-36 overflow-y-auto bg-slate-950 border border-slate-800 rounded-xl divide-y divide-slate-900">
                    {searchedStudents.map((std) => (
                      <button
                        type="button"
                        key={std.id}
                        onClick={() => {
                          setFormStudentId(std.id);
                          setFormStudentSearch(`${std.name} (${std.class} - NISN: ${std.nisn})`);
                        }}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-slate-800/80 flex items-center justify-between cursor-pointer"
                      >
                        <div>
                          <div className="font-semibold text-slate-200">{std.name}</div>
                          <div className="text-slate-400 text-[11px]">
                            {std.class} · NISN: {std.nisn}
                          </div>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                          Pilih
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Reason */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Penyebab Kerusakan / Gagal Scan
                </label>
                <select
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value as ScanFailureReason)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-200 focus:outline-none focus:border-rose-500 cursor-pointer"
                >
                  <option value="BARCODE_RUSAK">Barcode Fisik Rusak / Tergores / Pudar</option>
                  <option value="TIDAK_TERBACA_KAMERA">Kamera Tidak Mau Membaca Garis Barcode</option>
                  <option value="KODE_TIDAK_TERDAFTAR">Barcode Terbaca Tapi NISN Tidak Terdaftar</option>
                  <option value="KARTU_HILANG_TERTINGGAL">Kartu Siswa Hilang / Rusak Total</option>
                  <option value="FORMAT_TIDAK_VALID">Format Barcode Tidak Standar</option>
                  <option value="MANUAL_LAPORAN">Laporan Manual dari Wali Kelas / Ortu</option>
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Status Penanganan Kartu
                </label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as CardResolutionStatus)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-200 focus:outline-none focus:border-rose-500 cursor-pointer"
                >
                  <option value="PERLU_CETAK_ULANG">🚨 Perlu Cetak Ulang Kartu (Masuk Antrean Cetak)</option>
                  <option value="DALAM_PROSES">⏳ Sedang Dalam Proses Cetak</option>
                  <option value="SELESAI">✅ Sudah Selesai Diganti / Dicetak</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Keterangan Kerusakan
                </label>
                <textarea
                  rows={3}
                  placeholder="Misal: Plastik laminasi robek, garis barcode hitam pudar di bagian tengah..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end space-x-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-900/30 cursor-pointer"
                >
                  Simpan Laporan Kartu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Single Student Card Print & Preview */}
      {isPrintModalOpen && printingStudent && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Printer className="w-5 h-5 text-rose-400" />
                <h3 className="text-sm font-bold text-white">
                  Cetak Ulang Kartu Siswa
                </h3>
              </div>
              <button
                onClick={() => setIsPrintModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Printable Card Preview */}
            <div className="p-5 flex flex-col items-center">
              <div
                id="printable-single-student-card"
                className="w-80 bg-white text-slate-900 rounded-xl p-3.5 shadow-2xl border border-slate-200 flex flex-col justify-between"
                style={{ aspectRatio: '85.6 / 54' }}
              >
                {/* Header */}
                <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
                  <div className="w-7 h-7 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    SD
                  </div>
                  <div className="flex-1 leading-tight">
                    <div className="text-[10px] font-extrabold text-emerald-950 uppercase tracking-tight line-clamp-1">
                      {settings.schoolName}
                    </div>
                    <div className="text-[8px] font-semibold text-slate-500 uppercase tracking-wider">
                      KARTU PRESENSI SISWA
                    </div>
                  </div>
                </div>

                {/* Body: Photo & Info */}
                <div className="flex items-center space-x-3 my-2">
                  <div className="w-14 h-18 bg-slate-100 rounded-lg overflow-hidden border border-slate-300 flex items-center justify-center shrink-0">
                    {printingStudent.photoUrl ? (
                      <img
                        src={printingStudent.photoUrl}
                        alt={printingStudent.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-slate-400 font-bold text-lg">
                        {printingStudent.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 text-[10.5px] leading-snug">
                    <div className="font-extrabold text-slate-900 line-clamp-1">
                      {printingStudent.name}
                    </div>
                    <div className="text-slate-600 font-mono text-[9.5px]">
                      NISN: {printingStudent.nisn}
                    </div>
                    <div className="text-emerald-800 font-bold text-[9.5px] mt-0.5">
                      {printingStudent.class}
                    </div>
                  </div>
                </div>

                {/* Barcode Strip */}
                <div className="bg-slate-50 rounded-lg p-1.5 border border-slate-200 flex items-center justify-between">
                  {cardBarcode1D && (
                    <img
                      src={cardBarcode1D}
                      alt="1D Barcode"
                      className="h-8 max-w-[180px] object-contain"
                    />
                  )}
                  {cardQRCode && (
                    <img
                      src={cardQRCode}
                      alt="QR Code"
                      className="w-8 h-8 object-contain shrink-0"
                    />
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="w-full mt-5 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-semibold cursor-pointer"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await exportStudentCardsToPDF([printingStudent], settings, 'BOTH');
                    // Mark as resolved/in progress
                    const matchedLog = scanFailures.find((f) => f.studentId === printingStudent.id);
                    if (matchedLog) {
                      onUpdateFailureStatus(matchedLog.id, 'DALAM_PROSES', 'Sedang dicetak ulang');
                    }
                    setIsPrintModalOpen(false);
                  }}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center space-x-1.5 shadow-lg shadow-emerald-950/40 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Unduh & Cetak Kartu PDF</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Ubah Catatan */}
      {editingNotesLog && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-sm font-bold text-white">
              Ubah Catatan Kerusakan Kartu
            </h3>
            <p className="text-xs text-slate-400">
              Siswa: <span className="text-slate-200 font-semibold">{editingNotesLog.studentName || 'Anonim'}</span>
            </p>

            <textarea
              rows={3}
              value={tempNotes}
              onChange={(e) => setTempNotes(e.target.value)}
              placeholder="Tulis detail kerusakan kartu barcode..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
            />

            <div className="flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setEditingNotesLog(null)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  onUpdateFailureStatus(
                    editingNotesLog.id,
                    editingNotesLog.resolutionStatus,
                    tempNotes
                  );
                  setEditingNotesLog(null);
                }}
                className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold cursor-pointer"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
