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
  resource: 'clients' | 'tunnels' | 'hosts';
  singular: string;
  title: string;
  description: string;
  searchKeys: string[];
  columns: Array<{ key: string; label: string; kind?: string }>;
  fields: FieldSpec[];
  tabs: Array<{ key: string; label: string }>;
}

// Keep the wire values used by the legacy handlers, but expose readable
// names and a short use-case hint in the management UI.
export const tunnelModeOptions: SelectOption[] = [
  { value: 'tcp', label: 'TCP 端口转发' },
  { value: 'udp', label: 'UDP 端口转发' },
  { value: 'mixProxy', label: '混合代理（HTTP / Socks5）' },
  { value: 'secret', label: 'Secret 隧道' },
  { value: 'p2p', label: 'P2P 点对点' },
  { value: 'file', label: '文件服务器' },
];

export const tunnelModeDetails: Record<string, string> = {
  tcp: '转发 TCP 服务端口到客户端目标',
  udp: '转发 UDP 服务端口到客户端目标',
  mixProxy: '提供 HTTP 与 Socks5 代理入口',
  secret: '通过识别密钥访问客户端内网服务',
  p2p: '点对点建立连接，减少服务端转发',
  file: '把服务端端口映射到客户端本地目录',
};

const aclOptions: SelectOption[] = [
  { value: 0, label: '禁用' },
  { value: 1, label: '白名单' },
  { value: 2, label: '黑名单' },
];

const flowLimitFields: FieldSpec[] = [
  { name: 'flow_limit_total_bytes', label: '流量上限（字节）', type: 'number', tab: 'limits', feature: 'allow_flow_limit', help: '0 表示不限制' },
  { name: 'expire_at', label: '到期时间', type: 'datetime-local', tab: 'limits', feature: 'allow_time_limit' },
  { name: 'reset_flow', label: '保存时重置流量', type: 'checkbox', tab: 'limits' },
];

const clientLimitFields: FieldSpec[] = [
  ...flowLimitFields,
  { name: 'rate_limit_total_bps', label: '速率上限（bit/s）', type: 'number', tab: 'limits', feature: 'allow_rate_limit', help: '0 表示不限制' },
  { name: 'max_connections', label: '最大连接数', type: 'number', tab: 'limits', feature: 'allow_connection_num_limit' },
];

const clientAclFields: FieldSpec[] = [
  { name: 'blackiplist', label: '客户端 IP 黑名单', type: 'textarea', full: true, tab: 'security', help: '每行一个 IP 或 CIDR；留空表示不限制' },
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
      { name: 'config_username', label: '配置用户名' }, { name: 'config_password', label: '配置密码', type: 'password', help: '编辑时留空表示保持不变' },
      { name: 'web_username', label: 'Web 登录用户名', feature: 'allow_user_login' }, { name: 'web_password', label: 'Web 登录密码', type: 'password', feature: 'allow_user_login', help: '编辑时留空表示保持不变' },
      { name: 'web_totp_secret', label: 'Web TOTP 密钥', type: 'password', feature: 'allow_user_login' },
      { name: 'clear_password', label: '清空配置密码', type: 'checkbox', editOnly: true, uiOnly: true },
      { name: 'compress', label: '启用压缩', type: 'checkbox' }, { name: 'crypt', label: '启用加密', type: 'checkbox' },
      { name: 'config_conn_allow', label: '允许客户端配置连接', type: 'checkbox' },
      ...clientLimitFields,
      { name: 'max_tunnel_num', label: '最大隧道数', type: 'number', tab: 'limits', feature: 'allow_tunnel_num_limit' },
      ...clientAclFields,
    ],
  },
  tunnels: {
    resource: 'tunnels', singular: 'tunnel', title: '隧道', description: '管理 TCP、UDP、混合代理与 P2P 服务',
    searchKeys: ['id', 'remark', 'mode', 'target', 'port', 'client_id'],
    columns: [
      { key: 'id', label: 'ID', kind: 'id' }, { key: 'remark', label: '备注', kind: 'title' },
      { key: 'mode', label: '模式', kind: 'mode' }, { key: 'client_id', label: '客户端', kind: 'client' },
      { key: 'port', label: '服务端口', kind: 'number' }, { key: 'target', label: '目标', kind: 'mono' },
      { key: 'run_status', label: '状态', kind: 'online' }, { key: 'now_rate_total_bps', label: '实时速率', kind: 'bytes' },
      { key: 'service_total_bytes', label: '累计流量', kind: 'bytes' },
    ],
    tabs: [{ key: 'basic', label: '基础' }, { key: 'routing', label: '路由' }, { key: 'limits', label: '配额' }, { key: 'security', label: '安全' }],
    fields: [
      { name: 'client_id', label: '客户端 ID', type: 'select', required: true, options: [] }, { name: 'remark', label: '备注' },
      { name: 'mode', label: '模式', type: 'select', required: true, options: tunnelModeOptions },
      { name: 'server_ip', label: '监听地址', placeholder: '0.0.0.0', feature: 'allow_multi_ip', modes: ['tcp', 'udp', 'mixProxy', 'file'] },
      { name: 'port', label: '服务端口', type: 'number', modes: ['tcp', 'udp', 'mixProxy', 'file'] },
      { name: 'target_type', label: '目标协议', type: 'select', tab: 'routing', modes: ['secret', 'p2p'], options: ['all', 'tcp', 'udp'].map(value => ({ value, label: value })) },
      { name: 'target', label: '目标地址', type: 'textarea', full: true, tab: 'routing', modes: ['tcp', 'udp', 'secret', 'p2p'], placeholder: '127.0.0.1:8080' },
      { name: 'proxy_protocol', label: 'Proxy Protocol', type: 'select', tab: 'routing', modes: ['tcp', 'udp'], options: [{ value: 0, label: '禁用' }, { value: 1, label: 'v1' }, { value: 2, label: 'v2' }] },
      { name: 'local_proxy', label: '代理到服务端本机', type: 'checkbox', tab: 'routing', feature: 'allow_local_proxy', modes: ['tcp', 'udp', 'secret', 'p2p'] },
      { name: 'local_path', label: '本地路径', tab: 'routing', modes: ['file'] }, { name: 'strip_pre', label: '移除路径前缀', tab: 'routing', modes: ['file'] },
      { name: 'enable_http', label: '启用 HTTP 代理', type: 'checkbox', tab: 'routing', modes: ['mixProxy'] }, { name: 'enable_socks5', label: '启用 Socks5 代理', type: 'checkbox', tab: 'routing', modes: ['mixProxy'] },
      ...flowLimitFields,
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
      { key: 'scheme', label: '协议', kind: 'mode' }, { key: 'client_id', label: '客户端', kind: 'client' },
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
      ...flowLimitFields,
      { name: 'proxy_protocol', label: 'Proxy Protocol', type: 'select', tab: 'security', options: [{ value: 0, label: '禁用' }, { value: 1, label: 'v1' }, { value: 2, label: 'v2' }] },
      { name: 'auth', label: 'Basic Auth', type: 'textarea', full: true, tab: 'security' },
    ],
  },
};

export function valueFor(item: AnyRecord | null, field: FieldSpec) {
  if (!item) {
    if (field.name === 'status' || field.name === 'compress' || field.name === 'crypt' || field.name === 'config_conn_allow' || field.name === 'enable_http' || field.name === 'enable_socks5') return true;
    if (field.name === 'server_ip') return '0.0.0.0';
    if (field.name === 'scheme' || field.name === 'target_type') return 'all';
    if (field.name === 'mode') return 'tcp';
    return field.type === 'number' || field.type === 'select' ? 0 : '';
  }
  const config = item.config || item.cnf;
  const flow = item.flow;
  if (field.name === 'config_username' && config) return config.u || '';
  if (field.name === 'config_password' && config) return config.p || '';
  if (field.name === 'compress' && config) return !!config.compress;
  if (field.name === 'crypt' && config) return !!config.crypt;
  if (field.name === 'web_username') return item.web_username || item.web_user_name || '';
  if (field.name === 'web_password') return item.web_password || '';
  if (field.name === 'web_totp_secret') return item.web_totp_secret || '';
  if (field.name === 'blackiplist') return (item.blackiplist || item.black_ip_list || []).join('\n');
  if (field.name === 'flow_limit_total_bytes' && flow) return Number(flow.flow_limit || 0) * 1024 * 1024;
  if (field.name === 'expire_at' && flow?.time_limit) return unixToLocal(flow.time_limit);
  if (field.name === 'rate_limit_total_bps' && item.rate_limit !== undefined) return Number(item.rate_limit || 0) * 8 * 1024;
  if (field.name === 'max_connections' && item.max_conn !== undefined) return item.max_conn;
  if (field.name === 'max_tunnel_num' && item.max_tunnel !== undefined) return item.max_tunnel;
  if (field.name === 'status' && typeof item.status === 'number') return item.status === 1;
  if (field.name === 'expire_at') return unixToLocal(item.expire_at);
  return item[field.name] ?? (field.type === 'checkbox' ? false : '');
}

function unixToLocal(value: number | string) {
  if (!value) return '';
  const numeric = Number(value);
  const date = Number.isFinite(numeric) && numeric > 0 && /^\d+$/.test(String(value)) ? new Date(numeric * 1000) : new Date(String(value));
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function formBody(form: HTMLFormElement, spec: ResourceSpec, editing: AnyRecord | null) {
  const data = new FormData(form);
  const body: AnyRecord = {};
  for (const field of spec.fields) {
    if (field.uiOnly) continue;
    if (field.createOnly && editing) continue;
    if (!form.elements.namedItem(field.name)) continue;
    if (field.type === 'checkbox') body[field.name] = data.has(field.name);
    else if (field.type === 'number' || (field.type === 'select' && field.options?.every(option => typeof option.value === 'number'))) body[field.name] = Number(data.get(field.name) || 0);
    else if (field.type === 'datetime-local') {
      const value = String(data.get(field.name) || '');
      body[field.name] = value ? new Date(value).toISOString() : '';
    } else body[field.name] = String(data.get(field.name) || '');
  }
  if (editing) {
    body.expected_revision = Number(editing.revision || 0);
    if (data.has('clear_password')) body.config_password = '';
    else if (!body.config_password) delete body.config_password;
    if (!body.web_password) delete body.web_password;
  }
  return body;
}
