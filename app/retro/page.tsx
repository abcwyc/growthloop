'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { Campaign, Strategy } from '@/lib/types';

const CSV_TEMPLATE = `channel,date,impressions,clicks,activations,orders,spend,revenue
抖音信息流,2026-07-01,100000,2100,420,189,8.5,17.5
小红书,2026-07-01,50000,1200,180,72,3.2,6.8
DSP联盟,2026-07-01,80000,1600,320,128,6.0,11.2
地推,2026-07-01,0,0,200,90,4.0,5.4`;

export default function RetroListPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Array<Campaign & { strategy_title?: string }>>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const [form, setForm] = useState({
    title: '',
    strategy_id: '',
    period_start: '',
    period_end: '',
    csv_text: '',
  });
  const [creating, setCreating] = useState(false);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/retro').then(r => r.json()),
      fetch('/api/strategy').then(r => r.json()),
    ]).then(([c, s]) => {
      setCampaigns(c);
      setStrategies(s.filter((st: Strategy) => st.status === 'completed'));
      setLoading(false);
    });
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setForm(f => ({ ...f, csv_text: reader.result as string }));
      setCsvErrors([]);
    };
    reader.readAsText(file);
  };

  const handleCreate = async () => {
    if (!form.title || !form.period_start || !form.period_end) return;
    setCreating(true);
    setCsvErrors([]);
    try {
      const res = await fetch('/api/retro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          strategy_id: form.strategy_id ? Number(form.strategy_id) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCsvErrors(data.details || [data.error]);
        return;
      }
      router.push(`/retro/${data.id}`);
    } finally {
      setCreating(false);
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'campaign_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const statusLabel: Record<string, { text: string; color: string }> = {
    draft: { text: '草案', color: 'bg-slate-100 text-slate-600' },
    data_uploaded: { text: '数据已上传', color: 'bg-blue-100 text-blue-700' },
    analyzing: { text: '分析中...', color: 'bg-amber-100 text-amber-700' },
    completed: { text: '已完成', color: 'bg-green-100 text-green-700' },
    error: { text: '失败', color: 'bg-red-100 text-red-700' },
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">复盘</h1>
          <p className="text-sm text-slate-500 mt-1">Campaign 效果数据导入 &rarr; 漏斗归因 + 假设验证 + 下轮建议</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          + 新建 Campaign
        </button>
      </div>

      {showCreate && (
        <div className="card p-5 mb-6 border-2 border-blue-200">
          <h2 className="text-lg font-semibold mb-4">新建 Campaign 复盘</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Campaign 名称 *</label>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="例：Q3 电单车增长 Campaign"
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">关联策略（可选）</label>
              <select
                value={form.strategy_id}
                onChange={e => setForm(f => ({ ...f, strategy_id: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              >
                <option value="">不关联</option>
                {strategies.map(s => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">开始日期 *</label>
              <input
                type="date"
                value={form.period_start}
                onChange={e => setForm(f => ({ ...f, period_start: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">结束日期 *</label>
              <input
                type="date"
                value={form.period_end}
                onChange={e => setForm(f => ({ ...f, period_end: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-700">上传 CSV 效果数据（可稍后上传）</label>
              <button onClick={downloadTemplate} className="text-xs text-blue-600 hover:underline">
                下载 CSV 模板
              </button>
            </div>
            <div
              className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center hover:border-blue-400 transition-colors cursor-pointer"
              onClick={() => fileRef.current?.click()}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileUpload}
              />
              {form.csv_text ? (
                <div className="text-sm text-green-600">
                  CSV 已加载（{form.csv_text.split('\n').length - 1} 行数据）
                  <button
                    onClick={e => { e.stopPropagation(); setForm(f => ({ ...f, csv_text: '' })); }}
                    className="ml-2 text-red-500 hover:underline"
                  >
                    移除
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-slate-500">点击或拖拽上传 CSV 文件</p>
                  <p className="text-xs text-slate-400 mt-1">
                    必要字段: channel, date, impressions, clicks, activations, orders, spend, revenue
                  </p>
                </div>
              )}
            </div>
            {csvErrors.length > 0 && (
              <div className="mt-2 p-2 bg-red-50 text-red-600 text-xs rounded">
                {csvErrors.map((e, i) => <div key={i}>{e}</div>)}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCreate}
              disabled={creating || !form.title || !form.period_start || !form.period_end}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {creating ? '创建中...' : '创建 Campaign'}
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 text-slate-600 bg-slate-100 rounded-lg text-sm hover:bg-slate-200 transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-20 text-slate-400">加载中...</div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-20">
          <svg className="mx-auto mb-4 opacity-30" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 3v18h18" /><path d="M7 16l4-8 4 4 4-6" />
          </svg>
          <p className="text-slate-400">暂无 Campaign 复盘记录</p>
          <p className="text-slate-400 text-sm mt-1">点击上方「新建 Campaign」开始</p>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map(c => {
            const st = statusLabel[c.status] || statusLabel.draft;
            return (
              <div
                key={c.id}
                onClick={() => router.push(`/retro/${c.id}`)}
                className="card p-4 cursor-pointer hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-900">{c.title}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${st.color}`}>{st.text}</span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                      <span>{c.period_start} ~ {c.period_end}</span>
                      {c.strategy_title && <span>关联策略: {c.strategy_title}</span>}
                    </div>
                  </div>
                  <div className="text-slate-400">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
