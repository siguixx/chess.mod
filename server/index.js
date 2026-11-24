import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cookieParser from 'cookie-parser';
import { Server as SocketIOServer } from 'socket.io';
import { ChessDatabase } from './db/database.js';
import { createAuthMiddleware } from './auth/authService.js';
import { createAuthRouter } from './routes/auth.js';
import { createProfileRouter } from './routes/profile.js';
import { createGameRouter } from './routes/game.js';
import { createLeaderboardRouter } from './routes/leaderboard.js';
import { MultiplayerManager } from './multiplayer/matchmaking.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..');

export function createChessServer({
  port = Number(process.env.PORT) || 3000,
  host = process.env.HOST || '0.0.0.0',
  dbPath = process.env.CHESS_MOD_DB_PATH
} = {}) {
  const app = express();
  app.set('trust proxy', 1);

  const allowedOrigin = process.env.ALLOWED_ORIGIN || true;
  const httpServer = http.createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: { origin: allowedOrigin, credentials: true },
    transports: ['websocket', 'polling']
  });

  const db = new ChessDatabase(dbPath);
  const authMiddleware = createAuthMiddleware(db);
  const multiplayer = new MultiplayerManager(io, db);

  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  // Healthcheck público para Render.com / Koyeb ($0 Free Tier)
  app.get('/health', (_req, res) => {
    res.json({ ok: true, status: 'healthy', app: 'CHESS.MOD', db: db.driver, timestamp: new Date().toISOString() });
  });
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, status: 'healthy', app: 'CHESS.MOD', db: db.driver, timestamp: new Date().toISOString() });
  });

  // API routes
  app.use('/api/auth', createAuthRouter(db, authMiddleware));
  app.use('/api', createProfileRouter(db, authMiddleware));
  app.use('/api/game', createGameRouter(db, authMiddleware));
  app.use('/api/leaderboard', createLeaderboardRouter(db));

  // Static hosting (mismo origen para web + WebSockets HTTPS/WSS)
  app.use('/shared', express.static(path.join(ROOT_DIR, 'shared')));
  app.use(express.static(path.join(ROOT_DIR, 'client')));

  // Ruta secreta dedicada para el Boss Secreto BLACKY (sin 404 en producción)
  app.get('/blacky', (_req, res) => {
    res.sendFile(path.join(ROOT_DIR, 'client', 'index.html'));
  });

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/socket.io/')) return next();
    res.sendFile(path.join(ROOT_DIR, 'client', 'index.html'));
  });

  return {
    app,
    httpServer,
    io,
    db,
    multiplayer,
    start: async () => {
      await db.init();
      return new Promise((resolve) => {
        httpServer.listen(port, host, () => {
          const addr = httpServer.address();
          const boundPort = typeof addr === 'object' && addr ? addr.port : port;
          const displayHost = host === '0.0.0.0' ? '127.0.0.1' : host;
          resolve({ port: boundPort, url: `http://${displayHost}:${boundPort}` });
        });
      });
    },
    stop: async () => {
      multiplayer.destroy();
      await new Promise((resolve) => io.close(() => httpServer.close(resolve)));
      await db.close();
    }
  };
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isDirectRun) {
  const srv = createChessServer();
  srv.start().then(({ url }) => {
    console.log(`\n♟️  CHESS.MOD Server activo en: ${url}`);
    console.log(`   Base de datos (${srv.db.driver}): ${srv.db.driver === 'postgres' ? 'PostgreSQL (DATABASE_URL)' : srv.db.dbPath}\n`);
  });
}
