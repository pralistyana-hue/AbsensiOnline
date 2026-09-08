import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Search,
  Edit2,
  Trash2,
  UserPlus,
  X,
  CreditCard,
  Printer,
  Download,
  Camera,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  GraduationCap,
  Phone,
  MessageSquare,
  Copy,
  Check,
  CheckCircle2,
  LayoutGrid,
  List,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import { Student, AppSettings, HomeroomTeacher } from '../types';
import { LibraryImportModal } from './LibraryImportModal';
import { generateStudentQRCode } from '../utils/qrGenerator';
import { generate1DBarcodeDataUrl } from '../utils/barcodeGenerator';
import { exportSingleCardToPDF, exportStudentCardsToPDF } from '../utils/exportUtils';
import { createWhatsAppLink, getTeacherForClass } from '../utils/whatsapp';
import { INITIAL_CLASSES } from '../data/initialData';

interface StudentsViewProps {
  students: Student[];
  teachers?: HomeroomTeacher[];
  settings: AppSettings;
  onAddStudent: (student: Student) => void;
  onUpdateStudent: (student: Student) => void;
  onUpdateStudentPhoto?: (studentId: string, photoUrl: string) => void;
  onDeleteStudent: (id: string) => void;
  onAddTeacher?: (teacher: HomeroomTeacher) => void;
  onUpdateTeacher?: (teacher: HomeroomTeacher) => void;
  onDeleteTeacher?: (id: string) => void;
}

type ViewMode = 'by_class' | 'all_students' | 'teachers';

export const StudentsView: React.FC<StudentsViewProps> = ({
  students,
  teachers = [],
  settings,
  onAddStudent,
  onUpdateStudent,
  onUpdateStudentPhoto,
  onDeleteStudent,
  onAddTeacher,
  onUpdateTeacher,
  onDeleteTeacher,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('by_class');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClassTab, setSelectedClassTab] = useState<string>('ALL');

  // Modals state
  const [isAddStudentModalOpen, setIsAddStudentModalOpen] = useState(false);
  const [isTeacherModalOpen, setIsTeacherModalOpen] = useState(false);
  const [isLibraryModalOpen, setIsLibraryModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editingTeacher, setEditingTeacher] = useState<HomeroomTeacher | null>(null);
  const [cardModalStudent, setCardModalStudent] = useState<Student | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [barcode1DUrl, setBarcode1DUrl] = useState<string>('');
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [copiedNisn, setCopiedNisn] = useState<string | null>(null);

  // Pagination for all-students table mode
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Student Form State
  const [formNisn, setFormNisn] = useState('');
  const [formName, setFormName] = useState('');
  const [formClass, setFormClass] = useState('Kelas 1');
  const [formGender, setFormGender] = useState<'L' | 'P'>('L');
  const [formPhone, setFormPhone] = useState('6281234567890');
  const [formPhotoUrl, setFormPhotoUrl] = useState<string>('');

  // Teacher Form State
  const [teacherName, setTeacherName] = useState('');
  const [teacherNip, setTeacherNip] = useState('');
  const [teacherPhone, setTeacherPhone] = useState('6281211112222');
  const [teacherClass, setTeacherClass] = useState('Kelas 1');
  const [teacherNotes, setTeacherNotes] = useState('');

  // Distinct classes list
  const classesList = useMemo(() => {
    const raw = Array.from(
      new Set([
        ...INITIAL_CLASSES,
        ...students.map((s) => s.class),
        ...teachers.map((t) => t.assignedClass),
      ])
    ).filter(Boolean);
    return raw.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [students, teachers]);

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedClassTab, viewMode]);

  // Generate QR code and 1D Barcode when opening card modal
  useEffect(() => {
    if (cardModalStudent) {
      generateStudentQRCode(cardModalStudent.nisn).then(setQrDataUrl);
      const b1d = generate1DBarcodeDataUrl(cardModalStudent.nisn);
      setBarcode1DUrl(b1d);
    } else {
      setQrDataUrl('');
      setBarcode1DUrl('');
    }
  }, [cardModalStudent]);

  // Copy helper
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedNisn(text);
    setTimeout(() => setCopiedNisn(null), 2000);
  };

  // Open Add Student Modal
  const handleOpenAddStudentModal = (targetClass?: string) => {
    setEditingStudent(null);
    setFormNisn(`015${Math.floor(1000000 + Math.random() * 9000000)}`);
    setFormName('');
    setFormClass(targetClass || (selectedClassTab !== 'ALL' ? selectedClassTab : classesList[0] || 'Kelas 1'));
    setFormGender('L');
    setFormPhone('6281234567890');
    setFormPhotoUrl('');
    setIsAddStudentModalOpen(true);
  };

  // Open Edit Student Modal
  const handleOpenEditStudentModal = (std: Student) => {
    setEditingStudent(std);
    setFormNisn(std.nisn);
    setFormName(std.name);
    setFormClass(std.class);
    setFormGender(std.gender);
    setFormPhone(std.parentPhone);
    setFormPhotoUrl(std.photoUrl || '');
    setIsAddStudentModalOpen(true);
  };

  // Open Teacher Modal
  const handleOpenAddTeacherModal = (targetClass?: string) => {
    setEditingTeacher(null);
    setTeacherName('');
    setTeacherNip('');
    setTeacherPhone('6281211112222');
    setTeacherClass(targetClass || (selectedClassTab !== 'ALL' ? selectedClassTab : classesList[0] || 'Kelas 1'));
    setTeacherNotes('');
    setIsTeacherModalOpen(true);
  };

  const handleOpenEditTeacherModal = (tch: HomeroomTeacher) => {
    setEditingTeacher(tch);
    setTeacherName(tch.name);
    setTeacherNip(tch.nip || '');
    setTeacherPhone(tch.phone);
    setTeacherClass(tch.assignedClass);
    setTeacherNotes(tch.notes || '');
    setIsTeacherModalOpen(true);
  };

  const handleSaveTeacher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherName || !teacherPhone || !teacherClass) return;

    if (editingTeacher) {
      if (onUpdateTeacher) {
        onUpdateTeacher({
          ...editingTeacher,
          name: teacherName,
          nip: teacherNip || undefined,
          phone: teacherPhone,
          assignedClass: teacherClass,
          notes: teacherNotes || undefined,
        });
      }
    } else {
      if (onAddTeacher) {
        onAddTeacher({
          id: `tch-${Date.now()}`,
          name: teacherName,
          nip: teacherNip || undefined,
          phone: teacherPhone,
          assignedClass: teacherClass,
          notes: teacherNotes || undefined,
        });
      }
    }
    setIsTeacherModalOpen(false);
  };

  const handlePhotoFileUpload = (e: React.ChangeEvent<HTMLInputElement>, studentId?: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (studentId) {
        const std = students.find((s) => s.id === studentId);
        if (std) {
          onUpdateStudent({ ...std, photoUrl: dataUrl });
          if (onUpdateStudentPhoto) onUpdateStudentPhoto(studentId, dataUrl);
        }
      } else {
        setFormPhotoUrl(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNisn || !formName) return;

    if (editingStudent) {
      onUpdateStudent({
        ...editingStudent,
        nisn: formNisn,
        name: formName,
        class: formClass,
        gender: formGender,
        parentPhone: formPhone,
        photoUrl: formPhotoUrl || editingStudent.photoUrl,
      });
    } else {
      onAddStudent({
        id: `std-${Date.now()}`,
        nisn: formNisn,
        name: formName,
        class: formClass,
        gender: formGender,
        parentPhone: formPhone,
        photoUrl: formPhotoUrl,
      });
    }

    setIsAddStudentModalOpen(false);
  };

  // Filter students based on search query and selected class tab
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const matchSearch =
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.nisn.includes(searchQuery) ||
        s.parentPhone.includes(searchQuery) ||
        s.class.toLowerCase().includes(searchQuery.toLowerCase());

      const matchClass = selectedClassTab === 'ALL' || s.class === selectedClassTab;

      return matchSearch && matchClass;
    });
  }, [students, searchQuery, selectedClassTab]);

  // Grouped students for Per-Class view
  const classesToRender = useMemo(() => {
    if (selectedClassTab === 'ALL') {
      return classesList;
    }
    return classesList.filter((c) => c === selectedClassTab);
  }, [classesList, selectedClassTab]);

  // Bulk PDF Card Export for a specific class or filtered
  const handleExportClassCards = async (className?: string) => {
    setIsExportingPDF(true);
    const targetStudents = className
      ? students.filter((s) => s.class === className)
      : filteredStudents;

    if (targetStudents.length === 0) {
      alert('Tidak ada siswa di kelas ini untuk dicetak kartunya.');
      setIsExportingPDF(false);
      return;
    }

    try {
      await exportStudentCardsToPDF(targetStudents, settings);
    } catch (err) {
      console.error(err);
      alert('Gagal mengekspor kartu ke PDF.');
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handlePrintCard = () => {
    window.print();
  };

  // Total statistics
  const totalBoys = useMemo(() => students.filter((s) => s.gender === 'L').length, [students]);
  const totalGirls = useMemo(() => students.filter((s) => s.gender === 'P').length, [students]);

  return (
    <div className="space-y-5">
      {/* Top Header & Overview */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Manajemen Data Siswa & Wali Kelas
                </h2>
                <p className="text-xs text-slate-400">
                  Kelola data siswa per kelas dengan tampilan ringkas, data wali kelas, dan kartu barcode 1D.
                </p>
              </div>
            </div>

            {/* Quick Stats Pill */}
            <div className="flex flex-wrap items-center gap-2 mt-3 text-xs">
              <span className="px-3 py-1 bg-slate-800 text-slate-200 rounded-full font-semibold flex items-center gap-1.5 border border-slate-700/60">
                <Users className="w-3.5 h-3.5 text-emerald-400" />
                <span>Total: <b>{students.length}</b> Siswa</span>
              </span>
              <span className="px-2.5 py-1 bg-blue-950/60 text-blue-300 rounded-full font-medium border border-blue-800/40">
                👦 Laki-laki: <b>{totalBoys}</b>
              </span>
              <span className="px-2.5 py-1 bg-pink-950/60 text-pink-300 rounded-full font-medium border border-pink-800/40">
                👧 Perempuan: <b>{totalGirls}</b>
              </span>
              <span className="px-2.5 py-1 bg-emerald-950/60 text-emerald-300 rounded-full font-medium border border-emerald-800/40 flex items-center gap-1">
                <GraduationCap className="w-3.5 h-3.5" />
                <span><b>{teachers.length}</b> Guru Wali Kelas</span>
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsLibraryModalOpen(true)}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 border border-slate-700 transition"
              title="Impor data dari file PDF Kartu Anggota Perpustakaan"
            >
              <BookOpen className="w-4 h-4 text-emerald-400" />
              <span>Impor PDF Kartu</span>
            </button>

            <button
              onClick={() => handleExportClassCards(selectedClassTab !== 'ALL' ? selectedClassTab : undefined)}
              disabled={isExportingPDF}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 border border-slate-700 transition"
            >
              <Printer className="w-4 h-4 text-emerald-400" />
              <span>{isExportingPDF ? 'Memproses...' : 'Cetak Semua Kartu'}</span>
            </button>

            {onAddTeacher && (
              <button
                onClick={() => handleOpenAddTeacherModal()}
                className="px-3.5 py-2 bg-indigo-600/90 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition shadow-md shadow-indigo-600/20"
              >
                <GraduationCap className="w-4 h-4" />
                <span>+ Guru Wali</span>
              </button>
            )}

            <button
              onClick={() => handleOpenAddStudentModal()}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl flex items-center gap-1.5 transition shadow-md shadow-emerald-500/20"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Tambah Siswa</span>
            </button>
          </div>
        </div>

        {/* View Mode Switcher Tabs */}
        <div className="flex items-center justify-between border-t border-slate-800 mt-4 pt-4 gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-2xl border border-slate-800">
            <button
              onClick={() => setViewMode('by_class')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
                viewMode === 'by_class'
                  ? 'bg-emerald-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>📁 Tampilan Per Kelas</span>
            </button>

            <button
              onClick={() => setViewMode('all_students')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
                viewMode === 'all_students'
                  ? 'bg-emerald-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>📋 Semua Siswa (Tabel)</span>
            </button>

            <button
              onClick={() => setViewMode('teachers')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
                viewMode === 'teachers'
                  ? 'bg-emerald-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>👩‍🏫 Data Guru Wali ({teachers.length})</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama, NISN, no WA, atau kelas..."
              className="w-full pl-9 pr-8 py-1.5 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mode 1: TAMPILAN PER KELAS (FOCUSED & SIMPLE) */}
      {viewMode === 'by_class' && (
        <div className="space-y-4">
          {/* Quick Class Selector Tabs / Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
            <button
              onClick={() => setSelectedClassTab('ALL')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition flex items-center gap-2 ${
                selectedClassTab === 'ALL'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
              }`}
            >
              <span>Semua Kelas</span>
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono ${
                selectedClassTab === 'ALL' ? 'bg-slate-950 text-emerald-300' : 'bg-slate-800 text-slate-400'
              }`}>
                {students.length}
              </span>
            </button>

            {classesList.map((cls) => {
              const countInClass = students.filter((s) => s.class === cls).length;
              const teacher = getTeacherForClass(teachers, cls);
              const isSelected = selectedClassTab === cls;

              return (
                <button
                  key={cls}
                  onClick={() => setSelectedClassTab(cls)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition flex items-center gap-2 ${
                    isSelected
                      ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                  }`}
                >
                  <span>{cls}</span>
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono ${
                    isSelected ? 'bg-slate-950 text-emerald-300' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {countInClass}
                  </span>
                  {teacher && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title={`Wali: ${teacher.name}`} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Render Each Class Section */}
          {classesToRender.length === 0 ? (
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-12 text-center text-slate-400">
              <Users className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="font-semibold text-sm">Tidak ada data kelas yang cocok.</p>
            </div>
          ) : (
            classesToRender.map((className) => {
              const classStudents = filteredStudents.filter((s) => s.class === className);
              const teacher = getTeacherForClass(teachers, className);
              const boysCount = classStudents.filter((s) => s.gender === 'L').length;
              const girlsCount = classStudents.filter((s) => s.gender === 'P').length;

              return (
                <div
                  key={className}
                  className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-lg transition-all"
                >
                  {/* Class Header Banner */}
                  <div className="bg-slate-950/80 px-5 py-3.5 border-b border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                        <h3 className="text-base font-bold text-white tracking-wide">
                          {className}
                        </h3>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="px-2 py-0.5 bg-slate-800 text-emerald-400 rounded-md font-semibold font-mono">
                          {classStudents.length} Siswa
                        </span>
                        <span className="px-1.5 py-0.5 bg-blue-950/50 text-blue-300 rounded text-[11px]">
                          👦 {boysCount} L
                        </span>
                        <span className="px-1.5 py-0.5 bg-pink-950/50 text-pink-300 rounded text-[11px]">
                          👧 {girlsCount} P
                        </span>
                      </div>
                    </div>

                    {/* Homeroom Teacher Badge / Quick WA */}
                    <div className="flex items-center gap-2">
                      {teacher ? (
                        <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700/60 text-xs">
                          <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[10px]">
                            {teacher.name.charAt(0)}
                          </div>
                          <div className="leading-tight">
                            <span className="text-[10px] text-slate-400 block">Wali Kelas:</span>
                            <span className="font-semibold text-white">{teacher.name}</span>
                          </div>

                          <a
                            href={createWhatsAppLink(teacher.phone, `Halo Bapak/Ibu ${teacher.name} (Wali Kelas ${className}), `)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-1 p-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition"
                            title={`Kirim WA ke Wali Kelas (${teacher.phone})`}
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </a>

                          {onUpdateTeacher && (
                            <button
                              onClick={() => handleOpenEditTeacherModal(teacher)}
                              className="p-1 hover:text-white text-slate-400 transition"
                              title="Edit Data Guru Wali"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => handleOpenAddTeacherModal(className)}
                          className="px-2.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition"
                        >
                          <GraduationCap className="w-3.5 h-3.5 text-amber-400" />
                          <span>+ Tetapkan Wali Kelas</span>
                        </button>
                      )}

                      {/* Class Quick Actions */}
                      <button
                        onClick={() => handleExportClassCards(className)}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition border border-slate-700"
                        title={`Cetak Semua Kartu Barcode ${className}`}
                      >
                        <Printer className="w-3.5 h-3.5 text-emerald-400" />
                      </button>

                      <button
                        onClick={() => handleOpenAddStudentModal(className)}
                        className="px-2.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold rounded-xl flex items-center gap-1 transition"
                        title={`Tambah Siswa ke ${className}`}
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">+ Siswa</span>
                      </button>
                    </div>
                  </div>

                  {/* Student Table for this Class */}
                  {classStudents.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-xs">
                      Belum ada data siswa di {className}. Klik <b>+ Siswa</b> untuk menambahkan siswa baru.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs text-slate-300">
                        <thead className="bg-slate-950/40 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800/60">
                          <tr>
                            <th className="py-2.5 px-4 w-12 text-center">No</th>
                            <th className="py-2.5 px-3">Siswa</th>
                            <th className="py-2.5 px-3">NISN</th>
                            <th className="py-2.5 px-3 text-center">L/P</th>
                            <th className="py-2.5 px-3">WhatsApp Orang Tua</th>
                            <th className="py-2.5 px-4 text-right">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/40">
                          {classStudents.map((std, idx) => (
                            <tr key={std.id} className="hover:bg-slate-800/40 transition-colors">
                              <td className="py-2.5 px-4 text-center font-mono text-slate-500">
                                {idx + 1}
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="flex items-center space-x-2.5">
                                  <div className="relative group/avatar cursor-pointer">
                                    <img
                                      src={
                                        std.photoUrl ||
                                        `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                          std.name
                                        )}&background=0D9488&color=fff`
                                      }
                                      alt={std.name}
                                      className="w-8 h-8 rounded-lg object-cover border border-slate-700 shrink-0"
                                    />
                                    <label
                                      className="absolute inset-0 bg-slate-950/70 rounded-lg flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity cursor-pointer"
                                      title="Ubah Foto Siswa"
                                    >
                                      <Camera className="w-3.5 h-3.5 text-emerald-400" />
                                      <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => handlePhotoFileUpload(e, std.id)}
                                      />
                                    </label>
                                  </div>
                                  <div>
                                    <span className="font-semibold text-white block">
                                      {std.name}
                                    </span>
                                  </div>
                                </div>
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-bold text-emerald-400">
                                    {std.nisn}
                                  </span>
                                  <button
                                    onClick={() => handleCopy(std.nisn)}
                                    className="p-1 text-slate-500 hover:text-white transition"
                                    title="Salin NISN"
                                  >
                                    {copiedNisn === std.nisn ? (
                                      <Check className="w-3 h-3 text-emerald-400" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded font-bold text-[10px] ${
                                    std.gender === 'L'
                                      ? 'bg-blue-950/60 text-blue-400 border border-blue-800/40'
                                      : 'bg-pink-950/60 text-pink-400 border border-pink-800/40'
                                  }`}
                                >
                                  {std.gender === 'L' ? 'L' : 'P'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3">
                                <a
                                  href={createWhatsAppLink(std.parentPhone, `Yth. Orang Tua dari ${std.name} (${std.class}), `)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 font-mono text-slate-300 hover:text-emerald-400 transition"
                                  title="Kirim pesan WhatsApp ke Orang Tua"
                                >
                                  <Phone className="w-3 h-3 text-emerald-500" />
                                  <span>{std.parentPhone}</span>
                                </a>
                              </td>
                              <td className="py-2.5 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => setCardModalStudent(std)}
                                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 rounded-lg transition border border-slate-700/60"
                                    title="Lihat & Cetak Kartu Barcode 1D"
                                  >
                                    <CreditCard className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleOpenEditStudentModal(std)}
                                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition border border-slate-700/60"
                                    title="Edit Data Siswa"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (confirm(`Apakah Anda yakin ingin menghapus data ${std.name} (${std.nisn})?`)) {
                                        onDeleteStudent(std.id);
                                      }
                                    }}
                                    className="p-1.5 bg-slate-800 hover:bg-rose-900/50 text-slate-400 hover:text-rose-400 rounded-lg transition border border-slate-700/60"
                                    title="Hapus Siswa"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Mode 2: TABEL LENGKAP SEMUA SISWA (PAGINATED & SEARCHABLE) */}
      {viewMode === 'all_students' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">No</th>
                  <th className="py-3 px-3">Foto & Nama Siswa</th>
                  <th className="py-3 px-3">NISN</th>
                  <th className="py-3 px-3">Kelas</th>
                  <th className="py-3 px-3 text-center">L/P</th>
                  <th className="py-3 px-3">No. WhatsApp Orang Tua</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-500">
                      Tidak ada siswa yang ditemukan untuk pencarian "{searchQuery}".
                    </td>
                  </tr>
                ) : (
                  filteredStudents
                    .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                    .map((std, idx) => {
                      const actualIdx = (currentPage - 1) * itemsPerPage + idx + 1;
                      return (
                        <tr key={std.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-2.5 px-4 text-center font-mono text-slate-500">
                            {actualIdx}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center space-x-2.5">
                              <img
                                src={
                                  std.photoUrl ||
                                  `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                    std.name
                                  )}&background=0D9488&color=fff`
                                }
                                alt={std.name}
                                className="w-8 h-8 rounded-lg object-cover border border-slate-700 shrink-0"
                              />
                              <div>
                                <span className="font-semibold text-white block">
                                  {std.name}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-mono font-bold text-emerald-400">
                              {std.nisn}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 bg-slate-800 text-slate-200 rounded font-semibold text-[11px] border border-slate-700">
                              {std.class}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`inline-block px-2 py-0.5 rounded font-bold text-[10px] ${
                                std.gender === 'L'
                                  ? 'bg-blue-950/60 text-blue-400 border border-blue-800/40'
                                  : 'bg-pink-950/60 text-pink-400 border border-pink-800/40'
                              }`}
                            >
                              {std.gender === 'L' ? 'L' : 'P'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <a
                              href={createWhatsAppLink(std.parentPhone, `Yth. Orang Tua dari ${std.name} (${std.class}), `)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-mono text-slate-300 hover:text-emerald-400 transition"
                            >
                              <Phone className="w-3 h-3 text-emerald-500" />
                              <span>{std.parentPhone}</span>
                            </a>
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setCardModalStudent(std)}
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 rounded-lg transition border border-slate-700/60"
                                title="Lihat & Cetak Kartu Barcode"
                              >
                                <CreditCard className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleOpenEditStudentModal(std)}
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition border border-slate-700/60"
                                title="Edit Data Siswa"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(`Apakah Anda yakin ingin menghapus data ${std.name} (${std.nisn})?`)) {
                                    onDeleteStudent(std.id);
                                  }
                                }}
                                className="p-1.5 bg-slate-800 hover:bg-rose-900/50 text-slate-400 hover:text-rose-400 rounded-lg transition border border-slate-700/60"
                                title="Hapus Siswa"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {filteredStudents.length > itemsPerPage && (
            <div className="bg-slate-950/60 px-4 py-3 border-t border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400">
                Menampilkan {(currentPage - 1) * itemsPerPage + 1} -{' '}
                {Math.min(currentPage * itemsPerPage, filteredStudents.length)} dari{' '}
                {filteredStudents.length} siswa
              </span>
              <div className="flex items-center space-x-1">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3 py-1 font-bold text-white font-mono">
                  {currentPage} / {Math.ceil(filteredStudents.length / itemsPerPage)}
                </span>
                <button
                  disabled={currentPage >= Math.ceil(filteredStudents.length / itemsPerPage)}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mode 3: DATA GURU WALI KELAS */}
      {viewMode === 'teachers' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teachers.map((teacher) => {
              const studentsInClass = students.filter((s) => s.class === teacher.assignedClass);

              return (
                <div
                  key={teacher.id}
                  className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg relative group space-y-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-950/80 border border-indigo-700/50 text-indigo-400 flex items-center justify-center font-bold text-base shadow-inner">
                        {teacher.name.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-sm">{teacher.name}</h4>
                        {teacher.nip && (
                          <span className="text-[11px] text-slate-400 font-mono block">
                            NIP: {teacher.nip}
                          </span>
                        )}
                        <span className="inline-block mt-1 px-2.5 py-0.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-md text-[11px] font-bold">
                          Wali {teacher.assignedClass}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {onUpdateTeacher && (
                        <button
                          onClick={() => handleOpenEditTeacherModal(teacher)}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition"
                          title="Edit Guru Wali"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {onDeleteTeacher && (
                        <button
                          onClick={() => {
                            if (confirm(`Hapus guru wali ${teacher.name}?`)) {
                              onDeleteTeacher(teacher.id);
                            }
                          }}
                          className="p-1.5 bg-slate-800 hover:bg-rose-900/50 text-slate-400 hover:text-rose-400 rounded-lg transition"
                          title="Hapus Guru Wali"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="bg-slate-950/60 rounded-2xl p-3 border border-slate-800/80 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-slate-400">
                      <span>No. WhatsApp:</span>
                      <a
                        href={createWhatsAppLink(teacher.phone, `Halo Bapak/Ibu ${teacher.name}, `)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono font-bold text-emerald-400 hover:underline flex items-center gap-1"
                      >
                        <MessageSquare className="w-3 h-3" />
                        <span>{teacher.phone}</span>
                      </a>
                    </div>

                    <div className="flex items-center justify-between text-slate-400">
                      <span>Total Siswa di {teacher.assignedClass}:</span>
                      <span className="font-semibold text-white font-mono">
                        {studentsInClass.length} Siswa
                      </span>
                    </div>

                    {teacher.notes && (
                      <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-800">
                        {teacher.notes}
                      </div>
                    )}
                  </div>

                  {/* Fast Action */}
                  <a
                    href={createWhatsAppLink(teacher.phone, `Halo Bapak/Ibu ${teacher.name} (Wali Kelas ${teacher.assignedClass}), `)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2 bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition border border-slate-700"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Hubungi via WhatsApp</span>
                  </a>
                </div>
              );
            })}
          </div>

          {teachers.length === 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-slate-400">
              <GraduationCap className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="font-semibold text-sm">Belum ada data guru wali kelas yang terdaftar.</p>
              <button
                onClick={() => handleOpenAddTeacherModal()}
                className="mt-4 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl"
              >
                + Tambah Guru Wali Pertama
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modal Tambah / Edit Siswa */}
      {isAddStudentModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-emerald-400" />
                <span>{editingStudent ? 'Edit Data Siswa' : 'Tambah Siswa Baru'}</span>
              </h3>
              <button
                onClick={() => setIsAddStudentModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStudent} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">NISN (10 Digit Angka)</label>
                <input
                  type="text"
                  required
                  value={formNisn}
                  onChange={(e) => setFormNisn(e.target.value)}
                  placeholder="Misal: 0151234567"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Nama Lengkap Siswa</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Nama Lengkap Siswa"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Kelas</label>
                  <select
                    value={formClass}
                    onChange={(e) => setFormClass(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-500 text-xs font-semibold"
                  >
                    {classesList.map((cls) => (
                      <option key={cls} value={cls}>
                        {cls}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">Jenis Kelamin</label>
                  <select
                    value={formGender}
                    onChange={(e) => setFormGender(e.target.value as 'L' | 'P')}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="L">Laki-laki (L)</option>
                    <option value="P">Perempuan (P)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">No. WhatsApp Orang Tua / Wali</label>
                <input
                  type="text"
                  required
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="6281234567890"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:border-emerald-500"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Format internasional diawali 62 (contoh: 6281234567890)
                </p>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Foto Siswa</label>
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                    {formPhotoUrl ? (
                      <img src={formPhotoUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="w-5 h-5 text-slate-500" />
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoFileUpload}
                    className="text-xs text-slate-400 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-500 file:text-slate-950 hover:file:bg-emerald-400 cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddStudentModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow-md shadow-emerald-500/20"
                >
                  Simpan Siswa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Tambah / Edit Guru Wali */}
      {isTeacherModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-indigo-400" />
                <span>{editingTeacher ? 'Edit Guru Wali Kelas' : 'Tambah Guru Wali Kelas'}</span>
              </h3>
              <button
                onClick={() => setIsTeacherModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTeacher} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">Nama Lengkap & Gelar</label>
                <input
                  type="text"
                  required
                  value={teacherName}
                  onChange={(e) => setTeacherName(e.target.value)}
                  placeholder="Contoh: Anisa Rahmawati, S.Pd."
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">NIP (Nomor Induk Pegawai - Opsional)</label>
                <input
                  type="text"
                  value={teacherNip}
                  onChange={(e) => setTeacherNip(e.target.value)}
                  placeholder="Contoh: 19880315 201402 2 004"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Kelas yang Diampu</label>
                <select
                  value={teacherClass}
                  onChange={(e) => setTeacherClass(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500 font-semibold"
                >
                  {classesList.map((cls) => (
                    <option key={cls} value={cls}>
                      {cls}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">No. WhatsApp Guru Wali (Notifikasi Izin)</label>
                <input
                  type="text"
                  required
                  value={teacherPhone}
                  onChange={(e) => setTeacherPhone(e.target.value)}
                  placeholder="6281211112222"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:border-indigo-500"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Nomor ini akan menerima notifikasi otomatis saat ada orang tua siswa kelas ini yang mengirim izin/sakit.
                </p>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Catatan / Keterangan (Opsional)</label>
                <input
                  type="text"
                  value={teacherNotes}
                  onChange={(e) => setTeacherNotes(e.target.value)}
                  placeholder="Contoh: Wali Kelas 1 (Fase A)"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsTeacherModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-md shadow-indigo-600/20"
                >
                  Simpan Guru Wali
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Card Preview Modal */}
      {cardModalStudent && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl relative space-y-4">
            <button
              onClick={() => setCardModalStudent(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-sm font-bold text-white text-center">
              Pratinjau Kartu Pelajar Barcode Batang (1D)
            </h3>

            {/* Printable ID Card Container */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 border-2 border-emerald-500/50 rounded-2xl p-4 shadow-xl text-white relative overflow-hidden space-y-3">
              {/* Header */}
              <div className="text-center border-b border-slate-700/80 pb-2">
                <div className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                  KARTU PRESENSI SISWA SD
                </div>
                <div className="text-xs font-black text-white">{settings.schoolName}</div>
              </div>

              {/* Student info */}
              <div className="flex items-center space-x-3">
                <img
                  src={
                    cardModalStudent.photoUrl ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(
                      cardModalStudent.name
                    )}&background=0D9488&color=fff`
                  }
                  alt={cardModalStudent.name}
                  className="w-14 h-16 rounded-lg object-cover border border-emerald-500/40 shrink-0"
                />

                <div className="space-y-1 text-xs">
                  <div>
                    <span className="text-[9px] text-slate-400 block">NAMA LENGKAP:</span>
                    <span className="font-bold text-white leading-tight block">
                      {cardModalStudent.name}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 block">NISN:</span>
                    <span className="font-mono font-bold text-emerald-400">
                      {cardModalStudent.nisn}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 block">KELAS:</span>
                    <span className="font-semibold text-slate-200">{cardModalStudent.class}</span>
                  </div>
                </div>
              </div>

              {/* 1D Barcode Image */}
              <div className="bg-white p-2 rounded-xl text-center shadow-inner space-y-1">
                {barcode1DUrl ? (
                  <img src={barcode1DUrl} alt="1D Barcode" className="h-12 mx-auto object-contain" />
                ) : (
                  <div className="h-12 mx-auto bg-slate-200 animate-pulse rounded"></div>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => cardModalStudent && exportSingleCardToPDF(cardModalStudent, settings)}
                className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center space-x-2 transition-all shadow-md shadow-emerald-500/20"
              >
                <Download className="w-4 h-4" />
                <span>Unduh File PDF Kartu</span>
              </button>
              <button
                type="button"
                onClick={handlePrintCard}
                className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl flex items-center justify-center space-x-1 border border-slate-700 shrink-0"
              >
                <Printer className="w-4 h-4 text-emerald-400" />
                <span>Print</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Library Card PDF Import Modal */}
      <LibraryImportModal
        isOpen={isLibraryModalOpen}
        onClose={() => setIsLibraryModalOpen(false)}
        existingStudents={students}
        settings={settings}
        onImportSuccess={(newStudents) => {
          newStudents.forEach((s) => onAddStudent(s));
          alert(`Berhasil mengimpor ${newStudents.length} data siswa dari kartu perpustakaan!`);
        }}
      />
    </div>
  );
};
