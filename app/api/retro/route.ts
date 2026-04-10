import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { parseCsv, generateRetroReport } from '@/lib/retro-agent';
import type { Campaign, StrategyResult, CsvRow } from '@/lib/types';

export async function GET() {
  const db = getDb();
  const rows = db.prepare(
    'SELECT c.*, s.title as strategy_title, s.result as strategy_result FROM campaigns c LEFT JOIN strategies s ON c.strategy_id = s.id ORDER BY c.created_at DESC',
  ).all() as Array<Campaign & { strategy_title?: string }>;
  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { title, strategy_id, period_start, period_end, csv_text } = body as {
    title: string;
    strategy_id?: number;
    period_start: string;
    period_end: string;
    csv_text?: string;
  };

  if (!title || !period_start || !period_end) {
    return NextResponse.json({ error: '请填写标题和Campaign周期' }, { status: 400 });
  }

  const db = getDb();

  let csvData: CsvRow[] | null = null;
  if (csv_text) {
    const { rows, errors } = parseCsv(csv_text);
    if (errors.length > 0 && rows.length === 0) {
      return NextResponse.json({ error: 'CSV解析失败', details: errors }, { status: 400 });
    }
    csvData = rows;
  }

  const result = db.prepare(
    `INSERT INTO campaigns (title, strategy_id, period_start, period_end, status, csv_data)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    title,
    strategy_id || null,
    period_start,
    period_end,
    csvData ? 'data_uploaded' : 'draft',
    csvData ? JSON.stringify(csvData) : null,
  );

  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(result.lastInsertRowid) as Campaign;
  return NextResponse.json(campaign, { status: 201 });
}
