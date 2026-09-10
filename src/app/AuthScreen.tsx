import { useState } from 'react';
import { ArrowRight, CheckCircle2, Landmark, LockKeyhole, ShieldCheck, UserRound, Globe2 } from 'lucide-react';
import '../components/login-screen.css';
import { BrandMark } from '../components/BrandMark';
import { PrototypeBanner } from '../components/PrototypeBanner';
import { ApiError } from '../api/client';
import { useLogin, useRegister } from '../api/hooks';
import { useLang, LANGS } from '../i18n';
import type { Workspace } from '../api/types';

export function AuthScreen({ onWorkspace }: { onWorkspace: (w: Workspace) => void }) {
  const { t, lang, setLang } = useLang();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');

  const login = useLogin();
  const register = useRegister();
  const busy = login.isPending || register.isPending;

  const reset = () => {
    setFieldErrors({});
    setFormError('');
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    reset();
    try {
      if (mode === 'register') {
        await register.mutateAsync({ email, password, fullName });
      } else {
        await login.mutateAsync({ email, password });
      }
      onWorkspace(workspace!);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.fieldErrors.length) {
          setFieldErrors(Object.fromEntries(err.fieldErrors.map((f) => [f.path, f.message])));
        }
        setFormError(err.message);
      } else {
        setFormError(t('auth.unexpectedError'));
      }
    }
  }

  return (
    <>
      <PrototypeBanner />
      <main className="login-page">
      <section className="login-brand">
        <div className="login-logo">
          <BrandMark size={40} />
          <b>
            Scheme<i>Fit</i>
          </b>
        </div>
        <div className="login-brand-copy">
          <span>{t('brand.mission')}</span>
          <h1>{t('auth.headline')}</h1>
          <p>{t('auth.subhead')}</p>
        </div>
        <div className="login-points">
          <p>
            <CheckCircle2 /> {t('auth.point1')}
          </p>
          <p>
            <CheckCircle2 /> {t('auth.point2')}
          </p>
          <p>
            <CheckCircle2 /> {t('auth.point3')}
          </p>
        </div>
        <div className="login-lang">
          <Globe2 size={14} />
          {LANGS.map((l) => (
            <button key={l.code} className={l.code === lang ? 'active' : ''} onClick={() => setLang(l.code)}>
              {l.native}
            </button>
          ))}
        </div>
        <small>{t('disc.short')}</small>
      </section>

      <section className="login-panel">
        {!workspace ? (
          <>
            <div>
              <span className="eyebrow">{t('auth.welcome')}</span>
              <h2>{t('auth.chooseWorkspace')}</h2>
              <p>{t('auth.chooseHint')}</p>
            </div>
            <div className="role-cards">
              <button
                onClick={() => {
                  setWorkspace('citizen');
                  setMode('login');
                }}
              >
                <span className="role-icon citizen">
                  <UserRound />
                </span>
                <div>
                  <b>{t('auth.citizenCard')}</b>
                  <small>{t('auth.citizenCardSub')}</small>
                </div>
                <ArrowRight />
              </button>
              <button
                onClick={() => {
                  setWorkspace('partner');
                  setMode('login');
                }}
              >
                <span className="role-icon partner">
                  <Landmark />
                </span>
                <div>
                  <b>{t('auth.partnerCard')}</b>
                  <small>{t('auth.partnerCardSub')}</small>
                </div>
                <ArrowRight />
              </button>
            </div>
            <div className="login-security">
              <ShieldCheck />
              <span>
                <b>{t('auth.rbac')}</b>
                {t('auth.rbacSub')}
              </span>
            </div>
          </>
        ) : (
          <>
            <button
              className="auth-back"
              onClick={() => {
                setWorkspace(null);
                reset();
              }}
            >
              {t('auth.backToChoice')}
            </button>
            <div>
              <span className="eyebrow">{workspace === 'citizen' ? t('auth.citizenWs') : t('auth.partnerWs')}</span>
              <h2>{mode === 'register' ? t('auth.createAccount') : t('auth.signIn')}</h2>
              <p>{workspace === 'partner' ? t('auth.partnerHint') : t('auth.citizenHint')}</p>
            </div>

            <form className="auth-form" onSubmit={submit}>
              {formError && <div className="form-error">{formError}</div>}
              {mode === 'register' && (
                <label>
                  {t('auth.fullName')}
                  <input value={fullName} onChange={(e) => setFullName(e.target.value)} required autoComplete="name" />
                  {fieldErrors.fullName && <span className="field-error">{fieldErrors.fullName}</span>}
                </label>
              )}
              <label>
                {t('auth.email')}
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
                {fieldErrors.email && <span className="field-error">{fieldErrors.email}</span>}
              </label>
              <label>
                {t('auth.password')}
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                />
                {fieldErrors.password && <span className="field-error">{fieldErrors.password}</span>}
                {mode === 'register' && <span className="inline-note">{t('auth.passwordHint')}</span>}
              </label>
              <button className="button primary" type="submit" disabled={busy}>
                {busy ? t('common.pleaseWait') : mode === 'register' ? t('auth.createBtn') : t('auth.signIn')}
                <ArrowRight size={18} />
              </button>
            </form>

            {workspace === 'citizen' && (
              <p className="inline-note">
                {mode === 'register' ? t('auth.haveAccount') : t('auth.needAccount')}{' '}
                <button
                  className="auth-switch"
                  onClick={() => {
                    setMode(mode === 'register' ? 'login' : 'register');
                    reset();
                  }}
                >
                  {mode === 'register' ? t('auth.signIn') : t('auth.createOne')}
                </button>
              </p>
            )}
            <small className="login-foot">
              <LockKeyhole /> {t('auth.securityNote')}
            </small>
          </>
        )}
      </section>
      </main>
    </>
  );
}
