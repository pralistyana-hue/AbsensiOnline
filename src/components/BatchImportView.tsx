import React, { useState } from 'react';
import { FileUp, Download, CheckCircle2, AlertCircle, Users, Copy, Sparkles, BookOpen } from 'lucide-react';
import { Student, AppSettings } from '../types';
import { normalizePhoneNumber } from '../utils/whatsapp';
import { LibraryImportModal } from './LibraryImportModal';

interface BatchImportViewProps {
  existingStudents: Student[];
  onBatchAddStudents: (newStudents: Student[]) => void;
  onNavigateToStudents: () => void;
  settings?: AppSettings;
}

export const BatchImportView: React.FC<BatchImportViewProps> = ({
  existingStudents,
  onBatchAddStudents,
  onNavigateToStudents,
  settings,
}) => {
  const [rawText, setRawText] = useState('');
  const [parsedPreview, setParsedPreview] = useState<Student[]>([]);
  const [importSuccessMessage, setImportSuccessMessage] = useState<string | null>(null);
  const [isLibraryModalOpen, setIsLibraryModalOpen] = useState(false);

  // Sample data text
  const SAMPLE_TEXT = `0151234020 | Ahmad Fauzi | Kelas 1 | L | 081234567891
0151234021 | Annisa Tri Hapsari | Kelas 1 | P | 081298765431
0151234022 | Bilal Ramadhan | Kelas 2 | L | 081311223355
0151234023 | Cantika Putri | Kelas 3 | P | 081355667799
0151234024 | Daffa Ibnu | Kelas 4 | L | 081399887700`;

  const handleParseText = () => {
    if (!rawText.trim()) {
      setParsedPreview([]);
      return;
    }

    const lines = rawText.split('\n');
    const results: Student[] = [];

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;

      // Split by pipe (|), comma (,), or tab
      const parts = trimmed.split(/[|,\t]/).map((p) => p.trim());

      if (parts.length >= 3) {
        const nisn = parts[0] || `015123${1000 + index}`;
        const name = parts[1] || `Siswa Baru ${index + 1}`;
        const className = parts[2] || 'Kelas 1';
        const genderRaw = (parts[3] || 'L').toUpperCase();
        const gender: 'L' | 'P' = genderRaw.startsWith('P') ? 'P' : 'L';
        const phoneRaw = parts[4] || parts[3] || '6281234567890';
        const parentPhone = normalizePhoneNumber(phoneRaw);

        results.push({
          id: `std-batch-${Date.now()}-${index}`,
          nisn,
          name,
          class: className,
          gender,
          parentPhone,
          photoUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0D9488&color=fff`,
        });
      }
    });

    setParsedPreview(results);
  };

  const handleApplyImport = () => {
    if (parsedPreview.length === 0) return;

    onBatchAddStudents(parsedPreview);
    setImportSuccessMessage(
      `Berhasil menambahkan ${parsedPreview.length} siswa baru lengkap dengan nomor WhatsApp Orang Tua!`
    );
    setRawText('');
    setParsedPreview([]);

    setTimeout(() => {
      setImportSuccessMessage(null);
      onNavigateToStudents();
    }, 2000);
  };

  const handleDownloadTemplate = () => {
    const csvContent = `NISN,Nama Siswa,Kelas,Jenis Kelamin,No WA Orang Tua
0151234020,Ahmad Fauzi,Kelas 1,L,081234567891
0151234021,Annisa Tri Hapsari,Kelas 1,P,081298765431
0151234022,Bilal Ramadhan,Kelas 2,L,081311223355
0151234023,Cantika Putri,Kelas 3,P,081355667799`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'Template_Input_Massal_Siswa_SD.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <FileUp className="w-5 h-5 text-emerald-400" />
            Input Massal Siswa & Nomor WhatsApp Orang Tua
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Impor puluhan atau ratusan data siswa SD sekaligus dari Excel / Tabel / Teks. Nomor WhatsApp otomatis dirapikan (+628...).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsLibraryModalOpen(true)}
            className="px-4 py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-xs rounded-xl flex items-center space-x-2 transition-all shadow-md shadow-sky-500/20 shrink-0"
          >
            <BookOpen className="w-4 h-4" />
            <span>Impor PDF Kartu Perpustakaan</span>
          </button>

          <button
            onClick={handleDownloadTemplate}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl flex items-center space-x-2 border border-slate-700 shrink-0"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Unduh Contoh Excel/CSV</span>
          </button>
        </div>
      </div>

      {importSuccessMessage && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-300 text-sm flex items-center space-x-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="font-semibold">{importSuccessMessage}</span>
        </div>
      )}

      {/* Main Import Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Format Instructions & Textarea */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-md space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                Tempel (Paste) Data Siswa
              </label>

              <button
                onClick={() => {
                  setRawText(SAMPLE_TEXT);
                  setTimeout(handleParseText, 100);
                }}
                className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1"
              >
                <Copy className="w-3 h-3" />
                Isi Contoh Data
              </button>
            </div>

            <div className="text-[11px] bg-slate-950 p-3 rounded-xl border border-slate-800 text-slate-400 space-y-1 font-mono">
              <span className="text-amber-400 font-bold block">FORMAT BARIS:</span>
              <code>NISN | Nama Siswa | Kelas | L/P | No WA Ortu</code>
              <p className="text-[10px] text-slate-500 font-sans mt-1">
                *Dapat dipisahkan dengan garis tegak ( | ), koma ( , ), atau Tab dari Excel.
              </p>
            </div>

            <textarea
              rows={10}
              value={rawText}
              onChange={(e) => {
                setRawText(e.target.value);
              }}
              placeholder={`Contoh:\n0151234020 | Ahmad Fauzi | Kelas 1A | L | 081234567891\n0151234021 | Annisa Tri Hapsari | Kelas 1A | P | 081298765431`}
              className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-mono leading-relaxed"
            />

            <div className="flex gap-2">
              <button
                onClick={handleParseText}
                className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-md shadow-emerald-500/20"
              >
                Pratinjau Data Impor
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Preview Table */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-md h-full flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                Hasil Ekstraksi Pratinjau
              </h3>

              <span className="bg-slate-800 text-emerald-400 text-xs font-mono font-bold px-2.5 py-0.5 rounded-full border border-slate-700">
                {parsedPreview.length} Siswa Terdeteksi
              </span>
            </div>

            {parsedPreview.length === 0 ? (
              <div className="py-16 text-center text-slate-500 space-y-2 my-auto">
                <AlertCircle className="w-10 h-10 mx-auto text-slate-600" />
                <p className="text-xs">
                  Belum ada data yang diekstraksi. Tempelkan data di sebelah kiri lalu klik "Pratinjau Data Impor".
                </p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col justify-between mt-3 space-y-4">
                <div className="overflow-y-auto max-h-[350px] space-y-2 pr-1 scrollbar-thin">
                  {parsedPreview.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold text-white">{item.name}</div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-emerald-400">{item.nisn}</span>
                          <span>•</span>
                          <span>{item.class}</span>
                          <span>•</span>
                          <span>G: {item.gender}</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block">WA Ortu:</span>
                        <span className="font-mono font-semibold text-emerald-300">
                          {item.parentPhone}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleApplyImport}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center space-x-2 transition-all shadow-lg shadow-emerald-500/20"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Simpan All {parsedPreview.length} Siswa ke Database</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Library Card PDF Import Modal */}
      {settings && (
        <LibraryImportModal
          isOpen={isLibraryModalOpen}
          onClose={() => setIsLibraryModalOpen(false)}
          existingStudents={existingStudents}
          settings={settings}
          onImportSuccess={(newStudents) => {
            onBatchAddStudents(newStudents);
            setImportSuccessMessage(
              `Berhasil mengimpor ${newStudents.length} data siswa dari kartu perpustakaan!`
            );
            setTimeout(() => {
              setImportSuccessMessage(null);
              onNavigateToStudents();
            }, 1800);
          }}
        />
      )}
    </div>
  );
};
