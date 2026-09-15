import React, { useState, useEffect, useMemo } from 'react';
import {
  Send,
  AlertTriangle,
  Clock,
  CheckCircle2,
  BellRing,
  ExternalLink,
  History,
  Smartphone,
  Loader2,
  Trash2,
  CheckSquare,
  Square,
  Search,
  Calendar,
  Filter,
  Check,
} from 'lucide-react';
import { Student, AttendanceRecord, AppSettings, NotificationLog } from '../types';
import {
  formatLateMessage,
  formatAbsentMessage,
  createWhatsAppLink,
  sendCustomWAMessage,
} from '../utils/whatsapp';

interface NotificationViewProps {
  students: Student[];
  records: AttendanceRecord[];
  settings: AppSettings;
  logs: NotificationLog[];
  onLogNotification: (log: NotificationLog) => void;
  onDeleteLogs?: (logIds: string[]) => void;
  onClearAllLogs?: () => void;
}

export const NotificationView: React.FC<NotificationViewProps> = ({
  students,
  records,
  settings,
  logs,
  onLogNotification,
  onDeleteLogs,
  onClearAllLogs,
}) => {
  const [activeTab, setActiveTab] = useState<'pending' | 'logs'>('pending');
  const [sendingPhone, setSendingPhone] = useState<string | null>(null);
  const [isSendingBatch, setIsSendingBatch] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Checklist state for deleting messages
  const [selectedLogIds, setSelectedLogIds] = useState<string[]>([]);
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [logTypeFilter, setLogTypeFilter] = useState<'ALL' | 'LATE' | 'ABSENT'>('ALL');
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [deleteTargetMode, setDeleteTargetMode] = useState<'SELECTED' | 'ALL' | 'SINGLE'>('SELECTED');
  const [singleDeleteId, setSingleDeleteId] = useState<string | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];

  // Auto hide toast after 3.5 seconds
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  // Auto-prune previous day messages:
  // Messages are automatically deleted on the following day
  useEffect(() => {
    const oldLogIds = logs
      .filter((l) => l.date && l.date < todayStr)
      .map((l) => l.id);

    if (oldLogIds.length > 0 && onDeleteLogs) {
      onDeleteLogs(oldLogIds);
    }
  }, [logs, todayStr, onDeleteLogs]);

  // Today's active logs (only logs from today are kept and shown)
  const todayLogs = useMemo(() => {
    return logs.filter((l) => !l.date || l.date === todayStr);
  }, [logs, todayStr]);

  // Filtered logs for display in logs tab
  const filteredLogs = useMemo(() => {
    return todayLogs
      .filter((l) => {
        if (logTypeFilter === 'ALL') return true;
        return l.type === logTypeFilter;
      })
      .filter((l) => {
        if (!logSearchQuery.trim()) return true;
        const q = logSearchQuery.toLowerCase();
        return (
          l.studentName.toLowerCase().includes(q) ||
          l.parentPhone.toLowerCase().includes(q) ||
          l.message.toLowerCase().includes(q)
        );
      })
      .slice()
      .reverse();
  }, [todayLogs, logTypeFilter, logSearchQuery]);

  const todayRecords = records.filter((r) => r.date === todayStr);

  // Identify late students today
  const lateStudentsToday = todayRecords
    .filter((r) => r.status === 'TERLAMBAT')
    .map((r) => {
      const student = students.find((s) => s.id === r.studentId);
      return { record: r, student };
    })
    .filter((item): item is { record: AttendanceRecord; student: Student } => item.student !== undefined);

  // Identify absent students (not recorded at all today or marked ALPA)
  const scannedStudentIds = new Set(todayRecords.map((r) => r.studentId));
  const absentStudentsToday = students.filter(
    (s) => !scannedStudentIds.has(s.id)
  );

  const handleSendSingleWA = async (
    student: Student,
    type: 'LATE' | 'ABSENT',
    message: string
  ) => {
    setSendingPhone(student.parentPhone);

    const res = await sendCustomWAMessage(student.parentPhone, message, settings);
    setSendingPhone(null);

    if (res.success) {
      setToast({
        message: `Pesan WA berhasil terkirim ke orang tua ${student.name} via Bot Baileys!`,
        type: 'success',
      });
    } else {
      setToast({
        message: `Gagal dikirim via Bot WA: ${res.error || 'Server offline'}. Membuka wa.me...`,
        type: 'error',
      });
      const link = createWhatsAppLink(student.parentPhone, message);
      window.open(link, '_blank');
    }

    // Log in audit
    const newLog: NotificationLog = {
      id: `log-${Date.now()}-${student.id}`,
      studentId: student.id,
      studentName: student.name,
      parentPhone: student.parentPhone,
      type,
      message,
      sentAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      date: todayStr,
      status: res.success ? 'SENT' : 'FAILED',
    };

    onLogNotification(newLog);
  };

  const handleSendBatchAllWA = async () => {
    setIsSendingBatch(true);
    let successCount = 0;
    let failCount = 0;

    for (const std of absentStudentsToday) {
      const msg = formatAbsentMessage(std, settings);
      const res = await sendCustomWAMessage(std.parentPhone, msg, settings);
      if (res.success) successCount++;
      else failCount++;

      onLogNotification({
        id: `log-${Date.now()}-${std.id}`,
        studentId: std.id,
        studentName: std.name,
        parentPhone: std.parentPhone,
        type: 'ABSENT',
        message: msg,
        sentAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        date: todayStr,
        status: res.success ? 'SENT' : 'FAILED',
      });
    }

    for (const item of lateStudentsToday) {
      const msg = formatLateMessage(item.student, item.record.time, settings);
      const res = await sendCustomWAMessage(item.student.parentPhone, msg, settings);
      if (res.success) successCount++;
      else failCount++;

      onLogNotification({
        id: `log-${Date.now()}-${item.student.id}`,
        studentId: item.student.id,
        studentName: item.student.name,
        parentPhone: item.student.parentPhone,
        type: 'LATE',
        message: msg,
        sentAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        date: todayStr,
        status: res.success ? 'SENT' : 'FAILED',
      });
    }

    setIsSendingBatch(false);
    setToast({
      message: `Pengiriman Massal Selesai! ✅ Berhasil: ${successCount} | ❌ Gagal: ${failCount}`,
      type: successCount > 0 ? 'success' : 'error',
    });
  };

  // Checklist handlers
  const handleToggleSelectLog = (logId: string) => {
    setSelectedLogIds((prev) =>
      prev.includes(logId) ? prev.filter((id) => id !== logId) : [...prev, logId]
    );
  };

  const isAllSelected =
    filteredLogs.length > 0 &&
    filteredLogs.every((log) => selectedLogIds.includes(log.id));

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      // Deselect all filtered
      const filteredSet = new Set(filteredLogs.map((l) => l.id));
      setSelectedLogIds((prev) => prev.filter((id) => !filteredSet.has(id)));
    } else {
      // Select all filtered
      const combined = new Set([...selectedLogIds, ...filteredLogs.map((l) => l.id)]);
      setSelectedLogIds(Array.from(combined));
    }
  };

  const handleConfirmDelete = () => {
    if (deleteTargetMode === 'SINGLE' && singleDeleteId) {
      if (onDeleteLogs) {
        onDeleteLogs([singleDeleteId]);
      }
      setSelectedLogIds((prev) => prev.filter((id) => id !== singleDeleteId));
      setToast({ message: '1 pesan WhatsApp berhasil dihapus.', type: 'success' });
    } else if (deleteTargetMode === 'SELECTED') {
      if (selectedLogIds.length === 0) return;
      if (onDeleteLogs) {
        onDeleteLogs(selectedLogIds);
      }
      setToast({
        message: `${selectedLogIds.length} pesan WhatsApp berhasil dihapus.`,
        type: 'success',
      });
      setSelectedLogIds([]);
    } else if (deleteTargetMode === 'ALL') {
      if (onClearAllLogs) {
        onClearAllLogs();
      } else if (onDeleteLogs) {
        onDeleteLogs(todayLogs.map((l) => l.id));
      }
      setSelectedLogIds([]);
      setToast({ message: 'Seluruh pesan WhatsApp hari ini berhasil dibersihkan.', type: 'success' });
    }

    setShowDeleteConfirmModal(false);
    setSingleDeleteId(null);
  };

  return (
    <div className="space-y-6 relative">
      {/* Floating Auto-Dismiss Toast Notification */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 max-w-md px-4 py-3 rounded-2xl border shadow-2xl backdrop-blur-xl flex items-center space-x-3 transition-all animate-bounce-in bg-slate-900/95 border-emerald-500/50 text-emerald-300 ring-1 ring-emerald-500/30">
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span className="text-xs font-bold leading-relaxed">{toast.message}</span>
        </div>
      )}

      {/* Confirmation Modal for Deleting Messages */}
      {showDeleteConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-rose-400">
              <div className="p-3 bg-rose-500/10 rounded-xl border border-rose-500/20">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Konfirmasi Hapus Pesan</h3>
                <p className="text-xs text-slate-400">Tindakan ini tidak dapat dibatalkan</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
              {deleteTargetMode === 'SINGLE' && 'Apakah Anda yakin ingin menghapus 1 riwayat pesan WhatsApp ini?'}
              {deleteTargetMode === 'SELECTED' &&
                `Apakah Anda yakin ingin menghapus ${selectedLogIds.length} pesan WhatsApp yang dipilih dari sistem?`}
              {deleteTargetMode === 'ALL' &&
                'Apakah Anda yakin ingin menghapus SEMUA riwayat pesan WhatsApp hari ini?'}
            </p>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirmModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 transition shadow-lg shadow-rose-600/20 flex items-center space-x-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Ya, Hapus Pesan</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-5 rounded-2xl border border-slate-800 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <BellRing className="w-5 h-5 text-amber-400 animate-pulse" />
            Pusat Notifikasi Otomatis WhatsApp Ortu
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Kirim peringatan otomatis ke WhatsApp orang tua siswa yang terlambat atau belum hadir melebihi jam batas masuk ({settings.cutoffTime} WIB).
          </p>
        </div>

        <button
          onClick={handleSendBatchAllWA}
          disabled={isSendingBatch}
          className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm rounded-xl flex items-center space-x-2 transition-all shadow-md shadow-emerald-500/20 shrink-0 disabled:opacity-50"
        >
          {isSendingBatch ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          <span>{isSendingBatch ? 'Mengirim Massal via Bot...' : 'Kirim Notifikasi Massal via Bot'}</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'pending'
              ? 'bg-amber-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:bg-slate-800'
          }`}
        >
          Daftar Peringatan Hari Ini ({absentStudentsToday.length + lateStudentsToday.length})
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'logs'
              ? 'bg-emerald-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:bg-slate-800'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Riwayat Pesan Terkirim ({todayLogs.length})</span>
        </button>
      </div>

      {activeTab === 'pending' && (
        <div className="space-y-6">
          {/* Section 1: Belum Hadir / Alpa Past Cutoff Time */}
          <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-md space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
                <h3 className="font-bold text-white text-sm">
                  Siswa Belum Presensi Melebihi Batas ({settings.cutoffTime} WIB) (
                  <span className="text-rose-400">{absentStudentsToday.length} Siswa</span>)
                </h3>
              </div>
            </div>

            {absentStudentsToday.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                Semua siswa sudah melakukan presensi hari ini.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {absentStudentsToday.map((std) => {
                  const msg = formatAbsentMessage(std, settings);

                  return (
                    <div
                      key={std.id}
                      className="p-4 bg-slate-950 rounded-xl border border-rose-500/30 space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-bold text-white text-xs">{std.name}</h4>
                          <p className="text-[11px] text-slate-400">
                            NISN: {std.nisn} • Kelas: {std.class}
                          </p>
                          <p className="text-[11px] text-slate-300 font-mono mt-1">
                            WA Ortu: {std.parentPhone}
                          </p>
                        </div>
                        <span className="bg-rose-500/20 text-rose-300 font-bold text-[10px] px-2 py-0.5 rounded border border-rose-500/30">
                          ALPA
                        </span>
                      </div>

                      <div className="p-2.5 bg-slate-900 rounded-lg text-[11px] text-slate-300 italic border border-slate-800">
                        "{msg}"
                      </div>

                      <button
                        onClick={() => handleSendSingleWA(std, 'ABSENT', msg)}
                        disabled={sendingPhone === std.parentPhone}
                        className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg flex items-center justify-center space-x-2 transition-colors shadow-md disabled:opacity-50"
                      >
                        <Smartphone className="w-3.5 h-3.5" />
                        <span>
                          {sendingPhone === std.parentPhone ? 'Mengirim...' : `Kirim WA ke ${std.parentPhone}`}
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 2: Terlambat Today */}
          <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-md space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Clock className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-white text-sm">
                  Siswa Terlambat Presensi Hari Ini (
                  <span className="text-amber-400">{lateStudentsToday.length} Siswa</span>)
                </h3>
              </div>
            </div>

            {lateStudentsToday.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                Tidak ada siswa yang tercatat terlambat hari ini.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {lateStudentsToday.map(({ student, record }) => {
                  const msg = formatLateMessage(student, record.time, settings);

                  return (
                    <div
                      key={record.id}
                      className="p-4 bg-slate-950 rounded-xl border border-amber-500/30 space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-bold text-white text-xs">{student.name}</h4>
                          <p className="text-[11px] text-slate-400">
                            NISN: {student.nisn} • Kelas: {student.class}
                          </p>
                          <p className="text-[11px] text-amber-300 font-mono mt-0.5">
                            Jam Scan: {record.time} WIB ({record.notes})
                          </p>
                        </div>
                        <span className="bg-amber-500/20 text-amber-300 font-bold text-[10px] px-2 py-0.5 rounded border border-amber-500/30">
                          TERLAMBAT
                        </span>
                      </div>

                      <div className="p-2.5 bg-slate-900 rounded-lg text-[11px] text-slate-300 italic border border-slate-800">
                        "{msg}"
                      </div>

                      <button
                        onClick={() => handleSendSingleWA(student, 'LATE', msg)}
                        disabled={sendingPhone === student.parentPhone}
                        className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg flex items-center justify-center space-x-2 transition-colors shadow-md disabled:opacity-50"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>
                          {sendingPhone === student.parentPhone ? 'Mengirim...' : 'Kirim Notifikasi WA'}
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: RIWAYAT PESAN DENGAN MODEL CHECKLIST & HAPUS OTOMATIS */}
      {activeTab === 'logs' && (
        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-md space-y-4">
          {/* Header with Auto-Delete Notice */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <History className="w-4 h-4 text-emerald-400" />
                Riwayat Pesan WhatsApp Terkirim
              </h3>
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-400/90 font-medium mt-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>Pesan otomatis terhapus di hari selanjutnya (Hanya menyimpan log hari ini)</span>
              </div>
            </div>

            {/* Bulk Action Controls */}
            <div className="flex flex-wrap items-center gap-2">
              {selectedLogIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setDeleteTargetMode('SELECTED');
                    setShowDeleteConfirmModal(true);
                  }}
                  className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl flex items-center space-x-1.5 transition-all shadow-md shadow-rose-600/20 animate-pulse"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus Terpilih ({selectedLogIds.length})</span>
                </button>
              )}

              {todayLogs.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setDeleteTargetMode('ALL');
                    setShowDeleteConfirmModal(true);
                  }}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-rose-900/40 text-slate-300 hover:text-rose-300 font-medium text-xs rounded-xl border border-slate-700 hover:border-rose-500/40 flex items-center space-x-1.5 transition-all"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Hapus Semua Hari Ini</span>
                </button>
              )}
            </div>
          </div>

          {/* Checklist Master Toolbar: Search, Filter, Checklist All */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
            {/* Left: Checklist All toggle */}
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={handleToggleSelectAll}
                disabled={filteredLogs.length === 0}
                className="flex items-center space-x-2 text-xs font-semibold text-slate-200 hover:text-emerald-400 transition-colors disabled:opacity-40"
              >
                {isAllSelected ? (
                  <CheckSquare className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Square className="w-4 h-4 text-slate-500" />
                )}
                <span>Checklist Semua ({filteredLogs.length})</span>
              </button>

              {selectedLogIds.length > 0 && (
                <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  {selectedLogIds.length} dipilih
                </span>
              )}
            </div>

            {/* Right: Search and Type Filter */}
            <div className="flex items-center space-x-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={logSearchQuery}
                  onChange={(e) => setLogSearchQuery(e.target.value)}
                  placeholder="Cari siswa/no WA..."
                  className="bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <select
                value={logTypeFilter}
                onChange={(e) => setLogTypeFilter(e.target.value as any)}
                className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
              >
                <option value="ALL">Semua Tipe</option>
                <option value="LATE">Terlambat</option>
                <option value="ABSENT">Alpa</option>
              </select>
            </div>
          </div>

          {/* Messages List with Checkboxes */}
          {filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-slate-500 space-y-2">
              <History className="w-8 h-8 mx-auto text-slate-600" />
              <p className="text-xs font-medium">
                {todayLogs.length === 0
                  ? 'Belum ada pesan WhatsApp yang dikirim hari ini.'
                  : 'Tidak ada pesan yang sesuai dengan filter pencarian.'}
              </p>
              <p className="text-[11px] text-slate-600">
                Pesan dari hari-hari sebelumnya otomatis dihapus saat sistem dibuka setiap hari baru.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredLogs.map((log) => {
                const isSelected = selectedLogIds.includes(log.id);

                return (
                  <div
                    key={log.id}
                    className={`p-3.5 rounded-xl border transition-all flex items-start gap-3 ${
                      isSelected
                        ? 'bg-emerald-950/20 border-emerald-500/50 shadow-sm'
                        : 'bg-slate-950 rounded-xl border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {/* Checkbox */}
                    <button
                      type="button"
                      onClick={() => handleToggleSelectLog(log.id)}
                      className="mt-0.5 text-slate-400 hover:text-emerald-400 shrink-0 transition"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-600" />
                      )}
                    </button>

                    {/* Message Body */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            log.type === 'LATE'
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-rose-500/20 text-rose-300'
                          }`}
                        >
                          {log.type === 'LATE' ? 'TERLAMBAT' : 'ALPA'}
                        </span>
                        <span className="text-xs font-bold text-white">{log.studentName}</span>
                        <span className="text-[11px] font-mono text-slate-400">
                          ({log.parentPhone})
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1.5 italic bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/60 break-words">
                        "{log.message}"
                      </p>
                    </div>

                    {/* Status & Single Delete */}
                    <div className="text-right shrink-0 flex flex-col items-end space-y-2">
                      <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        ✓ TERKIRIM
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {log.sentAt}
                      </span>

                      {/* Single message delete button */}
                      <button
                        type="button"
                        onClick={() => {
                          setSingleDeleteId(log.id);
                          setDeleteTargetMode('SINGLE');
                          setShowDeleteConfirmModal(true);
                        }}
                        title="Hapus pesan ini"
                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
