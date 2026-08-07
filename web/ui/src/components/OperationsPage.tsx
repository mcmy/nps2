import { Activity, Download, FileJson, Radio, RefreshCw, RotateCw, Upload } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { accessToken, actionRequest, request, webSocketURL } from '../lib/api';
import { useI18n } from '../lib/i18n';
import type { ActionEntry, AnyRecord, Discovery } from '../lib/types';
import { ConfirmDialog } from './Overlay';
import { formatBytes } from './ResourcePage';

interface Props {
  discovery: Discovery;
  actions: Map<string, ActionEntry>;
  notify: (message: string, type?: 'success' | 'error') => void;
}

export default function OperationsPage({ discovery, actions, notify }: Props) {
  const { t } = useI18n();
  const [operations, setOperations] = useState<AnyRecord[]>([]);
  const [changes, setChanges] = useState<AnyRecord[]>([]);
  const [usage, setUsage] = useState<AnyRecord>({});
  const [events, setEvents] = useState<AnyRecord[]>([]);
  const [socketState, setSocketState] = useState<'off' | 'connecting' | 'online' | 'error'>('off');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<'sync' | 'import' | null>(null);
  const [importText, setImportText] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const jobs: Promise<void>[] = [];
    if (discovery.routes.operations) jobs.push(request<AnyRecord>(`${discovery.routes.operations}?limit=50`).then(data => setOperations(data.items || [])));
    if (discovery.routes.changes) jobs.push(request<AnyRecord>(`${discovery.routes.changes}?limit=50`).then(data => setChanges(data.items || data.changes || [])));
    if (discovery.routes.usage_snapshot) jobs.push(request<AnyRecord>(discovery.routes.usage_snapshot).then(setUsage));
    try { await Promise.all(jobs); } catch (error) { notify((error as Error).message, 'error'); }
  }, [discovery.routes, notify]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!discovery.routes.ws) { setSocketState('off'); return; }
    let disposed = false;
    let retryCount = 0;
    let retryTimer = 0;
    let socket: WebSocket | null = null;
    const connect = () => {
      if (disposed) return;
      setSocketState('connecting');
      try {
        const token = accessToken();
        socket = token ? new WebSocket(webSocketURL(discovery.routes.ws), [token]) : new WebSocket(webSocketURL(discovery.routes.ws));
      } catch {
        setSocketState('error');
        retryTimer = window.setTimeout(connect, Math.min(1000 * 2 ** retryCount++, 15000));
        return;
      }
      socket.onopen = () => { retryCount = 0; setSocketState('online'); };
      socket.onerror = () => setSocketState('error');
      socket.onclose = () => {
        if (disposed) return;
        setSocketState('off');
        retryTimer = window.setTimeout(connect, Math.min(1000 * 2 ** retryCount++, 15000));
      };
      socket.onmessage = message => {
        try {
          const frame = JSON.parse(String(message.data));
          if (frame.type === 'event') {
            const event = typeof frame.body === 'string' ? JSON.parse(frame.body) : frame.body;
            setEvents(current => [event, ...current].slice(0, 100));
          }
          if (frame.type === 'epoch_changed' || frame.type === 'resync_required') void load();
        } catch {}
      };
    };
    connect();
    const ping = window.setInterval(() => { if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'ping', id: `ui-${Date.now()}` })); }, 25000);
    return () => { disposed = true; window.clearInterval(ping); window.clearTimeout(retryTimer); socket?.close(); };
  }, [discovery.routes.ws, load]);

  async function exportConfig() {
    setBusy(true);
    try {
      const snapshot = await actionRequest(actions, 'system', 'export');
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = `nps-config-${new Date().toISOString().replace(/[:.]/g, '-')}.json`; anchor.click();
      URL.revokeObjectURL(url);
      notify(t('配置已导出'));
    } catch (error) { notify((error as Error).message, 'error'); }
    finally { setBusy(false); }
  }

  async function runConfirmed() {
    if (!confirm) return;
    setBusy(true);
    try {
      if (confirm === 'sync') await actionRequest(actions, 'system', 'sync', {}, {});
      else {
        const spec = actions.get('system:import');
        if (!spec) throw new Error(t('当前账号没有执行此操作的权限'));
        await request(spec.path, { method: spec.method, body: importText });
        setImportText('');
      }
      notify(t(confirm === 'sync' ? '运行态同步完成' : '配置导入完成'));
      setConfirm(null);
      await load();
    } catch (error) { notify((error as Error).message, 'error'); }
    finally { setBusy(false); }
  }

  const summary = usage.summary || {};
  return <div className="page-enter operations-page">
    <header className="page-header"><div><h1>{t('系统运维')}</h1><p>{t('配置迁移、运行态同步与实时事件')}</p></div><div className="page-actions">
      <span className={`live-state ${socketState}`}><Radio />{t(socketState === 'online' ? '实时已连接' : socketState === 'connecting' ? '实时连接中' : '实时未连接')}</span>
      <button className="icon-btn" onClick={() => void load()} title={t('刷新')} aria-label={t('刷新')}><RefreshCw /></button>
      {actions.has('system:export') && <button className="btn" disabled={busy} onClick={() => void exportConfig()}><Download />{t('导出配置')}</button>}
      {actions.has('system:import') && <><input ref={fileRef} hidden type="file" accept="application/json,.json" onChange={event => { const file = event.target.files?.[0]; if (!file) return; file.text().then(text => { JSON.parse(text); setImportText(text); setConfirm('import'); }).catch(error => notify((error as Error).message, 'error')); event.target.value = ''; }} /><button className="btn" disabled={busy} onClick={() => fileRef.current?.click()}><Upload />{t('导入配置')}</button></>}
      {actions.has('system:sync') && <button className="btn primary" disabled={busy} onClick={() => setConfirm('sync')}><RotateCw />{t('同步运行态')}</button>}
    </div></header>

    <div className="metric-grid operations-metrics"><Metric label={t('用户')} value={summary.users || 0} /><Metric label={t('客户端')} value={summary.clients || 0} /><Metric label={t('隧道 / 域名')} value={`${summary.tunnels || 0} / ${summary.hosts || 0}`} /><Metric label={t('总流量')} value={formatBytes(Number(summary.total_in_bytes || 0) + Number(summary.total_out_bytes || 0))} /></div>

    <div className="ops-grid">
      <section className="panel"><header className="panel-head"><div><h2>{t('操作历史')}</h2><p>{operations.length} {t('项')}</p></div><Activity /></header><div className="event-list">{operations.length ? operations.map((item, index) => <EventRow key={item.operation_id || index} title={item.kind || item.operation_id || '-'} meta={`${item.success_count || 0}/${item.count || 0} · ${item.duration_ms || 0} ms`} time={item.finished_at || item.started_at} detail={(item.paths || []).join(', ')} />) : <Empty label={t('暂无操作记录')} />}</div></section>
      <section className="panel"><header className="panel-head"><div><h2>{t('配置变更')}</h2><p>{changes.length} {t('项')}</p></div><FileJson /></header><div className="event-list">{changes.length ? changes.map((item, index) => <EventRow key={item.sequence || index} title={item.name || `${item.resource || ''}.${item.action || ''}`} meta={`#${item.sequence || '-'} · ${item.resource || '-'}`} time={item.timestamp || item.created_at} detail={compactFields(item.fields)} />) : <Empty label={t('暂无配置变更')} />}</div></section>
    </div>
    <section className="panel live-panel"><header className="panel-head"><div><h2>{t('实时事件')}</h2><p>{t('当前浏览器会话接收的最新事件')}</p></div><Radio /></header><div className="event-list">{events.length ? events.map((item, index) => <EventRow key={`${item.sequence || 0}-${index}`} title={item.name || `${item.resource || ''}.${item.action || ''}`} meta={`${item.resource || '-'} · ${item.action || '-'}`} time={item.timestamp} detail={compactFields(item.fields)} />) : <Empty label={t('等待实时事件')} />}</div></section>
    {confirm && <ConfirmDialog title={t(confirm === 'sync' ? '同步运行态' : '导入配置')} message={t(confirm === 'sync' ? '同步会重载运行中的代理与客户端连接，是否继续？' : '导入会替换当前配置并重启运行态，确认已备份现有配置。')} busy={busy} onCancel={() => { setConfirm(null); setImportText(''); }} onConfirm={() => void runConfirmed()} />}
  </div>;
}

function Metric({ label, value }: { label: string; value: string | number }) { return <div className="metric"><span>{label}</span><strong className="metric-value">{value}</strong></div>; }
function Empty({ label }: { label: string }) { return <div className="event-empty">{label}</div>; }
function EventRow({ title, meta, time, detail }: { title: string; meta: string; time?: number; detail?: string }) { return <div className="event-row"><div><strong>{title}</strong><span>{meta}</span>{detail && <code>{detail}</code>}</div><time>{time ? new Date(time * 1000).toLocaleString() : '-'}</time></div>; }
function compactFields(fields: AnyRecord | undefined) { if (!fields) return ''; const text = Object.entries(fields).slice(0, 8).map(([key, value]) => `${key}=${typeof value === 'object' ? JSON.stringify(value) : value}`).join(' · '); return text.length > 220 ? `${text.slice(0, 220)}…` : text; }
