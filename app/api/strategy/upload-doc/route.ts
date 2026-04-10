import { NextRequest, NextResponse } from 'next/server';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_TEXT_LENGTH = 30_000;

const SUPPORTED_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-excel': 'xls',
  'text/plain': 'txt',
  'text/markdown': 'md',
  'text/csv': 'csv',
};

function truncateText(text: string, max: number): { text: string; truncated: boolean } {
  const cleaned = text.replace(/\n{3,}/g, '\n\n').trim();
  if (cleaned.length <= max) return { text: cleaned, truncated: false };
  return { text: cleaned.slice(0, max) + '\n\n[... 内容已截断 ...]', truncated: true };
}

async function extractText(buffer: Buffer, ext: string, fileName: string): Promise<string> {
  switch (ext) {
    case 'pdf': {
      const result = await pdf(buffer);
      return result.text;
    }
    case 'docx': {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }
    case 'doc': {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }
    case 'xlsx':
    case 'xls':
    case 'csv': {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const lines: string[] = [];
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) continue;
        lines.push(`## ${sheetName}`);
        const csv = XLSX.utils.sheet_to_csv(sheet);
        lines.push(csv);
      }
      return lines.join('\n\n');
    }
    case 'txt':
    case 'md': {
      return buffer.toString('utf-8');
    }
    default:
      throw new Error(`不支持的文件类型: ${fileName}`);
  }
}

function detectExt(fileName: string, mimeType: string): string {
  if (SUPPORTED_TYPES[mimeType]) return SUPPORTED_TYPES[mimeType];
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const byExt: Record<string, string> = {
    pdf: 'pdf', docx: 'docx', doc: 'doc',
    xlsx: 'xlsx', xls: 'xls', csv: 'csv',
    txt: 'txt', md: 'md',
  };
  if (byExt[ext]) return byExt[ext];
  throw new Error(`不支持的文件格式: ${ext || mimeType}`);
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: '未提供文件' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: `文件过大，最大支持 ${MAX_FILE_SIZE / 1024 / 1024}MB` }, { status: 400 });
    }

    const ext = detectExt(file.name, file.type);
    const buffer = Buffer.from(await file.arrayBuffer());

    console.log(`[Doc Upload] Parsing ${file.name} (${ext}, ${(file.size / 1024).toFixed(1)}KB)`);

    const rawText = await extractText(buffer, ext, file.name);
    const { text, truncated } = truncateText(rawText, MAX_TEXT_LENGTH);

    console.log(`[Doc Upload] Extracted ${rawText.length} chars${truncated ? ` (truncated to ${MAX_TEXT_LENGTH})` : ''}`);

    return NextResponse.json({
      success: true,
      fileName: file.name,
      fileSize: file.size,
      fileType: ext,
      textLength: text.length,
      truncated,
      text,
      preview: text.slice(0, 500),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Doc Upload] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
