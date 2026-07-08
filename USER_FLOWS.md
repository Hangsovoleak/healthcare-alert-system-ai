# USER FLOWS & INTERACTIVE JOURNEY MAPS
## Project: LifeLink AI — Cambodia Intelligent Emergency Medical Response Platform
### Role: Lead UX Architect & Interaction Designer
### Document Reference: LLA-UF-2026-V1
### Date: July 7, 2026

---

## 1. USER FLOWS OVERVIEW

This document outlines the detailed transaction, operation, and decision-making flows for all five core actors within the **LifeLink AI** ecosystem:
1. **Citizen Reporter**: Generating emergency reports via 119 bypass using multi-dialect NLP triage.
2. **Hospital ER Commander**: Managing capacity, intakes, and manual overrides.
3. **Ambulance Crew (Simulated)**: Receiving dispatch vectors, updating telemetry, and transiting.
4. **Ministry of Health (MoH) Administrator**: Auditing systemic bottlenecks and acting on executive-level strategic policy recommendations.
5. **System Administrator (Admin)**: Managing nodes, parameters, configurations, and fail-safe controls.

---

## 2. CITIZEN REPORTER FLOW (119 MULTI-DIALECT BYPASS)

The citizen portal prioritizes immediate, frictionless access. No application installation is required, and reports can be issued in Khmer, English, or conversational mixed slang.

```mermaid
flowchart TD
    Start([Citizen Bystander Witnesses Incident]) --> AccessPortal[Accesses LifeLink AI 119 Portal]
    AccessPortal --> PinLocation[1. Interactive Map: Lock GPS Pin of Incident]
    PinLocation --> SelectCoordinates{Coordinates Locked?}
    SelectCoordinates -->|No| PromptManualPick[Select nearest landmark/district landmark]
    SelectCoordinates -->|Yes| FormEntry[2. Enter Emergency Details in Text or Slang]
    
    FormEntry --> InputSample[e.g., 'គ្រោះថ្នាក់ម៉ូតូសន្លប់ម្នាក់' / 'Bad car crash Monivong']
    InputSample --> TransmitAlert[Tap Transmit Emergency Alert]
    
    TransmitAlert --> LoadingState[Show Shimmer-based Loading Skeletons]
    LoadingState --> ServerProcess[Server-Side Processing Proxy /api/incidents]
    
    ServerProcess --> API_Call{Gemini AI Call}
    API_Call -->|Success| ProcessTriage[Evaluate Symptoms, Consciousness, Respiration]
    API_Call -->|Timeout/Error| FallbackHeuristic[Local Regex Keyword Fallback Engine]
    
    ProcessTriage --> AssignTriage[Categorize RED / YELLOW / GREEN & score 0-100]
    FallbackHeuristic --> AssignTriage
    
    AssignTriage --> ComputeRouting[Select Optimal Hospital & Ambulance based on Load/ETA]
    ComputeRouting --> RenderResults[3. Render Triage Cockpit on Citizen Screen]
    
    RenderResults --> DisplayInstructions[Display localized first-aid checklist in Khmer/English]
    RenderResults --> DisplayMatchedHospital[Display assigned hospital, ambulance telemetry & ETA]
    
    DisplayInstructions --> BystanderAction[Perform immediate first aid following guides]
    BystanderAction --> Resolution([Ambulance arrives on scene])
```

---

## 3. HOSPITAL ER COMMANDER FLOW

Hospital ER coordinators operate on tablet or desktop screens inside the emergency department, monitoring incoming casualty workloads and managing trauma bed availability.

```mermaid
flowchart TD
    Start([ER Commander logs into Hospital Terminal]) --> ViewDashboard[Accesses Live Intake Queue & Capacity Controls]
    ViewDashboard --> MonitorTelemetry[Monitor real-time system metrics: Total incoming cases, fleet occupancy]
    
    ViewDashboard --> CheckIntakes[Review incoming live patient pipelines classified by AI]
    CheckIntakes --> ViewCaseDetail[Open detailed patient triage card]
    ViewCaseDetail --> ReadDetails[Review raw description, English translation, and AI rationale]
    
    ViewDashboard --> BedCapacityManager[Update live Intensive Care Unit bed metrics]
    BedCapacityManager --> IncrementBeds[Increase available trauma beds count +1]
    BedCapacityManager --> DecrementBeds[Decrease available trauma beds count -1]
    
    DecrementBeds --> SaturatedState{Trauma Beds == 0?}
    SaturatedState -->|Yes| ApplyPenalty[Routing engine automatically triggers capacity penalty]
    ApplyPenalty --> DivertIncoming[Future critical ambulances automatically rerouted to alternative nodes]
    SaturatedState -->|No| MaintainDefault[Maintain normal priority spatial routing]
    
    ViewDashboard --> DispatchTimeline[Trace chronological dispatch status indicators]
    DispatchTimeline --> AcknowledgeIntake[Acknowledge arrival and mark case as RESOLVED]
```

---

## 4. SIMULATED AMBULANCE FLEET WORKFLOW

Ambulance dispatch and transit coordinates are simulated dynamically to model actual traffic, geography, and response telemetry within Phnom Penh.

```mermaid
flowchart TD
    Start([Ambulance designated as 'AVAILABLE' at hospital node]) --> TriggerIncident[New incident submitted & routed to hospital node]
    TriggerIncident --> DispatchOrder[State: DISPATCHED]
    DispatchOrder --> SoundAlarm[Dashboard sounds audio-visual pulse alarm]
    
    DispatchOrder --> LockRoute[Compute coordinates & trajectory vector to incident]
    LockRoute --> ProgressEnRoute[State: EN_ROUTE]
    
    ProgressEnRoute --> SimulateTransit[Simulation engine drives vehicle marker on map canvas]
    SimulateTransit --> LiveTelemetry[Transmit live diagnostic telemetry to server every 4s]
    LiveTelemetry --> HeartPulse[Oxygen saturation, simulated patient vitals]
    
    SimulateTransit --> ArriveScene[Ambulance reaches coordinates: ON_SCENE]
    ArriveScene --> SecurePatient[Secure and stabilize casualty following AI guidelines]
    SecurePatient --> Transporting[State: TRANSPORTING patient back to matched hospital]
    
    Transporting --> ArriveHospital[Ambulance reaches ER: ARRIVED]
    ArriveHospital --> TransferCasualty[Casualty transferred to surgical team]
    ArriveHospital --> CompleteCase[Mark dispatch status as RESOLVED]
    
    CompleteCase --> ResetAmbulance[Ambulance state resets to AVAILABLE at base station]
```

---

## 5. MINISTRY OF HEALTH (MoH) ADMINISTRATOR FLOW

MoH officials monitor regional performance indicators to optimize healthcare infrastructure investments and issue city-wide strategic directives.

```mermaid
flowchart TD
    Start([MoH Official logs in]) --> AccessExecutivePanel[Opens MoH Central Control Panel]
    AccessExecutivePanel --> AuditingMetrics[Audit real-time regional performance indicators]
    
    AuditingMetrics --> ReadStats[Inspect metrics: Avg Response Time, National ICU Bed occupancy, Active Fleet utilization]
    ReadStats --> TriggerAdvisory[Request Executive Strategic Analysis]
    
    TriggerAdvisory --> LLM_Prompt[Server loads live capacities & triggers Gemini Strategic advisory prompt]
    LLM_Prompt --> GenerateAdvisory[Gemini drafts formal, confidential administrative directive]
    
    GenerateAdvisory --> RenderAdvisory[Display Strategic Policy Directive on Executive Panel]
    RenderAdvisory --> ReviewActions{Review Actionable Policy Choices}
    
    ReviewActions --> Action1[1. Transfer idle ambulances to saturated Monivong district nodes]
    ReviewActions --> Action2[2. Activate emergency trauma team backups at Calmette Hospital]
    ReviewActions --> Action3[3. Reserve critical ICU bed buffers for severe regional trauma alerts]
    
    ReviewActions --> ApproveActions[Approve & distribute directive to hospital command terminals]
```

---

## 6. SYSTEM ADMINISTRATOR (ADMIN) WORKFLOW

System administrators configure mathematical parameters, manage database schemas, audit operations, and manage API keys.

```mermaid
flowchart TD
    Start([System Administrator accesses backend CLI/Portal]) --> AdminAuthentication[Authenticate with Admin Credentials]
    AdminAuthentication --> AccessControl[Access System Configuration & Auditing Subsystems]
    
    AccessControl --> SchemaManager[Database Schema Management]
    SchemaManager --> ModifySchema[Edit database schema variables /src/db/schema.ts]
    ModifySchema --> MigrateDatabase[Execute Schema Migrations & rebuild database maps]
    
    AccessControl --> RoutingConfig[Routing Algorithm Configuration]
    RoutingConfig --> ToggleAutoDispatch[Toggle Auto-Dispatching ON/OFF]
    RoutingConfig --> AdjustWeights[Modify routing score mathematical weights: Distance factor vs Bed occupancy weight]
    
    AccessControl --> AuditEngine[Audit Operations Log]
    AuditEngine --> ScanLogs[Inspect security audit logs: Login attempts, API latency, database synchronization stats]
    ScanLogs --> ValidateIntegrity[Confirm PostgreSQL synchronization consistency]
    
    AccessControl --> APIManager[API Credentials & Environment Setup]
    APIManager --> RotateKeys[Rotate Gemini API Key or credentials in .env]
    RotateKeys --> RestartServer[Execute Server Restart to apply updates safely]
```

---
*End of User Flow Maps Specification.*
