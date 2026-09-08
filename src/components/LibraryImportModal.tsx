import React, { useState, useRef } from 'react';
import {
  FileText,
  Upload,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  X,
  Barcode,
  Check,
  RefreshCw,
  FileSpreadsheet,
} from 'lucide-react';
import { Student, AppSettings } from '../types';
import { parseLibraryPDF, ParsedLibraryStudent } from '../utils/pdfLibraryParser';
import { INITIAL_CLASSES } from '../data/initialData';

interface LibraryImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingStudents: Student[];
  onImportSuccess: (newStudents: Student[]) => void;
  settings: AppSettings;
}

export const LibraryImportModal: React.FC<LibraryImportModalProps> = ({
  isOpen,
  onClose,
  existingStudents,
  onImportSuccess,
  settings,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parsedList, setParsedList] = useState<ParsedLibraryStudent[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [defaultClass, setDefaultClass] = useState<string>('Otomatis');
  const [manualTextInput, setManualTextInput] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'PDF' | 'TEXT'>('PDF');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<{ total: number; duplicates: number } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileUpload = async (selectedFile: File) => {
    if (!selectedFile) return;
    if (!selectedFile.name.toLowerCase().endsWith('.pdf')) {
      setErrorMsg('Harap pilih file dokumen berformat PDF kartu perpustakaan / kartu siswa.');
      return;
    }

    setFile(selectedFile);
    setErrorMsg(null);
    setIsParsing(true);
    setParsedList([]);

    try {
      const result = await parseLibraryPDF(selectedFile);
      if (result.students.length === 0) {
        setErrorMsg(
          `Berhasil membaca ${result.totalPages} halaman PDF, namun tidak ditemukan pola teks nama & barcode perpustakaan yang jelas. Anda juga bisa menyalin teks kartu perpustakaan ke tab "Salin-Tempel Teks Barcode".`
        );
      } else {
        setParsedList(result.students);
        setSelectedIndices(new Set(result.students.map((_, i) => i)));

        const existingNisns = new Set(existingStudents.map((s) => s.nisn));
        const dupCount = result.students.filter((s) => existingNisns.has(s.nisn)).length;
        setImportSummary({ total: result.students.length, duplicates: dupCount });
      }
    } catch (err: any) {
      console.error('PDF Parse Error:', err);
      setErrorMsg(
        'Gagal membaca file PDF: ' + (err?.message || 'Pastikan file PDF dapat dibuka dan tidak terenkripsi password.')
      );
    } finally {
      setIsParsing(false);
    }
  };

  const handleManualTextParse = () => {
    if (!manualTextInput.trim()) {
      setErrorMsg('Masukkan teks atau daftar barcode perpustakaan.');
      return;
    }

    const lines = manualTextInput.split('\n').filter((l) => l.trim().length > 0);
    const parsed: ParsedLibraryStudent[] = [];
    const seen = new Set<string>();

    lines.forEach((line) => {
      const barcodeMatch = line.match(/\b(\d{4,18})\b/);
      if (barcodeMatch) {
        const barcodeNum = barcodeMatch[1];
        let name = line.replace(barcodeNum, '').replace(/[,;\t|]/g, ' ').trim();
        name = name.replace(/^(nama|nisn|kelas|no|id|nomor)\s*[:=-]?\s*/gi, '').trim();

        if (name.length >= 3 && !seen.has(barcodeNum)) {
          seen.add(barcodeNum);
          parsed.push({
            id: `std-lib-${barcodeNum}`,
            nisn: barcodeNum,
            name: name,
            class: defaultClass === 'Otomatis' ? 'Kelas 1A' : defaultClass,
            gender: 'L',
            parentPhone: '6281234567890',
            rawTextSample: line,
          });
        }
      }
    });

    if (parsed.length === 0) {
      setErrorMsg('Tidak ditemukan format nomor barcode dan nama yang valid pada teks.');
    } else {
      setErrorMsg(null);
      setParsedList(parsed);
      setSelectedIndices(new Set(parsed.map((_, i) => i)));
      const existingNisns = new Set(existingStudents.map((s) => s.nisn));
      const dupCount = parsed.filter((s) => existingNisns.has(s.nisn)).length;
      setImportSummary({ total: parsed.length, duplicates: dupCount });
    }
  };

  const toggleSelect = (index: number) => {
    const next = new Set(selectedIndices);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    setSelectedIndices(next);
  };

  const toggleSelectAll = () => {
    if (selectedIndices.size === parsedList.length) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(parsedList.map((_, i) => i)));
    }
  };

  const handleUpdateItem = (index: number, field: keyof ParsedLibraryStudent, value: string) => {
    const updated = [...parsedList];
    updated[index] = { ...updated[index], [field]: value };
    setParsedList(updated);
  };

  const handleCommitImport = () => {
    const toImport = parsedList.filter((_, i) => selectedIndices.has(i));
    if (toImport.length === 0) {
      setErrorMsg('Pilih minimal satu data siswa untuk diimpor.');
      return;
    }

    const newStudentObjects: Student[] = toImport.map((item) => {
      const assignedClass = defaultClass === 'Otomatis' ? item.class : defaultClass;
      return {
        id: `std-${item.nisn}-${Date.now()}`,
        nisn: item.nisn,
        name: item.name,
        class: assignedClass || 'Kelas 1A',
        gender: item.gender || 'L',
        parentPhone: item.parentPhone || '6281234567890',
        photoUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name)}&background=0D9488&color=fff`,
      };
    });

    onImportSuccess(newStudentObjects);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:p-6 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                Impor Data Kartu Siswa & Perpustakaan (PDF)
              </h2>
              <p className="text-xs text-slate-400">
                Gunakan barcode & nama dari kartu perpustakaan (SLiMS, Inlislite, Canva, atau cetakan kartu PDF).
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5 custom-scrollbar">
          {/* Method Tabs */}
          <div className="flex gap-2 border-b border-slate-800 pb-3">
            <button
              onClick={() => setActiveTab('PDF')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                activeTab === 'PDF'
                  ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Unggah File PDF Kartu Perpustakaan</span>
            </button>

            <button
              onClick={() => setActiveTab('TEXT')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                activeTab === 'TEXT'
                  ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Salin-Tempel Teks Barcode</span>
            </button>
          </div>

          {/* Tab 1: Upload PDF */}
          {activeTab === 'PDF' && (
            <div className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files?.[0]) {
                    handleFileUpload(e.dataTransfer.files[0]);
                  }
                }}
                className="border-2 border-dashed border-slate-700 hover:border-emerald-500/80 rounded-2xl p-6 sm:p-8 bg-slate-950/60 text-center cursor-pointer transition-all hover:bg-slate-950 group"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      handleFileUpload(e.target.files[0]);
                    }
                  }}
                />

                <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-emerald-400 group-hover:scale-110 group-hover:border-emerald-500/50 transition-all mb-3 shadow-lg">
                  {isParsing ? (
                    <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
                  ) : (
                    <Upload className="w-6 h-6" />
                  )}
                </div>

                <h3 className="text-sm font-bold text-white mb-1">
                  {file ? file.name : 'Klik untuk Memilih File PDF Kartu Perpustakaan'}
                </h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Tarik & lepas file PDF kartu perpustakaan di sini. Sistem akan otomatis mengekstrak Nama Lengkap dan Nomor Barcode siswa.
                </p>
              </div>
            </div>
          )}

          {/* Tab 2: Manual Text / Paste */}
          {activeTab === 'TEXT' && (
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-300">
                Tempelkan Teks Daftar Nama & Barcode Anggota Perpustakaan:
              </label>
              <textarea
                rows={5}
                value={manualTextInput}
                onChange={(e) => setManualTextInput(e.target.value)}
                placeholder="Contoh format:&#10;0151234501 Ahmad Santoso&#10;0151234502 Siti Nurhaliza&#10;0151234503 Budi Pratama, Kelas 4A"
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
              />
              <button
                onClick={handleManualTextParse}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all"
              >
                Proses Teks Barcode
              </button>
            </div>
          )}

          {/* Error Notice */}
          {errorMsg && (
            <div className="p-3.5 bg-rose-500/15 border border-rose-500/40 rounded-xl flex items-start gap-2.5 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Extracted Preview List */}
          {parsedList.length > 0 && (
            <div className="space-y-3 pt-2">
              {/* Batch Controls Bar */}
              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <button
                    onClick={toggleSelectAll}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-bold hover:bg-slate-800"
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>
                      {selectedIndices.size === parsedList.length ? 'Batal Semua' : 'Pilih Semua'} (
                      {selectedIndices.size}/{parsedList.length})
                    </span>
                  </button>

                  {importSummary && importSummary.duplicates > 0 && (
                    <span className="text-amber-400 font-medium">
                      ⚠️ {importSummary.duplicates} barcode sudah ada di database
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-semibold">Tentukan Kelas:</span>
                  <select
                    value={defaultClass}
                    onChange={(e) => setDefaultClass(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1 text-xs font-semibold"
                  >
                    <option value="Otomatis">Otomatis dari PDF</option>
                    {INITIAL_CLASSES.map((cls) => (
                      <option key={cls} value={cls}>
                        {cls}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Table / List */}
              <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950">
                <div className="max-h-64 overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/90 text-slate-400 uppercase font-bold sticky top-0 border-b border-slate-800">
                      <tr>
                        <th className="p-3 w-10 text-center">Pilih</th>
                        <th className="p-3">Nomor Barcode / NISN</th>
                        <th className="p-3">Nama Siswa</th>
                        <th className="p-3">Kelas</th>
                        <th className="p-3">No. WA Orang Tua</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {parsedList.map((item, idx) => {
                        const isSelected = selectedIndices.has(idx);
                        const isDuplicate = existingStudents.some((s) => s.nisn === item.nisn);

                        return (
                          <tr
                            key={idx}
                            className={`hover:bg-slate-900/50 transition-colors ${
                              isSelected ? 'bg-emerald-950/20' : ''
                            }`}
                          >
                            <td className="p-3 text-center">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelect(idx)}
                                className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-400 bg-slate-900 border-slate-700 cursor-pointer"
                              />
                            </td>

                            <td className="p-3 font-mono font-bold text-emerald-400">
                              <div className="flex items-center gap-1.5">
                                <Barcode className="w-4 h-4 text-slate-500" />
                                <input
                                  type="text"
                                  value={item.nisn}
                                  onChange={(e) => handleUpdateItem(idx, 'nisn', e.target.value)}
                                  className="bg-transparent border-b border-transparent hover:border-slate-600 focus:border-emerald-500 focus:bg-slate-900 px-1 py-0.5 rounded text-emerald-300 font-mono w-32 focus:outline-none"
                                />
                                {isDuplicate && (
                                  <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-bold">
                                    Duplikat
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="p-3">
                              <input
                                type="text"
                                value={item.name}
                                onChange={(e) => handleUpdateItem(idx, 'name', e.target.value)}
                                className="bg-transparent border-b border-transparent hover:border-slate-600 focus:border-emerald-500 focus:bg-slate-900 px-1 py-0.5 rounded text-white font-bold w-full focus:outline-none"
                              />
                            </td>

                            <td className="p-3">
                              <input
                                type="text"
                                value={defaultClass === 'Otomatis' ? item.class : defaultClass}
                                onChange={(e) => handleUpdateItem(idx, 'class', e.target.value)}
                                className="bg-transparent border-b border-transparent hover:border-slate-600 focus:border-emerald-500 focus:bg-slate-900 px-1 py-0.5 rounded text-slate-300 w-24 focus:outline-none"
                              />
                            </td>

                            <td className="p-3">
                              <input
                                type="text"
                                value={item.parentPhone}
                                onChange={(e) => handleUpdateItem(idx, 'parentPhone', e.target.value)}
                                placeholder="6281..."
                                className="bg-transparent border-b border-transparent hover:border-slate-600 focus:border-emerald-500 focus:bg-slate-900 px-1 py-0.5 rounded text-slate-400 font-mono w-28 focus:outline-none"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-6 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-400">
            {parsedList.length > 0 ? (
              <span>
                Total <strong className="text-white">{selectedIndices.size}</strong> dari{' '}
                <strong className="text-white">{parsedList.length}</strong> siswa siap disimpan ke Cloud Firestore.
              </span>
            ) : (
              <span>Pilih file PDF untuk memuat data.</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl"
            >
              Batal
            </button>

            <button
              onClick={handleCommitImport}
              disabled={selectedIndices.size === 0}
              className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-emerald-500/20 flex items-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Simpan ke Database ({selectedIndices.size} Siswa)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
