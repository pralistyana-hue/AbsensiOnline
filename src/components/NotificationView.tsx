import React, { useState, useEffect } from 'react';
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
}

export const NotificationView: React.FC<NotificationViewProps> = ({
  students,
  records,
  settings,
  logs,
  onLogNotification,
}) => {
  const [activeTab, setActiveTab] = useState<'pending' | 'logs'>('pending');
  const [sendingPhone, setSendingPhone] = useState<string | null>(null);
  const [isSendingBatch, setIsSendingBatch] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Auto hide toast after 3.5 seconds
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const todayStr = new Date().toISOString().split('T')[0];
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
      id: `log-${Date.now()}`,
      studentId: student.id,
      studentName: student.name,
      parentPhone: student.parentPhone,
      type,
      message,
      sentAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
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
        status: res.success ? 'SENT' : 'FAILED',
      });
    }

    setIsSendingBatch(false);
    setToast({
      message: `Pengiriman Massal Selesai! ✅ Berhasil: ${successCount} | ❌ Gagal: ${failCount}`,
      type: successCount > 0 ? 'success' : 'error',
    });
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
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'logs'
              ? 'bg-emerald-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:bg-slate-800'
          }`}
        >
          Riwayat Notifikasi Terkirim ({logs.length})
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
                  Siswa Belum Presensi / Alpa (
                  <span className="text-rose-400">{absentStudentsToday.length} Siswa</span>)
                </h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                Batas Jam Masuk: {settings.cutoffTime} WIB
              </span>
            </div>

            {absentStudentsToday.length === 0 ? (
              <div className="py-6 text-center text-xs text-emerald-400 font-semibold flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>Semua siswa telah melakukan presensi hari ini!</span>
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
                        className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg flex items-center justify-center space-x-2 transition-colors shadow-md"
                      >
                        <Smartphone className="w-3.5 h-3.5" />
                        <span>Kirim WA ke {std.parentPhone}</span>
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
                        className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg flex items-center justify-center space-x-2 transition-colors shadow-md"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Kirim Notifikasi WA</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-md">
          <h3 className="font-bold text-white text-sm mb-4 flex items-center gap-2">
            <History className="w-4 h-4 text-emerald-400" />
            Riwayat Log Notifikasi Terkirim
          </h3>

          {logs.length === 0 ? (
            <div className="text-center py-12 text-slate-500 space-y-2">
              <History className="w-8 h-8 mx-auto text-slate-600" />
              <p className="text-xs">Belum ada notifikasi yang pernah dikirim.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {logs
                .slice()
                .reverse()
                .map((log) => (
                  <div
                    key={log.id}
                    className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-start justify-between"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
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
                      <p className="text-xs text-slate-300 mt-1 italic">"{log.message}"</p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        ✓ TERKIRIM
                      </span>
                      <span className="text-[10px] text-slate-500 block font-mono mt-1">
                        {log.sentAt}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
