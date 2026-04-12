import express from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { pool } from "./db";
import { registerRoutes } from "./routes";
import { storage } from "./storage";
import { startScheduler } from "./scheduler";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PgStore = connectPgSimple(session);
const app = express();
const isDev = process.env.NODE_ENV !== "production";
const PORT = parseInt(process.env.PORT || "5000");

// ---- Trust proxy (Replit runs behind a reverse proxy) ----
app.set("trust proxy", 1);

// ---- Security: HTTP headers ----
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    frameguard: false,
    crossOriginResourcePolicy: false,
  })
);

// ---- Security: Rate limiting ----
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Terlalu banyak permintaan, coba lagi nanti." },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Terlalu banyak percobaan login. Coba lagi dalam 15 menit." },
  skipSuccessfulRequests: true,
});

app.use(globalLimiter);

// ---- Body parser (limit dikurangi untuk keamanan) ----
app.use(express.json({ limit: "2mb" }));

// ---- Session ----
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  console.error("PERINGATAN KEAMANAN: SESSION_SECRET tidak diset! Gunakan secret yang kuat di production.");
}

app.use(session({
  store: new PgStore({ pool, createTableIfMissing: true }),
  secret: sessionSecret || "dev-secret-do-not-use-in-prod",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: !isDev,
    httpOnly: true,
    maxAge: 8 * 60 * 60 * 1000,
    sameSite: "lax",
  },
}));

registerRoutes(app, loginLimiter);

if (isDev) {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: "spa",
    root: process.cwd(),
  });
  app.use(vite.middlewares);
} else {
  const distPath = path.join(__dirname, "../dist");
  app.use(express.static(distPath));
  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

try {
  await storage.seedDefaults();
} catch (error) {
  console.error("seedDefaults failed", error);
}

try {
  startScheduler();
} catch (error) {
  console.error("startScheduler failed", error);
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
