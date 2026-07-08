# SOFTWARE REQUIREMENTS SPECIFICATION (SRS)
## Project: LifeLink AI — Cambodia Intelligent Emergency Medical Response Platform
### Document Reference: IEEE-Std-830-1998 Compliant Specification
### Version: 1.0.0
### Date: July 7, 2026

---

## 1. INTRODUCTION

### 1.1 Purpose
This Software Requirements Specification (SRS) document defines the comprehensive functional, non-functional, interface, and behavioral requirements for **LifeLink AI**, an intelligent, cloud-native medical dispatch and triaging network optimized for the municipality of Phnom Penh, Cambodia. This document is written in compliance with the IEEE Std 830-1998 guidelines and serves as the single source of truth for engineering teams, clinical stakeholders, and administrators at the Ministry of Health (MoH).

### 1.2 Scope
The LifeLink AI platform is a hybrid full-stack system designed to modernize the traditional "119" emergency line structure. The scope includes:
1. **Intelligent Citizen Reporting Front-End**: An accessible multilingual (Khmer, English, mixed-slang) web interface that allows bypass or auxiliary routing of emergencies with automatic translation, natural language diagnostic classification, and instant localized first-aid instruction delivery.
2. **Autonomous Clinical Dispatch & Hospital Routing Engine**: An algorithm combining spatial coordinates (Euclidean distance weight), trauma specialty matching, and real-time clinical workload capacity offsets (ICU beds, ambulance availability) to compute optimal destinations.
3. **Live Tactical Spatial Map**: A specialized vector mapping engine tracking dispatch vectors and simulating active medical transporter movements within Phnom Penh bounds.
4. **Hospital Command Node Interface**: Decentralized local hospital terminals to manage trauma bed capacities, inspect clinical intakes, and view diagnostic logs.
5. **Ministry of Health (MoH) Executive Dashboard**: High-level telemetry dashboards presenting national key performance indicators (KPIs) alongside strategic resource re-allocation guidelines dynamically generated via Gemini Large Language Models.

### 1.3 Definitions, Acronyms, and Abbreviations
* **MoH**: Ministry of Health, Kingdom of Cambodia.
* **SRS**: Software Requirements Specification.
* **IEEE**: Institute of Electrical and Electronics Engineers.
* **NLP**: Natural Language Processing.
* **ICU**: Intensive Care Unit.
* **Triage Level**: Standardized clinical emergency classification (RED for Critical, YELLOW for Urgent, GREEN for Non-Urgent).
* **PP-UTM**: Custom coordinate-to-screen projection mapping configured for Phnom Penh municipality latitude/longitude limits.
* **LLM**: Large Language Model (specifically Google Gemini-3.5-Flash via `@google/genai`).

### 1.4 References
1. *IEEE Std 830-1998, IEEE Recommended Practice for Software Requirements Specifications*.
2. *Cambodia Ministry of Health National Health Strategic Plan (HSP)*.
3. *World Health Organization (WHO) Emergency and Essential Surgical Care Guidelines*.

### 1.5 Overview
The remainder of this document is organized into five major sections. Section 2 describes the high-level perspective of the system, target user personas, and operational constraints. Section 3 covers the detailed system features and specific functional requirements. Section 4 defines the user, hardware, software, and communication interfaces. Section 5 details performance, safety, security, and quality attributes. Finally, Section 6 specifies formal business rules, use cases, acceptance criteria, and future roadmap phases.

---

## 2. OVERALL DESCRIPTION

### 2.1 Product Perspective
LifeLink AI operates as an autonomous, web-accessible SaaS platform integrating modern cloud-based AI reasoning with localized clinical realities. It replaces legacy, manual telephone triage backbones with a decentralized digital grid.

```
       +--------------------------------------------------------------+
       |                  LifeLink AI Cloud Platform                  |
       +--------------------------------------------------------------+
                                      |
         +----------------------------+----------------------------+
         |                            |                            |
+--------v-------+           +--------v-------+           +--------v-------+
|  119 Citizen   |           | Hospital ER    |           | MoH Command    |
| Reporter Portal|           | Node Terminals |           | Analytics Hub  |
+----------------+           +----------------+           +----------------+
```

### 2.2 Product Functions
The high-level primary functions of LifeLink AI include:
* **Citizen Multi-Dialect Reporting**: Processing of natural language reports with zero app installation needed.
* **Server-Side AI Clinical Extraction**: Autonomous parsing of injury types, breathing frequency, and consciousness indicators.
* **Strategic Triaging & Prioritization**: Scoring patients on a 0-100 priority scale.
* **Workload-Aware Hospital Allocation**: Live rerouting calculations which divert ambulances to alternate facilities if primary ER nodes hit high ICU occupancy rates.
* **Dynamic Fleet Relocation Simulation**: Providing an active canvas showcasing the physical transit of responder ambulances.
* **Executive Decision Advisory**: Summarizing systemic bottlenecks and issuing strategic directives for MoH administrative approval.

### 2.3 User Classes and Characteristics
1. **Cambodian Citizens / Reporters (Non-Technical to Semi-Technical)**: Expects extreme simplicity. Requires multilingual entry (native Khmer font or conversational English phonetics). Requires fast, clear, actionable output (first-aid guidelines with graphic indicators).
2. **Paramedics / Dispatch Responders (Technical, Clinical)**: Operates in high-stress, mobile environments. Demands high contrast UI, automatic telemetry updates, and streamlined action triggers (one-tap status progressions).
3. **Hospital ER Coordinators (Technical, Medical)**: Operates on desktop-sized monitors in ER wards. Requires fast access to upcoming arrival logs, triage details, and trauma bed manual override toggles.
4. **MoH Administrators & Strategists (Business/Executive)**: Focuses on macroeconomic and region-wide metrics. Requires automated performance summaries, resource audits, and national strategic guidance.

### 2.4 Operating Environment
* **Client Frontend**: Responsive Web App compatible with Google Chrome, Safari, and Mozilla Firefox (Mobile and Desktop layouts).
* **Backend Runtime**: Node.js environment deploying Express, powered by `@google/genai` API SDK.
* **Hosting Ingress**: Cloud Run server container routing external HTTPS traffic through isolated port `3000`.

### 2.5 Design and Implementation Constraints
1. **Port Restriction**: All ingress and egress traffic must bind strictly to **Port 3000** as mandated by reverse-proxy infrastructure.
2. **No Client-Side Secrets**: All API communication with Google Gemini or third-party gateways must take place via secure, server-side Express routing proxies (`/api/*`).
3. **No Canvas Third-Party Overheads**: Custom spatial representations must be computed natively using interactive Scalable Vector Graphics (SVG) structures to guarantee performance on legacy mobile chipsets.

### 2.6 Assumptions and Dependencies
* **Internet Connection**: Assumes baseline cellular data coverage (3G/4G/5G) is active across Phnom Penh municipality.
* **Geospatial Coordinates**: Assumes citizen GPS or manual location picking returns accurate latitude/longitude pairs.
* **Gemini Availability**: Relies on the availability of the server-side `@google/genai` endpoint. If unavailable, the system gracefully falls back to deterministic rule-based clinical scoring.

---

## 3. SYSTEM FEATURES & FUNCTIONAL REQUIREMENTS

### 3.1 Feature: Multilingual Citizen Emergency Reporter (119 Portal)
#### 3.1.1 Description and Priority
Enables a bypass channel for emergency declaration. Automatically translates, transcribes, and triages.
* **Priority**: High (Critical path for system ingress).

#### 3.1.2 Functional Requirements
* **FR-1.1**: The system shall process input descriptions entered in native Khmer script (e.g. "គ្រោះថ្នាក់ចរាចរណ៍"), conversational English, or phonetic "Karaoke Khmer" (e.g., "kruh tnak").
* **FR-1.2**: The system shall utilize the `gemini-3.5-flash` model server-side to extract clinical indicators:
  * Patient Conscious State (Yes/No/Partial)
  * Respiration/Breathing rate (Stable/Labored/Stopped)
  * Count of victims
  * Primary classified injury types (e.g., fracture, burn, hemorrhage)
* **FR-1.3**: The system shall render corresponding localized first-aid action checklists in both English and Khmer languages.
* **FR-1.4**: The system shall provide a visual location selection tool to capture latitudinal and longitudinal coordinates of the incident.

---

### 3.2 Feature: Dynamic Medical Dispatch & Specialty Routing Engine
#### 3.2.1 Description and Priority
Calculates optimal hospital routing based on physical distances and live clinical load constraints.
* **Priority**: High (Crucial for minimizing pre-hospital mortality).

#### 3.2.2 Functional Requirements
* **FR-2.1**: The system shall compute distance scores from the incident coordinate to all 5 active healthcare nodes:
  * *Calmette Hospital* (Trauma Surgery Specialty)
  * *Kantha Bopha Children's Hospital* (Pediatrics Specialty)
  * *Khmer-Soviet Friendship Hospital* (General Surgery & Burns Specialty)
  * *Royal Phnom Penh Hospital* (Cardiology & Trauma Specialty)
  * *Cho Ray Phnom Penh Hospital* (Intensive Care Specialty)
* **FR-2.2**: The system shall automatically select Kantha Bopha Hospital if the patient age is identified as < 15 years old.
* **FR-2.3**: If the highest-scoring hospital node has 0 available ICU beds, the routing algorithm shall apply an exponential capacity penalty, shifting the route to the next nearest capable node.

---

### 3.3 Feature: Real-Time Tactical Emergency Map
#### 3.3.1 Description and Priority
Visualizes active incidents and ambulance transit.
* **Priority**: Medium.

#### 3.3.2 Functional Requirements
* **FR-3.1**: The map shall project Phnom Penh's spatial bounds using custom SVG nodes representing the Tonle Sap, Mekong, and Bassac rivers for geographical orientation.
* **FR-3.2**: The system shall execute a server-side and client-side simulation loop driving active ambulances towards incident markers.
* **FR-3.3**: The map shall display distinctive pulsing indicators for critical RED cases.

---

### 3.4 Feature: Hospital Command Node & Capacity Controls
#### 3.4.1 Description and Priority
Allows local hospitals to view incoming patient pipelines and manually simulate capacity changes.
* **Priority**: Medium.

#### 3.4.2 Functional Requirements
* **FR-4.1**: ER coordinators shall have access to a localized capacity control panel to change ICU bed availability (-1/+1).
* **FR-4.2**: The system shall present a chronological timeline showing the status transitions of dispatches (Reported -> Dispatched -> On-Scene -> Transporting -> Arrived -> Resolved).

---

### 3.5 Feature: Ministry of Health (MoH) Strategic Executive Panel
#### 3.5.1 Description and Priority
Aggregates performance statistics and drafts official strategic directives.
* **Priority**: Medium.

#### 3.5.2 Functional Requirements
* **FR-5.1**: The system shall compute real-time operational metrics:
  * Total Active Cases
  * Average Response Time (minutes)
  * National ICU Bed Occupancy Rate (%)
  * Active Fleet Utilization Rate (%)
* **FR-5.2**: The system shall run an executive-level Gemini analysis which synthesizes active capacities and drafts formal, confidential policy memos signed by the autonomous advisor.

---

## 4. EXTERNAL INTERFACE REQUIREMENTS

### 4.1 User Interfaces
* **Grid and Bento Design**: Structured on Tailwind CSS utility layers. Use high-contrast color codes: RED (`#ef4444`) for high-severity cases, EMERALD (`#10b981`) for stable assets, and SLATE (`#0f172a`) for command containers.
* **Adaptive Sizing**: Fully responsive layouts using fluid grid layouts (`grid-cols-1 xl:grid-cols-12`).

### 4.2 Software Interfaces
* **AI Engine**: Connection to Gemini API via `@google/genai` utilizing the `process.env.GEMINI_API_KEY` credentials.
* **Mapping Components**: Standard scalable vector models mapped to Cartesian SVG containers representing UTM zones of Phnom Penh.

### 4.3 Communication Interfaces
* **API Ingress Protocol**: JSON-based RESTful routes.
  * `POST /api/incidents` - Citizen intake submission.
  * `GET /api/incidents` - Fetch dispatch queue.
  * `POST /api/incidents/:id/update-status` - Progress responder status.
  * `GET /api/moh/stats` - Pull system KPIs and advisor memos.

---

## 5. NON-FUNCTIONAL REQUIREMENTS

### 5.1 Performance Requirements
* **PR-1 (Triage Latency)**: Natural language triage extraction using Gemini shall return structured clinical parameters within 2500ms of network submission.
* **PR-2 (Map Polling)**: Spatial position coordinate updates shall refresh on client views every 4000ms.
* **PR-3 (Render Speed)**: SVG projection rendering time shall not exceed 150ms.

### 5.2 Safety and Security Requirements
* **SR-1 (Secret Exposure)**: The Gemini API Key must remain securely located on the server environment. It must never be exposed to browser developer consoles.
* **SR-2 (Data Privacy)**: Personal Identifier Fields (Reporter Phone Numbers) must be masked partially on public terminal queues (`012-***-**3`).

### 5.3 Software Quality Attributes
* **Availability**: Target system availability is 99.9% uptime.
* **Usability**: First-aid emergency indicators must be legible on low-resolution smartphones under bright sunlight conditions. Use high-contrast type scales.

---

## 6. BUSINESS RULES & SCORING MATRICES

### 6.1 Clinical Triage Weight Matrix
The autonomous dispatch engine computes clinical priority scores based on the following deterministic rules:

| Condition Parameter | Clinical Factor value | Priority Impact Weight |
|:---|:---|:---|
| **Consciousness** | Unconscious | +40 Points |
| **Respiration** | Stopped / Apnea | +40 Points |
| **Respiration** | Labored / Dyspnea | +20 Points |
| **Injury Count** | Severe Hemorrhage | +20 Points |
| **Injury Count** | Head Trauma / Fractures | +15 Points |

```
Final Priority Score (0-100) = SUM(Clinical Weights) + Math.min(20, patientCount * 5)
```

---

## 7. USE CASES

### 7.1 Use Case 1: Multi-Dialect Citizen Incident Report
* **Primary Actor**: Citizen Reporter
* **Preconditions**: Reporter is present at an accident scene in Phnom Penh and has a network connection.
* **Postconditions**: Case is prioritized, ambulance is dispatched, and first-aid guidelines are rendered.
* **Flow of Events**:
  1. Citizen accesses the 119 Portal.
  2. Citizen taps the interactive map to lock the physical accident coordinates.
  3. Citizen enters: *"មានគ្រោះថ្នាក់ម៉ូតូបុកគ្នា នៅជិតផ្សារថ្មី ម្នាក់សន្លប់ អត់ដកដង្ហើមទេ"* (Motorcycle collision near Central Market, one unconscious, not breathing).
  4. System routes report to the backend.
  5. Gemini AI translates the entry, recognizes "unconscious" and "not breathing", classifies the triage category as **RED (Critical)**, and generates a priority score of **95/100**.
  6. The system matches the incident to the closest Trauma ER node (Calmette Hospital), assigns a simulated ambulance, and displays step-by-step CPR guides.

---

### 7.2 Use Case 2: Autonomous Load-Balanced Rerouting
* **Primary Actor**: Hospital Commander
* **Preconditions**: A high-priority incident is reported near Calmette Hospital, but Calmette's ICU beds are fully occupied (0 free).
* **Postconditions**: The system automatically reroutes the case to the next optimal node.
* **Flow of Events**:
  1. Calmette Hospital's ICU bed occupancy is modified to 0.
  2. A new critical motorcycle accident is reported 1 km away from Calmette.
  3. The system routing engine identifies Calmette as the physically closest node but detects 0 ICU beds.
  4. The system applies the capacity penalty and automatically routes the dispatch and ambulance to *Royal Phnom Penh Hospital* (which has 4 available ICU beds) despite it being slightly further away.

---

## 8. ACCEPTANCE CRITERIA

* **AC-1**: The system must compile and pass all TypeScript linting checks (`npm run lint`).
* **AC-2**: The system must build successfully into optimized static bundles and server-side CommonJS formats (`npm run build`).
* **AC-3**: The citizen input form must function successfully with Khmer, English, or conversational slang.
* **AC-4**: Manual modification of ICU bed capacities must trigger immediate recalculation of routing logic during new incident creation.

---

## 9. FUTURE ROADMAP ENHANCEMENTS

1. **Integration with National SMS Gateway**: Enable push alerts to summon off-duty medical personnel based on geolocation coordinates.
2. **Computer Vision-based Wound Assessment**: Upgrade the citizen upload module to allow instant photo submissions of lacerations and burns, analyzed using Gemini Multi-Modal vision models to refine priority scoring.
3. **Advanced Telemetry IoT Hooks**: Read real-time diagnostic parameters from standard 4G/5G ambulance defibrillators.

---
*End of Specification Document.*
