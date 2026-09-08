import React, { useState, useEffect, useMemo } from 'react';
import {
  MessageSquareText,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  Plus,
  Copy,
  Check,
  UserCheck,
  HelpCircle,
  FileText,
  AlertTriangle,
  Search,
  Filter,
  Calendar,
  Printer,
  X,
  Phone,
  Eye,
  User,
  ShieldCheck,
  FileCheck2,
} from 'lucide-react';
import { Student, PermissionRequest, AppSettings, HomeroomTeacher, NotificationLog } from '../types';
import {
  parseWhatsAppPermission,
  createWhatsAppLink,
  formatApprovedMessage,
  formatTeacherPermissionAlert,
  getTeacherForClass,
  sendCustomWAMessage,
} from '../utils/whatsapp';
import { exportPermissionsToPDF } from '../utils/exportUtils';

interface PermissionViewProps {
  students: Student[];
  permissions: PermissionRequest[];
  teachers?: HomeroomTeacher[];
  settings: AppSettings;
  onApprovePermission: (permission: PermissionRequest) => void;
  onRejectPermission: (permissionId: string) => void;
  onSubmitPermission: (newPerm: PermissionRequest) => void;
  onLogNotification?: (log: NotificationLog) => void;
}

export const PermissionView: React.FC<PermissionViewProps> = ({
  students,
  permissions,
  teachers = [],
  settings,
  onApprovePermission,
  onRejectPermission,
  onSubmitPermission,
  onLogNotification,
}) => {
  // Input form state
  const [pasteMessage, setPasteMessage] = useState('');
  const [manualNisn, setManualNisn] = useState('');
  const [manualType, setManualType] = useState<'IZIN' | 'SAKIT'>('IZIN');
  const [manualReason, setManualReason] = useState('');
  const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0]);
  const [copiedFormat, setCopiedFormat] = useState(false);
  const [showInputPanel, setShowInputPanel] = useState(false);

  // Filters state
  const [filterSearch, setFilterSearch] = useState('');
  const [filterClass, setFilterClass] = useState('ALL');
  const [filterDate, setFilterDate] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [filterType, setFilterType] = useState<'ALL' | 'IZIN' | 'SAKIT'>('ALL');

  // Modal detail state
  const [selectedPermission, setSelectedPermission] = useState<PermissionRequest | null>(null);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const [parseResult, setParseResult] = useState<{
    student?: Student;
    type?: 'IZIN' | 'SAKIT';
    reason?: string;
    date?: string;
    isValid: boolean;
    error?: string;
  } | null>(null);

  // Classes list
  const classesList = useMemo(() => {
    return Array.from(new Set(students.map((s) => s.class))).sort();
  }, [students]);

  // Handle parsing WhatsApp raw message text
  const handleParseText = (text: string) => {
    setPasteMessage(text);
    if (!text.trim()) {
      setParseResult(null);
      return;
    }

    const parsed = parseWhatsAppPermission(text, students);
    if (!parsed.isValid) {
      setParseResult({
        isValid: false,
        error: 'Format pesan tidak dikenali. Ketik nomor NISN siswa atau gunakan format: IZIN#NISN#ALASAN#TANGGAL.',
      });
      return;
    }

    const matchedStudent = parsed.student || (parsed.nisn ? students.find((s) => s.nisn === parsed.nisn) : undefined);
    if (!matchedStudent) {
      setParseResult({
        isValid: false,
        error: `NISN atau nama siswa "${parsed.nisn || 'yang dimasukkan'}" tidak ditemukan dalam database siswa.`,
      });
      return;
    }

    setParseResult({
      student: matchedStudent,
      type: parsed.type || 'IZIN',
      reason: parsed.reason || 'Izin Halangan',
      date: parsed.date || new Date().toISOString().split('T')[0],
      isValid: true,
    });
  };

  const handleConfirmParsedSubmission = async () => {
    if (!parseResult || !parseResult.student || !parseResult.isValid) return;

    const newPerm: PermissionRequest = {
      id: `perm-${Date.now()}`,
      nisn: parseResult.student.nisn,
      studentName: parseResult.student.name,
      class: parseResult.student.class,
      parentPhone: parseResult.student.parentPhone,
      type: parseResult.type || 'IZIN',
      date: parseResult.date || new Date().toISOString().split('T')[0],
      reason: parseResult.reason || 'Sakit/Izin',
      submittedAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      rawMessage: pasteMessage,
      status: 'PENDING',
    };

    onSubmitPermission(newPerm);

    // Auto-alert Homeroom Teacher if enabled
    const teacher = getTeacherForClass(teachers, newPerm.class);
    if (teacher && settings.enableTeacherWhatsAppAlerts) {
      const teacherMsg = formatTeacherPermissionAlert(
        teacher,
        newPerm.studentName,
        newPerm.nisn,
        newPerm.class,
        newPerm.type,
        newPerm.reason,
        newPerm.date,
        'PENDING',
        settings
      );
      sendCustomWAMessage(teacher.phone, teacherMsg, settings).then((res) => {
        if (res.success && onLogNotification) {
          onLogNotification({
            id: `log-tch-${Date.now()}`,
            studentId: parseResult.student?.id || '',
            studentName: newPerm.studentName,
            parentPhone: teacher.phone,
            type: 'PERMIT',
            message: `[Ke Wali Kelas ${teacher.name}] ${teacherMsg}`,
            sentAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
            status: 'SENT',
          });
        }
      });
    }

    setPasteMessage('');
    setParseResult(null);
    setShowInputPanel(false);
    setToast({
      message: `Permohonan izin ${parseResult.student.name} berhasil ditambahkan${teacher ? ` & notifikasi dikirim ke Wali Kelas (${teacher.name})` : ''}.`,
      type: 'success',
    });
  };

  const handleManualSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualNisn || !manualReason) return;

    const matchedStudent = students.find((s) => s.nisn === manualNisn);
    if (!matchedStudent) {
      setToast({
        message: `Siswa dengan NISN "${manualNisn}" tidak ditemukan.`,
        type: 'error',
      });
      return;
    }

    const newPerm: PermissionRequest = {
      id: `perm-${Date.now()}`,
      nisn: matchedStudent.nisn,
      studentName: matchedStudent.name,
      class: matchedStudent.class,
      parentPhone: matchedStudent.parentPhone,
      type: manualType,
      date: manualDate || new Date().toISOString().split('T')[0],
      reason: manualReason,
      submittedAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      rawMessage: `${manualType}#${manualNisn}#${manualReason}#${manualDate}`,
      status: 'PENDING',
    };

    onSubmitPermission(newPerm);

    // Auto-alert Homeroom Teacher if enabled
    const teacher = getTeacherForClass(teachers, newPerm.class);
    if (teacher && settings.enableTeacherWhatsAppAlerts) {
      const teacherMsg = formatTeacherPermissionAlert(
        teacher,
        newPerm.studentName,
        newPerm.nisn,
        newPerm.class,
        newPerm.type,
        newPerm.reason,
        newPerm.date,
        'PENDING',
        settings
      );
      sendCustomWAMessage(teacher.phone, teacherMsg, settings).then((res) => {
        if (res.success && onLogNotification) {
          onLogNotification({
            id: `log-tch-${Date.now()}`,
            studentId: matchedStudent.id,
            studentName: newPerm.studentName,
            parentPhone: teacher.phone,
            type: 'PERMIT',
            message: `[Ke Wali Kelas ${teacher.name}] ${teacherMsg}`,
            sentAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
            status: 'SENT',
          });
        }
      });
    }

    setManualNisn('');
    setManualReason('');
    setShowInputPanel(false);
    setToast({
      message: `Permohonan izin untuk ${matchedStudent.name} berhasil ditambahkan${teacher ? ` & notifikasi dikirim ke Wali Kelas (${teacher.name})` : ''}.`,
      type: 'success',
    });
  };

  const handleApproveWithWA = async (perm: PermissionRequest) => {
    onApprovePermission(perm);

    const student = students.find((s) => s.nisn === perm.nisn);
    const teacher = getTeacherForClass(teachers, perm.class);

    let notifyStatusText = '';

    // 1. Notify Parent
    if (student) {
      const parentMsg = formatApprovedMessage(student, perm.type, perm.reason, perm.date, settings);
      const resParent = await sendCustomWAMessage(student.parentPhone, parentMsg, settings);
      if (resParent.success && onLogNotification) {
        onLogNotification({
          id: `log-prt-${Date.now()}`,
          studentId: student.id,
          studentName: student.name,
          parentPhone: student.parentPhone,
          type: 'PERMIT',
          message: parentMsg,
          sentAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          status: 'SENT',
        });
      }
      notifyStatusText += resParent.success ? 'WA ortu terkirim. ' : `Gagal WA ortu: ${resParent.error}. `;
    }

    // 2. Notify Homeroom Teacher
    if (teacher) {
      const teacherMsg = formatTeacherPermissionAlert(
        teacher,
        perm.studentName,
        perm.nisn,
        perm.class,
        perm.type,
        perm.reason,
        perm.date,
        'APPROVED',
        settings
      );
      const resTeacher = await sendCustomWAMessage(teacher.phone, teacherMsg, settings);
      if (resTeacher.success && onLogNotification) {
        onLogNotification({
          id: `log-tch-${Date.now()}`,
          studentId: student?.id || '',
          studentName: perm.studentName,
          parentPhone: teacher.phone,
          type: 'PERMIT',
          message: `[Ke Wali Kelas ${teacher.name}] ${teacherMsg}`,
          sentAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          status: 'SENT',
        });
      }
      notifyStatusText += resTeacher.success
        ? `Notifikasi WA terkirim ke Wali Kelas (${teacher.name}).`
        : `Gagal WA guru: ${resTeacher.error}`;
    }

    setToast({
      message: `Izin ${perm.studentName} disetujui! ${notifyStatusText}`,
      type: 'success',
    });

    if (selectedPermission && selectedPermission.id === perm.id) {
      setSelectedPermission({ ...selectedPermission, status: 'APPROVED' });
    }
  };

  const handleReject = (permId: string) => {
    onRejectPermission(permId);
    setToast({
      message: 'Permohonan izin ditolak.',
      type: 'error',
    });
    if (selectedPermission && selectedPermission.id === permId) {
      setSelectedPermission({ ...selectedPermission, status: 'REJECTED' });
    }
  };

  const handleCopyFormat = () => {
    navigator.clipboard.writeText('IZIN#NISN#ALASAN#TANGGAL');
    setCopiedFormat(true);
    setTimeout(() => setCopiedFormat(false), 2000);
  };

  // Filtered Permissions List
  const filteredPermissions = useMemo(() => {
    return permissions.filter((p) => {
      // 1. Search Query (Name or NISN)
      const q = filterSearch.toLowerCase().trim();
      const matchesSearch =
        !q ||
        p.studentName.toLowerCase().includes(q) ||
        p.nisn.includes(q) ||
        p.reason.toLowerCase().includes(q);

      // 2. Class Filter
      const matchesClass = filterClass === 'ALL' || p.class === filterClass;

      // 3. Date Filter
      const matchesDate = !filterDate || p.date === filterDate;

      // 4. Status Filter
      const matchesStatus = filterStatus === 'ALL' || p.status === filterStatus;

      // 5. Type Filter
      const matchesType = filterType === 'ALL' || p.type === filterType;

      return matchesSearch && matchesClass && matchesDate && matchesStatus && matchesType;
    });
  }, [permissions, filterSearch, filterClass, filterDate, filterStatus, filterType]);

  // Export Filtered Permissions to PDF
  const handleExportPDF = () => {
    const filterDesc = [
      filterClass !== 'ALL' ? `Kelas ${filterClass}` : 'Semua Kelas',
      filterDate ? `Tanggal ${filterDate}` : 'Semua Tanggal',
      filterStatus !== 'ALL' ? `Status: ${filterStatus}` : '',
      filterSearch ? `Pencarian: "${filterSearch}"` : '',
    ]
      .filter(Boolean)
      .join(', ');

    exportPermissionsToPDF(filteredPermissions, settings, filterDesc || 'Semua Data Perizinan');
  };

  // Pending Count
  const pendingCount = permissions.filter((p) => p.status === 'PENDING').length;
  const approvedCount = permissions.filter((p) => p.status === 'APPROVED').length;
  const rejectedCount = permissions.filter((p) => p.status === 'REJECTED').length;

  return (
    <div className="space-y-6 relative">
      {/* Toast Notification */}
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

      {/* Top Banner & Main Actions */}
      <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-md space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <MessageSquareText className="w-5 h-5 text-emerald-400" />
              Daftar Perizinan Siswa (Izin / Sakit)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Kelola pengajuan izin siswa dengan filter nama, kelas, tanggal, dan lihat detail pesan asli dari orang tua.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowInputPanel(!showInputPanel)}
              className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl flex items-center space-x-2 transition-all shadow-md shadow-emerald-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>{showInputPanel ? 'Tutup Form Input' : '+ Input Izin Baru / WA'}</span>
            </button>

            <button
              onClick={handleExportPDF}
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl flex items-center space-x-2 transition-all shadow-md shadow-rose-600/20"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak PDF Laporan ({filteredPermissions.length})</span>
            </button>
          </div>
        </div>

        {/* Filters Bar: Nama/NISN, Kelas, Tanggal, Status, Jenis */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-3 border-t border-slate-800">
          {/* Search Nama / NISN */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Cari Siswa / NISN:
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Ketik nama atau NISN..."
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Filter Kelas */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Filter Kelas:
            </label>
            <div className="relative">
              <Filter className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <select
                value={filterClass}
                onChange={(e) => setFilterClass(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
              >
                <option value="ALL">Semua Kelas</option>
                {classesList.map((c) => (
                  <option key={c} value={c}>
                    Kelas {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Filter Tanggal */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Filter Tanggal:
            </label>
            <div className="relative flex items-center">
              <Calendar className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
              {filterDate && (
                <button
                  onClick={() => setFilterDate('')}
                  className="absolute right-2 text-slate-400 hover:text-white p-1 text-xs"
                  title="Reset Tanggal"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Filter Status */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Filter Status:
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="w-full p-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
            >
              <option value="ALL">Semua Status ({permissions.length})</option>
              <option value="PENDING">Menunggu ({pendingCount})</option>
              <option value="APPROVED">Disetujui ({approvedCount})</option>
              <option value="REJECTED">Ditolak ({rejectedCount})</option>
            </select>
          </div>

          {/* Filter Jenis */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Jenis Izin:
            </label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="w-full p-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
            >
              <option value="ALL">Semua Jenis</option>
              <option value="IZIN">IZIN (Acara/Lainnya)</option>
              <option value="SAKIT">SAKIT (Demam/Flu)</option>
            </select>
          </div>
        </div>

        {/* Quick Help & Status Pills */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span>Ditemukan: <strong className="text-white font-bold">{filteredPermissions.length}</strong> data</span>
            {pendingCount > 0 && (
              <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded-lg font-bold text-[11px] border border-amber-500/30">
                {pendingCount} menunggu verifikasi
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 font-mono">Format Pesan WA Ortu:</span>
            <code className="text-emerald-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 font-mono font-bold text-[11px]">
              IZIN#NISN#ALASAN#TANGGAL
            </code>
            <button
              onClick={handleCopyFormat}
              className="p-1 text-slate-400 hover:text-emerald-400 transition-colors"
              title="Salin Format"
            >
              {copiedFormat ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Expandable Input Form Panel (WA Parser + Manual Input) */}
      {showInputPanel && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-slate-900/90 p-5 rounded-2xl border border-emerald-500/30 shadow-xl animate-fade-in">
          {/* Parser Box */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <h3 className="text-xs font-bold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-400" />
              Tempel (Paste) Pesan WA Masuk dari Orang Tua
            </h3>
            <p className="text-[11px] text-slate-400">
              Sistem akan mengekstrak NISN, jenis izin, dan alasan pesan secara otomatis.
            </p>

            <textarea
              rows={3}
              value={pasteMessage}
              onChange={(e) => handleParseText(e.target.value)}
              placeholder="Contoh: IZIN#0051234005#Sakit flu dan demam tinggi#2026-08-14"
              className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
            />

            {parseResult && (
              <div className="mt-2">
                {parseResult.isValid && parseResult.student ? (
                  <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl space-y-2 text-xs">
                    <div className="flex items-center justify-between text-emerald-400 font-bold">
                      <span>✓ Data Berhasil Dikenali</span>
                      <span className="bg-emerald-500 text-slate-950 px-2 py-0.5 rounded text-[10px]">
                        {parseResult.type}
                      </span>
                    </div>
                    <div className="text-slate-200">
                      <strong>Siswa:</strong> {parseResult.student.name} ({parseResult.student.class})
                    </div>
                    <div className="text-slate-300">
                      <strong>Alasan:</strong> {parseResult.reason}
                    </div>
                    <button
                      onClick={handleConfirmParsedSubmission}
                      className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs transition-colors shadow-md shadow-emerald-500/20 mt-1"
                    >
                      + Tambahkan Ke Daftar Perizinan
                    </button>
                  </div>
                ) : (
                  <div className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-xl text-rose-300 text-xs">
                    {parseResult.error}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Direct Manual Form */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <h3 className="text-xs font-bold text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-400" />
              Input Perizinan Manual (Pilih Siswa)
            </h3>

            <form onSubmit={handleManualSubmitForm} className="space-y-2.5">
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 mb-1">
                  Pilih Siswa (NISN):
                </label>
                <select
                  value={manualNisn}
                  onChange={(e) => setManualNisn(e.target.value)}
                  className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
                >
                  <option value="">-- Pilih Siswa --</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.nisn}>
                      {s.name} ({s.class}) - NISN: {s.nisn}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 mb-1">
                    Jenis Halangan:
                  </label>
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      type="button"
                      onClick={() => setManualType('IZIN')}
                      className={`py-1.5 text-xs font-bold rounded-lg border transition-all ${
                        manualType === 'IZIN'
                          ? 'bg-sky-500 text-slate-950 border-sky-400'
                          : 'bg-slate-900 text-slate-400 border-slate-800'
                      }`}
                    >
                      IZIN
                    </button>
                    <button
                      type="button"
                      onClick={() => setManualType('SAKIT')}
                      className={`py-1.5 text-xs font-bold rounded-lg border transition-all ${
                        manualType === 'SAKIT'
                          ? 'bg-blue-500 text-slate-950 border-blue-400'
                          : 'bg-slate-900 text-slate-400 border-slate-800'
                      }`}
                    >
                      SAKIT
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 mb-1">
                    Tanggal:
                  </label>
                  <input
                    type="date"
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                    className="w-full p-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 mb-1">
                  Alasan / Keterangan:
                </label>
                <input
                  type="text"
                  value={manualReason}
                  onChange={(e) => setManualReason(e.target.value)}
                  placeholder="Contoh: Menghadiri acara keluarga..."
                  className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition-colors shadow-md shadow-emerald-500/20"
              >
                Simpan Permohonan Izin
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Main Table: Clickable Student Rows for Message Pop-up */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-md overflow-hidden">
        <div className="p-4 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold text-slate-200">
              Klik baris atau tombol detail untuk membaca pesan lengkap dari orang tua
            </span>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            Menampilkan {filteredPermissions.length} Data
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase font-bold border-b border-slate-800">
              <tr>
                <th className="p-3.5 text-center w-12">No</th>
                <th className="p-3.5">Tanggal</th>
                <th className="p-3.5">Nama Siswa</th>
                <th className="p-3.5">Kelas</th>
                <th className="p-3.5">Jenis</th>
                <th className="p-3.5">Pesan / Alasan Ortu</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5 text-center">Aksi / Verifikasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {filteredPermissions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-500 space-y-2">
                    <CheckCircle2 className="w-10 h-10 mx-auto text-slate-600 mb-2" />
                    <p className="text-xs font-bold text-slate-400">Tidak ada data perizinan yang sesuai filter.</p>
                    <p className="text-[11px] text-slate-500">Coba ubah kata kunci pencarian, kelas, atau tanggal.</p>
                  </td>
                </tr>
              ) : (
                filteredPermissions.map((perm, idx) => {
                  const student = students.find((s) => s.nisn === perm.nisn);
                  return (
                    <tr
                      key={perm.id}
                      onClick={() => setSelectedPermission(perm)}
                      className="hover:bg-slate-950/70 transition-colors cursor-pointer group"
                    >
                      <td className="p-3.5 text-center text-slate-500 font-mono">{idx + 1}</td>
                      <td className="p-3.5 font-mono text-slate-300 whitespace-nowrap">
                        <div>{perm.date}</div>
                        <span className="text-[10px] text-slate-500">{perm.submittedAt || '-'}</span>
                      </td>
                      <td className="p-3.5 font-bold text-white">
                        <div className="flex items-center space-x-2.5">
                          {student?.photoUrl ? (
                            <img
                              src={student.photoUrl}
                              alt={perm.studentName}
                              className="w-7 h-7 rounded-full object-cover border border-slate-700"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-emerald-400">
                              {perm.studentName.charAt(0)}
                            </div>
                          )}
                          <div>
                            <span className="group-hover:text-emerald-400 transition-colors block">
                              {perm.studentName}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono font-normal">
                              NISN: {perm.nisn}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="p-3.5">
                        <div className="text-slate-200 font-semibold">{perm.class}</div>
                        {(() => {
                          const teacher = getTeacherForClass(teachers, perm.class);
                          if (!teacher) return null;
                          const teacherMsg = formatTeacherPermissionAlert(
                            teacher,
                            perm.studentName,
                            perm.nisn,
                            perm.class,
                            perm.type,
                            perm.reason,
                            perm.date,
                            perm.status,
                            settings
                          );
                          return (
                            <div className="mt-1 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                              <span className="text-[10px] text-emerald-400/90 font-mono">
                                Wali: {teacher.name}
                              </span>
                              <a
                                href={createWhatsAppLink(teacher.phone, teacherMsg)}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={`Kirim notifikasi WA ke Wali Kelas (${teacher.name})`}
                                className="p-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-md border border-emerald-500/30 transition-colors inline-flex items-center gap-0.5 text-[9px] font-bold"
                              >
                                <Send className="w-2.5 h-2.5" />
                                <span>WA</span>
                              </a>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-black ${
                            perm.type === 'SAKIT'
                              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                              : 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                          }`}
                        >
                          {perm.type}
                        </span>
                      </td>
                      <td className="p-3.5 max-w-xs">
                        <p className="text-slate-300 truncate font-normal" title={perm.reason}>
                          "{perm.reason}"
                        </p>
                        <span className="text-[10px] text-emerald-400/80 group-hover:underline flex items-center gap-1 mt-0.5">
                          <Eye className="w-3 h-3" /> Klik untuk baca pesan orang tua
                        </span>
                      </td>
                      <td className="p-3.5 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                            perm.status === 'APPROVED'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : perm.status === 'REJECTED'
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          {perm.status === 'APPROVED'
                            ? 'Disetujui'
                            : perm.status === 'REJECTED'
                            ? 'Ditolak'
                            : 'Menunggu'}
                        </span>
                      </td>
                      <td
                        className="p-3.5 text-center"
                        onClick={(e) => e.stopPropagation()} // don't trigger row click
                      >
                        {perm.status === 'PENDING' ? (
                          <div className="flex items-center justify-center space-x-1.5">
                            <button
                              onClick={() => handleApproveWithWA(perm)}
                              className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[11px] rounded-lg transition-colors shadow-sm flex items-center gap-1"
                              title="Setujui dan Kirim WA Konfirmasi"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Setujui</span>
                            </button>
                            <button
                              onClick={() => handleReject(perm.id)}
                              className="p-1 bg-rose-500/15 hover:bg-rose-500/30 text-rose-400 rounded-lg transition-colors border border-rose-500/30"
                              title="Tolak Permohonan"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setSelectedPermission(perm)}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-semibold transition-colors"
                          >
                            Detail Pesan
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* POP-UP MODAL: Pesan Lengkap dari Orang Tua & Tindakan */}
      {selectedPermission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden animate-scale-up">
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <MessageSquareText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Detail Pesan Perizinan Orang Tua</h3>
                  <p className="text-[11px] text-slate-400">
                    ID Permohonan: <span className="font-mono">{selectedPermission.id}</span>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedPermission(null)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* Student Header Card */}
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-black text-lg">
                    {selectedPermission.studentName.charAt(0)}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">{selectedPermission.studentName}</h4>
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                      <span>Kelas {selectedPermission.class}</span>
                      <span>•</span>
                      <span className="font-mono">NISN: {selectedPermission.nisn}</span>
                    </div>
                  </div>
                </div>

                <span
                  className={`px-3 py-1 rounded-xl text-xs font-black ${
                    selectedPermission.type === 'SAKIT'
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                      : 'bg-sky-500/20 text-sky-400 border border-sky-500/40'
                  }`}
                >
                  {selectedPermission.type}
                </span>
              </div>

              {/* Message Box: Original WA message from parent */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <MessageSquareText className="w-4 h-4 text-emerald-400" />
                  Isi Pesan Masuk dari Orang Tua ke Aplikasi:
                </label>
                <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800/80 space-y-2.5">
                  <div className="text-xs text-slate-200 leading-relaxed italic bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                    "{selectedPermission.reason}"
                  </div>

                  {/* Raw WhatsApp String */}
                  {selectedPermission.rawMessage && (
                    <div className="pt-2 border-t border-slate-800/60">
                      <span className="text-[10px] text-slate-500 block font-mono">Teks Format WhatsApp:</span>
                      <code className="text-[11px] font-mono text-emerald-400 block break-all mt-0.5">
                        {selectedPermission.rawMessage}
                      </code>
                    </div>
                  )}
                </div>
              </div>

              {/* Metadata Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 block font-semibold">Tanggal Berlaku Izin:</span>
                  <div className="text-white font-mono font-bold mt-1">{selectedPermission.date}</div>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 block font-semibold">Waktu Diterima:</span>
                  <div className="text-white font-mono font-bold mt-1">
                    {selectedPermission.submittedAt || '-'} WIB
                  </div>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 col-span-2">
                  <span className="text-[10px] text-slate-500 block font-semibold">Kontak Orang Tua / Wali Siswa:</span>
                  <div className="flex items-center justify-between mt-1">
                    <div className="flex items-center space-x-2 text-slate-200 font-mono font-bold">
                      <Phone className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{selectedPermission.parentPhone}</span>
                    </div>

                    <a
                      href={createWhatsAppLink(
                        selectedPermission.parentPhone,
                        `Halo Bapak/Ibu wali dari ${selectedPermission.studentName}, terkait permohonan izin untuk tanggal ${selectedPermission.date}...`
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors"
                    >
                      <Send className="w-3 h-3" />
                      <span>Chat Ortu</span>
                    </a>
                  </div>
                </div>

                {/* Homeroom Teacher / Wali Kelas Card */}
                {(() => {
                  const teacher = getTeacherForClass(teachers, selectedPermission.class);
                  if (!teacher) {
                    return (
                      <div className="p-3 bg-slate-950/70 rounded-xl border border-dashed border-slate-800 col-span-2 flex items-center justify-between text-xs text-slate-400">
                        <span>Wali Kelas {selectedPermission.class} belum diatur.</span>
                        <span className="text-[10px] text-amber-400">Atur di Menu Siswa & Guru</span>
                      </div>
                    );
                  }
                  const teacherMsg = formatTeacherPermissionAlert(
                    teacher,
                    selectedPermission.studentName,
                    selectedPermission.nisn,
                    selectedPermission.class,
                    selectedPermission.type,
                    selectedPermission.reason,
                    selectedPermission.date,
                    selectedPermission.status,
                    settings
                  );
                  return (
                    <div className="p-3 bg-slate-950 rounded-xl border border-emerald-500/20 col-span-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <UserCheck className="w-4 h-4 text-emerald-400" />
                          <span className="text-xs font-bold text-white">
                            Wali Kelas ({teacher.assignedClass}): {teacher.name}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400">
                          NIP: {teacher.nip || '-'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                        <div className="flex items-center space-x-2 text-slate-300 font-mono text-xs">
                          <Phone className="w-3 h-3 text-emerald-400" />
                          <span>{teacher.phone}</span>
                        </div>

                        <a
                          href={createWhatsAppLink(teacher.phone, teacherMsg)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                        >
                          <Send className="w-3 h-3" />
                          <span>Kirim Pemberitahuan WA ke Guru Wali</span>
                        </a>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Status Info */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400">Status Persetujuan Presensi:</span>
                <span
                  className={`px-3 py-1 rounded-lg text-xs font-bold ${
                    selectedPermission.status === 'APPROVED'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : selectedPermission.status === 'REJECTED'
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }`}
                >
                  {selectedPermission.status === 'APPROVED'
                    ? '✓ Disetujui (Tercatat di Presensi)'
                    : selectedPermission.status === 'REJECTED'
                    ? '✕ Ditolak'
                    : '⏳ Menunggu Persetujuan'}
                </span>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="p-5 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3">
              <button
                onClick={() => setSelectedPermission(null)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-colors"
              >
                Tutup
              </button>

              <div className="flex items-center gap-2">
                {selectedPermission.status === 'PENDING' ? (
                  <>
                    <button
                      onClick={() => handleReject(selectedPermission.id)}
                      className="px-4 py-2.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 font-bold text-xs rounded-xl transition-colors"
                    >
                      Tolak
                    </button>
                    <button
                      onClick={() => handleApproveWithWA(selectedPermission)}
                      className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl transition-all shadow-md shadow-emerald-500/20 flex items-center space-x-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Setujui & Kirim Konfirmasi WA</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      exportPermissionsToPDF([selectedPermission], settings, `Siswa: ${selectedPermission.studentName}`);
                    }}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
                  >
                    <Printer className="w-4 h-4 text-emerald-400" />
                    <span>Cetak Lembar Izin (PDF)</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
