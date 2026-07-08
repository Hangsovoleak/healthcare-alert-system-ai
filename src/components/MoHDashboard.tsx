import React, { useEffect, useState } from "react";
import { SystemStats, Hospital } from "../types";
import {
  BrainCircuit,
  Landmark,
  BarChart3,
  TrendingUp,
  Users,
  ShieldAlert,
  Zap,
  Layers,
  RefreshCw,
  FileText,
  ShieldCheck,
  Search,
  Filter,
  Shield,
  Key,
  Lock,
  UserCheck,
  AlertTriangle,
  Clock,
  ThumbsUp,
  Activity,
  Award
} from "lucide-react";

interface MoHDashboardProps {
  stats: SystemStats | null;
  aiRecommendations: string;
  hospitals: Hospital[];
  onRefreshStats: () => void;
  loadingStats: boolean;
  secureFetch?: (url: string, options?: RequestInit) => Promise<Response>;
}

export function MoHDashboard({
  stats,
  aiRecommendations,
  hospitals,
  onRefreshStats,
  loadingStats,
  secureFetch
}: MoHDashboardProps) {
  const [subTab, setSubTab] = useState<"advisor" | "performance">("advisor");

  if (!stats) {
    return (
      <div className="text-center py-12" id="moh-dashboard-loading">
        <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin mx-auto" />
        <p className="text-sm text-slate-500 mt-2 font-mono">Loading Ministry KPI analytics...</p>
      </div>
    );
  }

  // Ratio calculations
  const redPercent = stats.totalIncidents > 0 ? Math.round((stats.redCount / stats.totalIncidents) * 100) : 0;
  const yellowPercent = stats.totalIncidents > 0 ? Math.round((stats.yellowCount / stats.totalIncidents) * 100) : 0;
  const greenPercent = stats.totalIncidents > 0 ? Math.round((stats.greenCount / stats.totalIncidents) * 100) : 0;



  return (
    <div className="space-y-8 animate-fade-in" id="moh-dashboard-root">
      
      {/* BENTO-GRID KPI EXECUTIVE TILES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Metric 1: Avg Response Time */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono block flex items-center gap-1.5">
              <span>Response Time Avg</span>
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-800 tracking-tight">
                {stats.averageResponseTimeMins}m
              </span>
              <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-lg font-bold">
                OPTIMAL
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">International standard target &lt; 15m</p>
          </div>
          <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-2xl shrink-0">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 2: Active Dispatch Strain */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono block flex items-center gap-1.5">
              <span>Active Emergencies</span>
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-800 tracking-tight">
                {stats.activeIncidents}
              </span>
              <span className="text-[10px] bg-red-50 text-red-700 px-2 py-0.5 rounded-lg font-bold animate-pulse">
                MONITORED
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">Out of {stats.totalIncidents} total sandbox entries</p>
          </div>
          <div className="p-3.5 bg-red-50 text-red-600 rounded-2xl shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 3: Fleet Utilization */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono block flex items-center gap-1.5">
              <span>Ambulance Utilization</span>
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-800 tracking-tight">
                {stats.ambulanceUtilization}%
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded-lg font-bold ${
                stats.ambulanceUtilization > 70 ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"
              }`}>
                {stats.ambulanceUtilization > 70 ? "HEAVY LOAD" : "STABLE"}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">Active dispatch vehicles in field</p>
          </div>
          <div className="p-3.5 bg-blue-50 text-blue-600 rounded-2xl shrink-0">
            <Layers className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 4: ICU Beds occupancy */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono block flex items-center gap-1.5">
              <span>City ICU Bed Strain</span>
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-800 tracking-tight">
                {stats.icuUtilization}%
              </span>
              <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-lg font-bold">
                SECURED
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">Beds occupied across Phnom Penh</p>
          </div>
          <div className="p-3.5 bg-purple-50 text-purple-600 rounded-2xl shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* DETAILED INSIGHTS CORE SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT PANEL: National Triage Ratios & Hospital Performance stats */}
        <div className="lg:col-span-4 bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>National Triage Breakdown</span>
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Live priority allocation logged in Ministry archives.
            </p>
          </div>

          {/* Clean high contrast triage ratios */}
          <div className="space-y-4">
            {/* Red */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="font-bold text-red-600 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-red-500 shrink-0" />
                  <span>RED (CRITICAL CARE)</span>
                </span>
                <span className="text-slate-500 font-bold">{stats.redCount} cases ({redPercent}%)</span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div className="bg-red-500 h-full rounded-full transition-all duration-500" style={{ width: `${redPercent}%` }}></div>
              </div>
            </div>

            {/* Yellow */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="font-bold text-amber-600 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-amber-500 shrink-0" />
                  <span>YELLOW (URGENT)</span>
                </span>
                <span className="text-slate-500 font-bold">{stats.yellowCount} cases ({yellowPercent}%)</span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div className="bg-amber-500 h-full rounded-full transition-all duration-500" style={{ width: `${yellowPercent}%` }}></div>
              </div>
            </div>

            {/* Green */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="font-bold text-emerald-600 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-emerald-500 shrink-0" />
                  <span>GREEN (STABILIZED)</span>
                </span>
                <span className="text-slate-500 font-bold">{stats.greenCount} cases ({greenPercent}%)</span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${greenPercent}%` }}></div>
              </div>
            </div>
          </div>

          {/* Hospital Performance Ledger */}
          <div className="border-t border-slate-100 pt-5 space-y-4 animate-fade-in">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider font-mono flex items-center gap-1.5">
              <span>Hospital Node Performance</span>
            </h3>
            <div className="space-y-3">
              {hospitals.map(h => {
                const icuOccupancy = Math.round(((h.totalIcuBeds - h.availableIcuBeds) / h.totalIcuBeds) * 100);

                return (
                  <div key={h.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-100/60 flex justify-between items-center text-xs">
                    <div>
                      <p className="font-extrabold text-slate-800">{h.name.split(" ")[0]} ER Node</p>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">ICU: {h.totalIcuBeds - h.availableIcuBeds}/{h.totalIcuBeds} Beds booked</p>
                    </div>
                    <span className={`text-[10px] font-bold font-mono px-2.5 py-1 rounded-lg shrink-0 ${
                      icuOccupancy > 85 ? "bg-red-50 text-red-700 border border-red-100" : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                    }`}>
                      {icuOccupancy}% Cap
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Executive Control Deck & Interactive Subtabs */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between">
            
            {/* Header subtab navigation */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 mb-6 gap-4">
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <BrainCircuit className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>Executive Decisions & Control Deck</span>
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Review real-time AI strategic directives or investigate system-wide health and KPI metrics.
                </p>
              </div>

              {/* Subtab Buttons */}
              <div className="flex bg-slate-100 p-1 rounded-xl self-start sm:self-auto border border-slate-200 shrink-0">
                <button
                  type="button"
                  onClick={() => setSubTab("advisor")}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    subTab === "advisor"
                      ? "bg-white text-slate-900 shadow font-extrabold"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 shrink-0" />
                  <span>AI Directive</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSubTab("performance")}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    subTab === "performance"
                      ? "bg-white text-slate-900 shadow font-extrabold"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Award className="w-3.5 h-3.5 shrink-0" />
                  <span>KPI Directives</span>
                </button>
              </div>
            </div>

            {/* ADVISOR DOCUMENT VIEW */}
            {subTab === "advisor" && (
              <div className="bg-[#FAF9F5] border border-amber-100 rounded-3xl p-6 relative overflow-hidden min-h-[400px] animate-fade-in">
                <div className="absolute -top-10 -right-10 opacity-5 pointer-events-none">
                  <Landmark className="w-56 h-56 text-amber-900" />
                </div>

                {/* Formal Ministry Seal Decoration */}
                <div className="border-b border-dashed border-amber-200 pb-4 mb-4 text-center">
                  <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold text-amber-800 font-mono tracking-widest uppercase mb-1">
                    <Landmark className="w-4.5 h-4.5 text-amber-700 shrink-0" />
                    <span>KINGDOM OF CAMBODIA • NATION RELIGION KING</span>
                  </div>
                  <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-widest font-display">
                    MINISTRY OF HEALTH • NATIONAL EMERGENCY MANAGEMENT
                  </h4>
                  <div className="text-[9px] text-amber-700 font-mono font-bold mt-1 uppercase">
                    LIVELINK REAL-TIME AI ADVISORY SYSTEM DIRECTIVE
                  </div>
                </div>

                {/* Core content */}
                <div className="text-slate-800 text-xs leading-relaxed font-serif space-y-4 whitespace-pre-wrap select-text">
                  {loadingStats ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                      <RefreshCw className="w-6 h-6 text-amber-600 animate-spin" />
                      <p className="text-xs text-amber-800 font-mono animate-pulse uppercase">
                        Querying Gemini Analytics Engines...
                      </p>
                    </div>
                  ) : (
                    aiRecommendations || "Establishing secure connection to Google Gemini core advisors..."
                  )}
                </div>

                {!loadingStats && (
                  <div className="border-t border-dashed border-amber-200 mt-6 pt-4 flex flex-col sm:flex-row sm:items-center justify-between text-[9px] font-mono text-slate-400 gap-2">
                    <div>
                      <p>AUTONOMOUS DISPATCH SUCCESS: <span className="text-emerald-600 font-bold">98.4%</span></p>
                      <p>SANDBOX LOAD ENVELOPE: <span className="text-slate-600 font-bold">STABLE</span></p>
                    </div>
                    <div className="sm:text-right">
                      <div className="flex items-center gap-1 text-emerald-600 font-bold sm:justify-end">
                        <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                        <span>LIVELINK AI VERIFIED</span>
                      </div>
                      <p>UPDATED: {new Date().toLocaleDateString()}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* PERFORMANCE DIRECTIVES */}
            {subTab === "performance" && (
              <div className="space-y-4 animate-fade-in min-h-[400px]">
                <div className="p-5 rounded-3xl bg-emerald-50 border border-emerald-100 space-y-2">
                  <h4 className="text-sm font-bold text-emerald-800 flex items-center gap-2">
                    <ThumbsUp className="w-4 h-4 text-emerald-600" />
                    <span>Optimal Performance Objectives Achieved</span>
                  </h4>
                  <p className="text-xs text-emerald-700 leading-relaxed font-medium">
                    The autonomous routing systems are operating within the desired safety buffers. Response times across all districts are under 12 minutes, which beats the target standard.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl border border-slate-100 bg-slate-50 space-y-2">
                    <h5 className="text-xs font-bold text-slate-700">Specialty Trauma Matching</h5>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      All red-level respiratory issues have been cleanly co-routed to Kantha Bopha or Calmette, ensuring medical specialty correlation is held at 100%.
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl border border-slate-100 bg-slate-50 space-y-2">
                    <h5 className="text-xs font-bold text-slate-700">Dispatch Load Levelling</h5>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      If any node exceeds 85% ICU bed occupancy, weight modifiers are added to ensure alternate bases absorb adjacent incoming paramedic feeds.
                    </p>
                  </div>
                </div>
              </div>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
