import { useEffect, useRef, useState } from 'react';
import { Bell, ChevronDown, Globe2, Menu, Search, X, Check } from 'lucide-react';
import { Logo } from '../components/ui';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { AshokaEmblem } from '../components/AshokaEmblem';
import { navFor } from './nav';
import { useLogout, useMe, useNotifications, useMarkNotificationsRead } from '../api/hooks';
import { formatDate, relativeParts } from '../lib/format';
import { useLang, LANGS } from '../i18n';
import { Dashboard } from '../screens/Dashboard';
import { GetStarted } from '../screens/GetStarted';
import { Profile } from '../screens/Profile';
import { SchemeMatches } from '../screens/SchemeMatches';
import { LoanPlanner } from '../screens/LoanPlanner';
import { Documents } from '../screens/Documents';
import { PartnerRouting } from '../screens/PartnerRouting';
import { Applications } from '../screens/Applications';
import { AdminDashboard } from '../screens/AdminDashboard';
import type { AuthUser } from '../api/types';

function useRoutePath() {
  const [path, setPath] = useState(() => location.pathname || '/');
  useEffect(() => {
    const handler = () => setPath(location.pathname || '/');
    addEventListener('popstate', handler);
    return () => removeEventListener('popstate', handler);
  }, []);
  const navigate = (to: string) => {
    history.pushState({}, '', to);
    setPath(to);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  return { path, navigate };
}

function LangSwitch() {
  const { lang, setLang } = useLang();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    addEventListener('mousedown', h);
    return () => removeEventListener('mousedown', h);
  }, []);
  const current = LANGS.find((l) => l.code === lang)!;
  return (
    <div className="lang-switch" ref={ref}>
      <button className="lang-btn" onClick={() => setOpen((o) => !o)} aria-label="Language">
        <Globe2 size={17} />
        <b>{lang === 'hi' ? 'हिं' : 'EN'}</b>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="lang-menu">
          {LANGS.map((l) => (
            <button
              key={l.code}
              className={l.code === lang ? 'active' : ''}
              onClick={() => {
                setLang(l.code);
                setOpen(false);
              }}
            >
              {l.code === current.code ? <Check size={13} /> : <span style={{ width: 13 }} />}
              {l.native}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const { data } = useNotifications();
  const markRead = useMarkNotificationsRead();
  const { t } = useLang();
  const unread = data?.meta?.unread ?? 0;

  const rel = (iso: string) => {
    const { unit, n } = relativeParts(iso);
    if (unit === 'now') return t('notif.justNow');
    if (unit === 'min') return t('notif.minutesAgo', { n });
    if (unit === 'hour') return t('notif.hoursAgo', { n });
    if (unit === 'day') return t('notif.daysAgo', { n });
    return formatDate(iso);
  };

  return (
    <div className="bell" style={{ position: 'relative' }} onClick={() => setOpen((o) => !o)}>
      <Bell />
      {unread > 0 && <i />}
      {open && (
        <div className="notif-panel" onClick={(e) => e.stopPropagation()}>
          <h4>
            {t('notif.title')}
            {unread > 0 && <button onClick={() => markRead.mutate('all')}>{t('notif.markAllRead')}</button>}
          </h4>
          {(data?.notifications ?? []).length === 0 && <div className="notif-item">{t('notif.empty')}</div>}
          {(data?.notifications ?? []).map((n) => (
            <div key={n.id} className={`notif-item ${n.read ? '' : 'unread'}`}>
              <b>{n.title}</b>
              <span>{n.message}</span>
              <small>{rel(n.createdAt)}</small>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function CitizenApp({ user }: { user: AuthUser }) {
  const { path, navigate } = useRoutePath();
  const [sideOpen, setSideOpen] = useState(false);
  const logout = useLogout();
  const { data: me } = useMe();
  const { t, lang } = useLang();
  const items = navFor(user.role);

  useEffect(() => {
    if (path !== '/' && !items.some((i) => i.route === path)) navigate(items[0]?.route ?? '/');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  const screen = (() => {
    switch (path) {
      case '/start':
        return <GetStarted navigate={navigate} />;
      case '/profile':
        return <Profile />;
      case '/schemes':
        return <SchemeMatches navigate={navigate} />;
      case '/loan-planner':
        return <LoanPlanner navigate={navigate} />;
      case '/documents':
        return <Documents navigate={navigate} />;
      case '/partners':
        return <PartnerRouting navigate={navigate} />;
      case '/applications':
        return <Applications navigate={navigate} />;
      case '/admin':
        return <AdminDashboard />;
      default:
        return <Dashboard navigate={navigate} />;
    }
  })();

  const sessionExpiresSoon =
    me?.session && new Date(me.session.expiresAt).getTime() - Date.now() < 24 * 3600 * 1000;

  return (
    <div className="app">
      <aside className={`sidebar ${sideOpen ? 'open' : ''}`}>
        <button className="close-side" onClick={() => setSideOpen(false)}>
          <X />
        </button>
        <Logo />
        <nav>
          {items.map(({ labelKey, route, icon: Icon }) => (
            <button
              key={route}
              className={path === route ? 'active' : ''}
              onClick={() => {
                navigate(route);
                setSideOpen(false);
              }}
            >
              <Icon size={21} />
              <span>{t(labelKey)}</span>
            </button>
          ))}
        </nav>
        <div className="side-bottom">
          <AshokaEmblem />
          <div className="tricolor">
            <i />
            <i />
            <i />
          </div>
          <p>
            {lang === 'hi' ? (
              <>
                विकसित भारत
                <br />
                समावेशी विकास
                <br />
                सशक्त कल
              </>
            ) : (
              <>
                Viksit Bharat
                <br />
                Inclusive Growth
                <br />
                Stronger Tomorrow
              </>
            )}
          </p>
          <small>{t('disc.footerNote')}</small>
        </div>
      </aside>

      <main>
        <header className="header">
          <button className="mobile-menu" onClick={() => setSideOpen(true)}>
            <Menu />
          </button>
          <div className="mission">
            <b>{t('brand.mission')}</b>
            <i />
            <small>{t('brand.missionSub')}</small>
          </div>
          <div className="search">
            <Search size={22} />
            <span>{t('header.search')}</span>
          </div>
          <div className="head-actions">
            <LangSwitch />
            <span className="divider" />
            <NotificationsBell />
            <span className="divider" />
            <span className="avatar">
              {user.displayName
                .split(' ')
                .map((w) => w[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()}
            </span>
            <div className="profile-label">
              <b>{user.displayName}</b>
              <small>{user.role === 'ADMIN' ? t('header.administrator') : t('header.applicant')}</small>
            </div>
            <button className="workspace-switch" onClick={() => logout.mutate()}>
              {t('header.signOut')}
            </button>
          </div>
        </header>

        {sessionExpiresSoon && (
          <div className="session-warn">
            {t('state.sessionExpiresOn', { date: formatDate(me!.session.expiresAt) })}
          </div>
        )}

        <div className="page">
          <ErrorBoundary key={path}>{screen}</ErrorBoundary>
        </div>

        <footer>
          <Logo />
          <span>{t('disc.tagline')}</span>
          <div className="footer-links">
            {t('footer.about')}　|　{t('footer.help')}　|　{t('footer.privacy')}　|　{t('footer.terms')}
          </div>
          <div className="footer-disc">{t('disc.short')}</div>
        </footer>
      </main>

      {sideOpen && <div className="backdrop" onClick={() => setSideOpen(false)} />}
    </div>
  );
}
