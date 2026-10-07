import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env.js';
import { buildOpenApiDocument } from './docs/openapi.js';
import { errorMiddleware, notFoundMiddleware } from './middleware/error.middleware.js';
import { createRateLimiters, type RateLimitConfig } from './middleware/rate-limit.middleware.js';
import { requestLogger } from './middleware/request-logger.middleware.js';
import { createApiRouter } from './routes/index.js';

export interface AppOptions {
  rateLimits?: Partial<RateLimitConfig>;
}

export function createApp(options: AppOptions = {}): Express {
  const app = express();
  app.disable('x-powered-by');
  // Behind Render/Railway's proxy, req.ip must come from X-Forwarded-For or every user shares one rate-limit bucket.
  app.set('trust proxy', env.TRUST_PROXY);

  app.use(requestLogger);
  app.use(helmet());
  app.use(
    cors({
      // Browsers only: the mobile app sends no Origin header and is not subject to CORS.
      origin: (origin, callback) => callback(null, !origin || env.WEB_ORIGINS.includes(origin)),
      credentials: true, // allow the refresh-token cookie
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Client', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id', 'RateLimit', 'RateLimit-Policy', 'Retry-After'],
      maxAge: 600,
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  const limits = createRateLimiters({
    loginMax: env.RATE_LIMIT_LOGIN_MAX,
    loginPerAccountMax: env.RATE_LIMIT_LOGIN_PER_ACCOUNT_MAX,
    registerMax: env.RATE_LIMIT_REGISTER_MAX,
    refreshMax: env.RATE_LIMIT_REFRESH_MAX,
    apiMax: env.RATE_LIMIT_API_MAX,
    ...options.rateLimits,
  });

  // Interactive docs. Swagger UI needs inline styles, so its CSP is relaxed on this path only.
  const openApi = buildOpenApiDocument();
  app.get('/api/docs/openapi.json', (_req, res) => res.json(openApi));
  app.use(
    '/api/docs',
    helmet({ contentSecurityPolicy: { directives: { 'style-src': ["'self'", "'unsafe-inline'"], 'img-src': ["'self'", 'data:'] } } }),
    swaggerUi.serve,
    swaggerUi.setup(openApi, { customSiteTitle: 'PMS API docs', swaggerOptions: { persistAuthorization: true } }),
  );

  app.use('/api', limits.api, createApiRouter(limits));
  app.get('/', (_req, res) => res.redirect('/api/docs'));

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);
  return app;
}
