import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import './styles.css';
import './components/workspace-switch.css';
import './components/app-additions.css';
import { ToastProvider } from './app/toast';
import { LangProvider, useLang } from './i18n';
import { AuthScreen } from './app/AuthScreen';
import { CitizenApp } from './app/CitizenApp';
import { PartnerPortal } from './components/PartnerPortal';
import { useMe } from './api/hooks';
import type { Workspace } from './api/types';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 10_000 },
  },
});

function Root() {
  const { data: me, isLoading } = useMe();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const { t } = useLang();

  if (isLoading) {
    return (
      <div className="boot-screen">
        <Loader2 className="spin" size={30} />
        <span>{t('boot.starting')}</span>
      </div>
    );
  }

  if (!me) {
    return <AuthScreen onWorkspace={setWorkspace} />;
  }

  const role = me.user.role;

  // The role from the session decides the workspace — the earlier selection only
  // hints where the user wanted to land.
  if (role === 'PARTNER') {
    return <PartnerPortal user={me.user} />;
  }

  return (
    <>
      {workspace === 'partner' && (
        <div className="session-warn">{t('auth.wrongWorkspace', { role: role.toLowerCase() })}</div>
      )}
      <CitizenApp user={me.user} />
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <LangProvider>
        <ToastProvider>
          <Root />
        </ToastProvider>
      </LangProvider>
    </QueryClientProvider>
  </StrictMode>,
);
