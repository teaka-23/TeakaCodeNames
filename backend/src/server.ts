import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import roomRoutes from './routes/rooms';
import { setupWebSocket } from './utils/webSocketHandler';
import { roomManager } from './utils/roomManager';

dotenv.config();

const app = express();
const server = http.createServer(app);

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // Allows inline styles for the SPA
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много запросов, попробуйте позже' },
});
app.use('/api', limiter);

// CORS
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:3000', 'http://localhost'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests without origin (curl, same-origin)
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
}));

app.use(express.json({ limit: '10kb' }));

// Routes
app.use('/api', roomRoutes);

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Не найдено' });
});

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err.stack);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

// Setup WebSocket
setupWebSocket(server);

const PORT = Number(process.env.PORT) || 3001;

// Only listen when not under test; tests drive `app` via supertest
if (!process.env.JEST_WORKER_ID) {
  roomManager.restore()
    .then((count) => {
      if (count > 0) {
        console.log(`Restored ${count} room(s) from ${roomManager.persistenceLabel}`);
      }
    })
    .catch((error) => console.error('Failed to restore rooms:', error))
    .finally(() => {
      server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        console.log(`API: http://localhost:${PORT}/api`);
        console.log(`WebSocket: ws://localhost:${PORT}/ws`);
        console.log(`Persistence: ${roomManager.persistenceLabel}`);
      });
    });

  // Graceful shutdown: flush the last snapshot before exiting
  let shuttingDown = false;
  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log('Shutting down gracefully...');

    roomManager.persistNow()
      .catch((error) => console.error('Failed to flush rooms on shutdown:', error))
      .finally(() => {
        server.close(() => process.exit(0));
        setTimeout(() => process.exit(1), 10000);
      });
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

export { server };
export default app;
