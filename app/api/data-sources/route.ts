import { getDb } from '@/lib/db';
import type { DataSource } from '@/lib/types';

export async function GET() {
  const db = getDb();
  const sources = db.prepare('SELECT * FROM data_sources ORDER BY id DESC').all() as DataSource[];
  return Response.json(sources);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { name, url, method, headers, query_params, field_mapping, enabled } = body;

  if (!name || !url) {
    return Response.json({ error: '名称和URL不能为空' }, { status: 400 });
  }

  const db = getDb();
  const result = db.prepare(
    `INSERT INTO data_sources (name, url, method, headers, query_params, field_mapping, enabled)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    name, url,
    method || 'GET',
    JSON.stringify(headers || {}),
    JSON.stringify(query_params || {}),
    JSON.stringify(field_mapping || {}),
    enabled !== undefined ? (enabled ? 1 : 0) : 1,
  );

  return Response.json({ id: result.lastInsertRowid, ...body }, { status: 201 });
}
