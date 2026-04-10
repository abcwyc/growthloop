'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { DataSource } from '@/lib/types';

// ─── Tabs ───
const TABS = [
  { id: 'prompts', label: '专家经验 Prompt' },
  { id: 'sources', label: '数据源配置' },
] as const;
type TabId = (typeof TABS)[number]['id'];

// ─── Prompt 管理 ───
interface PromptRecord {
  id: string; module: string; name: string; description: string;
  content: string; is_default: number; updated_at: string;
}

function PromptsTab() {
  const [prompts, setPrompts] = useState<PromptRecord[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('全部');

  const load = useCallback(async () => {
    const r = await fetch('/api/prompts');
    setPrompts(await r.json());
  }, []);
  useEffect(() => { load(); }, [load]);

  const MODULE_ORDER = ['全部', '全局', '研究', '策略', '沙盘', '复盘'];
  const modules = MODULE_ORDER.filter(m => m === '全部' || prompts.some(p => p.module === m));
  const sortedPrompts = [...prompts].sort((a, b) => MODULE_ORDER.indexOf(a.module) - MODULE_ORDER.indexOf(b.module));
  const filtered = filter === '全部' ? sortedPrompts : sortedPrompts.filter(p => p.module === filter);

  const startEdit = (p: PromptRecord) => { setEditing(p.id); setDraft(p.content); };
  const cancel = () => { setEditing(null); setDraft(''); };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    await fetch('/api/prompts', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editing, content: draft }) });
    setSaving(false);
    setEditing(null);
    load();
  };

  const reset = async (id: string) => {
    if (!confirm('确定恢复为默认 Prompt？你的自定义修改将丢失。')) return;
    await fetch(`/api/prompts?id=${id}`, { method: 'DELETE' });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {modules.map(m => (
          <button key={m} onClick={() => setFilter(m)}
            className={`px-3 py-1 text-sm rounded-lg transition-colors ${filter === m ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >{m}</button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map(p => (
          <div key={p.id} className="card p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">{p.module}</span>
                  <h3 className="text-sm font-bold text-slate-900">{p.name}</h3>
                  {p.is_default === 0 && <span className="text-xs px-1.5 py-0.5 rounded bg-amber-50 text-amber-600">已自定义</span>}
                </div>
                <p className="text-xs text-slate-500 mt-1">{p.description}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {editing !== p.id && (
                  <>
                    <button onClick={() => startEdit(p)} className="text-xs px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">编辑</button>
                    {p.is_default === 0 && <button onClick={() => reset(p.id)} className="text-xs px-2.5 py-1 rounded-md text-amber-600 hover:bg-amber-50 transition-colors">恢复默认</button>}
                  </>
                )}
              </div>
            </div>

            {editing === p.id ? (
              <div className="mt-3 space-y-2">
                <textarea
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  rows={16}
                  className="w-full text-sm font-mono border border-slate-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y bg-slate-50"
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">{draft.length} 字符</span>
                  <div className="flex items-center gap-2">
                    <button onClick={cancel} className="btn-secondary text-xs !py-1.5">取消</button>
                    <button onClick={save} disabled={saving} className="btn-primary text-xs !py-1.5">{saving ? '保存中...' : '保存'}</button>
                  </div>
                </div>
              </div>
            ) : (
              <pre className="mt-2 text-xs text-slate-400 bg-slate-50 rounded-lg p-3 max-h-32 overflow-y-auto whitespace-pre-wrap break-words border border-slate-100">
                {p.content.slice(0, 300)}{p.content.length > 300 ? '...' : ''}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 数据源配置 ───
interface ApiFormData {
  name: string; url: string; method: string; headers: string;
  query_params: string; field_mapping: string; enabled: boolean;
}
const EMPTY_FORM: ApiFormData = {
  name: '', url: '', method: 'GET', headers: '{}', query_params: '{}',
  field_mapping: JSON.stringify({ dataPath: 'data.results', content: 'content', score: 'score', date: 'date', url: 'url', brand: 'brand', source: 'source', likes: 'likes', urlPrefix: '' }, null, 2),
  enabled: true,
};

interface XhsStatus { loggedIn: boolean; username?: string }
interface BatchInfo { batch_id: string; app_name: string; brand: string; platform: string; count: number; uploaded_at: string; }

const PROXY_BASE = '/api/reviewmine';
function getStartPage() { return `${PROXY_BASE}/analysis-results/290?_t=${Date.now()}`; }

const SOURCE_TYPES = [
  { id: 'api',    label: '接口查询',   desc: '通过 HTTP API 采集数据（微博等）' },
  { id: 'crawl',  label: '页面爬取',   desc: '扫码登录后爬取平台页面数据（小红书等）' },
  { id: 'import', label: '数据导入',   desc: '导入 Excel 文件或第三方平台数据（App Store 等）' },
] as const;
type SourceType = (typeof SOURCE_TYPES)[number]['id'];

function SourcesTab() {
  const [sourceType, setSourceType] = useState<SourceType>('api');

  // ── 接口查询 state ──
  const [sources, setSources] = useState<DataSource[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ApiFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // ── 页面爬取 state ──
  const [xhsStatus, setXhsStatus] = useState<XhsStatus | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginMsg, setLoginMsg] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── 数据导入 state ──
  const [importMode, setImportMode] = useState<'upload' | 'reviewmine'>('upload');
  const [batches, setBatches] = useState<BatchInfo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [brand, setBrand] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [tokenSaved, setTokenSaved] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [savingToken, setSavingToken] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // ── data loading ──
  const loadSources = async () => {
    try { const r = await fetch('/api/data-sources'); setSources(await r.json()); } catch {}
  };
  const checkXhsStatus = useCallback(async () => {
    try { const r = await fetch('/api/xiaohongshu/status'); setXhsStatus(await r.json()); }
    catch { setXhsStatus({ loggedIn: false }); }
  }, []);
  const loadBatches = useCallback(async () => {
    try { const r = await fetch('/api/radar/upload-reviews'); setBatches(await r.json()); } catch {}
  }, []);
  const checkToken = useCallback(async () => {
    try { const r = await fetch(`${PROXY_BASE}/cookie`); const data = await r.json(); setTokenSaved(data.saved); } catch {}
  }, []);

  useEffect(() => {
    loadSources(); checkXhsStatus(); loadBatches(); checkToken();
  }, [checkXhsStatus, loadBatches, checkToken]);

  // ── 接口查询 handlers ──
  const openNew = () => { setForm(EMPTY_FORM); setEditingId(null); setShowForm(true); };
  const openEdit = (src: DataSource) => {
    setForm({ name: src.name, url: src.url, method: src.method, headers: src.headers, query_params: src.query_params, field_mapping: src.field_mapping, enabled: src.enabled === 1 });
    setEditingId(src.id); setShowForm(true);
  };
  const saveSource = async () => {
    setSaving(true);
    try {
      const body = { ...form, headers: JSON.parse(form.headers), query_params: JSON.parse(form.query_params), field_mapping: JSON.parse(form.field_mapping) };
      if (editingId) await fetch(`/api/data-sources/${editingId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      else await fetch('/api/data-sources', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      setShowForm(false); loadSources();
    } catch { alert('JSON格式错误，请检查'); }
    finally { setSaving(false); }
  };
  const removeSource = async (id: number) => {
    if (!confirm('确定删除此数据源？')) return;
    await fetch(`/api/data-sources/${id}`, { method: 'DELETE' }); loadSources();
  };

  // ── 页面爬取 handlers ──
  const startXhsLogin = async () => {
    setLoginLoading(true); setLoginMsg('正在加载二维码...'); setQrCode(null); setShowQr(true);
    try {
      const r = await fetch('/api/xiaohongshu/login', { method: 'POST' });
      const data = await r.json();
      if (data.qrCode) { setQrCode(data.qrCode); setLoginMsg('请使用小红书 App 扫描二维码'); startPolling(); }
      else setLoginMsg('获取二维码失败，请重试');
    } catch { setLoginMsg('连接失败，请检查服务器'); }
    finally { setLoginLoading(false); }
  };
  const startPolling = () => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch('/api/xiaohongshu/login/status');
        const data = await r.json();
        if (data.status === 'success') { stopPolling(); setShowQr(false); setXhsStatus({ loggedIn: true, username: data.username }); }
        else if (data.status === 'expired') { stopPolling(); setLoginMsg('二维码已过期，请重新获取'); setQrCode(null); }
      } catch {}
    }, 2500);
  };
  const stopPolling = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  const disconnectXhs = async () => { await fetch('/api/xiaohongshu/status', { method: 'DELETE' }); setXhsStatus({ loggedIn: false }); };
  const closeQrModal = () => { stopPolling(); setShowQr(false); };

  // ── 数据导入 handlers ──
  const handleUpload = async (file: File) => {
    setUploading(true); setUploadResult(null); setUploadError(null);
    const fd = new FormData(); fd.append('file', file);
    if (brand.trim()) fd.append('brand', brand.trim());
    try {
      const r = await fetch('/api/radar/upload-reviews', { method: 'POST', body: fd });
      const data = await r.json();
      if (r.ok) { setUploadResult(`导入成功: ${data.count} 条评论`); loadBatches(); }
      else setUploadError(data.error || '导入失败');
    } catch { setUploadError('网络错误'); }
    finally { setUploading(false); }
  };
  const deleteBatch = async (batchId: string) => {
    if (!confirm('确定删除此批次？')) return;
    await fetch(`/api/radar/upload-reviews?batch_id=${batchId}`, { method: 'DELETE' }); loadBatches();
  };
  const saveRmToken = async () => {
    if (!tokenInput.trim()) return;
    setSavingToken(true);
    await fetch(`${PROXY_BASE}/cookie`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: tokenInput.trim() }) });
    setTokenSaved(true); setSavingToken(false); setTokenInput('');
    if (iframeRef.current) iframeRef.current.src = getStartPage();
  };
  const clearRmToken = async () => { await fetch(`${PROXY_BASE}/cookie`, { method: 'DELETE' }); setTokenSaved(false); };

  return (
    <div className="space-y-5">
      {/* 子菜单 */}
      <div className="flex items-center gap-2">
        {SOURCE_TYPES.map(t => (
          <button key={t.id} onClick={() => setSourceType(t.id)}
            className={`px-3.5 py-1.5 text-sm rounded-lg transition-colors ${sourceType === t.id ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >{t.label}</button>
        ))}
      </div>
      <p className="text-xs text-slate-400 -mt-2">{SOURCE_TYPES.find(t => t.id === sourceType)?.desc}</p>

      {/* ════ 接口查询 ════ */}
      {sourceType === 'api' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">HTTP API 数据源</h3>
            <button onClick={openNew} className="btn-primary text-xs !py-1.5">+ 添加数据源</button>
          </div>

          {sources.length === 0 ? (
            <div className="card p-8 text-center text-sm text-slate-500">暂无自定义数据源，系统将使用内置 Demo 数据</div>
          ) : (
            <div className="space-y-2">
              {sources.map(src => (
                <div key={src.id} className="card p-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-slate-900">{src.name}</div>
                    <div className="text-xs text-slate-500 font-mono">{src.method} {src.url.slice(0, 60)}{src.url.length > 60 ? '...' : ''}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEdit(src)} className="text-xs text-blue-600 hover:underline">编辑</button>
                    <button onClick={() => removeSource(src.id)} className="text-xs text-red-500 hover:underline">删除</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {showForm && (
            <div className="card p-4 space-y-3 border-blue-200">
              <h4 className="text-sm font-bold text-slate-900">{editingId ? '编辑数据源' : '新增数据源'}</h4>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="数据源名称" className="w-full border rounded-lg px-3 py-2 text-sm" />
              <div className="flex gap-2">
                <select value={form.method} onChange={e => setForm({ ...form, method: e.target.value })} className="border rounded-lg px-3 py-2 text-sm">
                  <option>GET</option><option>POST</option>
                </select>
                <input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="API URL" className="flex-1 border rounded-lg px-3 py-2 text-sm font-mono" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Headers (JSON)</label>
                  <textarea value={form.headers} onChange={e => setForm({ ...form, headers: e.target.value })} rows={3} className="w-full border rounded-lg px-3 py-2 text-xs font-mono" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Query Params (JSON)</label>
                  <textarea value={form.query_params} onChange={e => setForm({ ...form, query_params: e.target.value })} rows={3} className="w-full border rounded-lg px-3 py-2 text-xs font-mono" />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">字段映射 (JSON)</label>
                <textarea value={form.field_mapping} onChange={e => setForm({ ...form, field_mapping: e.target.value })} rows={4} className="w-full border rounded-lg px-3 py-2 text-xs font-mono" />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button onClick={() => setShowForm(false)} className="btn-secondary text-xs !py-1.5">取消</button>
                <button onClick={saveSource} disabled={saving} className="btn-primary text-xs !py-1.5">{saving ? '保存中...' : '保存'}</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════ 页面爬取 ════ */}
      {sourceType === 'crawl' && (
        <div className="space-y-4">
          <div className="card p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center text-red-500 font-bold text-sm">小</div>
                <div>
                  <div className="text-sm font-bold text-slate-900">小红书</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {xhsStatus?.loggedIn
                      ? <span className="text-emerald-600">已连接{xhsStatus.username ? ` · ${xhsStatus.username}` : ''}</span>
                      : '扫码登录后，系统可自动采集小红书搜索结果页面数据'}
                  </div>
                </div>
              </div>
              {xhsStatus?.loggedIn
                ? <button onClick={disconnectXhs} className="btn-danger text-xs !py-1.5">断开连接</button>
                : <button onClick={startXhsLogin} disabled={loginLoading} className="btn-primary text-xs !py-1.5">{loginLoading ? '加载中...' : '扫码登录'}</button>
              }
            </div>
          </div>

          <div className="card p-4 bg-slate-50 border-slate-200">
            <p className="text-xs text-slate-500 leading-relaxed">
              小红书数据源通过模拟浏览器登录采集公开搜索结果，登录后系统会自动在竞品研究时查询小红书数据。
              采集范围仅限公开可见的笔记摘要信息（标题、内容预览、点赞数），不涉及用户隐私数据。
            </p>
          </div>

          {showQr && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={closeQrModal}>
              <div className="bg-white rounded-xl p-6 shadow-xl max-w-sm w-full" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-slate-900 mb-3">小红书扫码登录</h3>
                <p className="text-sm text-slate-500 mb-4">{loginMsg}</p>
                {qrCode && <img src={qrCode} alt="QR Code" className="w-48 h-48 mx-auto border rounded-lg" />}
                <button onClick={closeQrModal} className="btn-secondary w-full mt-4 text-sm">关闭</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════ 数据导入 ════ */}
      {sourceType === 'import' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <button onClick={() => setImportMode('upload')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${importMode === 'upload' ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >Excel 导入</button>
            <button onClick={() => setImportMode('reviewmine')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${importMode === 'reviewmine' ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >ReviewMine</button>
          </div>

          {importMode === 'upload' && (
            <div className="space-y-4">
              <div className="card p-4 space-y-3">
                <h4 className="text-sm font-bold text-slate-900">导入 App Store 评论</h4>
                <input value={brand} onChange={e => setBrand(e.target.value)} placeholder="品牌名称（可选，如：哈啰单车）" className="w-full border rounded-lg px-3 py-2 text-sm" />
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e: React.DragEvent) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files[0]) handleUpload(e.dataTransfer.files[0]); }}
                  onClick={() => fileRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${dragOver ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}
                >
                  <p className="text-sm text-slate-500">{uploading ? '上传中...' : '点击或拖拽 Excel 文件到此处'}</p>
                  <p className="text-xs text-slate-400 mt-1">支持 .xlsx / .xls 格式</p>
                </div>
                <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => { if (e.target.files?.[0]) handleUpload(e.target.files[0]); }} />
                {uploadResult && <p className="text-sm text-emerald-600">{uploadResult}</p>}
                {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}
              </div>

              {batches.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">已导入批次 ({batches.length})</h4>
                  {batches.map(b => (
                    <div key={b.batch_id} className="card p-3 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-slate-900">{b.app_name} {b.brand && `· ${b.brand}`}</div>
                        <div className="text-xs text-slate-500">{b.count} 条 · {b.platform} · {new Date(b.uploaded_at).toLocaleDateString('zh-CN')}</div>
                      </div>
                      <button onClick={() => deleteBatch(b.batch_id)} className="text-xs text-red-500 hover:underline">删除</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {importMode === 'reviewmine' && (
            <div className="space-y-3">
              <div className="card p-4 bg-slate-50 border-slate-200">
                <p className="text-xs text-slate-500 leading-relaxed">
                  ReviewMine 是第三方 App Store 评论分析平台。配置 Token 后，可直接在此浏览和筛选应用商店评论数据。
                  <a href="https://reviewmine.app/app-selection" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline ml-1">获取 Token →</a>
                </p>
              </div>
              {!tokenSaved ? (
                <div className="card p-4 space-y-3">
                  <div className="flex gap-2">
                    <input value={tokenInput} onChange={e => setTokenInput(e.target.value)} type="password" placeholder="ReviewMine auth_token" className="flex-1 border rounded-lg px-3 py-2 text-sm font-mono" />
                    <button onClick={saveRmToken} disabled={savingToken} className="btn-primary text-xs !py-1.5">{savingToken ? '保存中...' : '保存 Token'}</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-emerald-600">Token 已配置</span>
                    <button onClick={clearRmToken} className="text-xs text-red-500 hover:underline">清除 Token</button>
                  </div>
                  <iframe ref={iframeRef} src={getStartPage()} className="w-full h-[600px] rounded-xl border border-slate-200" />
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── 主页面 ───
export default function SettingsPage() {
  const [tab, setTab] = useState<TabId>('prompts');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">设置</h1>
        <p className="text-sm text-slate-500 mt-1">管理数据源配置和专家经验 Prompt</p>
      </div>

      <div className="flex items-center gap-1 border-b border-slate-200">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'prompts' && <PromptsTab />}
      {tab === 'sources' && <SourcesTab />}
    </div>
  );
}
