import React, { useState, useMemo } from 'react';
import {
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileCheck2,
  Send,
  TrendingUp,
  BarChart3,
  Calendar,
  Sparkles,
  ArrowRight,
  Filter,
  Activity,
  Check,
  UserX,
  HeartPulse,
  BadgeAlert,
  ChevronRight,
  CalendarDays,
  ShieldAlert,
} from 'lucide-react';
import { Student, AttendanceRecord, AppSettings, PermissionRequest } from '../types';
import { getActiveSchedule, getActiveScheduleForClass } from '../utils/schedule';

interface DashboardViewProps {
  students: Student[];
  records: AttendanceRecord[];
  permissions?: PermissionRequest[];
  settings: AppSettings;
  onOpenNotifications: () => void;
  onOpenPermissions: () => void;
  onEvaluateAlpha?: (targetDate?: string, targetClass?: string) => number;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  students,
  records,
  permissions = [],
  settings,
  onOpenNotifications,
  onOpenPermissions,
  onEvaluateAlpha,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedClass, setSelectedClass] = useState('ALL');
  const [evaluationFeedback, setEvaluationFeedback] = useState<string | null>(null);

  // Filter students based on selected class
  const filteredStudents = useMemo(() => {
    return selectedClass === 'ALL'
      ? students
      : students.filter((s) => s.class === selectedClass);
  }, [students, selectedClass]);

  // Filter records for the selected specific single day & class
  const dayRecords = useMemo(() => {
    return records.filter(
      (r) =>
        r.date === selectedDate &&
        (selectedClass === 'ALL' || r.class === selectedClass)
    );
  }, [records, selectedDate, selectedClass]);

  // Filter permissions for the selected date & class
  const dayPermissions = useMemo(() => {
    return permissions.filter(
      (p) =>
        p.date === selectedDate &&
        (selectedClass === 'ALL' || p.class === selectedClass)
    );
  }, [permissions, selectedDate, selectedClass]);

  // Calculate active schedule for the selected date & class
  const selectedDateObj = useMemo(() => new Date(`${selectedDate}T00:00:00`), [selectedDate]);
  const activeScheduleForSelectedDate = useMemo(() => {
    return getActiveScheduleForClass(
      settings,
      selectedClass !== 'ALL' ? selectedClass : undefined,
      selectedDateObj
    );
  }, [settings, selectedClass, selectedDateObj]);

  const totalStudents = filteredStudents.length;
  const hadirCount = dayRecords.filter((r) => r.status === 'HADIR').length;
  const terlambatCount = dayRecords.filter((r) => r.status === 'TERLAMBAT').length;
  const izinCount = dayRecords.filter((r) => r.status === 'IZIN').length;
  const sakitCount = dayRecords.filter((r) => r.status === 'SAKIT').length;
  const alpaRecorded = dayRecords.filter((r) => r.status === 'ALPA').length;

  const scannedStudentIds = new Set(dayRecords.map((r) => r.studentId));
  const unrecordedStudents = filteredStudents.filter((s) => !scannedStudentIds.has(s.id));
  const unrecordedCount = unrecordedStudents.length;
  const totalAbsentUnexcused = unrecordedCount + alpaRecorded;

  // Siswa yang belum absen dan tidak ada izin orang tua
  const unrecordedWithoutPermission = useMemo(() => {
    return unrecordedStudents.filter(
      (s) => !dayPermissions.some((p) => p.nisn === s.nisn)
    );
  }, [unrecordedStudents, dayPermissions]);

  const handleRunAlphaEvaluation = () => {
    if (onEvaluateAlpha) {
      const count = onEvaluateAlpha(selectedDate, selectedClass);
      setEvaluationFeedback(
        `Berhasil memproses & mencatat ${count} siswa tanpa izin orang tua sebagai ALPA untuk tanggal ${selectedDate}.`
      );
      setTimeout(() => setEvaluationFeedback(null), 5000);
    }
  };

  const totalAttended = hadirCount + terlambatCount;
  const presentPercentage =
    totalStudents > 0 ? Math.round((totalAttended / totalStudents) * 100) : 0;

  // Distinct classes list
  const classesList = useMemo(() => {
    return Array.from(new Set(students.map((s) => s.class))).sort();
  }, [students]);

  // Per-class analytics for the selected day
  const classStats = useMemo(() => {
    return classesList.map((cls) => {
      const clsStudents = students.filter((s) => s.class === cls);
      const clsDayRecords = records.filter(
        (r) => r.date === selectedDate && r.class === cls
      );
      const hadir = clsDayRecords.filter((r) => r.status === 'HADIR').length;
      const terlambat = clsDayRecords.filter((r) => r.status === 'TERLAMBAT').length;
      const izin = clsDayRecords.filter((r) => r.status === 'IZIN').length;
      const sakit = clsDayRecords.filter((r) => r.status === 'SAKIT').length;
      const present = hadir + terlambat;
      const rate =
        clsStudents.length > 0
          ? Math.round((present / clsStudents.length) * 100)
          : 0;

      return {
        className: cls,
        total: clsStudents.length,
        hadir,
        terlambat,
        izin,
        sakit,
        present,
        rate,
      };
    });
  }, [classesList, students, records, selectedDate]);

  // Hourly / Scan Time Breakdown for the chosen date
  const timeBuckets = useMemo(() => {
    const buckets: { label: string; count: number; terlambat: number }[] = [
      { label: '< 06.30', count: 0, terlambat: 0 },
      { label: '06.30 - 06.45', count: 0, terlambat: 0 },
      { label: '06.45 - 07.00', count: 0, terlambat: 0 },
      { label: '07.00 - 07.15', count: 0, terlambat: 0 },
      { label: '> 07.15 (Terlambat)', count: 0, terlambat: 0 },
    ];

    dayRecords.forEach((r) => {
      const t = r.time || '07:00';
      if (t < '06:30') {
        buckets[0].count++;
        if (r.status === 'TERLAMBAT') buckets[0].terlambat++;
      } else if (t < '06:45') {
        buckets[1].count++;
        if (r.status === 'TERLAMBAT') buckets[1].terlambat++;
      } else if (t < '07:00') {
        buckets[2].count++;
        if (r.status === 'TERLAMBAT') buckets[2].terlambat++;
      } else if (t <= '07:15') {
        buckets[3].count++;
        if (r.status === 'TERLAMBAT') buckets[3].terlambat++;
      } else {
        buckets[4].count++;
        if (r.status === 'TERLAMBAT') buckets[4].terlambat++;
      }
    });

    return buckets;
  }, [dayRecords]);

  // Gender Attendance Analytics for the chosen day
  const genderStats = useMemo(() => {
    let maleTotal = 0;
    let femaleTotal = 0;
    let malePresent = 0;
    let femalePresent = 0;

    filteredStudents.forEach((s) => {
      if (s.gender === 'L') maleTotal++;
      else femaleTotal++;
    });

    dayRecords.forEach((r) => {
      const std = students.find((s) => s.id === r.studentId);
      if (std && (r.status === 'HADIR' || r.status === 'TERLAMBAT')) {
        if (std.gender === 'L') malePresent++;
        else femalePresent++;
      }
    });

    return {
      maleTotal,
      femaleTotal,
      malePresent,
      femalePresent,
      maleRate: maleTotal > 0 ? Math.round((malePresent / maleTotal) * 100) : 0,
      femaleRate: femaleTotal > 0 ? Math.round((femalePresent / femaleTotal) * 100) : 0,
    };
  }, [filteredStudents, dayRecords, students]);

  // Top Frequent Late Students leaderboard
  const lateLeaderboard = useMemo(() => {
    const studentLateCountMap: Record<string, number> = {};
    records.forEach((r) => {
      if (r.status === 'TERLAMBAT') {
        studentLateCountMap[r.studentId] = (studentLateCountMap[r.studentId] || 0) + 1;
      }
    });

    return Object.entries(studentLateCountMap)
      .map(([studentId, count]) => {
        const student = students.find((s) => s.id === studentId);
        return { student, count };
      })
      .filter((item): item is { student: Student; count: number } => item.student !== undefined)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [records, students]);

  // Format date display in Indonesian
  const formattedSelectedDate = useMemo(() => {
    const parts = selectedDate.split('-');
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      return d.toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    }
    return selectedDate;
  }, [selectedDate]);

  const isToday = selectedDate === todayStr;

  return (
    <div className="space-y-6">
      {/* Top Analytical Date & Class Selector Bar */}
      <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                <BarChart3 className="w-5 h-5" />
              </span>
              <h2 className="text-lg font-black text-white">Dasbor Analitik Presensi Harian</h2>
              {isToday && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  ● Hari Ini
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Analisis metrik presensi untuk tanggal{' '}
              <strong className="text-slate-200">{formattedSelectedDate}</strong>
            </p>
          </div>

          {/* Controls: Date Picker & Class Filter */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Quick Today Button */}
            {!isToday && (
              <button
                onClick={() => setSelectedDate(todayStr)}
                className="px-3 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span>Lihat Hari Ini</span>
              </button>
            )}

            {/* Date Input */}
            <div className="relative">
              <Calendar className="w-4 h-4 text-emerald-400 absolute left-3 top-2.5" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono font-bold text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Class Filter */}
            <div className="relative">
              <Filter className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
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
        </div>
      </div>

      {/* Main KPI Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Total Siswa */}
        <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold">Total Siswa</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-white">{totalStudents}</div>
          <div className="text-[10px] text-slate-400 mt-1">Terdaftar di Rombel</div>
        </div>

        {/* Hadir Tepat Waktu */}
        <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-emerald-400 mb-2">
            <span className="text-[11px] font-bold">Hadir Tepat</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400">{hadirCount}</div>
          <div className="text-[10px] text-slate-400 mt-1">
            {totalStudents > 0 ? Math.round((hadirCount / totalStudents) * 100) : 0}% dari siswa
          </div>
        </div>

        {/* Terlambat */}
        <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-amber-400 mb-2">
            <span className="text-[11px] font-bold">Terlambat</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400">{terlambatCount}</div>
          <div className="text-[10px] text-slate-400 mt-1">&gt; {activeScheduleForSelectedDate.cutoffTime} WIB</div>
        </div>

        {/* Izin */}
        <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-sky-400 mb-2">
            <span className="text-[11px] font-bold">Izin</span>
            <FileCheck2 className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-black text-sky-400">{izinCount}</div>
          <div className="text-[10px] text-slate-400 mt-1">Acara/Keluarga</div>
        </div>

        {/* Sakit */}
        <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-blue-400 mb-2">
            <span className="text-[11px] font-bold">Sakit</span>
            <HeartPulse className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-blue-400">{sakitCount}</div>
          <div className="text-[10px] text-slate-400 mt-1">Surat/WA</div>
        </div>

        {/* Alpa / Belum Absen */}
        <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-rose-400 mb-2">
            <span className="text-[11px] font-bold">Alpa / Belum</span>
            <UserX className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-black text-rose-400">{totalAbsentUnexcused}</div>
          <div className="text-[10px] text-slate-400 mt-1">
            {alpaRecorded > 0 ? `${alpaRecorded} Alpa tercatat` : 'Tanpa izin ortu'}
          </div>
        </div>
      </div>

      {/* Feedback Toast after Alpha Evaluation */}
      {evaluationFeedback && (
        <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl flex items-center justify-between text-xs text-emerald-300 animate-fadeIn">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{evaluationFeedback}</span>
          </div>
          <button
            onClick={() => setEvaluationFeedback(null)}
            className="text-slate-400 hover:text-white text-xs font-bold px-2 py-0.5"
          >
            ✕
          </button>
        </div>
      )}

      {/* Action Banner: Siswa Tanpa Keterangan -> Tetapkan ALPA Otomatis */}
      {unrecordedWithoutPermission.length > 0 && onEvaluateAlpha && (
        <div className="bg-gradient-to-r from-rose-950/40 via-slate-900 to-slate-900 p-4 sm:p-5 rounded-2xl border border-rose-500/30 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/30 shrink-0 mt-0.5">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-white">
                  {unrecordedWithoutPermission.length} Siswa Tidak Hadir Tanpa Izin Orang Tua
                </h4>
                <span className="px-2 py-0.5 bg-rose-500/20 text-rose-300 text-[10px] font-mono font-bold rounded-md">
                  {selectedDate}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Siswa tidak melakukan scan barcode dan tidak ada permohonan izin (Sakit/Izin) dari orang tua via WhatsApp. Sesuai aturan, siswa akan terdata sebagai <strong>ALPA</strong>.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <button
              onClick={handleRunAlphaEvaluation}
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-md shadow-rose-600/25 flex items-center gap-2 transition-all cursor-pointer active:scale-95"
            >
              <UserX className="w-4 h-4" />
              <span>Tetapkan {unrecordedWithoutPermission.length} Siswa sebagai ALPA</span>
            </button>
          </div>
        </div>
      )}

      {/* Analytics Mid Section: Daily Attendance Gauge + Arrival Hourly Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Attendance Rate Meter Card */}
        <div className="lg:col-span-5 bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                Tingkat Kehadiran {isToday ? 'Hari Ini' : 'Tanggal Terpilih'}
              </h3>
              <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                {totalAttended} / {totalStudents} Hadir
              </span>
            </div>

            {/* Visual Circular/Linear Meter */}
            <div className="my-3 space-y-2">
              <div className="flex items-end justify-between">
                <div>
                  <span className="text-4xl font-black text-white">{presentPercentage}%</span>
                  <span className="text-xs text-slate-400 ml-2">Partisipasi Siswa</span>
                </div>
                <span className="text-xs font-bold text-slate-300">
                  Target: {settings.cutoffTime ? '95%' : '90%'}
                </span>
              </div>

              {/* Stacked Percentage Bar */}
              <div className="w-full h-4 bg-slate-950 rounded-full overflow-hidden flex border border-slate-800">
                <div
                  style={{ width: `${totalStudents > 0 ? (hadirCount / totalStudents) * 100 : 0}%` }}
                  className="bg-emerald-500 h-full transition-all duration-500"
                  title={`Hadir: ${hadirCount}`}
                />
                <div
                  style={{ width: `${totalStudents > 0 ? (terlambatCount / totalStudents) * 100 : 0}%` }}
                  className="bg-amber-400 h-full transition-all duration-500"
                  title={`Terlambat: ${terlambatCount}`}
                />
                <div
                  style={{ width: `${totalStudents > 0 ? (izinCount / totalStudents) * 100 : 0}%` }}
                  className="bg-sky-400 h-full transition-all duration-500"
                  title={`Izin: ${izinCount}`}
                />
                <div
                  style={{ width: `${totalStudents > 0 ? (sakitCount / totalStudents) * 100 : 0}%` }}
                  className="bg-blue-400 h-full transition-all duration-500"
                  title={`Sakit: ${sakitCount}`}
                />
                <div
                  style={{ width: `${totalStudents > 0 ? (totalAbsentUnexcused / totalStudents) * 100 : 0}%` }}
                  className="bg-rose-500/40 h-full transition-all duration-500"
                  title={`Alpa: ${totalAbsentUnexcused}`}
                />
              </div>

              {/* Legend */}
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 pt-2 text-[10px] text-slate-400 font-semibold">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span>Hadir ({hadirCount})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <span>Terlambat ({terlambatCount})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                  <span>Izin ({izinCount})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                  <span>Sakit ({sakitCount})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <span>Alpa ({totalAbsentUnexcused})</span>
                </div>
              </div>
            </div>
          </div>

          {/* Gender Ratio breakdown */}
          <div className="pt-4 border-t border-slate-800 grid grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400 block text-[11px] font-semibold">Siswa Laki-laki (L)</span>
              <div className="flex items-baseline justify-between mt-1">
                <strong className="text-white font-mono text-sm">
                  {genderStats.malePresent} / {genderStats.maleTotal}
                </strong>
                <span className="text-emerald-400 font-bold text-xs">{genderStats.maleRate}%</span>
              </div>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400 block text-[11px] font-semibold">Siswa Perempuan (P)</span>
              <div className="flex items-baseline justify-between mt-1">
                <strong className="text-white font-mono text-sm">
                  {genderStats.femalePresent} / {genderStats.femaleTotal}
                </strong>
                <span className="text-emerald-400 font-bold text-xs">{genderStats.femaleRate}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Hourly Arrival Distribution Chart */}
        <div className="lg:col-span-7 bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-sky-400" />
                Distribusi Waktu Scan Kedatangan Siswa
              </h3>
              <span className="text-[11px] text-slate-400 font-medium">Batas: {activeScheduleForSelectedDate.cutoffTime} WIB ({activeScheduleForSelectedDate.scheduleName})</span>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Pola lonjakan kedatangan siswa di gerbang sekolah pada tanggal {selectedDate}.
            </p>

            {/* Time Histogram Bars */}
            <div className="space-y-2.5">
              {timeBuckets.map((bucket, idx) => {
                const maxCount = Math.max(...timeBuckets.map((b) => b.count), 1);
                const percent = Math.round((bucket.count / maxCount) * 100);

                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-mono text-slate-300 font-bold">{bucket.label}</span>
                      <span className="font-mono font-bold text-white">
                        {bucket.count} Siswa {bucket.terlambat > 0 && <span className="text-amber-400 font-normal">({bucket.terlambat} Terlambat)</span>}
                      </span>
                    </div>
                    <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800 flex">
                      <div
                        style={{ width: `${percent}%` }}
                        className={`h-full rounded-full transition-all duration-500 ${
                          idx === 4 ? 'bg-amber-500' : 'bg-sky-500'
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 mt-3">
            <span>
              💡 Rekomendasi: Buka 2 scanner gerbang jika lonjakan padat pada jam 06.45 - 07.00.
            </span>
          </div>
        </div>
      </div>

      {/* Class by Class Attendance Comparison Table & Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Class Breakdown List */}
        <div className="lg:col-span-8 bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-emerald-400" />
              Perbandingan Kehadiran per Kelas ({selectedDate})
            </h3>
            <span className="text-xs text-slate-400">{classStats.length} Rombel</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase font-bold border-b border-slate-800">
                <tr>
                  <th className="p-3">Kelas</th>
                  <th className="p-3 text-center">Total</th>
                  <th className="p-3 text-center text-emerald-400">Hadir</th>
                  <th className="p-3 text-center text-amber-400">Terlambat</th>
                  <th className="p-3 text-center text-sky-400">Izin/Sakit</th>
                  <th className="p-3">Persentase</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {classStats.map((cs) => (
                  <tr key={cs.className} className="hover:bg-slate-950/40 transition-colors">
                    <td className="p-3 font-bold text-white">{cs.className}</td>
                    <td className="p-3 text-center font-mono">{cs.total}</td>
                    <td className="p-3 text-center font-mono text-emerald-400 font-bold">{cs.hadir}</td>
                    <td className="p-3 text-center font-mono text-amber-400 font-bold">{cs.terlambat}</td>
                    <td className="p-3 text-center font-mono text-sky-400">{cs.izin + cs.sakit}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                          <div
                            style={{ width: `${cs.rate}%` }}
                            className={`h-full ${
                              cs.rate >= 90
                                ? 'bg-emerald-500'
                                : cs.rate >= 75
                                ? 'bg-amber-400'
                                : 'bg-rose-500'
                            }`}
                          />
                        </div>
                        <span className="font-mono font-bold text-slate-200">{cs.rate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Frequent Late Leaderboard & Quick Action */}
        <div className="lg:col-span-4 space-y-6">
          {/* Top 5 Sering Terlambat */}
          <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-md">
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <BadgeAlert className="w-4 h-4 text-amber-400" />
              Siswa Sering Terlambat (Akumulasi)
            </h3>
            <p className="text-xs text-slate-400 mb-3">
              Perlu perhatian khusus dan bimbingan wali kelas.
            </p>

            <div className="space-y-2.5">
              {lateLeaderboard.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-xs">
                  Belum ada catatan siswa terlambat. Bagus!
                </div>
              ) : (
                lateLeaderboard.map((item, idx) => (
                  <div
                    key={item.student.id}
                    className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-2.5">
                      <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 text-[11px] font-black flex items-center justify-center">
                        #{idx + 1}
                      </span>
                      <div>
                        <div className="text-xs font-bold text-white truncate max-w-[130px]">
                          {item.student.name}
                        </div>
                        <div className="text-[10px] text-slate-400">{item.student.class}</div>
                      </div>
                    </div>
                    <span className="px-2 py-1 bg-amber-500/15 text-amber-300 border border-amber-500/30 rounded-lg text-[10px] font-black font-mono">
                      {item.count}x Terlambat
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick Navigations */}
          <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-md space-y-2.5">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Akses Cepat Pengelolaan
            </h3>

            <button
              onClick={onOpenPermissions}
              className="w-full p-3 bg-slate-950 hover:bg-slate-800/80 rounded-xl border border-slate-800 text-left flex items-center justify-between group transition-all"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center">
                  <FileCheck2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors">
                    Perizinan Siswa (WA)
                  </div>
                  <div className="text-[10px] text-slate-400">Persetujuan sakit & izin</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
            </button>

            <button
              onClick={onOpenNotifications}
              className="w-full p-3 bg-slate-950 hover:bg-slate-800/80 rounded-xl border border-slate-800 text-left flex items-center justify-between group transition-all"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors">
                    Riwayat WhatsApp
                  </div>
                  <div className="text-[10px] text-slate-400">Log pengiriman pesan ortu</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
