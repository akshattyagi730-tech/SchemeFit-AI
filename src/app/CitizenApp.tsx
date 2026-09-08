import { useEffect, useState } from 'react';
import { Bell, ChevronDown, Globe2, Menu, Search, X } from 'lucide-react';
import { Logo, PrototypeBanner } from '../components/ui';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { AshokaEmblem } from '../components/AshokaEmblem';
import { navFor } from './nav';
import { useLogout, useMe, useNotifications, useMarkNotificationsRead } from '../api/hooks';
import { formatDate } from '../lib/format';
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

function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const { data } = useNotifications();
  const markRead = useMarkNotificationsRead();
  const unread = data?.meta?.unread ?? 0;
  return (
    <div className="bell" style={{ position: 'relative' }} onClick={() => setOpen((o) => !o)}>
      <Bell />
      {unread > 0 && <i />}
      {open && (
        <div className="notif-panel" onClick={(e) => e.stopPropagation()}>
          <h4>
            Notifications
            {unread > 0 && <button onClick={() => markRead.mutate('all')}>Mark all read</button>}
          </h4>
          {(data?.notifications ?? []).length === 0 && <div className="notif-item">No notifications yet.</div>}
          {(data?.notifications ?? []).map((n) => (
            <div key={n.id} className={`notif-item ${n.read ? '' : 'unread'}`}>
              <b>{n.title}</b>
              <span>{n.message}</span>
              <small>{formatDate(n.createdAt)}</small>
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
  const items = navFor(user.role);

  // Redirect away from routes this role can't see.
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
          {items.map(({ label, route, icon: Icon }) => (
            <button
              key={route}
              className={path === route ? 'active' : ''}
              onClick={() => {
                navigate(route);
                setSideOpen(false);
              }}
            >
              <Icon size={21} />
              <span>{label}</span>
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
            Viksit Bharat
            <br />
            Inclusive Growth
            <br />
            Stronger Tomorrow
          </p>
          <small>Prototype — not an official portal</small>
        </div>
      </aside>

      <main>
        <header className="header">
          <button className="mobile-menu" onClick={() => setSideOpen(true)}>
            <Menu />
          </button>
          <div className="mission">
            <b>
              Building an <span>Inclusive India</span>
            </b>
            <i />
            <small>Rule-based scheme matching · prototype</small>
          </div>
          <div className="search">
            <Search size={22} />
            <span>Search schemes, banks, or help…</span>
          </div>
          <div className="head-actions">
            <Globe2 />
            <b>EN</b>
            <ChevronDown size={15} />
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
              <small>{user.role === 'ADMIN' ? 'Administrator' : 'Applicant'}</small>
            </div>
            <button className="workspace-switch" onClick={() => logout.mutate()}>
              Sign out
            </button>
          </div>
        </header>

        {sessionExpiresSoon && (
          <div className="session-warn">Your session expires {formatDate(me!.session.expiresAt)}. Sign in again to extend it.</div>
        )}
        <PrototypeBanner />

        <div className="page">
          <ErrorBoundary key={path}>{screen}</ErrorBoundary>
        </div>

        <footer>
          <Logo />
          <span>Because every entrepreneur deserves a fair chance.</span>
          <div>Prototype · Smart India Hackathon · Not affiliated with the Government of India</div>
        </footer>
      </main>

      {sideOpen && <div className="backdrop" onClick={() => setSideOpen(false)} />}
    </div>
  );
}
