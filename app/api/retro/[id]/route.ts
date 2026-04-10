import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { parseCsv, generateRetroReport } from '@/lib/retro-agent';
import type { Campaign, StrategyResult, CsvRow, Strategy } from '@/lib/types';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const campaign = db.prepare(
    'SELECT c.*, s.title as strategy_title, s.result as strategy_result FROM campaigns c LEFT JOIN strategies s ON c.strategy_id = s.id WHERE c.id = ?',
  ).get(id) as (Campaign & { strategy_title?: string; strategy_result?: string }) | undefined;

  if (!campaign) {
    return NextResponse.json({ error: 'Campaign不存在' }, { status: 404 });
  }

  return NextResponse.json({
    ...campaign,
    csv_data: campaign.csv_data ? JSON.parse(campaign.csv_data) : null,
    retro_result: campaign.retro_result ? JSON.parse(campaign.retro_result) : null,
    strategy_result: campaign.strategy_result ? JSON.parse(campaign.strategy_result) : null,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const db = getDb();

  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id) as Campaign | undefined;
  if (!campaign) {
    return NextResponse.json({ error: 'Campaign不存在' }, { status: 404 });
  }

  if (body.csv_text) {
    const { rows, errors } = parseCsv(body.csv_text);
    if (errors.length > 0 && rows.length === 0) {
      return NextResponse.json({ error: 'CSV解析失败', details: errors }, { status: 400 });
    }
    db.prepare('UPDATE campaigns SET csv_data = ?, status = ? WHERE id = ?')
      .run(JSON.stringify(rows), 'data_uploaded', id);
    return NextResponse.json({ success: true, rowCount: rows.length, errors });
  }

  if (body.action === 'generate_report') {
    const csvData: CsvRow[] = campaign.csv_data ? JSON.parse(campaign.csv_data) : [];
    if (csvData.length === 0) {
      return NextResponse.json({ error: '请先上传CSV数据' }, { status: 400 });
    }

    db.prepare('UPDATE campaigns SET status = ? WHERE id = ?').run('analyzing', id);

    let strategyResult: StrategyResult | null = null;
    if (campaign.strategy_id) {
      const strat = db.prepare('SELECT result FROM strategies WHERE id = ?').get(campaign.strategy_id) as { result: string } | undefined;
      if (strat?.result) {
        try { strategyResult = JSON.parse(strat.result); } catch { /* ignore */ }
      }
    }

    generateRetroReport(csvData, strategyResult)
      .then(result => {
        db.prepare('UPDATE campaigns SET retro_result = ?, status = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(JSON.stringify(result), 'completed', id);
      })
      .catch(err => {
        console.error('[Retro] Report generation failed:', err);
        db.prepare('UPDATE campaigns SET status = ?, error_message = ? WHERE id = ?')
          .run('error', String(err.message || err), id);
      });

    return NextResponse.json({ status: 'analyzing', message: '正在生成复盘报告...' });
  }

  return NextResponse.json({ error: '未知操作' }, { status: 400 });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  db.prepare('DELETE FROM campaigns WHERE id = ?').run(id);
  return NextResponse.json({ success: true });
}
