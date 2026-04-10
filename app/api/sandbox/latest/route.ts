import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();
  const row = db.prepare(
    'SELECT * FROM sandbox_scenarios ORDER BY created_at DESC LIMIT 1',
  ).get() as Record<string, unknown> | undefined;

  if (!row) {
    return Response.json(null);
  }

  return Response.json({
    id: row.id,
    strategy_id: row.strategy_id,
    radar_analysis_id: row.radar_analysis_id,
    name: row.name,
    scenario_type: row.scenario_type || 'resource',
    params: row.params ? JSON.parse(row.params as string) : null,
    result: row.result ? JSON.parse(row.result as string) : null,
    interpretation: row.interpretation ? JSON.parse(row.interpretation as string) : null,
    input_data: row.input_data ? JSON.parse(row.input_data as string) : null,
    created_at: row.created_at,
  });
}
