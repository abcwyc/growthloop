import { getDb } from '@/lib/db';
import { analyzeCompetitionScenario } from '@/lib/sandbox-engine';
import type { Strategy, StrategyResult, CompetitionScenarioInput } from '@/lib/types';

export async function POST(request: Request) {
  const body = await request.json() as CompetitionScenarioInput;

  if (!body.strategy_id || !body.event_type || !body.event_description) {
    return Response.json({ error: 'strategy_id, event_type, event_description required' }, { status: 400 });
  }

  const db = getDb();
  const row = db.prepare('SELECT * FROM strategies WHERE id = ? AND status = ?').get(body.strategy_id, 'completed') as Strategy | undefined;
  if (!row || !row.result) {
    return Response.json({ error: '策略不存在或未完成' }, { status: 404 });
  }

  const strategy: StrategyResult = JSON.parse(row.result);

  try {
    const result = await analyzeCompetitionScenario(strategy, body);

    try {
      db.prepare(
        `INSERT INTO sandbox_scenarios (strategy_id, name, scenario_type, params, result, input_data)
         VALUES (?, ?, 'competition', ?, ?, ?)`,
      ).run(
        body.strategy_id,
        `竞争响应: ${body.event_type}`,
        JSON.stringify({ event_type: body.event_type, severity: body.severity }),
        JSON.stringify(result),
        JSON.stringify(body),
      );
    } catch (e) {
      console.error('[Sandbox Competition] Save failed:', e);
    }

    return Response.json(result);
  } catch (err) {
    console.error('[Sandbox Competition] Analysis failed:', err);
    return Response.json({
      impact_assessment: {
        user_risk: '分析暂时不可用，请稍后重试',
        opportunity: '—',
        urgency: '密切关注',
      },
      response_options: [],
      recommendation: { preferred: '中性', rationale: 'AI 分析暂时不可用', trigger_conditions: '—' },
    });
  }
}
