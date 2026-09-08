import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  FileText,
  Download,
  Search,
  Filter,
  Printer,
  Calendar,
  CalendarDays,
  CalendarRange,
  Clock,
  CheckCircle2,
  Users,
  AlertCircle,
  Eye,
  ChevronDown,
} from 'lucide-react';
import { Student, AttendanceRecord, AppSettings, PermissionRequest } from '../types';
import { exportToExcelFlexible, exportToPDFFlexible } from '../utils/exportUtils';

interface RecapViewProps {
  students: Student[];
  records: AttendanceRecord[];
  permissions?: PermissionRequest[];
  settings: AppSettings;
  onEvaluateAlpha?: (targetDate?: string, targetClass?: string) => number;
}

type PeriodType = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

export const RecapView: React.FC<RecapViewProps> = ({
  students,
  records,
  permissions = [],
  settings,
  onEvaluateAlpha,
}) => {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;
  const todayDateStr = currentDate.toISOString().split('T')[0];

  // Period state
  const [periodType, setPeriodType] = useState<PeriodType>('MONTHLY');
  const [selectedDate, setSelectedDate] = useState<string>(todayDateStr);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [alphaFeedback, setAlphaFeedback] = useState<string | null>(null);
  const [selectedClass, setSelectedClass] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'summary' | 'logs'>('summary');

  const classesList = useMemo(() => {
    return Array.from(new Set(students.map((s) => s.class))).sort();
  }, [students]);

  // Calculate Week Date Range helper
  const weekInfo = useMemo(() => {
    // Week 1: 1-7, Week 2: 8-14, Week 3: 15-21, Week 4: 22-28, Week 5: 29-end of month
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    let startDay = 1;
    let endDay = 7;

    if (selectedWeek === 1) {
      startDay = 1;
      endDay = 7;
    } else if (selectedWeek === 2) {
      startDay = 8;
      endDay = 14;
    } else if (selectedWeek === 3) {
      startDay = 15;
      endDay = 21;
    } else if (selectedWeek === 4) {
      startDay = 22;
      endDay = 28;
    } else if (selectedWeek === 5) {
      startDay = 29;
      endDay = daysInMonth;
    }

    const startStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;
    const endStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(Math.min(endDay, daysInMonth)).padStart(2, '0')}`;

    return {
      startDay,
      endDay: Math.min(endDay, daysInMonth),
      startStr,
      endStr,
      label: `Minggu ke-${selectedWeek} (${startDay} - ${Math.min(endDay, daysInMonth)} ${new Date(selectedYear, selectedMonth - 1, 1).toLocaleDateString('id-ID', { month: 'long' })} ${selectedYear})`,
    };
  }, [selectedYear, selectedMonth, selectedWeek]);

  // Date Filter Predicate based on PeriodType
  const { dateFilterFn, periodLabel } = useMemo(() => {
    if (periodType === 'DAILY') {
      const parts = selectedDate.split('-');
      let label = selectedDate;
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        label = d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      }
      return {
        dateFilterFn: (date: string) => date === selectedDate,
        periodLabel: `Harian - ${label}`,
      };
    }

    if (periodType === 'WEEKLY') {
      return {
        dateFilterFn: (date: string) => date >= weekInfo.startStr && date <= weekInfo.endStr,
        periodLabel: weekInfo.label,
      };
    }

    if (periodType === 'MONTHLY') {
      const mStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
      const monthName = new Date(selectedYear, selectedMonth - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
      return {
        dateFilterFn: (date: string) => date.startsWith(mStr),
        periodLabel: `Bulan ${monthName}`,
      };
    }

    // YEARLY
    const yStr = `${selectedYear}`;
    return {
      dateFilterFn: (date: string) => date.startsWith(yStr),
      periodLabel: `Tahun ${selectedYear}`,
    };
  }, [periodType, selectedDate, selectedYear, selectedMonth, weekInfo]);

  // Filter students
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const matchesClass = selectedClass === 'ALL' || s.class === selectedClass;
      const matchesQuery =
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.nisn.includes(searchQuery);
      return matchesClass && matchesQuery;
    });
  }, [students, selectedClass, searchQuery]);

  // Filter records within active period
  const periodRecords = useMemo(() => {
    return records.filter((r) => dateFilterFn(r.date));
  }, [records, dateFilterFn]);

  // Summary KPI Calculations
  const periodStats = useMemo(() => {
    const activeDates = new Set(periodRecords.map((r) => r.date));
    const effectiveDays = activeDates.size || (periodType === 'DAILY' ? 1 : 0);

    const filteredRecords = periodRecords.filter(
      (r) => selectedClass === 'ALL' || r.class === selectedClass
    );

    const hadir = filteredRecords.filter((r) => r.status === 'HADIR').length;
    const terlambat = filteredRecords.filter((r) => r.status === 'TERLAMBAT').length;
    const izin = filteredRecords.filter((r) => r.status === 'IZIN').length;
    const sakit = filteredRecords.filter((r) => r.status === 'SAKIT').length;
    const alpa = filteredRecords.filter((r) => r.status === 'ALPA').length;
    const totalPresent = hadir + terlambat;

    const totalPotentialSlots = filteredStudents.length * (effectiveDays || 1);
    const avgAttendanceRate =
      totalPotentialSlots > 0
        ? Math.round((totalPresent / totalPotentialSlots) * 100)
        : 0;

    return {
      effectiveDays,
      hadir,
      terlambat,
      izin,
      sakit,
      alpa,
      totalPresent,
      avgAttendanceRate,
    };
  }, [periodRecords, selectedClass, filteredStudents, periodType]);

  // Student summary table rows calculation
  const studentRecapRows = useMemo(() => {
    return filteredStudents.map((std, idx) => {
      const stdRecords = periodRecords.filter((r) => r.studentId === std.id);
      const hadir = stdRecords.filter((r) => r.status === 'HADIR').length;
      const terlambat = stdRecords.filter((r) => r.status === 'TERLAMBAT').length;
      const izin = stdRecords.filter((r) => r.status === 'IZIN').length;
      const sakit = stdRecords.filter((r) => r.status === 'SAKIT').length;
      const alpa = stdRecords.filter((r) => r.status === 'ALPA').length;
      const totalAttended = hadir + terlambat;
      const divisor = periodStats.effectiveDays > 0 ? periodStats.effectiveDays : 1;
      const rate = Math.min(100, Math.round((totalAttended / divisor) * 100));

      return {
        no: idx + 1,
        student: std,
        hadir,
        terlambat,
        izin,
        sakit,
        alpa,
        rate,
      };
    });
  }, [filteredStudents, periodRecords, periodStats.effectiveDays]);

  const handleExportExcel = () => {
    exportToExcelFlexible(records, students, periodLabel, dateFilterFn, selectedClass);
  };

  const handleExportPDF = () => {
    exportToPDFFlexible(records, students, periodLabel, dateFilterFn, selectedClass, settings);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Export Controls */}
      <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-md space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
              Rekapitulasi & Laporan Presensi Fleksibel
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Pilih periode laporan presensi harian, mingguan, bulanan, atau tahunan untuk arsip dan cetak PDF.
            </p>
          </div>

          {/* Export Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center space-x-2 transition-colors shadow-md shadow-emerald-600/20"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Ekspor Excel (.xlsx)</span>
            </button>

            <button
              onClick={handleExportPDF}
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl flex items-center space-x-2 transition-colors shadow-md shadow-rose-600/20"
            >
              <FileText className="w-4 h-4" />
              <span>Cetak / PDF</span>
            </button>
          </div>
        </div>

        {/* Period Mode Selector Tabs */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-800">
          <button
            onClick={() => setPeriodType('DAILY')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              periodType === 'DAILY'
                ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>1. Harian (Hari Tertentu)</span>
          </button>

          <button
            onClick={() => setPeriodType('WEEKLY')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              periodType === 'WEEKLY'
                ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <CalendarRange className="w-4 h-4" />
            <span>2. Mingguan (Minggu ke-X)</span>
          </button>

          <button
            onClick={() => setPeriodType('MONTHLY')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              periodType === 'MONTHLY'
                ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            <span>3. Bulanan</span>
          </button>

          <button
            onClick={() => setPeriodType('YEARLY')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              periodType === 'YEARLY'
                ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>4. Tahunan</span>
          </button>
        </div>

        {/* Dynamic Period Filter Controls & Class / Search Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-slate-800">
          {/* Mode 1: Harian */}
          {periodType === 'DAILY' && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Pilih Tanggal:
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-emerald-400 absolute left-3 top-2.5" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-mono font-bold"
                />
              </div>
            </div>
          )}

          {/* Mode 2: Mingguan */}
          {periodType === 'WEEKLY' && (
            <>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Pilih Bulan & Tahun:
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                    className="p-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-bold"
                  >
                    {[
                      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
                    ].map((m, idx) => (
                      <option key={idx} value={idx + 1}>
                        {m}
                      </option>
                    ))}
                  </select>

                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="p-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-bold"
                  >
                    {[2024, 2025, 2026, 2027, 2028].map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Pilih Minggu Ke-:
                </label>
                <select
                  value={selectedWeek}
                  onChange={(e) => setSelectedWeek(Number(e.target.value))}
                  className="w-full p-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-bold"
                >
                  <option value={1}>Minggu ke-1 (Tgl 1 - 7)</option>
                  <option value={2}>Minggu ke-2 (Tgl 8 - 14)</option>
                  <option value={3}>Minggu ke-3 (Tgl 15 - 21)</option>
                  <option value={4}>Minggu ke-4 (Tgl 22 - 28)</option>
                  <option value={5}>Minggu ke-5 (Tgl 29 - Akhir)</option>
                </select>
              </div>
            </>
          )}

          {/* Mode 3: Bulanan */}
          {periodType === 'MONTHLY' && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Bulan & Tahun:
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-emerald-400 absolute left-3 top-2.5" />
                <input
                  type="month"
                  value={`${selectedYear}-${String(selectedMonth).padStart(2, '0')}`}
                  onChange={(e) => {
                    const [y, m] = e.target.value.split('-');
                    setSelectedYear(Number(y));
                    setSelectedMonth(Number(m));
                  }}
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-mono font-bold"
                />
              </div>
            </div>
          )}

          {/* Mode 4: Tahunan */}
          {periodType === 'YEARLY' && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Pilih Tahun Kalender:
              </label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="w-full p-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-bold"
              >
                {[2024, 2025, 2026, 2027, 2028].map((y) => (
                  <option key={y} value={y}>
                    Tahun {y}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Filter Kelas */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Filter Kelas:
            </label>
            <div className="relative">
              <Filter className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
              >
                <option value="ALL">Semua Kelas ({students.length} Siswa)</option>
                {classesList.map((c) => (
                  <option key={c} value={c}>
                    Kelas {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Cari Siswa */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Cari Nama / NISN:
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Ketik nama atau NISN..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Current Active Label Badge */}
        <div className="flex items-center justify-between pt-2 text-xs text-slate-400">
          <div>
            Periode Aktif: <strong className="text-emerald-400 font-bold">{periodLabel}</strong>
            {selectedClass !== 'ALL' && (
              <span className="ml-2 text-slate-300">| Kelas: {selectedClass}</span>
            )}
          </div>
          <span className="font-mono text-[11px]">
            {periodStats.effectiveDays} Hari Terdata • {filteredStudents.length} Siswa
          </span>
        </div>
      </div>

      {/* KPI Overview for this Filtered Period */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800">
          <span className="text-[11px] font-bold text-slate-400 block">Total Siswa</span>
          <div className="text-2xl font-black text-white mt-1">{filteredStudents.length}</div>
          <span className="text-[10px] text-slate-400">{selectedClass === 'ALL' ? 'Semua Kelas' : selectedClass}</span>
        </div>

        <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800">
          <span className="text-[11px] font-bold text-emerald-400 block">Total Hadir (H)</span>
          <div className="text-2xl font-black text-emerald-400 mt-1">{periodStats.hadir}</div>
          <span className="text-[10px] text-slate-400">Tepat waktu</span>
        </div>

        <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800">
          <span className="text-[11px] font-bold text-amber-400 block">Terlambat (T)</span>
          <div className="text-2xl font-black text-amber-400 mt-1">{periodStats.terlambat}</div>
          <span className="text-[10px] text-slate-400">Setelah threshold</span>
        </div>

        <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800">
          <span className="text-[11px] font-bold text-sky-400 block">Izin (I)</span>
          <div className="text-2xl font-black text-sky-400 mt-1">{periodStats.izin}</div>
          <span className="text-[10px] text-slate-400">Pengajuan orang tua</span>
        </div>

        <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800">
          <span className="text-[11px] font-bold text-blue-400 block">Sakit (S)</span>
          <div className="text-2xl font-black text-blue-400 mt-1">{periodStats.sakit}</div>
          <span className="text-[10px] text-slate-400">Surat keterangan</span>
        </div>

        <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800">
          <span className="text-[11px] font-bold text-slate-300 block">Rata-rata Kehadiran</span>
          <div className="text-2xl font-black text-emerald-400 mt-1">{periodStats.avgAttendanceRate}%</div>
          <span className="text-[10px] text-slate-400">Tingkat disiplin</span>
        </div>
      </div>

      {/* Sub Tabs: Summary per Student vs Detailed Scan Logs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveSubTab('summary')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeSubTab === 'summary'
              ? 'bg-slate-800 text-white shadow-md'
              : 'text-slate-400 hover:bg-slate-900'
          }`}
        >
          Rekapitulasi Siswa ({studentRecapRows.length})
        </button>

        <button
          onClick={() => setActiveSubTab('logs')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeSubTab === 'logs'
              ? 'bg-slate-800 text-white shadow-md'
              : 'text-slate-400 hover:bg-slate-900'
          }`}
        >
          Log Detail Presensi ({periodRecords.length})
        </button>
      </div>

      {/* Main Table */}
      {activeSubTab === 'summary' ? (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase font-bold border-b border-slate-800">
                <tr>
                  <th className="p-3.5 text-center w-12">No</th>
                  <th className="p-3.5">NISN / Barcode</th>
                  <th className="p-3.5">Nama Siswa</th>
                  <th className="p-3.5">Kelas</th>
                  <th className="p-3.5 text-center text-emerald-400">H</th>
                  <th className="p-3.5 text-center text-amber-400">T</th>
                  <th className="p-3.5 text-center text-sky-400">I</th>
                  <th className="p-3.5 text-center text-blue-400">S</th>
                  <th className="p-3.5 text-center text-rose-400">A</th>
                  <th className="p-3.5 text-center">% Kehadiran</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {studentRecapRows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-slate-500">
                      Tidak ada data siswa yang cocok dengan filter pencarian.
                    </td>
                  </tr>
                ) : (
                  studentRecapRows.map((row) => (
                    <tr key={row.student.id} className="hover:bg-slate-950/50 transition-colors">
                      <td className="p-3 text-center text-slate-500 font-mono">{row.no}</td>
                      <td className="p-3 font-mono text-slate-400">{row.student.nisn}</td>
                      <td className="p-3 font-bold text-white">
                        <div className="flex items-center space-x-2">
                          <span>{row.student.name}</span>
                          <span className="text-[10px] text-slate-500 font-normal">
                            ({row.student.gender})
                          </span>
                        </div>
                      </td>
                      <td className="p-3 text-slate-300">{row.student.class}</td>
                      <td className="p-3 text-center font-mono font-bold text-emerald-400">
                        {row.hadir}
                      </td>
                      <td className="p-3 text-center font-mono font-bold text-amber-400">
                        {row.terlambat}
                      </td>
                      <td className="p-3 text-center font-mono text-sky-400">{row.izin}</td>
                      <td className="p-3 text-center font-mono text-blue-400">{row.sakit}</td>
                      <td className="p-3 text-center font-mono text-rose-400">{row.alpa}</td>
                      <td className="p-3 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold ${
                            row.rate >= 90
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : row.rate >= 75
                              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                              : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {row.rate}%
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Detailed Scan Log Table */
        <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase font-bold border-b border-slate-800">
                <tr>
                  <th className="p-3.5 text-center w-12">No</th>
                  <th className="p-3.5">Tanggal</th>
                  <th className="p-3.5">Waktu Scan</th>
                  <th className="p-3.5">Nama Siswa</th>
                  <th className="p-3.5">Kelas</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Metode</th>
                  <th className="p-3.5">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {periodRecords.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-500">
                      Tidak ada catatan pemindaian presensi pada periode ini.
                    </td>
                  </tr>
                ) : (
                  periodRecords.map((r, idx) => (
                    <tr key={r.id} className="hover:bg-slate-950/50 transition-colors">
                      <td className="p-3 text-center text-slate-500 font-mono">{idx + 1}</td>
                      <td className="p-3 font-mono text-slate-300">{r.date}</td>
                      <td className="p-3 font-mono text-emerald-400 font-bold">{r.time} WIB</td>
                      <td className="p-3 font-bold text-white">{r.studentName}</td>
                      <td className="p-3 text-slate-400">{r.class}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            r.status === 'HADIR'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : r.status === 'TERLAMBAT'
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : r.status === 'IZIN'
                              ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                              : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="p-3 text-slate-400 font-mono text-[11px]">{r.method}</td>
                      <td className="p-3 text-slate-400 italic">{r.notes || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
