import React, { useState, useRef } from 'react';
import {
  X,
  Download,
  Upload,
  FileJson,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Clock,
  Users,
  GraduationCap,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  FileText,
} from 'lucide-react';
import { Student, HomeroomTeacher, AppSettings } from '../types';
import {
  downloadFullBackupJSON,
  downloadStudentsSpreadsheet,
  downloadTeachersSpreadsheet,
  downloadCleanTemplate,
  parseBackupFile,
} from '../utils/backupUtils';

interface BackupDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  teachers: HomeroomTeacher[];
  settings: AppSettings;
  onRestoreBackup?: (backupData: {
    students?: Student[];
    teachers?: HomeroomTeacher[];
  }) => Promise<void>;
}

export const BackupDataModal: React.FC<BackupDataModalProps> = ({
  isOpen,
  onClose,
  students,
  teachers,
  settings,
  onRestoreBackup,
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'restore'>('export');
  const [restoreFile, setRestoreFile] = useState<{
    fileName: string;
    students: Student[];
    teachers: HomeroomTeacher[];
    info: any;
  } | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreSuccess, setRestoreSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRestoreError(null);
    setRestoreSuccess(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const parsed = parseBackupFile(content);
      if (parsed.isValid && parsed.students !== undefined) {
        setRestoreFile({
          fileName: file.name,
          students: parsed.students,
          teachers: parsed.teachers || [],
          info: parsed.info,
        });
      } else {
        setRestoreError(parsed.error || 'Format file backup tidak sesuai.');
        setRestoreFile(null);
      }
    };
    reader.onerror = () => {
      setRestoreError('Gagal membaca file dari perangkat Anda.');
    };
    reader.readAsText(file);
  };

  const handleExecuteRestore = async () => {
    if (!restoreFile || !onRestoreBackup) return;
    try {
      setIsRestoring(true);
      setRestoreError(null);
      await onRestoreBackup({
        students: restoreFile.students,
        teachers: restoreFile.teachers,
      });
      setRestoreSuccess(
        `Berhasil memulihkan ${restoreFile.students.length} data siswa dan ${restoreFile.teachers.length} guru wali kelas!`
      );
      setTimeout(() => {
        setRestoreSuccess(null);
        setRestoreFile(null);
        onClose();
      }, 1500);
    } catch (err) {
      setRestoreError('Terjadi kesalahan saat memulihkan data: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-3xl p-6 shadow-2xl space-y-5 my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 shadow-sm">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Backup & Cadangan Data</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                  EduScan
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Unduh salinan data siswa & wali kelas atau pulihkan data dari file cadangan sebelumnya.
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

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('export')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition ${
              activeTab === 'export'
                ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Unduh File Backup</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('restore')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition ${
              activeTab === 'restore'
                ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Pulihkan (Restore) Backup</span>
          </button>
        </div>

        {/* Tab 1: Export / Unduh Backup */}
        {activeTab === 'export' && (
          <div className="space-y-4">
            {/* Status Card */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-slate-300">
                  Data siap diunduh:{' '}
                  <strong className="text-white">{students.length} Siswa</strong> &{' '}
                  <strong className="text-white">{teachers.length} Guru Wali</strong>
                </span>
              </div>
              <div className="text-slate-400 flex items-center gap-1.5 text-[11px]">
                <Clock className="w-3.5 h-3.5" />
                <span>{new Date().toLocaleDateString('id-ID', { dateStyle: 'medium' })}</span>
              </div>
            </div>

            {/* Export Cards Grid */}
            <div className="space-y-3">
              {/* Option 1: Full JSON Backup (Recommended) */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-sky-950/40 via-slate-900 to-slate-900 border border-sky-500/30 hover:border-sky-500/50 transition">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-sky-500/20 text-sky-300 flex items-center justify-center shrink-0 mt-0.5">
                      <FileJson className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-white">
                          Backup Lengkap EduScan (.JSON)
                        </h4>
                        <span className="px-2 py-0.2 bg-emerald-500/20 text-emerald-300 text-[10px] font-bold rounded-md border border-emerald-500/30">
                          Direkomendasikan
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Menyimpan seluruh data siswa, wali kelas, kelas rombel, dan info sekolah. Dapat di-restore kapan saja.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => downloadFullBackupJSON(students, teachers, settings)}
                    className="px-4 py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition shadow-md shadow-sky-500/20 shrink-0"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download JSON</span>
                  </button>
                </div>
              </div>

              {/* Option 2: Excel / CSV Data Siswa */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0 mt-0.5">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">
                        Data Siswa ke Excel / CSV ({students.length} Siswa)
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Daftar lengkap NISN, Nama Lengkap, Kelas, Jenis Kelamin, dan No. WhatsApp Ortu.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => downloadStudentsSpreadsheet(students, settings, 'xlsx')}
                      className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition shadow-sm"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Excel (.xlsx)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadStudentsSpreadsheet(students, settings, 'csv')}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1.5 border border-slate-700 transition"
                    >
                      <span>CSV</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Option 3: Excel / CSV Data Guru Wali */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center shrink-0 mt-0.5">
                      <GraduationCap className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">
                        Data Wali Kelas ke Excel ({teachers.length} Guru)
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Daftar NIP, Nama Guru Wali Kelas, Kelas Binaan, dan No. WhatsApp aktif.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => downloadTeachersSpreadsheet(teachers, settings, 'xlsx')}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition shadow-sm shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Excel</span>
                  </button>
                </div>
              </div>

              {/* Option 4: Template Kosong Bersih untuk Rumahweb */}
              <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <FileText className="w-4 h-4 text-amber-400 shrink-0" />
                  <div>
                    <span className="text-slate-200 font-semibold block">
                      Butuh template kosong untuk diisi data asli sekolah?
                    </span>
                    <span className="text-[11px] text-slate-400 block">
                      Download template format Excel siap pakai sebelum diunggah ke Rumahweb.
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => downloadCleanTemplate(settings)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-semibold rounded-xl border border-slate-700 flex items-center justify-center gap-1.5 transition shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Template Bersih (.xlsx)</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Restore / Pulihkan Backup */}
        {activeTab === 'restore' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-sky-950/20 border border-sky-500/20 text-xs text-sky-200 space-y-1">
              <p className="font-semibold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-sky-400" />
                <span>Pemulihan Data Cadangan JSON</span>
              </p>
              <p className="text-slate-400">
                Pilih file backup (.json) yang sebelumnya diunduh dari aplikasi EduScan ini. Data siswa dan wali kelas akan dimasukkan kembali ke sistem secara otomatis.
              </p>
            </div>

            {/* File Upload Box */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700 hover:border-sky-500/60 rounded-3xl p-6 text-center cursor-pointer bg-slate-950/60 transition group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 text-slate-400 group-hover:text-sky-400 group-hover:border-sky-500/40 flex items-center justify-center mx-auto mb-3 transition">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-xs font-bold text-slate-200 group-hover:text-white">
                Klik untuk memilih file Backup (.json)
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Format didukung: File JSON hasil export EduScan SD
              </p>
            </div>

            {/* Error Message */}
            {restoreError && (
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{restoreError}</span>
              </div>
            )}

            {/* Success Message */}
            {restoreSuccess && (
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{restoreSuccess}</span>
              </div>
            )}

            {/* File Preview Card */}
            {restoreFile && (
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold text-white flex items-center gap-2">
                    <FileJson className="w-4 h-4 text-sky-400" />
                    <span>{restoreFile.fileName}</span>
                  </span>
                  <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md font-semibold">
                    Valid
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800/80">
                    <span className="text-slate-400 text-[11px] block">Jumlah Siswa:</span>
                    <span className="text-base font-bold text-white">
                      {restoreFile.students.length} Siswa
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800/80">
                    <span className="text-slate-400 text-[11px] block">Jumlah Wali Kelas:</span>
                    <span className="text-base font-bold text-white">
                      {restoreFile.teachers.length} Guru
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 space-y-0.5">
                  <p>Sekolah: <span className="text-slate-300 font-medium">{restoreFile.info?.schoolName}</span></p>
                  <p>Waktu Backup: <span className="text-slate-300 font-medium">{restoreFile.info?.exportedAt}</span></p>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setRestoreFile(null)}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 transition"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteRestore}
                    disabled={isRestoring}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-emerald-500 hover:bg-emerald-400 transition shadow-md shadow-emerald-500/20 flex items-center gap-2"
                  >
                    {isRestoring ? (
                      <span>Memulihkan...</span>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Terapkan & Pulihkan Data</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs text-slate-500">
          <span>Format backup aman dan kompatibel dengan versi terbaru EduScan.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl transition"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
