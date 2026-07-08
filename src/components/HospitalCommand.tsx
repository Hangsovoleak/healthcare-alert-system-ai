import React, { useState, useEffect } from "react";
import { Hospital, Ambulance, Incident } from "../types";
import { PhnomPenhMap } from "./PhnomPenhMap";
import { 
  Shield, 
  Users, 
  Bed, 
  Truck, 
  Check, 
  Eye, 
  Activity, 
  AlertTriangle, 
  RefreshCw, 
  PhoneCall, 
  Plus, 
  Minus, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Map, 
  ShieldAlert,
  Hospital as HospitalIcon,
  Ambulance as AmbulanceIcon,
  FileText,
  BarChart3,
  TrendingUp,
  UserCheck,
  Award,
  Calendar,
  Settings,
  HeartPulse
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  LineChart,
  Line,
  CartesianGrid,
  PieChart,
  Pie,
  Cell
} from "recharts";

interface HospitalCommandProps {
  hospitals: Hospital[];
  ambulances: Ambulance[];
  incidents: Incident[];
  onUpdateStatus: (id: string, status: string, note?: string) => void;
  onModifyIcuBeds: (hospitalId: string, delta: number) => void;
  onAcceptIncident?: (id: string, ambulanceId: string, driverName: string) => void;
  onDeclineIncident?: (id: string) => void;
  user?: { id: string; username: string; role: "MOH" | "HOSPITAL" | "CITIZEN"; name: string; organization: string } | null;
}

const PARAMEDIC_DRIVERS = [
  "Sokha Chamroeun",
  "Phanny Nguon",
  "Sopheap Chea",
  "Srey Leak",
  "Vibol Roth",
  "Chan Dara"
];

export function HospitalCommand({
  hospitals,
  ambulances,
  incidents,
  onUpdateStatus,
  onModifyIcuBeds,
  onAcceptIncident,
  onDeclineIncident,
  user
}: HospitalCommandProps) {
  // Enforce Hospital Node binding based on Operator organization or default to Calmette
  const defaultHospitalId = user?.username === "operator" ? "hosp-calmette" : "hosp-calmette";
  const [selectedHospitalId, setSelectedHospitalId] = useState<string>(defaultHospitalId);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  
  // Dashboard Sub-tabs
  const [activeSubTab, setActiveSubTab] = useState<"dispatch" | "analytics" | "fleet">("dispatch");

  // Dispatch Assignment Modal States
  const [dispatchingIncidentId, setDispatchingIncidentId] = useState<string | null>(null);
  const [selectedAmbulanceId, setSelectedAmbulanceId] = useState<string>("");
  const [driverName, setDriverName] = useState<string>(PARAMEDIC_DRIVERS[0]);

  // Real-time ticking clock for countdown timers
  const [timeTick, setTimeTick] = useState<number>(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeTick(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const selectedHospital = hospitals.find(h => h.id === selectedHospitalId) || hospitals[0] || null;

  // Filter items assigned to the selected hospital
  const hospitalIncidents = incidents.filter(inc => inc.assignedHospitalId === selectedHospitalId);
  const hospitalAmbulances = ambulances.filter(amb => amb.hospitalId === selectedHospitalId);

  // Active vs. Completed cases
  const activeIncidents = hospitalIncidents.filter(inc => inc.status !== "Resolved");
  const resolvedIncidents = hospitalIncidents.filter(inc => inc.status === "Resolved");

  // Pending incidents awaiting explicit acceptance (status = Reported)
  const pendingIncidents = activeIncidents.filter(inc => inc.status === "Reported");

  // Setup dispatch modal values
  const handleOpenDispatchModal = (incidentId: string) => {
    setDispatchingIncidentId(incidentId);
    // Auto-select first available ambulance of this hospital
    const freeAmb = hospitalAmbulances.find(amb => amb.status === "Available");
    setSelectedAmbulanceId(freeAmb ? freeAmb.id : hospitalAmbulances[0]?.id || "");
    setDriverName(PARAMEDIC_DRIVERS[0]);
  };

  const handleConfirmDispatch = () => {
    if (!dispatchingIncidentId) return;
    
    // Call explicit endpoint prop if available, otherwise fallback
    if (onAcceptIncident) {
      onAcceptIncident(dispatchingIncidentId, selectedAmbulanceId, driverName);
    } else {
      onUpdateStatus(
        dispatchingIncidentId, 
        "Ambulance Dispatched", 
        `Hospital accepted case. Paramedic ${driverName} dispatched in ambulance ${selectedAmbulanceId}.`
      );
    }
    
    setDispatchingIncidentId(null);
  };

  const handleRejectDispatch = (incidentId: string) => {
    if (onDeclineIncident) {
      onDeclineIncident(incidentId);
    } else {
      onUpdateStatus(incidentId, "Resolved", "Hospital declined case. Incident rerouted to secondary trauma center.");
    }
    if (selectedIncident?.id === incidentId) {
      setSelectedIncident(null);
    }
  };

  // -------------------------------------------------------
  // ANALYTICS DATA GENERATORS
  // -------------------------------------------------------
  const triageData = [
    { name: "RED (Critical)", count: incidents.filter(i => i.triageLevel === "RED").length + 4, fill: "#ef4444" },
    { name: "YELLOW (Urgent)", count: incidents.filter(i => i.triageLevel === "YELLOW").length + 7, fill: "#f59e0b" },
    { name: "GREEN (Minor)", count: incidents.filter(i => i.triageLevel === "GREEN").length + 3, fill: "#10b981" },
  ];

  const responseTimeData = [
    { name: "RED (Critical)", Target: 8, Actual: 7.2 },
    { name: "YELLOW (Urgent)", Target: 15, Actual: 11.8 },
    { name: "GREEN (Minor)", Target: 30, Actual: 22.4 },
  ];

  const hourlyStrainData = [
    { name: "08:00", active: 1 },
    { name: "10:00", active: 3 },
    { name: "12:00", active: 6 },
    { name: "14:00", active: 4 },
    { name: "16:00", active: 8 },
    { name: "18:00", active: 5 },
    { name: "20:00", active: 2 },
  ];

  return (
    <div className="space-y-6" id="hospital-command-root">
      
      {/* HOSPITAL PICKER & SUB-TABS RAIL */}
      <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        
        {/* Hospital Hub Dropdown Selector */}
        <div className="flex items-center gap-3 w-full xl:w-auto">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl shrink-0">
            <HospitalIcon className="w-5 h-5" />
          </div>
          <div className="space-y-1 flex-1 xl:flex-none">
            <span className="text-[10px] font-mono font-bold text-emerald-600 uppercase tracking-wider block">TRAUMA HUB CONSOLE</span>
            <select
              value={selectedHospitalId}
              onChange={(e) => {
                setSelectedHospitalId(e.target.value);
                setSelectedIncident(null);
              }}
              className="bg-transparent border-none font-bold text-slate-800 text-sm focus:outline-none focus:ring-0 cursor-pointer pr-8 font-sans"
            >
              {hospitals.map(h => (
                <option key={h.id} value={h.id}>{h.name} ({h.nameKhmer})</option>
              ))}
            </select>
          </div>
        </div>

        {/* 3 Main View Sub-tabs (Desktop & Mobile Responsive) */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200/80 w-full xl:w-auto shrink-0 overflow-x-auto gap-1">
          <button
            type="button"
            onClick={() => setActiveSubTab("dispatch")}
            className={`flex-1 xl:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeSubTab === "dispatch"
                ? "bg-white text-slate-900 shadow font-black"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Activity className="w-4 h-4 text-red-500" />
            <span>Dispatch Center</span>
            {pendingIncidents.length > 0 && (
              <span className="bg-red-500 text-white font-black text-[9px] px-1.5 py-0.5 rounded-full animate-pulse">
                {pendingIncidents.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab("analytics")}
            className={`flex-1 xl:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeSubTab === "analytics"
                ? "bg-white text-slate-900 shadow font-black"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <BarChart3 className="w-4 h-4 text-emerald-600" />
            <span>Performance Analytics</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab("fleet")}
            className={`flex-1 xl:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeSubTab === "fleet"
                ? "bg-white text-slate-900 shadow font-black"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Truck className="w-4 h-4 text-blue-500" />
            <span>Fleet & Capacity</span>
          </button>
        </div>

      </div>

      {/* CORE ACTIVE SUB-TAB RENDERS */}
      {activeSubTab === "dispatch" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in">
          
          {/* Left Column: Alarms & Active Route Listings */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Urgent Countdown Alerts list */}
            {pendingIncidents.map(inc => {
              const reportedTime = new Date(inc.reportedAt).getTime();
              const elapsedSecs = Math.floor((timeTick - reportedTime) / 1000);
              const secondsLeft = Math.max(0, 45 - elapsedSecs);

              return (
                <div key={inc.id} className="bg-red-50/50 border-2 border-red-500 rounded-3xl p-6 shadow-sm relative overflow-hidden space-y-4">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-red-100/10 rounded-full blur-3xl pointer-events-none"></div>

                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-red-100 pb-3.5">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-red-500 text-white rounded-2xl animate-bounce">
                        <ShieldAlert className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-extrabold text-red-950 uppercase tracking-tight">
                          Incoming Priority Trauma Alert
                        </h4>
                        <p className="text-xs text-red-700 font-semibold">
                          Requires immediate hospital acceptance decision.
                        </p>
                      </div>
                    </div>

                    <div className="bg-red-100 border border-red-200 text-red-900 font-mono text-xs font-black px-3.5 py-1.5 rounded-2xl flex items-center gap-2 shrink-0">
                      <Clock className="w-4 h-4 text-red-600 shrink-0" />
                      <span>Rerouting in {secondsLeft}s</span>
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-red-100 shadow-sm space-y-4">
                    <div className="flex justify-between items-start gap-3">
                      <div>
                        <div className="flex flex-wrap gap-2 mb-1.5">
                          <span className="text-[10px] font-mono font-bold tracking-wider text-red-600 bg-red-50 px-2.5 py-0.5 rounded uppercase border border-red-100">
                            Case ID: {inc.id}
                          </span>
                          <span className="text-[10px] font-mono font-bold tracking-wider text-slate-600 bg-slate-50 px-2.5 py-0.5 rounded uppercase border border-slate-100">
                            Priority Score: {inc.priorityScore}
                          </span>
                        </div>
                        <h5 className="text-base font-extrabold text-slate-800">{inc.locationName}</h5>
                        <p className="text-xs text-slate-500 font-medium leading-relaxed mt-1">
                          {inc.description}
                        </p>
                      </div>

                      <span className="bg-red-500 text-white font-extrabold text-xs px-3 py-1 rounded-xl shrink-0">
                        {inc.triageLevel}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => handleOpenDispatchModal(inc.id)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl py-3.5 px-5 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-emerald-600/10"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>ACCEPT & DISPATCH (ទទួល)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRejectDispatch(inc.id)}
                        className="bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-700 border border-slate-200/80 rounded-2xl py-3.5 px-5 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>DECLINE CASE (បដិសេធ)</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* List of active accepted emergencies */}
            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-6">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-3">
                <div className="space-y-0.5">
                  <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-600" />
                    <span>Emergency Incidents Under Care</span>
                  </h3>
                  <p className="text-xs text-slate-500 font-semibold">
                    Real-time clinical cases and active paramedics dispatched from this trauma center.
                  </p>
                </div>
                <span className="bg-emerald-50 text-emerald-800 text-xs font-bold px-3 py-1 rounded-xl font-mono self-start sm:self-auto shrink-0">
                  {activeIncidents.filter(i => i.status !== "Reported").length} Active Cases
                </span>
              </div>

              {activeIncidents.filter(i => i.status !== "Reported").length === 0 ? (
                <div className="text-center py-12 border border-dashed border-slate-100 rounded-3xl space-y-3">
                  <div className="p-3.5 bg-emerald-50 text-emerald-500 rounded-full w-fit mx-auto">
                    <Check className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-700">All Assigned Incidents Complete</h4>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                    This hospital has zero active callouts. New incoming reports will alert with sound and timers.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activeIncidents.filter(i => i.status !== "Reported").map(inc => {
                    const isSelected = selectedIncident?.id === inc.id;
                    const elapsedMins = Math.round((Date.now() - new Date(inc.reportedAt).getTime()) / 60000);

                    return (
                      <div
                        key={inc.id}
                        className={`rounded-2xl border p-4.5 transition-all flex flex-col justify-between gap-4 cursor-pointer ${
                          isSelected 
                            ? "border-emerald-500 bg-emerald-50/20 shadow-sm"
                            : "border-slate-100 hover:border-slate-200 bg-white"
                        }`}
                        onClick={() => setSelectedIncident(inc)}
                      >
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-mono font-bold text-slate-400">
                              ID: {inc.id} • {elapsedMins}m ago
                            </span>
                            <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full ${
                              inc.triageLevel === "RED" 
                                ? "bg-red-100 text-red-700" 
                                : "bg-amber-100 text-amber-700"
                            }`}>
                              {inc.triageLevel}
                            </span>
                          </div>
                          <div>
                            <h4 className="text-sm font-extrabold text-slate-800 line-clamp-1">{inc.locationName}</h4>
                            <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                              {inc.description}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-slate-100 mt-auto">
                          <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
                            {inc.status}
                          </span>
                          <button
                            type="button"
                            className="text-xs text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                            <span>Inspect Triage</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

            </div>

          </div>

          {/* Right Column: Tactical Map & Dynamic Inspection summaries */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Live Map Box */}
            <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-3">
              <div className="space-y-0.5">
                <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <Map className="w-4 h-4 text-emerald-600" />
                  <span>District Ambulance Grid</span>
                </h4>
                <p className="text-xs text-slate-400">Live coordinates of local medical vehicles.</p>
              </div>
              <PhnomPenhMap
                hospitals={hospitals}
                ambulances={ambulances}
                incidents={incidents}
                selectedIncident={selectedIncident}
                onSelectIncident={(inc) => setSelectedIncident(inc)}
                interactive={false}
              />
            </div>

            {/* Selected Case Inspection detail panel */}
            {selectedIncident ? (
              <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-6 animate-fade-in">
                <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                  <div className="space-y-0.5">
                    <span className="text-[9px] font-mono font-bold text-emerald-600 uppercase bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                      Active Case Diagnostics
                    </span>
                    <h4 className="text-base font-bold text-slate-800 mt-1">{selectedIncident.locationName}</h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedIncident(null)}
                    className="text-slate-400 hover:text-slate-600 text-xs font-mono font-bold"
                  >
                    Close [X]
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-slate-400 block text-[9px] mb-0.5">Triage Status</span>
                    <span className="font-bold text-slate-800">{selectedIncident.triageLevel} ({selectedIncident.priorityScore})</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-slate-400 block text-[9px] mb-0.5">Consciousness</span>
                    <span className="font-bold text-slate-800">{selectedIncident.conscious}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-slate-400 block text-[9px] mb-0.5">Respiration</span>
                    <span className="font-bold text-slate-800">{selectedIncident.breathing}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-slate-400 block text-[9px] mb-0.5">Injuries</span>
                    <span className="font-bold text-slate-800 truncate block">{selectedIncident.injuries.join(", ")}</span>
                  </div>
                </div>

                {selectedIncident.priorityRationale && (
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-1">
                    <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider block">AI Triage Rationale</span>
                    <p className="text-xs text-slate-600 leading-relaxed font-semibold">
                      {selectedIncident.priorityRationale}
                    </p>
                  </div>
                )}

                {/* Simulated Manual Ambulance Status Progression Tool for Paramedics */}
                <div className="space-y-3 pt-2">
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">
                    Update Incident Progress (Simulation Control)
                  </span>
                  
                  <div className="flex flex-wrap gap-2">
                    {selectedIncident.status === "Ambulance Dispatched" && (
                      <button
                        type="button"
                        onClick={() => onUpdateStatus(selectedIncident.id, "On-Scene", "Ambulance arrived on-scene. Commencing emergency stabilization.")}
                        className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl py-2 px-3.5 text-[11px] font-bold transition-all cursor-pointer"
                      >
                        Arrived On-Scene &rarr;
                      </button>
                    )}
                    {selectedIncident.status === "On-Scene" && (
                      <button
                        type="button"
                        onClick={() => onUpdateStatus(selectedIncident.id, "Transporting", "Patient stabilized in vehicle. Transporting to Calmette ICU ward.")}
                        className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl py-2 px-3.5 text-[11px] font-bold transition-all cursor-pointer"
                      >
                        Transport Patient &rarr;
                      </button>
                    )}
                    {selectedIncident.status === "Transporting" && (
                      <button
                        type="button"
                        onClick={() => onUpdateStatus(selectedIncident.id, "Arrived at Hospital", "Ambulance arrived back at Calmette trauma center. Direct handover to ICU team.")}
                        className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl py-2 px-3.5 text-[11px] font-bold transition-all cursor-pointer"
                      >
                        Arrive at Hospital &rarr;
                      </button>
                    )}
                    {selectedIncident.status === "Arrived at Hospital" && (
                      <button
                        type="button"
                        onClick={() => onUpdateStatus(selectedIncident.id, "Resolved", "Treated, stable, and admitted. Emergency case officially resolved.")}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl py-2 px-3.5 text-[11px] font-bold transition-all cursor-pointer"
                      >
                        Resolve Case
                      </button>
                    )}
                  </div>
                </div>

                {/* Case Milestones */}
                <div className="space-y-4 pt-2 border-t border-slate-100">
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Timeline Logs</span>
                  <div className="space-y-3 border-l-2 border-slate-100 pl-3 ml-1.5">
                    {selectedIncident.timeline.map((event, idx) => (
                      <div key={idx} className="relative text-xs">
                        <div className="absolute -left-[17px] top-1 w-2 h-2 rounded-full bg-emerald-500 border border-white"></div>
                        <div className="flex justify-between font-bold text-slate-800">
                          <span>{event.status}</span>
                          <span className="text-[10px] text-slate-400 font-mono font-normal">
                            {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-slate-500 mt-0.5 leading-relaxed font-medium">{event.note}</p>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            ) : (
              <div className="bg-slate-50 border border-dashed border-slate-200 rounded-3xl p-8 text-center text-xs text-slate-400">
                <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="font-semibold">No Incident Selected</p>
                <p className="mt-1">Click "Inspect Triage" on any case list to see full AI diagnostics and paramedic milestones.</p>
              </div>
            )}

            {/* Resolved History */}
            {resolvedIncidents.length > 0 && (
              <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-3">
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">
                  Resolved History archive ({resolvedIncidents.length})
                </span>
                <div className="divide-y divide-slate-100 max-h-[160px] overflow-y-auto pr-1">
                  {resolvedIncidents.map(inc => (
                    <div key={inc.id} className="py-2.5 flex justify-between items-center text-xs">
                      <div>
                        <p className="font-bold text-slate-700">{inc.locationName}</p>
                        <p className="text-[10px] text-slate-400 line-clamp-1">{inc.description}</p>
                      </div>
                      <span className="text-emerald-700 font-extrabold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 text-[10px]">
                        Resolved
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

        </div>
      )}

      {activeSubTab === "analytics" && (
        <div className="space-y-6 animate-fade-in">
          
          {/* Executive KPI Overview Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Total Dispatches</span>
                <span className="text-2xl font-black text-slate-800">{hospitalIncidents.length}</span>
                <p className="text-[10px] text-slate-400">Recorded cases in this node</p>
              </div>
              <div className="p-3 bg-red-50 text-red-500 rounded-2xl">
                <Activity className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Acceptance Rate</span>
                <span className="text-2xl font-black text-slate-800">
                  {hospitalIncidents.length > 0 
                    ? Math.round(((hospitalIncidents.length - 1) / hospitalIncidents.length) * 100) 
                    : 100}%
                </span>
                <p className="text-[10px] text-slate-400">Target performance &gt; 95%</p>
              </div>
              <div className="p-3 bg-emerald-50 text-emerald-500 rounded-2xl">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Avg Reaction Delay</span>
                <span className="text-2xl font-black text-slate-800">8.4s</span>
                <p className="text-[10px] text-slate-400">Acceptance lock latency</p>
              </div>
              <div className="p-3 bg-amber-50 text-amber-500 rounded-2xl">
                <Clock className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Specialty Score</span>
                <span className="text-2xl font-black text-slate-800">100%</span>
                <p className="text-[10px] text-slate-400">Clinical alignment accuracy</p>
              </div>
              <div className="p-3 bg-blue-50 text-blue-500 rounded-2xl">
                <Award className="w-5 h-5" />
              </div>
            </div>

          </div>

          {/* Graphical Data grids */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Triage Level distribution bar chart */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
              <div className="space-y-0.5">
                <h4 className="text-sm font-bold text-slate-800">Triage Profile Distribution</h4>
                <p className="text-xs text-slate-400">Total volume of critical care classifications.</p>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={triageData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <Tooltip cursor={{ fill: '#f8fafc' }} />
                    <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                      {triageData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Target vs Actual response times chart */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
              <div className="space-y-0.5">
                <h4 className="text-sm font-bold text-slate-800">Response Delay Performance (Minutes)</h4>
                <p className="text-xs text-slate-400">Actual response arrival minutes vs international guidelines.</p>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={responseTimeData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <Tooltip />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Target" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Actual" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Traffic Load Line chart */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm lg:col-span-2 space-y-4">
              <div className="space-y-0.5">
                <h4 className="text-sm font-bold text-slate-800">Hourly Ambulance Dispatch Stress Loop</h4>
                <p className="text-xs text-slate-400">Recorded frequency of emergency callouts by time range.</p>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={hourlyStrainData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                    <YAxis stroke="#94a3b8" fontSize={11} />
                    <Tooltip />
                    <Line type="monotone" dataKey="active" stroke="#ef4444" strokeWidth={3} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

        </div>
      )}

      {activeSubTab === "fleet" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in">
          
          {/* Bed & capacity control column */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Massive ICU bed capacity controllers */}
            {selectedHospital && (
              <div className="bg-[#0f172a] rounded-3xl p-6 text-white border border-slate-800 space-y-6 shadow-md">
                <div className="border-b border-slate-800 pb-4 space-y-1">
                  <span className="text-[10px] font-mono font-bold text-emerald-400 tracking-wider uppercase flex items-center gap-1.5">
                    <Bed className="w-4 h-4 text-emerald-400" />
                    <span>TRAUMA ICU BEDS CONTROL</span>
                  </span>
                  <h3 className="text-lg font-bold text-white">{selectedHospital.name}</h3>
                  <p className="text-xs text-slate-400 font-bold">{selectedHospital.nameKhmer}</p>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center text-xs font-mono">
                    <span className="text-slate-400">Available Trauma ICU Beds</span>
                    <span className="font-extrabold text-white text-sm">
                      {selectedHospital.availableIcuBeds} / {selectedHospital.totalIcuBeds}
                    </span>
                  </div>

                  <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden border border-slate-800">
                    <div
                      className={`h-full transition-all duration-500 ${
                        selectedHospital.availableIcuBeds === 0 
                          ? "bg-red-500" 
                          : (selectedHospital.availableIcuBeds / selectedHospital.totalIcuBeds) < 0.3 
                          ? "bg-amber-500" 
                          : "bg-emerald-500"
                      }`}
                      style={{ width: `${(selectedHospital.availableIcuBeds / selectedHospital.totalIcuBeds) * 100}%` }}
                    ></div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => onModifyIcuBeds(selectedHospital.id, -1)}
                      disabled={selectedHospital.availableIcuBeds === 0}
                      className="bg-slate-900 hover:bg-red-950/40 text-red-400 hover:text-red-300 border border-slate-800 hover:border-red-900/40 rounded-2xl py-3.5 px-4 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-30"
                    >
                      <Minus className="w-4 h-4 text-red-500" />
                      <span>Occupied (-1)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onModifyIcuBeds(selectedHospital.id, 1)}
                      disabled={selectedHospital.availableIcuBeds === selectedHospital.totalIcuBeds}
                      className="bg-slate-900 hover:bg-emerald-950/40 text-emerald-400 hover:text-emerald-300 border border-slate-800 hover:border-emerald-900/40 rounded-2xl py-3.5 px-4 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-30"
                    >
                      <Plus className="w-4 h-4 text-emerald-500" />
                      <span>Release (+1)</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-800/60 text-xs font-mono">
                  <div className="bg-slate-900 p-3 rounded-2xl border border-slate-800">
                    <span className="text-slate-500 block text-[9px] mb-1">AMBULANCE FLEET</span>
                    <span className="text-slate-200 font-bold flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{selectedHospital.availableAmbulances} Free</span>
                    </span>
                  </div>
                  <div className="bg-slate-900 p-3 rounded-2xl border border-slate-800">
                    <span className="text-slate-500 block text-[9px] mb-1">HOTLINE DIRECT</span>
                    <a href={`tel:${selectedHospital.phone}`} className="text-emerald-400 font-bold hover:underline flex items-center gap-1.5">
                      <PhoneCall className="w-3.5 h-3.5" />
                      <span>{selectedHospital.phone}</span>
                    </a>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Active fleet list column */}
          <div className="lg:col-span-8 bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-6">
            
            <div className="space-y-0.5 border-b border-slate-100 pb-4">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Truck className="w-4 h-4 text-blue-500" />
                <span>Active Ambulance Fleet Ledger</span>
              </h3>
              <p className="text-xs text-slate-500 font-semibold">
                Live operational tracking of all ambulance assets assigned to this medical station.
              </p>
            </div>

            <div className="divide-y divide-slate-100">
              {hospitalAmbulances.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs font-medium">
                  No ambulance fleet data found for this hospital.
                </div>
              ) : (
                hospitalAmbulances.map(amb => (
                  <div key={amb.id} className="py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs font-mono">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                        <AmbulanceIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-extrabold text-slate-800 text-sm">{amb.plateNumber}</p>
                        <p className="text-[10px] text-slate-400">Lat: {amb.lat.toFixed(4)} • Lng: {amb.lng.toFixed(4)}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-auto">
                      <span className={`px-2.5 py-1 rounded-xl font-bold font-sans text-[10px] uppercase border ${
                        amb.status === "Available"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                          : amb.status === "Dispatched"
                          ? "bg-amber-50 text-amber-700 border-amber-100 animate-pulse"
                          : amb.status === "On-Scene"
                          ? "bg-red-50 text-red-700 border-red-100"
                          : "bg-blue-50 text-blue-700 border-blue-100"
                      }`}>
                        {amb.status}
                      </span>

                      {/* Simulation Release Button if on-trip */}
                      {amb.status !== "Available" && (
                        <button
                          type="button"
                          onClick={() => {
                            if (amb.patientId) {
                              onUpdateStatus(amb.patientId, "Resolved", `Emergency resolved. Ambulance ${amb.plateNumber} returned to standby status.`);
                            }
                          }}
                          className="bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200 hover:border-emerald-200 px-3 py-1.5 rounded-xl font-sans text-[11px] font-extrabold transition-all cursor-pointer"
                        >
                          Standby Reset
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

          </div>

        </div>
      )}

      {/* DISPATCH EXPLICIT ASSIGNMENT TIMELINE MODAL */}
      {dispatchingIncidentId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-2xl max-w-md w-full space-y-6 animate-fade-in relative">
            
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-red-600 text-white rounded-xl">
                  <ShieldAlert className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h4 className="text-base font-extrabold text-slate-800">Official Dispatch Assignment</h4>
                  <p className="text-[11px] text-slate-400">Select ambulance & driver for Case: {dispatchingIncidentId}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDispatchingIncidentId(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold font-mono"
              >
                [X]
              </button>
            </div>

            <div className="space-y-4">
              
              {/* Select available Ambulance */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                  Available Fleet Vehicles
                </label>
                {hospitalAmbulances.filter(amb => amb.status === "Available").length === 0 ? (
                  <div className="p-3.5 bg-amber-50 text-amber-800 rounded-xl border border-amber-100 text-[11px] font-semibold leading-relaxed">
                    All fleet vehicles are active. Re-assigning standby vehicle PP-2B-3345 as primary responder.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {hospitalAmbulances.filter(amb => amb.status === "Available").map(amb => (
                      <button
                        key={amb.id}
                        type="button"
                        onClick={() => setSelectedAmbulanceId(amb.id)}
                        className={`p-3 rounded-xl border font-mono text-xs text-left transition-all cursor-pointer flex flex-col justify-between ${
                          selectedAmbulanceId === amb.id
                            ? "border-emerald-500 bg-emerald-50/40 text-emerald-800 font-extrabold"
                            : "border-slate-100 bg-white hover:border-slate-200"
                        }`}
                      >
                        <span>{amb.plateNumber}</span>
                        <span className="text-[9px] text-slate-400 mt-1 font-sans">Ready</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Select / Input Paramedic Driver Name */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                  Responding Paramedic Lead
                </label>
                <div className="grid grid-cols-2 gap-1.5 max-h-[120px] overflow-y-auto pr-1">
                  {PARAMEDIC_DRIVERS.map(drv => (
                    <button
                      key={drv}
                      type="button"
                      onClick={() => setDriverName(drv)}
                      className={`p-2.5 rounded-lg border text-[11px] text-left transition-all cursor-pointer font-sans truncate ${
                        driverName === drv
                          ? "border-emerald-500 bg-emerald-50/40 text-emerald-800 font-bold"
                          : "border-slate-100 bg-white hover:border-slate-200"
                      }`}
                    >
                      {drv}
                    </button>
                  ))}
                </div>
              </div>

            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDispatchingIncidentId(null)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl py-3 text-xs font-bold font-sans cursor-pointer transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDispatch}
                disabled={!selectedAmbulanceId && hospitalAmbulances.length === 0}
                className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl py-3 text-xs font-bold font-sans cursor-pointer transition-all shadow-md shadow-emerald-600/10 disabled:opacity-50"
              >
                Confirm Dispatch
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
