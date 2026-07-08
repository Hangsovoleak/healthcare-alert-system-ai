import React, { useState } from "react";
import { Incident, Hospital, Ambulance } from "../types";
import { 
  AlertCircle, 
  User, 
  Phone, 
  MapPin, 
  Send, 
  RotateCcw, 
  Brain, 
  CheckCircle2, 
  ShieldCheck, 
  Clock, 
  HeartHandshake, 
  Mic, 
  Camera, 
  Activity, 
  Check, 
  ChevronLeft,
  Hospital as HospitalIcon,
  ListOrdered,
  UserCheck,
  ShieldAlert,
  Compass,
  History as HistoryIcon
} from "lucide-react";

interface CitizenReporterProps {
  onReportIncident: (data: {
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
  }) => Promise<Incident>;
  pinLocation: { lat: number; lng: number; name: string } | null;
  onClearPin: () => void;
  activeIncident: Incident | null;
  assignedHospital: Hospital | null;
  assignedAmbulance: Ambulance | null;
  onUpdateStatus: (id: string, status: string, note?: string) => void;
  onResetSimulation?: () => void;
  incidents: Incident[];
  hospitals: Hospital[];
}

const PRESETS = [
  {
    title: "Russian Blvd Car Crash (គ្រោះថ្នាក់ចរាចរណ៍ មហាវិថីសហព័ន្ធរុស្ស៊ី)",
    description: "មានគ្រោះថ្នាក់ចរាចរណ៍ឡានបុកម៉ូតូនៅជិតសាកលវិទ្យាល័យភូមិន្ទភ្នំពេញ។ ជនរងគ្រោះម្នាក់សន្លប់បាត់ស្មារតី និងហូរឈាមក្បាលខ្លាំង។ (Car crash hit a moto near RUPP. One victim is unconscious and bleeding heavily from the head.)",
    locationName: "Russian Federation Blvd, near RUPP",
    lat: 11.5682,
    lng: 104.8912,
  },
  {
    title: "Elderly Stroke Alert near Central Market (សង្ស័យគាំងបេះដូង ជិតផ្សារធំថ្មី)",
    description: "លោកតាអាយុ ៧៥ឆ្នាំ ស្រាប់តែត្អូញថប់ទ្រូងខ្លាំង ដកដង្ហើមមិនចង់ចេញ ហើយខ្សោយពាក់កណ្តាលខ្លួន ជិតផ្សារធំថ្មី។ (75yo grandfather suddenly complains of chest pain, shortness of breath, and hemiparesis near Central Market.)",
    locationName: "Street 126, near Central Market",
    lat: 11.5698,
    lng: 104.9214,
  },
  {
    title: "Child Arm Fracture near Tuol Sleng (ក្មេងបាក់ដៃ ជិតទួលស្លែង)",
    description: "កូនប្រុសខ្ញុំអាយុ ៨ឆ្នាំ បានដួលពីលើដើមឈើ បាក់ដៃស្តាំ ឆ្អឹងលេចចេញក្រៅបន្តិច និងស្រែកយំខ្លាំងណាស់ ជិតទួលស្លែង។ (My 8-year-old son fell from a tree, fractured his right arm with slight bone protrusion, crying in severe pain near Tuol Sleng.)",
    locationName: "Street 320, near Tuol Sleng",
    lat: 11.5488,
    lng: 104.9165,
  }
];

export function CitizenReporter({
  onReportIncident,
  pinLocation,
  onClearPin,
  activeIncident,
  assignedHospital,
  assignedAmbulance,
  onUpdateStatus,
  onResetSimulation,
  incidents,
  hospitals
}: CitizenReporterProps) {
  const [lang, setLang] = useState<"en" | "kh">("kh");
  const [activeTab, setActiveTab] = useState<"report" | "hospitals" | "history" | "profile" | "tracker">("report");
  const [viewMode, setViewMode] = useState<"dashboard" | "reporting">("dashboard");

  // Form states
  const [name, setName] = useState("Meas Sophea");
  const [phone, setPhone] = useState("+855 12 888 999");
  const [description, setDescription] = useState("");
  const [locationName, setLocationName] = useState("");
  const [loading, setLoading] = useState(false);
  const [simulatedVoice, setSimulatedVoice] = useState(false);
  const [voiceText, setVoiceText] = useState("");

  // Multimodal states
  const [image, setImage] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string | null>(null);
  const [audio, setAudio] = useState<string | null>(null);
  const [audioMime, setAudioMime] = useState<string | null>(null);

  // Streaming status co-pilot
  const [showAdvancedDemo, setShowAdvancedDemo] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamChunks, setStreamChunks] = useState("");

  // Translation mapping
  const t = {
    kh: {
      welcome: "សង្គ្រោះបន្ទាន់ ១១៩",
      tagline: "ប្រព័ន្ធរាយការណ៍អាសន្នរហ័ស ភ្នំពេញ",
      reportTab: "រាយការណ៍",
      hospTab: "មន្ទីរពេទ្យជិតបំផុត",
      historyTab: "ប្រវត្តិរាយការណ៍",
      profileTab: "ព័ត៌មានផ្ទាល់ខ្លួន",
      trackerTab: "តាមដានសកម្ម",
      
      reportBtn: "រាយការណ៍គ្រោះថ្នាក់បន្ទាន់ឥឡូវនេះ",
      reportSub: "ឥតគិតថ្លៃ • ចាប់យកទីតាំង GPS • ជំនួយភ្លាមៗ ២៤ម៉ោង",
      nearbyHosp: "មន្ទីរពេទ្យសង្គ្រោះនៅជិតអ្នក",
      bedsFree: "គ្រែសង្គ្រោះ ICU ទំនេរ",
      ambFree: "ឡានពេទ្យបង្ការទំនេរ",
      noActive: "គ្មានករណីអាសន្នសកម្មទេ",
      allClear: "ស្ថានភាពបច្ចុប្បន្ន៖ មានសុវត្ថិភាព",
      historyTitle: "ប្រវត្តិនៃការរាយការណ៍របស់អ្នក",
      landmarkLabel: "ទីតាំង ឬចំណុចសម្គាល់ (ច្បាស់លាស់)",
      landmarkPlaceholder: "ឧទាហរណ៍៖ កែងស្តុបម៉ៅសេទុង ទល់មុខធនាគារ ABA",
      mediaLabel: "ឯកសារភ្ជាប់ជាជំនួយ (រូបថត ឬសំឡេង)",
      simPhoto: "ថតរូបភាពគ្រោះថ្នាក់",
      simVoice: "និយាយជាមួយទូរស័ព្ទ ១១៩ AI",
      descLabel: "ពិពណ៌នាអំពីគ្រោះថ្នាក់",
      descPlaceholder: "ឧទាហរណ៍៖ មានម៉ូតូបុកគ្នាសន្លប់មនុស្សម្នាក់ ហូរឈាមក្បាល...",
      submitBtn: "បញ្ជូនសេចក្តីរាយការណ៍បន្ទាន់",
      submitting: "កំពុងវិភាគកម្រិតសង្គ្រោះបន្ទាន់...",
      gpsSecured: "ទីតាំង GPS ត្រូវបានចាប់យក",
      defaultLoc: "កូអរដោនេភ្នំពេញកណ្តាល",
      changeLoc: "ចុចលើផែនទីដើម្បីប្តូរទីតាំង",
      backBtn: "ត្រឡប់ក្រោយ",
      voiceSimulating: "កំពុងបកប្រែសំឡេង ១១៩ ស្វ័យប្រវត្ត...",
      activeDispatch: "ដំណើរការបញ្ជូនឡានសង្គ្រោះបន្ទាន់",
      triageLevel: "កម្រិតសង្គ្រោះ Triage",
      priorityScore: "ពិន្ទុអាទិភាព",
      status: "ស្ថានភាពបច្ចុប្បន្ន",
      plateNumber: "ផ្លាកលេខឡានពេទ្យ",
      baseHosp: "មន្ទីរពេទ្យសង្គ្រោះ",
      recommendedHosp: "មន្ទីរពេទ្យដែលបានណែនាំដោយ AI",
      travelTime: "រយៈពេលធ្វើដំណើរប្រហាក់ប្រហែល",
      icuBeds: "គ្រែ ICU ទំនេរ",
      aiRationale: "ហេតុផលជ្រើសរើសដោយ AI",
      firstAidTitle: "ការណែនាំសង្គ្រោះបឋមបន្ទាន់",
      callDispatcher: "ហៅទៅកាន់លេខ ១១៩",
      callAmbulance: "ហៅទៅ Paramedic ផ្ទាល់",
      optional: "មិនបង្ខំ",
      reporterName: "ឈ្មោះអ្នករាយការណ៍",
      reporterPhone: "លេខទូរស័ព្ទអ្នករាយការណ៍",
      presetHeader: "គំរូគ្រោះថ្នាក់រហ័ស (ចុចដើម្បីបំពេញស្វ័យប្រវត្ត)",
      historyPlaceholder: "គ្មានប្រវត្តិរាយការណ៍នៅក្នុងប្រព័ន្ធនៅឡើយទេ",
      profileDetails: "ព័ត៌មានអត្តសញ្ញាណអ្នកប្រើប្រាស់",
      emergencyContacts: "លេខទូរស័ព្ទសង្គ្រោះបន្ទាន់ជាតិ",
      simControls: "ផ្ទាំងគ្រប់គ្រងការសាកល្បងគ្រោះថ្នាក់ (សម្រាប់គណៈកម្មការ)",
      resetSys: "កំណត់ប្រព័ន្ធឡើងវិញ"
    },
    en: {
      welcome: "119 Emergency Response",
      tagline: "Rapid Emergency Medical Portal, Phnom Penh",
      reportTab: "Report",
      hospTab: "Nearby Hospitals",
      historyTab: "My Reports",
      profileTab: "My Profile",
      trackerTab: "Live Tracker",
      
      reportBtn: "REPORT MEDICAL EMERGENCY NOW",
      reportSub: "Free Call • Auto GPS Capturing • 24/7 Rapid Help",
      nearbyHosp: "Closest Emergency Facilities",
      bedsFree: "ICU Beds Available",
      ambFree: "Ambulances Ready",
      noActive: "No Active Emergency Reported",
      allClear: "Current Status: Secure & Clear",
      historyTitle: "Emergency History Log",
      landmarkLabel: "Landmark or Street Address",
      landmarkPlaceholder: "e.g., Corner of Mao Tse Toung Blvd, front of ABA Bank",
      mediaLabel: "Supporting Media Attachments (Photo/Voice)",
      simPhoto: "Simulate Photo Capture",
      simVoice: "Simulate 119 AI Voice Call",
      descLabel: "Brief Scenario Description",
      descPlaceholder: "e.g., Moto collision, one rider fell hitting head, bleeding heavily...",
      submitBtn: "SUBMIT EMERGENCY NOW",
      submitting: "Analyzing Triage Priorities...",
      gpsSecured: "GPS Location Captured Successfully",
      defaultLoc: "Default Phnom Penh Central Coordinates",
      changeLoc: "Click map to pinpoint site",
      backBtn: "Go Back",
      voiceSimulating: "Transcribing 119 voice trunk...",
      activeDispatch: "Active Emergency Dispatch Tracking",
      triageLevel: "Triage Classification",
      priorityScore: "Priority Score",
      status: "Current Status",
      plateNumber: "Ambulance Plate",
      baseHosp: "Base Hospital",
      recommendedHosp: "AI Recommended Facility Matched",
      travelTime: "Estimated Travel Time",
      icuBeds: "ICU Beds Free",
      aiRationale: "AI Routing Rationale",
      firstAidTitle: "Immediate AI First-Aid Instructions",
      callDispatcher: "Call Dispatcher (119)",
      callAmbulance: "Call Paramedics",
      optional: "Optional",
      reporterName: "Reporter Name",
      reporterPhone: "Reporter Phone Number",
      presetHeader: "Quick Emergency Presets (One-tap fill)",
      historyPlaceholder: "No reports captured in this session yet",
      profileDetails: "User Profile Identification",
      emergencyContacts: "National Emergency Contacts",
      simControls: "Paramedic Simulation Controls (Evaluation Deck)",
      resetSys: "Reset Factory Simulation"
    }
  };

  const activeT = t[lang];

  // Auto route tab to tracker if a new active incident begins
  React.useEffect(() => {
    if (activeIncident) {
      setActiveTab("tracker");
    } else {
      setActiveTab("report");
    }
  }, [activeIncident]);

  const handleApplyPreset = (preset: typeof PRESETS[0]) => {
    setDescription(preset.description);
    setLocationName(preset.locationName);
    if (pinLocation) {
      onClearPin();
    }
    setViewMode("reporting");
  };

  const handleSimulateImage = () => {
    const sampleImage = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAABmJLR0QA/wD/AP+gvaeTAAAAI0lEQVR42u3BAQ0AAADCoPdPbQ8HFAAAAAAAAAAAAAAAAAAAvBgp9AABMhHmcwAAAABJRU5ErkJggg==";
    setImage(sampleImage);
    setImageMime("image/png");
  };

  const handleSimulateAudio = () => {
    const sampleAudio = "data:audio/wav;base64,UklGRigAAABXQVZFlZmZpZmZpZmZpZmZpZmZpZmZpZmZpZmZpZmZpZmZpZmZpZmZp";
    setAudio(sampleAudio);
    setAudioMime("audio/wav");
  };

  const handleSimulateVoiceCall = () => {
    setSimulatedVoice(true);
    setVoiceText("Connecting to 119 Khmer-English Voice Assistant...");
    
    setTimeout(() => {
      setVoiceText(`[Caller translated]: "ជួយផង! មានគ្រោះថ្នាក់ចរាចរណ៍ឡានបុកម៉ូតូនៅជិតសាកលវិទ្យាល័យភូមិន្ទភ្នំពេញ។ ជនរងគ្រោះម្នាក់សន្លប់!"`);
      setDescription("មានគ្រោះថ្នាក់ចរាចរណ៍ឡានបុកម៉ូតូនៅជិតសាកលវិទ្យាល័យភូមិន្ទភ្នំពេញ។ ជនរងគ្រោះម្នាក់សន្លប់បាត់ស្មារតី និងហូរឈាមក្បាលខ្លាំង។ (Car crash hit a moto near RUPP. One victim is unconscious and bleeding heavily from the head.)");
      setLocationName("Russian Federation Blvd, near RUPP, Phnom Penh");
    }, 1800);

    setTimeout(() => {
      setSimulatedVoice(false);
    }, 4000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    setLoading(true);
    setIsStreaming(true);
    setStreamChunks("");

    const finalLat = pinLocation ? pinLocation.lat : 11.5564;
    const finalLng = pinLocation ? pinLocation.lng : 104.9282;
    const finalLocName = locationName || (pinLocation ? pinLocation.name : "Phnom Penh Central Corridor");

    try {
      const streamRes = await fetch("/api/incidents/stream-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, locationName: finalLocName }),
      });

      if (streamRes.ok && streamRes.body) {
        const reader = streamRes.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const dataText = line.slice(6).trim();
              if (dataText === "[DONE]") break;
              try {
                const parsed = JSON.parse(dataText);
                if (parsed.chunk) {
                  setStreamChunks(prev => prev + parsed.chunk);
                }
              } catch (err) {}
            }
          }
        }
      }
    } catch (streamErr) {
      console.warn("SSE fallback", streamErr);
    } finally {
      setIsStreaming(false);
    }

    try {
      await onReportIncident({
        reporterName: name || "Anonymous",
        reporterPhone: phone || "119",
        description,
        locationName: finalLocName,
        lat: finalLat,
        lng: finalLng,
        image: image || undefined,
        imageMime: imageMime || undefined,
        audio: audio || undefined,
        audioMime: audioMime || undefined,
      });

      // Clear local state
      setDescription("");
      setLocationName("");
      setImage(null);
      setImageMime(null);
      setAudio(null);
      setAudioMime(null);
      onClearPin();
      setViewMode("dashboard");
      setActiveTab("tracker");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6" id="citizen-reporter-root">
      {/* 1. TOP HEADER BRANDING & LANGUAGE PREFERENCE */}
      <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <span className="p-1.5 bg-red-600 text-white rounded-xl inline-flex animate-pulse">
              <ShieldAlert className="w-5 h-5" />
            </span>
            <span className="font-display font-black tracking-tight">{activeT.welcome}</span>
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">{activeT.tagline}</p>
        </div>

        {/* High-Contrast Toggle */}
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setLang("kh")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              lang === "kh" ? "bg-white text-slate-900 shadow font-black" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            ភាសាខ្មែរ
          </button>
          <button
            type="button"
            onClick={() => setLang("en")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              lang === "en" ? "bg-white text-slate-900 shadow font-black" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            English
          </button>
        </div>
      </div>

      {/* 2. TABBED EXPERIENCE: SUB-TABS (Reduced Complexity, 44px touch targets) */}
      <div className="grid grid-cols-4 sm:grid-cols-5 gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
        <button
          onClick={() => { setActiveTab("report"); setViewMode("dashboard"); }}
          className={`py-2 px-1 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer truncate ${
            activeTab === "report" ? "bg-red-600 text-white shadow-sm font-black" : "text-slate-600 hover:text-slate-900"
          }`}
          style={{ minHeight: "44px" }}
        >
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>{activeT.reportTab}</span>
        </button>

        {activeIncident && (
          <button
            onClick={() => setActiveTab("tracker")}
            className={`py-2 px-1 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer truncate relative ${
              activeTab === "tracker" ? "bg-amber-500 text-slate-950 shadow-sm font-black" : "text-slate-600 hover:text-slate-900 bg-amber-50/70"
            }`}
            style={{ minHeight: "44px" }}
          >
            <Compass className="w-4 h-4 shrink-0" />
            <span>{activeT.trackerTab}</span>
            <span className="absolute -top-1 -right-1 flex h-2 w-2 rounded-full bg-red-600 animate-ping" />
          </button>
        )}

        <button
          onClick={() => setActiveTab("hospitals")}
          className={`py-2 px-1 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer truncate ${
            activeTab === "hospitals" ? "bg-white text-slate-950 shadow-sm border border-slate-200 font-black" : "text-slate-600 hover:text-slate-900"
          }`}
          style={{ minHeight: "44px" }}
        >
          <HospitalIcon className="w-4 h-4 shrink-0" />
          <span>{activeT.hospTab.split(" ")[0]}</span>
        </button>

        <button
          onClick={() => setActiveTab("history")}
          className={`py-2 px-1 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer truncate ${
            activeTab === "history" ? "bg-white text-slate-950 shadow-sm border border-slate-200 font-black" : "text-slate-600 hover:text-slate-900"
          }`}
          style={{ minHeight: "44px" }}
        >
          <HistoryIcon className="w-4 h-4 shrink-0" />
          <span>{activeT.historyTab.split(" ")[0]}</span>
        </button>

        <button
          onClick={() => setActiveTab("profile")}
          className={`py-2 px-1 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer truncate hidden sm:flex ${
            activeTab === "profile" ? "bg-white text-slate-950 shadow-sm border border-slate-200 font-black" : "text-slate-600 hover:text-slate-900"
          }`}
          style={{ minHeight: "44px" }}
        >
          <User className="w-4 h-4 shrink-0" />
          <span>{activeT.profileTab.split(" ")[0]}</span>
        </button>
      </div>

      {/* 3. CORE SUB-VIEWS CONTENT */}

      {/* TAB: REPORT (Main CTA & Form Wizard) */}
      {activeTab === "report" && (
        <div className="space-y-6">
          {viewMode === "dashboard" ? (
            <div className="space-y-6">
              {/* Massive pulsating button for stress-free 1-tap reporting */}
              <button
                type="button"
                onClick={() => setViewMode("reporting")}
                className="w-full bg-red-600 hover:bg-red-500 text-white rounded-3xl p-8 shadow-xl hover:shadow-2xl transition-all duration-300 flex flex-col items-center justify-center text-center space-y-4 cursor-pointer border-4 border-red-100 relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-red-500/10 scale-105 animate-ping rounded-3xl pointer-events-none"></div>
                <div className="w-20 h-20 bg-white text-red-600 rounded-full flex items-center justify-center shadow-lg shrink-0">
                  <AlertCircle className="w-12 h-12" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-2xl sm:text-3xl font-black tracking-tight font-display text-white">
                    {activeT.reportBtn}
                  </h3>
                  <p className="text-sm font-semibold text-red-100 max-w-md mx-auto">
                    {activeT.reportSub}
                  </p>
                </div>
              </button>

              {/* Quick Presets Auto-Fill Area (Reduces stress and minimizes typing) */}
              <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-4">
                <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider font-mono">
                  {activeT.presetHeader}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleApplyPreset(preset)}
                      className="text-left text-xs p-4 rounded-xl border border-slate-100 hover:border-red-200 hover:bg-red-50/40 transition-all cursor-pointer flex flex-col justify-between h-24 group"
                    >
                      <p className="font-extrabold text-slate-800 line-clamp-2 leading-tight group-hover:text-red-700 transition-colors">
                        {preset.title.split("(")[lang === "kh" ? 1 : 0].replace(")", "")}
                      </p>
                      <span className="text-[10px] text-red-600 font-bold mt-2">
                        {lang === "kh" ? "សាកល្បងរាយការណ៍ " : "Preset "} #{idx + 1} &rarr;
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* WIZARD SUBMISSION FORM */
            <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-6 border border-slate-100 shadow-lg space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <button
                  type="button"
                  onClick={() => setViewMode("dashboard")}
                  className="text-xs text-slate-600 hover:text-slate-900 font-bold flex items-center gap-1.5 cursor-pointer bg-slate-50 hover:bg-slate-100 px-3 py-2 rounded-xl transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>{activeT.backBtn}</span>
                </button>
                <span className="text-xs font-black text-red-600 font-mono tracking-widest uppercase">
                  {lang === "kh" ? "ទម្រង់រាយការណ៍រហ័ស" : "EXPRESS REPORT FORM"}
                </span>
              </div>

              {/* Automatic GPS Status Header (Zero Effort Coordination) */}
              <div className="p-4 bg-emerald-50/70 rounded-2xl border border-emerald-100 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500 text-white rounded-xl">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-emerald-800">{activeT.gpsSecured}</p>
                    <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                      {pinLocation ? pinLocation.name : activeT.defaultLoc}
                    </p>
                  </div>
                </div>
                {pinLocation ? (
                  <button
                    type="button"
                    onClick={onClearPin}
                    className="text-xs text-red-600 font-bold hover:underline"
                  >
                    Reset
                  </button>
                ) : (
                  <span className="text-[10px] text-slate-400 font-medium max-w-[120px] text-right">
                    {activeT.changeLoc}
                  </span>
                )}
              </div>

              {/* Voice-to-Text Call Assistant (Accessibility Support) */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleSimulateVoiceCall}
                  disabled={simulatedVoice || loading}
                  className={`w-full border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-2xl py-3 px-4 text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    simulatedVoice ? "animate-pulse" : ""
                  }`}
                  style={{ minHeight: "44px" }}
                >
                  <Mic className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>{simulatedVoice ? activeT.voiceSimulating : activeT.simVoice}</span>
                </button>
                {simulatedVoice && (
                  <div className="p-3 bg-blue-900 text-blue-100 font-mono text-[11px] rounded-xl leading-relaxed">
                    {voiceText}
                  </div>
                )}
              </div>

              {/* Landmark Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700 block">
                  {activeT.landmarkLabel}
                </label>
                <input
                  type="text"
                  required
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 text-sm focus:border-red-500 transition-all bg-slate-50/50"
                  placeholder={activeT.landmarkPlaceholder}
                  style={{ minHeight: "44px" }}
                />
              </div>

              {/* Supporting media files (Zero Friction Camera) */}
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-700 block">
                  {activeT.mediaLabel} <span className="text-[10px] text-slate-400 font-normal">({activeT.optional})</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    {image ? (
                      <div className="relative group rounded-xl overflow-hidden border border-slate-200 h-14 bg-black flex items-center justify-center">
                        <img src={image} className="h-full w-full object-cover opacity-85" alt="Triage preview" referrerPolicy="no-referrer" />
                        <button
                          type="button"
                          onClick={() => { setImage(null); setImageMime(null); }}
                          className="absolute inset-0 bg-red-600 text-white text-[10px] font-bold flex items-center justify-center cursor-pointer border-none"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSimulateImage}
                        className="w-full h-14 border border-dashed border-slate-200 hover:border-slate-300 rounded-xl font-bold text-xs text-slate-600 flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors"
                        style={{ minHeight: "44px" }}
                      >
                        <Camera className="w-4 h-4 text-slate-500" />
                        <span>{activeT.simPhoto}</span>
                      </button>
                    )}
                  </div>

                  <div>
                    {audio ? (
                      <div className="relative group rounded-xl overflow-hidden border border-slate-200 h-14 bg-slate-100 flex flex-col items-center justify-center">
                        <span className="text-[10px] font-bold text-slate-600 flex items-center gap-1">
                          <Mic className="w-3.5 h-3.5 text-slate-500" />
                          <span>VoiceRecorded.wav</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => { setAudio(null); setAudioMime(null); }}
                          className="text-[9px] text-red-600 font-bold hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSimulateAudio}
                        className="w-full h-14 border border-dashed border-slate-200 hover:border-slate-300 rounded-xl font-bold text-xs text-slate-600 flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors"
                        style={{ minHeight: "44px" }}
                      >
                        <Mic className="w-4 h-4 text-slate-500" />
                        <span>{activeT.simVoice.split(" ")[0]}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Scenario Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700 flex items-center justify-between">
                  <span>{activeT.descLabel}</span>
                  <span className="text-[10px] text-red-600 bg-red-50 px-2 py-0.5 rounded font-mono font-bold flex items-center gap-1">
                    <Brain className="w-3 h-3" />
                    <span>AI Triage Analyzed</span>
                  </span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  required
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 text-sm focus:border-red-500 transition-all leading-relaxed bg-slate-50/50"
                  placeholder={activeT.descPlaceholder}
                />
              </div>

              {/* Hidden/Autofilled Reporter Identity block */}
              <div className="border-t border-slate-100 pt-4 grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">
                    {activeT.reporterName}
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">
                    {activeT.reporterPhone}
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none"
                  />
                </div>
              </div>

              {/* Submit Emergency Trigger */}
              <button
                type="submit"
                disabled={loading || !description.trim()}
                className="w-full bg-red-600 hover:bg-red-500 text-white rounded-2xl py-4 font-black text-sm flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-50"
                style={{ minHeight: "48px" }}
              >
                {loading ? (
                  <>
                    <Brain className="w-4 h-4 animate-spin text-white shrink-0" />
                    <span>{activeT.submitting}</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 shrink-0" />
                    <span>{activeT.submitBtn}</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      )}

      {/* TAB: ACTIVE TRACKER (Keep Calm, Live tracking guides) */}
      {activeTab === "tracker" && activeIncident && (
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-md space-y-6 animate-fade-in">
          {/* Header Track */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-3">
            <div className="space-y-1">
              <span className="text-[10px] font-mono font-black tracking-widest text-red-600 uppercase bg-red-50 px-2 py-0.5 rounded inline-block">
                {lang === "kh" ? "ករណីសង្គ្រោះសកម្ម" : "ACTIVE DISPATCH TRACKER"}
              </span>
              <h3 className="text-base font-black text-slate-800 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-red-500 shrink-0" />
                <span>{activeIncident.locationName}</span>
              </h3>
            </div>
            <div className={`px-3 py-1 rounded-xl text-xs font-black tracking-wider self-start sm:self-auto border ${
              activeIncident.triageLevel === "RED" ? "bg-red-50 text-red-700 border-red-200" : "bg-amber-50 text-amber-700 border-amber-200"
            }`}>
              {activeIncident.triageLevel} {activeT.triageLevel}
            </div>
          </div>

          {/* Milestones timeline */}
          <div className="space-y-3">
            <p className="text-xs font-black text-slate-500 uppercase tracking-wider font-mono">
              {activeT.status}: <span className="text-emerald-600 font-bold">{activeIncident.status}</span>
            </p>
            
            <div className="grid grid-cols-5 gap-1 text-center">
              {[
                { label: lang === "kh" ? "បានរាយការណ៍" : "Reported", active: true },
                { label: lang === "kh" ? "បានបញ្ជូន" : "Dispatched", active: ["Ambulance Dispatched", "On-Scene", "Transporting", "Arrived at Hospital", "Resolved"].includes(activeIncident.status) },
                { label: lang === "kh" ? "ដល់កន្លែង" : "On-Scene", active: ["On-Scene", "Transporting", "Arrived at Hospital", "Resolved"].includes(activeIncident.status) },
                { label: lang === "kh" ? "បញ្ជូនអ្នកជំងឺ" : "Transporting", active: ["Transporting", "Arrived at Hospital", "Resolved"].includes(activeIncident.status) },
                { label: lang === "kh" ? "ដល់ពេទ្យ" : "Hospital", active: ["Arrived at Hospital", "Resolved"].includes(activeIncident.status) }
              ].map((step, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className={`h-2.5 rounded-full ${step.active ? "bg-emerald-500" : "bg-slate-100"}`} />
                  <span className={`text-[10px] font-black block leading-none truncate ${step.active ? "text-emerald-700 font-black" : "text-slate-400"}`}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Recommended matched hospital */}
          {assignedHospital && (
            <div className="p-4 rounded-2xl border-2 border-emerald-500 bg-emerald-50/30 space-y-2">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <h4 className="text-xs font-black text-emerald-800 tracking-wider uppercase font-mono">
                  {activeT.recommendedHosp}
                </h4>
              </div>
              <p className="text-base font-black text-slate-950">
                {lang === "kh" ? assignedHospital.nameKhmer : assignedHospital.name}
              </p>
              <p className="text-xs text-slate-500 font-medium flex items-center gap-1">
                <Clock className="w-4 h-4 text-slate-400" />
                <span>{activeT.travelTime}: <span className="font-bold text-slate-800">{((activeIncident.priorityScore * 0.05) + 2).toFixed(1)} mins</span></span>
              </p>
            </div>
          )}

          {/* Large Keep Calm guides */}
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-3">
            <div className="flex items-center gap-2 text-slate-800 border-b border-slate-200/60 pb-2">
              <HeartHandshake className="w-5 h-5 text-emerald-600 shrink-0" />
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider font-mono">
                {activeT.firstAidTitle}
              </h4>
            </div>
            <div className="text-xs text-slate-700 leading-relaxed bg-white p-4 rounded-xl border border-slate-100 font-medium whitespace-pre-line">
              {lang === "kh" ? activeIncident.firstAidKhmer : activeIncident.firstAidEnglish}
            </div>
          </div>

          {/* Quick contact trigger targets (Minimum 44px) */}
          <div className="grid grid-cols-2 gap-3">
            <a
              href="tel:119"
              className="flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-700 font-black text-sm py-3 px-4 rounded-xl transition-colors border border-red-100"
              style={{ minHeight: "44px" }}
            >
              <Phone className="w-4 h-4 shrink-0" />
              <span>{activeT.callDispatcher}</span>
            </a>
            
            {assignedHospital ? (
              <a
                href={`tel:${assignedHospital.phone}`}
                className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-black text-sm py-3 px-4 rounded-xl transition-colors"
                style={{ minHeight: "44px" }}
              >
                <Activity className="w-4 h-4 shrink-0" />
                <span>{activeT.callAmbulance}</span>
              </a>
            ) : (
              <div className="flex items-center justify-center gap-2 bg-slate-50 text-slate-400 text-xs font-bold py-3 px-4 rounded-xl border border-slate-100">
                <Clock className="w-4 h-4 animate-spin" />
                <span>Allocating Fleet...</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: NEARBY HOSPITALS (Cambodian Emergency Hubs, Bed Indicator) */}
      {activeTab === "hospitals" && (
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-md space-y-4 animate-fade-in">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider font-mono">
              {activeT.nearbyHosp}
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Real-time trauma centers network in Phnom Penh</p>
          </div>

          <div className="space-y-3">
            {hospitals.map((h) => {
              const bedsPercent = Math.round((h.availableIcuBeds / h.totalIcuBeds) * 100);
              return (
                <div key={h.id} className="p-4 rounded-2xl border border-slate-100 hover:border-slate-200 transition-all bg-slate-50/40 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="space-y-1">
                    <p className="font-extrabold text-slate-900 text-sm">
                      {lang === "kh" ? h.nameKhmer : h.name}
                    </p>
                    <div className="flex gap-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                      <span className="flex items-center gap-1 text-emerald-600">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{h.availableIcuBeds} / {h.totalIcuBeds} ICU beds free</span>
                      </span>
                      <span>•</span>
                      <span className="text-slate-500">{h.availableAmbulances} ambulances free</span>
                    </div>
                  </div>

                  <a
                    href={`tel:${h.phone}`}
                    className="bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs py-2.5 px-4 rounded-xl flex items-center gap-1.5 self-start sm:self-auto"
                    style={{ minHeight: "44px" }}
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Call ER ({h.phone})</span>
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB: EMERGENCY HISTORY */}
      {activeTab === "history" && (
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-md space-y-4 animate-fade-in">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider font-mono">
              {activeT.historyTitle}
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Past reported emergency logs in this session</p>
          </div>

          {incidents.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs italic">
              {activeT.historyPlaceholder}
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto pr-1">
              {incidents.map((inc) => {
                const isSelected = activeIncident?.id === inc.id;
                return (
                  <div key={inc.id} className="py-3.5 flex justify-between items-start gap-4">
                    <div className="space-y-1">
                      <p className="font-extrabold text-slate-900 text-xs">{inc.locationName}</p>
                      <p className="text-[11px] text-slate-500 line-clamp-1">{inc.description}</p>
                      <span className="text-[9px] font-mono text-slate-400 block">
                        Reported: {new Date(inc.reportedAt).toLocaleTimeString()}
                      </span>
                    </div>

                    <div className="text-right shrink-0">
                      <span className={`text-[9px] font-mono font-black px-2 py-0.5 rounded uppercase ${
                        inc.triageLevel === "RED" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"
                      }`}>
                        {inc.triageLevel}
                      </span>
                      <p className="text-[10px] font-bold text-emerald-600 mt-1">{inc.status}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB: PROFILE (Meas Sophea, +855 12 888 999) */}
      {activeTab === "profile" && (
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-md space-y-6 animate-fade-in">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider font-mono">
              {activeT.profileTab}
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Your personal emergency passport credentials</p>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3.5">
            <p className="text-xs font-black text-slate-700 uppercase tracking-wider font-mono">
              {activeT.profileDetails}
            </p>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-white p-3 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[9px] font-mono">FULL NAME (ឈ្មោះ)</span>
                <span className="font-black text-slate-800 mt-1 block">Meas Sophea</span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[9px] font-mono">PHONE NUMBER (ទូរស័ព្ទ)</span>
                <span className="font-black text-slate-800 mt-1 block">+855 12 888 999</span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-100 col-span-2">
                <span className="text-slate-400 block text-[9px] font-mono">LANGUAGE PREFERENCE</span>
                <span className="font-black text-slate-800 mt-1 block">ភាសាខ្មែរ / English</span>
              </div>
            </div>
          </div>

          {/* National hotlines */}
          <div className="space-y-2">
            <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider font-mono">
              {activeT.emergencyContacts}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <a href="tel:119" className="p-3 bg-red-50 text-red-700 font-bold rounded-xl border border-red-100 flex justify-between items-center">
                <span>Medical Dispatch (១១៩)</span>
                <span className="font-black">119</span>
              </a>
              <a href="tel:117" className="p-3 bg-slate-100 text-slate-700 font-bold rounded-xl border border-slate-200 flex justify-between items-center">
                <span>Police Response (១១៧)</span>
                <span className="font-black">117</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* 4. EVALUATION DRAWER (PROGRESSIVE DISCLOSURE) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <button
          type="button"
          onClick={() => setShowAdvancedDemo(!showAdvancedDemo)}
          className="w-full text-left text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center justify-between cursor-pointer"
        >
          <span className="flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-emerald-600" />
            <span>{activeT.simControls}</span>
          </span>
          <span className="text-[10px] font-mono bg-slate-100 px-2 py-0.5 rounded">
            {showAdvancedDemo ? "HIDE [▲]" : "SHOW [▼]"}
          </span>
        </button>

        {showAdvancedDemo && (
          <div className="mt-4 border-t border-slate-100 pt-4 space-y-4 animate-fade-in">
            {isStreaming && (
              <div className="p-3 bg-slate-900 text-slate-100 font-mono text-[10.5px] rounded-xl space-y-2">
                <p className="text-emerald-400 font-bold tracking-wider flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
                  <span>REAL-TIME CO-PILOT ANALYSIS STREAM</span>
                </p>
                <p className="whitespace-pre-wrap leading-relaxed">{streamChunks || "Connecting Stream..."}</p>
              </div>
            )}

            {activeIncident ? (
              <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-600 uppercase font-mono tracking-wider block">
                  Advance Dispatch Timeline Step (Simulator)
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  <button
                    type="button"
                    onClick={() => onUpdateStatus(activeIncident.id, "On-Scene", "Ambulance arrived at coordinates.")}
                    disabled={activeIncident.status === "On-Scene" || activeIncident.status === "Transporting" || activeIncident.status === "Arrived at Hospital"}
                    className="bg-white hover:bg-slate-100 text-[10px] font-bold py-2 px-1 rounded-lg border border-slate-200 disabled:opacity-40"
                  >
                    1. On-Scene
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateStatus(activeIncident.id, "Transporting", "Patient loaded securely inside ICU ambulance.")}
                    disabled={activeIncident.status !== "On-Scene"}
                    className="bg-white hover:bg-slate-100 text-[10px] font-bold py-2 px-1 rounded-lg border border-slate-200 disabled:opacity-40"
                  >
                    2. Transporting
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateStatus(activeIncident.id, "Arrived at Hospital", `Admitted patient to ${assignedHospital?.name || "Trauma Center"}.`)}
                    disabled={activeIncident.status !== "Transporting"}
                    className="bg-white hover:bg-slate-100 text-[10px] font-bold py-2 px-1 rounded-lg border border-slate-200 disabled:opacity-40"
                  >
                    3. Hospital
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateStatus(activeIncident.id, "Resolved", "Triage closed, ICU admission finalized.")}
                    disabled={activeIncident.status !== "Arrived at Hospital"}
                    className="bg-slate-900 hover:bg-emerald-600 hover:text-white text-emerald-400 border border-slate-800 text-[10px] font-bold py-2 px-1 rounded-lg disabled:opacity-40"
                  >
                    4. Resolve
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">No active incident to simulate timeline status.</p>
            )}

            {onResetSimulation && (
              <div className="flex justify-between items-center bg-red-50 p-3 rounded-xl border border-red-100">
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-red-800">Dangerous Action Panel</p>
                  <p className="text-[10px] text-slate-500">Restore sandbox data pre-seeds</p>
                </div>
                <button
                  type="button"
                  onClick={onResetSimulation}
                  className="bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{activeT.resetSys}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
