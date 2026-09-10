import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, Check, ClipboardList, LogOut, Menu, Search, UserRound, X } from 'lucide-react';
import { Logo } from '../components/ui';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { AshokaEmblem } from '../components/AshokaEmblem';
import { navFor, type NavItem } from './nav';
import {
  useLogout,
  useMe,
  useNotifications,
  useMarkNotificationsRead,
  useSchemes,
} from '../api/hooks';
import { useToast } from './toast';
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

/** Close `onOutside` when a pointer / Escape lands outside `ref`. */
function useDismiss(ref: React.RefObject<HTMLElement | null>, onOutside: () => void) {
  useEffect(() => {
    const pointer = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOutside();
    };
    addEventListener('mousedown', pointer);
    addEventListener('keydown', key);
    return () => {
      removeEventListener('mousedown', pointer);
      removeEventListener('keydown', key);
    };
  }, [ref, onOutside]);
}

const initialsOf = (name: string) =>
  name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .join('')
    .slice(0, 2)
    .toUpperCase();

/** Header search: matches navigation pages and scheme names, click to open. */
function SearchBox({ navigate, items }: { navigate: (to: string) => void; items: NavItem[] }) {
  const { t } = useLang();
  const { data: schemes } = useSchemes();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, () => setOpen(false));

  const canOpenSchemes = items.some((i) => i.route === '/schemes');
  const query = q.trim().toLowerCase();
  const { pages, matchedSchemes } = useMemo(() => {
    if (!query) return { pages: [] as NavItem[], matchedSchemes: [] as NonNullable<typeof schemes> };
    const pages = items.filter((i) => t(i.labelKey).toLowerCase().includes(query));
    const matchedSchemes = canOpenSchemes
      ? (schemes ?? [])
          .filter(
            (s) =>
              s.name.toLowerCase().includes(query) ||
              s.provider.toLowerCase().includes(query) ||
              s.displayCategory.toLowerCase().includes(query),
          )
          .slice(0, 6)
      : [];
    return { pages, matchedSchemes };
  }, [query, items, schemes, t, canOpenSchemes]);

  const go = (to: string) => {
    setQ('');
    setOpen(false);
    navigate(to);
  };

  const total = pages.length + matchedSchemes.length;

  return (
    <div className="search-box" ref={ref}>
      <Search size={20} />
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={t('header.searchPlaceholder')}
        aria-label={t('header.searchPlaceholder')}
      />
      {open && query.length > 0 && (
        <div className="search-results">
          {total === 0 && <div className="search-empty">{t('header.searchEmpty', { q: q.trim() })}</div>}
          {pages.length > 0 && (
            <div className="search-group">
              <small>{t('header.searchPagesGroup')}</small>
              {pages.map((i) => {
                const Icon = i.icon;
                return (
                  <button key={i.route} onClick={() => go(i.route)}>
                    <Icon size={15} />
                    <span>{t(i.labelKey)}</span>
                  </button>
                );
              })}
            </div>
          )}
          {matchedSchemes.length > 0 && (
            <div className="search-group">
              <small>{t('header.searchSchemesGroup')}</small>
              {matchedSchemes.map((s) => (
                <button key={s.id} onClick={() => go('/schemes')}>
                  <ClipboardList size={15} />
                  <span>
                    {s.name}
                    <em>{s.provider}</em>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NotificationsBell({ navigate }: { navigate: (to: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data } = useNotifications();
  const markRead = useMarkNotificationsRead();
  const { t } = useLang();
  const unread = data?.meta?.unread ?? 0;
  useDismiss(ref, () => setOpen(false));

  // Map a notification's link to a route this (citizen) app actually has.
  const routeFor = (link: string): string | null => {
    if (!link || link === '/') return null;
    if (link.startsWith('/partner') || link.startsWith('/admin')) return null;
    if (link.startsWith('/applications/')) return '/documents';
    return link;
  };

  const openNotification = (n: { id: string; link: string; read: boolean }) => {
    setOpen(false);
    if (!n.read) markRead.mutate([n.id]);
    const to = routeFor(n.link);
    if (to) navigate(to);
  };

  const rel = (iso: string) => {
    const { unit, n } = relativeParts(iso);
    if (unit === 'now') return t('notif.justNow');
    if (unit === 'min') return t('notif.minutesAgo', { n });
    if (unit === 'hour') return t('notif.hoursAgo', { n });
    if (unit === 'day') return t('notif.daysAgo', { n });
    return formatDate(iso);
  };

  return (
    <div className="bell" ref={ref} style={{ position: 'relative' }}>
      <button className="bell-btn" onClick={() => setOpen((o) => !o)} aria-label={t('notif.title')}>
        <Bell />
        {unread > 0 && <i />}
      </button>
      {open && (
        <div className="notif-panel" onClick={(e) => e.stopPropagation()}>
          <h4>
            {t('notif.title')}
            {unread > 0 && <button onClick={() => markRead.mutate('all')}>{t('notif.markAllRead')}</button>}
          </h4>
          {(data?.notifications ?? []).length === 0 && <div className="notif-item">{t('notif.empty')}</div>}
          {(data?.notifications ?? []).map((n) => {
            const clickable = routeFor(n.link) !== null;
            return (
              <button
                key={n.id}
                type="button"
                className={`notif-item ${n.read ? '' : 'unread'} ${clickable ? 'linked' : ''}`}
                onClick={() => openNotification(n)}
              >
                <b>{n.title}</b>
                <span>{n.message}</span>
                <small>{rel(n.createdAt)}{clickable ? ` · ${t('notif.openLink')}` : ''}</small>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Avatar button → menu with profile, language and sign out. Reachable on every viewport. */
function AccountMenu({
  user,
  navigate,
  onSignOut,
}: {
  user: AuthUser;
  navigate: (to: string) => void;
  onSignOut: () => void;
}) {
  const { lang, setLang, t } = useLang();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, () => setOpen(false));

  const isAdmin = user.role === 'ADMIN';
  const initials = initialsOf(user.displayName);

  return (
    <div className="account-menu" ref={ref}>
      <button
        className="avatar"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('header.account')}
      >
        {initials}
      </button>
      {open && (
        <div className="account-pop" role="menu">
          <div className="account-id">
            <span className="avatar sm">{initials}</span>
            <div>
              <b>{user.displayName}</b>
              <small>{isAdmin ? t('header.administrator') : t('header.applicant')}</small>
            </div>
          </div>

          {!isAdmin && (
            <button
              role="menuitem"
              onClick={() => {
                setOpen(false);
                navigate('/profile');
              }}
            >
              <UserRound size={15} />
              <span>{t('header.myProfile')}</span>
            </button>
          )}

          <div className="account-sep" />
          <div className="account-heading">{t('header.language')}</div>
          {LANGS.map((l) => (
            <button
              key={l.code}
              role="menuitemradio"
              aria-checked={l.code === lang}
              className={l.code === lang ? 'active' : ''}
              onClick={() => setLang(l.code)}
            >
              {l.code === lang ? <Check size={15} /> : <span style={{ width: 15 }} />}
              <span>{l.native}</span>
            </button>
          ))}

          <div className="account-sep" />
          <button
            role="menuitem"
            className="danger"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
          >
            <LogOut size={15} />
            <span>{t('header.signOut')}</span>
          </button>
        </div>
      )}
    </div>
  );
}

export function CitizenApp({ user }: { user: AuthUser }) {
  const { path, navigate } = useRoutePath();
  const [sideOpen, setSideOpen] = useState(false);
  const logout = useLogout();
  const { toast } = useToast();
  const { data: me } = useMe();
  const { t, lang } = useLang();
  const items = navFor(user.role);

  useEffect(() => {
    if (path !== '/' && !items.some((i) => i.route === path)) navigate(items[0]?.route ?? '/');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  const signOut = () => {
    if (logout.isPending) return;
    if (!window.confirm(t('header.signOutConfirm'))) return;
    logout.mutate(undefined, {
      onSettled: () => {
        toast(t('header.signedOut'));
        // Hard navigation guarantees a clean, unauthenticated app state.
        setTimeout(() => window.location.assign('/'), 600);
      },
    });
  };

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
          <button className="mobile-menu" onClick={() => setSideOpen(true)} aria-label={t('header.menu')}>
            <Menu />
          </button>
          <div className="mission">
            <b>{t('brand.mission')}</b>
            <i />
            <small>{t('brand.missionSub')}</small>
          </div>
          <SearchBox navigate={navigate} items={items} />
          <div className="head-actions">
            <NotificationsBell navigate={navigate} />
            <span className="divider" />
            <AccountMenu user={user} navigate={navigate} onSignOut={signOut} />
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
