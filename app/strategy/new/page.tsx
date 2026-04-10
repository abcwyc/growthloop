'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { OpportunityData } from '@/lib/types';

const METRICS = ['DAU', '新增订单', 'GMV', '品牌曝光', '自定义'] as const;

interface LinkedOpportunity extends OpportunityData {
  id: number;
}

interface RadarHistoryItem {
  id: number;
  brands: string[];
  dateRange: { start: string; end: string };
  status: string;
  totalItems: number;
  createdAt: string;
}

interface UploadedDoc {
  fileName: string;
  fileType: string;
  textLength: number;
  truncated: boolean;
  text: string;
  preview: string;
}

export default function NewStrategyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [goal, setGoal] = useState('');
  const [metric, setMetric] = useState<string>('DAU');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [budget, setBudget] = useState('');
  const [roiFloor, setRoiFloor] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [linkedOpps, setLinkedOpps] = useState<LinkedOpportunity[]>([]);

  const [radarHistory, setRadarHistory] = useState<RadarHistoryItem[]>([]);
  const [selectedRadarId, setSelectedRadarId] = useState<number | null>(null);
  const [radarPreview, setRadarPreview] = useState<{
    sentiment: { positive: number; neutral: number; negative: number } | null;
    topicCount: number;
    negativeCount: number;
    oppCount: number;
  } | null>(null);

  const [competitors, setCompetitors] = useState<string[]>([]);
  const [competitorInput, setCompetitorInput] = useState('');
  const [ownBrand, setOwnBrand] = useState('');
  const [marketBackground, setMarketBackground] = useState('');

  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/radar/analyze')
      .then(r => r.json())
      .then((data: RadarHistoryItem[]) => {
        setRadarHistory(data.filter(h => h.status === 'completed'));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const oppId = searchParams.get('opp');
    const analysisId = searchParams.get('analysis');
    if (oppId && analysisId) {
      setSelectedRadarId(Number(analysisId));
      fetch(`/api/radar/analyze/${analysisId}`)
        .then(r => r.json())
        .then(data => {
          if (data.opportunities) {
            const opp = data.opportunities.find((_: OpportunityData, idx: number) => String(idx) === oppId);
            if (opp) {
              setLinkedOpps([{ ...opp, id: Number(oppId) }]);
              setGoal(prev => prev || `基于竞品洞察「${opp.title}」制定增长策略`);
            }
          }
        })
        .catch(() => {});
    }

    const oppIds = searchParams.get('opp_ids');
    if (oppIds) {
      const ids = oppIds.split(',').map(Number).filter(Boolean);
      if (ids.length > 0) {
        fetch(`/api/strategy/opportunities?ids=${ids.join(',')}`)
          .then(r => r.json())
          .then((data: LinkedOpportunity[]) => {
            setLinkedOpps(data);
            if (data.length > 0 && !goal) {
              setGoal(`基于 ${data.length} 个竞品机会点制定增长策略`);
            }
          })
          .catch(() => {});
      }
    }

    const today = new Date();
    const qStart = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3 + 3, 1);
    const qEnd = new Date(qStart.getFullYear(), qStart.getMonth() + 3, 0);
    setPeriodStart(qStart.toISOString().split('T')[0]);
    setPeriodEnd(qEnd.toISOString().split('T')[0]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleRadarSelect(id: number) {
    setSelectedRadarId(id);
    setRadarPreview(null);
    fetch(`/api/radar/analyze/${id}`)
      .then(r => r.json())
      .then(data => {
        setRadarPreview({
          sentiment: data.sentiment ? { positive: data.sentiment.positive, neutral: data.sentiment.neutral, negative: data.sentiment.negative } : null,
          topicCount: data.topics?.topics?.length || 0,
          negativeCount: data.topNegative?.items?.length || 0,
          oppCount: data.opportunities?.length || 0,
        });
      })
      .catch(() => {});
  }

  async function handleFileUpload(file: File) {
    setUploadError('');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/strategy/upload-doc', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { setUploadError(data.error || '上传失败'); return; }
      setUploadedDocs(prev => [...prev, data as UploadedDoc]);
    } catch {
      setUploadError('上传失败，请重试');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function removeDoc(idx: number) {
    setUploadedDocs(prev => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!goal.trim()) return;
    setSubmitting(true);
    try {
      const docContext = uploadedDocs.length > 0
        ? uploadedDocs.map(d => `【${d.fileName}】\n${d.text}`).join('\n\n---\n\n')
        : undefined;
      const res = await fetch('/api/strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_goal: goal,
          core_metric: metric,
          period: { start: periodStart, end: periodEnd },
          budget_total: Number(budget) || 100,
          roi_floor: Number(roiFloor) || 1.5,
          opportunity_ids: linkedOpps.map(o => o.id),
          radar_analysis_id: selectedRadarId,
          document_context: docContext,
          competitors: competitors.length > 0 ? competitors : undefined,
          own_brand: ownBrand || undefined,
          market_background: marketBackground || undefined,
        }),
      });
      const data = await res.json();
      router.push(`/strategy/${data.id}`);
    } catch {
      setSubmitting(false);
    }
  }

  function removeOpp(idx: number) {
    setLinkedOpps(prev => prev.filter((_, i) => i !== idx));
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <button onClick={() => router.push('/strategy')} className="text-sm text-slate-500 hover:text-slate-700">
          &larr; 返回策略列表
        </button>
        <h1 className="text-2xl font-bold text-slate-900 mt-2">新建营销策略</h1>
        <p className="text-sm text-slate-500 mt-1">输入业务目标和约束条件，AI 将生成结构化策略卡片</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Linked opportunities */}
        {linkedOpps.length > 0 && (
          <div className="card p-4">
            <label className="block text-xs font-medium text-slate-500 mb-2">关联竞品机会点</label>
            <div className="space-y-2">
              {linkedOpps.map((opp, idx) => (
                <div key={idx} className="flex items-start gap-2 p-2.5 bg-blue-50 rounded-lg border border-blue-100">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-blue-900">{opp.title}</p>
                    <p className="text-xs text-blue-700 mt-0.5 truncate">{opp.description}</p>
                  </div>
                  <button type="button" onClick={() => removeOpp(idx)} className="text-blue-400 hover:text-blue-600 text-xs shrink-0">
                    移除
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Radar analysis context */}
        <div className="card p-4">
          <label className="block text-xs font-medium text-slate-500 mb-2">引用竞品雷达数据（可选）</label>
          <select
            value={selectedRadarId ?? ''}
            onChange={e => {
              const v = e.target.value;
              if (v) handleRadarSelect(Number(v));
              else { setSelectedRadarId(null); setRadarPreview(null); }
            }}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">不引用雷达数据</option>
            {radarHistory.map(h => (
              <option key={h.id} value={h.id}>
                #{h.id} {h.brands.slice(0, 3).join('/')}{h.brands.length > 3 ? `+${h.brands.length - 3}` : ''} — {h.totalItems}条数据 ({h.dateRange.start}~{h.dateRange.end})
              </option>
            ))}
          </select>
          {selectedRadarId && radarPreview && (
            <div className="mt-2 flex flex-wrap gap-2">
              {radarPreview.sentiment && (
                <span className="inline-flex items-center gap-1 text-[11px] px-2 py-1 bg-emerald-50 text-emerald-700 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  正面 {radarPreview.sentiment.positive}
                  <span className="mx-0.5 text-slate-300">|</span>
                  中性 {radarPreview.sentiment.neutral}
                  <span className="mx-0.5 text-slate-300">|</span>
                  负面 {radarPreview.sentiment.negative}
                </span>
              )}
              {radarPreview.topicCount > 0 && (
                <span className="text-[11px] px-2 py-1 bg-blue-50 text-blue-700 rounded-full">{radarPreview.topicCount} 个话题</span>
              )}
              {radarPreview.negativeCount > 0 && (
                <span className="text-[11px] px-2 py-1 bg-red-50 text-red-700 rounded-full">{radarPreview.negativeCount} 个差评洞察</span>
              )}
              {radarPreview.oppCount > 0 && (
                <span className="text-[11px] px-2 py-1 bg-amber-50 text-amber-700 rounded-full">{radarPreview.oppCount} 个机会点</span>
              )}
            </div>
          )}
          {selectedRadarId && !radarPreview && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
              <span className="w-3 h-3 border-2 border-slate-300/50 border-t-slate-400 rounded-full animate-spin" />
              加载中...
            </div>
          )}
        </div>

        {/* Document upload — hidden */}
        {false && <div className="card p-4">
          <label className="block text-xs font-medium text-slate-500 mb-2">上传参考文档（可选）</label>
          <p className="text-xs text-slate-400 mb-3">支持 PDF、Word、Excel、TXT、Markdown，文档内容将作为策略生成的上下文</p>

          {uploadedDocs.length > 0 && (
            <div className="space-y-2 mb-3">
              {uploadedDocs.map((doc, idx) => (
                <div key={idx} className="flex items-start gap-2 p-2.5 bg-violet-50 rounded-lg border border-violet-100">
                  <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-violet-600 uppercase">{doc.fileType}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-violet-900 truncate">{doc.fileName}</p>
                    <p className="text-xs text-violet-600 mt-0.5">
                      {(doc.textLength / 1000).toFixed(1)}k 字符
                      {doc.truncated && <span className="text-amber-600 ml-1">（已截断）</span>}
                    </p>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">{doc.preview}</p>
                  </div>
                  <button type="button" onClick={() => removeDoc(idx)} className="text-violet-400 hover:text-violet-600 text-xs shrink-0">
                    移除
                  </button>
                </div>
              ))}
            </div>
          )}

          <div
            className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center hover:border-violet-300 hover:bg-violet-50/30 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-violet-400', 'bg-violet-50'); }}
            onDragLeave={e => { e.currentTarget.classList.remove('border-violet-400', 'bg-violet-50'); }}
            onDrop={e => {
              e.preventDefault();
              e.currentTarget.classList.remove('border-violet-400', 'bg-violet-50');
              const file = e.dataTransfer.files[0];
              if (file) handleFileUpload(file);
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.txt,.md"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
              }}
            />
            {uploading ? (
              <div className="flex items-center justify-center gap-2 text-sm text-violet-600">
                <span className="w-4 h-4 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" />
                解析文档中...
              </div>
            ) : (
              <div>
                <svg className="mx-auto mb-1.5 text-slate-400" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <line x1="9" y1="15" x2="15" y2="15" />
                </svg>
                <p className="text-sm text-slate-500">点击或拖拽上传文档</p>
                <p className="text-xs text-slate-400 mt-0.5">PDF / Word / Excel / TXT / Markdown</p>
              </div>
            )}
          </div>
          {uploadError && <p className="text-xs text-red-500 mt-2">{uploadError}</p>}
        </div>}

        {/* Business goal */}
        <div className="card p-4">
          <label className="block text-xs font-medium text-slate-500 mb-2">业务目标 *</label>
          <textarea
            value={goal}
            onChange={e => setGoal(e.target.value)}
            placeholder="例：Q3 电单车城市 DAU 提升 15%，预算 300 万，ROI 不低于 1.8"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            rows={3}
            required
          />
        </div>

        {/* Competition & Market Context */}
        <div className="card p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-2">本品名称（可选）</label>
            <input
              type="text"
              value={ownBrand}
              onChange={e => setOwnBrand(e.target.value)}
              placeholder="例：哈啰租车"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-2">主要竞品（可选）</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={competitorInput}
                onChange={e => setCompetitorInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && competitorInput.trim()) {
                    e.preventDefault();
                    setCompetitors(prev => [...prev, competitorInput.trim()]);
                    setCompetitorInput('');
                  }
                }}
                placeholder="输入竞品名称后回车添加"
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => {
                  if (competitorInput.trim()) {
                    setCompetitors(prev => [...prev, competitorInput.trim()]);
                    setCompetitorInput('');
                  }
                }}
                className="btn-secondary text-xs px-3"
              >
                添加
              </button>
            </div>
            {competitors.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {competitors.map((c, idx) => (
                  <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 bg-orange-50 text-orange-700 rounded-lg text-xs">
                    {c}
                    <button type="button" onClick={() => setCompetitors(prev => prev.filter((_, i) => i !== idx))} className="text-orange-400 hover:text-orange-600">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-2">市场背景描述（可选）</label>
            <textarea
              value={marketBackground}
              onChange={e => setMarketBackground(e.target.value)}
              placeholder="例：当前市场竞品格局、用户增长趋势、季节性特征等。提供越多背景信息，生成的策略越精准"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={3}
            />
          </div>
        </div>

        {/* Core metric + Period */}
        <div className="card p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-2">核心指标</label>
            <select
              value={metric}
              onChange={e => setMetric(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {METRICS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-2">开始日期</label>
            <input
              type="date"
              value={periodStart}
              onChange={e => setPeriodStart(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-2">结束日期</label>
            <input
              type="date"
              value={periodEnd}
              onChange={e => setPeriodEnd(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Budget + ROI */}
        <div className="card p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-2">预算总额（万元）</label>
            <input
              type="number"
              value={budget}
              onChange={e => setBudget(e.target.value)}
              placeholder="300"
              min={1}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-2">ROI 底线</label>
            <input
              type="number"
              value={roiFloor}
              onChange={e => setRoiFloor(e.target.value)}
              placeholder="1.8"
              step={0.1}
              min={0}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={submitting || !goal.trim()}
            className="btn-primary px-6 py-2.5"
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                策略生成中...
              </span>
            ) : '生成策略'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/strategy')}
            className="btn-secondary"
          >
            取消
          </button>
        </div>
      </form>
    </div>
  );
}
