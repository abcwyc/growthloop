import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { chatWithStrategy } from '@/lib/strategy-agent';
import type { Strategy, StrategyResult } from '@/lib/types';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = getDb();
  const row = db.prepare('SELECT * FROM strategies WHERE id = ?').get(Number(id)) as Strategy | undefined;

  if (!row || !row.result) {
    return NextResponse.json({ error: '策略不存在或尚未生成' }, { status: 404 });
  }

  const body = await req.json() as {
    question: string;
    tab_context: string;
    conversation_history: Array<{ role: 'user' | 'assistant'; content: string }>;
  };

  if (!body.question?.trim()) {
    return NextResponse.json({ error: '问题不能为空' }, { status: 400 });
  }

  const currentStrategy = JSON.parse(row.result) as StrategyResult;

  try {
    const result = await chatWithStrategy({
      question: body.question,
      tab_context: body.tab_context || 'audience',
      conversation_history: body.conversation_history || [],
      current_strategy: currentStrategy,
    });

    if (result.updated_strategy) {
      db.prepare(
        'UPDATE strategies SET result = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      ).run(JSON.stringify(result.updated_strategy), Number(id));
    }

    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Strategy Chat] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
