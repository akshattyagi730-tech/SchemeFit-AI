/**
 * Hand-authored OpenAPI 3.0 description of the SchemeFit AI API.
 * Served at GET /api/v1/openapi.json and rendered at GET /api/v1/docs.
 */
import { env } from '../config/env';

const errorEnvelope = {
  type: 'object',
  properties: {
    error: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
        requestId: { type: 'string' },
        fieldErrors: {
          type: 'array',
          items: { type: 'object', properties: { path: { type: 'string' }, message: { type: 'string' } } },
        },
      },
      required: ['code', 'message'],
    },
  },
};

const json = (schema: unknown) => ({ 'application/json': { schema } });
const dataObj = (props: Record<string, unknown>) => ({
  type: 'object',
  properties: { data: { type: 'object', properties: props } },
});

const responses = (okSchema: unknown) => ({
  '200': { description: 'Success', content: json(okSchema) },
  '400': { description: 'Bad request', content: json(errorEnvelope) },
  '401': { description: 'Not authenticated', content: json(errorEnvelope) },
  '403': { description: 'Forbidden', content: json(errorEnvelope) },
  '404': { description: 'Not found', content: json(errorEnvelope) },
  '409': { description: 'Conflict', content: json(errorEnvelope) },
  '422': { description: 'Validation failed', content: json(errorEnvelope) },
  '429': { description: 'Rate limited', content: json(errorEnvelope) },
});

const idParam = {
  name: 'id',
  in: 'path',
  required: true,
  schema: { type: 'string' },
};

const paginationParams = [
  { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
  { name: 'pageSize', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
  { name: 'sort', in: 'query', schema: { type: 'string' }, description: 'Allow-listed sort key (per endpoint).' },
  { name: 'order', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' } },
];

export const openapiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'SchemeFit AI API',
    version: '1.0.0',
    description: [
      'Backend for the SchemeFit AI prototype (Smart India Hackathon).',
      '',
      '**Money**: every monetary value is an integer number of *paise* (1 ₹ = 100 paise).',
      '**Auth**: cookie-based server-side sessions. Mutating requests require the `X-CSRF-Token`',
      'header matching the `sf_csrf` cookie (fetch `GET /auth/csrf` first).',
      '**Identity**: role and user id are always taken from the session — never from the request body.',
      '',
      'APPROVED / REJECTED application outcomes and scheme rule sets in this prototype are',
      'demonstration data and do not represent an official government service, sanction or disbursement.',
    ].join('\n'),
  },
  servers: [{ url: `http://localhost:${env.PORT}/api/v1`, description: 'Local development' }],
  tags: [
    { name: 'auth' }, { name: 'profile' }, { name: 'schemes' }, { name: 'recommendations' },
    { name: 'finance' }, { name: 'partners' }, { name: 'applications' }, { name: 'documents' },
    { name: 'notifications' }, { name: 'partner-portal' }, { name: 'admin' },
  ],
  components: {
    securitySchemes: {
      cookieSession: { type: 'apiKey', in: 'cookie', name: 'sf_session' },
    },
    schemas: { Error: errorEnvelope },
  },
  security: [{ cookieSession: [] }],
  paths: {
    '/health': { get: { tags: ['auth'], summary: 'Liveness + DB status', security: [], responses: responses(dataObj({})) } },

    '/auth/csrf': { get: { tags: ['auth'], summary: 'Issue CSRF cookie + token', security: [], responses: responses(dataObj({ csrfToken: { type: 'string' } })) } },
    '/auth/register': {
      post: {
        tags: ['auth'], summary: 'Citizen self-registration (always creates a CITIZEN)',
        security: [],
        requestBody: { required: true, content: json({ type: 'object', required: ['email', 'password', 'fullName'], properties: { email: { type: 'string', format: 'email' }, password: { type: 'string', minLength: 10 }, fullName: { type: 'string' } } }) },
        responses: { '201': { description: 'Created', content: json(dataObj({ user: { type: 'object' } })) }, ...responses(dataObj({ user: { type: 'object' } })) },
      },
    },
    '/auth/login': {
      post: {
        tags: ['auth'], summary: 'Login (generic error on failure, rate limited)', security: [],
        requestBody: { required: true, content: json({ type: 'object', required: ['email', 'password'], properties: { email: { type: 'string' }, password: { type: 'string' } } }) },
        responses: responses(dataObj({ user: { type: 'object' } })),
      },
    },
    '/auth/logout': { post: { tags: ['auth'], summary: 'Revoke the current session', responses: responses(dataObj({ loggedOut: { type: 'boolean' } })) } },
    '/auth/logout-all': { post: { tags: ['auth'], summary: 'Revoke all sessions for the user', responses: responses(dataObj({ loggedOut: { type: 'boolean' } })) } },
    '/auth/me': { get: { tags: ['auth'], summary: 'Current session identity', responses: responses(dataObj({ user: { type: 'object' }, session: { type: 'object' }, profileComplete: { type: 'boolean' } })) } },

    '/profile': {
      get: { tags: ['profile'], summary: 'Get own citizen profile', responses: responses(dataObj({ profile: { type: 'object' }, completeness: { type: 'object' } })) },
      put: { tags: ['profile'], summary: 'Update own citizen profile (does not touch submitted applications)', requestBody: { content: json({ type: 'object' }) }, responses: responses(dataObj({ profile: { type: 'object' } })) },
    },

    '/schemes': {
      get: {
        tags: ['schemes'], summary: 'List active schemes',
        parameters: [...paginationParams, { name: 'purpose', in: 'query', schema: { type: 'string' } }, { name: 'status', in: 'query', schema: { type: 'string', enum: ['active', 'archived', 'all'] } }],
        responses: responses({ type: 'object', properties: { data: { type: 'array', items: { type: 'object' } }, meta: { type: 'object' } } }),
      },
    },
    '/schemes/{id}': { get: { tags: ['schemes'], summary: 'Scheme detail (id or code)', parameters: [idParam], responses: responses(dataObj({ scheme: { type: 'object' } })) } },

    '/recommendations': {
      get: {
        tags: ['recommendations'],
        summary: 'Deterministic eligibility + suitability ranking for the signed-in citizen',
        description: 'Splits schemes into eligible (ranked, with factor breakdown), needs_information and ineligible (with reasons). No LLM is involved. Suitability score is a ranking number, not an approval probability.',
        responses: responses(dataObj({ eligible: { type: 'array' }, needsInformation: { type: 'array' }, ineligible: { type: 'array' } })),
      },
    },

    '/finance/calculate': {
      post: {
        tags: ['finance'],
        summary: 'Authoritative financial-plan calculation',
        description: 'The frontend live preview uses the identical algorithm. Supports zero-interest, moratorium (serviced/capitalised per scheme), and final-instalment rounding.',
        requestBody: { required: true, content: json({ type: 'object', required: ['schemeCode', 'projectCostPaise', 'ownContributionPaise', 'requestedLoanPaise', 'interestRateBps', 'tenureMonths'], properties: { schemeCode: { type: 'string' }, projectCostPaise: { type: 'integer' }, ownContributionPaise: { type: 'integer' }, requestedLoanPaise: { type: 'integer' }, interestRateBps: { type: 'integer' }, tenureMonths: { type: 'integer' }, moratoriumMonths: { type: 'integer' } } }) },
        responses: responses(dataObj({ plan: { type: 'object' } })),
      },
    },

    '/partners': { get: { tags: ['partners'], summary: 'Partner directory (public fields)', parameters: [{ name: 'schemeCode', in: 'query', schema: { type: 'string' } }], responses: responses(dataObj({ partners: { type: 'array' } })) } },
    '/partners/routing': {
      get: {
        tags: ['partners'], summary: 'Routing preview for the signed-in citizen (mandatory filters + ranking)',
        parameters: [{ name: 'schemeCode', in: 'query', required: true, schema: { type: 'string' } }],
        responses: responses(dataObj({ routing: { type: 'object' } })),
      },
    },

    '/applications': {
      get: { tags: ['applications'], summary: 'List applications (role-aware: own / assigned / all)', parameters: [...paginationParams, { name: 'status', in: 'query', schema: { type: 'string' } }, { name: 'schemeCode', in: 'query', schema: { type: 'string' } }], responses: responses({ type: 'object' }) },
      post: { tags: ['applications'], summary: 'Create a DRAFT application (citizen)', requestBody: { required: true, content: json({ type: 'object', required: ['schemeCode'], properties: { schemeCode: { type: 'string' } } }) }, responses: responses(dataObj({ application: { type: 'object' } })) },
    },
    '/applications/{id}': { get: { tags: ['applications'], summary: 'Application detail (object-level authorised)', parameters: [idParam], responses: responses(dataObj({ application: { type: 'object' } })) } },
    '/applications/{id}/financing': { patch: { tags: ['applications'], summary: 'Edit financing while DRAFT (citizen)', parameters: [idParam], requestBody: { content: json({ type: 'object' }) }, responses: responses(dataObj({ application: { type: 'object' } })) } },
    '/applications/{id}/submit': { post: { tags: ['applications'], summary: 'DRAFT → SUBMITTED (freezes snapshots)', parameters: [idParam], responses: responses(dataObj({ application: { type: 'object' } })) } },
    '/applications/{id}/resubmit': { post: { tags: ['applications'], summary: 'CHANGES_REQUESTED → UNDER_REVIEW (citizen)', parameters: [idParam], responses: responses(dataObj({ application: { type: 'object' } })) } },
    '/applications/{appId}/documents': {
      get: { tags: ['documents'], summary: 'List documents + server-computed readiness', parameters: [{ name: 'appId', in: 'path', required: true, schema: { type: 'string' } }, { name: 'history', in: 'query', schema: { type: 'string', enum: ['true', 'false'] } }], responses: responses(dataObj({ documents: { type: 'array' }, readiness: { type: 'object' } })) },
      post: { tags: ['documents'], summary: 'Upload a document (multipart; signature-validated; never auto-verified)', parameters: [{ name: 'appId', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' }, type: { type: 'string' } } } } } }, responses: responses(dataObj({ document: { type: 'object' } })) },
    },

    '/documents/{id}': { get: { tags: ['documents'], summary: 'Document metadata', parameters: [idParam], responses: responses(dataObj({ document: { type: 'object' } })) } },
    '/documents/{id}/download': { get: { tags: ['documents'], summary: 'Authenticated private download (streamed, no public URL)', parameters: [idParam], responses: { '200': { description: 'File stream', content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } } }, '403': { description: 'Forbidden' }, '404': { description: 'Missing' } } } },
    '/documents/{id}/review': { post: { tags: ['documents'], summary: 'Reviewer decision (verified / changes_requested / under_review)', parameters: [idParam], requestBody: { required: true, content: json({ type: 'object', required: ['decision'], properties: { decision: { type: 'string', enum: ['under_review', 'verified', 'changes_requested'] }, feedback: { type: 'string' } } }) }, responses: responses(dataObj({ document: { type: 'object' }, readiness: { type: 'object' } })) } },

    '/notifications': { get: { tags: ['notifications'], summary: 'List notifications', parameters: [{ name: 'unreadOnly', in: 'query', schema: { type: 'string', enum: ['true', 'false'] } }], responses: responses(dataObj({ notifications: { type: 'array' } })) } },
    '/notifications/read': { post: { tags: ['notifications'], summary: 'Mark notifications read', requestBody: { required: true, content: json({ type: 'object', properties: { ids: { oneOf: [{ type: 'array', items: { type: 'string' } }, { type: 'string', enum: ['all'] }] } } }) }, responses: responses(dataObj({ updated: { type: 'integer' } })) } },

    '/partner/summary': { get: { tags: ['partner-portal'], summary: 'Partner organisation dashboard summary', responses: responses(dataObj({ assignedTotal: { type: 'integer' } })) } },
    '/partner/applications': { get: { tags: ['partner-portal'], summary: 'Assigned applications (paginated, filterable)', parameters: [...paginationParams, { name: 'status', in: 'query', schema: { type: 'string' } }, { name: 'schemeCode', in: 'query', schema: { type: 'string' } }, { name: 'readiness', in: 'query', schema: { type: 'string', enum: ['complete', 'incomplete'] } }, { name: 'q', in: 'query', schema: { type: 'string' } }], responses: responses({ type: 'object' }) } },
    '/partner/applications/{id}': { get: { tags: ['partner-portal'], summary: 'Assigned application detail', parameters: [idParam], responses: responses(dataObj({ application: { type: 'object' } })) } },
    '/partner/applications/{id}/start-review': { post: { tags: ['partner-portal'], summary: 'ASSIGNED/CHANGES_REQUESTED → UNDER_REVIEW', parameters: [idParam], responses: responses(dataObj({ application: { type: 'object' } })) } },
    '/partner/applications/{id}/request-changes': { post: { tags: ['partner-portal'], summary: 'UNDER_REVIEW → CHANGES_REQUESTED (reason required)', parameters: [idParam], requestBody: { required: true, content: json({ type: 'object', required: ['reason'], properties: { reason: { type: 'string' } } }) }, responses: responses(dataObj({ application: { type: 'object' } })) } },
    '/partner/applications/{id}/approve': { post: { tags: ['partner-portal'], summary: 'UNDER_REVIEW → APPROVED (prototype outcome, not a sanction)', parameters: [idParam], responses: responses(dataObj({ application: { type: 'object' } })) } },
    '/partner/applications/{id}/reject': { post: { tags: ['partner-portal'], summary: 'UNDER_REVIEW → REJECTED (reason required)', parameters: [idParam], requestBody: { required: true, content: json({ type: 'object', required: ['reason'], properties: { reason: { type: 'string' } } }) }, responses: responses(dataObj({ application: { type: 'object' } })) } },

    '/admin/schemes': {
      get: { tags: ['admin'], summary: 'List schemes (incl. archived)', parameters: paginationParams, responses: responses({ type: 'object' }) },
      post: { tags: ['admin'], summary: 'Create a scheme rule set', requestBody: { required: true, content: json({ type: 'object' }) }, responses: responses(dataObj({ scheme: { type: 'object' } })) },
    },
    '/admin/schemes/{id}': { put: { tags: ['admin'], summary: 'Replace a scheme rule set', parameters: [idParam], requestBody: { required: true, content: json({ type: 'object' }) }, responses: responses(dataObj({ scheme: { type: 'object' } })) } },
    '/admin/schemes/{id}/archive': { post: { tags: ['admin'], summary: 'Archive a scheme', parameters: [idParam], responses: responses(dataObj({ scheme: { type: 'object' } })) } },
    '/admin/schemes/{id}/activate': { post: { tags: ['admin'], summary: 'Activate a scheme', parameters: [idParam], responses: responses(dataObj({ scheme: { type: 'object' } })) } },
    '/admin/partners': {
      get: { tags: ['admin'], summary: 'List partner organisations', parameters: paginationParams, responses: responses({ type: 'object' }) },
      post: { tags: ['admin'], summary: 'Create a partner organisation', requestBody: { required: true, content: json({ type: 'object' }) }, responses: responses(dataObj({ partner: { type: 'object' } })) },
    },
    '/admin/partners/{id}': {
      get: { tags: ['admin'], summary: 'Partner organisation detail', parameters: [idParam], responses: responses(dataObj({ partner: { type: 'object' } })) },
      patch: { tags: ['admin'], summary: 'Update a partner organisation (authorisation, capacity, accepting, ...)', parameters: [idParam], requestBody: { content: json({ type: 'object' }) }, responses: responses(dataObj({ partner: { type: 'object' } })) },
    },
    '/admin/users': { post: { tags: ['admin'], summary: 'Provision a PARTNER or ADMIN user (the only path to a non-citizen account)', requestBody: { required: true, content: json({ type: 'object', required: ['email', 'password', 'displayName', 'role'], properties: { email: { type: 'string' }, password: { type: 'string' }, displayName: { type: 'string' }, role: { type: 'string', enum: ['PARTNER', 'ADMIN'] }, partnerOrganizationId: { type: 'string' } } }) }, responses: responses(dataObj({ user: { type: 'object' } })) } },
    '/admin/applications': { get: { tags: ['admin'], summary: 'All applications (filterable)', parameters: [...paginationParams, { name: 'status', in: 'query', schema: { type: 'string' } }, { name: 'schemeCode', in: 'query', schema: { type: 'string' } }, { name: 'partnerId', in: 'query', schema: { type: 'string' } }], responses: responses({ type: 'object' }) } },
    '/admin/applications/{id}': { get: { tags: ['admin'], summary: 'Application detail', parameters: [idParam], responses: responses(dataObj({ application: { type: 'object' } })) } },
    '/admin/applications/{id}/history': { get: { tags: ['admin'], summary: 'Timeline + audit trail for one application', parameters: [idParam], responses: responses(dataObj({ timeline: { type: 'array' } })) } },
    '/admin/applications/{id}/assign': { post: { tags: ['admin'], summary: 'SUBMITTED → ASSIGNED (partnerId optional; defaults to top routing match)', parameters: [idParam], requestBody: { content: json({ type: 'object', properties: { partnerId: { type: 'string' }, reason: { type: 'string' } } }) }, responses: responses(dataObj({ application: { type: 'object' } })) } },
    '/admin/applications/{id}/reassign': { post: { tags: ['admin'], summary: 'Reassign to another partner (reason required)', parameters: [idParam], requestBody: { required: true, content: json({ type: 'object', required: ['reason'], properties: { partnerId: { type: 'string' }, reason: { type: 'string' } } }) }, responses: responses(dataObj({ application: { type: 'object' } })) } },
    '/admin/kpis': { get: { tags: ['admin'], summary: 'Database-derived KPIs and chart data (denominators stated inline)', responses: responses(dataObj({})) } },
    '/admin/audit': { get: { tags: ['admin'], summary: 'Audit event log (filterable)', parameters: [...paginationParams, { name: 'action', in: 'query', schema: { type: 'string' } }, { name: 'resourceType', in: 'query', schema: { type: 'string' } }], responses: responses({ type: 'object' }) } },
  },
} as const;
