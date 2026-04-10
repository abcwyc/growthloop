import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { generateStrategy } from '@/lib/strategy-agent';
import type { Strategy, StrategyInput, OpportunityData, Analysis } from '@/lib/types';

export async function GET() {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM strategies ORDER BY created_at DESC',
  ).all() as Strategy[];
  return NextResponse.json(rows);
}

interface RadarContext {
  brands: string[];
  totalItems: number;
  sentiment: { positive: number; neutral: number; negative: number } | null;
  topics: Array<{ name: string; count: number; sentiment: string }>;
  topNegative: Array<{ summary: string; count: number; severity: string }>;
  opportunities: Array<{ title: string; description: string; confidence: number; brand: string }>;
}

function buildRadarContext(analysisId: number): RadarContext | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM analyses WHERE id = ? AND status = ?').get(analysisId, 'completed') as Analysis | undefined;
  if (!row) return null;

  const sentiment = row.sentiment_result ? JSON.parse(row.sentiment_result) : null;
  const topicResult = row.topic_result ? JSON.parse(row.topic_result) : null;
  const negResult = row.top_negative ? JSON.parse(row.top_negative) : null;

  const oppRows = db.prepare(
    'SELECT title, description, confidence, brand FROM opportunities WHERE analysis_id = ?',
  ).all(analysisId) as Array<{ title: string; description: string; confidence: number; brand: string }>;

  return {
    brands: JSON.parse(row.brands),
    totalItems: row.total_items || 0,
    sentiment: sentiment ? { positive: sentiment.positive, neutral: sentiment.neutral, negative: sentiment.negative } : null,
    topics: (topicResult?.topics || []).map((t: { name: string; count: number; sentiment: string }) => ({
      name: t.name, count: t.count, sentiment: t.sentiment,
    })),
    topNegative: (negResult?.items || []).map((n: { summary: string; count: number; severity: string }) => ({
      summary: n.summary, count: n.count, severity: n.severity,
    })),
    opportunities: oppRows,
  };
}

export async function POST(req: NextRequest) {
  const body = await req.json() as StrategyInput & { title?: string; radar_analysis_id?: number; document_context?: string; competitors?: string[]; own_brand?: string; market_background?: string };
  const db = getDb();

  const title = body.title || `${body.core_metric} 增长策略`;

  const { lastInsertRowid } = db.prepare(
    `INSERT INTO strategies (title, business_goal, core_metric, period_start, period_end, budget_total, roi_floor, opportunity_ids, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'generating')`,
  ).run(
    title,
    body.business_goal,
    body.core_metric,
    body.period.start,
    body.period.end,
    body.budget_total,
    body.roi_floor,
    JSON.stringify(body.opportunity_ids || []),
  );

  const strategyId = Number(lastInsertRowid);

  let opportunities: OpportunityData[] = [];
  if (body.opportunity_ids && body.opportunity_ids.length > 0) {
    const placeholders = body.opportunity_ids.map(() => '?').join(',');
    const oppRows = db.prepare(
      `SELECT title, description, confidence, evidence, brand, topic
       FROM opportunities WHERE id IN (${placeholders})`,
    ).all(...body.opportunity_ids) as Array<{
      title: string; description: string; confidence: number;
      evidence: string; brand: string; topic: string;
    }>;
    opportunities = oppRows.map(o => ({
      ...o,
      evidence: JSON.parse(o.evidence || '[]'),
    }));
  }

  let radarContext: RadarContext | null = null;
  if (body.radar_analysis_id) {
    radarContext = buildRadarContext(body.radar_analysis_id);
    console.log(`[Strategy API] Radar context from analysis #${body.radar_analysis_id}: ${radarContext ? 'loaded' : 'not found'}`);
  }

  const strategyInput: StrategyInput = {
    ...body,
    competitors: body.competitors,
    own_brand: body.own_brand,
    market_background: body.market_background,
  };

  (async () => {
    try {
      const result = await generateStrategy(strategyInput, opportunities, radarContext, body.document_context);
      db.prepare(
        `UPDATE strategies SET status = 'completed', result = ?, title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      ).run(JSON.stringify(result), result.strategy_meta.title || title, strategyId);
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
