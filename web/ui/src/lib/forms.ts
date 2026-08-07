import type { AnyRecord } from './types';

export interface SelectOption { value: string | number; label: string }
export interface FieldSpec {
  name: string;
  label: string;
  type?: 'text' | 'password' | 'number' | 'datetime-local' | 'textarea' | 'select' | 'checkbox';
  tab?: string;
  full?: boolean;
  required?: boolean;
  options?: SelectOption[];
  placeholder?: string;
  help?: string;
  createOnly?: boolean;
  editOnly?: boolean;
  uiOnly?: boolean;
  feature?: string;
  modes?: string[];
}

export interface ResourceSpec {
  resource: 'clients' | 'tunnels' | 'hosts' | 'users' | 'webhooks';
  singular: string;
  title: string;
  description: string;
  searchKeys: string[];
  columns: Array<{ key: string; label: string; kind?: string }>;
  fields: FieldSpec[];
  tabs: Array<{ key: string; label: string }>;
}

const aclOptions: SelectOption[] = [
  { value: 0, label: '禁用' },
  { value: 1, label: '白名单' },
  { value: 2, label: '黑名单' },
];

const limitFields: FieldSpec[] = [
  { name: 'flow_limit_total_bytes', label: '流量上限（字节）', type: 'number', tab: 'limits', feature: 'allow_flow_limit', help: '0 表示不限制' },
  { name: 'rate_limit_total_bps', label: '速率上限（bit/s）', type: 'number', tab: 'limits', feature: 'allow_rate_limit', help: '0 表示不限制' },
  { name: 'max_connections', label: '最大连接数', type: 'number', tab: 'limits', feature: 'allow_connection_num_limit' },
  { name: 'expire_at', label: '到期时间', type: 'datetime-local', tab: 'limits', feature: 'allow_time_limit' },
  { name: 'reset_flow', label: '保存时重置流量', type: 'checkbox', tab: 'limits' },
];

const aclFields: FieldSpec[] = [
  { name: 'entry_acl_mode', label: '入口访问控制', type: 'select', options: aclOptions, tab: 'security' },
  { name: 'entry_acl_rules', label: '入口规则', type: 'textarea', full: true, tab: 'security', help: '每行一条 IP、CIDR 或规则' },
];

export const resourceSpecs: Record<string, ResourceSpec> = {
  clients: {
    resource: 'clients', singular: 'client', title: '客户端', description: '管理接入节点、认证和资源配额',
    searchKeys: ['id', 'remark', 'addr', 'verify_key', 'version'],
    columns: [
      { key: 'id', label: 'ID', kind: 'id' }, { key: 'remark', label: '备注', kind: 'title' },
      { key: 'is_connect', label: '连接', kind: 'online' }, { key: 'addr', label: '地址', kind: 'mono' },
      { key: 'now_conn', label: '连接数', kind: 'number' }, { key: 'total_now_rate_total_bps', label: '实时速率', kind: 'bytes' },
      { key: 'total_bytes', label: '累计流量', kind: 'bytes' }, { key: 'expire_at', label: '到期', kind: 'time' },
    ],
    tabs: [{ key: 'basic', label: '基础' }, { key: 'limits', label: '配额' }, { key: 'security', label: '安全' }],
    fields: [
      { name: 'remark', label: '备注', required: true }, { name: 'verify_key', label: '验证密钥', required: true },
      { name: 'owner_user_id', label: '所属用户 ID', type: 'number' }, { name: 'manager_user_ids', label: '协管用户 ID', placeholder: '例如 2, 5, 8' },
      { name: 'username', label: '配置用户名' }, { name: 'password', label: '配置密码', type: 'password', help: '编辑时留空表示保持不变' },
      { name: 'clear_password', label: '清空配置密码', type: 'checkbox', editOnly: true, uiOnly: true },
      { name: 'compress', label: '启用压缩', type: 'checkbox' }, { name: 'crypt', label: '启用加密', type: 'checkbox' },
      { name: 'config_conn_allow', label: '允许客户端配置连接', type: 'checkbox' },
      ...limitFields,
      { name: 'max_tunnel_num', label: '最大隧道数', type: 'number', tab: 'limits', feature: 'allow_tunnel_num_limit' },
      ...aclFields,
    ],
  },
  tunnels: {
    resource: 'tunnels', singular: 'tunnel', title: '隧道', description: '管理 TCP、UDP、混合代理与 P2P 服务',
    searchKeys: ['id', 'remark', 'mode', 'target', 'port', 'client_id'],
    columns: [
      { key: 'id', label: 'ID', kind: 'id' }, { key: 'remark', label: '备注', kind: 'title' },
      { key: 'mode', label: '模式', kind: 'mode' }, { key: 'client_id', label: '客户端', kind: 'id' },
      { key: 'port', label: '服务端口', kind: 'number' }, { key: 'target', label: '目标', kind: 'mono' },
      { key: 'run_status', label: '状态', kind: 'online' }, { key: 'now_rate_total_bps', label: '实时速率', kind: 'bytes' },
      { key: 'service_total_bytes', label: '累计流量', kind: 'bytes' },
    ],
    tabs: [{ key: 'basic', label: '基础' }, { key: 'routing', label: '路由' }, { key: 'limits', label: '配额' }, { key: 'security', label: '安全' }],
    fields: [
      { name: 'client_id', label: '客户端 ID', type: 'select', required: true, options: [] }, { name: 'remark', label: '备注' },
      { name: 'mode', label: '模式', type: 'select', required: true, options: ['tcp', 'udp', 'mixProxy', 'secret', 'p2p', 'file'].map(value => ({ value, label: value })) },
      { name: 'server_ip', label: '监听地址', placeholder: '0.0.0.0', feature: 'allow_multi_ip', modes: ['tcp', 'udp', 'mixProxy', 'file'] },
      { name: 'port', label: '服务端口', type: 'number', modes: ['tcp', 'udp', 'mixProxy', 'file'] },
      { name: 'target_type', label: '目标协议', type: 'select', tab: 'routing', modes: ['secret', 'p2p'], options: ['all', 'tcp', 'udp'].map(value => ({ value, label: value })) },
      { name: 'target', label: '目标地址', type: 'textarea', full: true, tab: 'routing', modes: ['tcp', 'udp', 'secret', 'p2p'], placeholder: '127.0.0.1:8080' },
      { name: 'proxy_protocol', label: 'Proxy Protocol', type: 'select', tab: 'routing', modes: ['tcp', 'udp'], options: [{ value: 0, label: '禁用' }, { value: 1, label: 'v1' }, { value: 2, label: 'v2' }] },
      { name: 'local_proxy', label: '代理到服务端本机', type: 'checkbox', tab: 'routing', feature: 'allow_local_proxy', modes: ['tcp', 'udp', 'secret', 'p2p'] },
      { name: 'local_path', label: '本地路径', tab: 'routing', modes: ['file'] }, { name: 'strip_pre', label: '移除路径前缀', tab: 'routing', modes: ['file'] },
      { name: 'enable_http', label: '启用 HTTP 代理', type: 'checkbox', tab: 'routing', modes: ['mixProxy'] }, { name: 'enable_socks5', label: '启用 Socks5 代理', type: 'checkbox', tab: 'routing', modes: ['mixProxy'] },
      ...limitFields,
      ...aclFields,
      { name: 'dest_acl_mode', label: '目标访问控制', type: 'select', options: aclOptions, tab: 'security', modes: ['mixProxy'] },
      { name: 'dest_acl_rules', label: '目标规则', type: 'textarea', full: true, tab: 'security', modes: ['mixProxy'] },
      { name: 'auth', label: '代理认证', type: 'textarea', full: true, tab: 'security', modes: ['mixProxy'] },
      { name: 'password', label: '识别密钥', type: 'password', tab: 'security', modes: ['secret', 'p2p'] },
    ],
  },
  hosts: {
    resource: 'hosts', singular: 'host', title: '域名代理', description: '管理 HTTP/HTTPS 域名、证书和请求改写',
    searchKeys: ['id', 'remark', 'host', 'target', 'client_id'],
    columns: [
      { key: 'id', label: 'ID', kind: 'id' }, { key: 'host', label: '域名', kind: 'title' },
      { key: 'scheme', label: '协议', kind: 'mode' }, { key: 'client_id', label: '客户端', kind: 'id' },
      { key: 'target', label: '目标', kind: 'mono' }, { key: 'is_close', label: '状态', kind: 'inverseOnline' },
      { key: 'now_rate_total_bps', label: '实时速率', kind: 'bytes' }, { key: 'service_total_bytes', label: '累计流量', kind: 'bytes' },
    ],
    tabs: [{ key: 'basic', label: '基础' }, { key: 'routing', label: '请求处理' }, { key: 'tls', label: 'TLS' }, { key: 'limits', label: '配额' }, { key: 'security', label: '安全' }],
    fields: [
      { name: 'client_id', label: '客户端 ID', type: 'select', required: true, options: [] }, { name: 'remark', label: '备注' },
      { name: 'host', label: '域名', required: true, placeholder: 'example.com' },
      { name: 'scheme', label: '协议', type: 'select', options: ['all', 'http', 'https'].map(value => ({ value, label: value.toUpperCase() })) },
      { name: 'target', label: '目标地址', type: 'textarea', full: true, placeholder: '127.0.0.1:8080' },
      { name: 'location', label: '匹配路径', tab: 'routing', placeholder: '/' }, { name: 'path_rewrite', label: '路径重写', tab: 'routing' },
      { name: 'host_change', label: 'Host 改写', tab: 'routing' }, { name: 'redirect_url', label: '重定向 URL', tab: 'routing' },
      { name: 'header', label: '请求头操作', type: 'textarea', full: true, tab: 'routing' }, { name: 'resp_header', label: '响应头操作', type: 'textarea', full: true, tab: 'routing' },
      { name: 'auto_cors', label: '自动 CORS', type: 'checkbox', tab: 'routing' }, { name: 'compat_mode', label: '兼容模式', type: 'checkbox', tab: 'routing' },
      { name: 'target_is_https', label: 'HTTPS 上游', type: 'checkbox', tab: 'routing' }, { name: 'local_proxy', label: '代理到服务端本机', type: 'checkbox', tab: 'routing', feature: 'allow_local_proxy' },
      { name: 'https_just_proxy', label: 'TLS 透传', type: 'checkbox', tab: 'tls' }, { name: 'tls_offload', label: 'TLS 卸载', type: 'checkbox', tab: 'tls' },
      { name: 'auto_ssl', label: '自动申请证书', type: 'checkbox', tab: 'tls' }, { name: 'auto_https', label: '自动跳转 HTTPS', type: 'checkbox', tab: 'tls' },
      { name: 'cert_file', label: '证书内容或路径', type: 'textarea', full: true, tab: 'tls' }, { name: 'key_file', label: '私钥内容或路径', type: 'textarea', full: true, tab: 'tls' },
      { name: 'sync_cert_to_matching_hosts', label: '同步证书到同域名规则', type: 'checkbox', tab: 'tls' },
      ...limitFields,
      ...aclFields,
      { name: 'proxy_protocol', label: 'Proxy Protocol', type: 'select', tab: 'security', options: [{ value: 0, label: '禁用' }, { value: 1, label: 'v1' }, { value: 2, label: 'v2' }] },
      { name: 'auth', label: 'Basic Auth', type: 'textarea', full: true, tab: 'security' },
    ],
  },
  users: {
    resource: 'users', singular: 'user', title: '用户', description: '管理租户账号、配额和访问边界',
    searchKeys: ['id', 'username', 'kind', 'external_platform_id'],
    columns: [
      { key: 'id', label: 'ID', kind: 'id' }, { key: 'username', label: '用户名', kind: 'title' },
      { key: 'kind', label: '类型', kind: 'mode' }, { key: 'status', label: '状态', kind: 'userStatus' },
      { key: 'max_clients', label: '客户端额度', kind: 'number' }, { key: 'max_tunnels', label: '隧道额度', kind: 'number' },
      { key: 'max_hosts', label: '域名额度', kind: 'number' }, { key: 'total_bytes', label: '累计流量', kind: 'bytes' },
      { key: 'expire_at', label: '到期', kind: 'time' },
    ],
    tabs: [{ key: 'basic', label: '账号' }, { key: 'limits', label: '配额' }, { key: 'security', label: '访问控制' }],
    fields: [
      { name: 'username', label: '用户名', required: true }, { name: 'password', label: '密码', type: 'password', help: '编辑时留空表示保持不变' },
      { name: 'clear_password', label: '清空密码', type: 'checkbox', editOnly: true, uiOnly: true },
      { name: 'totp_secret', label: 'TOTP 密钥', type: 'password' }, { name: 'clear_totp_secret', label: '清空 TOTP 密钥', type: 'checkbox', editOnly: true, uiOnly: true }, { name: 'status', label: '启用账号', type: 'checkbox' },
      { name: 'expire_at', label: '到期时间', type: 'datetime-local', tab: 'limits', feature: 'allow_time_limit' },
      { name: 'flow_limit_total_bytes', label: '流量上限（字节）', type: 'number', tab: 'limits', feature: 'allow_flow_limit' },
      { name: 'rate_limit_total_bps', label: '速率上限（bit/s）', type: 'number', tab: 'limits', feature: 'allow_rate_limit' },
      { name: 'max_connections', label: '最大连接数', type: 'number', tab: 'limits' },
      { name: 'max_clients', label: '客户端数量', type: 'number', tab: 'limits' }, { name: 'max_tunnels', label: '隧道数量', type: 'number', tab: 'limits' },
      { name: 'max_hosts', label: '域名数量', type: 'number', tab: 'limits' }, { name: 'reset_flow', label: '保存时重置流量', type: 'checkbox', tab: 'limits' },
      ...aclFields,
      { name: 'dest_acl_mode', label: '目标访问控制', type: 'select', options: aclOptions, tab: 'security' },
      { name: 'dest_acl_rules', label: '目标规则', type: 'textarea', full: true, tab: 'security' },
    ],
  },
  webhooks: {
    resource: 'webhooks', singular: 'webhook', title: 'Webhook', description: '将管理事件可靠推送到外部 HTTP 服务',
    searchKeys: ['id', 'name', 'url', 'event_names', 'resources', 'actions'],
    columns: [
      { key: 'id', label: 'ID', kind: 'id' }, { key: 'name', label: '名称', kind: 'title' },
      { key: 'url', label: '目标 URL', kind: 'mono' }, { key: 'enabled', label: '状态', kind: 'online' },
      { key: 'deliveries', label: '成功投递', kind: 'number' }, { key: 'failures', label: '失败投递', kind: 'number' },
      { key: 'last_status_code', label: '最近状态码', kind: 'number' }, { key: 'last_delivered_at', label: '最近投递', kind: 'time' },
    ],
    tabs: [{ key: 'basic', label: '基础' }, { key: 'selector', label: '事件选择' }, { key: 'payload', label: '请求内容' }],
    fields: [
      { name: 'name', label: '名称', required: true },
      { name: 'url', label: '目标 URL', required: true, placeholder: 'https://example.com/hooks/nps' },
      { name: 'method', label: '请求方法', type: 'select', options: [{ value: 'POST', label: 'POST' }] },
      { name: 'timeout_seconds', label: '超时（秒）', type: 'number', help: '1-60 秒' },
      { name: 'enabled', label: '启用 Webhook', type: 'checkbox' },
      { name: 'event_names', label: '事件名称', type: 'textarea', full: true, tab: 'selector', help: '逗号或换行分隔；留空匹配全部事件' },
      { name: 'resources', label: '资源类型', type: 'textarea', full: true, tab: 'selector', help: '例如 client, tunnel, host' },
      { name: 'actions', label: '操作类型', type: 'textarea', full: true, tab: 'selector', help: '例如 create, update, delete' },
      { name: 'user_ids', label: '用户 ID', tab: 'selector', placeholder: '1, 2, 3' },
      { name: 'client_ids', label: '客户端 ID', tab: 'selector', placeholder: '1, 2, 3' },
      { name: 'tunnel_ids', label: '隧道 ID', tab: 'selector', placeholder: '1, 2, 3' },
      { name: 'host_ids', label: '域名 ID', tab: 'selector', placeholder: '1, 2, 3' },
      { name: 'content_mode', label: '内容模式', type: 'select', tab: 'payload', options: [{ value: 'canonical', label: 'Canonical' }, { value: 'custom', label: 'Custom' }] },
      { name: 'content_type', label: 'Content-Type', tab: 'payload', placeholder: 'application/json' },
      { name: 'body_template', label: 'Body 模板', type: 'textarea', full: true, tab: 'payload', help: 'Custom 模式使用 Go template' },
      { name: 'header_templates', label: '请求头模板（JSON）', type: 'textarea', full: true, tab: 'payload', placeholder: '{"Authorization":"Bearer {{ .Event.Fields.token }}"}' },
    ],
  },
};

export function valueFor(item: AnyRecord | null, field: FieldSpec) {
  if (!item) {
    if (field.name === 'status' || field.name === 'enabled' || field.name === 'compress' || field.name === 'crypt' || field.name === 'config_conn_allow' || field.name === 'enable_http' || field.name === 'enable_socks5') return true;
    if (field.name === 'server_ip') return '0.0.0.0';
    if (field.name === 'scheme' || field.name === 'target_type') return 'all';
    if (field.name === 'mode') return 'tcp';
    if (field.name === 'method') return 'POST';
    if (field.name === 'timeout_seconds') return 10;
    if (field.name === 'content_mode') return 'canonical';
    return field.type === 'number' || field.type === 'select' ? 0 : '';
  }
  if (field.name === 'username' && item.config) return item.config.user || '';
  if (field.name === 'compress' && item.config) return !!item.config.compress;
  if (field.name === 'crypt' && item.config) return !!item.config.crypt;
  if (field.name === 'manager_user_ids') return (item.manager_user_ids || []).join(', ');
  if (['event_names', 'resources', 'actions', 'user_ids', 'client_ids', 'tunnel_ids', 'host_ids'].includes(field.name)) return (item[field.name] || []).join(', ');
  if (field.name === 'header_templates') return Object.keys(item.header_templates || {}).length ? JSON.stringify(item.header_templates, null, 2) : '';
  if (field.name === 'status' && typeof item.status === 'number') return item.status === 1;
  if (field.name === 'expire_at') return unixToLocal(item.expire_at);
  return item[field.name] ?? (field.type === 'checkbox' ? false : '');
}

function unixToLocal(value: number) {
  if (!value || value <= 0) return '';
  const date = new Date(value * 1000);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function formBody(form: HTMLFormElement, spec: ResourceSpec, editing: AnyRecord | null) {
  const data = new FormData(form);
  const body: AnyRecord = {};
  for (const field of spec.fields) {
    if (field.uiOnly) continue;
    if (field.createOnly && editing) continue;
    if (field.type === 'checkbox') body[field.name] = data.has(field.name);
    else if (field.type === 'number' || (field.type === 'select' && field.options?.every(option => typeof option.value === 'number'))) body[field.name] = Number(data.get(field.name) || 0);
    else if (field.name === 'manager_user_ids' || ['user_ids', 'client_ids', 'tunnel_ids', 'host_ids'].includes(field.name)) body[field.name] = splitValues(data.get(field.name)).map(value => Number(value)).filter(value => value > 0);
    else if (['event_names', 'resources', 'actions'].includes(field.name)) body[field.name] = splitValues(data.get(field.name));
    else if (field.name === 'header_templates') {
      const raw = String(data.get(field.name) || '').trim();
      body[field.name] = raw ? JSON.parse(raw) : {};
      if (!body[field.name] || Array.isArray(body[field.name]) || typeof body[field.name] !== 'object') throw new Error('请求头模板必须是 JSON 对象');
    }
    else if (field.type === 'datetime-local') {
      const value = String(data.get(field.name) || '');
      body[field.name] = value ? new Date(value).toISOString() : '';
    } else body[field.name] = String(data.get(field.name) || '');
  }
  if (editing) {
    if (spec.resource !== 'webhooks') body.expected_revision = Number(editing.revision || 0);
    if (data.has('clear_password')) body.password = '';
    else if (!body.password) delete body.password;
    if (data.has('clear_totp_secret')) body.totp_secret = '';
    else if (!body.totp_secret) delete body.totp_secret;
  }
  return body;
}

function splitValues(value: FormDataEntryValue | null) {
  return String(value || '').split(/[\n,]/).map(item => item.trim()).filter(Boolean);
}
