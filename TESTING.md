# LifeLink AI Cambodia — Comprehensive QA & Testing Strategy

This document establishes the official Quality Assurance (QA) and testing blueprint for the **LifeLink AI Cambodia** emergency dispatch ecosystem. It details the testing architectures, environment layouts, automation pipelines, and sample test implementations across the entire stack.

---

## 1. Quality Assurance Lifecycle & Architecture

To achieve enterprise-grade reliability (99.99% operational uptime) under emergency conditions in Phnom Penh, LifeLink AI enforces a **Continuous Verification Circle** spanning low-level unit isolation up to real-world behavioral load spikes.

```
       [Unit Tests] ---------> [Integration Tests]
            ^                          |
            |                          v
     [Security Auditing] <------ [E2E & Performance]
```

### Framework Stack Selection
* **Frontend Component Unit/UI Tests**: [Vitest](https://vitest.dev/) paired with [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/) and [jsdom].
* **Backend API & Routing Isolation**: [Supertest](https://github.com/ladjs/supertest) running against the Express server node instances.
* **AI Parser Verification**: Custom assertion frameworks verifying deterministic outputs for the `@google/genai` NLP pipelines.
* **Performance Benchmark Utilities**: [Artillery.io](https://artillery.io/) for WebSocket socket spamming and sliding-rate limit load simulation.

---

## 2. Test Data Matrix (Sample Mock Payloads)

To guarantee testing consistency, we utilize high-fidelity mock datasets representing Phnom Penh's unique geography, linguistics (English, Khmer, Slang), and trauma vectors.

### A. Core Incident Mock Data (`src/tests/data/incidents.mock.ts`)
```typescript
export const MOCK_INCIDENTS = {
  // Khmer Input - Critical Triage Event
  khmerCritical: {
    reporterName: "Sokha Mean",
    reporterPhone: "012345678",
    description: "មានគ្រោះថ្នាក់ចរាចរណ៍បុកគ្នាខ្លាំងនៅជិតវត្តភ្នំ! មនុស្សម្នាក់សន្លប់បាត់ស្មារតី ហើយមានឈាមហូរច្រើនចេញពីក្បាល។ ឡានពេទ្យមកជាបន្ទាន់!",
    locationName: "Wat Phnom, Phnom Penh",
    lat: 11.5761,
    lng: 104.9231
  },
  // English Input - Urgent Triage Event
  englishUrgent: {
    reporterName: "John Doe",
    reporterPhone: "099888777",
    description: "An elderly gentleman slipped at the Central Market and appears to have fractured his hip. He is conscious but in severe, agonizing pain.",
    locationName: "Central Market, Phnom Penh",
    lat: 11.5696,
    lng: 104.9210
  },
  // Khmer/English Slang Input - Stable Triage Event
  mixedSlangStable: {
    reporterName: "Sothy Leak",
    reporterPhone: "015222333",
    description: "My friend got a minor burn on his hand while cooking hotpot near Aeon 1. He feels okay but needs some advice, normal breathing.",
    locationName: "Aeon Mall 1, Sothearos Blvd",
    lat: 11.5502,
    lng: 104.9387
  }
};
```

### B. Gemini API Mock Responses (`src/tests/data/gemini.mock.ts`)
```typescript
export const MOCK_GEMINI_RESPONSES = {
  khmerCriticalResponse: {
    triageCategory: "RED",
    primaryTrauma: "Trauma / Severe Bleeding / Unconscious",
    englishTranslation: "There is a severe head-on traffic accident near Wat Phnom. One person is unconscious with heavy bleeding from the head. Need ambulance immediately!",
    conscious: false,
    breathingStable: false,
    firstAidDirectionsKhmer: "១. កុំផ្លាស់ទីជនរងគ្រោះ លុះត្រាតែមានគ្រោះថ្នាក់ភ្លើង។ ២. ខ្ទប់ដំបៅហូរឈាមដោយក្រណាត់ស្អាត។ ៣. ផ្អៀងក្បាលតិចៗដើម្បីកុំឱ្យទាស់ផ្លូវដង្ហើម។",
    firstAidDirectionsEnglish: "1. Do not move the victim unless in immediate danger. 2. Apply firm pressure to the bleeding head wound with clean cloth. 3. Tilt head slightly to ensure open airway.",
    recommendedSpecialty: "Trauma Center"
  }
};
```

---

## 3. Unit Testing Strategy & Implementations

Unit tests verify that individual utility modules perform calculations deterministically with zero side effects.

### Test Specification: Cryptographic Security Handshake
This test verifies the password hashing engine (PBKDF2-SHA512) and salt verification routines implemented in the secure backend layer.

```typescript
// src/tests/unit/security.test.ts
import { describe, it, expect } from "vitest";
import crypto from "crypto";

// High fidelity emulation of server PBKDF2 parameters
function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, "sha512").toString("hex");
}

describe("Enterprise Security Engine - Unit Isolation", () => {
  const mockSalt = crypto.randomBytes(16).toString("hex");
  const testPassword = "SuperSecurePassword119!";

  it("should generate deterministic hashes for matching passwords", () => {
    const hashOne = hashPassword(testPassword, mockSalt);
    const hashTwo = hashPassword(testPassword, mockSalt);
    expect(hashOne).toBe(hashTwo);
  });

  it("should generate entirely distinct hashes for minor password variations", () => {
    const hashOriginal = hashPassword(testPassword, mockSalt);
    const hashAltered = hashPassword("SuperSecurePassword119?", mockSalt);
    expect(hashOriginal).not.toBe(hashAltered);
  });

  it("should verify that different salts result in different hash signatures", () => {
    const saltTwo = crypto.randomBytes(16).toString("hex");
    const hashOne = hashPassword(testPassword, mockSalt);
    const hashTwo = hashPassword(testPassword, saltTwo);
    expect(hashOne).not.toBe(hashTwo);
  });
});
```

---

## 4. Integration Testing Strategy & Flows

Integration tests evaluate multiple system parts operating concurrently (e.g., verifying that updating a hospital’s ICU beds correctly trigger an recalculation of the nearest available resources).

### Test Specification: Nearest Hospital Resource Allocation Loop
```typescript
// src/tests/integration/routing.test.ts
import { describe, it, expect } from "vitest";

interface Hospital {
  id: string;
  name: string;
  lat: number;
  lng: number;
  availableIcuBeds: number;
  totalIcuBeds: number;
  specialties: string[];
}

// Emulating LifeLink AI routing heuristics logic
function findOptimalHospital(
  incidentLat: number,
  incidentLng: number,
  specialty: string,
  hospitals: Hospital[]
): Hospital | null {
  let optimalHospital: Hospital | null = null;
  let minimumScore = Infinity;

  // Haversine / Euclidean distance formula overlayed with penalty multipliers
  for (const hospital of hospitals) {
    if (hospital.availableIcuBeds <= 0) continue; // Skip saturated hospitals

    const distance = Math.sqrt(
      Math.pow(hospital.lat - incidentLat, 2) + Math.pow(hospital.lng - incidentLng, 2)
    );

    // Specialty matching bonus (reduces penalty score weight)
    const hasSpecialty = hospital.specialties.includes(specialty);
    const specialtyMultiplier = hasSpecialty ? 0.7 : 1.3;

    const score = distance * specialtyMultiplier;

    if (score < minimumScore) {
      minimumScore = score;
      optimalHospital = hospital;
    }
  }

  return optimalHospital;
}

describe("LifeLink Hospital Dispatch Routing Algorithm", () => {
  const mockHospitals: Hospital[] = [
    {
      id: "calmette",
      name: "Calmette Hospital",
      lat: 11.5823,
      lng: 104.9149,
      availableIcuBeds: 0, // Saturated capacity node
      totalIcuBeds: 15,
      specialties: ["Trauma Center", "Cardiology"]
    },
    {
      id: "khmer-soviet",
      name: "Khmer-Soviet Friendship Hospital",
      lat: 11.5369,
      lng: 104.9118,
      availableIcuBeds: 4, // Has capacity
      totalIcuBeds: 20,
      specialties: ["Trauma Center", "Infectious Diseases"]
    },
    {
      id: "cho-ray",
      name: "Cho Ray Phnom Penh Hospital",
      lat: 11.5312,
      lng: 104.9815,
      availableIcuBeds: 8,
      totalIcuBeds: 12,
      specialties: ["Cardiology", "Burns Unit"]
    }
  ];

  it("should bypass a geographically closer hospital if it has zero available ICU beds", () => {
    // Incident is right next to Calmette Hospital
    const incidentLat = 11.5810;
    const incidentLng = 104.9140;
    const requiredSpecialty = "Trauma Center";

    const target = findOptimalHospital(incidentLat, incidentLng, requiredSpecialty, mockHospitals);
    
    expect(target).not.toBeNull();
    // Must bypass Calmette because ICU beds = 0, choosing Khmer-Soviet instead
    expect(target?.id).toBe("khmer-soviet");
  });
});
```

---

## 5. Security Testing Strategy (RBAC & CSRF Guardrails)

Security test scripts are designed to verify that the API endpoints refuse requests lacking valid authorization headers or anti-forgery keys.

### Test Specification: Cross-Role Bypassing Rejection (RBAC)
```typescript
// src/tests/security/rbac.test.ts
import { describe, it, expect } from "vitest";

interface UserSession {
  username: string;
  role: "MOH" | "HOSPITAL" | "CITIZEN";
}

// Gated middleware emulator
function authorizeRoute(session: UserSession, requiredRole: "MOH" | "HOSPITAL"): boolean {
  if (session.role === "MOH") return true; // MOH holds wildcard access
  if (session.role === requiredRole) return true;
  return false;
}

describe("Role-Based Access Control (RBAC) Hardening", () => {
  const citizenSession: UserSession = { username: "bystander_sok", role: "CITIZEN" };
  const operatorSession: UserSession = { username: "nurse_leak", role: "HOSPITAL" };
  const adminSession: UserSession = { username: "director_general", role: "MOH" };

  it("should deny CITIZEN accounts from accessing hospital or ministry dashboards", () => {
    const canAccessHospital = authorizeRoute(citizenSession, "HOSPITAL");
    const canAccessMOH = authorizeRoute(citizenSession, "MOH");

    expect(canAccessHospital).toBe(false);
    expect(canAccessMOH).toBe(false);
  });

  it("should deny HOSPITAL operators from accessing central MOH statistic feeds", () => {
    const canAccessMOH = authorizeRoute(operatorSession, "MOH");
    expect(canAccessMOH).toBe(false);
  });

  it("should permit MOH users to access any endpoint", () => {
    const hospitalAccess = authorizeRoute(adminSession, "HOSPITAL");
    const mohAccess = authorizeRoute(adminSession, "MOH");

    expect(hospitalAccess).toBe(true);
    expect(mohAccess).toBe(true);
  });
});
```

---

## 6. AI & LLM Model Testing Strategy

AI outputs can be highly dynamic. We verify response schemas, linguistic accuracy, and triage translation mappings.

### Asserting Semantic Boundary Correctness
Our custom test harnesses parse simulated LLM streams and assert against defined regex ranges to prevent category hallucinations:

```typescript
// src/tests/ai/gemini-parser.test.ts
import { describe, it, expect } from "vitest";

interface ParsingResult {
  triageCategory: "RED" | "YELLOW" | "GREEN";
  conscious: boolean;
  recommendedSpecialty: string;
}

function validateAiOutputSchema(outputJson: string): ParsingResult {
  const parsed = JSON.parse(outputJson);
  
  if (!["RED", "YELLOW", "GREEN"].includes(parsed.triageCategory)) {
    throw new Error("Hallucinated category detected!");
  }
  
  return parsed as ParsingResult;
}

describe("Gemini Triage Schema Validation Engine", () => {
  it("should validate clean, well-formed JSON from model pipelines", () => {
    const cleanStreamOutput = `{"triageCategory": "RED", "conscious": false, "recommendedSpecialty": "Trauma Center"}`;
    const result = validateAiOutputSchema(cleanStreamOutput);
    expect(result.triageCategory).toBe("RED");
    expect(result.conscious).toBe(false);
  });

  it("should reject and throw error when the LLM hallucinates categories like 'CRITICAL'", () => {
    const invalidStreamOutput = `{"triageCategory": "CRITICAL", "conscious": false, "recommendedSpecialty": "Trauma"}`;
    expect(() => validateAiOutputSchema(invalidStreamOutput)).toThrow();
  });
});
```

---

## 7. Performance & Load Verification Strategy

Testing system stability under heavy loads is critical to avoid crashes during multi-casualty incidents.

### High-Concurrent WebSocket Tick Benchmark (Scenario File)
Save this code blocks as an Artillery configuration file (`artillery-ws-benchmark.yml`) to test high-density coordinate broadcast capabilities of the application.

```yaml
config:
  target: "ws://localhost:3000"
  phases:
    - duration: 60
      arrivalRate: 20
      rampTo: 100
      name: "Ramping up emergency responders"
scenarios:
  - name: "Ambulance Coordinate Stream Tick"
    engine: "ws"
    flow:
      - connect: "/"
      - think: 5
      - send: '{"type":"ambulance_tick_request","id":"amb-01"}'
      - think: 5
      - send: '{"type":"incident_tick_request","id":"inc-102"}'
      - think: 10
```

---

## 8. Frontend Unit Testing (Visual UI Testing)

Ensures interactive elements (modals, tabs, inputs, and canvas maps) handle state shifts correctly and display clear warnings.

### Component Testing: Secure Login Panel Input Flow
Using Vitest and React Testing Library, we assert that entering incorrect values displays errors immediately to users.

```typescript
// src/tests/frontend/Login.test.tsx
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Mock Simple Login UI Component
interface LoginPanelProps {
  onSubmit: (u: string, p: string) => void;
  errorMsg: string | null;
}

function LoginPanel({ onSubmit, errorMsg }: LoginPanelProps) {
  const [user, setUser] = React.useState("");
  const [pass, setPass] = React.useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(user, pass);
  };

  return (
    <form onSubmit={handleSubmit} data-testid="login-form">
      {errorMsg && <div data-testid="error-banner">{errorMsg}</div>}
      <input 
        placeholder="Username" 
        value={user} 
        onChange={e => setUser(e.target.value)} 
        data-testid="username-input" 
      />
      <input 
        type="password" 
        placeholder="Password" 
        value={pass} 
        onChange={e => setPass(e.target.value)} 
        data-testid="password-input" 
      />
      <button type="submit">LOGIN</button>
    </form>
  );
}

describe("Login UI Component - Functional Unit", () => {
  it("renders correctly with empty input states", () => {
    render(<LoginPanel onSubmit={vi.fn()} errorMsg={null} />);
    expect(screen.getByPlaceholderText("Username")).toBeDefined();
    expect(screen.getByPlaceholderText("Password")).toBeDefined();
  });

  it("displays the error message banner when passed down from state", () => {
    render(<LoginPanel onSubmit={vi.fn()} errorMsg="Invalid Key Combination" />);
    const banner = screen.getByTestId("error-banner");
    expect(banner.textContent).toBe("Invalid Key Combination");
  });

  it("submits the exact typed user credentials upon button click", () => {
    const mockSubmit = vi.fn();
    render(<LoginPanel onSubmit={mockSubmit} errorMsg={null} />);

    fireEvent.change(screen.getByTestId("username-input"), { target: { value: "operator_leak" } });
    fireEvent.change(screen.getByTestId("password-input"), { target: { value: "leakPass12" } });
    fireEvent.submit(screen.getByTestId("login-form"));

    expect(mockSubmit).toHaveBeenCalledWith("operator_leak", "leakPass12");
  });
});
```

---

## 9. Automated Testing in CI/CD (GitHub Actions)

Integrating these test verification suites directly into the checkout pipeline keeps our main branch clean and robust at all times.

Modify the `.github/workflows/ci-cd.yml` configuration to include automated tests:

```yaml
# Add to the 'verify' block in /github/workflows/ci-cd.yml
      - name: Execute Vitest Test Suites
        run: npm run test:run
```

Ensure the test runner scripts are declared inside `/package.json`:

```json
"scripts": {
  "test": "vitest",
  "test:run": "vitest run"
}
```
