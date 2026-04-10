import { getDb } from '@/lib/db';
import type { SandboxScenario } from '@/lib/types';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const strategyId = searchParams.get('strategy_id');
  if (!strategyId) {
    return Response.json({ error: 'strategy_id required' }, { status: 400 });
  }

  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM sandbox_scenarios WHERE strategy_id = ? ORDER BY created_at DESC LIMIT 20',
  ).all(Number(strategyId)) as SandboxScenario[];

  return Response.json(rows);
}

export async function POST(request: Request) {
  const { strategy_id, radar_analysis_id, name, params, result, interpretation, scenario_type, input_data } = await request.json();

  if (!strategy_id || !params) {
    return Response.json({ error: 'strategy_id and params required' }, { status: 400 });
  }

  const db = getDb();
  const { lastInsertRowid } = db.prepare(
    `INSERT INTO sandbox_scenarios (strategy_id, radar_analysis_id, name, scenario_type, params, result, interpretation, input_data)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    strategy_id,
    radar_analysis_id || null,
    name || '未命名场景',
    scenario_type || 'resource',
    JSON.stringify(params),
    result ? JSON.stringify(result) : null,
    interpretation ? JSON.stringify(interpretation) : null,
    input_data ? JSON.stringify(input_data) : null,
  );

  return Response.json({ id: Number(lastInsertRowid) });
}
