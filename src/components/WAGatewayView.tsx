import React, { useState, useEffect } from 'react';
import {
  Radio,
  CheckCircle2,
  ExternalLink,
  Bot,
  Globe,
  Smartphone,
  ShieldCheck,
  Send,
  MessageSquareText,
  Copy,
  Check,
  Terminal,
  Settings,
  Zap,
  AlertTriangle,
} from 'lucide-react';
import { AppSettings } from '../types';
import { parseWhatsAppPermission } from '../utils/whatsapp';

interface WAGatewayViewProps {
  settings: AppSettings;
  onSaveSettings: (settings: AppSettings) => void;
}

export const WAGatewayView: React.FC<WAGatewayViewProps> = ({
  settings,
  onSaveSettings,
}) => {
  const [tokenInput, setTokenInput] = useState(settings.waGatewayToken || 'secret123');
  const [urlInput, setUrlInput] = useState(settings.waGatewayUrl || 'http://localhost:5000/send-message');
  const [testMsgInput, setTestMsgInput] = useState('IZIN#0151234002#Sakit demam dan pusing#2026-08-13');
  const [testResult, setTestResult] = useState<any>(null);
  const [copiedFormat, setCopiedFormat] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedPackageJson, setCopiedPackageJson] = useState(false);
  const [testBotStatus, setTestBotStatus] = useState<{ loading: boolean; success?: boolean; msg?: string } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Auto hide toast after 3.5 seconds
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleTestParse = () => {
    const res = parseWhatsAppPermission(testMsgInput);
    setTestResult(res);
  };

  const handleSaveGatewayConfig = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings({
      ...settings,
      waGatewayUrl: urlInput,
      waGatewayToken: tokenInput,
    });
    setToast({
      message: 'Pengaturan URL & Token WA Gateway berhasil disimpan!',
      type: 'success',
    });
  };

  const handleTestBotConnection = async () => {
    setTestBotStatus({ loading: true });
    try {
      const res = await fetch(urlInput, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: tokenInput,
        },
        body: JSON.stringify({
          target: '6281234567890',
          message: 'Tes Koneksi WA Bot Baileys Sekolah SD',
        }),
      });

      const data = await res.json().catch(() => null);
      if (res.ok || (data && data.status)) {
        setTestBotStatus({
          loading: false,
          success: true,
          msg: 'Sistem berhasil terhubung dengan Server WA Bot Baileys!',
        });
      } else {
        setTestBotStatus({
          loading: false,
          success: false,
          msg: `Respon server: ${res.status} ${res.statusText}. Pastikan 'node server.js' sudah berjalan di PC piket.`,
        });
      }
    } catch (err: any) {
      setTestBotStatus({
        loading: false,
        success: false,
        msg: `Tidak dapat menghubungi ${urlInput}. Pastikan bot berjalan dan izinkan CORS / firewall local. Error: ${err.message}`,
      });
    }
  };

  const handleCopyParentGuide = () => {
    const text = `Yth. Bapak/Ibu Orang Tua/Wali Siswa SD Negeri 1 Nusantara,

Untuk mengajukan perizinan ketidakhadiran siswa (Sakit/Izin), Bapak/Ibu dapat mengirimkan pesan WhatsApp ke nomor resmi sekolah dengan format baku berikut:

📌 FORMAT PERIZINAN:
IZIN#NISN#ALASAN#TANGGAL
atau
SAKIT#NISN#ALASAN#TANGGAL

Contoh:
SAKIT#0151234002#Demam tinggi dan pusing#2026-08-13

Pesan Anda akan diproses secara otomatis oleh Sistem Absensi SD. Terima kasih.`;

    navigator.clipboard.writeText(text);
    setCopiedFormat(true);
    setTimeout(() => setCopiedFormat(false), 2000);
  };

  const sampleBaileysScript = `// ==========================================================
// SERVER BOT WA BAILEYS / NODE.JS MANDIRI - SD NEGERI 1 NUSANTARA
// ==========================================================
// File: server.js
// Dijalankan di PC Piket Sekolah: node server.js

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require('@whiskeysockets/baileys');
const express = require('express');
const cors = require('cors');
const qrcode = require('qrcode-terminal');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 5000;
let sock = null;

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: true
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\\n[WA BOT] SILAKAN SCAN QR CODE DI BAWAH DENGAN HP SEKOLAH:');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('[WA BOT] Koneksi terputus. Menghubungkan ulang...', shouldReconnect);
      if (shouldReconnect) connectToWhatsApp();
    } else if (connection === 'open') {
      console.log('✅ [WA BOT] TERHUBUNG KE WHATSAPP SEKOLAH! TERSEDIA DI PORT ' + PORT);
    }
  });

  // Mendengarkan Pesan Masuk dari Orang Tua (Format: SAKIT#NISN#... / IZIN#NISN#...)
  sock.ev.on('messages.upsert', async (m) => {
    const msg = m.messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const sender = msg.key.remoteJid;
    const body = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

    console.log(\`[WA MASUK] Dari: \${sender} | Pesan: \${body}\`);

    // Balasan Otomatis Sederhana
    if (body.startsWith('IZIN#') || body.startsWith('SAKIT#')) {
      await sock.sendMessage(sender, {
        text: '✅ Terimakasih, pesan perizinan Anda telah diterima oleh Sistem Absensi SD Negeri 1 Nusantara.'
      });
    }
  });
}

// REST API Endpoint Pengiriman Pesan dari Aplikasi Web
app.post('/send-message', async (req, res) => {
  try {
    const { target, number, message } = req.body;
    const recipient = target || number;

    if (!recipient || !message) {
      return res.status(400).json({ status: false, message: 'Nomor target dan pesan wajib diisi!' });
    }

    // Clean phone number format
    let cleanNumber = recipient.replace(/\\D/g, '');
    if (cleanNumber.startsWith('0')) cleanNumber = '62' + cleanNumber.substring(1);
    const jid = cleanNumber + '@s.whatsapp.net';

    if (!sock) {
      return res.status(500).json({ status: false, message: 'Bot WhatsApp belum siap!' });
    }

    await sock.sendMessage(jid, { text: message });
    console.log(\`[WA KELUAR SUCCESS] Ke: \${cleanNumber} | Msg: \${message.substring(0, 30)}...\`);

    return res.json({ status: true, message: 'Pesan WhatsApp berhasil terkirim via Baileys!' });
  } catch (err) {
    console.error('[WA KELUAR ERROR]', err);
    return res.status(500).json({ status: false, error: err.message });
  }
});

app.get('/status', (req, res) => {
  res.json({ status: 'active', botReady: !!sock });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(\`🚀 Server WA Bot Sekolah berjalan di http://localhost:\${PORT}\`);
  connectToWhatsApp();
});`;

  const samplePackageJson = `{
  "name": "wa-bot-sd-sekolah",
  "version": "1.0.0",
  "description": "Bot WhatsApp Baileys Mandiri untuk Presensi SD",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "@whiskeysockets/baileys": "^6.6.0",
    "cors": "^2.8.5",
    "express": "^4.19.2",
    "qrcode-terminal": "^0.12.0"
  }
}`;

  const handleCopyScript = () => {
    navigator.clipboard.writeText(sampleBaileysScript);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  const handleCopyPackageJson = () => {
    navigator.clipboard.writeText(samplePackageJson);
    setCopiedPackageJson(true);
    setTimeout(() => setCopiedPackageJson(false), 2000);
  };

  return (
    <div className="space-y-6 relative">
      {/* Floating Auto-Dismiss Toast Notification */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 max-w-md px-4 py-3 rounded-2xl border shadow-2xl backdrop-blur-xl flex items-center space-x-3 transition-all animate-bounce-in bg-slate-900/95 border-emerald-500/50 text-emerald-300 ring-1 ring-emerald-500/30">
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span className="text-xs font-bold leading-relaxed">{toast.message}</span>
        </div>
      )}
      {/* Top Banner */}
      <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-md">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Radio className="w-5 h-5 text-emerald-400" />
          Panduan & Integrasi WhatsApp Gateway 24 Jam
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Sistem mendukung integrasi pengiriman dan penerimaan WhatsApp otomatis 24/7 maupun metode Web Link gratis.
        </p>
      </div>

      {/* 3 Modes Explanation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Mode 1 */}
        <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-2">
          <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl w-fit">
            <Globe className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-white">1. Direct WA Web Link (Bawaan App)</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            <strong className="text-emerald-400">Gratis 100% & Tanpa Aplikasi Tambahan.</strong> Saat tombol "Kirim WA Ortu" diklik, aplikasi membuka tautan resmi <code className="text-emerald-300">wa.me</code> / WhatsApp Web dengan pesan terisi otomatis.
          </p>
          <span className="inline-block text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-semibold border border-emerald-500/30">
            ✓ Aktif Bawaan
          </span>
        </div>

        {/* Mode 2 */}
        <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-2">
          <div className="p-2 bg-sky-500/10 text-sky-400 rounded-xl w-fit">
            <Bot className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-white">2. WA Gateway Cloud API (Fonnte / Wablas)</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            <strong className="text-sky-400">Otomatis Tanpa Klik Manual.</strong> Membutuhkan akun layanan WA Gateway API (seperti Fonnte, Wablas, Whacenter). Notifikasi terkirim otomatis di latar belakang.
          </p>
          <span className="inline-block text-[10px] bg-sky-500/20 text-sky-400 px-2 py-0.5 rounded-full font-semibold border border-sky-500/30">
            Dibutuhkan API Token
          </span>
        </div>

        {/* Mode 3 */}
        <div className="bg-slate-900 p-4 rounded-2xl border border-amber-500/50 space-y-2 shadow-lg shadow-amber-500/5">
          <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl w-fit">
            <Smartphone className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-white">3. Self-Hosted WA Bot (Baileys / Node.js)</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            <strong className="text-amber-400">Gratis & Mandiri di PC Piket Sekolah.</strong> Menggunakan bot open-source Node.js (Baileys) yang dijalankan di PC piket sekolah.
          </p>
          <span className="inline-block text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-semibold border border-amber-500/30">
            Satu HP Khusus Sekolah
          </span>
        </div>
      </div>

      {/* Mode 3 Deep-Dive Configuration & Node.js Baileys Script */}
      <div className="bg-slate-900 p-5 rounded-2xl border border-amber-500/30 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Bot className="w-5 h-5 text-amber-400" />
              Mode 3: Panduan & Script Bot WhatsApp Baileys (Mandiri di PC Sekolah)
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Ikuti langkah di bawah ini untuk menjalankan server bot WA gratis di laptop/komputer piket sekolah.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopyPackageJson}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center space-x-1 border border-slate-700"
            >
              {copiedPackageJson ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedPackageJson ? 'Package Tersalin!' : 'Salin package.json'}</span>
            </button>

            <button
              onClick={handleCopyScript}
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center space-x-1.5 shadow-md shadow-amber-500/20"
            >
              {copiedScript ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedScript ? 'Script Tersalin!' : 'Salin Script server.js'}</span>
            </button>
          </div>
        </div>

        {/* 5 Steps Installation Steps */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs">
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
            <div className="font-bold text-amber-400">1. Buat Folder</div>
            <p className="text-slate-400 text-[11px]">
              Buat folder baru di PC piket, misal <code className="text-white">C:\wa-bot-sekolah</code>
            </p>
          </div>

          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
            <div className="font-bold text-amber-400">2. Install Library</div>
            <p className="text-slate-400 text-[11px]">
              Jalankan CMD: <br />
              <code className="text-emerald-300 font-mono text-[10px]">npm install @whiskeysockets/baileys express cors qrcode-terminal</code>
            </p>
          </div>

          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
            <div className="font-bold text-amber-400">3. Simpan server.js</div>
            <p className="text-slate-400 text-[11px]">
              Salin script di bawah, simpan sebagai file <code className="text-white">server.js</code> di folder tersebut.
            </p>
          </div>

          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
            <div className="font-bold text-amber-400">4. Jalankan Bot</div>
            <p className="text-slate-400 text-[11px]">
              Ketik <code className="text-emerald-300 font-mono">node server.js</code> di CMD, lalu scan QR yang muncul pakai WA HP Sekolah.
            </p>
          </div>

          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
            <div className="font-bold text-amber-400">5. Isi Endpoint</div>
            <p className="text-slate-400 text-[11px]">
              Masukan URL <code className="text-sky-300">http://localhost:5000/send-message</code> di form Pengaturan URL di bawah.
            </p>
          </div>
        </div>

        {/* Source Code Script Viewer */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
            <span>📄 Source Code Node.js Baileys (<code className="text-amber-400">server.js</code>):</span>
            <span className="text-[11px] text-slate-500 font-mono">Express Server Port: 5000</span>
          </div>
          <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs font-mono text-slate-300 overflow-x-auto max-h-64 leading-relaxed">
            <code>{sampleBaileysScript}</code>
          </pre>
        </div>

        {/* Form Settings & Connection Tester */}
        <form onSubmit={handleSaveGatewayConfig} className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-4">
          <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
            <Settings className="w-4 h-4 text-emerald-400" />
            <span>Konfigurasi Endpoint URL WA Gateway di Aplikasi Ini</span>
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                URL Endpoint WA Gateway:
              </label>
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="http://localhost:5000/send-message"
                className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Gunakan <code className="text-amber-300">http://localhost:5000/send-message</code> jika di PC yang sama, atau IP Local PC jika di beda jaringan PC piket.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Token / Secret Authorization (Opsional):
              </label>
              <input
                type="text"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="secret123"
                className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>
          </div>

          <div className="flex items-center space-x-3 pt-1">
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl flex items-center space-x-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Simpan Pengaturan Gateway</span>
            </button>

            <button
              type="button"
              onClick={handleTestBotConnection}
              disabled={testBotStatus?.loading}
              className="px-4 py-2 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 font-bold text-xs rounded-xl flex items-center space-x-1.5 border border-amber-500/30 disabled:opacity-50"
            >
              <Zap className="w-4 h-4 text-amber-400" />
              <span>{testBotStatus?.loading ? 'Menghubungkan...' : 'Tes Koneksi Bot Local'}</span>
            </button>
          </div>

          {testBotStatus && !testBotStatus.loading && (
            <div
              className={`p-3 rounded-xl border text-xs font-semibold flex items-center space-x-2 ${
                testBotStatus.success
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}
            >
              {testBotStatus.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              <span>{testBotStatus.msg}</span>
            </div>
          )}
        </form>
      </div>

      {/* Parent WhatsApp Permission Format & AI Parser Tester */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Parent Guide & Format */}
        <div className="lg:col-span-6 bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <MessageSquareText className="w-4 h-4 text-emerald-400" />
              Format Pesan Orang Tua (Kirim & Terima WA)
            </h3>

            <button
              onClick={handleCopyParentGuide}
              className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-xs font-semibold rounded-lg flex items-center space-x-1 border border-emerald-500/30"
            >
              {copiedFormat ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedFormat ? 'Tersalin!' : 'Salin Pengumuman Ortu'}</span>
            </button>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs font-mono text-slate-300">
            <div className="text-amber-400 font-bold">1. FORMAT BAKU TERSTRUKTUR:</div>
            <code className="block bg-slate-900 p-2 rounded text-emerald-300">
              IZIN#NISN#ALASAN#TANGGAL
            </code>
            <code className="block bg-slate-900 p-2 rounded text-emerald-300">
              SAKIT#NISN#ALASAN#TANGGAL
            </code>
            <div className="text-[11px] text-slate-400 font-sans mt-1">
              Contoh: <code className="text-white">SAKIT#0151234002#Demam tinggi dan pusing#2026-08-13</code>
            </div>

            <div className="text-amber-400 font-bold pt-2">2. FORMAT TEKS BEBAS / PARSER AI:</div>
            <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
              Sistem juga dilengkapi <em>Smart Message Extractor</em> yang otomatis mengekstrak NISN, Nama Siswa, dan Alasan meskipun orang tua mengirimkan pesan teks bebas seperti:
              <br />
              <span className="text-white italic">"Selamat pagi Bu Guru, mohon izin anak kami Budi Santoso (NISN: 0151234001) hari ini izin tidak masuk karena acara keluarga."</span>
            </p>
          </div>
        </div>

        {/* Right: Message Parser Simulator */}
        <div className="lg:col-span-6 bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-3 flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            Uji Coba Ekstraksi Pesan WA Masuk
          </h3>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Masukkan Pesan Contoh dari Orang Tua:
            </label>
            <textarea
              rows={3}
              value={testMsgInput}
              onChange={(e) => setTestMsgInput(e.target.value)}
              className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>

          <button
            onClick={handleTestParse}
            className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl"
          >
            Uji Parser Otomatis
          </button>

          {testResult && (
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Status Validasi:</span>
                <span
                  className={`font-bold px-2 py-0.5 rounded ${
                    testResult.isValid
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-rose-500/20 text-rose-400'
                  }`}
                >
                  {testResult.isValid ? 'VALID' : 'TIDAK VALID'}
                </span>
              </div>
              {testResult.isValid && (
                <>
                  <div className="text-slate-300">
                    NISN: <span className="font-mono text-emerald-400 font-bold">{testResult.nisn}</span>
                  </div>
                  <div className="text-slate-300">
                    Jenis Izin: <span className="font-bold text-amber-400">{testResult.type}</span>
                  </div>
                  <div className="text-slate-300">
                    Alasan: <span className="text-white">{testResult.reason}</span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
