import { Router } from 'express';
import { adminApiController } from '../controllers/adminApiController.ts';
import { footballApiErrorHandler } from '../middleware/errorHandler.ts';

export const adminApiV1Router = Router();

adminApiV1Router.get('/diagnostics', adminApiController.getDiagnostics);
adminApiV1Router.post('/test-connection', adminApiController.testConnection);
adminApiV1Router.post('/provider', adminApiController.selectProvider);
adminApiV1Router.patch('/endpoints', adminApiController.toggleEndpoint);
adminApiV1Router.post('/cache/clear', adminApiController.clearCache);
adminApiV1Router.post('/live-engine', adminApiController.controlLiveEngine);

adminApiV1Router.use(footballApiErrorHandler);
