export interface Hospital {
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

export interface Ambulance {
  id: string;
  hospitalId: string;
  plateNumber: string;
  status: "Available" | "Dispatched" | "On-Scene" | "Transporting" | "Returning";
  lat: number;
  lng: number;
  patientId: string | null;
}

export interface TimelineEvent {
  status: string;
  timestamp: string;
  note: string;
}

export interface Incident {
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

export interface SystemStats {
  totalIncidents: number;
  activeIncidents: number;
  redCount: number;
  yellowCount: number;
  greenCount: number;
  ambulanceUtilization: number;
  icuUtilization: number;
  averageResponseTimeMins: number;
}

export interface MohDashboardData {
  stats: SystemStats;
  aiRecommendations: string;
}

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

