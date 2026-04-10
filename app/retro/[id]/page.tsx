'use client';

import { useState, useEffect, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import type { Campaign, RetroResult, CsvRow, Strategy } from '@/lib/types';

const PIE_COLORS = ['#ef4444', '#f59e0b', '#6366f1', '#06b6d4', '#8b5cf6'];

function n(v: unknown, digits = 1): string {
  const num = Number(v);
  return isNaN(num) ? String(v ?? '-') : num.toFixed(digits);
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { text: string; cls: string }> = {
    green: { text: '达标', cls: 'bg-green-100 text-green-700' },
    yellow: { text: '偏差', cls: 'bg-amber-100 text-amber-700' },
    red: { text: '不达标', cls: 'bg-red-100 text-red-700' },
    verified: { text: '成立', cls: 'bg-green-100 text-green-700' },
    partial: { text: '部分成立', cls: 'bg-amber-100 text-amber-700' },
    failed: { text: '不成立', cls: 'bg-red-100 text-red-700' },
    '超预期': { text: '超预期', cls: 'bg-green-100 text-green-700' },
    '达标': { text: '达标', cls: 'bg-blue-100 text-blue-700' },
    '低于预期': { text: '低于预期', cls: 'bg-red-100 text-red-700' },
  };
  const s = map[status] || { text: status, cls: 'bg-slate-100 text-slate-600' };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.cls}`}>{s.text}</span>;
}

export default function RetroDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [campaign, setCampaign] = useState<Campaign & { strategy_title?: string; strategy_result?: unknown } | null>(null);
  const [retro, setRetro] = useState<RetroResult | null>(null);
  const [csvData, setCsvData] = useState<CsvRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  const fetchData = async () => {
    const res = await fetch(`/api/retro/${id}`);
    if (!res.ok) { router.push('/retro'); return; }
    const data = await res.json();
    setCampaign(data);
    setCsvData(data.csv_data);
    setRetro(data.retro_result);
    setLoading(false);
    if (data.status === 'analyzing') {
      setGenerating(true);
    } else {
      setGenerating(false);
      if (pollRef.current) clearInterval(pollRef.current);
    }
  };

  useEffect(() => {
    fetchData();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [id]);

  useEffect(() => {
    if (generating && !pollRef.current) {
      pollRef.current = setInterval(fetchData, 3000);
    }
    return () => { if (!generating && pollRef.current) { clearInterval(pollRef.current); pollRef.current = undefined; } };
  }, [generating]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCsvText(reader.result as string);
    reader.readAsText(file);
  };

  const uploadCsv = async () => {
    if (!csvText) return;
    setUploadErrors([]);
    const res = await fetch(`/api/retro/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv_text: csvText }),
    });
    const data = await res.json();
    if (!res.ok) {
      setUploadErrors(data.details || [data.error]);
      return;
    }
    setCsvText('');
    fetchData();
  };

  const generateReport = async () => {
    setGenerating(true);
    await fetch(`/api/retro/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'generate_report' }),
    });
    pollRef.current = setInterval(fetchData, 3000);
  };

  const importAsStrategy = async () => {
    const res = await fetch(`/api/retro/${id}/import-strategy`, { method: 'POST' });
    const data = await res.json();
    if (data.redirect) router.push(data.redirect);
  };

  if (loading) return <div className="text-center py-20 text-slate-400">加载中...</div>;
  if (!campaign) return null;

  const overallStatus = campaign.status;
  const hasCsv = csvData && csvData.length > 0;
  const hasRetro = !!retro;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <button onClick={() => router.push('/retro')} className="text-sm text-slate-500 hover:text-slate-700 mb-1">&larr; 返回列表</button>
          <h1 className="text-2xl font-bold text-slate-900">{campaign.title}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {campaign.period_start} ~ {campaign.period_end}
            {campaign.strategy_title && <span className="ml-3">关联策略: {campaign.strategy_title}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasCsv && !hasRetro && (
            <button
              onClick={generateReport}
              disabled={generating}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {generating ? '生成中...' : '生成复盘报告'}
            </button>
          )}
          {hasRetro && (
            <button
              onClick={importAsStrategy}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
            >
              一键导入为新策略
            </button>
          )}
        </div>
      </div>

      {generating && (
        <div className="card p-4 mb-6 bg-amber-50 border-amber-200">
          <div className="flex items-center gap-2">
            <div className="animate-spin w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full" />
            <span className="text-sm text-amber-700">正在生成复盘报告，请稍候...</span>
          </div>
        </div>
      )}

      {campaign.error_message && (
        <div className="card p-4 mb-6 bg-red-50 border-red-200">
          <p className="text-sm text-red-600">生成失败: {campaign.error_message}</p>
          <button onClick={generateReport} className="mt-2 text-sm text-red-700 underline">重试</button>
        </div>
      )}

      {/* CSV Upload Area */}
      {!hasCsv && (
        <div className="card p-6 mb-6">
          <h2 className="text-lg font-semibold mb-3">上传 Campaign 效果数据</h2>
          <div
            className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors cursor-pointer"
            onClick={() => fileRef.current?.click()}
          >
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
            {csvText ? (
              <div className="text-sm text-green-600">
                CSV 已加载（{csvText.split('\n').length - 1} 行数据）
              </div>
            ) : (
              <div>
                <svg className="mx-auto mb-2 text-slate-400" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <path d="M14 2v6h6" /><path d="M12 18v-6" /><path d="M9 15l3-3 3 3" />
                </svg>
                <p className="text-sm text-slate-500">点击上传 CSV 文件</p>
                <p className="text-xs text-slate-400 mt-1">必要字段: channel, date, impressions, clicks, activations, orders, spend, revenue</p>
              </div>
            )}
          </div>
          {csvText && (
            <button onClick={uploadCsv} className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
              确认上传
            </button>
          )}
          {uploadErrors.length > 0 && (
            <div className="mt-2 p-2 bg-red-50 text-red-600 text-xs rounded">
              {uploadErrors.map((e, i) => <div key={i}>{e}</div>)}
            </div>
          )}
        </div>
      )}

      {/* CSV Data Preview */}
      {hasCsv && !hasRetro && !generating && (
        <div className="card p-4 mb-6">
          <h3 className="text-sm font-medium text-slate-700 mb-2">已上传数据预览（{csvData.length} 行）</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  {['渠道', '日期', '曝光', '点击', '激活', '订单', '花费(万)', '营收(万)'].map(h => (
                    <th key={h} className="px-2 py-1.5 text-left text-slate-500 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {csvData.slice(0, 10).map((r, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="px-2 py-1.5">{r.channel}</td>
                    <td className="px-2 py-1.5">{r.date}</td>
                    <td className="px-2 py-1.5">{r.impressions.toLocaleString()}</td>
                    <td className="px-2 py-1.5">{r.clicks.toLocaleString()}</td>
                    <td className="px-2 py-1.5">{r.activations.toLocaleString()}</td>
                    <td className="px-2 py-1.5">{r.orders.toLocaleString()}</td>
                    <td className="px-2 py-1.5">{r.spend}</td>
                    <td className="px-2 py-1.5">{r.revenue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {csvData.length > 10 && (
              <p className="text-xs text-slate-400 mt-1 px-2">...还有 {csvData.length - 10} 行</p>
            )}
          </div>
        </div>
      )}

      {/* Retro Report */}
      {hasRetro && (
        <div className="space-y-6">
          {/* Overall Summary */}
          <div className="card p-5">
            <h2 className="text-lg font-semibold mb-3">总体概况</h2>
            <div className={`p-4 rounded-lg mb-4 ${
              retro.overall_summary.status === '达成' ? 'bg-green-50' :
              retro.overall_summary.status === '部分达成' ? 'bg-amber-50' : 'bg-red-50'
            }`}>
              <p className="text-sm font-medium">{retro.overall_summary.goal_achievement}</p>
              <p className="text-sm mt-1">{retro.overall_summary.roi_achievement}</p>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center p-3 bg-slate-50 rounded-lg">
                <p className="text-2xl font-bold text-slate-900">{n(retro.overall_summary.total_spend)}</p>
                <p className="text-xs text-slate-500">总花费(万)</p>
              </div>
              <div className="text-center p-3 bg-slate-50 rounded-lg">
                <p className="text-2xl font-bold text-slate-900">{n(retro.overall_summary.total_revenue)}</p>
                <p className="text-xs text-slate-500">总营收(万)</p>
              </div>
              <div className="text-center p-3 bg-slate-50 rounded-lg">
                <p className="text-2xl font-bold text-slate-900">{Number(retro.overall_summary.total_orders || 0).toLocaleString()}</p>
                <p className="text-xs text-slate-500">总订单</p>
              </div>
              <div className="text-center p-3 bg-slate-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-600">
                  {Number(retro.overall_summary.total_spend) > 0
                    ? n(Number(retro.overall_summary.total_revenue) / Number(retro.overall_summary.total_spend), 2)
                    : '-'}x
                </p>
                <p className="text-xs text-slate-500">整体ROI</p>
              </div>
            </div>
          </div>

          {/* Funnel Breakdown */}
          <div className="card p-5">
            <h2 className="text-lg font-semibold mb-3">漏斗拆解</h2>
            <div className="space-y-3">
              {retro.funnel_breakdown?.map((f, i) => (
                <div key={i} className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg">
                  <div className="w-32 text-sm font-medium text-slate-700">{f.stage}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-slate-200 rounded-full h-3 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            f.status === 'green' ? 'bg-green-500' :
                            f.status === 'yellow' ? 'bg-amber-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${Math.min(Math.max((Number(f.actual_rate) / (Number(f.target_rate) || 1)) * 100, 5), 100)}%` }}
                        />
                      </div>
                      <span className="text-sm font-mono w-16 text-right">
                        {n(Number(f.actual_rate) * 100)}%
                      </span>
                      <span className="text-xs text-slate-400 w-20">
                        目标 {n(Number(f.target_rate) * 100)}%
                      </span>
                      <StatusBadge status={f.status} />
                    </div>
                    {f.hypothesis && (
                      <p className="text-xs text-slate-500 mt-1">{f.hypothesis}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Channel Performance */}
          <div className="card p-5">
            <h2 className="text-lg font-semibold mb-3">渠道表现</h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={retro.channel_performance?.map(c => ({
                    name: c.channel,
                    actual: c.actual_roi,
                    target: c.target_roi,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="actual" fill="#3b82f6" name="实际ROI" />
                    <Bar dataKey="target" fill="#94a3b8" name="目标ROI" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={retro.channel_performance?.map(c => ({
                    name: c.channel,
                    spend: c.spend,
                    revenue: c.revenue,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="spend" fill="#f59e0b" name="花费(万)" />
                    <Bar dataKey="revenue" fill="#10b981" name="营收(万)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="space-y-2">
              {retro.channel_performance?.map((c, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                  <div className="w-24 text-sm font-medium text-slate-700">{c.channel}</div>
                  <StatusBadge status={c.status} />
                  <div className="flex-1">
                    <p className="text-sm text-slate-600">ROI {n(c.actual_roi, 2)} (目标 {n(c.target_roi, 2)}, {Number(c.delta_pct) > 0 ? '+' : ''}{n(c.delta_pct, 0)}%)</p>
                    <p className="text-xs text-slate-500 mt-0.5">{c.insight}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Attribution */}
          <div className="card p-5">
            <h2 className="text-lg font-semibold mb-3">归因分析</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={retro.attribution?.map(a => ({ name: a.category, value: a.weight }))}
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      dataKey="value"
                      label={({ name, value }) => `${name} ${value}%`}
                    >
                      {retro.attribution?.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {retro.attribution?.map((a, i) => (
                  <div key={i} className="p-3 rounded-lg bg-slate-50">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-sm font-medium">{a.category}</span>
                      <span className="text-sm font-bold ml-auto">{a.weight}%</span>
                    </div>
                    <p className="text-xs text-slate-500">{a.evidence}</p>
                    {a.detail && <p className="text-xs text-slate-400 mt-0.5">{a.detail}</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Assumption Validation */}
          {retro.assumption_validation && retro.assumption_validation.length > 0 && (
            <div className="card p-5">
              <h2 className="text-lg font-semibold mb-3">关键假设验证</h2>
              <div className="space-y-3">
                {retro.assumption_validation.map((a, i) => (
                  <div key={i} className="p-4 bg-slate-50 rounded-lg">
                    <div className="flex items-start gap-2 mb-2">
                      <StatusBadge status={a.status} />
                      <span className="text-sm font-medium text-slate-700">{a.statement}</span>
                    </div>
                    <p className="text-sm text-slate-600 ml-6">实际: {a.actual_value}</p>
                    <p className="text-sm text-slate-600 ml-6">{a.conclusion}</p>
                    {a.updated_assumption && (
                      <p className="text-sm text-blue-600 ml-6 mt-1">更新建议: {a.updated_assumption}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Next Round Recommendations */}
          {retro.next_round_recommendations && (
            <div className="card p-5">
              <h2 className="text-lg font-semibold mb-3">下轮建议</h2>

              {retro.next_round_recommendations.budget_reallocation?.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-slate-700 mb-2">渠道预算调整</h3>
                  <div className="space-y-1.5">
                    {retro.next_round_recommendations.budget_reallocation.map((r, i) => (
                      <div key={i} className="flex items-center gap-3 p-2 bg-slate-50 rounded text-sm">
                        <span className="w-24 font-medium">{r.channel}</span>
                        <span className="text-slate-500">{r.current_pct}%</span>
                        <span className="text-slate-400">&rarr;</span>
                        <span className={`font-medium ${r.recommended_pct > r.current_pct ? 'text-green-600' : 'text-red-600'}`}>
                          {r.recommended_pct}%
                        </span>
                        <span className="text-xs text-slate-500 flex-1">{r.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {retro.next_round_recommendations.creative_strategy?.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-slate-700 mb-2">素材策略</h3>
                  <ul className="space-y-1">
                    {retro.next_round_recommendations.creative_strategy.map((s, i) => (
                      <li key={i} className="text-sm text-slate-600 pl-4 relative before:content-[''] before:absolute before:left-0 before:top-2 before:w-2 before:h-2 before:bg-blue-400 before:rounded-full">{s}</li>
                    ))}
                  </ul>
                </div>
              )}

              {retro.next_round_recommendations.audience_strategy?.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-slate-700 mb-2">人群策略</h3>
                  <ul className="space-y-1">
                    {retro.next_round_recommendations.audience_strategy.map((s, i) => (
                      <li key={i} className="text-sm text-slate-600 pl-4 relative before:content-[''] before:absolute before:left-0 before:top-2 before:w-2 before:h-2 before:bg-indigo-400 before:rounded-full">{s}</li>
                    ))}
                  </ul>
                </div>
              )}

              {retro.next_round_recommendations.updated_assumptions?.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-slate-700 mb-2">假设更新</h3>
                  <div className="space-y-1.5">
                    {retro.next_round_recommendations.updated_assumptions.map((a, i) => (
                      <div key={i} className="text-sm p-2 bg-slate-50 rounded">
                        <span className="text-slate-500 line-through">{a.old}</span>
                        <span className="mx-2 text-slate-400">&rarr;</span>
                        <span className="text-blue-600 font-medium">{a.new}</span>
                        <span className="text-xs text-slate-400 ml-2">({a.basis})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-5 pt-4 border-t">
                <button
                  onClick={importAsStrategy}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
                >
                  一键导入为新策略草案 &rarr;
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
