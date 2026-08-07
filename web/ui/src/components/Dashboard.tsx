import { AlertTriangle, RefreshCw, Server, Wifi } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { accessToken, request, webSocketURL } from '../lib/api';
import { useI18n } from '../lib/i18n';
import type { AnyRecord, Discovery } from '../lib/types';
import { formatBytes } from './ResourcePage';

const POLL_INTERVAL_MS = 3000;

export default function Dashboard({ discovery, notify }: { discovery: Discovery; notify: (message: string, type?: 'success' | 'error') => void }) {
  const { language, t } = useI18n();
  const [data, setData] = useState<AnyRecord | null>(null);
  const [runtime, setRuntime] = useState<AnyRecord>({});
  const [loading, setLoading] = useState(true);
  const [pollError, setPollError] = useState('');
  const [updatedAt, setUpdatedAt] = useState(0);
  const inFlight = useRef(false);
  const firstLoad = useRef(true);

  const load = useCallback(async (silent = false) => {
    const overviewURL = discovery.routes.overview || discovery.routes.status || discovery.routes.dashboard;
    if (!overviewURL || inFlight.current) return;
    inFlight.current = true;
    if (!silent) setLoading(true);
    try {
      const canReadConfig = discovery.actions.some(action => action.resource === 'system' && action.action === 'export');
      const separator = overviewURL.includes('?') ? '&' : '?';
      const overviewRequestURL = canReadConfig ? `${overviewURL}${separator}config=true` : overviewURL;
      const response = await request<AnyRecord>(overviewRequestURL);
      const legacy = response.data || response;
      setData({
        registration: { version: legacy.version, counts: { clients: legacy.clientCount, online_clients: legacy.clientOnlineCount, tunnels: Number(legacy.tcpC || 0) + Number(legacy.udpCount || 0) + Number(legacy.secretCount || 0) + Number(legacy.socks5Count || 0) + Number(legacy.p2pCount || 0) + Number(legacy.httpProxyCount || 0), hosts: legacy.hostCount } },
        usage_snapshot: { summary: { total_in_bytes: legacy.inletFlowCount, total_out_bytes: legacy.exportFlowCount } },
        display: { http_proxy_port: legacy.httpProxyPort, https_proxy_port: legacy.httpsProxyPort },
      });
      setRuntime(legacy);
      setUpdatedAt(Date.now());
      setPollError('');
    } catch (error) {
      const message = (error as Error).message;
      setPollError(message);
      if (firstLoad.current || !silent) notify(message, 'error');
    } finally {
      firstLoad.current = false;
      inFlight.current = false;
      setLoading(false);
    }
  }, [discovery.actions, discovery.routes, notify]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(true), POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [load]);
  useEffect(() => {
    if (!discovery.routes.ws || typeof WebSocket === 'undefined') return;
    let socket: WebSocket | null = null;
    try {
      const token = accessToken();
      socket = token ? new WebSocket(webSocketURL(discovery.routes.ws), [token]) : new WebSocket(webSocketURL(discovery.routes.ws));
      socket.onmessage = message => {
        try {
          const frame = JSON.parse(String(message.data));
          if (frame.type === 'epoch_changed' || frame.type === 'resync_required') void load(true);
        } catch {}
      };
    } catch {}
    return () => socket?.close();
  }, [discovery.routes.ws, load]);

  const view = useMemo(() => {
    const registration = data?.registration || data || {};
    const usage = data?.usage_snapshot || {};
    const counts = registration.counts || usage.summary || {};
    const display = data?.display || registration.display || {};
    const health = registration.health || {};
    const summary = usage.summary || {};
    return { registration, counts, display, health, summary, config: data?.runtime_config || {} };
  }, [data]);
  const history = useMemo(() => Object.entries(runtime)
    .filter(([key, value]) => /^sys\d+$/.test(key) && value && typeof value === 'object')
    .sort(([left], [right]) => Number(left.slice(3)) - Number(right.slice(3)))
    .map(([, value]) => value as AnyRecord), [runtime]);
  const totalTraffic = Number(view.summary.total_in_bytes || 0) + Number(view.summary.total_out_bytes || 0);
  const uptime = view.registration.runtime_started_at ? Math.max(0, Date.now() / 1000 - view.registration.runtime_started_at) : 0;
  const loadAverage = parseLoad(runtime.load);
  const modes = [
    ['TCP', runtime.tcpCount], ['UDP', runtime.udpCount], ['Secret', runtime.secretCount],
    ['Socks5', runtime.socks5Count], ['P2P', runtime.p2pCount], ['HTTP', runtime.httpProxyCount],
  ].filter(([, value]) => Number(value || 0) > 0) as Array<[string, number]>;
  const modeTotal = modes.reduce((total, [, value]) => total + Number(value || 0), 0);

  return <div className="page-enter"><header className="page-header"><div><h1>{t('运行概览')}</h1><p>{t('节点状态、资源规模与管理链路')}</p></div><div className="page-actions"><span className={`poll-state ${pollError ? 'error' : 'ok'}`} title={pollError || t('实时更新正常')}>{pollError ? <AlertTriangle size={14} /> : null}{updatedAt ? new Date(updatedAt).toLocaleTimeString() : t('连接中')}</span><button className="icon-btn" onClick={() => void load()} aria-label={t('刷新')} title={t('刷新')} disabled={loading}><RefreshCw className={loading ? 'spin' : ''} /></button></div></header>
    <div className="metric-grid">
      <Metric label={t('客户端')} value={loading && !data ? '—' : view.counts.clients ?? 0} note={`${view.counts.online_clients ?? 0} ${t('在线')}`} progress={percent(view.counts.online_clients, view.counts.clients)} />
      <Metric label={t('隧道')} value={loading && !data ? '—' : view.counts.tunnels ?? 0} note={t('当前可见资源')} color="var(--blue)" progress={64} />
      <Metric label={t('域名代理')} value={loading && !data ? '—' : view.counts.hosts ?? 0} note={`${view.counts.users ?? 0} ${t('个用户')}`} color="var(--warning)" progress={46} />
      <Metric label={t('累计流量')} value={loading && !data ? '—' : formatBytes(totalTraffic)} note={`${t('上行')} ${formatBytes(view.summary.total_in_bytes || 0)} · ${t('下行')} ${formatBytes(view.summary.total_out_bytes || 0)}`} progress={72} />
    </div>
    <div className="panel-grid">
      <section className="panel"><header className="panel-head"><Server size={16} />&nbsp;&nbsp;{t('节点信息')}</header><dl className="details-list">
        <Detail label={t('节点 ID')} value={view.registration.node_id || discovery.app.name} mono /><Detail label={t('版本')} value={view.registration.version || discovery.app.version} />
        <Detail label={t('运行模式')} value={view.registration.run_mode || '-'} /><Detail label={t('存储模式')} value={view.registration.store_mode || '-'} />
        <Detail label={t('运行时间')} value={formatDuration(uptime, language, t)} /><Detail label={t('配置纪元')} value={view.registration.config_epoch || '-'} mono />
        <Detail label="API" value={view.registration.api_base || discovery.routes.api_base || '-'} mono />
      </dl></section>
      <section className="panel"><header className="panel-head"><Wifi size={16} />&nbsp;&nbsp;{t('接入端点')}</header><dl className="details-list">
        <Detail label={t('主桥接地址')} value={endpoint(view.display.bridge?.primary)} mono /><Detail label="TCP" value={transport(view.display.bridge?.tcp, t)} mono />
        <Detail label="TLS" value={transport(view.display.bridge?.tls, t)} mono /><Detail label="KCP" value={transport(view.display.bridge?.kcp, t)} mono />
        <Detail label="WebSocket" value={transport(view.display.bridge?.ws, t)} mono /><Detail label="HTTP / HTTPS" value={`${view.display.http_proxy_port || '-'} / ${view.display.https_proxy_port || '-'}`} mono />
        <Detail label={t('回调积压')} value={view.health.callback_queue_backlog ?? 0} />
      </dl></section>
    </div>
    {Object.keys(runtime).length > 0 && <section className="panel section-gap"><header className="panel-head"><Server size={16} />&nbsp;&nbsp;{t('系统运行指标')}</header>
      <div className="runtime-grid">
        <RuntimeMetric label="CPU" value={`${runtime.cpu ?? 0}%`} progress={Number(runtime.cpu || 0)} />
        <RuntimeMetric label={t('内存')} value={`${runtime.virtual_mem ?? 0}%`} progress={Number(runtime.virtual_mem || 0)} />
        <RuntimeMetric label={t('连接数')} value={runtime.tcp ?? 0} note={`TCP · ${runtime.udp ?? 0} UDP`} />
        <RuntimeMetric label={t('网络吞吐')} value={`${formatBytes(Number(runtime.io_recv || 0))}/s`} note={`${t('发送')} ${formatBytes(Number(runtime.io_send || 0))}/s`} />
      </div>
      <dl className="runtime-summary"><Detail label={t('系统负载')} value={`${formatNumber(loadAverage.load1)} / ${formatNumber(loadAverage.load5)} / ${formatNumber(loadAverage.load15)}`} mono /><Detail label={t('最低客户端版本')} value={runtime.minVersion || '-'} /></dl>
      {history.length > 0 && <TrendPanel history={history} t={t} />}
      {modes.length > 0 && <section className="distribution"><h3>{t('隧道模式分布')}</h3>{modes.map(([label, value]) => <div className="distribution-row" key={label}><span>{label}</span><div className="distribution-track"><i style={{ width: `${Math.max(3, Number(value) / modeTotal * 100)}%` }} /></div><strong>{value}</strong></div>)}</section>}
    </section>}
    {discovery.actions.some(action => action.resource === 'system' && action.action === 'export') && Object.keys(view.config).length > 0 && <section className="panel section-gap"><header className="panel-head"><Server size={16} />&nbsp;&nbsp;{t('节点配置')}</header><dl className="details-list config-summary">
      <Detail label={t('入口 IP 限制')} value={configValue(view.config, ['ip_limit', 'web_ip'], []) || '-'} />
      <Detail label={t('日志级别')} value={configValue(view.config, ['log_level'], []) || '-'} />
      <Detail label={t('P2P 地址')} value={`${configValue(view.config, ['p2p_ip'], []) || '-'}:${configValue(view.config, ['p2p_port'], []) || '-'}`} mono />
      <Detail label={t('运行模式')} value={configValue(view.config, ['run_mode'], []) || '-'} />
      <Detail label={t('流量持久化间隔')} value={configValue(view.config, ['flow_store_interval'], []) || '-'} />
      <Detail label="HTTP / HTTPS" value={`${configValue(view.config, ['http_proxy_port'], []) || '-'} / ${configValue(view.config, ['https_proxy_port'], []) || '-'}`} />
      <Detail label={t('桥接协议 / WebSocket 路径')} value={`${configValue(view.config, ['bridge_type'], []) || '-'} / ${configValue(view.config, ['bridge_path'], []) || '-'}`} />
    </dl></section>}
  </div>;
}

function TrendPanel({ history, t }: { history: AnyRecord[]; t: (source: string) => string }) {
  const series = [
    ['CPU', 'cpu', '%'], [t('内存'), 'virtual_mem', '%'], [t('接收'), 'io_recv', '/s'], [t('发送'), 'io_send', '/s'],
  ] as Array<[string, string, string]>;
  return <section className="trend-panel"><h3>{t('历史趋势')}</h3><div className="trend-grid">{series.map(([label, key, suffix]) => { const values = history.map(sample => Number(sample[key] || 0)); const max = Math.max(...values, 1); return <div className="trend" key={key}><header><span>{label}</span><strong>{key.includes('io_') ? formatBytes(values.at(-1) || 0) : `${(values.at(-1) || 0).toFixed(1)}${suffix}`}</strong></header><div className="trend-bars">{values.slice(-24).map((value, index) => <i key={`${key}-${index}`} style={{ height: `${Math.max(4, value / max * 100)}%` }} />)}</div></div>; })}</div></section>;
}

function Metric({ label, value, note, progress, color }: { label: string; value: any; note: string; progress: number; color?: string }) { return <div className="metric" style={{ '--metric-progress': `${Math.max(4, Math.min(100, progress))}%`, '--metric-color': color } as React.CSSProperties}><div className="metric-label">{label}</div><div className="metric-value">{value}</div><div className="metric-note">{note}</div></div>; }
function Detail({ label, value, mono }: { label: string; value: any; mono?: boolean }) { return <div className="details-row"><dt>{label}</dt><dd className={mono ? 'mono' : ''}>{String(value ?? '-')}</dd></div>; }
function RuntimeMetric({ label, value, note, progress }: { label: string; value: any; note?: string; progress?: number }) { return <div className="runtime-metric"><span>{label}</span><strong>{String(value)}</strong>{note && <small>{note}</small>}{progress !== undefined && <div className="runtime-meter"><i style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} /></div>}</div>; }
function percent(part: number, total: number) { return total ? Number(part || 0) / total * 100 : 4; }
function endpoint(value: AnyRecord = {}) { return value.addr || [value.ip, value.port].filter(Boolean).join(':') || '-'; }
function transport(value: AnyRecord = {}, t: (source: string) => string) { return value.enabled ? endpoint(value) : t('未启用'); }
function parseLoad(value: unknown) { if (value && typeof value === 'object') return value as AnyRecord; try { return JSON.parse(String(value || '{}')); } catch { return {}; } }
function formatNumber(value: unknown) { const number = Number(value); return Number.isFinite(number) ? number.toFixed(2) : '-'; }
function formatDuration(seconds: number, language: 'zh' | 'en', t: (source: string) => string) { const days = Math.floor(seconds / 86400); const hours = Math.floor(seconds % 86400 / 3600); const minutes = Math.floor(seconds % 3600 / 60); return language === 'en' ? `${days ? `${days}${t('天')} ` : ''}${hours}${t('小时')} ${minutes}${t('分')}` : `${days ? `${days}天 ` : ''}${hours}小时 ${minutes}分`; }
function configValue(config: AnyRecord, paths: string[], flatKeys: string[]) {
  for (const path of paths) { const value = path.split('.').reduce<any>((current, key) => current?.[key], config); if (value !== undefined && value !== null && value !== '') return value; }
  for (const key of flatKeys) if (config[key] !== undefined && config[key] !== null && config[key] !== '') return config[key];
  return '';
}
