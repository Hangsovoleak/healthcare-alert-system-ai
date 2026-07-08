import React, { useState } from "react";
import { NotificationItem } from "../types";
import { 
  Bell, 
  Wifi, 
  WifiOff, 
  Mail, 
  MessageSquare, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  Trash2, 
  Send, 
  Building, 
  ShieldAlert, 
  Lock, 
  Smartphone,
  Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface NotificationCenterProps {
  notifications: NotificationItem[];
  wsStatus: "connected" | "disconnected" | "connecting";
  onRetryQueue: () => Promise<void>;
  onClearHistory: () => Promise<void>;
  onTriggerTestNotif: (data: { type: string; recipient: string; title: string; message: string }) => Promise<void>;
  onMarkAllAsRead: () => void;
  retrying: boolean;
}

export function NotificationCenter({
  notifications,
  wsStatus,
  onRetryQueue,
  onClearHistory,
  onTriggerTestNotif,
  onMarkAllAsRead,
  retrying
}: NotificationCenterProps) {
  const [activeFilter, setActiveFilter] = useState<string>("ALL");
  const [pushPermission, setPushPermission] = useState<"default" | "granted" | "denied">("default");
  
  // Test builder state
  const [testType, setTestType] = useState<string>("SMS");
  const [testRecipient, setTestRecipient] = useState<string>("");
  const [testTitle, setTestTitle] = useState<string>("");
  const [testMessage, setTestMessage] = useState<string>("");
  const [sendingTest, setSendingTest] = useState(false);

  // Filter calculations
  const filteredNotifications = notifications.filter(n => {
    if (activeFilter === "ALL") return true;
    if (activeFilter === "RETRY_QUEUE") return n.status === "Failed" || n.status === "Retrying";
    return n.type === activeFilter;
  });

  const retryQueueItems = notifications.filter(n => n.status === "Failed" || n.status === "Retrying");
  const failedCount = notifications.filter(n => n.status === "Failed").length;
  const retryingCount = notifications.filter(n => n.status === "Retrying").length;

  const handleRequestPushPermission = () => {
    setPushPermission("granted");
    // Play a gentle notification beep using the standard Web Audio API
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        const ctx = new AudioContextClass();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, ctx.currentTime); // high-pitched gentle beep
        gain.gain.setValueAtTime(0.02, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      }
    } catch (e) {
      console.warn("Web Audio API notification beep blocked or not supported:", e);
    }
  };

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendingTest(true);
    
    // Auto-fill defaults if left empty
    const type = testType;
    const recipient = testRecipient || (
      type === "SMS" ? "+855 12 777 888" :
      type === "EMAIL" ? "physician.oncall@calmette.kh" :
      type === "HOSPITAL_ALERT" ? "Calmette ER Desk" :
      type === "MINISTRY_ESCALATION" ? "MOH Health Security Board" :
      "System Dispatch Console"
    );
    const title = testTitle || `${type} Diagnostics Alert`;
    const message = testMessage || `Simulated ${type} notification trigger for national medical dispatcher telemetry. Status code 200 OK.`;

    await onTriggerTestNotif({ type, recipient, title, message });
    
    // Clear inputs
    setTestRecipient("");
    setTestTitle("");
    setTestMessage("");
    setSendingTest(false);
  };

  const getChannelIcon = (type: string, size = "w-4 h-4") => {
    switch (type) {
      case "WEBSOCKET":
        return <Wifi className={`${size} text-blue-500`} />;
      case "PUSH":
        return <Bell className={`${size} text-purple-500`} />;
      case "EMAIL":
        return <Mail className={`${size} text-emerald-500`} />;
      case "SMS":
        return <MessageSquare className={`${size} text-indigo-500`} />;
      case "HOSPITAL_ALERT":
        return <Building className={`${size} text-rose-500`} />;
      case "MINISTRY_ESCALATION":
        return <ShieldAlert className={`${size} text-amber-500`} />;
      default:
        return <Bell className={`${size} text-slate-500`} />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Delivered":
      case "Sent":
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle className="w-3 h-3 text-emerald-500" />
            <span>Delivered</span>
          </span>
        );
      case "Failed":
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200 animate-pulse">
            <XCircle className="w-3 h-3 text-red-500" />
            <span>Failed</span>
          </span>
        );
      case "Retrying":
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <RefreshCw className="w-3 h-3 text-amber-500 animate-spin" />
            <span>Retrying</span>
          </span>
        );
      case "Queued":
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <RefreshCw className="w-3 h-3 text-blue-400" />
            <span>Queued</span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full space-y-6" id="notif-center-root">
      {/* AUDIT LOG & HISTORY */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden" id="notification-audit-log">
        
        {/* Filtering bar */}
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
          <div>
            <h2 className="text-lg font-bold font-display text-slate-800 flex items-center gap-2">
              <Bell className="w-5 h-5 text-emerald-500" />
              <span>Unified Dispatch Alerts & Notifications</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Real-time log of multi-channel distress signals and national dispatch alerts.</p>
          </div>
          
          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={onMarkAllAsRead}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center space-x-1.5"
            >
              <span>Mark All Read</span>
            </button>
            <button
              onClick={onClearHistory}
              disabled={notifications.length === 0}
              className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-xl transition-all disabled:opacity-30 cursor-pointer"
              title="Clear all history"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filters Pills */}
        <div className="px-6 py-3 border-b border-slate-100 flex space-x-1.5 overflow-x-auto whitespace-nowrap">
          {[
            { id: "ALL", label: "All Logs" },
            { id: "SMS", label: "SMS" },
            { id: "EMAIL", label: "Email" },
            { id: "PUSH", label: "Push Alert" },
            { id: "HOSPITAL_ALERT", label: "Hospital Alert" },
            { id: "MINISTRY_ESCALATION", label: "MOH Escalations" },
            { id: "WEBSOCKET", label: "WebSockets" }
          ].map((f) => {
            const count = f.id === "ALL" ? notifications.length : notifications.filter(n => n.type === f.id).length;
            return (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer border ${
                  activeFilter === f.id
                    ? "bg-slate-900 text-white border-slate-900"
                    : "text-slate-600 bg-white hover:bg-slate-50 border-slate-200"
                }`}
              >
                <span>{f.label}</span>
                {count > 0 && (
                  <span className={`text-[10px] px-1.5 rounded-full font-bold ${
                    activeFilter === f.id 
                      ? "bg-slate-700 text-white" 
                      : "bg-slate-100 text-slate-500"
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Chronological Scroll List */}
        <div className="divide-y divide-slate-100 max-h-[520px] overflow-y-auto" id="notification-audit-trail-scroller">
          <AnimatePresence initial={false}>
            {filteredNotifications.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <Bell className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-bold font-display text-slate-600">No Notifications Logged</p>
                <p className="text-xs text-slate-400 mt-1">Real-time alerts will appear here as incidents are reported and dispatched.</p>
              </div>
            ) : (
              filteredNotifications.map((notif) => (
                <motion.div
                  key={notif.id}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="p-5 transition-colors relative hover:bg-slate-50/50"
                >
                  <div className="flex items-start justify-between gap-4">
                    
                    {/* Left: icon & details */}
                    <div className="flex items-start space-x-3.5">
                      <div className="p-2.5 bg-slate-100 rounded-xl shrink-0 border border-slate-200 mt-0.5">
                        {getChannelIcon(notif.type, "w-4 h-4")}
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-xs font-extrabold text-slate-800">{notif.title}</h4>
                          <span className="text-[10px] font-mono text-slate-400 px-1.5 py-0.5 bg-slate-100 rounded">
                            {notif.type.replace("_", " ")}
                          </span>
                          {notif.incidentId && (
                            <span className="text-[10px] font-mono font-bold text-slate-500">
                              Case: {notif.incidentId}
                            </span>
                          )}
                        </div>
                        
                        <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">{notif.message}</p>
                      </div>
                    </div>

                    {/* Right: status & time */}
                    <div className="text-right shrink-0 space-y-1.5">
                      <p className="text-[10px] font-mono text-slate-400">
                        {new Date(notif.timestamp).toLocaleTimeString("en-US", { hour12: false })}
                      </p>
                      <div className="flex flex-col items-end gap-1">
                        {getStatusBadge(notif.status)}
                      </div>
                    </div>

                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>

        {/* Footer stats */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center text-[10px] font-mono text-slate-500">
          <span>SHOWING {filteredNotifications.length} of {notifications.length} DISPATCH ALERTS</span>
          <div className="flex items-center space-x-3">
            <span className="flex items-center space-x-1">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
              <span>ACTIVE DISPATCHES: {notifications.length}</span>
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
