import mongoose from 'mongoose';
import { createApp } from './app.js';
import { config } from './config/env.js';
import { datasetService } from './services/DatasetService.js';

const DATASET = new URL('../data/dataset.json', import.meta.url);

const start = async () => {
  datasetService.load(DATASET);
  console.log(`dataset loaded: ${datasetService.listings.length} listings, ${datasetService.rentals.length} rentals, ${datasetService.projects.length} projects`);

  await mongoose.connect(config.mongoUri);
  console.log(`mongo connected: ${config.mongoUri}`);

  createApp().listen(config.port, () => console.log(`api listening on http://localhost:${config.port}`));
};

start().catch((err) => {
  console.error('failed to start:', err.message);
  process.exit(1);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => { await mongoose.connection.close(); process.exit(0); });
}
