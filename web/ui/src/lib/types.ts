export type AnyRecord = Record<string, any>;

export interface ActionEntry {
  resource: string;
  action: string;
  method: string;
  path: string;
  permission?: string;
}

export interface Discovery {
  app: { name: string; version: string; year: number; web_base_url: string };
  session: {
    authenticated: boolean;
    is_admin: boolean;
    username?: string;
    client_id?: number | null;
    client_ids?: number[];
    kind?: string;
  };
  actor?: AnyRecord;
  actions: ActionEntry[];
  features: AnyRecord;
  security: AnyRecord;
  auth: AnyRecord;
  routes: AnyRecord;
  extensions: AnyRecord;
	legacy?: AnyRecord;
}

export interface ApiEnvelope<T = any> {
  data: T;
  meta?: AnyRecord;
}

export interface ResourceList<T = AnyRecord> {
  items: T[];
  total: number;
  offset?: number;
  limit?: number;
  has_more?: boolean;
}

export type PageKey =
  | 'dashboard'
  | 'clients'
  | 'tunnels'
  | 'hosts'
  | 'users'
  | 'settings'
  | 'bans'
  | 'callbacks'
  | 'webhooks'
  | 'operations';
