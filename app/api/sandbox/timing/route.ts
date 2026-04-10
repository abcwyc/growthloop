import { getDb } from '@/lib/db';
import { analyzeTimingScenario } from '@/lib/sandbox-engine';
import type { Strategy, StrategyResult, TimingScenarioInput } from '@/lib/types';

export async function POST(request: Request) {
  const body = await request.json() as TimingScenarioInput;

  if (!body.strategy_id || !body.key_dates || body.key_dates.length === 0) {
    return Response.json({ error: 'strategy_id and key_dates required' }, { status: 400 });
  }

  const db = getDb();
  const row = db.prepare('SELECT * FROM strategies WHERE id = ? AND status = ?').get(body.strategy_id, 'completed') as Strategy | undefined;
  if (!row || !row.result) {
    return Response.json({ error: '策略不存在或未完成' }, { status: 404 });
  }

  const strategy: StrategyResult = JSON.parse(row.result);

  try {
    const result = await analyzeTimingScenario(strategy, body);

    try {
      db.prepare(
        `INSERT INTO sandbox_scenarios (strategy_id, name, scenario_type, params, result, input_data)
         VALUES (?, ?, 'timing', ?, ?, ?)`,
      ).run(
        body.strategy_id,
        `时机推演: ${body.key_dates.length}个关键节点`,
        JSON.stringify({ key_dates: body.key_dates, focus_mode: body.focus_mode }),
        JSON.stringify(result),
        JSON.stringify(body),
      );
    } catch (e) {
      console.error('[Sandbox Timing] Save failed:', e);
    }

    return Response.json(result);
  } catch (err) {
    console.error('[Sandbox Timing] Analysis failed:', err);
    return Response.json({
      optimal_windows: [],
      phase_plan: [],
      recommendation: 'AI 分析暂时不可用，请稍后重试',
    });
  }
}
