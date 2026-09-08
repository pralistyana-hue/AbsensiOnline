import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  QrCode,
  Camera,
  CameraOff,
  Clock,
  Keyboard,
  Maximize2,
  Minimize2,
  Zap,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Volume2,
  VolumeX,
  SwitchCamera,
  RefreshCw,
  SlidersHorizontal,
  ShieldCheck,
} from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Student, AttendanceRecord, AppSettings, AttendanceType } from '../types';
import { Storage } from '../utils/storage';
import {
  recordAttendanceFirestore,
  saveNotificationLogFirestore,
} from '../lib/firebase';
import { collection, onSnapshot, doc } from 'firebase/firestore';
import { db, COLLECTIONS } from '../lib/firebase';
import { formatLateMessage, formatHomeMessage, sendCustomWAMessage } from '../utils/whatsapp';
import { getActiveSchedule, getActiveScheduleForClass, getAllConcurrentProfilesStatus } from '../utils/schedule';
import {
  getRankedCameraList,
  getOptimalCameraConstraints,
  enableHardwareAutofocusAndHD,
  requestCameraPermission,
  ActiveCameraStatus,
} from '../utils/cameraUtils';

export const StandaloneScannerApp: React.FC = () => {
  const [students, setStudents] = useState<Student[]>(() => Storage.getStudents());
  const [records, setRecords] = useState<AttendanceRecord[]>(() => Storage.getAttendance());
  const [settings, setSettings] = useState<AppSettings>(() => Storage.getSettings());

  const [isCameraActive, setIsCameraActive] = useState<boolean>(true);
  const [isCameraStarting, setIsCameraStarting] = useState<boolean>(false);
  const [cameraStatus, setCameraStatus] = useState<ActiveCameraStatus | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [lastScannedStudent, setLastScannedStudent] = useState<Student | null>(null);
  const [lastScanStatus, setLastScanStatus] = useState<'HADIR' | 'TERLAMBAT' | 'PULANG' | 'SUDAH_ABSEN' | 'SUDAH_PULANG' | 'TIDAK_DITEMUKAN' | null>(null);
  const [lastScanType, setLastScanType] = useState<AttendanceType>('MASUK');
  const [lastScanTime, setLastScanTime] = useState<string>('');
  const [lastScanProfileInfo, setLastScanProfileInfo] = useState<string>('');
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [availableCameras, setAvailableCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [audioEnabled, setAudioEnabled] = useState(true);

  const inputRef = useRef<HTMLInputElement>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const isScanningRef = useRef<boolean>(false);
  const isTransitioningRef = useRef<boolean>(false);
  const lastProcessedTextRef = useRef<string>('');
  const lastProcessedTimeRef = useRef<number>(0);
  const onScanCallbackRef = useRef<(nisn: string) => void>(() => {});

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

  // Live Clock (1-second tick)
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Listen to Firestore Realtime Data
  useEffect(() => {
    let unsubStudents: (() => void) | null = null;
    let unsubRecords: (() => void) | null = null;
    let unsubSettings: (() => void) | null = null;

    try {
      unsubStudents = onSnapshot(
        collection(db, COLLECTIONS.STUDENTS),
        (snapshot) => {
          if (!snapshot.empty) {
            const list = snapshot.docs.map((d) => d.data() as Student);
            setStudents(list);
            Storage.saveStudents(list);
          }
        },
        () => {}
      );

      unsubRecords = onSnapshot(
        collection(db, COLLECTIONS.ATTENDANCE),
        (snapshot) => {
          if (!snapshot.empty) {
            const list = snapshot.docs.map((d) => d.data() as AttendanceRecord);
            setRecords(list);
            Storage.saveAttendance(list);
          }
        },
        () => {}
      );

      unsubSettings = onSnapshot(
        doc(db, COLLECTIONS.SETTINGS, 'default'),
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data() as AppSettings;
            setSettings(data);
            Storage.saveSettings(data);
          }
        },
        () => {}
      );
    } catch {
      // Local fallback
    }

    return () => {
      if (unsubStudents) unsubStudents();
      if (unsubRecords) unsubRecords();
      if (unsubSettings) unsubSettings();
    };
  }, []);

  // Audio synthesizer feedback
  const playSound = useCallback(
    (type: 'success' | 'warning' | 'error') => {
      if (!audioEnabled) return;
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) return;
        const ctx = new AudioContextClass();

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        const now = ctx.currentTime;
        if (type === 'success') {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(587.33, now);
          osc.frequency.setValueAtTime(880, now + 0.1);
          gain.gain.setValueAtTime(0.2, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
          osc.start(now);
          osc.stop(now + 0.25);
        } else if (type === 'warning') {
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(440, now);
          osc.frequency.setValueAtTime(349.23, now + 0.15);
          gain.gain.setValueAtTime(0.25, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
          osc.start(now);
          osc.stop(now + 0.35);
        } else {
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(220, now);
          osc.frequency.setValueAtTime(164.81, now + 0.15);
          gain.gain.setValueAtTime(0.3, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
          osc.start(now);
          osc.stop(now + 0.4);
        }
      } catch {
        // audio ignored
      }
    },
    [audioEnabled]
  );

  // Core Attendance Processor
  const handleScanNisn = useCallback(
    async (rawNisn: string) => {
      if (!rawNisn) return;
      const cleanNisn = rawNisn.trim();
      const nowTs = Date.now();

      // Debounce: prevent duplicate scan within 2.5 seconds
      if (
        cleanNisn === lastProcessedTextRef.current &&
        nowTs - lastProcessedTimeRef.current < 2500
      ) {
        return;
      }
      lastProcessedTextRef.current = cleanNisn;
      lastProcessedTimeRef.current = nowTs;

      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const timeStr = now.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      const matchedStudent = students.find(
        (s) => s.nisn === cleanNisn || s.id === cleanNisn
      );

      if (!matchedStudent) {
        setLastScannedStudent(null);
        setLastScanStatus('TIDAK_DITEMUKAN');
        setLastScanTime(timeStr);
        playSound('error');
        return;
      }

      setLastScannedStudent(matchedStudent);
      setLastScanTime(timeStr);

      // Check if student already checked-in today
      const existingToday = records.find(
        (r) => r.studentId === matchedStudent.id && r.date === todayStr && r.type !== 'PULANG'
      );

      if (existingToday) {
        setLastScanStatus('SUDAH_ABSEN');
        playSound('warning');
        return;
      }

      // Retrieve dynamically evaluated schedule for today based on student's class profile
      const studentSched = getActiveScheduleForClass(settings, matchedStudent.class, now);
      const effectiveCutoff = studentSched.cutoffTime || settings.cutoffTime || '07:15';

      // Determine HADIR vs TERLAMBAT based on cutoffTime
      const [curH, curM] = [now.getHours(), now.getMinutes()];
      const [lateH, lateM] = effectiveCutoff.split(':').map(Number);
      const isLate = curH > lateH || (curH === lateH && curM > lateM);
      const status = isLate ? 'TERLAMBAT' : 'HADIR';

      const newRecord: AttendanceRecord = {
        id: `rec-${matchedStudent.id}-${Date.now()}`,
        studentId: matchedStudent.id,
        nisn: matchedStudent.nisn,
        studentName: matchedStudent.name,
        class: matchedStudent.class,
        date: todayStr,
        time: timeStr,
        status: status,
        type: 'MASUK',
        method: 'BARCODE',
        notes: isLate
          ? `Terlambat (${studentSched.profileName} - Batas: ${effectiveCutoff})`
          : 'Tepat waktu',
      };

      setLastScanStatus(status);
      playSound(isLate ? 'warning' : 'success');

      // Update local storage and Cloud Firestore
      const updatedList = [newRecord, ...records];
      Storage.saveAttendance(updatedList);
      setRecords(updatedList);
      await recordAttendanceFirestore(newRecord).catch(() => {});

      // WhatsApp notification
      if (settings.enableAutoWhatsAppAlerts && matchedStudent.parentPhone) {
        const msg = isLate
          ? formatLateMessage(matchedStudent, timeStr, settings)
          : formatHomeMessage(matchedStudent, timeStr, settings);

        sendCustomWAMessage(matchedStudent.parentPhone, msg, settings)
          .then((res) => {
            if (res.success) {
              const log = {
                id: `log-${Date.now()}`,
                studentId: matchedStudent.id,
                studentName: matchedStudent.name,
                parentPhone: matchedStudent.parentPhone,
                type: (isLate ? 'LATE' : 'PULANG') as any,
                message: msg,
                sentAt: new Date().toISOString(),
                status: 'SENT' as const,
              };
              const currentLogs = Storage.getNotificationLogs();
              Storage.saveNotificationLogs([log, ...currentLogs]);
              saveNotificationLogFirestore(log).catch(() => {});
            }
          })
          .catch(() => {});
      }
    },
    [students, records, settings, playSound]
  );

  useEffect(() => {
    onScanCallbackRef.current = handleScanNisn;
  }, [handleScanNisn]);

  // Scanner Lifecycle
  useEffect(() => {
    let isMounted = true;

    const stopScanner = async () => {
      if (html5QrCodeRef.current && isScanningRef.current) {
        try {
          isTransitioningRef.current = true;
          await html5QrCodeRef.current.stop();
          isScanningRef.current = false;
        } catch {
          // ignore
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

      // If already scanning (e.g. switching between front/rear camera or lens), stop first
      if (html5QrCodeRef.current && isScanningRef.current) {
        await stopScanner();
      }

      if (isTransitioningRef.current) return;

      setIsCameraStarting(true);
      setCameraError(null);
      await new Promise((r) => setTimeout(r, 180));

      const readerElem = document.getElementById('standalone-reader');
      if (!readerElem || !isMounted) {
        setIsCameraStarting(false);
        return;
      }

      try {
        isTransitioningRef.current = true;
        if (!html5QrCodeRef.current) {
          html5QrCodeRef.current = new Html5Qrcode('standalone-reader', {
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
                const status = await enableHardwareAutofocusAndHD('standalone-reader');
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
          const msg = err?.message || '';
          if (!msg.includes('already under transition')) {
            setCameraError(msg || 'Izin kamera ditolak atau tidak ditemukan.');
          }
        }
      } finally {
        isTransitioningRef.current = false;
        if (isMounted) setIsCameraStarting(false);
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

  // Keep USB scanner input focused
  useEffect(() => {
    const focusTimer = setInterval(() => {
      if (document.activeElement?.tagName !== 'INPUT') {
        inputRef.current?.focus();
      }
    }, 1500);
    return () => clearInterval(focusTimer);
  }, []);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim()) {
      handleScanNisn(manualInput.trim());
      setManualInput('');
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const todayRecords = records.filter((r) => r.date === todayStr);
  const hadirCount = todayRecords.filter((r) => r.status === 'HADIR').length;
  const terlambatCount = todayRecords.filter((r) => r.status === 'TERLAMBAT').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between select-none font-sans">
      {/* Lightweight Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-emerald-500/20 shrink-0">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-black text-white leading-none">
                EduScan Smart • Terminal Pindai Ringan
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Mode Hemat RAM
              </span>
              {(() => {
                const sched = getActiveSchedule(settings);
                return (
                  <span
                    title={`Jadwal Aktif: ${sched.scheduleName} (Batas Masuk: ${sched.cutoffTime})`}
                    className={`hidden lg:inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      sched.isSpecial
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                    }`}
                  >
                    {sched.isSpecial ? '✨ Jam Khusus' : '📅 Reguler'}: {sched.entryTime}-{sched.homeTime}
                  </span>
                );
              })()}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {settings.schoolName} • Standalone Scanner Tab
            </p>
          </div>
        </div>

        {/* Status Indicators & Action Controls */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Live Clock */}
          <div className="hidden sm:flex items-center space-x-2 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl font-mono text-xs">
            <Clock className="w-4 h-4 text-emerald-400" />
            <span className="font-bold text-white">
              {currentTime.toLocaleTimeString('id-ID')} WIB
            </span>
          </div>

          {/* Sound Toggle */}
          <button
            onClick={() => setAudioEnabled(!audioEnabled)}
            className={`p-2 rounded-xl border text-xs font-bold transition-all ${
              audioEnabled
                ? 'bg-slate-800 text-emerald-400 border-slate-700'
                : 'bg-slate-900 text-slate-500 border-slate-800'
            }`}
            title="Suara Beep"
          >
            {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Switch Camera (Depan / Belakang) Header Button */}
          <button
            type="button"
            onClick={toggleCameraFacing}
            disabled={!isCameraActive || isCameraStarting}
            className={`p-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              cameraFacing === 'user'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            } ${(!isCameraActive || isCameraStarting) ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={cameraFacing === 'user' ? 'Kamera Depan Aktif (Klik untuk ganti ke Belakang)' : 'Kamera Belakang Aktif (Klik untuk ganti ke Depan)'}
          >
            <SwitchCamera className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline text-[11px] font-semibold">
              {cameraFacing === 'user' ? 'Kamera Depan' : 'Kamera Belakang'}
            </span>
          </button>

          {/* Camera Toggle */}
          <button
            onClick={() => setIsCameraActive(!isCameraActive)}
            className={`p-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all ${
              isCameraActive
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
            title="Nyalakan / Matikan Kamera"
          >
            {isCameraActive ? <Camera className="w-4 h-4" /> : <CameraOff className="w-4 h-4" />}
            <span className="hidden md:inline">{isCameraActive ? 'Kamera Aktif' : 'Kamera Mati'}</span>
          </button>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-all"
            title="Layar Penuh"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Back to Full Admin App */}
          <a
            href={typeof window !== 'undefined' ? window.location.pathname : '/'}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Menu Utama</span>
          </a>
        </div>
      </header>

      {/* Main Scanner Body */}
      <main className="flex-1 p-3 sm:p-6 max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
        {/* Left Column: Camera Box & Hardware Input */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-2xl relative overflow-hidden">
            {/* Viewfinder Target */}
            <div className="relative aspect-video max-h-[380px] bg-slate-950 rounded-2xl overflow-hidden border-2 border-emerald-500/40 flex items-center justify-center">
              <div id="standalone-reader" className="w-full h-full object-cover" />

              {/* Floating Quick Action Overlay on Camera Box */}
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

              {/* Scanning Overlay Grid */}
              <div className="absolute inset-0 pointer-events-none border-2 border-emerald-500/20 m-6 rounded-2xl flex flex-col justify-between p-3">
                <div className="flex justify-between">
                  <div className="w-8 h-8 border-t-4 border-l-4 border-emerald-400 rounded-tl-xl" />
                  <div className="w-8 h-8 border-t-4 border-r-4 border-emerald-400 rounded-tr-xl" />
                </div>
                {/* Laser animation bar */}
                {isCameraActive && (
                  <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#10B981] animate-pulse" />
                )}
                <div className="flex justify-between">
                  <div className="w-8 h-8 border-b-4 border-l-4 border-emerald-400 rounded-bl-xl" />
                  <div className="w-8 h-8 border-b-4 border-r-4 border-emerald-400 rounded-br-xl" />
                </div>
              </div>

              {!isCameraActive && (
                <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center space-y-2 z-10">
                  <CameraOff className="w-10 h-10 text-slate-500" />
                  <p className="text-sm font-bold text-slate-300">Kamera Sedang Dinonaktifkan</p>
                  <p className="text-xs text-slate-500 max-w-xs">
                    Gunakan scanner barcode USB genggam (langsung scan kartu) atau ketik NISN pada kolom bawah.
                  </p>
                </div>
              )}

              {isCameraActive && isCameraStarting && (
                <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center space-y-2 z-10">
                  <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs text-slate-400">Membuka kamera...</p>
                </div>
              )}

              {isCameraActive && cameraError && (
                <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-5 text-center space-y-3 z-30">
                  <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-2xl">
                    <AlertTriangle className="w-7 h-7 text-rose-400" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-rose-300">Kamera Belum Dapat Dibuka</p>
                    <p className="text-[11px] text-slate-300 max-w-xs mt-1 leading-relaxed">{cameraError}</p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={retryStartCamera}
                      className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
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
            </div>

            {/* Optional Camera Lens Selector if multiple cameras found on phone */}
            {availableCameras.length > 1 && isCameraActive && (
              <div className="mt-3 flex items-center gap-2 bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2 text-xs">
                <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="text-[11px] text-slate-400 whitespace-nowrap">Lensa Kamera:</span>
                <select
                  value={selectedCameraId}
                  onChange={(e) => handleSelectCamera(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-emerald-500"
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

            {/* Hardware Scanner & Manual Input Field */}
            <form onSubmit={handleManualSubmit} className="mt-4 flex gap-2">
              <div className="relative flex-1">
                <Keyboard className="w-4 h-4 text-emerald-400 absolute left-3.5 top-3" />
                <input
                  ref={inputRef}
                  type="text"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="Scan kartu barcode atau ketik NISN..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-2xl text-sm font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  autoFocus
                />
              </div>
              <button
                type="submit"
                className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-2xl shadow-lg shadow-emerald-500/20 transition-all shrink-0"
              >
                Kirim
              </button>
            </form>
          </div>

          {/* Quick Counter Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl text-center">
              <span className="text-[10px] text-slate-400 font-bold block">Total Siswa</span>
              <strong className="text-xl font-black text-white">{students.length}</strong>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl text-center">
              <span className="text-[10px] text-emerald-400 font-bold block">Hadir Tepat</span>
              <strong className="text-xl font-black text-emerald-400">{hadirCount}</strong>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl text-center">
              <span className="text-[10px] text-amber-400 font-bold block">Terlambat</span>
              <strong className="text-xl font-black text-amber-400">{terlambatCount}</strong>
            </div>
          </div>
        </div>

        {/* Right Column: Instant Scan Result Banner & Realtime Log */}
        <div className="lg:col-span-5 space-y-4">
          {/* Realtime Scan Result Card */}
          <div
            className={`border rounded-3xl p-5 shadow-2xl transition-all ${
              lastScanStatus === 'HADIR'
                ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
                : lastScanStatus === 'TERLAMBAT'
                ? 'bg-amber-950/40 border-amber-500/50 text-amber-300'
                : lastScanStatus === 'SUDAH_ABSEN'
                ? 'bg-sky-950/40 border-sky-500/50 text-sky-300'
                : lastScanStatus === 'TIDAK_DITEMUKAN'
                ? 'bg-rose-950/40 border-rose-500/50 text-rose-300'
                : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}
          >
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-3">
              <span className="text-xs font-bold uppercase tracking-wider">Hasil Pemindaian Terakhir</span>
              <span className="font-mono text-xs text-slate-400">
                {lastScanTime ? `${lastScanTime} WIB` : 'Siap scan...'}
              </span>
            </div>

            {lastScannedStudent ? (
              <div className="space-y-4">
                <div className="flex items-center space-x-3.5">
                  <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center font-black text-xl text-emerald-400 shadow-md">
                    {lastScannedStudent.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white leading-tight">
                      {lastScannedStudent.name}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-slate-300 font-mono mt-1">
                      <span>{lastScannedStudent.class}</span>
                      <span>•</span>
                      <span>NISN: {lastScannedStudent.nisn}</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300">Status Presensi:</span>
                  <span
                    className={`px-3 py-1 rounded-xl text-xs font-black ${
                      lastScanStatus === 'HADIR'
                        ? 'bg-emerald-500 text-slate-950'
                        : lastScanStatus === 'TERLAMBAT'
                        ? 'bg-amber-500 text-slate-950'
                        : lastScanStatus === 'SUDAH_ABSEN'
                        ? 'bg-sky-500 text-slate-950'
                        : 'bg-rose-500 text-white'
                    }`}
                  >
                    {lastScanStatus === 'HADIR'
                      ? '✓ HADIR TEPAT WAKTU'
                      : lastScanStatus === 'TERLAMBAT'
                      ? '⚠️ TERLAMBAT'
                      : lastScanStatus === 'SUDAH_ABSEN'
                      ? 'ℹ SUDAH REKAM PRESENSI'
                      : '✕ TIDAK TERDAFTAR'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="py-10 text-center space-y-2">
                <QrCode className="w-12 h-12 mx-auto text-slate-600 animate-pulse" />
                <p className="text-xs font-bold text-slate-400">
                  Arahkan barcode kartu siswa ke kamera atau scanner USB
                </p>
                <p className="text-[11px] text-slate-600">
                  Data otomatis tercatat ke Cloud Firestore secara instan.
                </p>
              </div>
            )}
          </div>

          {/* Recent Scanned Log Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-xl">
            <h4 className="text-xs font-bold text-white mb-2.5 flex items-center justify-between">
              <span>Aktivitas Presensi Hari Ini</span>
              <span className="text-[10px] text-slate-400 font-mono font-normal">
                Total: {todayRecords.length} Siswa
              </span>
            </h4>

            <div className="space-y-1.5 max-h-56 overflow-y-auto custom-scrollbar">
              {todayRecords.slice(0, 6).map((rec) => (
                <div
                  key={rec.id}
                  className="p-2.5 bg-slate-950 rounded-xl border border-slate-800/80 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-[10px] text-slate-500">{rec.time}</span>
                    <strong className="text-white truncate max-w-[130px] sm:max-w-[160px]">
                      {rec.studentName}
                    </strong>
                    <span className="text-[10px] text-slate-400">({rec.class})</span>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-black ${
                      rec.status === 'HADIR'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : rec.status === 'TERLAMBAT'
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-sky-500/20 text-sky-400'
                    }`}
                  >
                    {rec.status}
                  </span>
                </div>
              ))}
              {todayRecords.length === 0 && (
                <div className="text-center py-6 text-xs text-slate-600">
                  Belum ada presensi hari ini.
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Lightweight Footer */}
      <footer className="bg-slate-900/60 border-t border-slate-800/80 px-4 py-2 text-center text-[11px] text-slate-500 font-mono">
        EduScan Standalone Mode • Auto-Sync Firestore • Hemat RAM & CPU
      </footer>
    </div>
  );
};
