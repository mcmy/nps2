import { AlertTriangle, CheckCircle2, X, XCircle } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../lib/i18n';

function useAnimatedDismiss(onClose: () => void) {
  const [closing, setClosing] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const dismiss = useCallback(() => {
    if (closing) return;
    setClosing(true);
    timer.current = window.setTimeout(onClose, 150);
  }, [closing, onClose]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return { closing, dismiss };
}

export function Drawer({ title, subtitle, children, footer, onClose }: { title: string; subtitle?: string; children: ReactNode; footer: ReactNode; onClose: () => void }) {
  const { t } = useI18n();
  const closeRef = useRef<HTMLButtonElement>(null);
  const { closing, dismiss } = useAnimatedDismiss(onClose);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const key = (event: KeyboardEvent) => event.key === 'Escape' && dismiss();
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('keydown', key); previous?.focus?.(); };
  }, [dismiss]);
  return createPortal(<div className={`drawer-backdrop ${closing ? 'closing' : ''}`} onPointerDown={event => event.target === event.currentTarget && dismiss()}>
    <section className="drawer" role="dialog" aria-modal="true" aria-label={title} onPointerDown={event => event.stopPropagation()}>
      <header className="drawer-head"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button ref={closeRef} className="icon-btn" onClick={dismiss} aria-label={t('关闭')}><X /></button></header>
      <div className="drawer-body">{children}</div><footer className="drawer-foot">{footer}</footer>
    </section>
  </div>, document.body);
}

export function ConfirmDialog({ title, message, danger = true, busy, onCancel, onConfirm }: { title: string; message: string; danger?: boolean; busy?: boolean; onCancel: () => void; onConfirm: () => void }) {
  const { t } = useI18n();
  const { closing, dismiss } = useAnimatedDismiss(onCancel);
  useEffect(() => { const key = (event: KeyboardEvent) => event.key === 'Escape' && dismiss(); window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key); }, [dismiss]);
  return createPortal(<div className={`dialog-backdrop ${closing ? 'closing' : ''}`} onPointerDown={event => event.target === event.currentTarget && dismiss()}>
    <section className="dialog" role="alertdialog" aria-modal="true"><div className="dialog-icon"><AlertTriangle /></div><h3>{title}</h3><p>{message}</p>
      <div className="dialog-actions"><button className="btn" onClick={dismiss}>{t('取消')}</button><button autoFocus className={`btn ${danger ? 'danger' : 'primary'}`} disabled={busy} onClick={onConfirm}>{t(busy ? '处理中…' : '确认')}</button></div>
    </section>
  </div>, document.body);
}

export interface ToastItem { id: number; message: string; type: 'success' | 'error' }
export function Toasts({ items, dismiss }: { items: ToastItem[]; dismiss: (id: number) => void }) {
  const { t } = useI18n();
  return <div className="toast-region" aria-live="polite">{items.map(item => <div className={`toast ${item.type}`} key={item.id}>{item.type === 'success' ? <CheckCircle2 /> : <XCircle />}<span>{item.message}</span><button onClick={() => dismiss(item.id)} aria-label={t('关闭')}><X size={14} /></button></div>)}</div>;
}
