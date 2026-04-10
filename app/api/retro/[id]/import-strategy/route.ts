import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import type { Campaign, RetroResult } from '@/lib/types';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id) as Campaign | undefined;
  if (!campaign || !campaign.retro_result) {
    return NextResponse.json({ error: '该Campaign还没有复盘结果' }, { status: 400 });
  }

  const retro: RetroResult = JSON.parse(campaign.retro_result);
  const recs = retro.next_round_recommendations;

  const budgetHints = recs.budget_reallocation
    .map(r => `${r.channel}: ${r.current_pct}%→${r.recommended_pct}%`)
    .join('; ');

  const assumptionHints = recs.updated_assumptions
    .map(a => `${a.old} → ${a.new}（${a.basis}）`)
    .join('; ');

  const goal = `基于上轮复盘建议优化：${retro.overall_summary.goal_achievement}。渠道调整：${budgetHints}。人群建议：${recs.audience_strategy.join('、')}。假设更新：${assumptionHints}`;

  const stratResult = db.prepare(
    `INSERT INTO strategies (title, business_goal, core_metric, period_start, period_end, budget_total, roi_floor, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    `${campaign.title} - 下轮策略草案`,
    goal,
    'DAU',
    campaign.period_end,
    '',
    0,
    0,
    'draft',
  );

  return NextResponse.json({
    strategy_id: stratResult.lastInsertRowid,
    redirect: `/strategy/new?from_retro=${id}&strategy_draft=${stratResult.lastInsertRowid}`,
  });
}
