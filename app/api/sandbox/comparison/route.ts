import { getDb } from '@/lib/db';
import { compareStrategies } from '@/lib/sandbox-engine';
import type { Strategy, StrategyResult } from '@/lib/types';

export async function POST(request: Request) {
  const { strategy_ids } = await request.json() as { strategy_ids: number[] };

  if (!strategy_ids || strategy_ids.length < 2) {
    return Response.json({ error: '至少需要选择2个策略进行对比' }, { status: 400 });
  }

  const db = getDb();
  const strategies: Array<{ id: number; result: StrategyResult }> = [];

  for (const id of strategy_ids.slice(0, 3)) {
    const row = db.prepare('SELECT * FROM strategies WHERE id = ? AND status = ?').get(id, 'completed') as Strategy | undefined;
    if (row?.result) {
      strategies.push({ id, result: JSON.parse(row.result) });
    }
  }

  if (strategies.length < 2) {
    return Response.json({ error: '可用的已完成策略不足2个' }, { status: 400 });
  }

  try {
    const result = await compareStrategies(strategies);

    try {
      db.prepare(
        `INSERT INTO sandbox_scenarios (strategy_id, name, scenario_type, params, result, input_data)
         VALUES (?, ?, 'comparison', ?, ?, ?)`,
      ).run(
        strategy_ids[0],
        `策略对比: ${strategy_ids.length}个策略`,
        JSON.stringify({ strategy_ids }),
        JSON.stringify(result),
        JSON.stringify({ strategy_ids }),
      );
    } catch (e) {
      console.error('[Sandbox Comparison] Save failed:', e);
    }

    return Response.json(result);
  } catch (err) {
    console.error('[Sandbox Comparison] Analysis failed:', err);
    return Response.json({
      strategies: [],
      trade_offs: [],
      recommendation: { preferred_id: strategies[0].id, rationale: 'AI 分析暂时不可用', hybrid_suggestion: '—' },
    });
  }
}
