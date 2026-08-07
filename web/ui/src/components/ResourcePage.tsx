import { Activity, ArrowDown, ArrowUp, Ban, Copy, Edit3, Eye, Filter, Globe2 as GlobeIcon, MoreHorizontal, Network as NetworkIcon, Play, Plus, QrCode, RadioTower, RefreshCw, RotateCcw, Search, Square, Trash2, Unplug, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { actionRequest, materialize, normalizeLegacyKeys, request, requestBlob } from '../lib/api';
import { formBody, tunnelModeDetails, tunnelModeOptions, valueFor, type FieldSpec, type ResourceSpec, type SelectOption } from '../lib/forms';
import { useI18n } from '../lib/i18n';
import type { ActionEntry, AnyRecord, Discovery, ResourceList } from '../lib/types';
import { ConfirmDialog, Drawer } from './Overlay';

interface Props {
  discovery: Discovery;
  actions: Map<string, ActionEntry>;
  spec: ResourceSpec;
  notify: (message: string, type?: 'success' | 'error') => void;
}

const mutationNames: Record<string, Record<string, string>> = {
  clients: { create: '新建客户端', update: '编辑客户端' }, tunnels: { create: '新建隧道', update: '编辑隧道' },
  hosts: { create: '新建域名代理', update: '编辑域名代理' },
};

export default function ResourcePage({ discovery, actions, spec, notify }: Props) {
  const { language, t } = useI18n();
  const [items, setItems] = useState<AnyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const initialQuery = useMemo(() => readHashQuery(), []);
  const [editor, setEditor] = useState<{ item: AnyRecord | null; clone?: boolean } | null>(null);
  const [confirm, setConfirm] = useState<{ items: AnyRecord[]; action: string; title: string; message: string; danger?: boolean; all?: boolean } | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [connections, setConnections] = useState<AnyRecord | null>(null);
  const [qrClient, setQRClient] = useState<AnyRecord | null>(null);
  const [details, setDetails] = useState<AnyRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(Number(initialQuery.get('page') || 1) || 1);
  const [pageSize, setPageSize] = useState(Number(initialQuery.get('limit') || 25) || 25);
  const [total, setTotal] = useState(0);
  const [sort, setSort] = useState(initialQuery.get('sort') || '');
  const [order, setOrder] = useState(initialQuery.get('order') || 'asc');
  const [clientFilter, setClientFilter] = useState(initialQuery.get('client_id') || '');
  const [modeFilter, setModeFilter] = useState(initialQuery.get('mode') || '');

  const has = useCallback((action: string) => actions.has(`${spec.resource}:${action}`), [actions, spec.resource]);
  const load = useCallback(async () => {
    const entry = actions.get(`${spec.resource}:list`);
    if (!entry) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ offset: String((page - 1) * pageSize), limit: String(pageSize), order });
      if (search.trim()) params.set('search', search.trim());
      if (sort) params.set('sort', sort);
      if (clientFilter && (spec.resource === 'tunnels' || spec.resource === 'hosts')) params.set('client_id', clientFilter);
      if (modeFilter && spec.resource === 'tunnels') { params.set('mode', modeFilter); params.set('type', modeFilter); }
      const data = await request<ResourceList | AnyRecord[]>(`${entry.path}?${params}`, { method: entry.method });
      const list = Array.isArray(data) ? data : Array.isArray(data.items) ? data.items : Array.isArray((data as AnyRecord).rows) ? (data as AnyRecord).rows : [];
      setItems(list.map((item: AnyRecord) => adaptLegacyItem(spec.resource, normalizeLegacyKeys(item) as AnyRecord)));
      setTotal(Array.isArray(data) ? list.length : Number(data.total ?? list.length));
      setSelected(new Set());
    } catch (error) { notify((error as Error).message, 'error'); }
    finally { setLoading(false); }
  }, [actions, clientFilter, modeFilter, notify, order, page, pageSize, search, sort, spec.resource]);

  useEffect(() => { const timer = window.setTimeout(() => void load(), search ? 250 : 0); return () => window.clearTimeout(timer); }, [load, search]);
  useEffect(() => { updateHashQuery({ page, limit: pageSize, sort, order, client_id: clientFilter, mode: modeFilter, search }); }, [clientFilter, modeFilter, order, page, pageSize, search, sort]);
  const filtered = items;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  function toggleSort(key: string) {
    setPage(1);
    const field = sortFieldForResource(spec.resource, key);
    if (sort === field) setOrder(value => value === 'asc' ? 'desc' : 'asc');
    else { setSort(field); setOrder('asc'); }
  }

  async function save(body: AnyRecord, item: AnyRecord | null) {
    setBusy(true);
    try {
      await actionRequest(actions, spec.resource, item ? 'update' : 'create', item ? { id: item.id } : {}, body);
      setEditor(null);
      notify(t(item ? '修改已保存' : '创建成功'));
      await load();
    } catch (error) { notify((error as Error).message, 'error'); }
    finally { setBusy(false); }
  }

  async function openItem(item: AnyRecord, target: 'editor' | 'details') {
    const entry = actions.get(`${spec.resource}:read`);
    if (!entry) {
      target === 'editor' ? setEditor({ item }) : setDetails(item);
      return;
    }
    setBusy(true);
    try {
      const data: any = await request(materialize(entry.path, { id: item.id }), { method: entry.method });
      const current = adaptLegacyItem(spec.resource, normalizeLegacyKeys(data?.item || data || item) as AnyRecord);
      target === 'editor' ? setEditor({ item: current }) : setDetails(current);
    } catch (error) { notify((error as Error).message, 'error'); }
    finally { setBusy(false); }
  }

  async function runAction() {
    if (!confirm) return;
    const { items: targets, action } = confirm;
    setBusy(true);
    try {
      if (confirm.all && action === 'clear') {
        await actionRequest(actions, spec.resource, 'clear_all', {}, { mode: 'flow' });
      } else {
        for (const item of targets) {
          const apiAction = has('status') && (action === 'start' || action === 'stop') ? 'status' : action;
          let body: AnyRecord = {};
          if (apiAction === 'status') {
            const enabled = action === 'start' ? true : action === 'stop' ? false : !isEnabled(item, spec.resource);
            body = { status: enabled };
          }
          if (apiAction === 'clear') body = { mode: 'flow' };
          if (apiAction === 'kick') body = { client_id: Number(item.id), verify_key: item.verify_key || '' };
          await actionRequest(actions, spec.resource, apiAction, { id: item.id }, body);
        }
      }
      notify(t(action === 'delete' ? '已删除' : '操作完成'));
      setConfirm(null);
      await load();
    } catch (error) { notify((error as Error).message, 'error'); }
    finally { setBusy(false); }
  }

  function ask(item: AnyRecord, action: string) {
    const deleting = action === 'delete';
    const label = item.remark || item.username || item.host || `#${item.id}`;
    const labels: Record<string, string> = { delete: '删除', clear: '重置流量', start: '启动', stop: '停止', status: isEnabled(item, spec.resource) ? '停用' : '启用', kick: '强制下线' };
    const actionLabel = t(labels[action]);
    const resourceTitle = t(spec.title);
    const title = language === 'en' ? `${actionLabel} ${resourceTitle.toLowerCase()}` : `${actionLabel}${resourceTitle}`;
    const message = language === 'en'
      ? deleting ? `Deleting “${label}” cannot be undone. Confirm that this resource is no longer needed.` : `Perform ${actionLabel.toLowerCase()} on “${label}”?`
      : deleting ? `“${label}”删除后无法恢复，请确认该资源已不再使用。` : `确认对“${label}”执行${actionLabel}操作？`;
    setConfirm({ items: [item], action, title, message, danger: deleting || action === 'stop' || action === 'status' && isEnabled(item, spec.resource) });
  }

  function askBatch(action: string, all = false) {
    const targets = all ? items : items.filter(item => selected.has(Number(item.id)));
    if (!all && targets.length === 0) return;
    const labels: Record<string, string> = { delete: '删除', clear: '重置流量', start: '启动', stop: '停止' };
    const actionLabel = t(labels[action]);
    const count = all ? items.length : targets.length;
    const title = language === 'en' ? `${actionLabel} ${count} ${t(spec.title).toLowerCase()}` : `批量${actionLabel}${spec.title}`;
    const message = language === 'en' ? `Perform ${actionLabel.toLowerCase()} on ${count} selected ${t(spec.title).toLowerCase()}?` : `确认对 ${count} 项${spec.title}执行${actionLabel}操作？`;
    setConfirm({ items: targets, action, title, message, danger: action === 'delete' || action === 'stop', all });
  }

  const canBatch = has('delete') || has('status') || has('start') && has('stop');
  const selectedItems = items.filter(item => selected.has(Number(item.id)));
  const allFilteredSelected = filtered.length > 0 && filtered.every(item => selected.has(Number(item.id)));

  return <div className="page-enter resource-page">
    <header className="page-header"><div><h1>{t(spec.title)}</h1><p>{t(spec.description)}</p></div><div className="page-actions">
      <button className="icon-btn" onClick={() => void load()} aria-label={t('刷新')} title={t('刷新')}><RefreshCw /></button>
      {has('clear_all') && <button className="btn" disabled={!items.length} onClick={() => askBatch('clear', true)}><RotateCcw />{t('全部重置流量')}</button>}
      {has('ping') && <button className="btn" disabled={!filtered.some(item => resourceID(item) > 0) || busy} onClick={async () => { setBusy(true); try { for (const item of filtered) { const id = resourceID(item); if (id > 0) await actionRequest(actions, spec.resource, 'ping', { id }, { id }); } notify(t('延迟测试完成')); } catch (error) { notify((error as Error).message, 'error'); } finally { setBusy(false); } }}><Activity />{t('测试可见客户端')}</button>}
      {has('create') && <button className="btn primary" onClick={() => setEditor({ item: null })}><Plus />{t('新增')}</button>}
    </div></header>
    <div className="toolbar"><div className="search"><Search /><input value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder={language === 'en' ? `Search ${t(spec.title).toLowerCase()}` : `搜索${spec.title}`} aria-label={language === 'en' ? `Search ${t(spec.title).toLowerCase()}` : `搜索${spec.title}`} /></div>
      {(spec.resource === 'tunnels' || spec.resource === 'hosts') && <label className="toolbar-filter"><Filter size={14} /><input value={clientFilter} onChange={event => { setClientFilter(event.target.value); setPage(1); }} placeholder={t('客户端 ID')} aria-label={t('客户端 ID')} inputMode="numeric" /></label>}
      {spec.resource === 'tunnels' && <select className="toolbar-select" value={modeFilter} onChange={event => { setModeFilter(event.target.value); setPage(1); }} aria-label={t('模式筛选')}><option value="">{t('全部模式')}</option>{tunnelModeOptions.map(option => <option key={option.value} value={option.value}>{t(option.label)}</option>)}</select>}
      <span className="toolbar-count">{loading ? t('载入中') : `${total} ${t('项')}`}</span></div>
    {canBatch && selectedItems.length > 0 && <div className="bulk-bar"><strong>{selectedItems.length} {t('项已选择')}</strong><div className="bulk-actions">
      {(has('status') || has('start') && has('stop')) && <><button className="btn" onClick={() => askBatch('start')}><Play />{t('启动')}</button><button className="btn" onClick={() => askBatch('stop')}><Square />{t('停止')}</button></>}
      {has('clear') && <button className="btn" onClick={() => askBatch('clear')}><RotateCcw />{t('重置流量')}</button>}
      {has('delete') && <button className="btn danger" onClick={() => askBatch('delete')}><Trash2 />{t('删除')}</button>}
      <button className="icon-btn" onClick={() => setSelected(new Set())} title={t('取消选择')} aria-label={t('取消选择')}><X /></button>
    </div></div>}
    <div className="table-wrap"><table><thead><tr>{canBatch && <th className="select-cell"><input type="checkbox" aria-label={t('选择全部')} checked={allFilteredSelected} onChange={event => { const next = new Set(selected); for (const item of filtered) event.target.checked ? next.add(Number(item.id)) : next.delete(Number(item.id)); setSelected(next); }} /></th>}{spec.columns.map(column => <th key={column.key}><button className="sort-button" type="button" onClick={() => toggleSort(column.key)}>{t(column.label)}{sort === sortFieldForResource(spec.resource, column.key) && (order === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}</button></th>)}<th aria-label={t('操作')} /></tr></thead><tbody>
      {loading ? Array.from({ length: 6 }, (_, index) => <tr key={index}>{[...(canBatch ? [{ key: '_select' }] : []), ...spec.columns, { key: '_action' }].map(column => <td key={column.key}><div className="skeleton">loading</div></td>)}</tr>) : filtered.map(item => <tr key={item.id}>{canBatch && <td className="select-cell"><input type="checkbox" aria-label={`${t('选择')} #${item.id}`} checked={selected.has(Number(item.id))} onChange={event => { const next = new Set(selected); event.target.checked ? next.add(Number(item.id)) : next.delete(Number(item.id)); setSelected(next); }} /></td>}{spec.columns.map(column => <td key={column.key}>{renderCell(item, column.key, column.kind, t)}</td>)}<td><div className="row-actions">
        <button className="icon-btn" title={t('查看详情')} aria-label={t('查看详情')} onClick={() => void openItem(item, 'details')}><Eye /></button>
        {has('update') && !item.read_only && <button className="icon-btn" title={t('编辑')} aria-label={t('编辑')} disabled={busy} onClick={() => void openItem(item, 'editor')}><Edit3 /></button>}
        {(spec.resource === 'tunnels' || spec.resource === 'hosts') && has('create') && <button className="icon-btn" title={t('复制为新资源')} aria-label={t('复制为新资源')} onClick={() => setEditor({ item: cloneItem(item, spec.resource), clone: true })}><Copy /></button>}
        {spec.resource === 'clients' && has('connections') && <button className="icon-btn" title={t('运行实例')} aria-label={t('运行实例')} onClick={() => setConnections(item)}><RadioTower /></button>}
        {spec.resource === 'clients' && actions.has('tunnels:list') && <button className="icon-btn" title={t('查看隧道')} aria-label={t('查看隧道')} onClick={() => navigateResource('tunnels', { client_id: item.id })}><NetworkIcon /></button>}
        {spec.resource === 'clients' && actions.has('hosts:list') && <button className="icon-btn" title={t('查看域名代理')} aria-label={t('查看域名代理')} onClick={() => navigateResource('hosts', { client_id: item.id })}><GlobeIcon /></button>}
        {spec.resource === 'clients' && (has('qrcode') || has('qrcode_generate')) && <button className="icon-btn" title={t('二维码')} aria-label={t('二维码')} onClick={() => setQRClient(item)}><QrCode /></button>}
        {spec.resource === 'clients' && has('kick') && item.is_connect && <button className="icon-btn" title={t('强制下线')} aria-label={t('强制下线')} onClick={() => ask(item, 'kick')}><Unplug /></button>}
        {has('ping') && resourceID(item) > 0 && <button className="icon-btn" title={t('测试延迟')} aria-label={t('测试延迟')} onClick={async () => { try { const id = resourceID(item); const data: any = await actionRequest(actions, spec.resource, 'ping', { id }, { id }); notify(`${t('延迟')} ${data.item?.rtt ?? data.rtt ?? '-'} ms`); } catch (error) { notify((error as Error).message, 'error'); } }}><Activity /></button>}
        {has('clear') && <button className="icon-btn" title={t('重置流量')} aria-label={t('重置流量')} onClick={() => ask(item, 'clear')}><RotateCcw /></button>}
        {has('start') && has('stop') && <button className="icon-btn" title={t(isEnabled(item, spec.resource) ? '停止' : '启动')} aria-label={t(isEnabled(item, spec.resource) ? '停止' : '启动')} onClick={() => ask(item, isEnabled(item, spec.resource) ? 'stop' : 'start')}>{isEnabled(item, spec.resource) ? <Square /> : <Play />}</button>}
        {has('status') && <button className="icon-btn" title={t(isEnabled(item, spec.resource) ? '停用' : '启用')} aria-label={t(isEnabled(item, spec.resource) ? '停用' : '启用')} onClick={() => ask(item, 'status')}>{isEnabled(item, spec.resource) ? <Ban /> : <Play />}</button>}
        {has('delete') && <button className="icon-btn" title={t('删除')} aria-label={t('删除')} onClick={() => ask(item, 'delete')}><Trash2 /></button>}
        {!has('update') && !has('delete') && <MoreHorizontal />}
      </div></td></tr>)}
    </tbody></table>{!loading && filtered.length === 0 && <div className="empty"><Search /><div>{t('没有匹配的数据')}</div></div>}</div>
    <div className="pagination"><span>{total ? `${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, total)} / ${total}` : `0 / 0`}</span><label>{t('每页')}<select value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }}><option value="10">10</option><option value="25">25</option><option value="50">50</option><option value="100">100</option></select></label><button className="icon-btn" disabled={page <= 1 || loading} onClick={() => setPage(value => Math.max(1, value - 1))} title={t('上一页')} aria-label={t('上一页')}><ArrowUp className="rotate-90" /></button><strong>{page} / {pageCount}</strong><button className="icon-btn" disabled={page >= pageCount || loading} onClick={() => setPage(value => Math.min(pageCount, value + 1))} title={t('下一页')} aria-label={t('下一页')}><ArrowDown className="rotate-90" /></button></div>
    {editor && <ResourceEditor discovery={discovery} actions={actions} spec={spec} item={editor.item} creating={!!editor.clone} busy={busy} notify={notify} onClose={() => setEditor(null)} onSave={save} />}
    {details && <ResourceDetailsDrawer discovery={discovery} actions={actions} spec={spec} item={details} notify={notify} onMutated={() => void load()} onClone={item => { setDetails(null); setEditor({ item: cloneItem(item, spec.resource), clone: true }); }} onClose={() => setDetails(null)} />}
    {connections && <ClientConnectionsDrawer item={connections} actions={actions} onClose={() => setConnections(null)} notify={notify} />}
    {qrClient && <ClientQRCodeDrawer item={qrClient} actions={actions} onClose={() => setQRClient(null)} notify={notify} />}
    {confirm && <ConfirmDialog title={confirm.title} message={confirm.message} danger={confirm.danger} busy={busy} onCancel={() => setConfirm(null)} onConfirm={() => void runAction()} />}
  </div>;
}

function ResourceEditor({ discovery, actions, spec, item, creating = false, busy, notify, onClose, onSave }: { discovery: Discovery; actions: Map<string, ActionEntry>; spec: ResourceSpec; item: AnyRecord | null; creating?: boolean; busy: boolean; notify: (message: string, type?: 'success' | 'error') => void; onClose: () => void; onSave: (body: AnyRecord, item: AnyRecord | null) => void }) {
  const { language, t } = useI18n();
  const [tab, setTab] = useState(spec.tabs[0].key);
  const [mode, setMode] = useState(String(item?.mode || valueFor(null, spec.fields.find(field => field.name === 'mode') || { name: 'mode', label: '' }) || ''));
  const [createVerifyKey] = useState(() => spec.resource === 'clients' && !item ? generateVerifyKey() : '');
  const [clientOptions, setClientOptions] = useState<SelectOption[]>([]);
  const [hostName, setHostName] = useState(String(item?.host || ''));
  const [certSuggestion, setCertSuggestion] = useState<AnyRecord | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (spec.resource !== 'tunnels' && spec.resource !== 'hosts') return;
    const entry = actions.get('clients:list');
    if (!entry) return;
    let active = true;
    request<ResourceList | AnyRecord[]>(`${entry.path}?offset=0&limit=0&order=asc`, { method: entry.method })
      .then(data => {
        if (!active) return;
        const clients = (Array.isArray(data) ? data : data.items || (data as AnyRecord).rows || [])
          .map(client => normalizeLegacyKeys(client) as AnyRecord);
        const options = clients.map(client => ({ value: Number(client.id), label: client.remark ? `${client.id} · ${client.remark}` : String(client.id) }));
        if (item?.client_id && !options.some(option => Number(option.value) === Number(item.client_id))) options.unshift({ value: Number(item.client_id), label: String(item.client_id) });
        setClientOptions(options);
      })
      .catch(error => notify((error as Error).message, 'error'));
    return () => { active = false; };
  }, [actions, item?.client_id, notify, spec.resource]);
  useEffect(() => {
    if (spec.resource !== 'hosts' || !hostName.trim()) { setCertSuggestion(null); return; }
    const entry = actions.get('hosts:cert_suggestion');
    if (!entry) return;
    let active = true;
    const timer = window.setTimeout(() => {
      request<any>(`${entry.path}?host=${encodeURIComponent(hostName.trim())}${item?.id ? `&exclude_id=${item.id}` : ''}`, { method: entry.method })
        .then(data => { if (active) setCertSuggestion(data?.item || data || null); })
        .catch(() => { if (active) setCertSuggestion(null); });
    }, 300);
    return () => { active = false; window.clearTimeout(timer); };
  }, [actions, hostName, item?.id, spec.resource]);
  const editing = !!item && !creating;
  const subtitle = editing ? language === 'en' ? `Resource #${item!.id} · ${t('修订')} ${item!.revision || 0}` : `资源 #${item!.id} · 修订 ${item!.revision || 0}` : t('填写配置后立即生效');
  return <Drawer title={t(mutationNames[spec.resource][editing ? 'update' : 'create'])} subtitle={subtitle} onClose={onClose} footer={<><button className="btn" onClick={onClose}>{t('取消')}</button><button className="btn primary" disabled={busy} onClick={() => { const form = formRef.current; if (!form?.reportValidity()) return; try { onSave(formBody(form, spec, editing ? item : null), editing ? item : null); } catch (error) { notify((error as Error).message, 'error'); } }}>{t(busy ? '保存中…' : '保存')}</button></>}>
    <div className="tabs">{spec.tabs.map(current => <button type="button" className={`tab ${tab === current.key ? 'active' : ''}`} key={current.key} onClick={() => setTab(current.key)}>{t(current.label)}</button>)}</div>
    {tab === 'tls' && certSuggestion?.source_host_id && <div className="suggestion-bar"><div><strong>{t('发现可复用证书')}</strong><span>{certSuggestion.source_host}</span></div>{certSuggestion.can_apply_to_form && <button type="button" className="btn" onClick={() => { const form = formRef.current; const cert = form?.elements.namedItem('cert_file') as HTMLTextAreaElement | null; const key = form?.elements.namedItem('key_file') as HTMLTextAreaElement | null; if (cert) cert.value = certSuggestion.cert_file || ''; if (key) key.value = certSuggestion.key_file || ''; notify(t('证书已填入表单')); }}><Copy />{t('应用')}</button>}</div>}
    <form ref={formRef} className="resource-form" onSubmit={event => event.preventDefault()} onChange={event => { const target = event.target as HTMLInputElement | HTMLSelectElement; if (target.name === 'mode') setMode(target.value); if (target.name === 'host') setHostName(target.value); }}>{spec.tabs.map(current => <div className="tab-panel form-grid" key={current.key} hidden={tab !== current.key}>{spec.fields.filter(field => (field.tab || 'basic') === current.key && (!field.feature || discovery.features[field.feature] !== false) && (!field.editOnly || !!item) && (!field.modes || field.modes.includes(mode))).map(field => <Field key={`${field.name}-${field.name === 'client_id' ? clientOptions.length : 0}`} field={field} value={field.name === 'mode' ? mode : field.name === 'verify_key' && createVerifyKey ? createVerifyKey : valueFor(item, field)} options={field.name === 'client_id' ? clientOptions : undefined} />)}</div>)}</form>
  </Drawer>;
}

function ResourceDetailsDrawer({ discovery, actions, spec, item, notify, onMutated, onClone, onClose }: { discovery: Discovery; actions: Map<string, ActionEntry>; spec: ResourceSpec; item: AnyRecord; notify: (message: string, type?: 'success' | 'error') => void; onMutated: () => void; onClone?: (item: AnyRecord) => void; onClose: () => void }) {
  const { t } = useI18n();
  const [current, setCurrent] = useState(item);
  const [runtime, setRuntime] = useState<AnyRecord>({});
  const [client, setClient] = useState<AnyRecord | null>(spec.resource === 'clients' ? item : item.client || null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    const overviewURL = discovery.routes.overview || discovery.routes.dashboard;
    if (overviewURL) request<any>(overviewURL).then(data => { if (active) setRuntime(data?.registration || data || {}); }).catch(() => {});
    if (spec.resource !== 'clients' && item.client_id) {
      const entry = actions.get('clients:read');
      if (entry) request<any>(materialize(entry.path, { id: item.client_id }), { method: entry.method }).then(data => { if (active) setClient(normalizeLegacyKeys(data?.item || data || null) as AnyRecord); }).catch(() => {});
    }
    return () => { active = false; };
  }, [actions, discovery.routes, item, spec.resource]);
  const fields = spec.fields.filter(field => !field.uiOnly && !field.editOnly && field.name !== 'reset_flow' && (!field.feature || discovery.features[field.feature] !== false) && (!field.modes || field.modes.includes(String(current.mode || ''))));
  const commands = connectionCommands(spec.resource, current, client, runtime);
  const controls = resourceControls(spec.resource, current).filter(control => actions.has(`${spec.resource}:${control.kind === 'clear' ? 'clear' : control.enabled ? 'stop' : 'start'}`));
  async function runControl(control: ResourceControl) {
    const action = control.kind === 'clear' ? 'clear' : control.enabled ? 'stop' : 'start';
    setBusy(true);
    try {
      const data: any = await actionRequest(actions, spec.resource, action, { id: current.id }, { mode: control.mode });
      if (data?.item) setCurrent((value: AnyRecord) => ({ ...value, ...data.item }));
      else if (control.field) setCurrent((value: AnyRecord) => ({ ...value, [control.field!]: !control.enabled }));
      notify(t('操作完成'));
      onMutated();
    } catch (error) { notify((error as Error).message, 'error'); }
    finally { setBusy(false); }
  }
  return <Drawer title={t('配置详情')} subtitle={`${t(spec.title)} #${current.id} · ${t('修订')} ${current.revision || 0}`} onClose={onClose} footer={<><button className="btn" onClick={onClose}>{t('关闭')}</button>{onClone && <button className="btn primary" onClick={() => onClone(current)}><Copy />{t('复制为新资源')}</button>}</>}>
    <div className="detail-sections">{controls.length > 0 && <section className="detail-section"><h3>{t('快捷控制')}</h3><div className="control-list">{controls.map(control => <button className="control-item" type="button" disabled={busy} key={control.mode} onClick={() => void runControl(control)}><span>{t(control.label)}</span>{control.kind === 'toggle' && <small className={`badge ${control.enabled ? 'ok' : 'off'}`}>{t(control.enabled ? '已启用' : '已停用')}</small>}{control.kind === 'clear' ? <RotateCcw /> : control.enabled ? <Square /> : <Play />}</button>)}</div></section>}{commands.length > 0 && <section className="detail-section"><h3>{t('连接命令')}</h3><div className="command-list">{commands.map(command => <div key={command.label}><span>{command.label}</span><code>{command.value}</code><button className="icon-btn" type="button" title={t('复制')} aria-label={t('复制')} onClick={() => void copyValue(command.value, t, notify)}><Copy /></button></div>)}</div></section>}{runtimeFields(spec.resource, current).length > 0 && <section className="detail-section"><h3>{t('运行状态')}</h3><dl className="detail-grid">{runtimeFields(spec.resource, current).map(field => <DetailValue key={field.name} label={t(field.label)} value={field.value} t={t} notify={notify} />)}</dl></section>}{spec.tabs.map(tab => {
      const tabFields = fields.filter(field => (field.tab || 'basic') === tab.key);
      if (!tabFields.length) return null;
      return <section className="detail-section" key={tab.key}><h3>{t(tab.label)}</h3><dl className="detail-grid">{tabFields.map(field => <DetailValue key={field.name} label={t(field.label)} value={valueFor(current, field)} present={fieldReturned(current, field)} t={t} notify={notify} />)}</dl></section>;
    })}</div>
  </Drawer>;
}

interface ResourceControl { mode: string; label: string; kind: 'clear' | 'toggle'; field?: string; enabled?: boolean }
function resourceControls(resource: string, item: AnyRecord): ResourceControl[] {
  const controls: ResourceControl[] = [{ mode: 'flow', label: '重置流量', kind: 'clear' }];
  if (resource === 'clients') controls.push(
    { mode: 'flow_limit', label: '清除流量上限', kind: 'clear' },
    { mode: 'time_limit', label: '清除到期限制', kind: 'clear' },
    { mode: 'rate_limit', label: '清除速率上限', kind: 'clear' },
    { mode: 'conn_limit', label: '清除连接数限制', kind: 'clear' },
    { mode: 'tunnel_limit', label: '清除隧道数限制', kind: 'clear' },
  );
  if (resource === 'tunnels' || resource === 'hosts') controls.push(
    { mode: 'flow_limit', label: '清除流量上限', kind: 'clear' },
    { mode: 'time_limit', label: '清除到期限制', kind: 'clear' },
  );
  if (resource === 'tunnels' && item.mode === 'mixProxy') controls.push(
    { mode: 'http', label: '启用 HTTP 代理', kind: 'toggle', field: 'enable_http', enabled: !!item.enable_http },
    { mode: 'socks5', label: '启用 Socks5 代理', kind: 'toggle', field: 'enable_socks5', enabled: !!item.enable_socks5 },
  );
  if (resource === 'hosts') {
    for (const [mode, label] of [
      ['auto_ssl', '自动申请证书'], ['https_just_proxy', 'TLS 透传'], ['tls_offload', 'TLS 卸载'],
      ['auto_https', '自动跳转 HTTPS'], ['auto_cors', '自动 CORS'], ['compat_mode', '兼容模式'], ['target_is_https', 'HTTPS 上游'],
    ]) controls.push({ mode, label, kind: 'toggle', field: mode, enabled: !!item[mode] });
  }
  return controls;
}

function connectionCommands(resource: string, item: AnyRecord, client: AnyRecord | null, runtime: AnyRecord) {
  const bridge = runtime.display?.bridge || {};
  const verifyKey = resource === 'clients' ? item.verify_key : client?.verify_key;
  if (!verifyKey) return [] as Array<{ label: string; value: string }>;
  if (resource === 'clients') {
    return ['tcp', 'kcp', 'tls', 'quic', 'ws', 'wss'].flatMap(type => {
      const transport = bridge[type];
      if (!transport?.enabled) return [];
      let address = transport.addr || [transport.ip, transport.port].filter(Boolean).join(':');
      if ((type === 'ws' || type === 'wss') && bridge.path && !address.endsWith(bridge.path)) address += bridge.path;
      return address ? [{ label: type.toUpperCase(), value: `./npc -server="${address}" -vkey="${verifyKey}" -type="${type}"` }] : [];
    });
  }
  if (resource === 'tunnels' && (item.mode === 'secret' || item.mode === 'p2p')) {
    const primary = bridge.primary || {};
    const address = primary.addr || [primary.ip, primary.port].filter(Boolean).join(':');
    const type = primary.type || 'tcp';
    if (!address) return [];
    if (item.mode === 'secret') return [{ label: 'Secret', value: `./npc -server="${address}" -vkey="${verifyKey}" -type="${type}" -password="${item.password || ''}" -target_type="${item.target_type || 'all'}" -local_type="secret"` }];
    return [{ label: 'P2P', value: `./npc -server="${address}" -vkey="${verifyKey}" -type="${type}" -password="${item.password || ''}" -target="${item.target || ''}" -target_type="${item.target_type || 'all'}"` }];
  }
  return [];
}

async function copyValue(value: string, t: (value: string) => string, notify: (message: string, type?: 'success' | 'error') => void) {
  try { await navigator.clipboard.writeText(value); notify(t('已复制')); }
  catch { notify(t('复制失败'), 'error'); }
}

function DetailValue({ label, value, present = true, t, notify }: { label: string; value: any; present?: boolean; t: (value: string) => string; notify: (message: string, type?: 'success' | 'error') => void }) {
  const display = !present ? t('未返回或无权限') : typeof value === 'boolean' ? t(value ? '是' : '否') : Array.isArray(value) ? value.join(', ') : String(value ?? '') || '-';
  return <div><dt>{label}</dt><dd className={typeof value === 'string' && value.length > 24 ? 'mono' : ''}><span>{display}</span>{display !== '-' && <button className="icon-btn" type="button" title={t('复制')} aria-label={t('复制')} onClick={() => void copyValue(display, t, notify)}><Copy /></button>}</dd></div>;
}

function fieldReturned(item: AnyRecord, field: FieldSpec) {
  return Object.prototype.hasOwnProperty.call(item, field.name) && item[field.name] !== undefined && item[field.name] !== null;
}

function runtimeFields(resource: string, item: AnyRecord) {
  const fields: Array<{ name: string; label: string; value: any }> = [];
  if (resource === 'clients') fields.push(
    { name: 'last_online_time', label: '最后在线时间', value: item.last_online_time || '-' },
    { name: 'total_in_bytes', label: '接收流量', value: formatBytes(Number(item.total_in_bytes || 0)) },
    { name: 'total_out_bytes', label: '发送流量', value: formatBytes(Number(item.total_out_bytes || 0)) },
    { name: 'total_now_rate_total_bps', label: '实时速率', value: `${formatBytes(Number(item.total_now_rate_total_bps || 0), true)}/s` },
  );
  if (resource === 'tunnels' || resource === 'hosts') fields.push(
    { name: 'now_conn', label: '连接数', value: item.now_conn ?? 0 },
    { name: 'service_in_bytes', label: '接收流量', value: formatBytes(Number(item.service_in_bytes || 0)) },
    { name: 'service_out_bytes', label: '发送流量', value: formatBytes(Number(item.service_out_bytes || 0)) },
    { name: 'now_rate_total_bps', label: '实时速率', value: `${formatBytes(Number(item.now_rate_total_bps || 0), true)}/s` },
  );
  if (resource === 'hosts') fields.push({ name: 'cert_expire_at', label: '证书到期时间', value: item.cert_expire_at ? new Date(Number(item.cert_expire_at) * 1000).toLocaleString() : '-' });
  return fields;
}

function ClientConnectionsDrawer({ item, actions, notify, onClose }: { item: AnyRecord; actions: Map<string, ActionEntry>; notify: (message: string, type?: 'success' | 'error') => void; onClose: () => void }) {
  const { language, t } = useI18n();
  const [connections, setConnections] = useState<AnyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const entry = actions.get('clients:connections');
    if (!entry) return;
    let active = true;
    setLoading(true);
    request<ResourceList | AnyRecord[]>(materialize(entry.path, { id: item.id }), { method: entry.method })
      .then(data => {
        if (!active) return;
        const rows = Array.isArray(data) ? data : data.items || (data as AnyRecord).rows || [];
        setConnections(rows.map(connection => normalizeLegacyKeys(connection) as AnyRecord));
      })
      .catch(error => notify((error as Error).message, 'error'))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [actions, item.id, notify]);
  const subtitle = language === 'en' ? `Client #${item.id} · ${item.remark || item.verify_key || ''}` : `客户端 #${item.id} · ${item.remark || item.verify_key || ''}`;
  return <Drawer title={t('运行实例')} subtitle={subtitle} onClose={onClose} footer={<button className="btn" onClick={onClose}>{t('关闭')}</button>}>
    <div className="connection-list">{loading ? Array.from({ length: 3 }, (_, index) => <div className="connection-item" key={index}><div className="skeleton">loading</div></div>) : connections.map(connection => <article className="connection-item" key={connection.uuid || connection.remote_addr}>
      <header><div><strong className="mono">{connection.uuid || '-'}</strong><span className={`badge ${connection.is_online ? 'ok' : 'off'}`}>{t(connection.is_online ? '在线' : '离线')}</span></div><small>{connection.version || '-'} · {connection.connected_at_text || formatTimestamp(connection.connected_at)}</small></header>
      <dl className="connection-details"><DetailRow label={t('远端地址')} value={connection.remote_addr || '-'} /><DetailRow label={t('本地地址')} value={connection.local_addr || '-'} /><DetailRow label={t('连接数')} value={connection.now_conn || 0} /><DetailRow label={t('累计流量')} value={formatBytes(Number(connection.total_bytes || 0))} /></dl>
    </article>)}{!loading && connections.length === 0 && <div className="empty"><RadioTower /><div>{t('暂无运行实例')}</div></div>}</div>
  </Drawer>;
}

function ClientQRCodeDrawer({ item, actions, notify, onClose }: { item: AnyRecord; actions: Map<string, ActionEntry>; notify: (message: string, type?: 'success' | 'error') => void; onClose: () => void }) {
  const { t } = useI18n();
  const [text, setText] = useState(String(item.verify_key || ''));
  const [imageURL, setImageURL] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => () => { if (imageURL) URL.revokeObjectURL(imageURL); }, [imageURL]);
  async function generate() {
    const entry = actions.get('clients:qrcode') || actions.get('clients:qrcode_generate');
    if (!entry || !text.trim()) return;
    setBusy(true);
    try {
      const isGet = entry.method.toUpperCase() === 'GET';
      const separator = entry.path.includes('?') ? '&' : '?';
      const url = isGet ? `${entry.path}${separator}text=${encodeURIComponent(text.trim())}` : entry.path;
      const blob = await requestBlob(url, {
        method: entry.method,
        body: isGet ? undefined : JSON.stringify({ text: text.trim() }),
      });
      if (imageURL) URL.revokeObjectURL(imageURL);
      setImageURL(URL.createObjectURL(blob));
    } catch (error) { notify((error as Error).message, 'error'); }
    finally { setBusy(false); }
  }
  return <Drawer title={t('客户端二维码')} subtitle={`#${item.id} · ${item.remark || item.verify_key || ''}`} onClose={onClose} footer={<><button className="btn" onClick={onClose}>{t('关闭')}</button><button className="btn primary" disabled={busy || !text.trim()} onClick={() => void generate()}><QrCode />{t(busy ? '生成中…' : '生成二维码')}</button></>}>
    <div className="qr-editor"><div className="field full"><label htmlFor="qr-text">{t('二维码内容')}</label><textarea id="qr-text" rows={5} value={text} onChange={event => setText(event.target.value)} placeholder={t('输入客户端命令、配置地址或验证密钥')} /></div>{imageURL ? <img className="qr-image" src={imageURL} alt={t('客户端二维码')} /> : <div className="qr-placeholder"><QrCode /><span>{t('生成后可扫码导入')}</span></div>}</div>
  </Drawer>;
}

function DetailRow({ label, value }: { label: string; value: any }) {
  return <div><dt>{label}</dt><dd>{String(value)}</dd></div>;
}

function formatTimestamp(value: number) {
  return value ? new Date(value * 1000).toLocaleString() : '-';
}

function Field({ field, value, options }: { field: FieldSpec; value: any; options?: SelectOption[] }) {
  const { t } = useI18n();
  if (field.type === 'checkbox') return <div className={`field ${field.full ? 'full' : ''}`}><div className="check-field"><input id={`field-${field.name}`} name={field.name} type="checkbox" defaultChecked={!!value} /><label htmlFor={`field-${field.name}`}>{t(field.label)}</label></div>{field.help && <small>{t(field.help)}</small>}</div>;
  const common = { name: field.name, id: `field-${field.name}`, defaultValue: value, required: field.required, placeholder: field.placeholder ? t(field.placeholder) : undefined };
  if (field.name === 'mode') return <div className="field full mode-field"><label>{t(field.label)}</label><div className="mode-picker" role="radiogroup" aria-label={t(field.label)}>{tunnelModeOptions.map(option => {
    const selected = String(value) === String(option.value);
    return <label className={`mode-option ${selected ? 'selected' : ''}`} key={option.value}>
      <input name={field.name} type="radio" value={option.value} defaultChecked={selected} required={field.required} />
      <span className="mode-option-copy"><strong>{t(option.label)}</strong><small>{t(tunnelModeDetails[String(option.value)])}</small></span>
    </label>;
  })}</div>{field.help && <small>{t(field.help)}</small>}</div>;
  return <div className={`field ${field.full ? 'full' : ''}`}><label htmlFor={common.id}>{t(field.label)}</label>
    {field.type === 'textarea' ? <textarea {...common} rows={4} /> : field.type === 'select' ? <select {...common}>{field.name === 'client_id' && <option value="" disabled>{t('选择客户端')}</option>}{(options || field.options)?.map(option => <option value={option.value} key={option.value}>{t(option.label)}</option>)}</select> : <input {...common} type={field.type || 'text'} step={field.type === 'number' ? 1 : undefined} />}
    {field.help && <small>{t(field.help)}</small>}
  </div>;
}

function isEnabled(item: AnyRecord, resource: string) {
  if (resource === 'hosts') return !item.is_close;
  return item.run_status ?? item.status ?? item.is_connect;
}

function renderCell(item: AnyRecord, key: string, kind = '', t: (value: string) => string) {
  const value = item[key];
  if (kind === 'title') return <div><div className="cell-title">{value || t('未命名')}</div>{item.id && key !== 'username' && <div className="cell-sub">#{item.id}</div>}</div>;
  if (kind === 'online' || kind === 'inverseOnline') {
    const enabled = kind === 'inverseOnline' ? !value : !!value;
    return <span className={`badge ${enabled ? 'ok' : 'off'}`}>{t(enabled ? '正常' : '停用')}</span>;
  }
  if (kind === 'bytes') return <span className="mono">{formatBytes(Number(value || 0), key.includes('rate'))}{key.includes('rate') && '/s'}</span>;
  if (kind === 'time') return value ? new Date(Number(value) * 1000).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : t('无限制');
  if (kind === 'client') return String(item.client?.remark || value || '-');
  if (kind === 'mono' || kind === 'id' || kind === 'number') return <span className="mono">{String(value ?? '-')}</span>;
  if (kind === 'mode') return <span className="badge mode-badge">{modeLabel(value, t)}</span>;
  return String(value ?? '-');
}

function modeLabel(value: unknown, t: (value: string) => string) {
  const option = tunnelModeOptions.find(item => String(item.value) === String(value));
  return option ? t(option.label) : String(value || '-');
}

function resourceID(item: AnyRecord) {
  return Number(item.id ?? item.ID ?? 0);
}

function adaptLegacyItem(resource: string, item: AnyRecord) {
  const result = { ...item };
  if (result.client?.id !== undefined) result.client_id = result.client.id;
  if (result.target && typeof result.target === 'object') result.target = result.target.target_str || result.target.targetStr || '';
  if (result.flow && typeof result.flow === 'object') {
    const flow = result.flow;
    result.total_bytes = Number(flow.inlet_flow || 0) + Number(flow.export_flow || 0);
    result.service_total_bytes = result.total_bytes;
  }
  if (resource === 'clients') result.total_bytes = Number(result.inlet_flow || 0) + Number(result.export_flow || 0);
  if (resource === 'tunnels') result.run_status = result.run_status ?? result.status;
  return result;
}

function generateVerifyKey() {
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else for (let index = 0; index < bytes.length; index++) bytes[index] = Math.floor(Math.random() * 256);
  return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
}

export function formatBytes(value: number, bits = false) {
  const unit = bits ? 1000 : 1024;
  const labels = bits ? ['bit', 'Kbit', 'Mbit', 'Gbit', 'Tbit'] : ['B', 'KB', 'MB', 'GB', 'TB'];
  let index = 0;
  while (Math.abs(value) >= unit && index < labels.length - 1) { value /= unit; index++; }
  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${labels[index]}`;
}

function readHashQuery() {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const index = raw.indexOf('?');
  return new URLSearchParams(index >= 0 ? raw.slice(index + 1) : '');
}

function updateHashQuery(values: Record<string, string | number>) {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const page = raw.split('?')[0] || 'dashboard';
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (String(value) === '') continue;
    if (key === 'page' && Number(value) === 1) continue;
    if (key === 'limit' && Number(value) === 25) continue;
    if (key === 'order' && value === 'asc') continue;
    query.set(key, String(value));
  }
  const next = `#/${page}${query.toString() ? `?${query}` : ''}`;
  if (window.location.hash !== next) window.history.replaceState(null, '', next);
}

function navigateResource(page: 'tunnels' | 'hosts', params: Record<string, string | number>) {
  const query = new URLSearchParams(Object.entries(params).map(([key, value]) => [key, String(value)]));
  window.location.hash = `/${page}?${query}`;
}

function cloneItem(item: AnyRecord, resource: string) {
  const clone = { ...item };
  for (const key of ['id', 'revision', 'updated_at', 'read_only', 'run_status', 'is_connect', 'is_close', 'status', 'total_bytes', 'service_total_bytes', 'now_conn', 'now_rate_total_bps']) delete clone[key];
  if (resource === 'tunnels') clone.port = 0;
  return clone;
}

function sortFieldForResource(resource: string, key: string) {
  const common: Record<string, string> = { id: 'Id', remark: 'Remark', client_id: 'Client.Id', target: 'Target.TargetStr', port: 'Port', mode: 'Mode', status: 'Status', is_connect: 'IsConnect', now_conn: 'NowConn', expire_at: 'ExpireAt', total_bytes: 'TotalFlow', service_total_bytes: 'TotalFlow', now_rate_total_bps: 'NowRate', service_now_rate_total_bps: 'NowRate', run_status: 'Status' };
  if (resource === 'clients') return ({ ...common, addr: 'Addr', version: 'Version', total_now_rate_total_bps: 'NowRate' } as Record<string, string>)[key] || 'Id';
  if (resource === 'hosts') return ({ ...common, host: 'Host', is_close: 'Status' } as Record<string, string>)[key] || 'Id';
  return common[key] || 'Id';
}
