import { Activity, Ban, Cable, ChevronRight, CircleGauge, CircleHelp, Globe2, Languages, LogOut, Menu, Moon, Network, RefreshCw, ServerCog, Settings, Sun, Users, Webhook, type LucideIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { actionMap, clearAccessToken, getDiscovery } from '../lib/api';
import { resourceSpecs } from '../lib/forms';
import { I18nProvider, useI18n } from '../lib/i18n';
import type { Discovery, PageKey } from '../lib/types';
import AuthScreen from './AuthScreen';
import Dashboard from './Dashboard';
import { BanList, CallbackQueue, GlobalSettings } from './SettingsPage';
import ResourcePage from './ResourcePage';
import { Toasts, type ToastItem } from './Overlay';
import OperationsPage from './OperationsPage';

const pageInfo: Record<PageKey, { label: string; icon: LucideIcon }> = {
  dashboard: { label: '运行概览', icon: CircleGauge }, clients: { label: '客户端', icon: Cable }, tunnels: { label: '隧道', icon: Network },
  hosts: { label: '域名代理', icon: Globe2 }, users: { label: '用户', icon: Users }, settings: { label: '全局设置', icon: Settings },
  bans: { label: '封禁列表', icon: Ban }, callbacks: { label: '回调队列', icon: Webhook },
  webhooks: { label: 'Webhook', icon: Webhook }, operations: { label: '系统运维', icon: Activity },
};

export default function App() {
  return <I18nProvider><AppContent /></I18nProvider>;
}

function AppContent() {
  const { language, setLanguage, t } = useI18n();
  const [discovery, setDiscovery] = useState<Discovery | null>(null);
  const [error, setError] = useState('');
  const [page, setPage] = useState<PageKey>(hashPage());
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => typeof localStorage !== 'undefined' && localStorage.getItem('nps-theme') === 'dark' ? 'dark' : 'light');
  const notify = useCallback((message: string, type: 'success' | 'error' = 'success') => { const id = Date.now() + Math.random(); setToasts(items => [...items, { id, message, type }]); window.setTimeout(() => setToasts(items => items.filter(item => item.id !== id)), type === 'error' ? 5200 : 2600); }, []);
  const load = useCallback(async () => { try { setError(''); setDiscovery(await getDiscovery()); } catch (cause) { setError((cause as Error).message); } }, []);
  useEffect(() => { clearAccessToken(); void load(); }, [load]);
  useEffect(() => { const handler = () => setPage(hashPage()); window.addEventListener('hashchange', handler); return () => window.removeEventListener('hashchange', handler); }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('nps-theme', theme); document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#10171a' : '#f3f6f8'); }, [theme]);

  const actions = useMemo(() => discovery ? actionMap(discovery) : new Map(), [discovery]);
  const pages = useMemo(() => {
    if (!discovery?.session.authenticated) return [] as PageKey[];
    const available: PageKey[] = [];
    if (discovery.routes.overview || discovery.routes.dashboard || discovery.routes.status) available.push('dashboard');
    if (actions.has('clients:list')) available.push('clients'); if (actions.has('tunnels:list')) available.push('tunnels'); if (actions.has('hosts:list')) available.push('hosts');
    if (actions.has('users:list')) available.push('users'); if (actions.has('settings_global:read')) available.push('settings'); if (actions.has('security_bans:list')) available.push('bans'); if (actions.has('callbacks_queue:list')) available.push('callbacks');
    if (actions.has('webhooks:list')) available.push('webhooks');
    if (actions.has('system:operations') || actions.has('system:changes') || actions.has('system:usage_snapshot') || actions.has('system:export') || actions.has('system:import') || actions.has('system:sync')) available.push('operations');
    return available;
  }, [actions, discovery]);
  useEffect(() => { if (pages.length && !pages.includes(page)) navigate(pages[0]); }, [pages, page]);

  if (!discovery && !error) return <div className="boot-screen"><RefreshCw className="boot-mark" /></div>;
  if (error || !discovery) return <div className="boot-screen"><div className="error-panel"><ServerCog /><h2>{t('无法连接管理服务')}</h2><p>{error || t('服务返回了无效配置')}</p><button className="btn primary" onClick={() => void load()}><RefreshCw />{t('重试')}</button></div></div>;
  if (!discovery.session.authenticated) return <><AuthScreen discovery={discovery} theme={theme} onThemeChange={() => setTheme(theme === 'light' ? 'dark' : 'light')} notify={notify} onAuthenticated={() => void load()} /><Toasts items={toasts} dismiss={id => setToasts(items => items.filter(item => item.id !== id))} /></>;

  async function logout() { try { if (discovery!.routes.logout) await fetch(discovery!.routes.logout, { credentials: 'same-origin', redirect: 'manual' }); clearAccessToken(); await load(); } catch (cause) { notify((cause as Error).message, 'error'); } }
  const currentInfo = pageInfo[page];
  return <div className="app-shell">{mobileOpen && <div className="sidebar-scrim" onClick={() => setMobileOpen(false)} />}
    <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}><div className="sidebar-brand"><div className="brand-mark">N</div><div><div className="brand-name">{discovery.app.name}</div><small>{discovery.app.version || 'Management'}</small></div></div>
      <div className="nav-label">{t('控制台')}</div><nav className="nav-list">{pages.map(key => { const info = pageInfo[key]; const Icon = info.icon; return <button key={key} className={`nav-item ${key === page ? 'active' : ''}`} onClick={() => { navigate(key); setMobileOpen(false); }}><Icon />{t(info.label)}{key === page && <ChevronRight size={14} style={{ marginLeft: 'auto' }} />}</button>; })}</nav>
      <div className="sidebar-foot"><div className="identity"><strong>{discovery.session.username || t('已认证用户')}</strong><span>{discovery.session.is_admin ? t('系统管理员') : discovery.session.kind || t('用户')}</span></div></div>
    </aside>
    <main className="main"><header className="topbar"><button className="icon-btn mobile-menu" onClick={() => setMobileOpen(true)} aria-label={t('打开菜单')}><Menu /></button><span className="topbar-title">{currentInfo && t(currentInfo.label)}</span><div className="topbar-actions">
      <a className="icon-btn" href="https://d-jy.net/docs/nps/" target="_blank" rel="noreferrer" title={t('帮助')} aria-label={t('帮助')}><CircleHelp /></a>
      <button className="icon-btn" onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')} title={language === 'zh' ? 'English' : '中文'} aria-label={t('切换语言')}><Languages /></button>
      <button className="icon-btn" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} title={t('切换主题')} aria-label={t('切换主题')}>{theme === 'light' ? <Moon /> : <Sun />}</button>
      <button className="icon-btn" onClick={() => void logout()} title={t('退出登录')} aria-label={t('退出登录')}><LogOut /></button>
    </div></header><section className="content" key={`${page}-${language}`}>{renderPage(page, discovery, actions, notify)}</section></main>
    <Toasts items={toasts} dismiss={id => setToasts(items => items.filter(item => item.id !== id))} />
  </div>;
}

function renderPage(page: PageKey, discovery: Discovery, actions: ReturnType<typeof actionMap>, notify: (message: string, type?: 'success' | 'error') => void) {
  if (page === 'dashboard') return <Dashboard discovery={discovery} notify={notify} />;
  if (page === 'settings') return <GlobalSettings discovery={discovery} actions={actions} notify={notify} />;
  if (page === 'bans') return <BanList actions={actions} notify={notify} />;
  if (page === 'callbacks') return <CallbackQueue actions={actions} notify={notify} />;
  if (page === 'operations') return <OperationsPage discovery={discovery} actions={actions} notify={notify} />;
  return <ResourcePage discovery={discovery} actions={actions} spec={resourceSpecs[page]} notify={notify} />;
}
export function hashQuery() {
  const raw = window.location.hash.replace(/^#\/?/, '');
  return new URLSearchParams(raw.slice(raw.indexOf('?') + 1));
}
function hashPage(): PageKey { const value = window.location.hash.replace(/^#\/?/, '').split('?')[0] as PageKey; return pageInfo[value] ? value : 'dashboard'; }
export function navigate(page: PageKey, params: Record<string, string | number | undefined> = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && String(value) !== '') query.set(key, String(value));
  const suffix = query.toString() ? `?${query.toString()}` : '';
  window.location.hash = `/${page}${suffix}`;
}
