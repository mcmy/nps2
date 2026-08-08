import type { ActionEntry, AnyRecord, ApiEnvelope, Discovery } from './types';
import JSEncrypt from 'jsencrypt';

const tokenKey = 'nps-access-token';

function baseFromLocation() {
  const path = window.location.pathname.replace(/\/$/, '');
  return path.endsWith('/index.html') ? path.slice(0, -11) : path;
}

export async function request<T = any>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  const token = accessToken();
  if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData) && !(init.body instanceof URLSearchParams)) headers.set('Content-Type', 'application/json');
  const response = await fetch(url, { credentials: 'same-origin', ...init, headers });
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('json') ? await response.json() : await response.text();
  if (!response.ok) {
    const message = payload?.error?.message || payload?.message || response.statusText || '请求失败';
    const error = new Error(message) as Error & { status: number; code?: string };
    error.status = response.status;
    error.code = payload?.error?.code;
    throw error;
  }
  return (payload as ApiEnvelope<T>)?.data ?? payload;
}

export async function requestBlob(url: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const token = accessToken();
  if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const response = await fetch(url, { credentials: 'same-origin', ...init, headers });
  if (!response.ok) {
    let message = response.statusText || '请求失败';
    try {
      const payload = await response.json();
      message = payload?.error?.message || payload?.message || message;
    } catch {}
    throw new Error(message);
  }
  return response.blob();
}

export function accessToken() {
  return typeof sessionStorage === 'undefined' ? '' : sessionStorage.getItem(tokenKey) || '';
}

export function setAccessToken(token: string) {
  if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(tokenKey, token);
}

export function clearAccessToken() {
  if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(tokenKey);
}

export function webSocketURL(path: string) {
  const url = new URL(path, window.location.href);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}

export async function getDiscovery(): Promise<Discovery> {
  const base = baseFromLocation();
  const meta = await request<AnyRecord>(`${base}/management/meta`);
  return {
    app: { name: meta.app?.name || 'NPS', version: meta.app?.version || '', year: new Date().getFullYear(), web_base_url: base },
    session: meta.session || { authenticated: false, is_admin: false },
    actions: meta.actions || [{ resource: 'clients', action: 'list', method: 'POST', path: meta.routes?.clients || `${base}/client/list` }],
    features: meta.features || {},
    security: { pow_bits: Number(meta.pow_bits || 0) },
    auth: { pow_enable: !!meta.pow_enable },
    routes: {
      meta: meta.routes?.meta || `${base}/management/meta`,
      session: meta.routes?.session || `${base}/login/verify`,
      logout: meta.routes?.logout || `${base}/login/out`,
      overview: meta.routes?.overview || `${base}/index/stats`,
      captcha_new: meta.routes?.meta || `${base}/management/meta`,
    },
    extensions: {},
    legacy: meta,
  };
}

export async function legacyLogin(discovery: Discovery, values: Record<string, FormDataEntryValue>, captcha: { id: string; url: string } | null) {
  const meta = discovery.legacy || {};
  const password = String(values.password || '');
  const totp = String(values.totp || '').trim();
  const payload = JSON.stringify({ n: meta.login_nonce || '', t: Date.now(), p: captcha ? password : password + totp });
  const encryptor = new JSEncrypt();
  encryptor.setPublicKey(String(meta.public_key || ''));
  const encrypted = encryptor.encrypt(payload);
  if (!encrypted) throw new Error('无法初始化登录加密');

  const form = new URLSearchParams({
    username: String(values.username || '').trim(),
    password: encrypted,
  });
  if (captcha) {
    form.set('captcha_id', captcha.id);
    form.set('captcha', String(values.captcha_answer || '') + totp);
  }
  const bits = Number(meta.pow_bits || 0);
  const needPoW = bits > 0 && (!!meta.pow_enable || !!totp && !!captcha);
  if (needPoW) {
    form.set('bits', String(bits));
    form.set('powx', await findLegacyPoW(encrypted, bits));
  }
  const response = await fetch(discovery.routes.session, {
    method: 'POST', credentials: 'same-origin', headers: { Accept: 'application/json' }, body: form,
  });
  const result = await response.json();
  if (!response.ok || !result?.status) throw new Error(result?.msg || response.statusText || '登录失败');
}

async function findLegacyPoW(encrypted: string, bits: number) {
  const encoder = new TextEncoder();
  const full = bits >> 3; const remainder = bits & 7;
  for (let nonce = 0; nonce < 10_000_000; nonce++) {
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(encrypted + nonce)));
    let valid = true;
    for (let index = 0; index < full; index++) if (hash[index] !== 0) { valid = false; break; }
    if (valid && (!remainder || (hash[full] & (0xff << (8 - remainder))) === 0)) return String(nonce);
    if (nonce % 500 === 0) await new Promise(resolve => setTimeout(resolve, 0));
  }
  throw new Error('安全校验计算超时，请稍后重试');
}

export function actionMap(discovery: Discovery) {
  const map = new Map<string, ActionEntry>();
  for (const entry of discovery.actions || []) map.set(`${entry.resource}:${entry.action}`, entry);
  return map;
}

export function materialize(path: string, params: AnyRecord = {}) {
  return Object.entries(params).reduce(
    (value, [key, replacement]) => value.replace(`{${key}}`, encodeURIComponent(String(replacement))),
    path,
  );
}

export async function actionRequest(
  actions: Map<string, ActionEntry>,
  resource: string,
  action: string,
  params: AnyRecord = {},
  body?: AnyRecord,
) {
  const spec = actions.get(`${resource}:${action}`);
  if (!spec) throw new Error('当前账号没有执行此操作的权限');
  const form = body === undefined ? undefined : legacyForm(resource, body);
  const result = await request(materialize(spec.path, params), {
    method: spec.method,
    body: form,
  });
  if (result && typeof result === 'object' && (Number((result as AnyRecord).status) === 0 || Number((result as AnyRecord).code) === 0)) {
    throw new Error(String((result as AnyRecord).msg || (result as AnyRecord).message || '操作失败'));
  }
  return result;
}

function legacyForm(resource: string, body: AnyRecord) {
  const aliases: Record<string, Record<string, string>> = {
    clients: {
      verify_key: 'vkey', username: 'web_username', password: 'web_password',
      max_connections: 'max_conn', max_tunnel_num: 'max_tunnel',
      flow_limit_mb: 'flow_limit', rate_limit_mbps: 'rate_limit',
      reset_flow: 'flow_reset', entry_acl_rules: 'blackiplist',
    },
    tunnels: {
      mode: 'type', flow_limit_mb: 'flow_limit', rate_limit_mbps: 'rate_limit', reset_flow: 'flow_reset',
    },
    hosts: {
      host_change: 'hostchange', flow_limit_mb: 'flow_limit', rate_limit_mbps: 'rate_limit', reset_flow: 'flow_reset',
    },
  };
  const form = new URLSearchParams();
  for (const [key, value] of Object.entries(body)) {
    if (value === undefined || value === null) continue;
    const name = aliases[resource]?.[key] || key;
    let serialized: string;
    if (resource === 'clients' && key === 'config_username') serialized = String(value);
    else if (resource === 'clients' && key === 'config_password') serialized = String(value);
    else if ((key === 'flow_limit_mb') && Number(value) > 0) serialized = String(Math.round(Number(value)));
    else if ((key === 'rate_limit_mbps') && Number(value) > 0) serialized = String(Math.max(1, Math.round(Number(value) * 1e6 / 8192)));
    else serialized = Array.isArray(value) ? value.join(',') : typeof value === 'object' ? JSON.stringify(value) : String(value);
    const legacyName = resource === 'clients' && key === 'config_username' ? 'u'
      : resource === 'clients' && key === 'config_password' ? 'p'
      : resource === 'clients' && key === 'blackiplist' ? 'blackiplist'
      : resource === 'clients' && key === 'expire_at' ? 'time_limit'
      : resource !== 'clients' && key === 'expire_at' ? 'time_limit'
      : name;
    form.set(legacyName, serialized);
  }
  return form;
}

// The legacy Beego handlers marshal Go structs with upper-camel field names,
// while the migrated UI uses the nps2 snake-case contract.
export function normalizeLegacyKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeLegacyKeys);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, child]) => [
    key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`).replace(/^_/, ''), normalizeLegacyKeys(child),
  ]));
}
