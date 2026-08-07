import { RefreshCw, Save, Search, ShieldCheck, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { actionRequest, request } from '../lib/api';
import { useI18n } from '../lib/i18n';
import type { ActionEntry, AnyRecord } from '../lib/types';
import { ConfirmDialog } from './Overlay';

export function GlobalSettings({ actions, notify }: { actions: Map<string, ActionEntry>; notify: (message: string, type?: 'success' | 'error') => void }) {
  const { t } = useI18n();
  const [item, setItem] = useState<AnyRecord>({ entry_acl_rules: '' });
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { const spec = actions.get('settings_global:read'); if (!spec) return; try { const data: any = await request(spec.path); setItem(data.item || data); } catch (error) { notify((error as Error).message, 'error'); } }, [actions, notify]);
  useEffect(() => { void load(); }, [load]);
  return <div className="page-enter"><header className="page-header"><div><h1>{t('全局设置')}</h1><p>{t('维护服务端全局 IP 黑名单')}</p></div><div className="page-actions"><button className="icon-btn" onClick={() => void load()} title={t('刷新')} aria-label={t('刷新')}><RefreshCw /></button><button className="btn primary" disabled={busy || !actions.has('settings_global:update')} onClick={async () => { setBusy(true); try { await actionRequest(actions, 'settings_global', 'update', {}, item); notify(t('全局设置已保存')); } catch (error) { notify((error as Error).message, 'error'); } finally { setBusy(false); } }}><Save />{t(busy ? '保存中…' : '保存')}</button></div></header>
    <section className="panel"><header className="panel-head"><ShieldCheck size={16} />&nbsp;&nbsp;{t('全局 IP 黑名单')}</header><div style={{ padding: 20 }} className="form-grid"><div className="field full"><label htmlFor="global-acl-rules">{t('黑名单规则')}</label><textarea id="global-acl-rules" rows={12} value={item.entry_acl_rules || ''} onChange={event => setItem({ ...item, entry_acl_rules: event.target.value })} placeholder={t('每行一条 IP 或 CIDR')} /><small>{t('规则变更在保存后立即应用到新连接。')}</small></div></div></section>
  </div>;
}

export function BanList({ actions, notify }: { actions: Map<string, ActionEntry>; notify: (message: string, type?: 'success' | 'error') => void }) {
  const { language, t } = useI18n();
  const [items, setItems] = useState<AnyRecord[]>([]); const [search, setSearch] = useState(''); const [confirm, setConfirm] = useState<{ action: string; key?: string } | null>(null); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { const spec = actions.get('security_bans:list'); if (!spec) return; try { const data: any = await request(spec.path); const rows = Array.isArray(data) ? data : data.items || data.rows || []; setItems(rows.map((item: AnyRecord) => ({ ...item, key: item.key ?? item.Key, ban_type: item.ban_type ?? item.BanType, fail_times: item.fail_times ?? item.FailTimes, is_banned: item.is_banned ?? item.IsBanned, last_login_time: item.last_login_time ?? item.LastLoginTime }))); } catch (error) { notify((error as Error).message, 'error'); } }, [actions, notify]);
  useEffect(() => { void load(); }, [load]);
  const filtered = items.filter(item => String(item.key || '').toLowerCase().includes(search.toLowerCase()));
  async function mutate() { if (!confirm) return; setBusy(true); try { await actionRequest(actions, 'security_bans', confirm.action, {}, confirm.key ? { key: confirm.key } : {}); notify(t('封禁列表已更新')); setConfirm(null); await load(); } catch (error) { notify((error as Error).message, 'error'); } finally { setBusy(false); } }
  return <div className="page-enter"><header className="page-header"><div><h1>{t('封禁列表')}</h1><p>{t('查看登录失败记录并解除访问限制')}</p></div><div className="page-actions">{actions.has('security_bans:clean') && <button className="btn" onClick={() => setConfirm({ action: 'clean' })}><RefreshCw />{t('清理过期')}</button>}{actions.has('security_bans:delete_all') && <button className="btn danger" onClick={() => setConfirm({ action: 'delete_all' })}><Trash2 />{t('全部解除')}</button>}</div></header>
    <div className="toolbar"><div className="search"><Search /><input value={search} onChange={event => setSearch(event.target.value)} placeholder={t('搜索 IP 或用户')} /></div><span className="toolbar-count">{filtered.length} {t('项')}</span></div><div className="table-wrap"><table><thead><tr><th>{t('标识')}</th><th>{t('类型')}</th><th>{t('失败次数')}</th><th>{t('状态')}</th><th>{t('最后失败')}</th><th /></tr></thead><tbody>{filtered.map(item => <tr key={item.key}><td className="mono">{item.key}</td><td><span className="badge">{item.ban_type}</span></td><td>{item.fail_times}</td><td><span className={`badge ${item.is_banned ? 'warn' : 'ok'}`}>{t(item.is_banned ? '已封禁' : '观察中')}</span></td><td>{item.last_login_time}</td><td><div className="row-actions">{actions.has('security_bans:delete') && <button className="icon-btn" onClick={() => setConfirm({ action: 'delete', key: item.key })} title={t('解除')} aria-label={t('解除')}><Trash2 /></button>}</div></td></tr>)}</tbody></table>{!filtered.length && <div className="empty"><Search /><div>{t('暂无封禁记录')}</div></div>}</div>
    {confirm && <ConfirmDialog title={t(confirm.action === 'delete_all' ? '解除全部封禁' : confirm.action === 'clean' ? '清理过期记录' : '解除封禁')} message={confirm.key ? language === 'en' ? `Remove the access restriction for “${confirm.key}”?` : `确认解除“${confirm.key}”的访问限制？` : t('该操作会立即更新登录限制状态。')} danger={confirm.action !== 'clean'} busy={busy} onCancel={() => setConfirm(null)} onConfirm={() => void mutate()} />}
  </div>;
}
