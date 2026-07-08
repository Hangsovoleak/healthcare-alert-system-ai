import crypto from "node:crypto";
import { Request, Response, NextFunction } from "express";

// ==========================================
// ENTERPRISE TYPES & DATA SCHEMAS
// ==========================================

export type UserRole = "MOH" | "HOSPITAL" | "CITIZEN";

export interface SecureUser {
  id: string;
  username: string;
  passwordHash: string;
  passwordSalt: string;
  role: UserRole;
  name: string;
  organization: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  userId: string | null;
  username: string | null;
  role: UserRole | null;
  ip: string;
  userAgent: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  details: string;
}

// In-Memory Databases
const usersDb = new Map<string, SecureUser>();
const refreshTokensDb = new Map<string, { userId: string; expiresAt: number }>();
const auditLogs: AuditLog[] = [];

// Secrets Management with cryptographically secure fallbacks
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || crypto.randomBytes(32).toString("hex");
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || crypto.randomBytes(32).toString("hex");
const CSRF_SECRET = process.env.CSRF_SECRET || crypto.randomBytes(32).toString("hex");

// ==========================================
// PASSWORD HASHING UTILITIES
// ==========================================

export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const finalSalt = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, finalSalt, 100000, 64, "sha512").toString("hex");
  return { hash, salt: finalSalt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const calculated = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return calculated === hash;
}

// ==========================================
// JWT & REFRESH TOKEN GENERATION
// ==========================================

function base64UrlEncode(str: string | Buffer): string {
  const base64 = typeof str === "string" ? Buffer.from(str).toString("base64") : str.toString("base64");
  return base64.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  return Buffer.from(base64, "base64").toString("utf8");
}

export function signToken(payload: any, secret: string, expiresInMinutes: number): string {
  const header = { alg: "HS256", typ: "JWT" };
  const exp = Math.floor(Date.now() / 1000) + expiresInMinutes * 60;
  const fullPayload = { ...payload, exp };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));

  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto.createHmac("sha256", secret).update(signatureInput).digest();
  const encodedSignature = base64UrlEncode(signature);

  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

export function verifyToken(token: string, secret: string): any | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    
    const expectedSignature = base64UrlEncode(
      crypto.createHmac("sha256", secret).update(signatureInput).digest()
    );

    if (encodedSignature !== expectedSignature) {
      return null; // Invalid signature
    }

    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Token expired
    }

    return payload;
  } catch (err) {
    return null;
  }
}

// ==========================================
// CSRF MITIGATION UTILITIES
// ==========================================

export function generateCsrfToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

export function signCsrf(token: string): string {
  return crypto.createHmac("sha256", CSRF_SECRET).update(token).digest("hex");
}

// ==========================================
// AUDIT LOGGING UTILITIES
// ==========================================

export function logAuditEvent(
  action: string,
  user: { id: string | null; username: string | null; role: UserRole | null },
  ip: string,
  userAgent: string,
  severity: "INFO" | "WARNING" | "CRITICAL",
  details: string
) {
  const log: AuditLog = {
    id: `audit-${crypto.randomUUID()}`,
    timestamp: new Date().toISOString(),
    action,
    userId: user.id,
    username: user.username,
    role: user.role,
    ip,
    userAgent: userAgent || "Unknown",
    severity,
    details
  };
  auditLogs.push(log);
  
  // Keep logs within standard 500 records limits
  if (auditLogs.length > 500) {
    auditLogs.shift();
  }

  // Print to secure syslogs
  console.log(`[AUDIT] [${log.severity}] ${log.action} - User: ${log.username || "Guest"} - IP: ${log.ip} - ${log.details}`);
}

export function getAuditLogs(): AuditLog[] {
  return auditLogs;
}

// ==========================================
// PRE-SEEDING ENTERPRISE USERS
// ==========================================

const SEEDED_RAW = [
  { id: "u-admin", username: "admin", password: "admin123", role: "MOH" as const, name: "Dr. Sopheap Sok", organization: "Ministry of Health" },
  { id: "u-operator", username: "operator", password: "op123", role: "HOSPITAL" as const, name: "Operator Keo", organization: "Calmette Command Node" },
  { id: "u-reporter", username: "reporter", password: "citizen123", role: "CITIZEN" as const, name: "Bystander Vanna", organization: "Citizen Network" }
];

export function initializeUsers() {
  if (usersDb.size > 0) return;
  
  SEEDED_RAW.forEach(u => {
    const { hash, salt } = hashPassword(u.password);
    usersDb.set(u.username, {
      id: u.id,
      username: u.username,
      passwordHash: hash,
      passwordSalt: salt,
      role: u.role,
      name: u.name,
      organization: u.organization
    });
  });
  console.log(`[SECURITY] Seeding completed. ${usersDb.size} enterprise users configured.`);
}

export function getUserByUsername(username: string): SecureUser | undefined {
  return usersDb.get(username);
}

export function getUserById(id: string): SecureUser | undefined {
  for (const user of usersDb.values()) {
    if (user.id === id) return user;
  }
  return undefined;
}

export function registerNewUser(username: string, pass: string, role: UserRole, name: string, org: string): SecureUser {
  if (usersDb.has(username)) {
    throw new Error("Username already exists");
  }
  const { hash, salt } = hashPassword(pass);
  const user: SecureUser = {
    id: `u-${crypto.randomUUID()}`,
    username,
    passwordHash: hash,
    passwordSalt: salt,
    role,
    name,
    organization: org
  };
  usersDb.set(username, user);
  return user;
}

// ==========================================
// REFRESH TOKENS STORE
// ==========================================

export function saveRefreshToken(userId: string, token: string, expiresInDays = 7) {
  const expiresAt = Date.now() + expiresInDays * 24 * 60 * 60 * 1000;
  refreshTokensDb.set(token, { userId, expiresAt });
}

export function verifyRefreshToken(token: string): string | null {
  const session = refreshTokensDb.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    refreshTokensDb.delete(token);
    return null;
  }
  return session.userId;
}

export function revokeRefreshToken(token: string) {
  refreshTokensDb.delete(token);
}

// ==========================================
// INPUT SANITIZATION UTILITIES
// ==========================================

/**
 * Strips script tags, converts dangerous markup to HTML entities,
 * and completely prevents XSS / Injection.
 */
export function sanitizeInput(input: string): string {
  if (!input) return "";
  let clean = input;
  // Strip script tags entirely
  clean = clean.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, "");
  // Replace critical HTML characters with safe entities
  clean = clean
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
  return clean;
}

/**
 * Recursively sanitizes any incoming JSON object properties.
 */
export function sanitizeObject<T>(obj: T): T {
  if (!obj || typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item)) as any;
  }

  const result: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const val = obj[key];
      if (typeof val === "string") {
        result[key] = sanitizeInput(val);
      } else if (typeof val === "object" && val !== null) {
        result[key] = sanitizeObject(val);
      } else {
        result[key] = val;
      }
    }
  }
  return result;
}

// ==========================================
// RATE LIMITING ENGINE
// ==========================================

const rateLimitsMap = new Map<string, { count: number; windowStart: number }>();

export function getRateLimiterMiddleware(limit = 100, windowMs = 60000) {
  return (req: Request, res: Response, next: NextFunction) => {
    // In demo environment, use req.ip or client header fallback
    const ip = req.ip || (req.headers["x-forwarded-for"] as string) || "127.0.0.1";
    const now = Date.now();
    const windowStart = now - (now % windowMs);

    let state = rateLimitsMap.get(ip);
    if (!state || state.windowStart !== windowStart) {
      state = { count: 1, windowStart };
      rateLimitsMap.set(ip, state);
    } else {
      state.count++;
    }

    const remaining = Math.max(0, limit - state.count);
    const resetTime = windowStart + windowMs;

    res.setHeader("X-RateLimit-Limit", limit);
    res.setHeader("X-RateLimit-Remaining", remaining);
    res.setHeader("X-RateLimit-Reset", Math.ceil(resetTime / 1000));

    if (state.count > limit) {
      logAuditEvent(
        "RATE_LIMIT_EXCEEDED",
        { id: null, username: null, role: null },
        ip,
        req.headers["user-agent"] || "",
        "WARNING",
        `IP ${ip} exceeded limit at URL: ${req.originalUrl} (${state.count}/${limit} reqs)`
      );
      res.status(429).json({
        error: "Too Many Requests",
        message: `API rate limit of ${limit} requests per minute exceeded. Please slow down.`
      });
      return;
    }
    next();
  };
}

// ==========================================
// SECURITY ACCESS MIDDLEWARES (JWT & CSRF)
// ==========================================

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    role: UserRole;
    name: string;
    organization: string;
  };
}

export function authenticateJwt(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // Extract from header or cookie
  let token = "";
  const authHeader = req.headers["authorization"];
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.substring(7);
  } else {
    // Check cookies fallback
    const cookieHeader = req.headers.cookie || "";
    const jwtCookie = cookieHeader.split(";").map(c => c.trim()).find(row => row.startsWith("jwt="));
    if (jwtCookie) {
      token = decodeURIComponent(jwtCookie.split("=")[1]);
    }
  }

  if (!token) {
    return res.status(401).json({ error: "Unauthorized", message: "JWT token required." });
  }

  const payload = verifyToken(token, JWT_ACCESS_SECRET);
  if (!payload) {
    return res.status(401).json({ error: "Unauthorized", message: "Invalid or expired JWT token." });
  }

  req.user = {
    id: payload.id,
    username: payload.username,
    role: payload.role,
    name: payload.name,
    organization: payload.organization
  };
  next();
}

/**
 * RBAC authorization gate
 */
export function authorizeRoles(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized", message: "Authentication required." });
    }

    if (!allowedRoles.includes(req.user.role)) {
      const ip = req.ip || (req.headers["x-forwarded-for"] as string) || "127.0.0.1";
      logAuditEvent(
        "ROLE_AUTHORIZATION_FAILED",
        { id: req.user.id, username: req.user.username, role: req.user.role },
        ip,
        req.headers["user-agent"] || "",
        "CRITICAL",
        `User ${req.user.username} (Role: ${req.user.role}) attempted unauthorized access to: ${req.originalUrl}`
      );
      return res.status(403).json({
        error: "Forbidden",
        message: `RBAC access denied. Requires one of: ${allowedRoles.join(", ")}`
      });
    }
    next();
  };
}

/**
 * CSRF Double-Submit Validation
 */
export function validateCsrf(req: Request, res: Response, next: NextFunction) {
  // Skip CSRF validation for safe GET, HEAD, OPTIONS
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  const headerCsrf = req.headers["x-csrf-token"] as string;
  const cookieHeader = req.headers.cookie || "";
  const csrfCookieRow = cookieHeader.split(";").map(c => c.trim()).find(row => row.startsWith("csrf_token="));
  const cookieCsrf = csrfCookieRow ? decodeURIComponent(csrfCookieRow.split("=")[1]) : "";

  if (!headerCsrf || !cookieCsrf || headerCsrf !== cookieCsrf) {
    const ip = req.ip || (req.headers["x-forwarded-for"] as string) || "127.0.0.1";
    logAuditEvent(
      "CSRF_VALIDATION_FAILED",
      { id: null, username: null, role: null },
      ip,
      req.headers["user-agent"] || "",
      "WARNING",
      `CSRF token mismatch on state change ${req.method} ${req.originalUrl}`
    );
    return res.status(403).json({
      error: "Forbidden",
      message: "CSRF token validation failed. Double-Submit check blocked request."
    });
  }
  next();
}

// Generate token pair for helper login returns
export function generateTokenPair(user: SecureUser) {
  const payload = {
    id: user.id,
    username: user.username,
    role: user.role,
    name: user.name,
    organization: user.organization
  };
  const accessToken = signToken(payload, JWT_ACCESS_SECRET, 15); // 15 mins
  const refreshToken = signToken({ id: user.id }, JWT_REFRESH_SECRET, 10080); // 7 days
  return { accessToken, refreshToken };
}
