'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { DataSource } from '@/lib/types';

interface FormData {
  name: string;
  url: string;
  method: string;
  headers: string;
  query_params: string;
  field_mapping: string;
  enabled: boolean;
}

const EMPTY_FORM: FormData = {
  name: '', url: '', method: 'GET',
  headers: '{}', query_params: '{}',
  field_mapping: JSON.stringify({ dataPath: 'data.results', content: 'content', score: 'score', date: 'date', url: 'url', brand: 'brand', source: 'source', likes: 'likes', urlPrefix: '' }, null, 2),
  enabled: true,
};

/* ---- Xiaohongshu connection state ---- */
interface XhsStatus { loggedIn: boolean; username?: string }

function useXhsConnection() {
  const [status, setStatus] = useState<XhsStatus | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginMsg, setLoginMsg] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkStatus = useCallback(async () => {
    try {
      const r = await fetch('/api/xiaohongshu/status');
      const data = await r.json();
      setStatus(data);
    } catch {
      setStatus({ loggedIn: false });
    }
  }, []);

  useEffect(() => { checkStatus(); }, [checkStatus]);

  const startLogin = async () => {
    setLoginLoading(true);
    setLoginMsg('正在加载二维码...');
    setQrCode(null);
    setShowQr(true);
    try {
      const r = await fetch('/api/xiaohongshu/login', { method: 'POST' });
      const data = await r.json();
      if (data.qrCode) {
        setQrCode(data.qrCode);
        setLoginMsg('请使用小红书 App 扫描二维码');
        startPolling();
      } else {
        setLoginMsg('获取二维码失败，请重试');
      }
    } catch {
      setLoginMsg('连接失败，请检查服务器');
    } finally {
      setLoginLoading(false);
    }
  };

  const startPolling = () => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch('/api/xiaohongshu/login/status');
        const data = await r.json();
        if (data.status === 'success') {
          stopPolling();
          setShowQr(false);
          setStatus({ loggedIn: true, username: data.username });
        } else if (data.status === 'expired') {
          stopPolling();
          setLoginMsg('二维码已过期，请重新获取');
          setQrCode(null);
        }
      } catch { /* continue polling */ }
    }, 2500);
  };

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const disconnect = async () => {
    await fetch('/api/xiaohongshu/status', { method: 'DELETE' });
    setStatus({ loggedIn: false });
  };

  const closeQr = () => { stopPolling(); setShowQr(false); };

  return { status, qrCode, showQr, loginLoading, loginMsg, startLogin, disconnect, closeQr, checkStatus };
}

export default function DataSourcesPage() {
  const [sources, setSources] = useState<DataSource[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const xhs = useXhsConnection();

  const loadSources = async () => {
    try {
      const r = await fetch('/api/data-sources');
      const data = await r.json();
      setSources(data);
    } catch (e) {
      console.error('[Sources] fetch failed:', e);
    }
  };

  useEffect(() => { loadSources(); }, []);

  const openNew = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (src: DataSource) => {
    setForm({
      name: src.name,
      url: src.url,
      method: src.method,
      headers: src.headers,
      query_params: src.query_params,
      field_mapping: src.field_mapping,
      enabled: src.enabled === 1,
    });
    setEditingId(src.id);
    setShowForm(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const body = {
        ...form,
        headers: JSON.parse(form.headers),
        query_params: JSON.parse(form.query_params),
        field_mapping: JSON.parse(form.field_mapping),
      };

      if (editingId) {
        await fetch(`/api/data-sources/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        await fetch('/api/data-sources', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }
      setShowForm(false);
      loadSources();
    } catch (e) {
      alert('JSON格式错误，请检查');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    if (!confirm('确定删除此数据源？')) return;
    await fetch(`/api/data-sources/${id}`, { method: 'DELETE' });
    loadSources();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">数据源配置</h1>
          <p className="text-sm text-slate-500 mt-1">配置可接入的HTTP API数据源，用于竞品数据采集</p>
        </div>
        <button onClick={openNew} className="btn-primary text-sm">+ 新增数据源</button>
      </div>

      {/* ---- 小红书连接卡片 ---- */}
      <div className="card p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900">小红书数据源</h3>
                {xhs.status?.loggedIn ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    已连接{xhs.status.username ? ` (${xhs.status.username})` : ''}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                    未连接
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                连接后，竞品雷达将自动从小红书采集搜索数据
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {xhs.status?.loggedIn ? (
              <>
                <button onClick={xhs.startLogin} className="text-xs text-blue-600 hover:text-blue-800 font-medium">重新登录</button>
                <button onClick={xhs.disconnect} className="text-xs text-red-500 hover:text-red-700 font-medium">断开</button>
              </>
            ) : (
              <button onClick={xhs.startLogin} className="btn-primary text-sm">扫码登录</button>
            )}
          </div>
        </div>
      </div>

      {/* ---- QR 码弹窗 ---- */}
      {xhs.showQr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-[360px] p-6 relative">
            <button onClick={xhs.closeQr} className="absolute top-3 right-3 text-slate-400 hover:text-slate-600">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <h3 className="text-base font-semibold text-slate-900 text-center mb-1">连接小红书</h3>
            <p className="text-xs text-slate-500 text-center mb-4">{xhs.loginMsg}</p>
            <div className="flex items-center justify-center min-h-[240px] bg-slate-50 rounded-lg">
              {xhs.qrCode ? (
                <img src={xhs.qrCode} alt="小红书登录二维码" className="max-w-[220px] max-h-[220px] rounded" />
              ) : xhs.loginLoading ? (
                <div className="flex flex-col items-center gap-2 text-slate-400">
                  <svg className="animate-spin" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  <span className="text-xs">加载中...</span>
                </div>
              ) : (
                <button onClick={xhs.startLogin} className="btn-primary text-sm">重新获取二维码</button>
              )}
            </div>
            <p className="text-xs text-slate-400 text-center mt-3">
              打开小红书 App &rarr; 扫一扫 &rarr; 确认登录
            </p>
          </div>
        </div>
      )}

      {sources.length === 0 && !showForm && (
        <div className="card p-12 text-center">
          <svg className="mx-auto mb-4 text-slate-300" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v4" /><path d="m15.2 7.6 2.4-2.4" /><path d="M18 12h4" /><path d="m15.2 16.4 2.4 2.4" /><path d="M12 18v4" /><path d="m4.9 19.1 2.4-2.4" /><path d="M2 12h4" /><path d="m4.9 4.9 2.4 2.4" />
            <circle cx="12" cy="12" r="4" />
          </svg>
          <h3 className="text-lg font-semibold text-slate-700">暂无数据源</h3>
          <p className="text-sm text-slate-500 mt-1">未配置数据源时，系统将使用内置Demo数据进行分析演示</p>
          <button onClick={openNew} className="btn-primary text-sm mt-4">添加第一个数据源</button>
        </div>
      )}

      {sources.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-slate-600">
                <th className="px-4 py-3 font-medium">名称</th>
                <th className="px-4 py-3 font-medium">URL</th>
                <th className="px-4 py-3 font-medium">方法</th>
                <th className="px-4 py-3 font-medium">状态</th>
                <th className="px-4 py-3 font-medium text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sources.map(src => (
                <tr key={src.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-900">{src.name}</td>
                  <td className="px-4 py-3 text-slate-500 truncate max-w-xs">{src.url}</td>
                  <td className="px-4 py-3"><span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-xs font-mono">{src.method}</span></td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${src.enabled ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                      {src.enabled ? '启用' : '禁用'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button onClick={() => openEdit(src)} className="text-blue-600 hover:text-blue-800 text-xs font-medium">编辑</button>
                    <button onClick={() => remove(src.id)} className="text-red-500 hover:text-red-700 text-xs font-medium">删除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="card p-6 space-y-4">
          <h3 className="text-base font-semibold text-slate-900">
            {editingId ? '编辑数据源' : '新增数据源'}
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">名称</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="例：AppStore评论API" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">请求方法</label>
              <select value={form.method} onChange={e => setForm(f => ({ ...f, method: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="GET">GET</option>
                <option value="POST">POST</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">URL</label>
            <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://api.example.com/reviews" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Headers（JSON）</label>
            <textarea value={form.headers} onChange={e => setForm(f => ({ ...f, headers: e.target.value }))}
              rows={2} className="w-full px-3 py-2 border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Query 参数（JSON）</label>
            <textarea value={form.query_params} onChange={e => setForm(f => ({ ...f, query_params: e.target.value }))}
              rows={2} className="w-full px-3 py-2 border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              字段映射（JSON） — 将API响应字段映射到标准结构
            </label>
            <textarea value={form.field_mapping} onChange={e => setForm(f => ({ ...f, field_mapping: e.target.value }))}
              rows={4} className="w-full px-3 py-2 border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <p className="text-xs text-slate-400 mt-1">标准字段：content, score, date, url, brand, source</p>
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="enabled" checked={form.enabled}
              onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))}
              className="rounded border-slate-300" />
            <label htmlFor="enabled" className="text-sm text-slate-700">启用此数据源</label>
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={save} disabled={saving || !form.name || !form.url} className="btn-primary text-sm">
              {saving ? '保存中...' : '保存'}
            </button>
            <button onClick={() => setShowForm(false)} className="btn-secondary text-sm">取消</button>
          </div>
        </div>
      )}

      <div className="card p-4 bg-amber-50 border-amber-200">
        <div className="flex items-start gap-2">
          <svg className="text-amber-600 mt-0.5 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
          </svg>
          <div>
            <h4 className="text-sm font-semibold text-amber-800">提示</h4>
            <p className="text-xs text-amber-700 mt-1">
              未配置任何数据源或数据不足时，系统会自动使用内置Demo数据（出行行业模拟评论），确保完整流程可演示。
              配置真实API后，系统将优先从配置的数据源采集。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
