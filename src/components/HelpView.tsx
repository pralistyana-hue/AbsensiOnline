import React, { useState } from 'react';
import {
  HelpCircle,
  Monitor,
  Smartphone,
  Sparkles,
  Copy,
  Check,
  Terminal,
  ShieldCheck,
  Zap,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  BookOpen,
  Camera,
  QrCode,
  FileText,
  MessageSquare,
  AlertCircle,
  Cpu,
  Wifi,
} from 'lucide-react';
import { AppSettings } from '../types';
import { getNormalizedProfiles } from '../utils/schedule';

interface HelpViewProps {
  settings: AppSettings;
}

export const HelpView: React.FC<HelpViewProps> = ({ settings }) => {
  const [activeSection, setActiveSection] = useState<'pc' | 'hp' | 'gemini_prompt'>('pc');
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);

  // Dynamic profiles summary
  const profiles = getNormalizedProfiles(settings);
  const profilesSummaryText = profiles
    .map((p) => {
      const reg = p.regularSchedule;
      const spec =
        p.enableSpecialSchedule && p.specialSchedule
          ? ` | Jam Khusus (${p.specialSchedule.name}): Masuk ${p.specialSchedule.entryTime}, Pulang ${p.specialSchedule.homeTime} WIB (${p.specialSchedule.days.join(', ')})`
          : '';
      const classes =
        p.assignedClasses && p.assignedClasses.length > 0
          ? ` [Kelas: ${p.assignedClasses.join(', ')}]`
          : ' [Semua Kelas / Default]';
      return `- Profil ${p.name}${classes}: Masuk ${reg.entryTime} WIB, Batas ${reg.cutoffTime} WIB, Pulang ${reg.homeTime} WIB (${reg.days.join(', ')})${spec}`;
    })
    .join('\n');

  // Dynamic Prompt 1: Surat Edaran Orang Tua
  const promptSuratEdaran = `Halo Gemini AI, tolong buatkan draft "SURAT EDARAN RESMI DARI SEKOLAH UNTUK ORANG TUA / WALI SISWA" mengenai Pemberlakuan Sistem Presensi Digital Berbasis Barcode/QR Code dan Notifikasi WhatsApp Otomatis.

Berikut adalah data resmi sekolah kami:
- Nama Sekolah: ${settings.schoolName}
- Alamat Sekolah: ${settings.schoolAddress}
- Nama Kepala Sekolah: ${settings.principalName} (NIP: ${settings.principalNip})
- Pengaturan Profil Jadwal & Jam Sekolah:
${profilesSummaryText}

Poin-poin penting yang harus disampaikan dalam surat:
1. Setiap siswa wajib membawa Kartu Pelajar Berbarcode yang disediakan sekolah setiap hari.
2. Kartu di-scan di gerbang/meja piket saat kedatangan (Masuk) dan saat kepulangan (Pulang).
3. Orang tua akan menerima notifikasi WhatsApp otomatis jika siswa terlambat atau belum melakukan scan pulang melebihi 30 menit dari jam pulang sekolah.
4. Tata cara pengajuan izin/sakit melalui WhatsApp ke Nomor Hotline Sekolah dengan format baku:
   - SAKIT#NISN#Alasan#Tanggal (Contoh: SAKIT#0151234002#Demam tinggi#2026-08-13)
   - IZIN#NISN#Alasan#Tanggal (Contoh: IZIN#0151234002#Acara keluarga#2026-08-13)
5. Bahasa harus sangat sopan, resmi, hangat khas sekolah dasar, dan mudah dipahami oleh seluruh lapisan orang tua. Buatkan lengkap beserta bagian kop surat, isi, dan tanda tangan Kepala Sekolah.`;

  // Dynamic Prompt 2: SOP Petugas Piket Sekolah
  const promptSOPPiket = `Halo Gemini AI, tolong buatkan dokumen "STANDAR OPERASIONAL PROSEDUR (SOP) PETUGAS PIKET SEKOLAH & OPERATOR PRESENSI BARCODE".

Data Sekolah:
- Nama Sekolah: ${settings.schoolName}
- Jam Operasional Piket Masuk: 06.15 - 07.30 WIB
- Jam Operasional Piket Pulang: ${settings.homeTime} - 13.30 WIB

Tolong susun SOP terstruktur dengan poin-poin:
1. Persiapan Perangkat (06.15 WIB):
   - Menyalakan Laptop Piket, Membuka Browser ke Aplikasi Presensi.
   - Menghubungkan Scanner Barcode USB / Membuka Kamera Pemindai.
   - Memastikan Server Bot WA (node server.js) sudah aktif di background PC.
2. Pelaksanaan Presensi Masuk (06.30 - 07.15 WIB):
   - Menyambut siswa di meja piket.
   - Siswa mengarahkan kartu barcode ke pemindai.
   - Memastikan layar menunjukkan popup hijau "ABSEN BERHASIL".
3. Penanganan Siswa Terlambat (> ${settings.cutoffTime} WIB):
   - Petugas mengarahkan siswa terlambat untuk dicatat dan diberikan surat izin masuk kelas.
   - Sistem akan otomatis menandai status TERLAMBAT dan mengirim pesan peringatan ke WA Orang Tua.
4. Penanganan Siswa Belum Dijemput (> 30 menit setelah ${settings.homeTime} WIB):
   - Petugas memeriksa daftar "Siswa Belum Dijemput" di layar aplikasi.
   - Mengklik tombol 1-klik "Kirim WA Ortu" untuk menginformasikan keberadaan siswa di ruang piket.
5. Penutupan Piket & Rekapitulasi:
   - Mengunduh rekap harian dalam bentuk file Excel/Cetak Rekap untuk dilaporkan ke Kepala Sekolah (${settings.principalName}).

Buat dokumen dalam bentuk tabel dan poin-poin bertingkat yang rapi dan profesional.`;

  // Dynamic Prompt 3: Prompt Infografis / Ringkasan Alur
  const promptInfografis = `Halo Gemini AI, tolong susunkan TEKS RINGKAS ALUR PRESENSI DAN TATA TERTIB KARTU BARCODE SISWA untuk dijadikan bahan poster / MMT / banner MMT ukuran 1x2 meter yang akan dipasang di depan gerbang ${settings.schoolName}.

Syarat susunan:
- Singkat, padat, menggunakan kalimat persuasif dan jelas untuk anak-anak SD serta orang tua.
- Pembagian 3 Langkah Mudah:
  1. DATANG: Tempelkan kartu barcode di depan kamera / alat scan piket.
  2. BELAJAR: Masuk kelas dengan tertib sebelum jam ${settings.entryTime} WIB.
  3. PULANG: Scan kembali kartu barcode saat bel pulang jam ${settings.homeTime} WIB.
- Informasi Format WA Izin Ortu di bagian bawah banner secara ringkas.
- Sertakan emoji dan tagline sekolah yang menarik.`;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPromptId(id);
    setTimeout(() => setCopiedPromptId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2.5">
            <BookOpen className="w-6 h-6 text-emerald-400" />
            <span>Pusat Bantuan & Petunjuk Setup Presensi</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
            Panduan lengkap konfigurasi perangkat lunak & keras untuk Komputer Piket Sekolah, Smartphone WhatsApp Sekolah, serta Generator Prompt Otomatis untuk membuat Dokumen Surat Edaran via Gemini AI.
          </p>
        </div>

        {/* Section Navigation Pills */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800 shrink-0">
          <button
            onClick={() => setActiveSection('pc')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center space-x-2 transition-all ${
              activeSection === 'pc'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Monitor className="w-4 h-4" />
            <span>1. Setup di PC / Laptop Piket</span>
          </button>

          <button
            onClick={() => setActiveSection('hp')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center space-x-2 transition-all ${
              activeSection === 'hp'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>2. Setup di Smartphone / WA</span>
          </button>

          <button
            onClick={() => setActiveSection('gemini_prompt')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center space-x-2 transition-all ${
              activeSection === 'gemini_prompt'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>3. Prompt Gemini AI Generator</span>
          </button>
        </div>
      </div>

      {/* SECTION 1: SETUP DI PC / LAPTOP PIKET */}
      {activeSection === 'pc' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Step 1.1 Hardware */}
            <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-3">
              <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl w-fit">
                <QrCode className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-white">A. Perangkat Pemindai (Hardware)</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Aplikasi mendukung dua metode pemindaian sekaligus:
              </p>
              <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
                <li><strong className="text-emerald-300">Scanner Barcode USB (Laser 1D/2D)</strong>: Cukup colokkan ke port USB PC. Tanpa perlu install driver (Plug and Play). Alat ini bertindak seperti keyboard mengetik NISN.</li>
                <li><strong className="text-emerald-300">Webcam Kamera USB / Laptop</strong>: Pemindai visual langsung melalui browser dengan target kotak viewfinder di layar.</li>
              </ul>
            </div>

            {/* Step 1.2 Browser Settings */}
            <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-3">
              <div className="p-2.5 bg-sky-500/10 text-sky-400 rounded-xl w-fit">
                <Camera className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-white">B. Pengaturan Browser (Google Chrome)</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Atur Google Chrome di PC piket agar siap pakai tanpa kendala:
              </p>
              <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
                <li><strong className="text-sky-300">Izin Kamera</strong>: Klik ikon gembok di sebelah URL aplikasi &rarr; Pilih <em>Camera = Allow (Izinkan)</em>.</li>
                <li><strong className="text-sky-300">Mode Layar Penuh</strong>: Tekan tombol <code className="bg-slate-950 px-1.5 py-0.5 rounded text-sky-400 font-mono">F11</code> untuk menampilkan aplikasi secara penuh tanpa bilah browser.</li>
                <li><strong className="text-sky-300">Cegah Sleep PC</strong>: Buka Windows <em>Settings &rarr; Power &amp; Sleep</em> &rarr; Ubah <em>Sleep = Never</em> agar PC tidak mati saat jam piket berlangsung.</li>
              </ul>
            </div>

            {/* Step 1.3 Firewall & Network */}
            <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-3">
              <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl w-fit">
                <Wifi className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-white">C. Jaringan & Windows Firewall</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Agar bot WA (<code className="text-amber-300 font-mono">Port 5000</code>) dapat diakses dari PC lain / Wi-Fi sekolah:
              </p>
              <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
                <li><strong className="text-amber-300">Cek IP Local PC</strong>: Buka CMD &rarr; ketik <code className="bg-slate-950 px-1.5 py-0.5 rounded text-emerald-400 font-mono">ipconfig</code> &rarr; lihat <em className="text-white font-mono">IPv4 Address</em> (misal: <code className="text-sky-300">192.168.1.100</code>).</li>
                <li><strong className="text-amber-300">Buka Port 5000 (Cepat via CMD)</strong>: Buka CMD as Administrator &rarr; Paste perintah <code className="bg-slate-950 px-1 rounded text-emerald-300 text-[10px]">netsh advfirewall...</code></li>
                <li><strong className="text-amber-300">Endpoint URL</strong>: Masukkan <code className="text-sky-300 font-mono">http://192.168.1.100:5000/send-message</code> di menu WA Gateway.</li>
              </ul>
            </div>
          </div>

          {/* Detailed FireWall & IP Local Quick Guide Box */}
          <div className="bg-slate-900 p-6 rounded-2xl border border-amber-500/40 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-400" />
              <span>Panduan Detail: Mengetahui IP Local PC & Pembukaan Port 5000 Windows Firewall</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Box 1: Cek IP Local */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <h4 className="font-bold text-amber-400 flex items-center gap-1.5">
                  <Cpu className="w-4 h-4" />
                  <span>1. Cara Cek IP Local PC Piket</span>
                </h4>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  IP Local (IPv4) adalah alamat komputer piket di jaringan Wi-Fi/LAN sekolah:
                </p>
                <ol className="list-decimal list-inside text-slate-300 space-y-1 text-[11px]">
                  <li>Tekan <code className="bg-slate-900 px-1 rounded text-amber-300">Win + R</code> &rarr; Ketik <code className="text-emerald-300 font-mono">cmd</code> &rarr; Tekan Enter.</li>
                  <li>Di jendela hitam CMD, ketik: <code className="text-emerald-300 font-mono bg-slate-900 px-1 py-0.5 rounded">ipconfig</code> lalu Enter.</li>
                  <li>Cari tulisan <strong>IPv4 Address</strong>. Contoh: <code className="text-sky-300 font-mono font-bold">192.168.1.100</code>.</li>
                  <li>Gunakan alamat ini di HP / PC lain: <code className="text-sky-300 font-mono">http://192.168.1.100:5000/send-message</code>.</li>
                </ol>
              </div>

              {/* Box 2: Buka Port 5000 CMD 1-Click */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <h4 className="font-bold text-amber-400 flex items-center gap-1.5">
                  <Zap className="w-4 h-4" />
                  <span>2. Buka Port 5000 (Metode Cepat 1-Klik CMD)</span>
                </h4>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Jalankan CMD sebagai Administrator, lalu jalankan perintah otomatis ini:
                </p>
                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 text-[10px] font-mono text-emerald-300 space-y-2">
                  <div className="select-all break-all bg-slate-950 p-2 rounded border border-emerald-500/30">
                    netsh advfirewall firewall add rule name="WA Bot Server Port 5000" dir=in action=allow protocol=TCP localport=5000
                  </div>
                  <button
                    onClick={() => copyToClipboard('netsh advfirewall firewall add rule name="WA Bot Server Port 5000" dir=in action=allow protocol=TCP localport=5000', 'netsh_cmd')}
                    className="w-full py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[10px] rounded flex items-center justify-center gap-1"
                  >
                    {copiedPromptId === 'netsh_cmd' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedPromptId === 'netsh_cmd' ? 'Perintah Tersalin!' : 'Salin Perintah CMD Firewall'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Box 3: GUI Firewall Manual */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
              <h4 className="font-bold text-white flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>3. Cara Manual via Tampilan Windows Defender Firewall (GUI)</span>
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-[11px] text-slate-300">
                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                  <strong className="text-emerald-400 block mb-0.5">Langkah 1:</strong>
                  Buka Start Menu &rarr; Ketik <em>"Windows Defender Firewall"</em> &rarr; Buka aplikasi.
                </div>
                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                  <strong className="text-emerald-400 block mb-0.5">Langkah 2:</strong>
                  Klik menu <strong>Advanced Settings</strong> di sebelah kiri &rarr; Pilih <strong>Inbound Rules</strong>.
                </div>
                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                  <strong className="text-emerald-400 block mb-0.5">Langkah 3:</strong>
                  Klik <strong>New Rule...</strong> di kanan &rarr; Pilih <strong>Port</strong> &rarr; Next &rarr; Pilih <strong>TCP</strong> &rarr; Isi Port: <code className="text-amber-300 font-mono">5000</code>.
                </div>
                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                  <strong className="text-emerald-400 block mb-0.5">Langkah 4:</strong>
                  Pilih <strong>Allow the connection</strong> &rarr; Centang Domain, Private, Public &rarr; Beri Nama: <em>"WA Bot Server 5000"</em> &rarr; Finish.
                </div>
              </div>
            </div>
          </div>

          {/* Deep Detailed Node.js Baileys Setup Guide */}
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Terminal className="w-5 h-5 text-emerald-400" />
              <span>Panduan Langkah-demi-Langkah Penginstalan WA Bot Baileys di PC Piket</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex items-start gap-3 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <span className="bg-emerald-500 text-slate-950 font-black w-6 h-6 rounded-full flex items-center justify-center shrink-0">1</span>
                <div>
                  <h4 className="font-bold text-white">Unduh & Install Node.js di PC Piket</h4>
                  <p className="text-slate-400 mt-0.5">
                    Buka situs resmi <a href="https://nodejs.org" target="_blank" rel="noreferrer" className="text-emerald-400 underline font-semibold">https://nodejs.org</a>, unduh versi LTS (Recommended for Most Users), lalu jalankan installer hingga selesai.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <span className="bg-emerald-500 text-slate-950 font-black w-6 h-6 rounded-full flex items-center justify-center shrink-0">2</span>
                <div>
                  <h4 className="font-bold text-white">Buat Folder Khusus di Drive C atau D</h4>
                  <p className="text-slate-400 mt-0.5">
                    Buat folder baru, misalnya <code className="text-emerald-300 font-mono bg-slate-900 px-1.5 py-0.5 rounded">C:\wa-bot-sekolah</code>. Buka Command Prompt (CMD) lalu masuk ke folder tersebut dengan mengetik:
                  </p>
                  <pre className="bg-slate-900 p-2 rounded-lg text-emerald-300 font-mono mt-1">cd C:\wa-bot-sekolah</pre>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <span className="bg-emerald-500 text-slate-950 font-black w-6 h-6 rounded-full flex items-center justify-center shrink-0">3</span>
                <div>
                  <h4 className="font-bold text-white">Install Paket Baileys & Express</h4>
                  <p className="text-slate-400 mt-0.5">Ketik perintah berikut di CMD untuk mendownload pustaka WhatsApp Baileys:</p>
                  <pre className="bg-slate-900 p-2 rounded-lg text-emerald-300 font-mono mt-1">npm install @whiskeysockets/baileys express cors qrcode-terminal</pre>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <span className="bg-emerald-500 text-slate-950 font-black w-6 h-6 rounded-full flex items-center justify-center shrink-0">4</span>
                <div>
                  <h4 className="font-bold text-white">Buat File server.js</h4>
                  <p className="text-slate-400 mt-0.5">
                    Buka Notepad, salin kode script Node.js Baileys yang ada di menu <strong className="text-white">Integrasi Gateway WA</strong> pada aplikasi ini, lalu simpan dengan nama <code className="text-amber-300 font-mono bg-slate-900 px-1.5 py-0.5 rounded">server.js</code> di dalam folder <code className="text-emerald-300 font-mono">C:\wa-bot-sekolah</code>.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <span className="bg-emerald-500 text-slate-950 font-black w-6 h-6 rounded-full flex items-center justify-center shrink-0">5</span>
                <div>
                  <h4 className="font-bold text-white">Jalankan Server & Scan QR Code Pertama Kali</h4>
                  <p className="text-slate-400 mt-0.5">Jalankan bot dengan mengetik:</p>
                  <pre className="bg-slate-900 p-2 rounded-lg text-emerald-300 font-mono mt-1">node server.js</pre>
                  <p className="text-slate-400 mt-1">
                    Di layar CMD akan muncul grafik QR Code. Buka WhatsApp di HP Sekolah -&gt; Perangkat Tertaut -&gt; Tautkan Perangkat -&gt; Scan QR Code tersebut.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: SETUP DI SMARTPHONE / WA */}
      {activeSection === 'hp' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* HP Sekolah (Operator) */}
            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
              <div className="flex items-center space-x-3 pb-3 border-b border-slate-800">
                <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl">
                  <Smartphone className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">A. Setting HP WhatsApp Sekolah (Operator Piket)</h3>
                  <p className="text-xs text-slate-400">Nomor resmi pengirim notifikasi & penerima izin orang tua</p>
                </div>
              </div>

              <div className="space-y-3 text-xs text-slate-300">
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
                  <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>1. Tautkan Perangkat (Linked Devices)</span>
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Buka Aplikasi WhatsApp / WA Business di HP Sekolah -&gt; Ketuk ikon opsi titik tiga (Atas Kanan) / Pengaturan -&gt; Pilih <strong>Perangkat Tertaut (Linked Devices)</strong> -&gt; Ketuk <strong>Tautkan Perangkat</strong> -&gt; Arahkan kamera HP ke QR Code yang muncul di layar CMD PC Piket.
                  </p>
                </div>

                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
                  <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>2. Matikan Penghemat Baterai untuk WhatsApp</span>
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Di HP Android Sekolah: Buka <em>Pengaturan HP -&gt; Aplikasi -&gt; WhatsApp -&gt; Baterai -&gt; Pilih "Tidak Dibatasi" (Unrestricted)</em> agar koneksi WA tidak diputus oleh sistem Android saat layar HP mati.
                  </p>
                </div>

                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
                  <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>3. Koneksi Internet Terus Aktif</span>
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Pastikan HP Sekolah selalu terhubung ke Wi-Fi sekolah atau memiliki kuota data aktif selama jam operasional sekolah (06.00 - 14.00 WIB).
                  </p>
                </div>
              </div>
            </div>

            {/* HP Orang Tua / Wali Siswa */}
            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
              <div className="flex items-center space-x-3 pb-3 border-b border-slate-800">
                <div className="p-2.5 bg-sky-500/10 text-sky-400 rounded-xl">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">B. Petunjuk untuk HP Orang Tua / Wali Siswa</h3>
                  <p className="text-xs text-slate-400">Format pengiriman pesan perizinan & penerimaan notifikasi</p>
                </div>
              </div>

              <div className="space-y-3 text-xs text-slate-300">
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                  <div className="font-bold text-sky-400">1. Format Baku Pesan Perizinan (Rekomendasi Utama)</div>
                  <p className="text-slate-400 text-[11px]">Orang tua cukup mengirimkan SMS/WA ke nomor sekolah dengan format:</p>
                  <div className="bg-slate-900 p-2.5 rounded-lg font-mono text-[11px] text-sky-300 border border-slate-800 space-y-1">
                    <div>SAKIT#NISN#Alasan#YYYY-MM-DD</div>
                    <div className="text-slate-400 text-[10px]">Contoh: SAKIT#0151234002#Demam tinggi#2026-08-13</div>
                    <hr className="border-slate-800 my-1" />
                    <div>IZIN#NISN#Alasan#YYYY-MM-DD</div>
                    <div className="text-slate-400 text-[10px]">Contoh: IZIN#0151234002#Acara keluarga#2026-08-13</div>
                  </div>
                </div>

                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
                  <div className="font-bold text-sky-400">2. Fitur Smart AI Message Parser (Pesan Teks Bebas)</div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Jika orang tua mengirim pesan biasa seperti: <br />
                    <em className="text-white">"Selamat pagi Bpk/Ibu Guru, saya ibunya Ahmad Fadhil kelas 1A NISN 0151234002 mohon izin hari ini anak saya sakit demam."</em> <br />
                    Sistem aplikasi di menu <strong>Perizinan WA</strong> atau <strong>Input Massal WA</strong> secara otomatis dapat mengekstrak NISN, Nama, dan Alasan secara akurat.
                  </p>
                </div>

                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
                  <div className="font-bold text-sky-400">3. Menerima Notifikasi Kehadiran / Terlambat</div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Orang tua tidak perlu menginstal aplikasi apapun. Pesan notifikasi jam masuk, keterlambatan, absen pulang, maupun pengingat belum dijemput akan masuk langsung ke obrolan WhatsApp orang tua.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: PROMPT GEMINI AI GENERATOR */}
      {activeSection === 'gemini_prompt' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Header Info Box */}
          <div className="bg-gradient-to-r from-amber-950/60 via-slate-900 to-amber-950/40 p-5 rounded-2xl border border-amber-500/40 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-amber-300 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
                <span>Generator Prompt Gemini AI (Pembuat Dokumen & Surat Edaran)</span>
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
                Salin prompt di bawah ini dengan 1-klik, lalu tempelkan (paste) di <a href="https://gemini.google.com" target="_blank" rel="noreferrer" className="text-amber-400 underline font-bold">Gemini AI (https://gemini.google.com)</a> untuk menghasilkan dokumen resmi sekolah lengkap, Surat Edaran untuk Orang Tua, maupun SOP Piket Sekolah secara otomatis!
              </p>
            </div>

            <a
              href="https://gemini.google.com"
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center space-x-2 transition-all shadow-md shadow-amber-500/20 shrink-0"
            >
              <span>Buka Gemini AI</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Prompt 1: Surat Edaran */}
            <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2.5 py-1 rounded-full border border-emerald-500/30">
                    Prompt 1: Orang Tua Siswa
                  </span>
                  <FileText className="w-5 h-5 text-emerald-400" />
                </div>

                <h4 className="text-sm font-bold text-white">Surat Edaran Resmi Orang Tua Siswa</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Menghasilkan draft Surat Edaran Resmi pengenalan Kartu Barcode Siswa, jam operasional presensi, dan format WA izin untuk dibagikan ke wali murid.
                </p>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-300 max-h-48 overflow-y-auto leading-relaxed">
                  {promptSuratEdaran}
                </div>
              </div>

              <button
                onClick={() => copyToClipboard(promptSuratEdaran, 'prompt_1')}
                className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center space-x-2 transition-all shadow-md"
              >
                {copiedPromptId === 'prompt_1' ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Prompt Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Salin Prompt Surat Edaran</span>
                  </>
                )}
              </button>
            </div>

            {/* Prompt 2: SOP Petugas Piket */}
            <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="bg-sky-500/20 text-sky-400 text-[10px] font-bold px-2.5 py-1 rounded-full border border-sky-500/30">
                    Prompt 2: Internal Sekolah
                  </span>
                  <ShieldCheck className="w-5 h-5 text-sky-400" />
                </div>

                <h4 className="text-sm font-bold text-white">SOP Petugas Piket & Operator Presensi</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Menghasilkan panduan Standar Operasional Prosedur (SOP) bertahap dari jam 06.15 WIB hingga penutupan piket harian sekolah.
                </p>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-300 max-h-48 overflow-y-auto leading-relaxed">
                  {promptSOPPiket}
                </div>
              </div>

              <button
                onClick={() => copyToClipboard(promptSOPPiket, 'prompt_2')}
                className="w-full py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center space-x-2 transition-all shadow-md"
              >
                {copiedPromptId === 'prompt_2' ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Prompt Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Salin Prompt SOP Piket</span>
                  </>
                )}
              </button>
            </div>

            {/* Prompt 3: Infografis & Banner */}
            <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="bg-amber-500/20 text-amber-400 text-[10px] font-bold px-2.5 py-1 rounded-full border border-amber-500/30">
                    Prompt 3: Visual & Banner
                  </span>
                  <Zap className="w-5 h-5 text-amber-400" />
                </div>

                <h4 className="text-sm font-bold text-white">Teks Banner MMT / Infografis Gerbang</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Menghasilkan poin-poin ringkas dan menarik untuk dicetak pada banner/MMT gerbang sekolah atau dibagikan di grup WhatsApp kelas.
                </p>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-300 max-h-48 overflow-y-auto leading-relaxed">
                  {promptInfografis}
                </div>
              </div>

              <button
                onClick={() => copyToClipboard(promptInfografis, 'prompt_3')}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center space-x-2 transition-all shadow-md"
              >
                {copiedPromptId === 'prompt_3' ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Prompt Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Salin Prompt Infografis</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
