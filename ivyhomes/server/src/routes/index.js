import { Router } from 'express';
import { authController } from '../controllers/AuthController.js';
import { catalogController } from '../controllers/CatalogController.js';
import { savedController } from '../controllers/SavedController.js';
import { requireAuth } from '../middleware/auth.js';
import { datasetService } from '../services/DatasetService.js';

export const buildRouter = () => {
  const api = Router();

  api.get('/health', (_req, res) => res.json({
    status: 'ok',
    server_time: new Date().toISOString(),
    dataset: datasetService.ready ? datasetService.meta : null,
  }));

  api.post('/auth/login', authController.login);
  api.post('/auth/logout', authController.logout);
  api.get('/auth/me', requireAuth, authController.me);

  // The catalogue is behind auth, matching the upstream service.
  api.get('/facets', catalogController.facets);
  api.get('/listings', requireAuth, catalogController.listings);
  api.get('/listings/:id', requireAuth, catalogController.listing);
  api.get('/rentals', requireAuth, catalogController.rentals);
  api.get('/rentals/:id', requireAuth, catalogController.rental);
  api.get('/projects', requireAuth, catalogController.projects);
  api.get('/projects/:id', requireAuth, catalogController.project);
  api.get('/insights', requireAuth, catalogController.insights);

  api.get('/saved', requireAuth, savedController.list);
  api.get('/saved/ids', requireAuth, savedController.ids);
  api.post('/saved', requireAuth, savedController.add);
  api.delete('/saved/:id', requireAuth, savedController.remove);

  return api;
};
