import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const idsParam = req.nextUrl.searchParams.get('ids');
  if (!idsParam) return NextResponse.json([]);

  const ids = idsParam.split(',').map(Number).filter(Boolean);
  if (ids.length === 0) return NextResponse.json([]);

  const db = getDb();
  const placeholders = ids.map(() => '?').join(',');
  const rows = db.prepare(
    `SELECT id, title, description, confidence, evidence, brand, topic
     FROM opportunities WHERE id IN (${placeholders})`,
  ).all(...ids) as Array<{
    id: number; title: string; description: string; confidence: number;
    evidence: string; brand: string; topic: string;
  }>;

  return NextResponse.json(
    rows.map(r => ({ ...r, evidence: JSON.parse(r.evidence || '[]') })),
  );
}
