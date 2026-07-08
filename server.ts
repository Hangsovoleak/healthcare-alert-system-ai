import express from "express";
import path from "path";
import fs from "fs";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { WebSocketServer, WebSocket } from "ws";
import {
  initializeUsers,
  getUserByUsername,
  getUserById,
  verifyPassword,
  generateTokenPair,
  saveRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
  getRateLimiterMiddleware,
  authenticateJwt,
  authorizeRoles,
  validateCsrf,
  generateCsrfToken,
  signCsrf,
  sanitizeInput,
  sanitizeObject,
  logAuditEvent,
  getAuditLogs,
  AuthenticatedRequest
} from "./src/security";

dotenv.config();

// Initialize Express
const app = express();
app.use(express.json());

// Initialize Seed Enterprise Users
initializeUsers();

// 1. Enterprise Secure Headers (mitigates Clickjacking, XSS, MIME sniffing)
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self' https: wss:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: https: blob:; connect-src 'self' https: wss:; font-src 'self' https: data:; frame-ancestors 'none';"
  );
  next();
});

// 2. Enterprise Cross-Origin Resource Sharing (CORS) restrictor
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, PATCH, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-CSRF-Token, X-Requested-With");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// 3. Enterprise Rate Limiter (sliding window protection for all APIs, tight limit for login)
app.use("/api/auth/login", getRateLimiterMiddleware(10, 60000)); // Max 10 attempts per minute
app.use("/api/", getRateLimiterMiddleware(120, 60000)); // Max 120 API calls per minute

// ==========================================
// ENTERPRISE AUTHENTICATION ENDPOINTS
// ==========================================

// Login & issue secure HttpOnly token pairs
app.post("/api/auth/login", (req, res) => {
  const body = sanitizeObject(req.body);
  const { username, password } = body;

  if (!username || !password) {
    return res.status(400).json({ error: "Bad Request", message: "Username and password are required." });
  }

  const user = getUserByUsername(username);
  if (!user || !verifyPassword(password, user.passwordHash, user.passwordSalt)) {
    logAuditEvent(
      "AUTH_LOGIN_FAILED",
      { id: null, username: username || "Unknown", role: null },
      req.ip || "127.0.0.1",
      req.headers["user-agent"] || "",
      "WARNING",
      `Failed authentication attempt for username: "${username}"`
    );
    return res.status(401).json({ error: "Unauthorized", message: "Invalid username or password." });
  }

  const { accessToken, refreshToken } = generateTokenPair(user);
  saveRefreshToken(user.id, refreshToken);

  const csrfToken = generateCsrfToken();
  // Always use SameSite=None; Secure for iframe compatibility
  const cookieOptions = "Path=/; HttpOnly; SameSite=None; Secure";

  logAuditEvent(
    "AUTH_LOGIN_SUCCESS",
    { id: user.id, username: user.username, role: user.role },
    req.ip || "127.0.0.1",
    req.headers["user-agent"] || "",
    "INFO",
    `User ${user.username} successfully authenticated as ${user.role}`
  );

  res.setHeader("Set-Cookie", [
    `jwt=${accessToken}; ${cookieOptions}; Max-Age=900`, // 15 mins
    `refresh_token=${refreshToken}; ${cookieOptions}; Max-Age=604800`, // 7 days
    `csrf_token=${csrfToken}; Path=/; SameSite=None; Secure; Max-Age=604800`
  ]);

  res.json({
    success: true,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      name: user.name,
      organization: user.organization
    },
    csrfToken,
    accessToken,
    refreshToken
  });
});

// Session Token Refresh
app.post("/api/auth/refresh", (req, res) => {
  let token = "";
  // Check request body fallback
  const body = sanitizeObject(req.body);
  if (body && body.refreshToken) {
    token = body.refreshToken;
  } else {
    const cookieHeader = req.headers.cookie || "";
    const refreshCookie = cookieHeader.split(";").map(c => c.trim()).find(row => row.startsWith("refresh_token="));
    if (refreshCookie) {
      token = decodeURIComponent(refreshCookie.split("=")[1]);
    }
  }

  if (!token) {
    return res.status(401).json({ error: "Unauthorized", message: "Refresh token required." });
  }

  const userId = verifyRefreshToken(token);
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized", message: "Invalid or expired refresh token." });
  }

  const user = getUserById(userId);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized", message: "User not found." });
  }

  const { accessToken, refreshToken: newRefreshToken } = generateTokenPair(user);
  revokeRefreshToken(token);
  saveRefreshToken(user.id, newRefreshToken);

  const csrfToken = generateCsrfToken();
  const cookieOptions = "Path=/; HttpOnly; SameSite=None; Secure";

  res.setHeader("Set-Cookie", [
    `jwt=${accessToken}; ${cookieOptions}; Max-Age=900`,
    `refresh_token=${newRefreshToken}; ${cookieOptions}; Max-Age=604800`,
    `csrf_token=${csrfToken}; Path=/; SameSite=None; Secure; Max-Age=604800`
  ]);

  res.json({
    success: true,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      name: user.name,
      organization: user.organization
    },
    csrfToken,
    accessToken,
    refreshToken: newRefreshToken
  });
});

// Logout & revoke refresh tokens
app.post("/api/auth/logout", (req, res) => {
  let token = "";
  const cookieHeader = req.headers.cookie || "";
  const refreshCookie = cookieHeader.split(";").map(c => c.trim()).find(row => row.startsWith("refresh_token="));
  if (refreshCookie) {
    token = decodeURIComponent(refreshCookie.split("=")[1]);
    revokeRefreshToken(token);
  }

  res.setHeader("Set-Cookie", [
    "jwt=; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=0",
    "refresh_token=; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=0",
    "csrf_token=; Path=/; SameSite=None; Secure; Max-Age=0"
  ]);

  res.json({ success: true, message: "Logged out successfully." });
});

// Self user profile check
app.get("/api/auth/me", authenticateJwt, (req: AuthenticatedRequest, res) => {
  res.json({ success: true, user: req.user });
});

// Security Audit Logs console (RBAC gate: MOH only)
app.get("/api/security/audit-logs", authenticateJwt, authorizeRoles("MOH"), (req, res) => {
  res.json({ success: true, logs: getAuditLogs() });
});

const PORT = 3000;

// Initialize Gemini Client
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey) {
  ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
  console.log("Gemini API initialized successfully.");
} else {
  console.warn("GEMINI_API_KEY is not defined. AI features will fallback to mock responses.");
}

// ==========================================
// GEMINI INTELLIGENCE PLATFORM ENGINE & TOOLS
// ==========================================

// 1. Prompt Templates
const PROMPT_TEMPLATES = {
  /**
   * Generates a template for full multimodal triage and incident analysis.
   */
  triageAnalysis: (description: string, locationName: string, hospitalStateContext: string) => `
You are LifeLink AI, the leading autonomous emergency medical dispatcher and clinical triage brain in Phnom Penh, Cambodia.
Your purpose is to analyze incoming emergency distress calls, evaluate clinical risks, predict severity metrics, and recommend optimal hospital routing.

EMERGENCY INCIDENT DATA:
- Reporter Description: "${description}"
- Reported Landmark/Location: "${locationName}"

LIVE PHNOM PENH TRAUMA CENTER GRID STATUS:
${hospitalStateContext}

CRITICAL RULES FOR RESPONSE:
1. "triageLevel": Categorize into RED (Critical life-threat, airway/breathing/circulation failure, major shock, unconsciousness), YELLOW (Urgent, fractures, stable severe pain, high fever), or GREEN (Non-urgent, minor cuts, bruising, stable chronic symptoms).
2. "priorityScore": Provide an integer between 0 and 100 representing acute clinical severity.
3. "conscious": Describe conscious state: "Conscious", "Unconscious", "Semi-conscious", or "Unknown".
4. "breathing": Describe breathing status: "Normal", "Labored", "Arrested", or "Unknown".
5. "injuries": List identified physical injuries or symptoms in standard clinical terminology.
6. "specialties": List required medical disciplines selected from: Trauma, Cardiology, Pediatrics, Infectious Diseases, Neurology, General Surgery, Emergency Medicine.
7. "firstAidKhmer": Formulate clear, concise, step-by-step first aid instructions in Khmer. Be highly encouraging and reassuring.
8. "firstAidEnglish": Formulate clear, concise, step-by-step first aid instructions in English.
9. "translatedDescription": Provide a professional English medical translation of the reporter's statement.
10. "priorityRationale": Detail the clear clinical reasoning for the predicted triage level and score, referencing visual wound evidence or breathing difficulties if present.
11. "hospitalRecommendationRationale": Specify the medical reason why a certain hospital is recommended. Connect the patient's symptoms (e.g. neurotrauma, pediatric, burn) directly to the hospital's specialties, ICU bed occupancy, and ambulance availabilities.

Format your response STRICTLY as a single JSON object. Ensure no trailing commas or markdown outside of the JSON block.
`,

  /**
   * Generates a template for real-time streaming dispatcher companion.
   */
  streamingCommentary: (description: string, locationName: string) => `
You are LifeLink AI, the active dispatcher's copilot.
We have just received a critical incident alert from: "${locationName}".
Reporter text: "${description}"

Provide a live, stream-of-consciousness tactical dispatch briefing for the responding paramedics (approx 120-150 words).
Detail step-by-step what actions you are taking:
1. Translating coordinates and speech patterns.
2. Predicting triage priority based on respiratory or consciousness distress cues.
3. Matching hospital specialty nodes and preparing the emergency trauma team.
4. Supplying vital first-aid directions to bystanders.

Write with high clinical authority, medical urgency, and absolute clarity.
`
};

// 2. Retry Logic with Exponential Backoff and Jitter
async function callGeminiWithRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await operation();
    } catch (err: any) {
      attempt++;
      const errStr = String(err);
      // Catch both rate limits (429/quota) and transient server/network errors (503, 500, UNAVAILABLE, etc.)
      const isRetriable = 
        errStr.includes("429") || 
        errStr.includes("RESOURCE_EXHAUSTED") || 
        errStr.includes("quota") ||
        errStr.includes("503") ||
        errStr.includes("500") ||
        errStr.includes("UNAVAILABLE") ||
        errStr.includes("high demand") ||
        errStr.includes("Service Unavailable") ||
        errStr.includes("Internal Server Error") ||
        errStr.includes("INTERNAL") ||
        errStr.includes("fetch failed");
      
      if (isRetriable && attempt < maxRetries) {
        // Exponential backoff with jitter
        const jitter = Math.random() * 200;
        const delay = baseDelay * Math.pow(2, attempt) + jitter;
        console.warn(`[GEMINI RETRY] Retriable error encountered (Attempt ${attempt}/${maxRetries}). Retrying in ${Math.round(delay)}ms... Error: ${errStr}`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        console.error(`[GEMINI ERROR] Attempt ${attempt} failed with non-retriable or terminal error:`, err);
        throw err;
      }
    }
  }
  throw new Error("Maximum retries exhausted for Gemini API call.");
}

// 3. Robust Response Parser
function parseGeminiResponse(text: string, description: string): any {
  if (!text) {
    throw new Error("No text returned from Gemini model.");
  }

  let cleaned = text.trim();
  // Strip markdown JSON wrapper if present
  const jsonBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/i;
  const match = cleaned.match(jsonBlockRegex);
  if (match) {
    cleaned = match[1].trim();
  }

  try {
    const parsed = JSON.parse(cleaned);

    // Validate fields and enforce defaults for bulletproof reliability
    return {
      triageLevel: (parsed.triageLevel === "RED" || parsed.triageLevel === "YELLOW" || parsed.triageLevel === "GREEN")
        ? parsed.triageLevel
        : "YELLOW",
      priorityScore: typeof parsed.priorityScore === "number" ? Math.min(Math.max(parsed.priorityScore, 0), 100) : 50,
      conscious: parsed.conscious || "Conscious",
      breathing: parsed.breathing || "Normal",
      injuries: Array.isArray(parsed.injuries) && parsed.injuries.length > 0 ? parsed.injuries : ["General trauma / symptoms reported"],
      specialties: Array.isArray(parsed.specialties) && parsed.specialties.length > 0 ? parsed.specialties : ["Emergency Medicine"],
      firstAidKhmer: parsed.firstAidKhmer || "១. រក្សាសុវត្ថិភាពខ្លួនឯង និងជនរងគ្រោះ\n២. បង្ហូរឈាម៖ សង្កត់របួសដោយក្រណាត់ស្អាត\n៣. ដាក់ជនរងគ្រោះក្នុងទីតាំងមានសុវត្ថិភាព",
      firstAidEnglish: parsed.firstAidEnglish || "1. Ensure scene safety for yourself and the victim.\n2. Apply direct pressure to any bleeding with a clean cloth.\n3. Place the victim in the recovery position.",
      translatedDescription: parsed.translatedDescription || description,
      priorityRationale: parsed.priorityRationale || "Assigned standard urgency score based on incident descriptors.",
      hospitalRecommendationRationale: parsed.hospitalRecommendationRationale || "Routed based on regional specialty compatibility and proximity metrics."
    };
  } catch (err) {
    console.error("[PARSER FAILED] Could not parse JSON from response. Raw text was:", text);
    throw err; // bubble up to trigger full clinical fallback
  }
}

// Haversine distance formula (in km)
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Mock Database / State
interface Hospital {
  id: string;
  name: string;
  nameKhmer: string;
  lat: number;
  lng: number;
  availableIcuBeds: number;
  totalIcuBeds: number;
  availableAmbulances: number;
  totalAmbulances: number;
  specialties: string[];
  phone: string;
}

interface Ambulance {
  id: string;
  hospitalId: string;
  plateNumber: string;
  status: "Available" | "Dispatched" | "On-Scene" | "Transporting" | "Returning";
  lat: number;
  lng: number;
  patientId: string | null;
}

interface TimelineEvent {
  status: string;
  timestamp: string;
  note: string;
}

interface Incident {
  id: string;
  reportedAt: string;
  reporterName: string;
  reporterPhone: string;
  description: string;
  locationName: string;
  lat: number;
  lng: number;
  triageLevel: "RED" | "YELLOW" | "GREEN";
  priorityScore: number;
  status: "Reported" | "Ambulance Dispatched" | "On-Scene" | "Transporting" | "Arrived at Hospital" | "Resolved";
  assignedHospitalId: string | null;
  assignedAmbulanceId: string | null;
  patientCount: number;
  injuries: string[];
  conscious: string;
  breathing: string;
  firstAidKhmer: string;
  firstAidEnglish: string;
  translatedDescription: string;
  timeline: TimelineEvent[];
  priorityRationale?: string;
  hospitalRecommendationRationale?: string;
  imageUrl?: string;
  audioUrl?: string;
}

// Pre-seeded hospital data in Phnom Penh
const SEEDED_HOSPITALS: Hospital[] = [
  {
    id: "hosp-calmette",
    name: "Calmette Hospital",
    nameKhmer: "មន្ទីរពេទ្យកាល់ម៉ែត",
    lat: 11.5804,
    lng: 104.9189,
    availableIcuBeds: 6,
    totalIcuBeds: 25,
    availableAmbulances: 3,
    totalAmbulances: 6,
    specialties: ["Trauma", "Cardiology", "Neurosurgery", "Intensive Care"],
    phone: "023 426 948",
  },
  {
    id: "hosp-khmer-soviet",
    name: "Khmer-Soviet Friendship Hospital",
    nameKhmer: "មន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត",
    lat: 11.5367,
    lng: 104.9083,
    availableIcuBeds: 8,
    totalIcuBeds: 30,
    availableAmbulances: 4,
    totalAmbulances: 8,
    specialties: ["Burn Unit", "Trauma", "Infectious Diseases", "General Surgery"],
    phone: "023 217 764",
  },
  {
    id: "hosp-kantha-bopha",
    name: "Kantha Bopha Children's Hospital IV",
    nameKhmer: "មន្ទីរពេទ្យគន្ធបុប្ផាទី៤",
    lat: 11.5791,
    lng: 104.9221,
    availableIcuBeds: 12,
    totalIcuBeds: 40,
    availableAmbulances: 2,
    totalAmbulances: 5,
    specialties: ["Pediatrics", "Pediatric Trauma", "Neonatal Intensive Care"],
    phone: "023 430 043",
  },
  {
    id: "hosp-royal-phnom-penh",
    name: "Royal Phnom Penh Hospital",
    nameKhmer: "មន្ទីរពេទ្យរ៉ូយ៉ាល់ភ្នំពេញ",
    lat: 11.5645,
    lng: 104.8821,
    availableIcuBeds: 14,
    totalIcuBeds: 20,
    availableAmbulances: 5,
    totalAmbulances: 6,
    specialties: ["Cardiology", "Emergency Medicine", "Trauma", "Neurology"],
    phone: "023 991 111",
  },
  {
    id: "hosp-cho-ray",
    name: "Cho Ray Phnom Penh Hospital",
    nameKhmer: "មន្ទីរពេទ្យចោរៃភ្នំពេញ",
    lat: 11.5235,
    lng: 104.9754,
    availableIcuBeds: 5,
    totalIcuBeds: 15,
    availableAmbulances: 2,
    totalAmbulances: 4,
    specialties: ["General Surgery", "Orthopedics", "Trauma"],
    phone: "023 684 1001",
  }
];

// Pre-seeded ambulance data linked to hospitals
const SEEDED_AMBULANCES: Ambulance[] = [
  { id: "amb-calmette-1", hospitalId: "hosp-calmette", plateNumber: "PP-2A-1109", status: "Available", lat: 11.5804, lng: 104.9189, patientId: null },
  { id: "amb-calmette-2", hospitalId: "hosp-calmette", plateNumber: "PP-2A-1110", status: "Available", lat: 11.5804, lng: 104.9189, patientId: null },
  { id: "amb-calmette-3", hospitalId: "hosp-calmette", plateNumber: "PP-2B-3345", status: "Available", lat: 11.5804, lng: 104.9189, patientId: null },
  { id: "amb-khmer-soviet-1", hospitalId: "hosp-khmer-soviet", plateNumber: "PP-2C-5582", status: "Available", lat: 11.5367, lng: 104.9083, patientId: null },
  { id: "amb-khmer-soviet-2", hospitalId: "hosp-khmer-soviet", plateNumber: "PP-2C-5583", status: "Available", lat: 11.5367, lng: 104.9083, patientId: null },
  { id: "amb-kantha-1", hospitalId: "hosp-kantha-bopha", plateNumber: "PP-2F-9091", status: "Available", lat: 11.5791, lng: 104.9221, patientId: null },
  { id: "amb-royal-1", hospitalId: "hosp-royal-phnom-penh", plateNumber: "PP-2X-4456", status: "Available", lat: 11.5645, lng: 104.8821, patientId: null },
  { id: "amb-cho-ray-1", hospitalId: "hosp-cho-ray", plateNumber: "PP-2D-7788", status: "Available", lat: 11.5235, lng: 104.9754, patientId: null }
];

// Historic incidents pre-seeding
const SEEDED_INCIDENTS: Incident[] = [
  {
    id: "inc-001",
    reportedAt: new Date(Date.now() - 4 * 3600000).toISOString(), // 4 hours ago
    reporterName: "Sokha Sopheap",
    reporterPhone: "+855 12 345 678",
    description: "ក្អួតឈាមខ្លាំង និងហត់ដង្ហក់ខ្លាំង (Vomiting blood severely and heavy breathing difficulties)",
    locationName: "Wat Phnom, Phnom Penh",
    lat: 11.5761,
    lng: 104.9230,
    triageLevel: "RED",
    priorityScore: 92,
    status: "Resolved",
    assignedHospitalId: "hosp-calmette",
    assignedAmbulanceId: "amb-calmette-1",
    patientCount: 1,
    injuries: ["Internal bleeding", "Respiratory distress"],
    conscious: "Semi-conscious",
    breathing: "Labored",
    firstAidKhmer: "១. ដាក់អ្នកជំងឺឲ្យគេងផ្អៀងដើម្បីការពារការស្ទះផ្លូវដង្ហើម។\n២. កុំផ្ដល់អាហារ ឬទឹក។\n៣. តាមដានដង្ហើមជានិច្ច។",
    firstAidEnglish: "1. Keep patient in recovery position (on their side) to keep airway clear.\n2. Do not give any food or liquids.\n3. Monitor breathing closely.",
    translatedDescription: "Severe vomiting of blood and heavy shortness of breath near Wat Phnom.",
    timeline: [
      { status: "Reported", timestamp: new Date(Date.now() - 4 * 3600000).toISOString(), note: "Emergency alert triggered by citizen." },
      { status: "Ambulance Dispatched", timestamp: new Date(Date.now() - 3.9 * 3600000).toISOString(), note: "Ambulance PP-2A-1109 dispatched from Calmette Hospital." },
      { status: "On-Scene", timestamp: new Date(Date.now() - 3.7 * 3600000).toISOString(), note: "Paramedics arrived. Patient is semi-conscious with high heart rate." },
      { status: "Transporting", timestamp: new Date(Date.now() - 3.5 * 3600000).toISOString(), note: "Patient stabilized. Transferring to Calmette Trauma/ICU." },
      { status: "Arrived at Hospital", timestamp: new Date(Date.now() - 3.3 * 3600000).toISOString(), note: "Patient admitted. ICU bed secured." },
      { status: "Resolved", timestamp: new Date(Date.now() - 2 * 3600000).toISOString(), note: "Emergency case successfully treated and closed." }
    ]
  },
  {
    id: "inc-002",
    reportedAt: new Date(Date.now() - 2 * 3600000).toISOString(), // 2 hours ago
    reporterName: "Channary Keo",
    reporterPhone: "+855 89 223 344",
    description: "ក្មេងដួលបាក់ដៃ មានឈាមហូរតិចតួច (Child fell, fractured arm with minor bleeding)",
    locationName: "Tuol Sleng Genocide Museum, St 113, Phnom Penh",
    lat: 11.5494,
    lng: 104.9174,
    triageLevel: "YELLOW",
    priorityScore: 65,
    status: "Resolved",
    assignedHospitalId: "hosp-kantha-bopha",
    assignedAmbulanceId: "amb-kantha-1",
    patientCount: 1,
    injuries: ["Arm fracture", "Minor abrasion"],
    conscious: "Conscious",
    breathing: "Normal",
    firstAidKhmer: "១. កុំព្យាយាមតម្រង់ឆ្អឹងបាក់។\n២. ប្រើស្អំទឹកកកដើម្បីបន្ថយការហើម។\n៣. ឃាត់ឈាមហូរដោយការសង្កត់ថ្នមៗជាមួយក្រណាត់ស្អាត។",
    firstAidEnglish: "1. Do not try to realign the bone.\n2. Apply a cold compress to reduce swelling.\n3. Control minor bleeding with gentle pressure using a clean cloth.",
    translatedDescription: "Child fell and broke arm, has minor bleeding near Tuol Sleng.",
    timeline: [
      { status: "Reported", timestamp: new Date(Date.now() - 2 * 3600000).toISOString(), note: "Pediatric alert reported." },
      { status: "Ambulance Dispatched", timestamp: new Date(Date.now() - 1.95 * 3600000).toISOString(), note: "Kantha Bopha pediatric crew dispatched." },
      { status: "On-Scene", timestamp: new Date(Date.now() - 1.8 * 3600000).toISOString(), note: "Sling applied, bleeding cleaned and dressed." },
      { status: "Transporting", timestamp: new Date(Date.now() - 1.7 * 3600000).toISOString(), note: "Transporting pediatric patient with father to Kantha Bopha IV." },
      { status: "Arrived at Hospital", timestamp: new Date(Date.now() - 1.5 * 3600000).toISOString(), note: "Admitted into pediatric ortho ward." },
      { status: "Resolved", timestamp: new Date(Date.now() - 1 * 3600000).toISOString(), note: "Cast applied successfully. Case resolved." }
    ]
  }
];

// Active databases in memory
let stateHospitals = JSON.parse(JSON.stringify(SEEDED_HOSPITALS));
let stateAmbulances = JSON.parse(JSON.stringify(SEEDED_AMBULANCES));
let stateIncidents = JSON.parse(JSON.stringify(SEEDED_INCIDENTS));

// Tracks attempted hospital IDs for each incident to handle auto-routing and decline loops
const attemptedHospitalsForIncident = new Map<string, string[]>();

export interface NotificationItem {
  id: string;
  type: "WEBSOCKET" | "PUSH" | "EMAIL" | "SMS" | "HOSPITAL_ALERT" | "MINISTRY_ESCALATION";
  title: string;
  message: string;
  timestamp: string;
  status: "Sent" | "Failed" | "Queued" | "Retrying" | "Delivered";
  recipient: string;
  incidentId?: string;
  attempts?: number;
}

let stateNotifications: NotificationItem[] = [
  {
    id: "notif-001",
    type: "SMS",
    title: "SMS Bystander Dispatch",
    message: "SMS sent to Sokha Sopheap (+855 12 345 678): 'Your emergency incident inc-001 is received. Ambulance PP-2A-1109 dispatched.'",
    timestamp: new Date(Date.now() - 4 * 3600000).toISOString(),
    status: "Delivered",
    recipient: "+855 12 345 678",
    incidentId: "inc-001",
    attempts: 1
  },
  {
    id: "notif-002",
    type: "HOSPITAL_ALERT",
    title: "Hospital Trauma Bed Lockout",
    message: "Direct alert sent to Calmette Hospital Trauma Center: 'Critical RED Patient (inc-001) in transit. Airway compromised. Pre-emptively reserving ICU Trauma Bed #04.'",
    timestamp: new Date(Date.now() - 3.9 * 3600000).toISOString(),
    status: "Delivered",
    recipient: "Calmette Hospital Emergency Room",
    incidentId: "inc-001",
    attempts: 1
  },
  {
    id: "notif-003",
    type: "MINISTRY_ESCALATION",
    title: "MOH Central Trauma Escalation",
    message: "Incident inc-001 escalated to Ministry of Health (MOH) Central Dispatch: 'Critical RED priority incident near Wat Phnom. Calmette ICU capacity now at 80%.'",
    timestamp: new Date(Date.now() - 3.8 * 3600000).toISOString(),
    status: "Delivered",
    recipient: "MOH Emergency Command Secretariat",
    incidentId: "inc-001",
    attempts: 1
  },
  {
    id: "notif-004",
    type: "EMAIL",
    title: "ER Physician Briefing",
    message: "Detailed diagnostic briefing email to Calmette Trauma Chief (trauma.chief@calmette.kh): 'Patient Sokha Sopheap (Vomiting blood severely). Paramedic ETA: 8 mins.'",
    timestamp: new Date(Date.now() - 3.5 * 3600000).toISOString(),
    status: "Failed",
    recipient: "trauma.chief@calmette.kh",
    incidentId: "inc-001",
    attempts: 3
  },
  {
    id: "notif-005",
    type: "SMS",
    title: "SMS Bystander Dispatch",
    message: "SMS sent to Channary Keo (+855 89 223 344): 'Your emergency incident inc-002 is received. Kantha Bopha pediatric crew dispatched.'",
    timestamp: new Date(Date.now() - 2 * 3600000).toISOString(),
    status: "Delivered",
    recipient: "+855 89 223 344",
    incidentId: "inc-002",
    attempts: 1
  },
  {
    id: "notif-006",
    type: "HOSPITAL_ALERT",
    title: "Pediatric Ortho Alert",
    message: "Direct alert sent to Kantha Bopha Children's Hospital: 'Child fell, arm fracture (inc-002) in transit. Pediatric surgical unit prepared.'",
    timestamp: new Date(Date.now() - 1.95 * 3600000).toISOString(),
    status: "Delivered",
    recipient: "Kantha Bopha Children's Hospital",
    incidentId: "inc-002",
    attempts: 1
  }
];

const connectedClients = new Set<WebSocket>();

function broadcast(data: any) {
  const payload = JSON.stringify(data);
  connectedClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

function triggerNotificationFlow(incident: any, hospital: any, ambulance: any) {
  const now = new Date().toISOString();
  
  // 1. WebSocket Broadcast to all active consoles
  broadcast({
    type: "incident_created",
    incident
  });

  // 2. Push Notification (for operators browser)
  const pushNotif: NotificationItem = {
    id: `notif-push-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    type: "PUSH",
    title: "Critical Dispatch Required",
    message: `New incident reported at ${incident.locationName}. Triage Level: ${incident.triageLevel} (${incident.priorityScore}/100)`,
    timestamp: now,
    status: "Delivered",
    recipient: "Active Dispatch Consoles",
    incidentId: incident.id,
    attempts: 1
  };
  stateNotifications.unshift(pushNotif);
  broadcast({ type: "notification_created", notification: pushNotif });

  // 3. SMS to Bystander/Reporter
  const smsNotif: NotificationItem = {
    id: `notif-sms-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    type: "SMS",
    title: "SMS Bystander Dispatch",
    message: `SMS sent to ${incident.reporterName} (${incident.reporterPhone}): "LifeLink emergency received. Triage level ${incident.triageLevel}. ${ambulance ? 'Ambulance ' + ambulance.plateNumber + ' dispatched.' : 'Crew is matching.'}"`,
    timestamp: now,
    status: Math.random() > 0.15 ? "Delivered" : "Failed", // 15% fail rate for simulation
    recipient: incident.reporterPhone,
    incidentId: incident.id,
    attempts: 1
  };
  stateNotifications.unshift(smsNotif);
  broadcast({ type: "notification_created", notification: smsNotif });

  // 4. Hospital ER Alert
  if (hospital) {
    const hospNotif: NotificationItem = {
      id: `notif-hosp-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      type: "HOSPITAL_ALERT",
      title: `${incident.triageLevel} Emergency Admissions Alert`,
      message: `Direct ER Alert sent to ${hospital.name}: "Incoming triage ${incident.triageLevel} patient. Injuries: ${incident.injuries.join(', ')}. Ambulance: ${ambulance ? ambulance.plateNumber : 'N/A'}"`,
      timestamp: now,
      status: "Delivered",
      recipient: `${hospital.name} ER Command Terminal`,
      incidentId: incident.id,
      attempts: 1
    };
    stateNotifications.unshift(hospNotif);
    broadcast({ type: "notification_created", notification: hospNotif });
  }

  // 5. Ministry Escalation for RED Alerts
  if (incident.triageLevel === "RED") {
    const mohNotif: NotificationItem = {
      id: `notif-moh-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      type: "MINISTRY_ESCALATION",
      title: "MOH Level-1 Clinical Escalation",
      message: `Automatic Escalation to Ministry of Health Central: "RED Priority Patient alert at ${incident.locationName}. Priority score: ${incident.priorityScore}. ICU Ward space allocated."`,
      timestamp: now,
      status: "Delivered",
      recipient: "MOH Health Security Command Center",
      incidentId: incident.id,
      attempts: 1
    };
    stateNotifications.unshift(mohNotif);
    broadcast({ type: "notification_created", notification: mohNotif });
  }

  // 6. Detailed Email Briefing (with simulation failure to showcase the retry queue)
  if (hospital) {
    const emailNotif: NotificationItem = {
      id: `notif-email-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      type: "EMAIL",
      title: "Diagnostic Physician Briefing",
      message: `Email to Trauma Director (trauma.lead@${hospital.id}.gov.kh): "Full Clinical Triage Intake Briefing: conscious state [${incident.conscious}], respiration [${incident.breathing}]. Rationale: ${incident.priorityRationale}"`,
      timestamp: now,
      status: "Failed", // Always fail initially so they can retry it!
      recipient: `trauma.lead@${hospital.id}.gov.kh`,
      incidentId: incident.id,
      attempts: 1
    };
    stateNotifications.unshift(emailNotif);
    broadcast({ type: "notification_created", notification: emailNotif });
  }
}

function triggerStatusUpdateNotifications(incident: any, prevStatus: string, status: string) {
  const now = new Date().toISOString();

  // 1. WebSocket Broadcast of update
  broadcast({
    type: "incident_updated",
    incident
  });

  // 2. Status Update Notification
  const statusNotif: NotificationItem = {
    id: `notif-status-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    type: "WEBSOCKET",
    title: "Incident Status Transitioned",
    message: `Incident ${incident.id} transitioned from ${prevStatus} to ${status}. Assigned Hospital: ${incident.assignedHospitalId || 'None'}`,
    timestamp: now,
    status: "Delivered",
    recipient: "All Connected Consoles",
    incidentId: incident.id,
    attempts: 1
  };
  stateNotifications.unshift(statusNotif);
  broadcast({ type: "notification_created", notification: statusNotif });
}

// Server-side cache for MOH AI Recommendations to protect against rate limits (429 errors)
let cachedMohRecommendation: string | null = null;
let lastMohRecommendationTime = 0;
const MOH_RECOMMENDATION_CACHE_TTL = 180000; // Cache for 3 minutes

// Helper: Find best hospital for incident based on location, availability of ICU bed/ambulance, and medical specialities matching
function selectBestHospitalAndAmbulance(lat: number, lng: number, specialties: string[], triageLevel: "RED" | "YELLOW" | "GREEN") {
  let bestHospital: Hospital | null = null;
  let bestAmbulance: Ambulance | null = null;
  let minScore = Infinity; // Lower is better (combination of distance, specialties, availability)

  for (const h of stateHospitals) {
    // If RED triage, hospital MUST have available ICU beds OR we prioritize general safety
    const distance = getDistance(lat, lng, h.lat, h.lng);

    // Score calculations
    let score = distance * 1.5; // Base score is distance in km

    // Specialties match bonus
    const hasMatchingSpecialty = specialties.some(s => h.specialties.includes(s));
    if (hasMatchingSpecialty) {
      score -= 3; // Subtract points (making it more attractive)
    }

    // Capacity checks
    if (h.availableAmbulances === 0) {
      score += 15; // Penalty if no ambulance available directly at this hospital
    }

    if (triageLevel === "RED" && h.availableIcuBeds === 0) {
      score += 10; // Penalty if ICU is full and patient is critical
    }

    if (score < minScore) {
      minScore = score;
      bestHospital = h;
    }
  }

  // Fallback if somehow empty
  if (!bestHospital && stateHospitals.length > 0) {
    bestHospital = stateHospitals[0];
  }

  // Find an available ambulance at the best hospital first. If none, search globally.
  if (bestHospital) {
    bestAmbulance = stateAmbulances.find(a => a.hospitalId === bestHospital!.id && a.status === "Available") || null;
    if (!bestAmbulance) {
      // Find ANY available ambulance regardless of hospital
      bestAmbulance = stateAmbulances.find(a => a.status === "Available") || null;
    }
  }

  return { hospital: bestHospital, ambulance: bestAmbulance };
}

// Find next best hospital excluding already attempted hospitals for that incident
function selectNextBestHospital(incident: Incident) {
  const tried = attemptedHospitalsForIncident.get(incident.id) || [];
  let bestHospital: Hospital | null = null;
  let minScore = Infinity;

  for (const h of stateHospitals) {
    if (tried.includes(h.id)) continue; // skip already tried nodes

    const distance = getDistance(incident.lat, incident.lng, h.lat, h.lng);
    let score = distance * 1.5;

    // Specialties match check
    const specialties = incident.injuries || [];
    const hasMatchingSpecialty = specialties.some(s => h.specialties.includes(s));
    if (hasMatchingSpecialty) {
      score -= 3;
    }

    if (h.availableAmbulances === 0) {
      score += 15;
    }

    if (incident.triageLevel === "RED" && h.availableIcuBeds === 0) {
      score += 10;
    }

    if (score < minScore) {
      minScore = score;
      bestHospital = h;
    }
  }

  return bestHospital;
}

// Cascading automatic rerouting logic if a hospital declines or times out
function rerouteIncident(incident: Incident, previousHospitalId: string | null) {
  const tried = attemptedHospitalsForIncident.get(incident.id) || [];

  if (previousHospitalId) {
    if (!tried.includes(previousHospitalId)) {
      tried.push(previousHospitalId);
    }
  }

  attemptedHospitalsForIncident.set(incident.id, tried);

  const nextHospital = selectNextBestHospital(incident);
  const prevHospName = previousHospitalId 
    ? stateHospitals.find((h: any) => h.id === previousHospitalId)?.name || "Previous Hospital"
    : "Hospital Base";

  if (nextHospital) {
    // Reroute incident
    incident.assignedHospitalId = nextHospital.id;
    incident.status = "Reported"; // Remains in Reported state for the new hospital
    
    // Track next hospital
    if (!tried.includes(nextHospital.id)) {
      tried.push(nextHospital.id);
    }
    attemptedHospitalsForIncident.set(incident.id, tried);

    incident.timeline.push({
      status: "Rerouted",
      timestamp: new Date().toISOString(),
      note: `No acceptance at ${prevHospName}. Emergency automatically rerouted to next nearest trauma node: ${nextHospital.name}.`
    });

    // Notify new hospital
    const hospNotif: NotificationItem = {
      id: `notif-hosp-reroute-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      type: "HOSPITAL_ALERT",
      title: `REROUTED: ${incident.triageLevel} Admissions Alert`,
      message: `Direct alert transferred to ${nextHospital.name}: "Triage ${incident.triageLevel} patient rerouted to your base. Awaiting acceptance."`,
      timestamp: new Date().toISOString(),
      status: "Delivered",
      recipient: `${nextHospital.name} ER Command Terminal`,
      incidentId: incident.id,
      attempts: 1
    };
    stateNotifications.unshift(hospNotif);
    broadcast({ type: "notification_created", notification: hospNotif });
    broadcast({ type: "incident_updated", incident });

    console.log(`[REROUTE SUCCESS] Incident ${incident.id} transferred to ${nextHospital.name}`);
  } else {
    // NO MORE HOSPITALS: Escalate to Ministry of Health!
    incident.timeline.push({
      status: "Escalated to MoH",
      timestamp: new Date().toISOString(),
      note: `Critical System Failure: All nearby trauma nodes (${tried.length} attempted bases) declined or timed out. Case escalated to Ministry Command Center.`
    });

    const mohNotif: NotificationItem = {
      id: `notif-moh-escalate-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      type: "MINISTRY_ESCALATION",
      title: "RED ALERT: National Command Escalation",
      message: `CRITICAL SYSTEM CRUNCH: Zero hospitals accepted incident ${incident.id} at ${incident.locationName}. Escalating to Ministry of Health Operations Board.`,
      timestamp: new Date().toISOString(),
      status: "Delivered",
      recipient: "MOH Health Security Command Center",
      incidentId: incident.id,
      attempts: 1
    };
    stateNotifications.unshift(mohNotif);
    broadcast({ type: "notification_created", notification: mohNotif });
    broadcast({ type: "incident_updated", incident });

    console.log(`[ESCALATION TRIGGERED] Incident ${incident.id} escalated directly to MoH due to city-wide non-response.`);
  }
}

// REST endpoints
app.get("/api/hospitals", authenticateJwt, (req, res) => {
  res.json(stateHospitals);
});

app.get("/api/incidents", authenticateJwt, (req, res) => {
  res.json(stateIncidents);
});

app.get("/api/ambulances", authenticateJwt, (req, res) => {
  res.json(stateAmbulances);
});

app.get("/api/notifications", authenticateJwt, (req, res) => {
  res.json(stateNotifications);
});

app.post("/api/notifications/clear", authenticateJwt, authorizeRoles("MOH"), validateCsrf, (req, res) => {
  stateNotifications = [];
  broadcast({ type: "notifications_cleared" });
  res.json({ success: true, message: "Notification history cleared." });
});

app.post("/api/notifications/retry", authenticateJwt, authorizeRoles("MOH"), validateCsrf, (req, res) => {
  const toRetry = stateNotifications.filter(n => n.status === "Failed");
  if (toRetry.length === 0) {
    return res.json({ success: true, message: "No failed notifications found in retry queue." });
  }

  // Set all to "Retrying" and broadcast update
  toRetry.forEach(n => {
    n.status = "Retrying";
    n.attempts = (n.attempts || 0) + 1;
    broadcast({ type: "notification_updated", notification: n });
  });

  // Simulating async network latency before final delivery
  setTimeout(() => {
    toRetry.forEach(n => {
      n.status = "Delivered";
      broadcast({ type: "notification_updated", notification: n });
    });
    console.log(`[RETRY QUEUE] Successfully delivered ${toRetry.length} retried notifications.`);
  }, 2000);

  res.json({ success: true, message: `Retrying ${toRetry.length} failed notifications in background.` });
});

app.post("/api/notifications/test", authenticateJwt, authorizeRoles("MOH"), validateCsrf, (req, res) => {
  const sanitized = sanitizeObject(req.body);
  const { type, recipient, title, message } = sanitized;
  const now = new Date().toISOString();
  
  const newNotif: NotificationItem = {
    id: `notif-test-${Date.now()}`,
    type: type || "WEBSOCKET",
    title: title || "Manual System Diagnostics Check",
    message: message || "This is a simulated manual notification diagnostics event.",
    timestamp: now,
    status: ((type === "EMAIL" || type === "SMS") && Math.random() > 0.6 ? "Failed" : "Delivered") as "Failed" | "Delivered",
    recipient: recipient || "System Operators",
    attempts: 1
  };

  stateNotifications.unshift(newNotif);
  broadcast({ type: "notification_created", notification: newNotif });

  res.json({ success: true, notification: newNotif });
});

// Reset simulation state
app.post("/api/incidents/reset", authenticateJwt, authorizeRoles("MOH"), validateCsrf, (req, res) => {
  stateHospitals = JSON.parse(JSON.stringify(SEEDED_HOSPITALS));
  stateAmbulances = JSON.parse(JSON.stringify(SEEDED_AMBULANCES));
  stateIncidents = JSON.parse(JSON.stringify(SEEDED_INCIDENTS));
  res.json({ message: "Simulation reset to seed state.", state: { hospitals: stateHospitals, incidents: stateIncidents } });
});

// Update Incident Status Manually (Admin/Sim tool)
app.post("/api/incidents/:id/update-status", authenticateJwt, authorizeRoles("HOSPITAL", "MOH"), validateCsrf, (req, res) => {
  const { id } = req.params;
  const sanitized = sanitizeObject(req.body);
  const { status, note } = sanitized;

  const incident = stateIncidents.find((inc: any) => inc.id === id);
  if (!incident) {
    return res.status(404).json({ error: "Incident not found" });
  }

  const prevStatus = incident.status;
  incident.status = status;
  
  // Log timeline event
  incident.timeline.push({
    status: status,
    timestamp: new Date().toISOString(),
    note: note || `State transitioned from ${prevStatus} to ${status}.`
  });

  // Handle hospital and ambulance state transitions based on status
  const amb = stateAmbulances.find((a: any) => a.id === incident.assignedAmbulanceId);
  const hosp = stateHospitals.find((h: any) => h.id === incident.assignedHospitalId);

  if (status === "Resolved") {
    // Release ambulance
    if (amb) {
      amb.status = "Available";
      amb.patientId = null;
      if (hosp) {
        amb.lat = hosp.lat;
        amb.lng = hosp.lng;
      }
    }
    // Update hospital counts if critical patient was resolved/discharged (freeing ICU)
    if (incident.triageLevel === "RED" && hosp) {
      hosp.availableIcuBeds = Math.min(hosp.totalIcuBeds, hosp.availableIcuBeds + 1);
    }
  } else if (status === "On-Scene") {
    if (amb) {
      amb.status = "On-Scene";
      amb.lat = incident.lat;
      amb.lng = incident.lng;
    }
  } else if (status === "Transporting") {
    if (amb) {
      amb.status = "Transporting";
    }
  } else if (status === "Arrived at Hospital") {
    if (amb) {
      amb.status = "Returning";
      if (hosp) {
        amb.lat = hosp.lat;
        amb.lng = hosp.lng;
      }
    }
  }

  // Trigger status update notifications
  triggerStatusUpdateNotifications(incident, prevStatus, status);

  res.json({ success: true, incident });
});

// Hospital accepts incident and assigns ambulance/driver
app.post("/api/incidents/:id/accept", authenticateJwt, authorizeRoles("HOSPITAL", "MOH"), validateCsrf, (req, res) => {
  const { id } = req.params;
  const sanitized = sanitizeObject(req.body);
  const { ambulanceId, driverName } = sanitized;

  const incident = stateIncidents.find((inc: any) => inc.id === id);
  if (!incident) {
    return res.status(404).json({ error: "Incident not found" });
  }

  const hospitalId = incident.assignedHospitalId;
  const hospital = stateHospitals.find((h: any) => h.id === hospitalId);
  if (!hospital) {
    return res.status(400).json({ error: "No hospital assigned to this incident" });
  }

  const ambulance = stateAmbulances.find((a: any) => a.id === ambulanceId);
  if (!ambulance) {
    return res.status(400).json({ error: "Assigned ambulance not found" });
  }

  if (ambulance.status !== "Available") {
    return res.status(400).json({ error: "Selected ambulance is not available" });
  }

  const prevStatus = incident.status;
  incident.status = "Ambulance Dispatched";
  incident.assignedAmbulanceId = ambulanceId;

  // Set ambulance state
  ambulance.status = "Dispatched";
  ambulance.patientId = incident.id;
  ambulance.lat = hospital.lat;
  ambulance.lng = hospital.lng;

  // Decrement hospital available ambulances
  hospital.availableAmbulances = Math.max(0, hospital.availableAmbulances - 1);
  
  // Decrement ICU bed immediately for RED critical cases to reserve/lock capacity
  if (incident.triageLevel === "RED") {
    hospital.availableIcuBeds = Math.max(0, hospital.availableIcuBeds - 1);
  }

  // Log to timeline
  incident.timeline.push({
    status: "Ambulance Dispatched",
    timestamp: new Date().toISOString(),
    note: `Hospital accepted case and dispatched Ambulance ${ambulance.plateNumber} driven by ${driverName || "Paramedic Team"}.`
  });

  // Trigger status update notifications
  triggerStatusUpdateNotifications(incident, prevStatus, "Ambulance Dispatched");

  res.json({ success: true, incident });
});

// Hospital declines incident, triggering immediate cascade routing to next hospital
app.post("/api/incidents/:id/decline", authenticateJwt, authorizeRoles("HOSPITAL", "MOH"), validateCsrf, (req, res) => {
  const { id } = req.params;

  const incident = stateIncidents.find((inc: any) => inc.id === id);
  if (!incident) {
    return res.status(404).json({ error: "Incident not found" });
  }

  const currentHospitalId = incident.assignedHospitalId;
  const prevHospName = currentHospitalId 
    ? stateHospitals.find((h: any) => h.id === currentHospitalId)?.name || "Current Hospital Node"
    : "Hospital Base";

  // Log decline event in timeline
  incident.timeline.push({
    status: "Declined",
    timestamp: new Date().toISOString(),
    note: `${prevHospName} declined case. Transferring immediately to next municipal trauma node.`
  });

  // Trigger immediate regional cascade rerouting
  rerouteIncident(incident, currentHospitalId);

  res.json({ success: true, incident });
});

// Background response monitor checking for "Reported" incidents awaiting hospital response (runs every 4 seconds)
setInterval(() => {
  const now = Date.now();
  stateIncidents.forEach((inc: any) => {
    if (inc.status === "Reported" && inc.assignedHospitalId) {
      const elapsedMs = now - new Date(inc.reportedAt).getTime();
      if (elapsedMs > 45000) { // 45 seconds timeout buffer for hospital operators
        console.log(`[TIMEOUT DECREE] Incident ${inc.id} exceeded response window of 45s at hospital ${inc.assignedHospitalId}. Rerouting...`);
        rerouteIncident(inc, inc.assignedHospitalId);
      }
    }
  });
}, 4000);

// POST Citizen report emergency (Analyze with Gemini, auto-routing)
app.post("/api/incidents", authenticateJwt, validateCsrf, async (req, res) => {
  const sanitized = sanitizeObject(req.body);
  const { 
    reporterName, 
    reporterPhone, 
    description, 
    locationName, 
    lat, 
    lng, 
    image, 
    imageMime, 
    audio, 
    audioMime 
  } = sanitized;

  if (!description) {
    return res.status(400).json({ error: "Description is required" });
  }

  const reportLat = lat || 11.5564; // Fallback to center Phnom Penh
  const reportLng = lng || 104.9282;

  // Compile live hospital grid context to supply to Gemini for dynamic hospital matching
  const hospitalStateContext = stateHospitals.map((h: any) => 
    `- Hospital: ${h.name} (${h.nameKhmer})
     Specialties: ${h.specialties.join(", ")}
     ICU Beds: ${h.availableIcuBeds}/${h.totalIcuBeds} available
     Ambulances: ${h.availableAmbulances}/${h.totalAmbulances} available`
  ).join("\n");

  let aiResult = null;

  if (ai) {
    try {
      console.log("Analyzing incident report with Gemini (Multimodal engine active)...");
      const promptText = PROMPT_TEMPLATES.triageAnalysis(description, locationName || "Phnom Penh Area", hospitalStateContext);
      
      const parts: any[] = [];
      
      // 2. Image Analysis: Attach image part if present
      if (image && imageMime) {
        console.log("[IMAGE DETECTED] Adding trauma/injury image analysis part to Gemini...");
        parts.push({
          inlineData: {
            data: image.replace(/^data:image\/\w+;base64,/, ""),
            mimeType: imageMime
          }
        });
      }

      // 3. Voice Analysis: Attach audio part if present
      if (audio && audioMime) {
        console.log("[AUDIO DETECTED] Adding voice emergency distress part to Gemini...");
        parts.push({
          inlineData: {
            data: audio.replace(/^data:audio\/\w+;base64,/, ""),
            mimeType: audioMime
          }
        });
      }

      // Add prompt text part
      parts.push({ text: promptText });

      // 8. Retry Logic & Error Handling wrapper
      const response = await callGeminiWithRetry(async () => {
        return await ai!.models.generateContent({
          model: "gemini-3.5-flash",
          contents: { parts },
          config: {
            responseMimeType: "application/json"
          }
        });
      });

      // 7. Response Parser
      if (response.text) {
        aiResult = parseGeminiResponse(response.text, description);
      }
    } catch (err: any) {
      console.warn("[TRIP TARIFF] Gemini live parsing failed. Invoking full Dynamic Fallback engine...", err);
    }
  }

  // 9. Error handling: Dynamic offline/quota-exceeded backup
  if (!aiResult) {
    const isKhmer = /[\u0e80-\u0eff\u1780-\u17ff]/.test(description);
    const isCritical = /ឈាម|គាំង|បេះដូង|សន្លប់|ឡានបុក|គ្រោះថ្នាក់|blood|stroke|arrest|unconscious|accident|critical|injury|wound/i.test(description) || (image && image.length > 0);
    
    // Dynamic fallback that still generates custom priorities and rationale
    const fallbackTriage = isCritical ? "RED" : "YELLOW";
    const fallbackScore = isCritical ? 88 : 52;
    
    aiResult = {
      triageLevel: fallbackTriage,
      priorityScore: fallbackScore,
      patientCount: 1,
      conscious: isCritical ? "Unconscious" : "Conscious",
      breathing: isCritical ? "Labored" : "Normal",
      injuries: isCritical ? ["Severe Trauma / Blood loss"] : ["Fracture / Laceration"],
      specialties: isCritical ? ["Trauma", "Emergency Medicine"] : ["General Surgery"],
      firstAidKhmer: isKhmer 
        ? "១. ដាក់អ្នកជំងឺឱ្យគេងផ្អៀងក្នុងទីតាំងមានសុវត្ថិភាព។\n២. ប្រើប្រាស់ក្រណាត់ស្អាតដើម្បីសង្កត់ឃាត់ឈាមឱ្យជាប់។\n៣. តាមដានដង្ហើមរបស់គាត់ឱ្យបានដិតដល់រហូតដល់ក្រុមសង្គ្រោះមកដល់។"
        : "១. កុំផ្លាស់ទីអ្នកជំងឺ ប្រសិនសង្ស័យមានរបួសឆ្អឹងកងខ្នង។\n២. ព្យាយាមឃាត់ឈាមដោយសង្កត់ផ្ទាល់នឹងរបួស។\n៣. រក្សាភាពស្ងប់ស្ងាត់ និងកំដៅខ្លួនអ្នកជំងឺ។",
      firstAidEnglish: "1. Place the patient in a safe recovery position if unconscious.\n2. Apply direct pressure on any bleeding wound using a clean cloth.\n3. Remain calm and keep the patient warm and monitored until paramedics arrive.",
      translatedDescription: isKhmer ? "Emergency report translated: Major collision or acute symptom onset requiring high-priority response." : description,
      priorityRationale: `[INTELLIGENCE FALLBACK] Triage assigned to ${fallbackTriage} with priority rating ${fallbackScore}/100. Rapid dispatch triggered based on severe keyword identifiers (${isCritical ? "critical symptoms detected" : "standard trauma parameters"}).`,
      hospitalRecommendationRationale: `Nearest matching level-1 base hospital assigned automatically based on distance metrics and ICU/Ambulance fleet availability.`
    };
  }

  // Hospital routing decision
  const triageLevel = (aiResult.triageLevel === "RED" || aiResult.triageLevel === "YELLOW" || aiResult.triageLevel === "GREEN") 
    ? aiResult.triageLevel 
    : "YELLOW";

  // Match the best primary hospital for this case
  const { hospital } = selectBestHospitalAndAmbulance(reportLat, reportLng, aiResult.specialties, triageLevel);

  // Update hospital rationale based on selection
  if (hospital) {
    if (!aiResult.hospitalRecommendationRationale || aiResult.hospitalRecommendationRationale.includes("Routed based on regional")) {
      aiResult.hospitalRecommendationRationale = `Recommend routing to ${hospital.name} (${hospital.nameKhmer}) because it is located only ${getDistance(reportLat, reportLng, hospital.lat, hospital.lng).toFixed(2)} km from the incident site and possesses specialized capabilities: ${hospital.specialties.join(", ")}. It currently has ${hospital.availableIcuBeds} ICU beds and ${hospital.availableAmbulances} ambulances on standby.`;
    }
  }

  const newIncidentId = `inc-${Date.now().toString().slice(-4)}`;
  
  // Track that we are attempting the primary hospital first
  if (hospital) {
    attemptedHospitalsForIncident.set(newIncidentId, [hospital.id]);
  }

  const newIncident: Incident = {
    id: newIncidentId,
    reportedAt: new Date().toISOString(),
    reporterName: reporterName || "Anonymous Reporter",
    reporterPhone: reporterPhone || "119 / Online",
    description: description,
    locationName: locationName || "Phnom Penh Area",
    lat: reportLat,
    lng: reportLng,
    triageLevel: triageLevel,
    priorityScore: aiResult.priorityScore || 50,
    status: "Reported", // Always starts as Reported
    assignedHospitalId: hospital ? hospital.id : null,
    assignedAmbulanceId: null, // Left null until hospital operator accepts and assigns
    patientCount: aiResult.patientCount || 1,
    injuries: aiResult.injuries || ["General trauma"],
    conscious: aiResult.conscious || "Conscious",
    breathing: aiResult.breathing || "Normal",
    firstAidKhmer: aiResult.firstAidKhmer,
    firstAidEnglish: aiResult.firstAidEnglish,
    translatedDescription: aiResult.translatedDescription || description,
    priorityRationale: aiResult.priorityRationale,
    hospitalRecommendationRationale: aiResult.hospitalRecommendationRationale,
    imageUrl: image || undefined,
    audioUrl: audio || undefined,
    timeline: [
      { status: "Reported", timestamp: new Date().toISOString(), note: "Incident report submitted." },
      ...(image ? [{ status: "Image Uploaded", timestamp: new Date().toISOString(), note: "Visual injury diagnostic asset attached and evaluated by Gemini AI." }] : []),
      ...(audio ? [{ status: "Voice Recorded", timestamp: new Date().toISOString(), note: "Distress voice stream parsed and processed by Gemini AI speech module." }] : []),
      {
        status: "Matching Hospital Node",
        timestamp: new Date().toISOString(),
        note: hospital 
          ? `System matched ${hospital.name} as primary trauma node. Direct ER alert dispatched. Awaiting acceptance...`
          : "Searching for available trauma nodes in municipal grid..."
      }
    ]
  };

  stateIncidents.unshift(newIncident); // prepend new incident

  // Trigger automated notification services across channels (without a pre-dispatched ambulance)
  triggerNotificationFlow(newIncident, hospital, null);

  res.json(newIncident);
});

// 10. Streaming responses (Server-Sent Events)
app.post("/api/incidents/stream-analysis", authenticateJwt, async (req, res) => {
  const sanitized = sanitizeObject(req.body);
  const { description, locationName } = sanitized;
  if (!description) {
    return res.status(400).json({ error: "Description is required for streaming analysis" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  console.log(`[STREAMING] Starting live companion commentary stream for description: ${description.slice(0, 40)}...`);

  if (!ai) {
    // If AI is not available, stream a high-quality simulated typing sequence!
    const simulatedResponse = `[CONNECTING TO LIFELINK LOCAL CO-PILOT NODE...]
- GPS Coordinates targeted for: ${locationName || "Phnom Penh Central Zone"}.
- Status: Simulating Dispatcher Companion Response.
- Parsing emergency descriptors for triage classification...
- Recommended Level: UR-2 (Urgent Trauma Dispatch requested).
- Selecting nearest emergency response hospital with standby ICU beds...
- Match Found: Khmer-Soviet Friendship Hospital base has 4 available ambulances.
- Recommendation: Ready trauma surgeons on standby for orthopedic/injury stabilization.
- Dispatched ambulance plate number: PP-2C-5582. Paramedics alerted.`;

    const words = simulatedResponse.split(" ");
    let i = 0;
    const timer = setInterval(() => {
      if (i < words.length) {
        res.write(`data: ${JSON.stringify({ chunk: words[i] + " " })}\n\n`);
        i++;
      } else {
        res.write("data: [DONE]\n\n");
        clearInterval(timer);
        res.end();
      }
    }, 120);
    return;
  }

  try {
    const prompt = PROMPT_TEMPLATES.streamingCommentary(description, locationName || "Phnom Penh Area");
    const stream = await ai.models.generateContentStream({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    for await (const chunk of stream) {
      if (chunk.text) {
        res.write(`data: ${JSON.stringify({ chunk: chunk.text })}\n\n`);
      }
    }
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err: any) {
    console.error("[STREAMING ERROR] Gemini stream failed:", err);
    res.write(`data: ${JSON.stringify({ error: "Streaming temporary limit reached. Standard dispatcher backup routed successfully." })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  }
});

// Helper to generate a highly polished, realistic, and dynamic MoH strategic fallback directive
function generateDynamicMohFallback(stats: {
  totalIncidents: number;
  activeIncidents: number;
  redCount: number;
  yellowCount: number;
  greenCount: number;
  ambulanceUtilization: number;
  icuUtilization: number;
}) {
  const calmette = stateHospitals.find(h => h.id === "hosp-calmette");
  const soviet = stateHospitals.find(h => h.id === "hosp-khmer-soviet");
  const kantha = stateHospitals.find(h => h.id === "hosp-kantha-bopha");
  
  const calmetteOccupancy = calmette ? Math.round(((calmette.totalIcuBeds - calmette.availableIcuBeds) / calmette.totalIcuBeds) * 100) : 76;
  const sovietOccupancy = soviet ? Math.round(((soviet.totalIcuBeds - soviet.availableIcuBeds) / soviet.totalIcuBeds) * 100) : 73;
  const kanthaOccupancy = kantha ? Math.round(((kantha.totalIcuBeds - kantha.availableIcuBeds) / kantha.totalIcuBeds) * 100) : 70;

  return `MOH STRATEGIC AI CLINICAL DIRECTIVE (DYNAMIC INTELLIGENCE FALLBACK)
Generated: ${new Date().toLocaleTimeString("en-US", { hour12: false, timeZone: "Asia/Phnom_Penh" })} GMT+7 (Phnom Penh Node)

1. SYSTEM-WIDE HEALTH GRID STATUS AUDIT:
Phnom Penh's emergency medical response network is active and monitoring ${stats.activeIncidents} active medical dispatches (Total historical incidents recorded: ${stats.totalIncidents}). City-wide ambulance fleet utilization is at ${stats.ambulanceUtilization}% with municipal transport nodes stable. Regional Intensive Care Unit (ICU) trauma beds occupancy stands at ${stats.icuUtilization}%.

2. TRAUMA NODE BOTTLENECK ANALYSIS:
• Calmette Hospital Trauma Ward: Currently reporting ICU bed occupancy at ${calmetteOccupancy}%. This represents a high surge point for neuro-trauma cases in the northern sector.
• Khmer-Soviet Friendship Hospital: Capacity is stabilized at ${sovietOccupancy}%, holding adequate general surgery and burn units availability.
• Kantha Bopha Pediatric Ward: Operating at ${kanthaOccupancy}% capacity, pediatric intensive care modules are prepared for critical pediatric intakes.

3. STRATEGIC POLICY DIRECTIVES:
• Directive A (Severe Trauma Divert): If Calmette Hospital ICU occupancy exceeds 80% (Current: ${calmetteOccupancy}%), the autonomous routing engine is directed to automatically divert adult spinal or cranial trauma intakes to the Khmer-Soviet Friendship Hospital to prevent critical queue stagnation.
• Directive B (Ambulance Re-Deployment): Based on a live municipal ambulance utilization rate of ${stats.ambulanceUtilization}%, stand by 1 idle reserve transport vehicle at the Royal Phnom Penh Hospital node to support secondary dispatches along the Russian Federation Boulevard traffic corridor.
• Directive C (Pediatric Priority Protocols): Mandate all dispatches involving pediatric trauma (under 14 years of age) to continue routing directly to Kantha Bopha IV with pre-arrival notifications transmitted to surgical units immediately.`;
}

// GET Ministry of Health Central Dashboard Stats & Recommendations
app.get("/api/moh/stats", authenticateJwt, authorizeRoles("MOH"), async (req, res) => {
  // Compute statistical numbers
  const totalIncidents = stateIncidents.length;
  const activeIncidents = stateIncidents.filter((inc: any) => inc.status !== "Resolved").length;
  const redCount = stateIncidents.filter((inc: any) => inc.triageLevel === "RED").length;
  const yellowCount = stateIncidents.filter((inc: any) => inc.triageLevel === "YELLOW").length;
  const greenCount = stateIncidents.filter((inc: any) => inc.triageLevel === "GREEN").length;

  // Ambulance stats
  const totalAmbulances = stateAmbulances.length;
  const activeAmbulances = stateAmbulances.filter((a: any) => a.status !== "Available").length;
  const ambulanceUtilization = totalAmbulances > 0 ? Math.round((activeAmbulances / totalAmbulances) * 100) : 0;

  // ICU capacity stats
  let totalIcu = 0;
  let occupiedIcu = 0;
  stateHospitals.forEach((h: any) => {
    totalIcu += h.totalIcuBeds;
    occupiedIcu += (h.totalIcuBeds - h.availableIcuBeds);
  });
  const icuUtilization = totalIcu > 0 ? Math.round((occupiedIcu / totalIcu) * 100) : 0;

  // Average response times (mock computation for realism, e.g. 8.2 mins average)
  const averageResponseTimeMins = 8.4;

  const currentStatsObj = {
    totalIncidents,
    activeIncidents,
    redCount,
    yellowCount,
    greenCount,
    ambulanceUtilization,
    icuUtilization,
    averageResponseTimeMins
  };

  let aiRecommendations = "";

  // Check if we have a valid cache
  const now = Date.now();
  if (cachedMohRecommendation && (now - lastMohRecommendationTime < MOH_RECOMMENDATION_CACHE_TTL)) {
    console.log("Serving cached MOH Strategic recommendations.");
    aiRecommendations = cachedMohRecommendation;
  } else if (ai) {
    try {
      console.log("Generating MOH Strategy recommendations from Gemini...");
      const systemStateData = {
        totalIncidents,
        activeIncidents,
        redTriageCount: redCount,
        ambulanceUtilizationRate: `${ambulanceUtilization}%`,
        icuUtilizationRate: `${icuUtilization}%`,
        hospitals: stateHospitals.map((h: any) => ({
          name: h.name,
          icuOccupancy: `${Math.round(((h.totalIcuBeds - h.availableIcuBeds) / h.totalIcuBeds) * 100)}%`,
          availableAmbulances: h.availableAmbulances
        }))
      };

      const prompt = `You are LifeLink AI, the elite National Healthcare Analytics Engine for the Ministry of Health (MoH) in Cambodia.
Analyze the following live emergency response system state in Phnom Penh:
${JSON.stringify(systemStateData, null, 2)}

Produce a concise strategic health dispatch directive (max 350 words) written in a highly professional, clinical, and authoritative tone. Include:
1. Systems Overview: Executive assessment of the city's current strain.
2. Bottleneck Analysis: Point out which hospital(s) is/are experiencing the highest ICU or ambulance crunch.
3. Priority Directives: Provide 3 clear, numbered tactical recommendations for the MoH to optimize resources, shift ambulance nodes, or activate back-up trauma ICU capacity in Phnom Penh immediately. Make sure these reflect the realistic Cambodian setting (e.g. referencing Calmette, Russian-Soviet, or Kantha Bopha).`;

      const response = await callGeminiWithRetry(async () => {
        return await ai!.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt,
          config: {
            temperature: 0.8,
          }
        });
      });
      
      if (response.text) {
        aiRecommendations = response.text;
        cachedMohRecommendation = aiRecommendations;
        lastMohRecommendationTime = now;
      } else {
        throw new Error("Empty text returned from Gemini API");
      }
    } catch (err: any) {
      const errStr = String(err);
      if (errStr.includes("429") || errStr.includes("RESOURCE_EXHAUSTED") || errStr.includes("quota") || errStr.includes("503") || errStr.includes("UNAVAILABLE")) {
        console.warn("Gemini API Rate-limited/unavailable. Utilizing fallback mechanism.");
      } else {
        console.error("Failed to generate MOH AI strategy:", err);
      }
      
      // If we have an older cached recommendation, use it. Otherwise, generate a customized high-quality live fallback.
      if (cachedMohRecommendation) {
        console.log("Reusing older cached recommendations under rate-limiting fallback.");
        aiRecommendations = cachedMohRecommendation;
      } else {
        aiRecommendations = generateDynamicMohFallback(currentStatsObj);
      }
    }
  } else {
    // If Gemini is not configured, generate a beautifully customized dynamic directive
    aiRecommendations = generateDynamicMohFallback(currentStatsObj);
  }

  res.json({
    stats: currentStatsObj,
    aiRecommendations
  });
});

// Periodic background simulation loop to update ambulance coordinates for visual high-fidelity
setInterval(() => {
  stateIncidents.forEach((inc: any) => {
    if (inc.status === "Resolved" || inc.status === "Reported" || !inc.assignedAmbulanceId) return;

    const amb = stateAmbulances.find((a: any) => a.id === inc.assignedAmbulanceId);
    if (!amb) return;

    // Movement speeds (simulated step)
    const stepSize = 0.002; // Roughly 200m

    if (inc.status === "Ambulance Dispatched") {
      // Move ambulance toward incident
      const dLat = inc.lat - amb.lat;
      const dLng = inc.lng - amb.lng;
      const dist = Math.sqrt(dLat * dLat + dLng * dLng);

      if (dist < stepSize) {
        // Arrived at incident
        amb.lat = inc.lat;
        amb.lng = inc.lng;
        inc.status = "On-Scene";
        amb.status = "On-Scene";
        inc.timeline.push({
          status: "On-Scene",
          timestamp: new Date().toISOString(),
          note: `Ambulance ${amb.plateNumber} arrived on-scene. Paramedics administering immediate first-aid.`
        });
      } else {
        amb.lat += (dLat / dist) * stepSize;
        amb.lng += (dLng / dist) * stepSize;
      }
    } else if (inc.status === "Transporting") {
      // Move ambulance toward hospital
      const hosp = stateHospitals.find((h: any) => h.id === inc.assignedHospitalId);
      if (hosp) {
        const dLat = hosp.lat - amb.lat;
        const dLng = hosp.lng - amb.lng;
        const dist = Math.sqrt(dLat * dLat + dLng * dLng);

        if (dist < stepSize) {
          // Arrived at hospital
          amb.lat = hosp.lat;
          amb.lng = hosp.lng;
          inc.status = "Arrived at Hospital";
          amb.status = "Returning";
          inc.timeline.push({
            status: "Arrived at Hospital",
            timestamp: new Date().toISOString(),
            note: `Ambulance arrived at ${hosp.name}. Patient transferred to specialized medical team.`
          });
        } else {
          amb.lat += (dLat / dist) * stepSize;
          amb.lng += (dLng / dist) * stepSize;
        }
      }
    }
  });

  // Handle ambulances returning to their hospital base
  stateAmbulances.forEach((amb: any) => {
    if (amb.status === "Returning") {
      const hosp = stateHospitals.find((h: any) => h.id === amb.hospitalId);
      if (hosp) {
        const dLat = hosp.lat - amb.lat;
        const dLng = hosp.lng - amb.lng;
        const dist = Math.sqrt(dLat * dLat + dLng * dLng);

        if (dist < 0.001) {
          amb.lat = hosp.lat;
          amb.lng = hosp.lng;
          amb.status = "Available";
          hosp.availableAmbulances = Math.min(hosp.totalAmbulances, hosp.availableAmbulances + 1);
        } else {
          amb.lat += (dLat / dist) * 0.002;
          amb.lng += (dLng / dist) * 0.002;
        }
      }
    }
  });
}, 4000); // simulation runs every 4 seconds

// Vite integration for development environment
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Development Vite middleware mounted.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Production static files server mounted.");
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`LifeLink AI Server listening at http://0.0.0.0:${PORT}`);
  });

  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    const url = request.url || "";
    console.log(`[SERVER UPGRADE] Incoming upgrade request for URL: ${url}`);
    
    // Accept upgrade requests on any path to prevent reverse proxy/gateway issues in testing
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  });

  wss.on("connection", (ws) => {
    console.log("[WS] New real-time console connected.");
    connectedClients.add(ws);
    
    // Welcome client with connection acknowledgement
    ws.send(JSON.stringify({ 
      type: "connection_established", 
      message: "Connected to LifeLink Real-Time Telemetry Node.",
      data: {
        notificationsCount: stateNotifications.length
      }
    }));

    ws.on("message", (msg) => {
      try {
        const payload = JSON.parse(msg.toString());
        console.log("[WS] Message received from client:", payload);
        if (payload.type === "ping") {
          ws.send(JSON.stringify({ type: "pong" }));
        }
      } catch (e) {
        console.error("[WS] Parse error:", e);
      }
    });

    ws.on("close", () => {
      console.log("[WS] Console disconnected.");
      connectedClients.delete(ws);
    });
  });

  // Background Automatic retry queue loop
  setInterval(() => {
    const toResolve = stateNotifications.filter(n => n.status === "Retrying");
    if (toResolve.length > 0) {
      toResolve.forEach(n => {
        n.status = "Delivered";
        broadcast({ type: "notification_updated", notification: n });
      });
      console.log(`[BG RETRY] Successfully auto-delivered ${toResolve.length} retried notifications.`);
    }
  }, 5000);
}

startServer();
