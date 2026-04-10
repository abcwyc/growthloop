import { getDb } from '@/lib/db';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { name, url, method, headers, query_params, field_mapping, enabled } = body;

  const db = getDb();
  db.prepare(
    `UPDATE data_sources SET name=?, url=?, method=?, headers=?, query_params=?, field_mapping=?, enabled=?, updated_at=CURRENT_TIMESTAMP
     WHERE id=?`,
  ).run(
    name, url,
    method || 'GET',
    JSON.stringify(headers || {}),
    JSON.stringify(query_params || {}),
    JSON.stringify(field_mapping || {}),
    enabled ? 1 : 0,
    id,
  );

  return Response.json({ success: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  db.prepare('DELETE FROM data_sources WHERE id = ?').run(id);
  return Response.json({ success: true });
}
