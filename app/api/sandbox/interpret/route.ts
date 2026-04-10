import { getDb } from '@/lib/db';
import { computeScenario, interpretScenario } from '@/lib/sandbox-engine';
import type { Strategy, StrategyResult, SandboxParams, Analysis } from '@/lib/types';

export async function POST(request: Request) {
  const { strategy_id, params, radar_analysis_id } = await request.json() as {
    strategy_id: number;
    params: SandboxParams;
    radar_analysis_id?: number;
  };

  const db = getDb();
  const row = db.prepare('SELECT * FROM strategies WHERE id = ? AND status = ?').get(strategy_id, 'completed') as Strategy | undefined;
  if (!row || !row.result) {
    return Response.json({ error: '策略不存在或未完成' }, { status: 404 });
  }

  const strategy: StrategyResult = JSON.parse(row.result);
  const result = computeScenario(strategy, params);

  let radarContext: Record<string, unknown> | null = null;
  if (radar_analysis_id) {
    const analysis = db.prepare('SELECT * FROM analyses WHERE id = ? AND status = ?').get(radar_analysis_id, 'completed') as Analysis | undefined;
    if (analysis) {
      radarContext = {
        brands: JSON.parse(analysis.brands),
        totalItems: analysis.total_items,
        sentiment: analysis.sentiment_result ? JSON.parse(analysis.sentiment_result) : null,
      };
    }
  }

  let interpretation;
  try {
    interpretation = await interpretScenario(strategy, params, result, radarContext);
  } catch (err) {
    console.error('[Sandbox] Interpretation failed:', err);
    interpretation = {
      insight_primary: '推演计算完成，AI 解读暂时不可用',
      insight_secondary: '请关注渠道预算分布和边际收益变化',
      risk_flag: null,
      confidence: 'low',
    };
  }

  try {
    const pacingLabel = { uniform: '均匀铺开', burst: '集中爆发', front_heavy: '前重后轻', back_heavy: '前轻后重' }[params.pacing] || params.pacing;
    const name = `预算${params.budget_delta_pct >= 0 ? '+' : ''}${params.budget_delta_pct}% / 品牌${Math.round(params.brand_ratio * 100)}% / ${pacingLabel}`;
    db.prepare(
      `INSERT INTO sandbox_scenarios (strategy_id, radar_analysis_id, name, scenario_type, params, result, interpretation, input_data)
       VALUES (?, ?, ?, 'resource', ?, ?, ?, ?)`,
    ).run(
      strategy_id,
      radar_analysis_id || null,
      name,
      JSON.stringify(params),
      JSON.stringify(result),
      JSON.stringify(interpretation),
      JSON.stringify({ strategy_id, params, radar_analysis_id }),
    );
  } catch (e) {
    console.error('[Sandbox] Save scenario failed:', e);
  }

  return Response.json({ result, interpretation });
}
