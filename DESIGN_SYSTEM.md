# PREMIUM HEALTHCARE DESIGN SYSTEM & UI/UX SPECIFICATION
## Project: LifeLink AI — Cambodia Intelligent Emergency Medical Response Platform
### Role: Senior Lead UI/UX Designer
### Document Reference: LLA-DS-2026-V1
### Date: July 7, 2026

---

## 1. DESIGN PHILOSOPHY & CONCEPT

LifeLink AI's visual identity balances **urgent medical command** with **trustworthy, calming serenity**. Operating in high-stress, split-second triage environments in Phnom Penh, the design system focuses on readability, accessibility under bright sunlight, fast visual recognition, and precise interactive feedback.

The design leverages a **"Premium Slate-Clinical"** design model:
* **Tactical Command (Dark Slate)**: Anchors status headers, map overlays, and administrator panels, conveying stability, authority, and professional control.
* **Calming Healing (Emerald & Pure White)**: Powers citizen interactions, bystander checklists, and recovery states, reducing stress and encouraging immediate action.
* **Glassmorphism (Subtle Translucency)**: Applied selectively to panels on map canvases, creating clean layer depths without adding slow visual weight.

---

## 2. DESIGN SYSTEM SPECIFICATIONS

```
           +---------------------------------------------+
           |                COLOR PALETTE                |
           +---------------------------------------------+
           | Slate 950 (Canvas)     • Emerald 500 (Safe) |
           | Slate 800 (Borders)    • Amber 500 (Urgent) |
           | Slate 50 (Background)  • Red 500 (Critical) |
           +---------------------------------------------+
                                  |
                                  v
           +---------------------------------------------+
           |                 TYPOGRAPHY                  |
           +---------------------------------------------+
           | Display: Space Grotesk (Tech & Metrics)    |
           | Interface: Inter (Legible, Multilingual)    |
           | Khmer Script: Preah Vihear / Kantumruy      |
           | Telemetry: JetBrains Mono (Data Scales)     |
           +---------------------------------------------+
                                  |
                                  v
           +---------------------------------------------+
           |             SPACING SCALE (8px)             |
           +---------------------------------------------+
           | xs (4px)  • sm (8px)   • md (16px)          |
           | lg (24px) • xl (32px)  • 2xl (48px)         |
           +---------------------------------------------+
```

### 2.1 Color Palette

| Color Role | Hex Code | Tailwind Equivalent | Use Case Application |
|:---|:---|:---|:---|
| **Primary Canvas** | `#0f172a` | `bg-slate-900` | Navigation header, clinical controls |
| **Main Background** | `#f8fafc` | `bg-slate-50` | Default application body background |
| **High Contrast Card**| `#ffffff` | `bg-white` | Intake forms, timeline feeds, charts |
| **Critical Urgent** | `#ef4444` | `text-red-500` | RED Triage category, pulsing alarms, heart rate |
| **Moderate Urgent** | `#f59e0b` | `text-amber-500` | YELLOW Triage category, loading status, warnings |
| **Optimal / Safe** | `#10b981` | `text-emerald-500` | GREEN Triage, free beds, active ambulances |
| **Data Monospace** | `#64748b` | `text-slate-500` | Telemetry readouts, GPS coordinates |

### 2.2 Typography Pairings

We establish a strictly structured 4-font hierarchy designed for readability on both desktop monitors and high-density mobile screens:

1. **Space Grotesk** (Sans-Serif - Display/Headings):
   * *Purpose*: Main UI category titles, operational stats, and bold hero metrics.
   * *Styles*: Bold (700), Medium (500).
2. **Inter** (Sans-Serif - Body/Controls):
   * *Purpose*: Default interface text, forms, guidelines, and labels.
   * *Styles*: Semi-Bold (600), Medium (500), Regular (400).
3. **Kantumruy Pro / Preah Vihear** (Khmer Script - Multilingual Copy):
   * *Purpose*: Khmer script descriptions, translations, and localized guidelines.
   * *Styles*: Regular (400), Bold (700).
4. **JetBrains Mono** (Monospace - Technical Data):
   * *Purpose*: Telemetry feeds, coordinate points, timestamps, and API latencies.
   * *Styles*: Regular (400), Bold (700).

---

## 3. COMPONENT STATES & VISUAL PATTERNS

### 3.1 Buttons (Tailwind CSS Layer Declarations)
* **Primary Emergency Dispatch**:
  * *Classes*: `px-5 py-3 bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-red-200 uppercase tracking-wider font-mono cursor-pointer flex items-center justify-center gap-2`
* **Optimal Action Button (Advise Crew / Resolve)**:
  * *Classes*: `px-5 py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-emerald-100 uppercase tracking-wider font-mono cursor-pointer flex items-center justify-center gap-2`
* **Translucent Glass Option**:
  * *Classes*: `px-4 py-2 bg-white/10 backdrop-blur-md hover:bg-white/20 border border-white/15 text-white text-xs font-bold rounded-xl transition-all cursor-pointer`

### 3.2 Premium Cards (Glassmorphism & Border Rhythm)
* **Standard Container**:
  * *Classes*: `bg-white rounded-2xl p-6 shadow-sm border border-slate-100 transition-all duration-300 hover:shadow-md hover:border-slate-200/80`
* **AI Recommendation Hero Card**:
  * *Classes*: `bg-emerald-50/50 backdrop-blur-sm border-2 border-emerald-500/80 rounded-2xl p-6 shadow-sm relative overflow-hidden animate-fade-in`
* **Tactical Command Panel (Dark Mode Overlay)**:
  * *Classes*: `bg-slate-950/95 backdrop-blur-lg border border-slate-800 text-white p-6 rounded-2xl shadow-xl shadow-slate-900/40`

### 3.3 Loading Skeletons
To minimize perceived network lag during asynchronous server-side Gemini triage processes, the system renders shimmer-based placeholder cards:

```html
<div class="animate-pulse space-y-4">
  <div class="h-4 bg-slate-200 rounded w-1/3"></div>
  <div class="space-y-2">
    <div class="h-3 bg-slate-200 rounded w-full"></div>
    <div class="h-3 bg-slate-200 rounded w-5/6"></div>
  </div>
  <div class="grid grid-cols-2 gap-3 pt-2">
    <div class="h-10 bg-slate-200 rounded-xl"></div>
    <div class="h-10 bg-slate-200 rounded-xl"></div>
  </div>
</div>
```

### 3.4 Empty States
When the incident queue is fully cleared, the system provides a clean, calming illustration:
* *Visual Theme*: A clean, dashed outline container centering an emerald-check badge.
* *Wording*: "All previous emergencies resolved. Phnom Penh clinical nodes are fully synced."

---

## 4. MOBILE-FIRST RESPONSIVE WIREFRAMES

### 4.1 Viewport 1: Mobile Bystander Report Portal (375px x 812px)

```
+------------------------------------------+
|  [H] LifeLink AI  (•) live        [menu] |
+------------------------------------------+
|  MAP VIEW (TAP TO LOCK GPS PIN)          |
|  +------------------------------------+  |
|  |  [+] Pin Location Locked           |  |
|  |  Map bounds: Phnom Penh Center     |  |
|  +------------------------------------+  |
|                                          |
|  EMERGENCY INTAKE                        |
|  +------------------------------------+  |
|  | [1] Tell us what you see...        |  |
|  | (Khmer / English supported)        |  |
|  | "There's a bad crash here, one    |  |
|  |  driver is bleeding badly."        |  |
|  +------------------------------------+  |
|                                          |
|  [ !! TRANSMIT EMERGENCY ALERT !! ]      |
+------------------------------------------+
```

### 4.2 Viewport 2: Desktop Tactical Commander (1440px x 900px)

```
+-------------------------------------------------------------------------------------------------------------------------+
| [H] LifeLink AI   |  [ Reporter Tab ]  [ Hospital Nodes ]  [ MoH Central ]    Dr. Sokha Mean (Incident Commander)       |
+-------------------------------------------------------------------------------------------------------------------------+
|                                           |                                           |                                 |
|  ACTIVE QUEUE (LEFT BAR)                  |  INTERACTIVE CENTRAL SVG MAP              |  AI DIAGNOSTICS & ROUTES        |
|  +--------------------------------------+ |  +-------------------------------------+  |  +----------------------------+ |
|  | CRITICAL #A-204           2m ago     | |  |  Rivers: Tonle Sap, Mekong          |  |  | TRIAGE LEVEL: [ RED ]      | |
|  | Monivong Boulevard                   | |  |                                     |  |  | Priority Score: 95/100     | |
|  +--------------------------------------+ |  |  (•) Incident Marker                |  |  +----------------------------+ |
|  | HIGH #B-198               8m ago     | |  |                                     |  |  | MATCHED ROUTE:             | |
|  | Tuol Sleng Area                      | |  |  [===>] Simulated Ambulance         |  |  | Calmette Hospital (4m)     | |
|  +--------------------------------------+ |  +-------------------------------------+  |  +----------------------------+ |
|  | MINOR #C-042              15m ago    | |  COORDINATES BAR                        |  |  | CPR instructions rendered  | |
|  | Riverside Area                       | |  Lat: 11.5564° N | Lng: 104.9282° E     |  |  | in Khmer and English       | |
|  +--------------------------------------+ |                                           |  +----------------------------+ |
+-------------------------------------------------------------------------------------------------------------------------+
```

---

## 5. COMPONENT INTERACTIVE HIERARCHY

```
App (Orchestrator State Engine)
 ├── GlobalHeaderBar (Operational Status Indicators & Telemetry Counters)
 ├── NetworkTickerBar (Express API Live Routing Updates)
 ├── PhnomPenhMap (Geospatial Projection SVG Layout)
 │    ├── CoordinateOverlays (Rivers, District Boundary outlines)
 │    ├── ActiveIncidentMarker (Pulsing triage indicators)
 │    └── DrivingAmbulanceVectors (Simulated coordinates updating in real-time)
 ├── CitizenReporter (Multi-Dialect NLP Form Handler)
 │    ├── LocationLockInput (Geocoding validation)
 │    ├── FormInputText (Khmer text parser)
 │    └── DiagnosticResultPanel (Gemini Output, Recommended Facility, First Aid Instruction Card)
 ├── HospitalCommand (trauma ICU Bed Controllers)
 └── MoHDashboard (Executive Triage Matrix Graphs & AI Strategic Policy Memo)
```

---

## 6. ACCESSIBILITY (A11Y) INITIATIVES

To support users during severe medical emergencies, LifeLink AI conforms strictly to **WCAG 2.1 AA** guidelines:

1. **Color Contrast Protection**: Standard text colors are kept above a **4.5:1 ratio** against backgrounds (Slate 900 on Light Gray 50). Alert boxes with red or amber backgrounds feature complementary dark text headers (Red 900 text on Light Red 100 card).
2. **Accessible Form Labels**: Every input field includes clear, explicit descriptions (`id` labels matching input tags) for screen reader accessibility.
3. **No Sole-Color Information**: Critical stages never rely on color indicators alone. RED triage categories explicitly show the label text **RED (CRITICAL)** alongside a warning triangle icon.
4. **Touch Target Sizing**: All interactive selector targets on mobile layouts are kept above a **48px x 48px** threshold with comfortable tap padding.

---
*End of UI/UX Design System Specification.*
