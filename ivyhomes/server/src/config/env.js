import 'dotenv/config';

const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}. Copy .env.example to .env.`);
  return value;
};

export const config = Object.freeze({
  port: Number(process.env.PORT ?? 5000),
  env: process.env.NODE_ENV ?? 'development',
  isProd: process.env.NODE_ENV === 'production',
  mongoUri: process.env.MONGO_URI ?? 'mongodb://127.0.0.1:27017/ivyhomes',
  clientOrigin: (process.env.CLIENT_ORIGIN ?? 'http://localhost:5173').split(','),
  jwt: {
    secret: required('JWT_SECRET'),
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  },
  upstream: {
    baseUrl: process.env.IVY_BASE_URL ?? 'https://solve.ivy.homes',
    apiKey: required('IVY_API_KEY'),
    demoPassword: process.env.IVY_DEMO_PASSWORD ?? '',
  },
  city: process.env.IVY_CITY ?? 'pune',
  assignedLocality: process.env.IVY_ASSIGNED_LOCALITY ?? 'baner',
});
