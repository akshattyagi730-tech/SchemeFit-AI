import { useState } from 'react';
import { ArrowRight, CheckCircle2, Landmark, LockKeyhole, ShieldCheck, UserRound } from 'lucide-react';
import '../components/login-screen.css';
import { ApiError } from '../api/client';
import { useLogin, useRegister } from '../api/hooks';
import type { Workspace } from '../api/types';

export function AuthScreen({ onWorkspace }: { onWorkspace: (w: Workspace) => void }) {
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
      onWorkspace(workspace!); // parent re-checks role from /auth/me
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.fieldErrors.length) {
          setFieldErrors(Object.fromEntries(err.fieldErrors.map((f) => [f.path, f.message])));
        }
        setFormError(err.message);
      } else {
        setFormError('Unexpected error. Please try again.');
      }
    }
  }

  return (
    <main className="login-page">
      <section className="login-brand">
        <div className="login-logo">
          <span>♧</span>
          <b>
            SchemeFit <i>AI</i>
          </b>
        </div>
        <div className="login-brand-copy">
          <span>Building an Inclusive India</span>
          <h1>Opportunity reaches the right entrepreneur.</h1>
          <p>One connected workspace for citizens, banks and channel partners.</p>
        </div>
        <div className="login-points">
          <p>
            <CheckCircle2 /> Scheme-fit recommendations
          </p>
          <p>
            <CheckCircle2 /> Document readiness checks
          </p>
          <p>
            <CheckCircle2 /> Smarter partner routing
          </p>
        </div>
        <small>Prototype · Not an official government service · Data is illustrative</small>
      </section>

      <section className="login-panel">
        {!workspace ? (
          <>
            <div>
              <span className="eyebrow">WELCOME TO SCHEMEFIT AI</span>
              <h2>Choose your workspace</h2>
              <p>Selecting a workspace only sets where you land — it never grants a role. Your access is decided by your account.</p>
            </div>
            <div className="role-cards">
              <button onClick={() => { setWorkspace('citizen'); setMode('login'); }}>
                <span className="role-icon citizen">
                  <UserRound />
                </span>
                <div>
                  <b>Citizen / Entrepreneur</b>
                  <small>Find schemes, prepare documents and track your application.</small>
                </div>
                <ArrowRight />
              </button>
              <button onClick={() => { setWorkspace('partner'); setMode('login'); }}>
                <span className="role-icon partner">
                  <Landmark />
                </span>
                <div>
                  <b>Bank / Channel Partner</b>
                  <small>Review only applications assigned to your organisation.</small>
                </div>
                <ArrowRight />
              </button>
            </div>
            <div className="login-security">
              <ShieldCheck />
              <span>
                <b>Role-based access</b>
                Applicant details are visible only to the assigned bank or partner.
              </span>
            </div>
          </>
        ) : (
          <>
            <button className="auth-back" onClick={() => { setWorkspace(null); reset(); }}>
              ← Back to workspace choice
            </button>
            <div>
              <span className="eyebrow">
                {workspace === 'citizen' ? 'CITIZEN / ENTREPRENEUR' : 'BANK / CHANNEL PARTNER'} WORKSPACE
              </span>
              <h2>{mode === 'register' ? 'Create your citizen account' : 'Sign in'}</h2>
              <p>
                {workspace === 'partner'
                  ? 'Partner and admin accounts are provisioned by an administrator. Sign in with the credentials you were given.'
                  : 'Use your email and password. New here? Create a free citizen account.'}
              </p>
            </div>

            <form className="auth-form" onSubmit={submit}>
              {formError && <div className="form-error">{formError}</div>}
              {mode === 'register' && (
                <label>
                  Full name
                  <input value={fullName} onChange={(e) => setFullName(e.target.value)} required autoComplete="name" />
                  {fieldErrors.fullName && <span className="field-error">{fieldErrors.fullName}</span>}
                </label>
              )}
              <label>
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
                {fieldErrors.email && <span className="field-error">{fieldErrors.email}</span>}
              </label>
              <label>
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                />
                {fieldErrors.password && <span className="field-error">{fieldErrors.password}</span>}
                {mode === 'register' && <span className="inline-note">At least 10 characters, with letters and numbers.</span>}
              </label>
              <button className="button primary" type="submit" disabled={busy}>
                {busy ? 'Please wait…' : mode === 'register' ? 'Create account' : 'Sign in'}
                <ArrowRight size={18} />
              </button>
            </form>

            {workspace === 'citizen' && (
              <p className="inline-note">
                {mode === 'register' ? 'Already have an account?' : 'Need an account?'}{' '}
                <button className="auth-switch" onClick={() => { setMode(mode === 'register' ? 'login' : 'register'); reset(); }}>
                  {mode === 'register' ? 'Sign in' : 'Create one'}
                </button>
              </p>
            )}
            <small className="login-foot">
              <LockKeyhole /> Passwords are hashed with Argon2id. Sessions are server-side and never stored in the browser.
            </small>
          </>
        )}
      </section>
    </main>
  );
}
