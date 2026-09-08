import QRCode from 'qrcode';

export async function generateStudentQRCode(nisn: string): Promise<string> {
  try {
    const dataUrl = await QRCode.toDataURL(nisn, {
      width: 250,
      margin: 2,
      color: {
        dark: '#1e293b',
        light: '#ffffff',
      },
    });
    return dataUrl;
  } catch (err) {
    console.error('Error generating QR code', err);
    return '';
  }
}
