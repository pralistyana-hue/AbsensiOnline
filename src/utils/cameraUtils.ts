import { Html5Qrcode } from 'html5-qrcode';

export interface CameraDeviceInfo {
  id: string;
  label: string;
  isBackCamera: boolean;
  score: number;
}

export interface ActiveCameraStatus {
  resolution: string;
  isAutofocusSupported: boolean;
  isAutofocusActive: boolean;
  isTorchSupported: boolean;
  trackLabel: string;
}

/**
 * Requests camera permission directly using getUserMedia with friendly fallback.
 * Essential on mobile browsers when triggered from a user click/gesture.
 */
export async function requestCameraPermission(
  facing: 'environment' | 'user' = 'environment'
): Promise<{ granted: boolean; error?: string }> {
  try {
    if (typeof window === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return {
        granted: false,
        error: 'Browser pada perangkat ini tidak mendukung akses kamera web langsung (WebRTC/getUserMedia).',
      };
    }

    // Try standard facingMode first
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facing },
        },
        audio: false,
      });
    } catch {
      // Fallback to basic video constraint if ideal facingMode fails
      stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
    }

    if (stream) {
      // Immediately stop temporary test tracks so camera is freed for html5-qrcode
      stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      return { granted: true };
    }

    return { granted: false, error: 'Tidak dapat memperoleh aliran video kamera.' };
  } catch (err: any) {
    const errorName = err?.name || '';
    const errorMsg = (err?.message || '').toLowerCase();

    if (
      errorName === 'NotAllowedError' ||
      errorName === 'PermissionDeniedError' ||
      errorMsg.includes('permission denied') ||
      errorMsg.includes('not allowed')
    ) {
      return {
        granted: false,
        error: 'Izin kamera ditolak di browser HP Anda. Silakan klik ikon Gembok / Setelan Situs di address bar browser HP Anda, lalu ubah Izin Kamera menjadi "Izinkan" (Allow).',
      };
    }

    if (
      errorName === 'NotFoundError' ||
      errorName === 'DevicesNotFoundError' ||
      errorMsg.includes('not found')
    ) {
      return {
        granted: false,
        error: 'Kamera tidak ditemukan atau tidak terdeteksi pada perangkat HP ini.',
      };
    }

    if (
      errorName === 'NotReadableError' ||
      errorName === 'TrackStartError' ||
      errorMsg.includes('could not start') ||
      errorMsg.includes('in use')
    ) {
      return {
        granted: false,
        error: 'Kamera sedang digunakan oleh aplikasi lain di HP Anda. Harap tutup WhatsApp, Instagram, Kamera bawaan, atau tab lain, lalu coba lagi.',
      };
    }

    if (errorName === 'OverconstrainedError') {
      return {
        granted: false,
        error: 'Resolusi atau format kamera HP tidak didukung dalam mode ini.',
      };
    }

    return {
      granted: false,
      error: err?.message || 'Gagal mengakses kamera pada perangkat HP.',
    };
  }
}

/**
 * Ranks and sorts available camera devices to automatically pick the highest resolution
 * and optimal rear (environment) or front (user) camera for barcode scanning.
 */
export async function getRankedCameraList(
  facing: 'environment' | 'user' = 'environment'
): Promise<CameraDeviceInfo[]> {
  try {
    if (typeof window === 'undefined' || !navigator.mediaDevices || !Html5Qrcode.getCameras) {
      return [];
    }

    const devices = await Html5Qrcode.getCameras();
    if (!devices || devices.length === 0) return [];

    const userKeywords = ['front', 'user', 'selfie', 'depan', 'facing 0', 'facing front', 'secondary'];
    const backKeywords = ['back', 'rear', 'environment', 'belakang', 'facing 1', 'facing back', 'main', 'primary', '0', 'wide'];

    const ranked = devices.map((d, index) => {
      const label = (d.label || '').toLowerCase();
      let isBack = false;
      let score = 0;

      const hasBackKw = backKeywords.some((kw) => label.includes(kw));
      const hasUserKw = userKeywords.some((kw) => label.includes(kw));

      if (hasBackKw) isBack = true;
      else if (hasUserKw) isBack = false;
      else isBack = index === 0; // Default first camera on mobile is usually back camera

      // Scoring
      if (facing === 'environment') {
        if (isBack) score += 50;
        if (label.includes('main') || label.includes('primary') || label.includes('camera 0')) score += 30;
        if (label.includes('back') || label.includes('rear') || label.includes('belakang')) score += 20;
        if (label.includes('wide') && !label.includes('ultra')) score += 15;
        if (label.includes('4k') || label.includes('1080') || label.includes('hd') || label.includes('high')) score += 25;
      } else {
        if (!isBack) score += 50;
        if (label.includes('front') || label.includes('depan') || label.includes('selfie')) score += 30;
        if (label.includes('1080') || label.includes('hd')) score += 20;
      }

      return {
        id: d.id,
        label: d.label || (isBack ? `Kamera Belakang (Kamera ${index + 1})` : `Kamera Depan (Kamera ${index + 1})`),
        isBackCamera: isBack,
        score,
      };
    });

    // Sort descending by score
    return ranked.sort((a, b) => b.score - a.score);
  } catch (err) {
    console.warn('Failed to enumerate ranked cameras:', err);
    return [];
  }
}

/**
 * Builds safe MediaTrackConstraints for html5-qrcode that avoid OverconstrainedError
 * on various mobile aspect ratios (portrait/landscape).
 */
export function getOptimalCameraConstraints(
  cameraId?: string,
  facing: 'environment' | 'user' = 'environment'
): any {
  if (cameraId) {
    return { deviceId: { exact: cameraId } };
  }
  return { facingMode: facing };
}

/**
 * Inspects the active video track rendered inside the container and safely enables
 * hardware continuous autofocus, auto-exposure without crashing.
 */
export async function enableHardwareAutofocusAndHD(
  containerId: string
): Promise<ActiveCameraStatus | null> {
  try {
    const container = document.getElementById(containerId);
    if (!container) return null;

    const videoElem = container.querySelector('video') as HTMLVideoElement | null;
    if (!videoElem || !videoElem.srcObject) return null;

    const stream = videoElem.srcObject as MediaStream;
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) return null;

    const capabilities: any = typeof videoTrack.getCapabilities === 'function' ? videoTrack.getCapabilities() : {};
    const settings: any = typeof videoTrack.getSettings === 'function' ? videoTrack.getSettings() : {};

    let isAutofocusSupported = false;
    let isAutofocusActive = false;
    let isTorchSupported = false;

    const advancedConstraints: any = {};

    // 1. Check & Enforce Continuous Autofocus if supported
    if (capabilities.focusMode && Array.isArray(capabilities.focusMode)) {
      isAutofocusSupported = true;
      if (capabilities.focusMode.includes('continuous')) {
        advancedConstraints.focusMode = 'continuous';
        isAutofocusActive = true;
      } else if (capabilities.focusMode.includes('auto')) {
        advancedConstraints.focusMode = 'auto';
        isAutofocusActive = true;
      }
    }

    // 2. Check & Enforce Auto-exposure
    if (capabilities.exposureMode && Array.isArray(capabilities.exposureMode)) {
      if (capabilities.exposureMode.includes('continuous')) {
        advancedConstraints.exposureMode = 'continuous';
      }
    }

    // 3. Check & Enforce Auto White Balance
    if (capabilities.whiteBalanceMode && Array.isArray(capabilities.whiteBalanceMode)) {
      if (capabilities.whiteBalanceMode.includes('continuous')) {
        advancedConstraints.whiteBalanceMode = 'continuous';
      }
    }

    // 4. Torch (Flashlight)
    if (capabilities.torch) {
      isTorchSupported = true;
    }

    // Safely apply advanced constraints only if supported
    if (Object.keys(advancedConstraints).length > 0 && typeof videoTrack.applyConstraints === 'function') {
      try {
        await videoTrack.applyConstraints({
          advanced: [advancedConstraints],
        });
      } catch (applyErr) {
        // Non-critical: some mobile devices report capability but throw on applyConstraints
        console.warn('Autofocus constraint apply notice:', applyErr);
      }
    }

    const currentWidth = settings.width || videoElem.videoWidth || 0;
    const currentHeight = settings.height || videoElem.videoHeight || 0;
    const resString = currentWidth > 0 && currentHeight > 0
      ? `${currentWidth}x${currentHeight}`
      : 'Kamera HD';

    return {
      resolution: resString,
      isAutofocusSupported,
      isAutofocusActive,
      isTorchSupported,
      trackLabel: videoTrack.label || 'Kamera HP Aktif',
    };
  } catch (err) {
    console.warn('Hardware camera autofocus check notice:', err);
    return null;
  }
}
