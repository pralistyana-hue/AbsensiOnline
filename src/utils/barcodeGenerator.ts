import JsBarcode from 'jsbarcode';

/**
 * Generates a 1D Barcode (CODE128) as a PNG data URL.
 * Works seamlessly in all modern browsers.
 */
export function generate1DBarcodeDataUrl(text: string): string {
  if (!text) return '';
  try {
    const canvas = document.createElement('canvas');
    JsBarcode(canvas, text, {
      format: 'CODE128',
      width: 2,
      height: 55,
      displayValue: true,
      fontSize: 13,
      font: 'monospace',
      lineColor: '#0f172a',
      background: '#ffffff',
      margin: 8,
    });
    return canvas.toDataURL('image/png');
  } catch (err) {
    console.error('Failed to generate 1D barcode:', err);
    return '';
  }
}
