import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import {
  Camera,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Send,
  UserCheck,
  Zap,
  Barcode as BarcodeIcon,
  LogOut,
  LogIn,
  X,
  ShieldAlert,
  Volume2,
  RefreshCw,
  Sparkles,
  Users,
  ExternalLink,
  SwitchCamera,
  SlidersHorizontal,
} from 'lucide-react';
import { Student, AttendanceRecord, AppSettings, AttendanceType, ScanFailureLog } from '../types';
import { formatLateMessage, formatHomeMessage, createWhatsAppLink, sendCustomWAMessage } from '../utils/whatsapp';
import { checkScanThrottle, recordScanTimestamp } from '../utils/storage';
import { getActiveSchedule, getActiveScheduleForClass, getAllConcurrentProfilesStatus } from '../utils/schedule';
import {
  getRankedCameraList,
  getOptimalCameraConstraints,
  enableHardwareAutofocusAndHD,
  requestCameraPermission,
  ActiveCameraStatus,
} from '../utils/cameraUtils';

interface ScannerTerminalProps {
  students: Student[];
  records: AttendanceRecord[];
  settings: AppSettings;
  onRecordAttendance: (
    student: Student,
    status: 'HADIR' | 'TERLAMBAT',
    notes?: string,
    type?: AttendanceType
  ) => void;
  onSendWhatsApp: (student: Student, message: string) => void;
  onAddScanFailureLog?: (log: ScanFailureLog) => void;
}

export const ScannerTerminal: React.FC<ScannerTerminalProps> = ({
  students,
  records,
  settings,
  onRecordAttendance,
  onSendWhatsApp,
  onAddScanFailureLog,
}) => {
  const [manualNisn, setManualNisn] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState('ALL');
  const [isCameraActive, setIsCameraActive] = useState(true);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [availableCameras, setAvailableCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [cameraStatus, setCameraStatus] = useState<ActiveCameraStatus | null>(null);
  const [manualOverrideMode, setManualOverrideMode] = useState<AttendanceType | 'AUTO'>('AUTO');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraStarting, setIsCameraStarting] = useState(false);
  const [lastScannedBadge, setLastScannedBadge] = useState<{
    student: Student;
    status: 'HADIR' | 'TERLAMBAT';
    type: AttendanceType;
    time: string;
    waStatus?: 'SENDING' | 'SENT' | 'FAILED' | 'SKIPPED';
    waError?: string;
  } | null>(null);
  const [scanResultToast, setScanResultToast] = useState<{
    student: Student;
    status: 'HADIR' | 'TERLAMBAT';
    type: AttendanceType;
    time: string;
    lateMinutes?: number;
    alreadyScannedToday?: boolean;
    waStatus?: 'SENDING' | 'SENT' | 'FAILED' | 'SKIPPED';
    waError?: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Quick report broken barcode modal state
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportStudentSearch, setReportStudentSearch] = useState('');
  const [reportStudentId, setReportStudentId] = useState('');
  const [reportReason, setReportReason] = useState<any>('BARCODE_RUSAK');
  const [reportNotes, setReportNotes] = useState('');
  const [reportSuccessToast, setReportSuccessToast] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const isScanningRef = useRef<boolean>(false);
  const isTransitioningRef = useRef<boolean>(false);
  const lastProcessedTextRef = useRef<string>('');
  const lastProcessedTimeRef = useRef<number>(0);
  const onScanCallbackRef = useRef<(nisn: string) => void>(() => {});

  const todayStr = new Date().toISOString().split('T')[0];
  const todayRecords = records.filter((r) => r.date === todayStr);

  // Retrieve dynamically evaluated schedule for today (Default vs Special schedule)
  const currentActiveSchedule = getActiveSchedule(settings);
  const concurrentProfiles = getAllConcurrentProfilesStatus(settings);

  // Helper to calculate current automatic mode (MASUK vs PULANG)
  const getDetectedAttendanceMode = (now: Date = new Date()): AttendanceType => {
    if (manualOverrideMode !== 'AUTO') {
      return manualOverrideMode;
    }

    const currentMins = now.getHours() * 60 + now.getMinutes();
    const effectiveHomeTime = currentActiveSchedule.homeTime || settings.homeTime || '12:00';
    const [hHome, mHome] = effectiveHomeTime.split(':').map(Number);
    const homeMins = hHome * 60 + mHome;

    const homeStartMins = homeMins - 60;
    const homeEndMins = homeMins + 180;

    if (currentMins >= homeStartMins && currentMins <= homeEndMins) {
      return 'PULANG';
    }

    return 'MASUK';
  };

  const activeDetectedMode = getDetectedAttendanceMode();

  // Auto close toast result notification (3.5 seconds)
  useEffect(() => {
    if (!scanResultToast) return;
    const timer = setTimeout(() => {
      setScanResultToast(null);
    }, 3500);
    return () => clearTimeout(timer);
  }, [scanResultToast]);

  // Audio feedback synthesizer
  const playSound = (type: 'success' | 'late' | 'error') => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'success') {
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } else if (type === 'late') {
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      } else {
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      }
    } catch {
      // Audio context ignored
    }
  };

  const handleScanNisn = useCallback(
    (nisnInput: string) => {
      if (!nisnInput) return;
      const cleanNisn = nisnInput.trim();
      if (!cleanNisn) return;

      // Prevent fast duplicate frame reads within 1.5s
      const nowMs = Date.now();
      if (lastProcessedTextRef.current === cleanNisn && nowMs - lastProcessedTimeRef.current < 1500) {
        return;
      }
      lastProcessedTextRef.current = cleanNisn;
      lastProcessedTimeRef.current = nowMs;

      setErrorMessage(null);

      const student = students.find(
        (s) => s.nisn === cleanNisn || s.id === cleanNisn
      );

      if (!student) {
        setErrorMessage(`Barcode/NISN "${cleanNisn}" tidak ditemukan.`);
        playSound('error');

        // Automatically log scan failure for admin review & card reprint
        if (onAddScanFailureLog) {
          const now = new Date();
          const dateStr = now.toISOString().split('T')[0];
          const timeStr = now.toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });
          onAddScanFailureLog({
            id: `fail-${Date.now()}`,
            timestamp: now.toISOString(),
            date: dateStr,
            time: timeStr,
            rawCode: cleanNisn,
            failureReason: cleanNisn.length >= 8 ? 'KODE_TIDAK_TERDAFTAR' : 'FORMAT_TIDAK_VALID',
            resolutionStatus: 'PERLU_CETAK_ULANG',
            notes: `Scanner mendeteksi kode "${cleanNisn}", namun tidak cocok dengan data siswa mana pun.`,
            reportedBy: 'Scanner Terminal',
          });
        }

        setTimeout(() => setErrorMessage(null), 3500);
        return;
      }

      // Anti-Duplicate 1-Minute Cooldown Check in localStorage
      const throttleCheck = checkScanThrottle(student.id, 60);
      if (throttleCheck.throttled) {
        setErrorMessage(
          `⚠️ ${student.name} sudah scan ${throttleCheck.elapsedSec}s lalu. Tunggu ${throttleCheck.remainingSec}s lagi.`
        );
        playSound('late');
        setTimeout(() => setErrorMessage(null), 3500);
        return;
      }

      // Save scan timestamp to cache
      recordScanTimestamp(student.id);

      const todayDateStr = new Date().toISOString().split('T')[0];
      const now = new Date();
      const timeStr = now.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      // Get profile-specific active schedule for this student's class
      const studentSched = getActiveScheduleForClass(settings, student.class, now);

      // Determine attendance mode (MASUK vs PULANG) for this specific student's profile
      const currentMode: AttendanceType =
        manualOverrideMode !== 'AUTO'
          ? manualOverrideMode
          : (() => {
              const currentMins = now.getHours() * 60 + now.getMinutes();
              const effectiveHome = studentSched.homeTime || settings.homeTime || '12:00';
              const [hHome, mHome] = effectiveHome.split(':').map(Number);
              const homeMins = hHome * 60 + mHome;
              const homeStartMins = homeMins - 60;
              const homeEndMins = homeMins + 180;
              if (currentMins >= homeStartMins && currentMins <= homeEndMins) {
                return 'PULANG';
              }
              return 'MASUK';
            })();

      const existing = records.find(
        (r) => r.studentId === student.id && r.date === todayDateStr && r.type === currentMode
      );

      let status: 'HADIR' | 'TERLAMBAT' = 'HADIR';
      let lateMinutes = 0;
      let notes = '';

      if (currentMode === 'MASUK') {
        const effectiveCutoff = studentSched.cutoffTime || settings.cutoffTime || '07:15';
        const [cutoffH, cutoffM] = effectiveCutoff.split(':').map(Number);
        const cutoffTotalMins = cutoffH * 60 + cutoffM;
        const currentTotalMins = now.getHours() * 60 + now.getMinutes();

        if (currentTotalMins > cutoffTotalMins) {
          status = 'TERLAMBAT';
          lateMinutes = currentTotalMins - cutoffTotalMins;
          notes = `Terlambat ${lateMinutes} menit (${studentSched.profileName} - Batas: ${effectiveCutoff})`;
        } else {
          notes = `Hadir Tepat Waktu (${timeStr})`;
        }
      } else {
        notes = `Pulang Sekolah (${timeStr})`;
      }

      onRecordAttendance(student, status, notes, currentMode);

      let initialWaStatus: 'SENDING' | 'SENT' | 'FAILED' | 'SKIPPED' = 'SKIPPED';
      let waMsg = '';

      // Auto WhatsApp
      if (settings.enableAutoWhatsAppAlerts) {
        if (status === 'TERLAMBAT') {
          waMsg = formatLateMessage(student, timeStr, settings);
        } else if (currentMode === 'PULANG') {
          waMsg = formatHomeMessage(student, timeStr, settings);
        }

        if (waMsg) {
          initialWaStatus = 'SENDING';
          sendCustomWAMessage(student.parentPhone, waMsg, settings).then((res) => {
            if (res.success) {
              onSendWhatsApp(student, waMsg);
              setScanResultToast((prev) => (prev ? { ...prev, waStatus: 'SENT' } : null));
              setLastScannedBadge((prev) => (prev ? { ...prev, waStatus: 'SENT' } : null));
            } else {
              setScanResultToast((prev) =>
                prev ? { ...prev, waStatus: 'FAILED', waError: res.error } : null
              );
              setLastScannedBadge((prev) =>
                prev ? { ...prev, waStatus: 'FAILED', waError: res.error } : null
              );
            }
          });
        }
      }

      const newResult = {
        student,
        status,
        type: currentMode,
        time: timeStr,
        lateMinutes,
        alreadyScannedToday: !!existing,
        waStatus: initialWaStatus,
      };

      setScanResultToast(newResult);
      setLastScannedBadge(newResult);
      playSound(status === 'TERLAMBAT' ? 'late' : 'success');

      if (inputRef.current) {
        inputRef.current.value = '';
        inputRef.current.focus();
      }
    },
    [students, records, settings, manualOverrideMode, onRecordAttendance, onSendWhatsApp]
  );

  // Keep callback reference updated without triggering camera restarts
  useEffect(() => {
    onScanCallbackRef.current = handleScanNisn;
  }, [handleScanNisn]);

  const toggleCameraFacing = async () => {
    if (isTransitioningRef.current) return;
    const nextFacing = cameraFacing === 'environment' ? 'user' : 'environment';
    setCameraFacing(nextFacing);
    setSelectedCameraId('');
    setCameraError(null);
  };

  const handleSelectCamera = (cameraId: string) => {
    if (isTransitioningRef.current) return;
    setSelectedCameraId(cameraId);
    setCameraError(null);
  };

  const retryStartCamera = async () => {
    setCameraError(null);
    setIsCameraStarting(true);
    try {
      const perm = await requestCameraPermission(cameraFacing);
      if (!perm.granted && perm.error) {
        setCameraError(perm.error);
        setIsCameraStarting(false);
        return;
      }
    } catch {
      // Continue to restart flow
    }
    setIsCameraActive(false);
    setTimeout(() => {
      setIsCameraActive(true);
    }, 150);
  };

  // Camera continuous scanner initialization (depends on isCameraActive, cameraFacing, and selectedCameraId)
  useEffect(() => {
    let isMounted = true;

    const stopScanner = async () => {
      if (html5QrCodeRef.current && isScanningRef.current) {
        try {
          isTransitioningRef.current = true;
          await html5QrCodeRef.current.stop();
          isScanningRef.current = false;
        } catch (err) {
          console.warn('Silent catch stopping scanner:', err);
        } finally {
          isTransitioningRef.current = false;
        }
      }
    };

    const startScanner = async () => {
      if (!isCameraActive) {
        await stopScanner();
        return;
      }

      // Check if browser supports mediaDevices
      if (typeof window !== 'undefined' && (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia)) {
        setCameraError('Browser ini tidak mendukung akses kamera langsung. Harap gunakan browser modern seperti Google Chrome atau Safari.');
        setIsCameraStarting(false);
        return;
      }

      // If already scanning (e.g. switching between front/rear camera), stop first
      if (html5QrCodeRef.current && isScanningRef.current) {
        await stopScanner();
      }

      if (isTransitioningRef.current) {
        return;
      }

      setIsCameraStarting(true);
      setCameraError(null);
      await new Promise((r) => setTimeout(r, 180));

      const readerElem = document.getElementById('continuous-reader');
      if (!readerElem || !isMounted) {
        setIsCameraStarting(false);
        return;
      }

      try {
        isTransitioningRef.current = true;
        if (!html5QrCodeRef.current) {
          html5QrCodeRef.current = new Html5Qrcode('continuous-reader', {
            formatsToSupport: [
              Html5QrcodeSupportedFormats.QR_CODE,
              Html5QrcodeSupportedFormats.CODE_128,
              Html5QrcodeSupportedFormats.CODE_39,
              Html5QrcodeSupportedFormats.EAN_13,
              Html5QrcodeSupportedFormats.EAN_8,
              Html5QrcodeSupportedFormats.UPC_A,
            ],
            verbose: false,
          });
        }

        // 1. Detect and enumerate available cameras ranked by resolution and quality
        const cameraConfigsToTry: Array<any> = [];

        try {
          const ranked = await getRankedCameraList(cameraFacing);
          if (ranked && ranked.length > 0) {
            setAvailableCameras(ranked.map((r) => ({ id: r.id, label: r.label })));

            if (selectedCameraId) {
              const matched = ranked.find((d) => d.id === selectedCameraId);
              if (matched) {
                cameraConfigsToTry.push(matched.id);
                cameraConfigsToTry.push({ deviceId: { exact: matched.id } });
              }
            } else {
              // Highest ranked (best resolution & rear/front sensor) is top
              cameraConfigsToTry.push(ranked[0].id);
              cameraConfigsToTry.push({ deviceId: { exact: ranked[0].id } });
            }
          }
        } catch {
          // getCameras may throw before permissions on some browsers, continue to fallback
        }

        // Standard facingMode configurations - highly compatible with mobile Chrome & Safari
        cameraConfigsToTry.push({ facingMode: { ideal: cameraFacing } });
        cameraConfigsToTry.push({ facingMode: cameraFacing });
        cameraConfigsToTry.push({ facingMode: cameraFacing === 'user' ? 'user' : 'environment' });
        cameraConfigsToTry.push(cameraFacing === 'user' ? { facingMode: 'user' } : { facingMode: 'environment' });

        const scanConfig = {
          fps: 20,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const boxWidth = Math.max(140, Math.min(Math.floor(minEdge * 0.82), 300));
            const boxHeight = Math.max(140, Math.min(Math.floor(minEdge * 0.72), 240));
            return { width: boxWidth, height: boxHeight };
          },
        };

        let started = false;
        let lastError: any = null;

        for (const config of cameraConfigsToTry) {
          if (!isMounted || !isCameraActive) break;
          try {
            await html5QrCodeRef.current.start(
              config,
              scanConfig,
              (decodedText) => {
                if (isMounted && onScanCallbackRef.current) {
                  onScanCallbackRef.current(decodedText);
                }
              },
              () => {}
            );
            isScanningRef.current = true;
            started = true;

            // Trigger Hardware continuous autofocus & resolution check
            setTimeout(async () => {
              if (isMounted) {
                const status = await enableHardwareAutofocusAndHD('continuous-reader');
                if (status) {
                  setCameraStatus(status);
                }
              }
            }, 350);

            break;
          } catch (err: any) {
            lastError = err;
            const msg = err?.message || '';
            if (msg.includes('already under transition') || msg.includes('already scanning')) {
              break;
            }
          }
        }

        if (!started && !isScanningRef.current && isMounted) {
          const rawMsg = (lastError?.message || lastError?.name || '').toLowerCase();
          let userFriendlyMsg = 'Tidak dapat mengakses kamera HP.';
          if (rawMsg.includes('notallowederror') || rawMsg.includes('permission denied') || rawMsg.includes('permissiondenied')) {
            userFriendlyMsg = 'Izin kamera diblokir atau belum diizinkan di browser HP Anda. Silakan klik ikon Gembok / Setelan di address bar browser HP dan ubah Izin Kamera ke "Izinkan" (Allow).';
          } else if (rawMsg.includes('notfounderror') || rawMsg.includes('devicesnotfound')) {
            userFriendlyMsg = 'Kamera tidak ditemukan pada perangkat HP ini.';
          } else if (rawMsg.includes('notreadableerror') || rawMsg.includes('trackstarterror') || rawMsg.includes('in use')) {
            userFriendlyMsg = 'Kamera sedang digunakan aplikasi lain di HP. Harap tutup WhatsApp / Instagram / Kamera bawaan, lalu coba lagi.';
          } else if (rawMsg.includes('overconstrained')) {
            userFriendlyMsg = 'Format video kamera HP tidak didukung. Coba ketuk tombol Ganti Kamera di bawah.';
          } else if (lastError?.message) {
            userFriendlyMsg = `Gagal membuka kamera: ${lastError.message}. Silakan ketuk tombol "Izinkan & Buka Ulang Kamera" di bawah.`;
          }
          setCameraError(userFriendlyMsg);
        }
      } catch (err: any) {
        if (isMounted) {
          const errMsg = err?.message || '';
          if (!errMsg.includes('already under transition')) {
            setCameraError(errMsg || 'Izin kamera ditolak atau kamera sedang digunakan aplikasi lain.');
          }
        }
      } finally {
        isTransitioningRef.current = false;
        if (isMounted) {
          setIsCameraStarting(false);
        }
      }
    };

    startScanner();

    return () => {
      isMounted = false;
      if (html5QrCodeRef.current && isScanningRef.current) {
        html5QrCodeRef.current
          .stop()
          .then(() => {
            isScanningRef.current = false;
          })
          .catch(() => {});
      }
    };
  }, [isCameraActive, cameraFacing, selectedCameraId]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualNisn.trim()) {
      handleScanNisn(manualNisn.trim());
      setManualNisn('');
    }
  };

  const classes = Array.from(new Set(students.map((s) => s.class))).sort();

  return (
    <div className="space-y-5">
      {/* Top Action Bar: Segmented Mode Selector & Quick Utilities */}
      <div className="bg-slate-900/80 backdrop-blur-sm p-3 sm:p-4 rounded-2xl border border-slate-800/80 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        {/* Mode Segmented Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-slate-400 hidden sm:inline">Mode:</span>
          <div className="bg-slate-950/90 p-1 rounded-xl border border-slate-800 flex items-center gap-1">
            <button
              onClick={() => setManualOverrideMode('AUTO')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                manualOverrideMode === 'AUTO'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Otomatis</span>
            </button>

            <button
              onClick={() => setManualOverrideMode('MASUK')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                manualOverrideMode === 'MASUK'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Masuk</span>
            </button>

            <button
              onClick={() => setManualOverrideMode('PULANG')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                manualOverrideMode === 'PULANG'
                  ? 'bg-sky-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Pulang</span>
            </button>
          </div>

          <div
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 border ${
              activeDetectedMode === 'PULANG'
                ? 'bg-sky-500/10 text-sky-300 border-sky-500/30'
                : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                activeDetectedMode === 'PULANG' ? 'bg-sky-400' : 'bg-emerald-400'
              }`}
            />
            <span>{activeDetectedMode === 'PULANG' ? 'PRESENSI PULANG' : 'PRESENSI MASUK'}</span>
          </div>
        </div>

        {/* Right Tool Buttons & Live Concurrent Schedules Info */}
        <div className="flex flex-wrap items-center gap-2">
          {concurrentProfiles.map((cp) => (
            <div
              key={cp.profileId}
              title={`Profil ${cp.profileName} (Kelas: ${cp.assignedClasses.join(', ') || 'Semua'}) • Masuk: ${cp.scheduleResult.entryTime}, Pulang: ${cp.scheduleResult.homeTime} WIB`}
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-medium bg-slate-950/80 border border-slate-800"
            >
              <span className="font-bold text-slate-200">{cp.profileName}:</span>
              <span className="font-mono text-slate-400">Pulang {cp.scheduleResult.homeTime}</span>
              <span
                className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                  cp.statusColor === 'sky'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                    : cp.statusColor === 'emerald'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}
              >
                {cp.statusLabel}
              </span>
            </div>
          ))}

          {/* Laporkan Barcode Rusak Button */}
          {onAddScanFailureLog && (
            <button
              type="button"
              onClick={() => setIsReportModalOpen(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 cursor-pointer shadow-sm"
              title="Laporkan kartu siswa yang tergores, pudar, atau gagal terbaca kamera"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              <span>Laporkan Barcode Rusak</span>
            </button>
          )}

          {/* Switch Camera Button (Depan / Belakang) */}
          <button
            type="button"
            onClick={toggleCameraFacing}
            disabled={!isCameraActive || isCameraStarting}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border cursor-pointer ${
              cameraFacing === 'user'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700'
            } ${(!isCameraActive || isCameraStarting) ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={cameraFacing === 'user' ? 'Kamera Depan Aktif (Klik untuk ganti ke Belakang)' : 'Kamera Belakang Aktif (Klik untuk ganti ke Depan)'}
          >
            <SwitchCamera className="w-3.5 h-3.5 text-emerald-400" />
            <span>{cameraFacing === 'user' ? 'Kamera Depan' : 'Kamera Belakang'}</span>
          </button>

          <button
            onClick={() => setIsCameraActive(!isCameraActive)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border cursor-pointer ${
              isCameraActive
                ? 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700'
                : 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>{isCameraActive ? 'Jeda Kamera' : 'Buka Kamera'}</span>
          </button>
        </div>
      </div>

      {/* Main 2-Column Responsive Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Viewfinder + Barcode Input + Today Metrics */}
        <div className="lg:col-span-5 space-y-4">
          {/* Camera Frame Box */}
          <div className="bg-slate-900/80 backdrop-blur-sm p-4 rounded-2xl border border-slate-800/80 shadow-sm relative overflow-hidden">
            <div className="relative w-full max-w-xs sm:max-w-sm mx-auto">
              {/* Isolated camera container strictly without inner React children */}
              <div
                id="continuous-reader"
                className="w-full rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 aspect-square shadow-inner flex items-center justify-center"
              />

              {/* Top Bar Badges on Viewfinder: Camera Switch & Autofocus/Resolution Indicator */}
              {isCameraActive && !cameraError && (
                <div className="absolute top-3 inset-x-3 z-20 flex items-center justify-between pointer-events-none">
                  {cameraStatus && (
                    <div className="px-2.5 py-1 bg-slate-950/85 backdrop-blur-md rounded-xl border border-emerald-500/30 text-[10px] font-bold text-emerald-300 flex items-center gap-1.5 shadow-md">
                      <Zap className="w-3 h-3 text-emerald-400 animate-pulse" />
                      <span>{cameraStatus.isAutofocusActive ? 'Autofokus Aktif' : 'HD Ready'}</span>
                      <span className="text-slate-500">•</span>
                      <span className="text-slate-300 font-mono">{cameraStatus.resolution}</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={toggleCameraFacing}
                    disabled={isCameraStarting}
                    className="pointer-events-auto ml-auto px-2.5 py-1.5 bg-slate-900/90 hover:bg-slate-800 text-white rounded-xl border border-slate-700/80 shadow-lg backdrop-blur-sm text-xs font-semibold flex items-center gap-1.5 transition-transform active:scale-95 cursor-pointer"
                    title={cameraFacing === 'user' ? 'Beralih ke Kamera Belakang' : 'Beralih ke Kamera Depan'}
                  >
                    <SwitchCamera className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-[10px] font-bold">
                      {cameraFacing === 'user' ? 'Kamera Depan' : 'Kamera Belakang'}
                    </span>
                  </button>
                </div>
              )}

              {/* Camera Starting Overlay */}
              {isCameraActive && isCameraStarting && (
                <div className="absolute inset-0 bg-slate-950/90 rounded-2xl flex flex-col items-center justify-center space-y-2 text-slate-400 text-xs p-4 pointer-events-none z-10">
                  <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
                  <span className="font-medium">Membuka kamera...</span>
                </div>
              )}

              {/* Camera Error Overlay */}
              {isCameraActive && cameraError && (
                <div className="absolute inset-0 bg-slate-950/95 rounded-2xl p-4 border border-rose-500/30 flex flex-col items-center justify-center text-center space-y-3 z-30">
                  <div className="p-2.5 bg-rose-500/15 border border-rose-500/30 rounded-2xl">
                    <AlertTriangle className="w-6 h-6 text-rose-400 shrink-0" />
                  </div>
                  <div>
                    <p className="font-bold text-xs text-rose-300">Kamera Belum Dapat Dibuka</p>
                    <p className="text-[11px] text-slate-300 max-w-xs mt-1 leading-relaxed">{cameraError}</p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={retryStartCamera}
                      className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Izinkan / Buka Ulang Kamera</span>
                    </button>
                    <button
                      type="button"
                      onClick={toggleCameraFacing}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <SwitchCamera className="w-3.5 h-3.5 text-amber-400" />
                      <span>Ganti ke {cameraFacing === 'user' ? 'Kamera Belakang' : 'Kamera Depan'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Minimalist Laser Frame Overlay */}
              {isCameraActive && !cameraError && !isCameraStarting && (
                <div className="absolute inset-4 pointer-events-none border border-emerald-500/30 rounded-2xl flex flex-col items-center justify-between p-3 z-10">
                  <div className="w-full flex justify-between">
                    <div className="w-5 h-5 border-t-2 border-l-2 border-emerald-400 rounded-tl-lg" />
                    <div className="w-5 h-5 border-t-2 border-r-2 border-emerald-400 rounded-tr-lg" />
                  </div>

                  <div className="w-full h-0.5 bg-emerald-400/80 shadow-[0_0_8px_#34d399] animate-pulse" />

                  <span className="bg-slate-950/80 px-2.5 py-0.5 rounded-full text-[10px] text-emerald-300 font-semibold border border-emerald-500/30">
                    Arahkan Barcode ke Sini
                  </span>

                  <div className="w-full flex justify-between">
                    <div className="w-5 h-5 border-b-2 border-l-2 border-emerald-400 rounded-bl-lg" />
                    <div className="w-5 h-5 border-b-2 border-r-2 border-emerald-400 rounded-br-lg" />
                  </div>
                </div>
              )}

              {/* Camera Disabled State Overlay */}
              {!isCameraActive && (
                <div className="absolute inset-0 bg-slate-950/95 rounded-2xl p-6 flex flex-col items-center justify-center text-center space-y-3 z-10">
                  <Camera className="w-10 h-10 text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-400">Kamera sedang dijeda.</p>
                  <button
                    onClick={() => setIsCameraActive(true)}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
                  >
                    Nyalakan Kamera
                  </button>
                </div>
              )}
            </div>

            {/* Optional Camera Lens Selector if multiple cameras found */}
            {availableCameras.length > 1 && isCameraActive && (
              <div className="mt-3 max-w-xs sm:max-w-sm mx-auto flex items-center gap-2 bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs">
                <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="text-[11px] text-slate-400 whitespace-nowrap">Lensa:</span>
                <select
                  value={selectedCameraId}
                  onChange={(e) => handleSelectCamera(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-emerald-500 truncate"
                >
                  <option value="">Otomatis ({cameraFacing === 'user' ? 'Kamera Depan' : 'Kamera Belakang'})</option>
                  {availableCameras.map((cam, idx) => (
                    <option key={cam.id} value={cam.id}>
                      {cam.label || `Kamera ${idx + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Error Notification Alert */}
            {errorMessage && (
              <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between text-amber-200 text-xs">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="font-medium">{errorMessage}</span>
                </div>
                <button
                  onClick={() => setErrorMessage(null)}
                  className="p-1 text-amber-400 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Barcode Scanner & Manual NISN Input */}
          <div className="bg-slate-900/80 backdrop-blur-sm p-3.5 rounded-2xl border border-slate-800/80 shadow-sm">
            <form onSubmit={handleManualSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  ref={inputRef}
                  type="text"
                  value={manualNisn}
                  onChange={(e) => setManualNisn(e.target.value)}
                  placeholder="Ketik NISN atau Scan Barcode USB..."
                  className="w-full pl-10 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs sm:text-sm focus:outline-none focus:border-emerald-500 font-mono transition-colors"
                />
              </div>
              <button
                type="submit"
                className={`px-4 py-2 font-bold text-xs rounded-xl transition-all shadow-sm shrink-0 active:scale-95 cursor-pointer ${
                  activeDetectedMode === 'PULANG'
                    ? 'bg-sky-500 hover:bg-sky-400 text-slate-950'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                }`}
              >
                {activeDetectedMode === 'PULANG' ? 'Catat Pulang' : 'Catat Masuk'}
              </button>
            </form>
          </div>

          {/* Quick Metrics Ribbon (Minimalist 4-Pills) */}
          <div className="grid grid-cols-4 gap-2">
            <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-800/80 text-center">
              <span className="text-[10px] text-slate-400 font-medium block">Total</span>
              <span className="font-mono font-bold text-sm text-slate-200">{students.length}</span>
            </div>
            <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-800/80 text-center">
              <span className="text-[10px] text-emerald-400 font-medium block">Hadir</span>
              <span className="font-mono font-bold text-sm text-emerald-400">
                {todayRecords.filter((r) => r.status === 'HADIR' && r.type === 'MASUK').length}
              </span>
            </div>
            <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-800/80 text-center">
              <span className="text-[10px] text-amber-400 font-medium block">Terlambat</span>
              <span className="font-mono font-bold text-sm text-amber-400">
                {todayRecords.filter((r) => r.status === 'TERLAMBAT' && r.type === 'MASUK').length}
              </span>
            </div>
            <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-800/80 text-center">
              <span className="text-[10px] text-sky-400 font-medium block">Pulang</span>
              <span className="font-mono font-bold text-sm text-sky-400">
                {todayRecords.filter((r) => r.type === 'PULANG').length}
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Instant Live Result Card + Attendance Feed + Quick Sim */}
        <div className="lg:col-span-7 space-y-4">
          {/* Prominent Instant Scan Result Feedback */}
          {lastScannedBadge && (
            <div className="p-4 bg-slate-900/90 rounded-2xl border border-emerald-500/30 shadow-md">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center space-x-3.5 overflow-hidden">
                  <img
                    src={
                      lastScannedBadge.student.photoUrl ||
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(
                        lastScannedBadge.student.name
                      )}&background=0D9488&color=fff`
                    }
                    alt={lastScannedBadge.student.name}
                    className="w-12 h-12 rounded-xl object-cover border border-slate-700 shrink-0"
                  />
                  <div className="overflow-hidden">
                    <div className="flex items-center space-x-2">
                      <h4 className="text-sm sm:text-base font-bold text-white truncate">
                        {lastScannedBadge.student.name}
                      </h4>
                      <span className="text-[10px] bg-slate-800 px-2 py-0.5 text-slate-300 rounded-full font-bold">
                        Kelas {lastScannedBadge.student.class}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-slate-400 mt-1">
                      <span className="font-mono text-emerald-300 font-semibold">
                        {lastScannedBadge.time} WIB
                      </span>
                      <span>•</span>
                      <span
                        className={`font-bold ${
                          lastScannedBadge.type === 'PULANG'
                            ? 'text-sky-400'
                            : lastScannedBadge.status === 'TERLAMBAT'
                            ? 'text-amber-400'
                            : 'text-emerald-400'
                        }`}
                      >
                        {lastScannedBadge.type === 'PULANG'
                          ? 'PULANG'
                          : lastScannedBadge.status === 'TERLAMBAT'
                          ? 'TERLAMBAT'
                          : 'HADIR TEPAT WAKTU'}
                      </span>
                    </div>
                  </div>
                </div>

                {lastScannedBadge.waStatus && lastScannedBadge.waStatus !== 'SKIPPED' && (
                  <span className="text-[10px] px-2.5 py-1 bg-emerald-500/10 text-emerald-400 font-bold rounded-lg border border-emerald-500/20 shrink-0">
                    {lastScannedBadge.waStatus === 'SENT' ? '✓ WA Terkirim' : 'Mengirim WA...'}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Today Attendance Stream */}
          <div className="bg-slate-900/80 backdrop-blur-sm p-4 sm:p-5 rounded-2xl border border-slate-800/80 shadow-sm flex flex-col min-h-[380px]">
            {/* Header & Filter */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-3 gap-2">
              <div>
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-emerald-400" />
                  Presensi Siswa Hari Ini
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {todayRecords.length} aktivitas presensi tercatat
                </p>
              </div>

              <select
                value={selectedClassFilter}
                onChange={(e) => setSelectedClassFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-xs rounded-xl px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-emerald-500 font-medium cursor-pointer"
              >
                <option value="ALL">Semua Kelas</option>
                {classes.map((c) => (
                  <option key={c} value={c}>
                    Kelas {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Attendance List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar max-h-[300px]">
              {todayRecords.length === 0 ? (
                <div className="text-center py-12 text-slate-500 space-y-2">
                  <Clock className="w-7 h-7 mx-auto text-slate-600 animate-pulse" />
                  <p className="text-xs font-medium">Belum ada aktivitas presensi hari ini.</p>
                  <p className="text-[11px] text-slate-500">
                    Arahkan kartu ke kamera atau ketik NISN untuk mencatat.
                  </p>
                </div>
              ) : (
                todayRecords
                  .filter((r) => {
                    const std = students.find((s) => s.id === r.studentId);
                    if (!std) return false;
                    return selectedClassFilter === 'ALL' || std.class === selectedClassFilter;
                  })
                  .slice()
                  .reverse()
                  .map((rec) => {
                    const std = students.find((s) => s.id === rec.studentId);
                    if (!std) return null;

                    return (
                      <div
                        key={rec.id}
                        className="p-2.5 bg-slate-950/80 border border-slate-800/70 rounded-xl flex items-center justify-between gap-2 hover:border-slate-700 transition-all"
                      >
                        <div className="flex items-center space-x-3 overflow-hidden">
                          <img
                            src={
                              std.photoUrl ||
                              `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                std.name
                              )}&background=0D9488&color=fff`
                            }
                            alt={std.name}
                            className="w-9 h-9 rounded-xl object-cover border border-slate-700 shrink-0"
                          />
                          <div className="overflow-hidden">
                            <div className="flex items-center space-x-1.5">
                              <span className="font-semibold text-white text-xs truncate">
                                {std.name}
                              </span>
                              <span className="text-[9px] bg-slate-800 px-1.5 py-0.2 text-slate-300 rounded font-medium">
                                {std.class}
                              </span>
                            </div>
                            <div className="flex items-center space-x-2 text-[11px] text-slate-400 mt-0.5">
                              <span className="font-mono text-emerald-400 font-medium">
                                {rec.time} WIB
                              </span>
                              <span>•</span>
                              <span
                                className={`font-semibold ${
                                  rec.type === 'PULANG'
                                    ? 'text-sky-400'
                                    : rec.status === 'TERLAMBAT'
                                    ? 'text-amber-400'
                                    : 'text-emerald-400'
                                }`}
                              >
                                {rec.type === 'PULANG' ? 'PULANG' : rec.status}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Quick WA Button */}
                        {rec.status === 'TERLAMBAT' && rec.type === 'MASUK' && (
                          <a
                            href={createWhatsAppLink(
                              std.parentPhone,
                              formatLateMessage(std, rec.time, settings)
                            )}
                            target="_blank"
                            rel="noreferrer"
                            title="Kirim Notifikasi WA"
                            className="p-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-lg border border-amber-500/30 transition-all cursor-pointer shrink-0"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    );
                  })
              )}
            </div>

            {/* Quick Test Simulation Pills */}
            {students.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-800/80">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Coba Scan Cepat (Simulasi)
                </span>
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
                  {students.slice(0, 5).map((std) => (
                    <button
                      key={std.id}
                      onClick={() => handleScanNisn(std.nisn)}
                      className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/40 rounded-lg text-left transition-all text-[11px] font-medium text-slate-300 hover:text-white shrink-0 cursor-pointer"
                    >
                      <span>{std.name.split(' ')[0]}</span>
                      <span className="text-[10px] text-slate-500 ml-1">({std.class})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Toast Notification when damage reported */}
      {reportSuccessToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-emerald-500/50 text-emerald-300 px-4 py-3 rounded-2xl shadow-2xl flex items-center space-x-2.5 animate-in fade-in slide-in-from-bottom-5">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-semibold">{reportSuccessToast}</span>
        </div>
      )}

      {/* MODAL: Laporkan Barcode Rusak dari Scanner */}
      {isReportModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Laporkan Barcode Rusak</h3>
                  <p className="text-[11px] text-slate-400">Catat kartu siswa yang gagal dipindai kamera</p>
                </div>
              </div>
              <button
                onClick={() => setIsReportModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const selectedStd = students.find((s) => s.id === reportStudentId);
                const now = new Date();
                const dateStr = now.toISOString().split('T')[0];
                const timeStr = now.toLocaleTimeString('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                });

                if (onAddScanFailureLog) {
                  onAddScanFailureLog({
                    id: `fail-${Date.now()}`,
                    timestamp: now.toISOString(),
                    date: dateStr,
                    time: timeStr,
                    rawCode: selectedStd?.nisn || 'MANUAL_ENTRY',
                    studentId: selectedStd?.id,
                    nisn: selectedStd?.nisn,
                    studentName: selectedStd?.name,
                    class: selectedStd?.class,
                    parentPhone: selectedStd?.parentPhone,
                    failureReason: reportReason,
                    resolutionStatus: 'PERLU_CETAK_ULANG',
                    notes: reportNotes.trim() || 'Barcode fisik kartu pudar/rusak saat diuji di scanner.',
                    reportedBy: 'Petugas Piket Scanner',
                  });
                }

                setIsReportModalOpen(false);
                setReportStudentId('');
                setReportStudentSearch('');
                setReportNotes('');
                setReportSuccessToast(`Laporan kartu rusak ${selectedStd?.name || 'siswa'} berhasil dicatat & masuk antrean cetak.`);
                setTimeout(() => setReportSuccessToast(null), 4000);
              }}
              className="space-y-3.5"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Pilih Siswa <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Ketik nama atau kelas siswa..."
                  value={reportStudentSearch}
                  onChange={(e) => {
                    setReportStudentSearch(e.target.value);
                    setReportStudentId('');
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />

                {reportStudentSearch && !reportStudentId && (
                  <div className="mt-1 max-h-32 overflow-y-auto bg-slate-950 border border-slate-800 rounded-xl divide-y divide-slate-900">
                    {students
                      .filter(
                        (s) =>
                          s.name.toLowerCase().includes(reportStudentSearch.toLowerCase()) ||
                          s.class.toLowerCase().includes(reportStudentSearch.toLowerCase()) ||
                          s.nisn.includes(reportStudentSearch)
                      )
                      .slice(0, 8)
                      .map((std) => (
                        <button
                          type="button"
                          key={std.id}
                          onClick={() => {
                            setReportStudentId(std.id);
                            setReportStudentSearch(`${std.name} (${std.class})`);
                          }}
                          className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-800 flex items-center justify-between text-slate-300 cursor-pointer"
                        >
                          <div>
                            <span className="font-semibold text-slate-200">{std.name}</span>
                            <span className="text-[11px] text-slate-500 ml-1.5">({std.class})</span>
                          </div>
                          <span className="text-[10px] text-emerald-400 font-mono">NISN: {std.nisn}</span>
                        </button>
                      ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Kategori Kendala
                </label>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-rose-500 cursor-pointer"
                >
                  <option value="BARCODE_RUSAK">Barcode Fisik Rusak / Pudar / Tergores</option>
                  <option value="TIDAK_TERBACA_KAMERA">Kamera Tidak Mau Membaca Garis</option>
                  <option value="KARTU_HILANG_TERTINGGAL">Kartu Hilang / Tertinggal</option>
                  <option value="FORMAT_TIDAK_VALID">Format Barcode Tidak Standar</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Catatan Tambahan
                </label>
                <textarea
                  rows={2}
                  value={reportNotes}
                  onChange={(e) => setReportNotes(e.target.value)}
                  placeholder="Misal: Bagian barcode buram karena terkena air / gesekan..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsReportModalOpen(false)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={!reportStudentId}
                  className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    reportStudentId
                      ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-900/30'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  Kirim Laporan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
