import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { authRouter } from './modules/auth/auth.routes';
import { profileRouter } from './modules/users/users.routes';
import { schemesRouter } from './modules/schemes/schemes.routes';
import { recommendationsRouter } from './modules/recommendations/recommendations.routes';
import { financeRouter } from './modules/finance/finance.routes';
import { partnersRouter } from './modules/partners/partners.routes';
import { partnerPortalRouter } from './modules/partners/partner-portal.routes';
import { applicationsRouter } from './modules/applications/applications.routes';
import { documentsRouter } from './modules/documents/documents.routes';
import { digilockerRouter } from './modules/digilocker/digilocker.routes';
import { notificationsRouter } from './modules/notifications/notifications.routes';
import { adminRouter } from './modules/admin/admin.routes';
import { openapiDocument } from './openapi/openapi';
import { isDbConnected } from './config/db';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => {
  res.json({ data: { status: 'ok', db: isDbConnected() ? 'connected' : 'disconnected', time: new Date().toISOString() } });
});

apiRouter.get('/openapi.json', (_req, res) => res.json(openapiDocument));
apiRouter.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiDocument, { customSiteTitle: 'SchemeFit AI API' }));

apiRouter.use('/auth', authRouter);
apiRouter.use('/profile', profileRouter);
apiRouter.use('/schemes', schemesRouter);
apiRouter.use('/recommendations', recommendationsRouter);
apiRouter.use('/finance', financeRouter);
apiRouter.use('/partners', partnersRouter);
apiRouter.use('/partner', partnerPortalRouter);
apiRouter.use('/applications', applicationsRouter);
apiRouter.use('/documents', documentsRouter);
apiRouter.use('/digilocker', digilockerRouter);
apiRouter.use('/notifications', notificationsRouter);
apiRouter.use('/admin', adminRouter);
