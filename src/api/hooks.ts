import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query';
import { api } from './client';
import type {
  AdminKpis,
  Application,
  DocumentChecklistResponse,
  DocumentsResponse,
  Envelope,
  FinancePlan,
  MeResponse,
  NotificationItem,
  PartnerPublic,
  PartnerSummary,
  ProfileResponse,
  RecommendationsResponse,
  RoutingOutcome,
  Scheme,
} from './types';

export const qk = {
  me: ['me'] as const,
  profile: ['profile'] as const,
  schemes: ['schemes'] as const,
  scheme: (id: string) => ['scheme', id] as const,
  recommendations: ['recommendations'] as const,
  documentChecklist: ['recommendations', 'documents'] as const,
  partners: (schemeCode?: string) => ['partners', schemeCode ?? 'all'] as const,
  routing: (schemeCode: string) => ['routing', schemeCode] as const,
  applications: (scope: string) => ['applications', scope] as const,
  application: (id: string) => ['application', id] as const,
  documents: (appId: string) => ['documents', appId] as const,
  notifications: ['notifications'] as const,
  partnerSummary: ['partner', 'summary'] as const,
  partnerApplications: (q: string) => ['partner', 'applications', q] as const,
  adminKpis: ['admin', 'kpis'] as const,
  adminPartners: ['admin', 'partners'] as const,
  adminApplications: (q: string) => ['admin', 'applications', q] as const,
  adminAudit: ['admin', 'audit'] as const,
};

const unwrap = <T>(p: Promise<Envelope<T>>) => p.then((r) => r.data);

/* --------------------------------- auth --------------------------------- */

export function useMe(options?: Partial<UseQueryOptions<MeResponse | null>>) {
  return useQuery<MeResponse | null>({
    queryKey: qk.me,
    queryFn: async () => {
      try {
        return await unwrap(api.get<Envelope<MeResponse>>('/auth/me'));
      } catch {
        return null; // unauthenticated
      }
    },
    staleTime: 30_000,
    retry: false,
    ...options,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; password: string }) => api.post('/auth/login', body),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; password: string; fullName: string }) => api.post('/auth/register', body),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/auth/logout'),
    onSuccess: () => {
      qc.clear();
    },
  });
}

/* -------------------------------- profile ------------------------------- */

export function useProfile(enabled = true) {
  return useQuery({
    queryKey: qk.profile,
    queryFn: () => unwrap(api.get<Envelope<ProfileResponse>>('/profile')),
    enabled,
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Record<string, unknown>) => api.put<Envelope<ProfileResponse>>('/profile', patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.profile });
      qc.invalidateQueries({ queryKey: qk.recommendations });
      qc.invalidateQueries({ queryKey: qk.documentChecklist });
      qc.invalidateQueries({ queryKey: qk.notifications });
      qc.invalidateQueries({ queryKey: qk.me });
    },
  });
}

/* -------------------------------- schemes ------------------------------- */

export function useSchemes() {
  return useQuery({
    queryKey: qk.schemes,
    queryFn: () => api.get<Envelope<Scheme[]>>('/schemes', { pageSize: 100 }).then((r) => r.data),
    staleTime: 5 * 60_000,
  });
}

export function useRecommendations(enabled = true) {
  return useQuery({
    queryKey: qk.recommendations,
    queryFn: () => unwrap(api.get<Envelope<RecommendationsResponse>>('/recommendations')),
    enabled,
  });
}

export function useDocumentChecklist(enabled = true) {
  return useQuery({
    queryKey: qk.documentChecklist,
    queryFn: () => unwrap(api.get<Envelope<DocumentChecklistResponse>>('/recommendations/documents')),
    enabled,
  });
}

/* -------------------------------- finance ------------------------------- */

export interface CalcBody {
  schemeCode: string;
  projectCostPaise: number;
  ownContributionPaise: number;
  requestedLoanPaise: number;
  interestRateBps: number;
  tenureMonths: number;
  moratoriumMonths: number;
}

export function useFinanceCalculation() {
  return useMutation({
    mutationFn: (body: CalcBody) =>
      unwrap(api.post<Envelope<{ plan: FinancePlan }>>('/finance/calculate', body)).then((d) => d.plan),
  });
}

/* -------------------------------- partners ------------------------------ */

export function usePartners(schemeCode?: string) {
  return useQuery({
    queryKey: qk.partners(schemeCode),
    queryFn: () =>
      api.get<Envelope<{ partners: PartnerPublic[] }>>('/partners', schemeCode ? { schemeCode } : undefined).then((r) => r.data.partners),
  });
}

export function useRouting(schemeCode: string | undefined) {
  return useQuery({
    queryKey: qk.routing(schemeCode ?? ''),
    queryFn: () => unwrap(api.get<Envelope<{ routing: RoutingOutcome; scheme: { code: string; name: string } }>>('/partners/routing', { schemeCode: schemeCode! })),
    enabled: !!schemeCode,
  });
}

/* ------------------------------ applications ---------------------------- */

export function useApplications(scope: 'citizen' | 'all' = 'citizen') {
  return useQuery({
    queryKey: qk.applications(scope),
    queryFn: () => api.get<Envelope<Application[]>>('/applications', { pageSize: 50 }).then((r) => r.data),
  });
}

export function useApplication(id: string | undefined) {
  return useQuery({
    queryKey: qk.application(id ?? ''),
    queryFn: () => unwrap(api.get<Envelope<{ application: Application }>>(`/applications/${id}`)).then((d) => d.application),
    enabled: !!id,
  });
}

export function useCreateApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (schemeCode: string) =>
      unwrap(api.post<Envelope<{ application: Application }>>('/applications', { schemeCode })).then((d) => d.application),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['applications'] }),
  });
}

export function usePatchFinancing(appId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<CalcBody>) => api.patch(`/applications/${appId}/financing`, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.application(appId) });
      qc.invalidateQueries({ queryKey: ['applications'] });
    },
  });
}

export function useApplicationAction(appId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ action, body }: { action: string; body?: Record<string, unknown> }) =>
      api.post(`/applications/${appId}/${action}`, body ?? {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.application(appId) });
      qc.invalidateQueries({ queryKey: ['applications'] });
      qc.invalidateQueries({ queryKey: qk.notifications });
    },
  });
}

export function usePartnerApplicationAction(appId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ action, body }: { action: string; body?: Record<string, unknown> }) =>
      api.post(`/partner/applications/${appId}/${action}`, body ?? {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.application(appId) });
      qc.invalidateQueries({ queryKey: ['partner'] });
      qc.invalidateQueries({ queryKey: qk.notifications });
    },
  });
}

/* ------------------------------- documents ----------------------------- */

export function useDocuments(appId: string | undefined, poll = false) {
  return useQuery({
    queryKey: qk.documents(appId ?? ''),
    queryFn: () => unwrap(api.get<Envelope<DocumentsResponse>>(`/applications/${appId}/documents`)),
    enabled: !!appId,
    refetchInterval: poll ? 15_000 : false,
  });
}

export function useUploadDocument(appId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, type }: { file: File; type: string }) => {
      const fd = new FormData();
      fd.append('type', type);
      fd.append('file', file);
      return api.upload(`/applications/${appId}/documents`, fd);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.documents(appId) });
      qc.invalidateQueries({ queryKey: qk.application(appId) });
      qc.invalidateQueries({ queryKey: ['applications'] });
      qc.invalidateQueries({ queryKey: qk.notifications });
      qc.invalidateQueries({ queryKey: qk.documentChecklist });
    },
  });
}

export function useReviewDocument(appId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision, feedback }: { id: string; decision: string; feedback?: string }) =>
      api.post(`/documents/${id}/review`, { decision, feedback }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.documents(appId) });
      qc.invalidateQueries({ queryKey: qk.application(appId) });
      qc.invalidateQueries({ queryKey: ['partner'] });
      qc.invalidateQueries({ queryKey: qk.notifications });
      qc.invalidateQueries({ queryKey: qk.documentChecklist });
    },
  });
}

/* ----------------------------- notifications --------------------------- */

export function useNotifications(poll = true) {
  return useQuery({
    queryKey: qk.notifications,
    queryFn: () =>
      unwrap(
        api.get<Envelope<{ notifications: NotificationItem[]; meta: { unread: number } }>>('/notifications', { pageSize: 30 }),
      ),
    refetchInterval: poll ? 20_000 : false,
  });
}

export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[] | 'all') => api.post('/notifications/read', { ids }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.notifications }),
  });
}

/* ------------------------------- partner ------------------------------- */

export function usePartnerSummary() {
  return useQuery({
    queryKey: qk.partnerSummary,
    queryFn: () => unwrap(api.get<Envelope<PartnerSummary>>('/partner/summary')),
    refetchInterval: 20_000,
  });
}

export function usePartnerApplications(params: { status?: string; schemeCode?: string; q?: string; page?: number }) {
  const key = JSON.stringify(params);
  return useQuery({
    queryKey: qk.partnerApplications(key),
    queryFn: () =>
      api
        .get<Envelope<Application[]>>('/partner/applications', {
          status: params.status,
          schemeCode: params.schemeCode,
          q: params.q,
          page: params.page ?? 1,
          pageSize: 20,
        })
        .then((r) => ({ items: r.data, pagination: r.meta?.pagination })),
    refetchInterval: 20_000,
  });
}

/* -------------------------------- admin -------------------------------- */

export function useAdminKpis() {
  return useQuery({
    queryKey: qk.adminKpis,
    queryFn: () => unwrap(api.get<Envelope<AdminKpis>>('/admin/kpis')),
    refetchInterval: 30_000,
  });
}

export function useAdminApplications(params: { status?: string; schemeCode?: string; page?: number }) {
  const key = JSON.stringify(params);
  return useQuery({
    queryKey: qk.adminApplications(key),
    queryFn: () =>
      api
        .get<Envelope<Application[]>>('/admin/applications', { status: params.status, schemeCode: params.schemeCode, page: params.page ?? 1, pageSize: 20 })
        .then((r) => ({ items: r.data, pagination: r.meta?.pagination })),
  });
}

export function useAdminPartners() {
  return useQuery({
    queryKey: qk.adminPartners,
    queryFn: () => api.get<Envelope<PartnerPublic[]>>('/admin/partners', { pageSize: 50 }).then((r) => r.data),
  });
}

export function useAdminAssign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ appId, partnerId, reason }: { appId: string; partnerId?: string; reason?: string }) =>
      api.post(`/admin/applications/${appId}/${partnerId && reason ? 'reassign' : 'assign'}`, { partnerId, reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin'] });
      qc.invalidateQueries({ queryKey: ['applications'] });
    },
  });
}
