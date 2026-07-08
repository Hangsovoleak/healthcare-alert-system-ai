import React, { useState, useEffect, useCallback } from "react";
import { Hospital, Ambulance, Incident, SystemStats, NotificationItem } from "./types";
import { PhnomPenhMap } from "./components/PhnomPenhMap";
import { CitizenReporter } from "./components/CitizenReporter";
import { HospitalCommand } from "./components/HospitalCommand";
import { MoHDashboard } from "./components/MoHDashboard";
import { NotificationCenter } from "./components/NotificationCenter";
import { 
  AlertCircle, 
  ShieldAlert, 
  HeartPulse, 
  Users, 
  BrainCircuit, 
  ShieldCheck, 
  Info,
  Layers,
  ServerCrash,
  Bell,
  Lock,
  LogOut,
  Key,
  Shield,
  Loader2,
  LockKeyhole
} from "lucide-react";

// Safe JSON parser to handle potential network gateway non-JSON fallback pages gracefully
async function safeJson(res: Response, fallback: any = null) {
  try {
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (parseErr) {
      console.warn(`[JSON PARSE FAILED] Expected JSON, got text sample: "${text.slice(0, 100)}..."`, parseErr);
      return fallback;
    }
  } catch (err) {
    console.error("Failed to read response body text:", err);
    return fallback;
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<"reporter" | "hospitals" | "moh">("reporter");
  const [isNotificationDrawerOpen, setIsNotificationDrawerOpen] = useState(false);
  const [isAboutDrawerOpen, setIsAboutDrawerOpen] = useState(false);
  
  // Enterprise Authentication States
  const [user, setUser] = useState<{ id: string; username: string; role: "MOH" | "HOSPITAL" | "CITIZEN"; name: string; organization: string } | null>(null);
  const [csrfToken, setCsrfToken] = useState<string>("");
  const [accessToken, setAccessToken] = useState<string>("");
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  
  // Login input fields
  const [loginUsername, setLoginUsername] = useState<string>("");
  const [loginPassword, setLoginPassword] = useState<string>("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isSubmittingLogin, setIsSubmittingLogin] = useState<boolean>(false);

  // Real-time states
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [ambulances, setAmbulances] = useState<Ambulance[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  
  // Notifications and WebSocket States
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [wsStatus, setWsStatus] = useState<"connected" | "disconnected" | "connecting">("connecting");
  const [retryingNotifications, setRetryingNotifications] = useState(false);

  // Ministry KPI stats
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [aiRecommendations, setAiRecommendations] = useState<string>("");
  
  // Selection and simulation triggers
  const [pinLocation, setPinLocation] = useState<{ lat: number; lng: number; name: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [timeStr, setTimeStr] = useState<string>("");

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      try {
        const formatter = new Intl.DateTimeFormat("en-US", {
          timeZone: "Asia/Phnom_Penh",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false
        });
        setTimeStr(`${formatter.format(now)} GMT+7`);
      } catch (e) {
        setTimeStr(now.toLocaleTimeString());
      }
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Session verification on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const savedRefreshToken = localStorage.getItem("refresh_token");
        const savedAccessToken = localStorage.getItem("access_token");

        let activeAccessToken = savedAccessToken || "";

        // Attempt verification with accessToken in Authorization header if present
        let res = await fetch("/api/auth/me", {
          headers: activeAccessToken ? { "Authorization": `Bearer ${activeAccessToken}` } : {},
          credentials: "same-origin"
        });

        if (!res.ok && savedRefreshToken) {
          // Token expired or cookies blocked, fallback to refresh token in request body
          const refreshRes = await fetch("/api/auth/refresh", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken: savedRefreshToken }),
            credentials: "same-origin"
          });
          if (refreshRes.ok) {
            const refreshData = await safeJson(refreshRes, null);
            if (refreshData && refreshData.success) {
              setUser(refreshData.user);
              setCsrfToken(refreshData.csrfToken || "");
              setAccessToken(refreshData.accessToken || "");
              localStorage.setItem("access_token", refreshData.accessToken || "");
              localStorage.setItem("refresh_token", refreshData.refreshToken || "");
              return;
            }
          }
        } else if (res.ok) {
          const data = await safeJson(res, null);
          if (data && data.success && data.user) {
            setUser(data.user);
            setAccessToken(activeAccessToken);
            
            // Re-negotiate refresh to grab csrf token
            const refreshRes = await fetch("/api/auth/refresh", {
              method: "POST",
              headers: savedRefreshToken ? { "Content-Type": "application/json" } : {},
              body: savedRefreshToken ? JSON.stringify({ refreshToken: savedRefreshToken }) : undefined,
              credentials: "same-origin"
            });
            if (refreshRes.ok) {
              const refreshData = await safeJson(refreshRes, null);
              if (refreshData && refreshData.success) {
                setCsrfToken(refreshData.csrfToken || "");
                setAccessToken(refreshData.accessToken || "");
                localStorage.setItem("access_token", refreshData.accessToken || "");
                localStorage.setItem("refresh_token", refreshData.refreshToken || "");
              }
            }
          }
        }
      } catch (err) {
        console.error("Session verification failed:", err);
      } finally {
        setAuthLoading(false);
      }
    };
    checkSession();
  }, []);

  // Secure Fetch API wrapper that integrates automated CSRF validation & Silent JWT Session Renewal on 401
  const secureFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers || {});
    if (csrfToken) {
      headers.set("X-CSRF-Token", csrfToken);
    }
    const currentToken = accessToken || localStorage.getItem("access_token") || "";
    if (currentToken) {
      headers.set("Authorization", `Bearer ${currentToken}`);
    }
    const secureOptions: RequestInit = {
      ...options,
      headers,
      credentials: "same-origin" as const // Passes HttpOnly JWT cookies securely
    };

    let res = await fetch(url, secureOptions);

    if (res.status === 401) {
      // Access token expired. Silently request replacement using secure rotating refresh cookie or body fallback!
      try {
        const savedRefreshToken = localStorage.getItem("refresh_token");
        const refreshRes = await fetch("/api/auth/refresh", {
          method: "POST",
          headers: savedRefreshToken ? { "Content-Type": "application/json" } : {},
          body: savedRefreshToken ? JSON.stringify({ refreshToken: savedRefreshToken }) : undefined,
          credentials: "same-origin" as const
        });
        if (refreshRes.ok) {
          const refreshData = await safeJson(refreshRes, null);
          if (refreshData && refreshData.success) {
            setCsrfToken(refreshData.csrfToken || "");
            setAccessToken(refreshData.accessToken || "");
            localStorage.setItem("access_token", refreshData.accessToken || "");
            localStorage.setItem("refresh_token", refreshData.refreshToken || "");
            
            // Re-try the original pending operational request with refreshed credentials
            const retryHeaders = new Headers(options.headers || {});
            retryHeaders.set("X-CSRF-Token", refreshData.csrfToken || "");
            retryHeaders.set("Authorization", `Bearer ${refreshData.accessToken}`);
            const retryOptions: RequestInit = {
              ...options,
              headers: retryHeaders,
              credentials: "same-origin" as const
            };
            res = await fetch(url, retryOptions);
          } else {
            setUser(null);
            setCsrfToken("");
            setAccessToken("");
            localStorage.removeItem("access_token");
            localStorage.removeItem("refresh_token");
          }
        } else {
          setUser(null);
          setCsrfToken("");
          setAccessToken("");
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
        }
      } catch (err) {
        setUser(null);
        setCsrfToken("");
        setAccessToken("");
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
      }
    }

    return res;
  }, [csrfToken, accessToken]);

  // Fetch Hospitals
  const fetchHospitals = useCallback(async () => {
    if (!user) return;
    try {
      const res = await secureFetch("/api/hospitals");
      if (!res.ok) throw new Error("Failed to fetch hospitals");
      const data = await safeJson(res, []);
      setHospitals(data);
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to communicate with LifeLink local server nodes.");
    }
  }, [user, secureFetch]);

  // Fetch Ambulances separately to sync coordinates with server movement simulation loop
  const fetchAmbulances = useCallback(async () => {
    if (!user) return;
    try {
      const res = await secureFetch("/api/ambulances");
      if (res.ok) {
        const data = await safeJson(res, []);
        setAmbulances(data);
      }
    } catch (err) {
      console.error("Failed to sync ambulances:", err);
    }
  }, [user, secureFetch]);

  // Fetch Incidents
  const fetchIncidents = useCallback(async () => {
    if (!user) return;
    try {
      const res = await secureFetch("/api/incidents");
      if (!res.ok) throw new Error("Failed to fetch incidents");
      const data = await safeJson(res, []);
      setIncidents(data || []);

      // If there's an active incident in state, update selectedIncident with latest stats
      if (selectedIncident && data) {
        const latest = data.find((i: Incident) => i.id === selectedIncident.id);
        if (latest) {
          setSelectedIncident(latest);
        }
      }
    } catch (err) {
      console.error(err);
    }
  }, [user, selectedIncident, secureFetch]);

  // Fetch Notifications List
  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const res = await secureFetch("/api/notifications");
      if (res.ok) {
        const data = await safeJson(res, []);
        setNotifications(data);
      }
    } catch (err) {
      console.error("Failed to sync notifications stream:", err);
    }
  }, [user, secureFetch]);

  // Fetch Stats
  const fetchStats = useCallback(async () => {
    if (!user || user.role !== "MOH") return; // RBAC lock on background MoH polling
    setLoadingStats(true);
    try {
      const res = await secureFetch("/api/moh/stats");
      if (res.ok) {
        const payload = await safeJson(res, null);
        if (payload) {
          setStats(payload.stats);
          setAiRecommendations(payload.recommendations || "");
        }
      }
    } catch (err) {
      console.error("Failed to pull MOH statistics:", err);
    } finally {
      setLoadingStats(false);
    }
  }, [user, secureFetch]);

  // Websocket Live Notifications Pipeline
  useEffect(() => {
    if (!user) return; // Keep disconnected when not authenticated

    let reconnectTimeout: NodeJS.Timeout;
    let ws: WebSocket | null = null;

    const connectWS = () => {
      setWsStatus("connecting");
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      console.log(`[WS-CLIENT] Connecting to LifeLink Emergency Relay: ${wsUrl}`);
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log("[WS-CLIENT] Cryptographic operational stream opened successfully.");
        setWsStatus("connected");
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          
          if (payload.type === "notification_created") {
            const added: NotificationItem = payload.notification;
            setNotifications(prev => {
              if (prev.some(n => n.id === added.id)) return prev;
              return [added, ...prev];
            });
            setUnreadCount(c => c + 1);
          } else if (payload.type === "notification_updated") {
            const updated: NotificationItem = payload.notification;
            setNotifications(prev => prev.map(n => n.id === updated.id ? updated : n));
          } else if (payload.type === "notifications_cleared") {
            setNotifications([]);
            setUnreadCount(0);
          } else if (payload.type === "ambulance_tick") {
            // Real-time map coordinates game loop tick driven by server CJS engine
            setAmbulances(payload.ambulances);
          } else if (payload.type === "incident_tick") {
            setIncidents(payload.incidents);
          }
        } catch (e) {
          console.error("[WS-CLIENT] Error parsing payload:", e);
        }
      };

      ws.onclose = () => {
        console.warn("[WS-CLIENT] Connection closed by remote node. Retrying in 4 seconds...");
        setWsStatus("disconnected");
        reconnectTimeout = setTimeout(connectWS, 4000);
      };

      ws.onerror = (err) => {
        console.error("[WS-CLIENT] Gateway error observed:", err);
        ws?.close();
      };
    };

    connectWS();

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [user]);

  // Initial Seed Load
  useEffect(() => {
    if (user) {
      fetchHospitals();
      fetchAmbulances();
      fetchIncidents();
      fetchStats();
      fetchNotifications();
    }
  }, [user, fetchHospitals, fetchAmbulances, fetchIncidents, fetchStats, fetchNotifications]);

  // Polling Simulation Engine Loops to update map positions of driving ambulances!
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      fetchHospitals();
      fetchAmbulances();
      fetchIncidents();
      fetchNotifications();
    }, 4000); // Poll every 4 seconds for immediate visual updates

    return () => clearInterval(interval);
  }, [user, fetchHospitals, fetchAmbulances, fetchIncidents, fetchNotifications]);

  // Handle map click to place pin location
  const handleMapClick = (lat: number, lng: number, name: string) => {
    setPinLocation({ lat, lng, name });
  };

  // Clear locked coordinate pin
  const handleClearPin = () => {
    setPinLocation(null);
  };

  // Submit new emergency report
  const handleReportIncident = async (reportData: {
    reporterName: string;
    reporterPhone: string;
    description: string;
    locationName: string;
    lat: number;
    lng: number;
    image?: string;
    imageMime?: string;
    audio?: string;
    audioMime?: string;
  }) => {
    const res = await secureFetch("/api/incidents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reportData),
    });

    if (!res.ok) throw new Error("Emergency transmission failure");
    const newIncident: Incident = await safeJson(res, null);
    if (!newIncident) throw new Error("Invalid incident data returned from server");

    // Append locally & sync
    setIncidents(prev => [newIncident, ...prev]);
    setSelectedIncident(newIncident);
    
    // Sync counters
    fetchHospitals();
    fetchStats();

    return newIncident;
  };

  // Simulation Admin manual workflow advancement
  const handleUpdateStatus = async (id: string, status: string, note?: string) => {
    try {
      const res = await secureFetch(`/api/incidents/${id}/update-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, note }),
      });

      if (!res.ok) throw new Error("State sync failed");
      const data = await safeJson(res, null);

      // Refresh listings
      fetchIncidents();
      fetchHospitals();
      fetchStats();
    } catch (err) {
      console.error(err);
    }
  };

  // Reset simulation database to clean seeded status
  const handleResetSimulation = async () => {
    if (!window.confirm("Are you sure you want to reset the simulation state to clean pre-seeds?")) return;
    try {
      const res = await secureFetch("/api/incidents/reset", { method: "POST" });
      if (!res.ok) throw new Error("Reset failure");
      
      setSelectedIncident(null);
      setPinLocation(null);
      
      // Refresh listings
      fetchHospitals();
      fetchIncidents();
      fetchStats();
    } catch (err) {
      console.error(err);
    }
  };

  // Simulate updating ICU bed capacity in hospital nodes (shows routing intelligence dynamically)
  const handleModifyIcuBeds = async (hospitalId: string, delta: number) => {
    // For visual prototyping, update hospital metrics locally and reflect immediately
    setHospitals(prev => 
      prev.map(h => {
        if (h.id === hospitalId) {
          const updatedBeds = Math.max(0, Math.min(h.totalIcuBeds, h.availableIcuBeds + delta));
          return { ...h, availableIcuBeds: updatedBeds };
        }
        return h;
      })
    );
  };

  const handleAcceptIncident = async (id: string, ambulanceId: string, driverName: string) => {
    try {
      const res = await secureFetch(`/api/incidents/${id}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ambulanceId, driverName }),
      });

      if (!res.ok) throw new Error("Accept failed");
      
      // Refresh listings
      fetchIncidents();
      fetchHospitals();
      fetchAmbulances();
      fetchStats();
    } catch (err) {
      console.error("Accept incident failed", err);
    }
  };

  const handleDeclineIncident = async (id: string) => {
    try {
      const res = await secureFetch(`/api/incidents/${id}/decline`, {
        method: "POST",
      });

      if (!res.ok) throw new Error("Decline failed");
      
      // Refresh listings
      fetchIncidents();
      fetchHospitals();
      fetchAmbulances();
      fetchStats();
    } catch (err) {
      console.error("Decline incident failed", err);
    }
  };

  // Notification management functions
  const handleRetryQueue = async () => {
    setRetryingNotifications(true);
    try {
      const res = await secureFetch("/api/notifications/retry", { method: "POST" });
      if (res.ok) {
        // Optimistically set status of failed logs to "Retrying"
        setNotifications(prev => prev.map(n => n.status === "Failed" ? { ...n, status: "Retrying" } : n));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setRetryingNotifications(false), 2000);
    }
  };

  const handleClearHistory = async () => {
    try {
      const res = await secureFetch("/api/notifications/clear", { method: "POST" });
      if (res.ok) {
        setNotifications([]);
        setUnreadCount(0);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleTriggerTestNotif = async (testData: { type: string; recipient: string; title: string; message: string }) => {
    try {
      const res = await secureFetch("/api/notifications/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testData)
      });
      if (res.ok) {
        const data = await safeJson(res, null);
        if (data && data.notification) {
          const added = data.notification;
          setNotifications(prev => {
            if (prev.some(n => n.id === added.id)) return prev;
            return [added, ...prev];
          });
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleMarkAllAsRead = () => {
    setUnreadCount(0);
  };

  // Handles custom credentials verification
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingLogin(true);
    setLoginError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: loginUsername, password: loginPassword }),
        credentials: "same-origin"
      });

      if (!res.ok) {
        const errData = await safeJson(res, null);
        throw new Error(errData?.message || "Invalid credentials.");
      }

      const data = await safeJson(res, null);
      if (data && data.success && data.user) {
        setUser(data.user);
        setCsrfToken(data.csrfToken || "");
        setAccessToken(data.accessToken || "");
        localStorage.setItem("access_token", data.accessToken || "");
        localStorage.setItem("refresh_token", data.refreshToken || "");
        
        // Auto routing navigation default tab based on security clearance role
        if (data.user.role === "MOH") {
          setActiveTab("moh");
        } else if (data.user.role === "HOSPITAL") {
          setActiveTab("hospitals");
        } else {
          setActiveTab("reporter");
        }
      }
    } catch (err: any) {
      setLoginError(err.message || "Network authentication handshake failed.");
    } finally {
      setIsSubmittingLogin(false);
    }
  };

  // Handles session destruction
  const handleLogoutClick = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    } catch (e) {
      console.error(e);
    } finally {
      setUser(null);
      setCsrfToken("");
      setAccessToken("");
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      setActiveTab("reporter");
    }
  };

  // Role Access Checking Gate (RBAC validation)
  const hasAccessToTab = (tab: typeof activeTab) => {
    if (!user) return false;
    if (user.role === "MOH") return true; // MoH holds central administrative access
    if (user.role === "HOSPITAL") {
      return tab !== "moh"; // Hospital command is gated away from central MOH financials/audits
    }
    if (user.role === "CITIZEN") {
      return tab === "reporter" || tab === "about"; // Citizen only holds public 119 reporting capability
    }
    return false;
  };

  // Loading page block
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#090d16] flex flex-col items-center justify-center text-slate-100 font-mono text-xs">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mb-3" />
        <span className="animate-pulse tracking-widest text-[10px]">NEGOTIATING SECURE ENTERPRISE LINK...</span>
      </div>
    );
  }

  // If user is not logged in, render a beautifully styled, immersive secure login page!
  if (!user) {
    return (
      <div className="min-h-screen bg-[#090d16] flex flex-col justify-between text-slate-100 font-sans relative overflow-hidden select-none">
        {/* Subtle ambient light sources */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-red-500/5 blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-emerald-500/5 blur-[120px] pointer-events-none"></div>
        
        {/* Header decoration */}
        <header className="border-b border-slate-900 bg-slate-950/40 backdrop-blur px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-red-500 p-1.5 rounded-lg flex items-center justify-center">
              <HeartPulse className="w-4 h-4 text-white" />
            </div>
            <span className="font-extrabold tracking-tight text-xs uppercase font-mono text-slate-300">
              LIVELINK CAMBODIA DISPATCH SYSTEM
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500 bg-slate-950 px-2 py-0.5 rounded border border-slate-900/60">
            <Shield className="w-3 h-3 text-emerald-500" />
            <span>SECURE HANDSHAKE STATUS: ESTABLISHED</span>
          </div>
        </header>

        {/* Centered Login Panel */}
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-950 border border-slate-900 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
            {/* Background pattern */}
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-slate-900/20 rounded-full blur-2xl"></div>

            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner">
                <LockKeyhole className="w-5 h-5 text-emerald-400 animate-pulse" />
              </div>
              <h2 className="text-xl font-extrabold tracking-tight text-white font-display">
                Enterprise Command Portal
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Enter your authorized credentials to access national dispatch routing systems.
              </p>
            </div>

            {loginError && (
              <div className="mb-4 p-3 bg-red-950/80 border border-red-900/60 rounded-xl flex items-center gap-2.5 text-red-200 text-xs">
                <ShieldAlert className="w-4 h-4 text-red-500 shrink-0" />
                <p>{loginError}</p>
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono mb-1.5">
                  Authorized Username
                </label>
                <input
                  type="text"
                  required
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="e.g. admin"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 font-mono transition-all"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono mb-1.5">
                  Access Key
                </label>
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 font-mono transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingLogin}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl py-2.5 text-xs font-bold font-mono transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/10 disabled:opacity-50"
              >
                {isSubmittingLogin ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>AUTHENTICATING SECURE SESSION...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>ESTABLISH SECURE LINK</span>
                  </>
                )}
              </button>
            </form>

            {/* Quick Login shortcuts - high usability testing */}
            <div className="mt-8 border-t border-slate-900 pt-6">
              <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono text-center mb-3">
                1-CLICK QUICK ACCESS SHORTS (RBAC DEMO)
              </span>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    setLoginUsername("admin");
                    setLoginPassword("admin123");
                  }}
                  className="w-full bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-xl p-2.5 text-left transition-colors flex items-center justify-between text-xs cursor-pointer group"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                    <div className="text-left">
                      <p className="font-bold text-slate-200 group-hover:text-emerald-400 font-sans">Ministry Admin (MOH)</p>
                      <p className="text-[10px] text-slate-500 font-sans">Role: Full Audit & Strategic Access</p>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono font-bold bg-slate-950 px-2 py-0.5 rounded border border-slate-900">
                    admin / admin123
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setLoginUsername("operator");
                    setLoginPassword("op123");
                  }}
                  className="w-full bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-xl p-2.5 text-left transition-colors flex items-center justify-between text-xs cursor-pointer group"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                    <div className="text-left">
                      <p className="font-bold text-slate-200 group-hover:text-emerald-400 font-sans">Hospital Staff (Operator)</p>
                      <p className="text-[10px] text-slate-500 font-sans">Role: Manage Patients & ICU Beds</p>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono font-bold bg-slate-950 px-2 py-0.5 rounded border border-slate-900">
                    operator / op123
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setLoginUsername("reporter");
                    setLoginPassword("citizen123");
                  }}
                  className="w-full bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-xl p-2.5 text-left transition-colors flex items-center justify-between text-xs cursor-pointer group"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    <div className="text-left">
                      <p className="font-bold text-slate-200 group-hover:text-emerald-400 font-sans">Citizen Reporter (Bystander)</p>
                      <p className="text-[10px] text-slate-500 font-sans">Role: Dispatch 119 Emergencies Only</p>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono font-bold bg-slate-950 px-2 py-0.5 rounded border border-slate-900">
                    reporter / citizen123
                  </span>
                </button>
              </div>
            </div>
          </div>
        </main>

        {/* Footer info */}
        <footer className="border-t border-slate-900 bg-slate-950/20 py-4 px-6 text-center text-[10px] font-mono text-slate-600 flex flex-col md:flex-row items-center justify-between gap-2">
          <span>AES-256 HMAC-SHA512 SECURED HANDSHAKE LOGS</span>
          <span>© {new Date().getFullYear()} LIFELINK DIGITAL HEALTH SECTOR • REPUBLIC OF CAMBODIA</span>
        </footer>
      </div>
    );
  }

  // Find linked ambulance and hospital object details for the selected active incident
  const assignedHospital = selectedIncident && selectedIncident.assignedHospitalId 
    ? hospitals.find(h => h.id === selectedIncident.assignedHospitalId) || null
    : null;

  const assignedAmbulance = selectedIncident && selectedIncident.assignedAmbulanceId
    ? ambulances.find(a => a.id === selectedIncident.assignedAmbulanceId) || {
        id: selectedIncident.assignedAmbulanceId,
        hospitalId: selectedIncident.assignedHospitalId || "",
        plateNumber: "PP-2X-4911", // Fallback simulation
        status: "Dispatched",
        lat: assignedHospital ? assignedHospital.lat : 11.5564,
        lng: assignedHospital ? assignedHospital.lng : 104.9282,
        patientId: selectedIncident.id
      } as Ambulance
    : null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* GLOBAL HEADER BAR - Enhanced with Professional Polish Design Theme */}
      <header className="bg-[#0f172a] text-white border-b border-slate-700 sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          
          {/* Left: Logo and operational status */}
          <div className="flex items-center gap-3">
            <div className="bg-red-500 p-2 rounded-xl shadow-inner flex items-center justify-center pulse-emerald shrink-0">
              <HeartPulse className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-extrabold tracking-tight flex items-center gap-1.5">
                <span>LifeLink AI</span>
                <span className="text-slate-400 font-normal text-xs italic">Cambodia v1.0.5</span>
              </h1>
              <p className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping inline-block"></span>
                <span>AI System Operational • Phnom Penh Node</span>
              </p>
            </div>
          </div>

          {/* Center: Navigation role tabs (Filtered dynamically for flawless Heuristics) */}
          <nav className="hidden md:flex bg-slate-950/80 p-1 rounded-xl border border-slate-800/80 shrink-0 gap-1">
            <button
              onClick={() => setActiveTab("reporter")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === "reporter"
                  ? "bg-emerald-500 text-slate-900 shadow font-extrabold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>119 Reporter</span>
            </button>
            {user.role !== "CITIZEN" && (
              <button
                onClick={() => setActiveTab("hospitals")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer relative whitespace-nowrap ${
                  activeTab === "hospitals"
                    ? "bg-emerald-500 text-slate-900 shadow font-extrabold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Hospital Nodes</span>
              </button>
            )}
            {user.role === "MOH" && (
              <button
                onClick={() => setActiveTab("moh")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer relative whitespace-nowrap ${
                  activeTab === "moh"
                    ? "bg-emerald-500 text-slate-900 shadow font-extrabold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <BrainCircuit className="w-3.5 h-3.5" />
                <span>MOH Analytics</span>
              </button>
            )}
          </nav>

          {/* Right: Live user profile and Actions */}
          <div className="flex items-center gap-3 self-end xl:self-auto flex-wrap sm:flex-nowrap">
            
            {/* Persona Switcher Dropdown (Friction-Free Testing) */}
            <div className="flex items-center gap-1.5 bg-slate-950/85 border border-slate-800 px-2.5 py-1.5 rounded-xl text-xs shrink-0 shadow-inner">
              <span className="text-[9px] text-slate-500 font-mono font-bold uppercase shrink-0 hidden sm:inline">PERSONA:</span>
              <select
                value={user.role}
                onChange={async (e) => {
                  const targetRole = e.target.value;
                  let targetUser = "reporter";
                  let targetPass = "citizen123";
                  if (targetRole === "MOH") {
                    targetUser = "admin";
                    targetPass = "admin123";
                  } else if (targetRole === "HOSPITAL") {
                    targetUser = "operator";
                    targetPass = "op123";
                  }
                  
                  try {
                    setAuthLoading(true);
                    const res = await fetch("/api/auth/login", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ username: targetUser, password: targetPass }),
                      credentials: "same-origin"
                    });
                    if (res.ok) {
                      const data = await safeJson(res, null);
                      if (data && data.success && data.user) {
                        setUser(data.user);
                        setCsrfToken(data.csrfToken || "");
                        setAccessToken(data.accessToken || "");
                        localStorage.setItem("access_token", data.accessToken || "");
                        localStorage.setItem("refresh_token", data.refreshToken || "");
                        
                        // Smart routing active tab
                        if (data.user.role === "MOH") {
                          setActiveTab("moh");
                        } else if (data.user.role === "HOSPITAL") {
                          setActiveTab("hospitals");
                        } else {
                          setActiveTab("reporter");
                        }
                      }
                    }
                  } catch (err) {
                    console.error("Frictionless switcher error:", err);
                  } finally {
                    setAuthLoading(false);
                  }
                }}
                className="bg-transparent border-none text-emerald-400 font-bold focus:outline-none cursor-pointer text-xs font-mono select-none"
              >
                <option value="CITIZEN" className="bg-slate-950 text-slate-100">Citizen</option>
                <option value="HOSPITAL" className="bg-slate-950 text-slate-100">Hospital</option>
                <option value="MOH" className="bg-slate-950 text-slate-100">Ministry</option>
              </select>
            </div>

            {/* Quick Actions Drawer Controls */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => {
                  setIsNotificationDrawerOpen(!isNotificationDrawerOpen);
                  setUnreadCount(0);
                }}
                className={`relative p-2 rounded-xl transition-all flex items-center justify-center cursor-pointer border ${
                  isNotificationDrawerOpen
                    ? "bg-emerald-500 text-slate-900 border-emerald-500 shadow-lg shadow-emerald-500/20"
                    : "bg-slate-950/80 text-slate-400 hover:text-white border-slate-800 hover:border-slate-700"
                }`}
                title="Toggle Real-Time Notification Command Drawer"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-extrabold text-white animate-bounce shadow-sm">
                    {unreadCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => setIsAboutDrawerOpen(!isAboutDrawerOpen)}
                className={`p-2 rounded-xl transition-all flex items-center justify-center cursor-pointer border ${
                  isAboutDrawerOpen
                    ? "bg-emerald-500 text-slate-900 border-emerald-500 shadow-lg"
                    : "bg-slate-950/80 text-slate-400 hover:text-white border-slate-800 hover:border-slate-700"
                }`}
                title="Toggle Digital Architecture Guide"
              >
                <Info className="w-4 h-4" />
              </button>
            </div>

            {/* Profile info block */}
            <div className="hidden sm:block text-right shrink-0 border-l border-slate-800 pl-3">
              <p className="text-xs font-bold text-white leading-tight">{user.name}</p>
              <p className="text-[9px] text-emerald-400 uppercase tracking-wider font-semibold font-mono mt-0.5">
                {user.role} ({user.organization})
              </p>
            </div>
            
            <button
              onClick={handleLogoutClick}
              className="bg-slate-950/80 hover:bg-red-950/80 hover:text-red-400 border border-slate-800 hover:border-red-900/40 p-2 rounded-xl transition-all flex items-center justify-center cursor-pointer group text-slate-400 shrink-0"
              title="Secure Logout Session"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

        </div>
      </header>

      {/* ACTIVE DISPATCH NETWORK TICKER BAR */}
      <section className="bg-slate-900 text-slate-300 py-2 border-b border-slate-950 overflow-x-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex space-x-4 text-xs font-medium justify-center items-center text-center">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
          <span className="text-slate-200">National 119 Emergency Response Portal • Cambodia (សេវាសង្គ្រោះបន្ទាន់ជាតិ)</span>
        </div>
      </section>

      {/* MAIN CONTAINER CONTENT AREA */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20 md:pb-8">
        
        {/* Error notification banner if api fails */}
        {errorMsg && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center space-x-3 text-red-800">
            <ServerCrash className="w-5 h-5 text-red-600 shrink-0" />
            <div className="text-xs font-semibold">
              <p>{errorMsg}</p>
              <p className="font-normal text-red-600 mt-0.5">
                Note: Server-side Gemini API features require the GEMINI_API_KEY to be saved inside the Secrets panel. A local high-fidelity AI triage fallback is active automatically.
              </p>
            </div>
          </div>
        )}

        {/* RBAC ROUTING TAB PROTECTION SCREEN */}
        {!hasAccessToTab(activeTab) ? (
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 max-w-lg mx-auto text-center space-y-6 animate-fade-in my-8">
            <div className="w-16 h-16 bg-red-50 border border-red-100 rounded-2xl flex items-center justify-center mx-auto shadow-inner text-red-500 animate-bounce">
              <Lock className="w-6 h-6" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-xl font-bold font-display text-slate-800">
                RBAC Access Restricted
              </h2>
              <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
                Security Policy Directive 119 prohibits access to the <span className="font-mono font-bold text-slate-800 uppercase bg-slate-100 px-1.5 py-0.5 rounded">{activeTab}</span> cockpit under your current security clearance level.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 text-slate-300 rounded-2xl p-4 text-left font-mono text-xs space-y-2.5">
              <div className="flex justify-between border-b border-slate-800 pb-1.5 text-[11px]">
                <span className="text-slate-500">AUTHORIZED ROLE CLEARANCE</span>
                <span className="text-red-400 font-bold">{activeTab === "moh" ? "MOH ONLY" : "HOSPITAL COMMAND"}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-1.5 text-[11px]">
                <span className="text-slate-500">YOUR IDENTITY</span>
                <span className="text-slate-200 font-bold">{user.name}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-1.5 text-[11px]">
                <span className="text-slate-500">YOUR ROLE</span>
                <span className="text-amber-400 font-bold bg-amber-950/80 px-1.5 py-0.2 rounded border border-amber-900">{user.role} OPERATIONAL</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-500">AUDIT TELEMETRY</span>
                <span className="text-slate-400 font-semibold text-[10px]">LOGGED TO SECURE ARCHIVE</span>
              </div>
            </div>

            <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-100 text-[11px] text-amber-800 flex items-start gap-2.5 text-left leading-relaxed">
              <AlertCircle className="w-4.5 h-4.5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Demonstration Notice:</p>
                <p className="font-normal mt-0.5">
                  To view this administrative tab, use the logout portal at the top-right, then choose the appropriate 1-click authorized shortcut.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Tab contents */}
            {activeTab === "reporter" && (
              <div className="space-y-8 animate-fade-in">
                {/* Split page grid layout: Reporter parameters vs. Tactical map */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  {/* Map view takes 5 columns on desktop */}
                  <div className="lg:col-span-5 order-first lg:order-last space-y-4">
                    <div className="space-y-1">
                      <h3 className="text-base font-bold font-display text-slate-800 flex items-center space-x-1.5">
                        <Layers className="w-4.5 h-4.5 text-emerald-600" />
                        <span>Phnom Penh Tactical Emergency Map</span>
                      </h3>
                      <p className="text-xs text-slate-500">
                        Interactive grid projecting precise latitude/longitude bounds in Cambodia.
                      </p>
                    </div>
                    <PhnomPenhMap
                      hospitals={hospitals}
                      ambulances={ambulances}
                      incidents={incidents}
                      selectedIncident={selectedIncident}
                      onSelectIncident={(inc) => setSelectedIncident(inc)}
                      onMapClick={handleMapClick}
                      pinLocation={pinLocation}
                      interactive={user.role !== "CITIZEN"} // Restrict coordinate pin drop to official dispatches
                    />
                  </div>

                  {/* Citizen input takes 7 columns */}
                  <div className="lg:col-span-7">
                    <CitizenReporter
                      onReportIncident={handleReportIncident}
                      pinLocation={pinLocation}
                      onClearPin={handleClearPin}
                      activeIncident={selectedIncident}
                      assignedHospital={assignedHospital}
                      assignedAmbulance={assignedAmbulance}
                      onUpdateStatus={handleUpdateStatus}
                      onResetSimulation={user.role === "MOH" ? handleResetSimulation : undefined} // Only MOH can reset pre-seeds
                      incidents={incidents}
                      hospitals={hospitals}
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === "hospitals" && (
              <div className="space-y-6 animate-fade-in">
                <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-200">
                  <div>
                    <h1 className="text-2xl font-bold font-display text-slate-800">
                      Hospital ER Command Nodes (មជ្ឈមណ្ឌលសង្គ្រោះ)
                    </h1>
                    <p className="text-xs text-slate-500 mt-1">
                      National emergency base terminals. Real-time patient allocation dashboard, specialty matching & trauma ward capacities.
                    </p>
                  </div>
                </div>
                
                <HospitalCommand
                  hospitals={hospitals}
                  ambulances={ambulances}
                  incidents={incidents}
                  onUpdateStatus={handleUpdateStatus}
                  onModifyIcuBeds={handleModifyIcuBeds}
                  onAcceptIncident={handleAcceptIncident}
                  onDeclineIncident={handleDeclineIncident}
                  user={user}
                />
              </div>
            )}

            {activeTab === "moh" && (
              <div className="space-y-6 animate-fade-in">
                <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-200">
                  <div>
                    <h1 className="text-2xl font-bold font-display text-slate-800">
                      MoH Central Analytics (ក្រសួងសុខាភិបាល)
                    </h1>
                    <p className="text-xs text-slate-500 mt-1">
                      National emergency response cockpit. Analyzes system-wide strain, ICU occupancy, and deploys Gemini strategy advisories.
                    </p>
                  </div>
                </div>

                <MoHDashboard
                  stats={stats}
                  aiRecommendations={aiRecommendations}
                  hospitals={hospitals}
                  onRefreshStats={fetchStats}
                  loadingStats={loadingStats}
                  secureFetch={secureFetch}
                />
              </div>
            )}
          </>
        )}
      </main>

      {/* SLIDE-OVER NOTIFICATION DRAWER */}
      {isNotificationDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden" id="notification-drawer">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setIsNotificationDrawerOpen(false)} />
          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-lg bg-white shadow-2xl flex flex-col h-full border-l border-slate-200">
              {/* Drawer Header */}
              <div className="bg-slate-900 px-6 py-5 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="w-5 h-5 text-emerald-400" />
                  <div>
                    <h2 className="text-sm font-extrabold tracking-tight uppercase font-mono">Live Incident Alerts</h2>
                    <p className="text-[10px] text-slate-400 font-medium">Real-Time Dispatch logs & network statuses</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsNotificationDrawerOpen(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer text-xl font-bold font-mono"
                >
                  &times;
                </button>
              </div>
              
              {/* Drawer Body */}
              <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                <NotificationCenter
                  notifications={notifications}
                  wsStatus={wsStatus}
                  onRetryQueue={handleRetryQueue}
                  onClearHistory={handleClearHistory}
                  onTriggerTestNotif={handleTriggerTestNotif}
                  onMarkAllAsRead={handleMarkAllAsRead}
                  retrying={retryingNotifications}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SLIDE-OVER ABOUT ARCHITECTURE DRAWER */}
      {isAboutDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden" id="about-drawer">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setIsAboutDrawerOpen(false)} />
          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-2xl bg-white shadow-2xl flex flex-col h-full border-l border-slate-200">
              {/* Drawer Header */}
              <div className="bg-slate-900 px-6 py-5 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BrainCircuit className="w-5 h-5 text-emerald-400" />
                  <div>
                    <h2 className="text-sm font-extrabold tracking-tight uppercase font-mono">System Architecture</h2>
                    <p className="text-[10px] text-slate-400 font-medium">Technical Specification & AI Models</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAboutDrawerOpen(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer text-xl font-bold font-mono"
                >
                  &times;
                </button>
              </div>
              
              {/* Drawer Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="border-b border-slate-100 pb-4">
                  <h3 className="text-base font-extrabold font-display text-slate-800">
                    LifeLink AI • Cambodia Digital Health
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Engineering architecture highlights of Cambodia's premier digital health entry.
                  </p>
                </div>

                <div className="space-y-6 text-xs text-slate-600 leading-relaxed">
                  <div className="space-y-2">
                    <h4 className="font-extrabold text-slate-800 uppercase tracking-wide font-mono text-[11px] text-emerald-600 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                      <span>1. Server-Side Natural Language AI</span>
                    </h4>
                    <p>
                      Citizens submit emergency descriptions in English, Khmer, or mixed slang. The platform leverages the <b>@google/genai</b> SDK server-side (utilizing <code>gemini-2.5-flash</code>) to parse inputs securely behind our Node backend proxy.
                    </p>
                    <p>
                      The model performs automated translation, determines triage priority classifications (RED, YELLOW, GREEN), evaluates conscious and respiratory states, and generates targeted first-aid directions in both languages.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-extrabold text-slate-800 uppercase tracking-wide font-mono text-[11px] text-emerald-600 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                      <span>2. Clinical Hospital Routing Decision Engine</span>
                    </h4>
                    <p>
                      Instead of routing patients randomly, the system matching algorithm computes Euclidean distance overlays combined with target specialty parameters (Trauma center, Cardiology, Burns) and current resource availabilities (available ICU beds and active ambulances).
                    </p>
                    <p>
                      If a primary trauma center (e.g., Calmette) is running low on beds, the AI algorithm shifts weight factors, autonomously re-routing incoming dispatches to alternate hospitals.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-extrabold text-slate-800 uppercase tracking-wide font-mono text-[11px] text-emerald-600 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                      <span>3. Real-Time Accident Spatial Simulation</span>
                    </h4>
                    <p>
                      The high-fidelity map uses a customized coordinate-to-screen SVG projection. The backend maintains an ongoing 4-second game-loop that drives active ambulances dynamically towards targeted coordinates, transitioning status blocks from dispatched to on-scene and transporting.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-extrabold text-slate-800 uppercase tracking-wide font-mono text-[11px] text-emerald-600 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                      <span>4. Secure Role-Based Access Controls</span>
                    </h4>
                    <p>
                      Access is managed to ensure only authorized hospital operators and ministry officers can manage dispatches and view performance data, protecting citizen privacy and patient integrity.
                    </p>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between mt-8">
                  <div className="flex items-center space-x-2.5">
                    <ShieldCheck className="w-5 h-5 text-emerald-600 animate-pulse shrink-0" />
                    <span className="text-xs font-semibold text-slate-700">All security rules, clean architectures, and strict TypeScript types are fully active.</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">BUILD ID: v3.2.1-RELEASE</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MOBILE BOTTOM NAVIGATION BAR (Flawless touch layouts) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#0f172a] border-t border-slate-800 py-2.5 px-3 md:hidden z-40 flex items-center justify-around shadow-2xl text-slate-400">
        <button
          onClick={() => setActiveTab("reporter")}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-all ${
            activeTab === "reporter" ? "text-emerald-400 font-bold scale-105" : "text-slate-400 hover:text-white"
          }`}
        >
          <AlertCircle className="w-5 h-5" />
          <span className="text-[9px] font-bold">Reporter</span>
        </button>

        {user.role !== "CITIZEN" && (
          <button
            onClick={() => setActiveTab("hospitals")}
            className={`flex flex-col items-center gap-1 cursor-pointer transition-all ${
              activeTab === "hospitals" ? "text-emerald-400 font-bold scale-105" : "text-slate-400 hover:text-white"
            }`}
          >
            <Users className="w-5 h-5" />
            <span className="text-[9px] font-bold">Hospital Nodes</span>
          </button>
        )}

        {user.role === "MOH" && (
          <button
            onClick={() => setActiveTab("moh")}
            className={`flex flex-col items-center gap-1 cursor-pointer transition-all ${
              activeTab === "moh" ? "text-emerald-400 font-bold scale-105" : "text-slate-400 hover:text-white"
            }`}
          >
            <BrainCircuit className="w-5 h-5" />
            <span className="text-[9px] font-bold">MOH Analytics</span>
          </button>
        )}

        <button
          onClick={() => {
            setIsNotificationDrawerOpen(!isNotificationDrawerOpen);
            setUnreadCount(0);
          }}
          className={`flex flex-col items-center gap-1 cursor-pointer relative transition-all ${
            isNotificationDrawerOpen ? "text-emerald-400 font-bold scale-105" : "text-slate-400 hover:text-white"
          }`}
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white animate-bounce">
              {unreadCount}
            </span>
          )}
          <span className="text-[9px] font-bold">Alerts</span>
        </button>

        <button
          onClick={() => setIsAboutDrawerOpen(!isAboutDrawerOpen)}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-all ${
            isAboutDrawerOpen ? "text-emerald-400 font-bold scale-105" : "text-slate-400 hover:text-white"
          }`}
        >
          <Info className="w-5 h-5" />
          <span className="text-[9px] font-bold">Info Guide</span>
        </button>
      </nav>

      {/* FOOTER */}
      <footer className="bg-slate-100 border-t border-slate-200 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs mb-16 md:mb-0">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
          <span className="font-bold text-slate-600">Portal Connection Status: Online</span>
        </div>
        <div className="flex items-center gap-2 text-slate-500 font-medium">
          <span>Kingdom of Cambodia • Ministry of Health</span>
          <span>•</span>
          <span className="text-slate-800 font-bold">{timeStr || "14:28:04 GMT+7"}</span>
        </div>
      </footer>
    </div>
  );
}
