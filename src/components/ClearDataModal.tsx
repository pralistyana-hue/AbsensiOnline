import React, { useState } from 'react';
import {
  X,
  Trash2,
  AlertTriangle,
  Download,
  CheckCircle2,
  ShieldAlert,
  Server,
  Sparkles,
} from 'lucide-react';
import { Student, HomeroomTeacher, AppSettings } from '../types';
import { downloadFullBackupJSON } from '../utils/backupUtils';

interface ClearDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  teachers: HomeroomTeacher[];
  settings: AppSettings;
  onConfirmClear: (options: {
    clearStudents: boolean;
    clearTeachers: boolean;
    clearAttendance: boolean;
  }) => Promise<void>;
}

export const ClearDataModal: React.FC<ClearDataModalProps> = ({
  isOpen,
  onClose,
  students,
  teachers,
  settings,
  onConfirmClear,
}) => {
  const [clearStudents, setClearStudents] = useState(true);
  const [clearTeachers, setClearTeachers] = useState(true);
  const [clearAttendance, setClearAttendance] = useState(true);
  const [confirmKeyword, setConfirmKeyword] = useState('');
  const [isClearing, setIsClearing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [hasDownloadedBackup, setHasDownloadedBackup] = useState(false);

  if (!isOpen) return null;

  const isFormValid =
    (clearStudents || clearTeachers || clearAttendance) &&
    confirmKeyword.trim().toUpperCase() === 'KOSONGKAN';

  const handleDownloadBackupFirst = () => {
    downloadFullBackupJSON(students, teachers, settings);
    setHasDownloadedBackup(true);
  };

  const handleExecuteClear = async () => {
    if (!isFormValid) return;
    try {
      setIsClearing(true);
      setErrorMsg(null);
      await onConfirmClear({
        clearStudents,
        clearTeachers,
        clearAttendance,
      });
      setIsClearing(false);
      onClose();
    } catch (err) {
      setErrorMsg('Gagal mengosongkan data: ' + (err instanceof Error ? err.message : String(err)));
      setIsClearing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-5 my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-sm">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Kosongkan Data Siswa & Guru</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  Clean State
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Bersihkan data dummy/contoh untuk persiapan upload ke hosting Rumahweb.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Rumahweb Ready Notice */}
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
            <Server className="w-4 h-4 text-amber-400" />
            <span>Persiapan Upload ke Rumahweb / Hosting</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Tindakan ini akan mengosongkan data siswa dan guru wali kelas dari database (Firestore & Lokal), sehingga aplikasi berada dalam kondisi bersih (*clean slate*) siap diinput data riil sekolah saat di-upload ke Rumahweb.
          </p>
        </div>

        {/* Safety Backup Recommendation */}
        <div className="p-3.5 rounded-2xl bg-sky-950/40 border border-sky-500/30 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <Download className="w-4 h-4 text-sky-400 shrink-0" />
            <span className="text-sky-200">
              {hasDownloadedBackup ? (
                <span className="text-emerald-300 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Backup telah diunduh ke komputer Anda.
                </span>
              ) : (
                'Unduh salinan backup JSON dulu agar data contoh bisa dipulihkan kembali sewaktu-waktu.'
              )}
            </span>
          </div>
          <button
            type="button"
            onClick={handleDownloadBackupFirst}
            className="px-3 py-1.5 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 font-bold rounded-xl border border-sky-500/40 flex items-center gap-1.5 transition shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{hasDownloadedBackup ? 'Unduh Ulang' : 'Unduh Backup'}</span>
          </button>
        </div>

        {/* Checkbox Options */}
        <div className="space-y-2.5 pt-1">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            Pilih Data yang Akan Dikosongkan:
          </label>

          <label className="flex items-center gap-3 p-3 rounded-2xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition">
            <input
              type="checkbox"
              checked={clearStudents}
              onChange={(e) => setClearStudents(e.target.checked)}
              className="w-4 h-4 rounded text-rose-500 focus:ring-rose-500 bg-slate-900 border-slate-700"
            />
            <div className="text-xs">
              <span className="font-bold text-white block">
                Kosongkan Seluruh Data Siswa ({students.length} Siswa)
              </span>
              <span className="text-[11px] text-slate-400">
                Menghapus semua identitas siswa, NISN, dan nomor WhatsApp orang tua.
              </span>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 rounded-2xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition">
            <input
              type="checkbox"
              checked={clearTeachers}
              onChange={(e) => setClearTeachers(e.target.checked)}
              className="w-4 h-4 rounded text-rose-500 focus:ring-rose-500 bg-slate-900 border-slate-700"
            />
            <div className="text-xs">
              <span className="font-bold text-white block">
                Kosongkan Data Guru Wali Kelas ({teachers.length} Guru)
              </span>
              <span className="text-[11px] text-slate-400">
                Menghapus daftar wali kelas dan nomor WhatsApp guru.
              </span>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 rounded-2xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition">
            <input
              type="checkbox"
              checked={clearAttendance}
              onChange={(e) => setClearAttendance(e.target.checked)}
              className="w-4 h-4 rounded text-rose-500 focus:ring-rose-500 bg-slate-900 border-slate-700"
            />
            <div className="text-xs">
              <span className="font-bold text-white block">
                Kosongkan Riwayat Log Presensi & Perizinan
              </span>
              <span className="text-[11px] text-slate-400">
                Memulai rekapan absensi dari 0 (bersih tanpa catatan absensi dummy).
              </span>
            </div>
          </label>
        </div>

        {/* Confirmation Keyword Input */}
        <div className="p-4 rounded-2xl bg-rose-950/20 border border-rose-500/20 space-y-2">
          <label className="text-xs font-semibold text-rose-200 block">
            Ketik kata <strong className="text-rose-300 font-mono tracking-wider font-bold">KOSONGKAN</strong> di bawah untuk mengonfirmasi:
          </label>
          <input
            type="text"
            value={confirmKeyword}
            onChange={(e) => setConfirmKeyword(e.target.value)}
            placeholder="KOSONGKAN"
            className="w-full px-3 py-2 bg-slate-950 border border-rose-500/40 rounded-xl text-xs text-white uppercase placeholder-slate-600 focus:outline-none focus:border-rose-400 font-mono font-bold tracking-wider"
          />
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-400">
            {errorMsg}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isClearing}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleExecuteClear}
            disabled={!isFormValid || isClearing}
            className={`px-4 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-2 transition ${
              isFormValid && !isClearing
                ? 'bg-rose-600 hover:bg-rose-500 shadow-md shadow-rose-600/30'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50'
            }`}
          >
            {isClearing ? (
              <span>Mengosongkan data...</span>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>Ya, Kosongkan Data Sekarang</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
