import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { generateStrategy } from '@/lib/strategy-agent';
import type { Strategy, StrategyInput, OpportunityData, Analysis } from '@/lib/types';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = getDb();
  const row = db.prepare('SELECT * FROM strategies WHERE id = ?').get(Number(id)) as Strategy | undefined;
  if (!row) {
    return NextResponse.json({ error: 'Strategy not found' }, { status: 404 });
  }
  return NextResponse.json({
    ...row,
    result: row.result ? JSON.parse(row.result) : null,
    opportunity_ids: JSON.parse(row.opportunity_ids || '[]'),
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  const db = getDb();

  const row = db.prepare('SELECT * FROM strategies WHERE id = ?').get(Number(id)) as Strategy | undefined;
  if (!row) {
    return NextResponse.json({ error: 'Strategy not found' }, { status: 404 });
  }

  const fields: string[] = [];
  const values: (string | number)[] = [];
  const allowedFields: Record<string, 'string' | 'number'> = {
    title: 'string', business_goal: 'string', core_metric: 'string',
    period_start: 'string', period_end: 'string',
    budget_total: 'number', roi_floor: 'number',
  };

  for (const [key, type] of Object.entries(allowedFields)) {
    if (body[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(type === 'number' ? Number(body[key]) : String(body[key]));
    }
  }

  if (fields.length > 0) {
    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(Number(id));
    db.prepare(`UPDATE strategies SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  }

  if (body.generate) {
    db.prepare(`UPDATE strategies SET status = 'generating', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(Number(id));

    const updated = db.prepare('SELECT * FROM strategies WHERE id = ?').get(Number(id)) as Strategy;

    const oppIds: number[] = JSON.parse(updated.opportunity_ids || '[]');
    let opportunities: OpportunityData[] = [];
    if (oppIds.length > 0) {
      const placeholders = oppIds.map(() => '?').join(',');
      const oppRows = db.prepare(
        `SELECT title, description, confidence, evidence, brand, topic FROM opportunities WHERE id IN (${placeholders})`,
      ).all(...oppIds) as Array<{ title: string; description: string; confidence: number; evidence: string; brand: string; topic: string }>;
      opportunities = oppRows.map(o => ({ ...o, evidence: JSON.parse(o.evidence || '[]') }));
    }

    const strategyInput: StrategyInput = {
      business_goal: updated.business_goal,
      core_metric: updated.core_metric as StrategyInput['core_metric'],
      period: { start: updated.period_start, end: updated.period_end },
      budget_total: updated.budget_total,
      roi_floor: updated.roi_floor,
    };

    const strategyId = Number(id);
    (async () => {
      try {
        const result = await generateStrategy(strategyInput, opportunities, null);
        db.prepare(
          `UPDATE strategies SET status = 'completed', result = ?, title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        ).run(JSON.stringify(result), result.strategy_meta.title || updated.title, strategyId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[Strategy API] Generation failed:', msg);
        db.prepare(
          `UPDATE strategies SET status = 'error', error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        ).run(msg.slice(0, 500), strategyId);
      }
    })();

    return NextResponse.json({ id: strategyId, status: 'generating' });
  }

  const final = db.prepare('SELECT * FROM strategies WHERE id = ?').get(Number(id)) as Strategy;
  return NextResponse.json({
    ...final,
    result: final.result ? JSON.parse(final.result) : null,
    opportunity_ids: JSON.parse(final.opportunity_ids || '[]'),
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = getDb();
  db.prepare('DELETE FROM strategies WHERE id = ?').run(Number(id));
  return NextResponse.json({ ok: true });
}
