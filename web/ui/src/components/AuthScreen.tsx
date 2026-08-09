import { Languages, LoaderCircle, Moon, Sun } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { clearAccessToken, legacyLogin, request } from '../lib/api';
import { useI18n } from '../lib/i18n';
import type { Discovery } from '../lib/types';

export default function AuthScreen({ discovery, theme, onThemeChange, onAuthenticated, notify }: { discovery: Discovery; theme: 'light' | 'dark'; onThemeChange: () => void; onAuthenticated: () => void; notify: (message: string, type?: 'success' | 'error') => void }) {
  const { language, setLanguage, t } = useI18n();
  const [view, setView] = useState<'login' | 'register'>('login');
  const [captcha, setCaptcha] = useState<{ id: string; url: string } | null>(discovery.legacy?.captcha || null);
  const [busy, setBusy] = useState(false);
  const refreshCaptcha = useCallback(async () => { if (!discovery.routes.captcha_new) return; try { const meta: any = await request(discovery.routes.captcha_new); setCaptcha(meta.captcha || null); discovery.legacy = meta; } catch {} }, [discovery]);
  useEffect(() => { void refreshCaptcha(); }, [refreshCaptcha, view]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const values = Object.fromEntries(new FormData(form)); setBusy(true);
    try {
      if (view === 'register') {
        await request(discovery.routes.register, { method: 'POST', body: JSON.stringify({ username: values.username, password: values.password, captcha_id: captcha?.id || '', captcha_answer: values.captcha_answer || '' }) });
        notify(t('注册成功，请登录')); setView('login'); await refreshCaptcha(); return;
      }
      clearAccessToken();
      await legacyLogin(discovery, values, captcha);
      onAuthenticated();
    } catch (error) { notify((error as Error).message, 'error'); await refreshCaptcha(); }
    finally { setBusy(false); }
  }

  return <main className="auth-screen"><div className="auth-tools"><button className="icon-btn" onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')} title={language === 'zh' ? 'English' : '中文'} aria-label={t('切换语言')}><Languages /></button><button className="icon-btn" onClick={onThemeChange} title={t('切换主题')} aria-label={t('切换主题')}>{theme === 'light' ? <Moon /> : <Sun />}</button></div><section className="auth-panel"><div className="brand-lockup"><div className="brand-mark">N</div><div><div className="brand-name">{discovery.app.name || 'NPS'}</div></div></div>
    <h2>{t(view === 'login' ? '登录控制台' : '创建账号')}</h2><p>{t(view === 'login' ? '使用管理账号登录控制台' : '注册后将自动分配可用的客户端资源')}</p>
    <form onSubmit={submit} className="form-grid">
      <div className="field full"><label htmlFor="auth-username">{t('用户名')}</label><input id="auth-username" name="username" required autoFocus autoComplete="username" /></div><div className="field full"><label htmlFor="auth-password">{t('密码')}</label><input id="auth-password" name="password" type="password" required autoComplete={view === 'login' ? 'current-password' : 'new-password'} /></div>{view === 'login' && <div className="field full"><label htmlFor="auth-totp">{t('一次性验证码')}</label><input id="auth-totp" name="totp" inputMode="numeric" autoComplete="one-time-code" placeholder={t('未启用可留空')} /></div>}
      {captcha && <div className="field full"><label htmlFor="captcha-answer">{t('图形验证码')}</label><div className="captcha-row"><input id="captcha-answer" name="captcha_answer" required autoComplete="off" /><button type="button" className="captcha-refresh" onClick={() => void refreshCaptcha()} title={t('换一张')}><img className="captcha-image" src={`${captcha.url}?_=${captcha.id}`} alt={t('验证码')} width="80" height="36" /></button></div></div>}
      <div className="field full"><button className="btn primary" style={{ width: '100%', minHeight: 42 }} disabled={busy} type="submit">{busy ? <><LoaderCircle className="boot-mark" style={{ width: 16, height: 16 }} />{t('处理中…')}</> : t(view === 'login' ? '登录' : '注册')}</button></div>
    </form>
    {discovery.features.allow_user_register && <button className="btn" style={{ width: '100%', marginTop: 10, borderColor: 'transparent', background: 'transparent' }} onClick={() => setView(view === 'login' ? 'register' : 'login')}>{t(view === 'login' ? '没有账号？立即注册' : '已有账号？返回登录')}</button>}
  </section></main>;
}
