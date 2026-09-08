import * as pdfjsLib from 'pdfjs-dist';

// Set up pdf.js worker using reliable cdn or legacy fallback
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.10.38'}/pdf.worker.min.mjs`;
}

export interface ParsedLibraryStudent {
  id: string;
  nisn: string;
  name: string;
  class: string;
  gender: 'L' | 'P';
  parentPhone: string;
  rawTextSample?: string;
}

/**
 * Robust Indonesian SD library card & student card PDF Parser
 * Extracts text lines, student names, NISN / barcode numbers from library cards (SLiMS, Inlislite, Canva, Corel/Word PDF export, etc.)
 */
export async function parseLibraryPDF(file: File): Promise<{
  students: ParsedLibraryStudent[];
  totalPages: number;
  extractedTextCount: number;
}> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useSystemFonts: true,
  });
  const pdf = await loadingTask.promise;

  const totalPages = pdf.numPages;
  const rawTextLines: string[] = [];

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    
    // Group text items by vertical y-coordinate to preserve line structure
    const items = textContent.items as any[];
    
    // Sort items visually: Y descending (top to bottom), then X ascending (left to right)
    items.sort((a, b) => {
      const yDiff = b.transform[5] - a.transform[5];
      if (Math.abs(yDiff) > 4) return yDiff;
      return a.transform[4] - b.transform[4];
    });

    let currentY = -99999;
    let currentLine = '';

    for (const item of items) {
      const str = (item.str || '').trim();
      if (!str) continue;

      const y = Math.round(item.transform[5]);
      if (Math.abs(y - currentY) > 5) {
        if (currentLine.trim()) {
          rawTextLines.push(currentLine.trim());
        }
        currentLine = str;
        currentY = y;
      } else {
        currentLine += ' ' + str;
      }
    }

    if (currentLine.trim()) {
      rawTextLines.push(currentLine.trim());
    }
  }

  const parsedStudents = extractStudentsFromTextLines(rawTextLines);

  return {
    students: parsedStudents,
    totalPages,
    extractedTextCount: rawTextLines.length,
  };
}

/**
 * Heuristic parser designed for Indonesian school library cards & barcode lists
 */
export function extractStudentsFromTextLines(lines: string[]): ParsedLibraryStudent[] {
  const studentsMap = new Map<string, ParsedLibraryStudent>();
  const fullBlob = lines.join('\n');

  // Pattern 1: Delimited lines (e.g. CSV, Tab, SLiMS export, or list format)
  lines.forEach((line, index) => {
    // Check if line contains standard delimiters
    if (line.includes(',') || line.includes(';') || line.includes('\t') || line.includes('|')) {
      const parts = line.split(/[,;\t|]+/).map((p) => p.trim());
      if (parts.length >= 2) {
        const barcodePart = parts.find((p) => /^\d{4,18}$/.test(p));
        const namePart = parts.find(
          (p) => p !== barcodePart && /[a-zA-Z]{3,}/.test(p) && !/^(kelas|nisn|nis|kartu|perpustakaan|sd|sdn|nomor)/i.test(p)
        );
        const classPart = parts.find((p) => /^(kelas\s*)?[1-6][a-fA-F]?$/i.test(p));

        if (barcodePart && namePart) {
          const cleanName = cleanStudentName(namePart);
          const cleanClass = normalizeClassName(classPart || 'Kelas 1A');
          if (cleanName && !studentsMap.has(barcodePart)) {
            studentsMap.set(barcodePart, {
              id: `std-lib-${barcodePart}`,
              nisn: barcodePart,
              name: cleanName,
              class: cleanClass,
              gender: guessGender(cleanName),
              parentPhone: '6281234567890',
              rawTextSample: line,
            });
            return;
          }
        }
      }
    }

    // Pattern 2: Library Card Block Structure (Multi-line Card with labels or raw barcode numbers)
    const barcodeMatch =
      line.match(/(?:nisn|no\.?\s*anggota|no\.?\s*kartu|barcode|id|kode|nomor)\s*[:=-]?\s*(\d{4,18})/i) ||
      line.match(/\b(\d{8,16})\b/);

    if (barcodeMatch) {
      const barcodeNum = barcodeMatch[1];

      // Look around ±3 lines for candidate name & class
      let candidateName = '';
      let candidateClass = 'Kelas 1A';

      for (let offset = -3; offset <= 3; offset++) {
        const targetIdx = index + offset;
        if (targetIdx >= 0 && targetIdx < lines.length) {
          const l = lines[targetIdx];

          const nameMatch = l.match(/(?:nama(?:\s*siswa|\s*anggota|\s*lengkap)?)\s*[:=-]\s*([a-zA-Z\s.,']+)/i);
          if (nameMatch) {
            candidateName = cleanStudentName(nameMatch[1]);
          } else if (
            !candidateName &&
            offset !== 0 &&
            /^[a-zA-Z\s.,']{4,40}$/.test(l) &&
            !/^(kartu|perpustakaan|sdn|sd\s|kementerian|dinas|pemerintah|anggota|student|member|sekolah|indonesia)/i.test(l)
          ) {
            candidateName = cleanStudentName(l);
          }

          const classMatch =
            l.match(/(?:kelas|tingkat|rombel)\s*[:=-]?\s*([1-6]\s*[a-fA-F]?)/i) ||
            l.match(/\b([1-6][a-fA-F])\b/);
          if (classMatch) {
            candidateClass = normalizeClassName(classMatch[1]);
          }
        }
      }

      if (candidateName && !studentsMap.has(barcodeNum)) {
        studentsMap.set(barcodeNum, {
          id: `std-lib-${barcodeNum}`,
          nisn: barcodeNum,
          name: candidateName,
          class: candidateClass,
          gender: guessGender(candidateName),
          parentPhone: '6281234567890',
          rawTextSample: line,
        });
      }
    }
  });

  // Pattern 3: Fallback Regex Scan across full text for table columns
  if (studentsMap.size === 0) {
    const tableRegex = /(\d{1,4})[\s.\t]+(\d{6,16})[\s.\t]+([a-zA-Z\s.,']{4,40})(?:[\s.\t]+(Kelas\s*[1-6][a-fA-F]?|[1-6][a-fA-F]?))?/g;
    let match;
    while ((match = tableRegex.exec(fullBlob)) !== null) {
      const barcodeNum = match[2];
      const name = cleanStudentName(match[3]);
      const cls = normalizeClassName(match[4] || 'Kelas 1A');

      if (barcodeNum && name && !studentsMap.has(barcodeNum)) {
        studentsMap.set(barcodeNum, {
          id: `std-lib-${barcodeNum}`,
          nisn: barcodeNum,
          name,
          class: cls,
          gender: guessGender(name),
          parentPhone: '6281234567890',
          rawTextSample: match[0],
        });
      }
    }
  }

  return Array.from(studentsMap.values());
}

function cleanStudentName(raw: string): string {
  return raw
    .replace(/^(nama|name|siswa|anggota|member)\s*[:=-]?\s*/i, '')
    .replace(/[0-9]/g, '')
    .replace(/[:;_|#*]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeClassName(raw: string): string {
  const clean = raw.trim().toUpperCase();
  if (/^KELAS\s*/i.test(clean)) return clean;
  const match = clean.match(/([1-6])\s*([A-F])?/);
  if (match) {
    return `Kelas ${match[1]}${match[2] || 'A'}`;
  }
  return 'Kelas 1A';
}

function guessGender(name: string): 'L' | 'P' {
  const femaleNames = [
    'siti', 'putri', 'nur', 'zahra', 'aisyah', 'anisa', 'fatimah', 'dina', 'dewi',
    'rahma', 'ayu', 'lia', 'fitri', 'intan', 'wulan', 'citra', 'mutiara', 'salma',
    'nadia', 'khairunisa', 'bilqis', 'cantika', 'tri', 'lestari', 'wulandari',
  ];
  const lower = name.toLowerCase();
  for (const fn of femaleNames) {
    if (lower.includes(fn)) return 'P';
  }
  return 'L';
}
