import React, { useState, useEffect } from 'react';
import {
  Student,
  AttendanceRecord,
  PermissionRequest,
  NotificationLog,
  AppSettings,
  ActiveTab,
  AttendanceType,
  HomeroomTeacher,
  ScanFailureLog,
  CardResolutionStatus,
} from './types';
import { Storage } from './utils/storage';
import {
  db,
  COLLECTIONS,
  seedInitialFirestoreData,
  saveStudentFirestore,
  deleteStudentFirestore,
  saveTeacherFirestore,
  deleteTeacherFirestore,
  recordAttendanceFirestore,
  savePermissionFirestore,
  updatePermissionStatusFirestore,
  saveNotificationLogFirestore,
  saveScanFailureLogFirestore,
  updateScanFailureStatusFirestore,
  deleteScanFailureLogFirestore,
  saveSettingsFirestore,
  generateBulkStudentsFirestore,
} from './lib/firebase';
import { collection, onSnapshot, doc } from 'firebase/firestore';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { ScannerTerminal } from './components/ScannerTerminal';
import { DashboardView } from './components/DashboardView';
import { RecapView } from './components/RecapView';
import { PermissionView } from './components/PermissionView';
import { ScanFailureLogsView } from './components/ScanFailureLogsView';
import { StudentsView } from './components/StudentsView';
import { NotificationView } from './components/NotificationView';
import { SettingsView } from './components/SettingsView';
import { BatchImportView } from './components/BatchImportView';
import { WAGatewayView } from './components/WAGatewayView';
import { HelpView } from './components/HelpView';
import { StandaloneScannerApp } from './components/StandaloneScannerApp';
import { Cloud, CloudOff, RefreshCw, Sparkles, CheckCircle2 } from 'lucide-react';
import { getActiveSchedule } from './utils/schedule';

export default function App() {
  // Check if opened in lightweight standalone scanner mode (?view=standalone-scanner)
  const isStandaloneScanner = React.useMemo(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return (
      params.get('view') === 'standalone-scanner' ||
      params.get('mode') === 'scanner'
    );
  }, []);

  const [activeTab, setActiveTab] = useState<ActiveTab>('scanner');

  // App Data State
  const [students, setStudents] = useState<Student[]>(() => Storage.getStudents());
  const [teachers, setTeachers] = useState<HomeroomTeacher[]>(() => Storage.getTeachers());
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(() => Storage.getAttendance());
  const [permissions, setPermissions] = useState<PermissionRequest[]>(() => Storage.getPermissions());
  const [notificationLogs, setNotificationLogs] = useState<NotificationLog[]>(() => Storage.getNotificationLogs());
  const [scanFailures, setScanFailures] = useState<ScanFailureLog[]>(() => Storage.getScanFailureLogs());
  const [settings, setSettings] = useState<AppSettings>(() => Storage.getSettings());

  // Cloud Sync State
  const [isCloudConnected, setIsCloudConnected] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [cloudStatusMsg, setCloudStatusMsg] = useState<string>('Firebase Firestore Realtime Aktif');

  // Seed & Realtime Listeners for Firebase Firestore
  useEffect(() => {
    let unsubscribeStudents: (() => void) | null = null;
    let unsubscribeTeachers: (() => void) | null = null;
    let unsubscribeAttendance: (() => void) | null = null;
    let unsubscribePermissions: (() => void) | null = null;
    let unsubscribeSettings: (() => void) | null = null;
    let unsubscribeLogs: (() => void) | null = null;
    let unsubscribeFailures: (() => void) | null = null;

    const setupFirestore = async () => {
      try {
        setIsSyncing(true);
        // Seed if first time
        await seedInitialFirestoreData();

        // 1. Realtime Students Listener
        unsubscribeStudents = onSnapshot(
          collection(db, COLLECTIONS.STUDENTS),
          (snapshot) => {
            if (!snapshot.empty) {
              const cloudStudents: Student[] = [];
              snapshot.forEach((docSnap) => {
                const data = docSnap.data() as Student;
                cloudStudents.push({ ...data, id: docSnap.id });
              });
              setStudents(cloudStudents);
              Storage.saveStudents(cloudStudents);
            }
            setIsCloudConnected(true);
          },
          (error) => {
            console.warn('Firestore students listener fallback to local:', error);
            setIsCloudConnected(false);
          }
        );

        // 2. Realtime Homeroom Teachers Listener
        unsubscribeTeachers = onSnapshot(
          collection(db, COLLECTIONS.TEACHERS),
          (snapshot) => {
            if (!snapshot.empty) {
              const cloudTeachers: HomeroomTeacher[] = [];
              snapshot.forEach((docSnap) => {
                const data = docSnap.data() as HomeroomTeacher;
                cloudTeachers.push({ ...data, id: docSnap.id });
              });
              setTeachers(cloudTeachers);
              Storage.saveTeachers(cloudTeachers);
            }
          },
          (error) => {
            console.warn('Firestore teachers listener fallback:', error);
          }
        );

        // 3. Realtime Attendance Records Listener
        unsubscribeAttendance = onSnapshot(
          collection(db, COLLECTIONS.ATTENDANCE),
          (snapshot) => {
            if (!snapshot.empty) {
              const cloudRecords: AttendanceRecord[] = [];
              snapshot.forEach((docSnap) => {
                const data = docSnap.data() as AttendanceRecord;
                cloudRecords.push({ ...data, id: docSnap.id });
              });
              setAttendanceRecords(cloudRecords);
              Storage.saveAttendance(cloudRecords);
            }
          },
          (error) => {
            console.warn('Firestore attendance listener fallback:', error);
          }
        );

        // 3. Realtime Permissions Listener
        unsubscribePermissions = onSnapshot(
          collection(db, COLLECTIONS.PERMISSIONS),
          (snapshot) => {
            if (!snapshot.empty) {
              const cloudPerms: PermissionRequest[] = [];
              snapshot.forEach((docSnap) => {
                const data = docSnap.data() as PermissionRequest;
                cloudPerms.push({ ...data, id: docSnap.id });
              });
              setPermissions(cloudPerms);
              Storage.savePermissions(cloudPerms);
            }
          },
          (error) => {
            console.warn('Firestore permissions listener fallback:', error);
          }
        );

        // 4. Realtime Settings Listener
        unsubscribeSettings = onSnapshot(
          doc(db, COLLECTIONS.SETTINGS, 'default'),
          (docSnap) => {
            if (docSnap.exists()) {
              const cloudSettings = docSnap.data() as AppSettings;
              setSettings(cloudSettings);
              Storage.saveSettings(cloudSettings);
            }
          },
          (error) => {
            console.warn('Firestore settings listener fallback:', error);
          }
        );

        // 5. Realtime Notification Logs Listener
        unsubscribeLogs = onSnapshot(
          collection(db, COLLECTIONS.NOTIFICATIONS),
          (snapshot) => {
            if (!snapshot.empty) {
              const cloudLogs: NotificationLog[] = [];
              snapshot.forEach((docSnap) => {
                 const data = docSnap.data() as NotificationLog;
                 cloudLogs.push({ ...data, id: docSnap.id });
              });
              setNotificationLogs(cloudLogs);
              Storage.saveNotificationLogs(cloudLogs);
            }
          },
          (error) => {
            console.warn('Firestore logs listener fallback:', error);
          }
        );

        // 6. Realtime Scan Failures Listener
        unsubscribeFailures = onSnapshot(
          collection(db, COLLECTIONS.SCAN_FAILURES),
          (snapshot) => {
            if (!snapshot.empty) {
              const cloudFailures: ScanFailureLog[] = [];
              snapshot.forEach((docSnap) => {
                const data = docSnap.data() as ScanFailureLog;
                cloudFailures.push({ ...data, id: docSnap.id });
              });
              // Sort by date/time descending
              cloudFailures.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
              setScanFailures(cloudFailures);
              Storage.saveScanFailureLogs(cloudFailures);
            }
          },
          (error) => {
            console.warn('Firestore scan failures listener fallback:', error);
          }
        );
      } catch (err) {
        console.error('Error connecting to Firebase Firestore:', err);
        setIsCloudConnected(false);
        setCloudStatusMsg('Menggunakan Penyimpanan Lokal Offline-First');
      } finally {
        setIsSyncing(false);
      }
    };

    setupFirestore();

    return () => {
      if (unsubscribeStudents) unsubscribeStudents();
      if (unsubscribeTeachers) unsubscribeTeachers();
      if (unsubscribeAttendance) unsubscribeAttendance();
      if (unsubscribePermissions) unsubscribePermissions();
      if (unsubscribeSettings) unsubscribeSettings();
      if (unsubscribeLogs) unsubscribeLogs();
      if (unsubscribeFailures) unsubscribeFailures();
    };
  }, []);

  // Teacher Handlers
  const handleAddTeacher = (newTeacher: HomeroomTeacher) => {
    const updated = [...teachers, newTeacher];
    setTeachers(updated);
    Storage.saveTeachers(updated);
    saveTeacherFirestore(newTeacher).catch(console.error);
  };

  const handleUpdateTeacher = (updatedTeacher: HomeroomTeacher) => {
    const updated = teachers.map((t) =>
      t.id === updatedTeacher.id ? updatedTeacher : t
    );
    setTeachers(updated);
    Storage.saveTeachers(updated);
    saveTeacherFirestore(updatedTeacher).catch(console.error);
  };

  const handleDeleteTeacher = (id: string) => {
    const updated = teachers.filter((t) => t.id !== id);
    setTeachers(updated);
    Storage.saveTeachers(updated);
    deleteTeacherFirestore(id).catch(console.error);
  };

  // Save changes to storage & Cloud
  const handleRecordAttendance = (
    student: Student,
    status: 'HADIR' | 'TERLAMBAT' | 'IZIN' | 'SAKIT' | 'ALPA',
    notes?: string,
    type: AttendanceType = 'MASUK',
    dateOverride?: string
  ) => {
    const todayStr = dateOverride || new Date().toISOString().split('T')[0];
    const nowTimeStr = new Date().toLocaleTimeString('id-ID', { hour12: false });

    const newRecord: AttendanceRecord = {
      id: `att-${todayStr}-${type}-${student.nisn}`,
      studentId: student.id,
      nisn: student.nisn,
      studentName: student.name,
      class: student.class,
      date: todayStr,
      time: status === 'ALPA' ? '-' : nowTimeStr,
      status,
      type,
      notes,
      method: status === 'IZIN' || status === 'SAKIT' ? 'PERIZINAN_WA' : status === 'ALPA' ? 'MANUAL' : 'BARCODE',
    };

    // Optimistic local update
    const updated = attendanceRecords.filter(
      (r) => !(r.studentId === student.id && r.date === todayStr && r.type === type)
    );
    updated.push(newRecord);
    setAttendanceRecords(updated);
    Storage.saveAttendance(updated);

    // Save to Cloud Firestore
    recordAttendanceFirestore(newRecord).catch((err) => {
      console.error('Firestore attendance sync error:', err);
    });
  };

  const handleSendWhatsAppLog = (student: Student, message: string) => {
    const newLog: NotificationLog = {
      id: `log-${Date.now()}`,
      studentId: student.id,
      studentName: student.name,
      parentPhone: student.parentPhone,
      type: 'LATE',
      message,
      sentAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      status: 'SENT',
    };

    const updated = [...notificationLogs, newLog];
    setNotificationLogs(updated);
    Storage.saveNotificationLogs(updated);

    // Save log to Firestore
    saveNotificationLogFirestore(newLog).catch((err) => {
      console.error('Firestore log sync error:', err);
    });
  };

  const handleApprovePermission = (perm: PermissionRequest) => {
    const updatedPerms = permissions.map((p) =>
      p.id === perm.id ? ({ ...p, status: 'APPROVED' } as PermissionRequest) : p
    );
    setPermissions(updatedPerms);
    Storage.savePermissions(updatedPerms);
    updatePermissionStatusFirestore(perm.id, 'APPROVED').catch(console.error);

    const student = students.find((s) => s.nisn === perm.nisn);
    if (student) {
      handleRecordAttendance(
        student,
        perm.type,
        `Izin Disetujui: ${perm.reason}`,
        'MASUK',
        perm.date
      );
    }
  };

  const handleRejectPermission = (permissionId: string) => {
    const updatedPerms = permissions.map((p) =>
      p.id === permissionId ? ({ ...p, status: 'REJECTED' } as PermissionRequest) : p
    );
    setPermissions(updatedPerms);
    Storage.savePermissions(updatedPerms);
    updatePermissionStatusFirestore(permissionId, 'REJECTED').catch(console.error);
  };

  const handleSubmitPermission = (newPerm: PermissionRequest) => {
    const updated = [newPerm, ...permissions.filter((p) => p.id !== newPerm.id)];
    setPermissions(updated);
    Storage.savePermissions(updated);
    savePermissionFirestore(newPerm).catch(console.error);

    // Otomatis terdata di sistem presensi sebagai IZIN atau SAKIT
    const student = students.find((s) => s.nisn === newPerm.nisn);
    if (student) {
      handleRecordAttendance(
        student,
        newPerm.type,
        `Izin Masuk WA Ortu: ${newPerm.reason}`,
        'MASUK',
        newPerm.date
      );
    }
  };

  // Evaluasi Otomatis: Siswa yang tidak hadir dan tidak ada izin orang tua terdata sebagai ALPA
  const handleEvaluateAlpha = (targetDate: string = new Date().toISOString().split('T')[0], targetClass: string = 'ALL'): number => {
    const relevantStudents = targetClass === 'ALL' ? students : students.filter((s) => s.class === targetClass);
    const dateRecords = attendanceRecords.filter((r) => r.date === targetDate);
    const datePerms = permissions.filter((p) => p.date === targetDate);

    const newRecordsToAdd: AttendanceRecord[] = [];

    relevantStudents.forEach((std) => {
      const existing = dateRecords.find((r) => r.studentId === std.id);
      if (!existing) {
        // Cek apakah ada permohonan izin dari ortu untuk siswa ini
        const perm = datePerms.find((p) => p.nisn === std.nisn);
        if (perm) {
          newRecordsToAdd.push({
            id: `att-${targetDate}-MASUK-${std.nisn}`,
            studentId: std.id,
            nisn: std.nisn,
            studentName: std.name,
            class: std.class,
            date: targetDate,
            time: '-',
            status: perm.type,
            type: 'MASUK',
            notes: `Izin Masuk Ortu: ${perm.reason}`,
            method: 'PERIZINAN_WA',
          });
        } else {
          // Tidak ada izin dari orang tua -> terdata ALPHA
          newRecordsToAdd.push({
            id: `att-${targetDate}-MASUK-${std.nisn}`,
            studentId: std.id,
            nisn: std.nisn,
            studentName: std.name,
            class: std.class,
            date: targetDate,
            time: '-',
            status: 'ALPA',
            type: 'MASUK',
            notes: 'Tanpa Keterangan (Tidak Ada Izin Orang Tua)',
            method: 'MANUAL',
          });
        }
      }
    });

    if (newRecordsToAdd.length > 0) {
      const updated = [...attendanceRecords];
      newRecordsToAdd.forEach((nr) => {
        const idx = updated.findIndex((r) => r.studentId === nr.studentId && r.date === nr.date && r.type === nr.type);
        if (idx >= 0) {
          updated[idx] = nr;
        } else {
          updated.push(nr);
        }
        recordAttendanceFirestore(nr).catch(console.error);
      });
      setAttendanceRecords(updated);
      Storage.saveAttendance(updated);
    }

    return newRecordsToAdd.length;
  };

  const handleAddStudent = (newStudent: Student) => {
    const updated = [...students, newStudent];
    setStudents(updated);
    Storage.saveStudents(updated);
    saveStudentFirestore(newStudent).catch(console.error);
  };

  const handleBatchAddStudents = (newStudentsList: Student[]) => {
    const updated = [...students, ...newStudentsList];
    setStudents(updated);
    Storage.saveStudents(updated);
    newStudentsList.forEach((std) => {
      saveStudentFirestore(std).catch(console.error);
    });
  };

  const handleUpdateStudent = (updatedStudent: Student) => {
    const updated = students.map((s) =>
      s.id === updatedStudent.id ? updatedStudent : s
    );
    setStudents(updated);
    Storage.saveStudents(updated);
    saveStudentFirestore(updatedStudent).catch(console.error);
  };

  const handleUpdateStudentPhoto = (studentId: string, photoUrl: string) => {
    const updated = students.map((s) =>
      s.id === studentId ? { ...s, photoUrl } : s
    );
    setStudents(updated);
    Storage.saveStudents(updated);
    const target = updated.find((s) => s.id === studentId);
    if (target) {
      saveStudentFirestore(target).catch(console.error);
    }
  };

  const handleDeleteStudent = (id: string) => {
    const updated = students.filter((s) => s.id !== id);
    setStudents(updated);
    Storage.saveStudents(updated);
    deleteStudentFirestore(id).catch(console.error);
  };

  const handleAddScanFailure = (log: ScanFailureLog) => {
    const updated = [log, ...scanFailures.filter((f) => f.id !== log.id)];
    setScanFailures(updated);
    Storage.saveScanFailureLogs(updated);
    saveScanFailureLogFirestore(log).catch(console.error);
  };

  const handleUpdateScanFailureStatus = (
    logId: string,
    status: CardResolutionStatus,
    notes?: string
  ) => {
    const updated = scanFailures.map((f) =>
      f.id === logId
        ? {
            ...f,
            resolutionStatus: status,
            notes: notes !== undefined ? notes : f.notes,
          }
        : f
    );
    setScanFailures(updated);
    Storage.saveScanFailureLogs(updated);
    updateScanFailureStatusFirestore(logId, status, notes).catch(console.error);
  };

  const handleDeleteScanFailure = (logId: string) => {
    const updated = scanFailures.filter((f) => f.id !== logId);
    setScanFailures(updated);
    Storage.saveScanFailureLogs(updated);
    deleteScanFailureLogFirestore(logId).catch(console.error);
  };

  const handleClearResolvedFailures = () => {
    const toDelete = scanFailures.filter((f) => f.resolutionStatus === 'SELESAI');
    const remaining = scanFailures.filter((f) => f.resolutionStatus !== 'SELESAI');
    setScanFailures(remaining);
    Storage.saveScanFailureLogs(remaining);
    toDelete.forEach((f) => {
      deleteScanFailureLogFirestore(f.id).catch(console.error);
    });
  };

  const handleSaveSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    Storage.saveSettings(newSettings);
    saveSettingsFirestore(newSettings).catch(console.error);
  };

  const handleResetData = () => {
    Storage.resetAllData();
    setStudents(Storage.getStudents());
    setAttendanceRecords(Storage.getAttendance());
    setPermissions(Storage.getPermissions());
    setNotificationLogs(Storage.getNotificationLogs());
    setScanFailures(Storage.getScanFailureLogs());
    setSettings(Storage.getSettings());
    alert('Data berhasil di-reset ke kondisi awal Sekolah Dasar!');
  };

  const handleGenerate100Students = async () => {
    try {
      setIsSyncing(true);
      const count = await generateBulkStudentsFirestore(100);
      alert(`Berhasil menambahkan ${count} data siswa baru ke Firebase Firestore!`);
    } catch (err) {
      console.error(err);
      alert('Gagal membuat data massal.');
    } finally {
      setIsSyncing(false);
    }
  };

  const pendingPermissionsCount = permissions.filter(
    (p) => p.status === 'PENDING'
  ).length;

  const brokenCardsCount = scanFailures.filter(
    (f) => f.resolutionStatus === 'PERLU_CETAK_ULANG'
  ).length;

  const todayStr = new Date().toISOString().split('T')[0];
  const todayRecords = attendanceRecords.filter((r) => r.date === todayStr);
  const unprocessedLateCount = todayRecords.filter(
    (r) => r.status === 'TERLAMBAT'
  ).length;

  // Ultra-lightweight Standalone Scanner Mode (Low CPU/RAM for older PCs/phones)
  if (isStandaloneScanner) {
    return <StandaloneScannerApp />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-emerald-500 selection:text-slate-950">
      {/* Top Header */}
      <Header
        settings={settings}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        pendingPermissionsCount={pendingPermissionsCount}
        unprocessedLateCount={unprocessedLateCount}
        totalStudents={students.length}
        isSyncing={isSyncing}
      />

      {/* Navigation Bar */}
      <Navigation
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        pendingPermissionsCount={pendingPermissionsCount}
        brokenCardsCount={brokenCardsCount}
      />

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-5">
        {activeTab === 'scanner' && (
          <ScannerTerminal
            students={students}
            records={attendanceRecords}
            settings={settings}
            onRecordAttendance={handleRecordAttendance}
            onSendWhatsApp={handleSendWhatsAppLog}
            onAddScanFailureLog={handleAddScanFailure}
          />
        )}

        {activeTab === 'dashboard' && (
          <DashboardView
            students={students}
            records={attendanceRecords}
            permissions={permissions}
            settings={settings}
            onOpenNotifications={() => setActiveTab('notifications')}
            onOpenPermissions={() => setActiveTab('permissions')}
            onEvaluateAlpha={handleEvaluateAlpha}
          />
        )}

        {activeTab === 'recap' && (
          <RecapView
            students={students}
            records={attendanceRecords}
            permissions={permissions}
            settings={settings}
            onEvaluateAlpha={handleEvaluateAlpha}
          />
        )}

        {activeTab === 'permissions' && (
          <PermissionView
            students={students}
            permissions={permissions}
            teachers={teachers}
            settings={settings}
            onApprovePermission={handleApprovePermission}
            onRejectPermission={handleRejectPermission}
            onSubmitPermission={handleSubmitPermission}
            onLogNotification={(log) => {
              const updated = [...notificationLogs, log];
              setNotificationLogs(updated);
              Storage.saveNotificationLogs(updated);
              saveNotificationLogFirestore(log).catch(console.error);
            }}
          />
        )}

        {activeTab === 'scan_failures' && (
          <ScanFailureLogsView
            scanFailures={scanFailures}
            students={students}
            settings={settings}
            onAddFailureLog={handleAddScanFailure}
            onUpdateFailureStatus={handleUpdateScanFailureStatus}
            onDeleteFailureLog={handleDeleteScanFailure}
            onClearResolvedLogs={handleClearResolvedFailures}
          />
        )}

        {activeTab === 'students' && (
          <StudentsView
            students={students}
            teachers={teachers}
            settings={settings}
            onAddStudent={handleAddStudent}
            onUpdateStudent={handleUpdateStudent}
            onUpdateStudentPhoto={handleUpdateStudentPhoto}
            onDeleteStudent={handleDeleteStudent}
            onAddTeacher={handleAddTeacher}
            onUpdateTeacher={handleUpdateTeacher}
            onDeleteTeacher={handleDeleteTeacher}
          />
        )}

        {activeTab === 'batch_import' && (
          <BatchImportView
            existingStudents={students}
            onBatchAddStudents={handleBatchAddStudents}
            onNavigateToStudents={() => setActiveTab('students')}
            settings={settings}
          />
        )}

        {activeTab === 'notifications' && (
          <NotificationView
            students={students}
            records={attendanceRecords}
            settings={settings}
            logs={notificationLogs}
            onLogNotification={(log) => {
              const updated = [...notificationLogs, log];
              setNotificationLogs(updated);
              Storage.saveNotificationLogs(updated);
              saveNotificationLogFirestore(log).catch(console.error);
            }}
          />
        )}

        {activeTab === 'wa_gateway' && (
          <WAGatewayView
            settings={settings}
            onSaveSettings={handleSaveSettings}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            settings={settings}
            onSaveSettings={handleSaveSettings}
            onResetData={handleResetData}
          />
        )}

        {activeTab === 'help' && (
          <HelpView
            settings={settings}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            © 2026 {settings.schoolName} — Database Cloud Firebase Firestore Realtime & Barcode Presensi SD
          </span>
          {(() => {
            const todaySched = getActiveSchedule(settings);
            return (
              <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>Cloud Sync: AKTIF</span>
                <span className="text-slate-600">•</span>
                <span>{todaySched.currentDayName} ({todaySched.isSpecial ? 'Jam Khusus' : 'Reguler'}): {todaySched.entryTime} - {todaySched.homeTime} WIB</span>
              </span>
            );
          })()}
        </div>
      </footer>
    </div>
  );
}
