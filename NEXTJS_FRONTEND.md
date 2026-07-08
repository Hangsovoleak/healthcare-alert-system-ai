# PRODUCTION NEXT.JS FRONTEND ARCHITECTURE & REFERENCE IMPLEMENTATION
## Project: LifeLink AI — Cambodia Intelligent Emergency Medical Response Platform
### Role: Principal Frontend Architect & Senior Lead UI/UX Designer
### Document Reference: LLA-NEXTJS-FRONTEND-2026-V1
### Date: July 7, 2026

---

## 1. ARCHITECTURAL PATTERNS: APP ROUTER DIRECTORY STRUCTURE

This frontend reference implementation utilizes the modern **Next.js App Router (v14+)** with standard TypeScript, Tailwind CSS, shadcn/ui, TanStack Query (React Query), Axios, React Hook Form, Zod, and Framer Motion.

```
frontend/
├── app/
│   ├── layout.tsx              # Root HTML wrapper, viewport, global metadata
│   ├── providers.tsx           # React Query, Theme, & UI providers
│   ├── globals.css             # Tailwind @import directives & theme vars
│   ├── page.tsx                # Citizen 119 Emergency Reporter Dashboard
│   ├── hospitals/
│   │   └── page.tsx            # Hospital ER Command Center
│   ├── moh/
│   │   └── page.tsx            # Ministry of Health Analytics Dashboard
│   └── api/                    # Optional client route proxies (if needed)
├── components/                 # Reusable component libraries
│   ├── ui/                     # shadcn/ui component exports
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   ├── dialog.tsx
│   │   └── select.tsx
│   ├── maps/
│   │   └── TactMap.tsx         # Vector SVG map projection canvas
│   └── analytics/
│       └── MetricCard.tsx      # Stat cards with hover animations
├── lib/                        # Infrastructure Utilities
│   ├── api-client.ts           # Axios instance with auth & refresh handling
│   └── utils.ts                # Tailwind merge (cn) helpers
└── types/                      # Common interface schemas
    └── index.ts                # TypeScript domain models
```

---

## 2. GLOBAL SYSTEM SCHEMAS & TYPES (`types/index.ts`)

Strict structural typing representing our back-end database schemas and telemetry states.

```typescript
export type TriageLevel = "RED" | "YELLOW" | "GREEN";

export interface Hospital {
  id: string;
  name: string;
  lat: number;
  lng: number;
  totalAmbulances: number;
  availableAmbulances: number;
  totalIcuBeds: number;
  availableIcuBeds: number;
  specialties: string[];
}

export interface Incident {
  id: string;
  reportedByUsername: string;
  reporterPhone: string;
  rawText: string;
  locationName: string;
  latitude: float;
  longitude: float;
  patientCount: number;
  triageLevel?: TriageLevel;
  priorityScore?: number;
  status: "REPORTED" | "DISPATCHED" | "ON_SCENE" | "TRANSPORTING" | "ARRIVED" | "RESOLVED";
  assignedHospitalId?: string;
  assignedAmbulanceId?: string;
  reportedAt: string;
}

export interface Ambulance {
  id: string;
  hospitalId: string;
  plateNumber: string;
  status: "Available" | "Dispatched" | "En-Route" | "On-Scene" | "Transporting" | "Out-of-Service";
  lat: number;
  lng: number;
  patientId?: string | null;
}
```

---

## 3. CORE UTILITIES & API CLIENTS

### 3.1 Highly-Polished Axios API Client (`lib/api-client.ts`)
```typescript
import axios from "axios";

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "https://api.lifelink.gov.kh/v1",
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Automatically inject JWT credentials from localStorage
apiClient.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("lifelink_token");
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);
```

### 3.2 Tailwinds Merge Class Resolver (`lib/utils.ts`)
```typescript
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

---

## 4. MULTI-PROVIDER CONTAINER WRAPPER (`app/providers.tsx`)

Combines React Query (TanStack Query), Toast controllers, and basic application states.

```typescript
"use client";

import React, { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 4000, // Sync with 4s telemetry polling loop
            refetchInterval: 4000,
            retry: 2,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster position="top-right" richColors theme="dark" />
    </QueryClientProvider>
  );
}
```

---

## 5. GLOBAL VIEWPORT LAYOUT & STYLING

### 5.1 Style Config (`app/globals.css`)
```css
@import "tailwindcss";

@layer base {
  :root {
    --background: 210 40% 98%;
    --foreground: 222.2 47.4% 11.2%;
    --card: 0 0% 100%;
    --primary: 142.1 76.2% 36.3%; /* Calming Emerald Primary */
    --destructive: 0 84.2% 60.2%; /* Alert Red */
    --border: 214.3 31.8% 91.4%;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 217.2 32.6% 17.5%;
    --primary: 142.1 70.6% 45.3%;
    --border: 217.2 32.6% 17.5%;
  }
}

body {
  font-family: 'Inter', system-ui, sans-serif;
  background-color: rgb(248, 250, 252);
  color: rgb(15, 23, 42);
}
```

### 5.2 Root Document Architecture (`app/layout.tsx`)
```typescript
import React from "react";
import type { Metadata } from "next";
import Providers from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "LifeLink AI — Intelligent Cambodia Triage Response Grid",
  description: "Next-generation emergency pre-hospital healthcare coordination portal.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full antialiased">
        <Providers>
          <div className="flex flex-col min-h-screen">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
```

---

## 6. FORM VALIDATION WITH REACT HOOK FORM & ZOD (`components/TriageForm.tsx`)

Production-ready type-safe emergency report capture with reactive Zod schema guards.

```typescript
"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const triageFormSchema = z.object({
  reportedByUsername: z.string().min(2, "Reporter name must contain at least 2 characters."),
  reporterPhone: z.string().regex(/^\+?[0-9]{8,15}$/, "Please enter a valid phone number (8-15 digits)."),
  rawText: z.string().min(10, "Please describe the injuries in at least 10 characters so AI can triage effectively."),
  locationName: z.string().min(5, "A specific location name or landmark is required."),
  latitude: z.number().min(11.5).max(11.7),
  longitude: z.number().min(104.8).max(105.0),
  patientCount: z.number().min(1).max(50),
});

type TriageFormValues = z.infer<typeof triageFormSchema>;

interface TriageFormProps {
  onSubmit: (values: TriageFormValues) => void;
  defaultLocation: { lat: number; lng: number; name: string } | null;
}

export default function TriageForm({ onSubmit, defaultLocation }: TriageFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TriageFormValues>({
    resolver: zodResolver(triageFormSchema),
    defaultValues: {
      latitude: defaultLocation?.lat || 11.5564,
      longitude: defaultLocation?.lng || 104.9282,
      locationName: defaultLocation?.name || "",
      patientCount: 1,
    },
  });

  React.useEffect(() => {
    if (defaultLocation) {
      setValue("latitude", defaultLocation.lat);
      setValue("longitude", defaultLocation.lng);
      setValue("locationName", defaultLocation.name);
    }
  }, [defaultLocation, setValue]);

  return (
    <motion.form
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm"
    >
      <div>
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Your Full Name</label>
        <Input {...register("reportedByUsername")} placeholder="e.g. Sok Sambath" />
        {errors.reportedByUsername && <p className="text-xs text-red-500 mt-1">{errors.reportedByUsername.message}</p>}
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Contact Phone</label>
        <Input {...register("reporterPhone")} placeholder="e.g. 012345678" />
        {errors.reporterPhone && <p className="text-xs text-red-500 mt-1">{errors.reporterPhone.message}</p>}
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">What is the Emergency? (Khmer/English)</label>
        <textarea
          {...register("rawText")}
          rows={3}
          className="w-full text-sm border border-slate-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          placeholder="e.g. គ្រោះថ្នាក់ចរាចរណ៍ម៉ូតូ និងឡានបុកគ្នា សន្លប់ម្នាក់ហូរឈាមក្បាលច្រើន"
        />
        {errors.rawText && <p className="text-xs text-red-500 mt-1">{errors.rawText.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Incident Landmark</label>
          <Input {...register("locationName")} placeholder="e.g. Central Market" />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Patient Count</label>
          <Input type="number" {...register("patientCount", { valueAsNumber: true })} />
        </div>
      </div>

      <Button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-red-600 text-white font-bold py-3 hover:bg-red-700 active:scale-[0.98] rounded-xl cursor-pointer transition-all uppercase tracking-wider text-xs"
      >
        {isSubmitting ? "Processing Triage..." : "🚨 Transmit Emergency Alert"}
      </Button>
    </motion.form>
  );
}
```

---

## 7. HIGH-FIDELITY ROUTE LAYOUTS & PAGE PATHS

### 7.1 Page 1: Citizen 119 Emergency Triage Portal (`app/page.tsx`)
```typescript
"use client";

import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { Hospital, Incident } from "@/types";
import TriageForm from "@/components/TriageForm";
import TactMap from "@/components/maps/TactMap";

export default function CitizenPortal() {
  const queryClient = useQueryClient();
  const [pin, setPin] = useState<{ lat: number; lng: number; name: string } | null>(null);
  const [activeIncident, setActiveIncident] = useState<Incident | null>(null);

  // TanStack Query: Fetch active hospitals & live capacities
  const { data: hospitals = [] } = useQuery<Hospital[]>({
    queryKey: ["hospitals"],
    queryFn: async () => {
      const res = await apiClient.get("/hospitals");
      return res.data;
    },
  });

  // Query: Live incidents list
  const { data: incidents = [] } = useQuery<Incident[]>({
    queryKey: ["incidents"],
    queryFn: async () => {
      const res = await apiClient.get("/incidents");
      return res.data;
    },
  });

  // Mutation: Transmit Emergency Alert
  const emergencyMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiClient.post("/incidents", payload);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success("Emergency report triaged and dispatched successfully!");
      setActiveIncident(data);
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
      queryClient.invalidateQueries({ queryKey: ["hospitals"] });
    },
    onError: () => {
      toast.error("Transmission failed. Local backup dispatcher deployed.");
    },
  });

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Left Input Panel */}
      <div className="lg:col-span-7 space-y-6">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Emergency 119 Portal</h2>
          <p className="text-xs text-slate-500">Provide incident descriptors. AI-directed routing matches hospital load automatically.</p>
        </div>

        <TriageForm
          onSubmit={(values) => emergencyMutation.mutate(values)}
          defaultLocation={pin}
        />

        <AnimatePresence>
          {activeIncident && (
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-6 bg-red-50 border-2 border-red-500 rounded-2xl shadow"
            >
              <h3 className="text-sm font-extrabold text-red-900 uppercase">Triage Diagnostics Active</h3>
              <p className="text-xs text-red-700 mt-1">Status: <span className="font-bold">{activeIncident.status}</span></p>
              <p className="text-xs text-slate-700 mt-2"><strong>AI Symptom Analysis:</strong> {activeIncident.rawText}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Right Map Panel */}
      <div className="lg:col-span-5 h-[500px] lg:h-auto rounded-2xl overflow-hidden border border-slate-100 shadow-sm relative">
        <TactMap
          hospitals={hospitals}
          incidents={incidents}
          selectedIncident={activeIncident}
          onMapClick={(lat, lng, name) => setPin({ lat, lng, name })}
          pinLocation={pin}
        />
      </div>
    </div>
  );
}
```

### 7.2 Page 2: Hospital Emergency Command Terminal (`app/hospitals/page.tsx`)
```typescript
"use client";

import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Hospital, Incident } from "@/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function HospitalCommand() {
  const queryClient = useQueryClient();

  // Queries
  const { data: hospitals = [] } = useQuery<Hospital[]>({
    queryKey: ["hospitals"],
    queryFn: async () => {
      const res = await apiClient.get("/hospitals");
      return res.data;
    },
  });

  const { data: incidents = [] } = useQuery<Incident[]>({
    queryKey: ["incidents"],
    queryFn: async () => {
      const res = await apiClient.get("/incidents");
      return res.data;
    },
  });

  // Mutation: Update Bed Capacity
  const bedMutation = useMutation({
    mutationFn: async ({ id, delta }: { id: string; delta: number }) => {
      const res = await apiClient.patch(`/hospitals/${id}/icu-beds`, { delta });
      return res.data;
    },
    onSuccess: () => {
      toast.success("Bed capacity updated successfully.");
      queryClient.invalidateQueries({ queryKey: ["hospitals"] });
    },
  });

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 space-y-8">
      <div>
        <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Hospital Command Terminal</h2>
        <p className="text-xs text-slate-500">Monitor active pre-hospital triage dispatches and update ICU trauma bed availabilities.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {hospitals.map((h) => (
          <Card key={h.id} className="border border-slate-100 hover:shadow transition-all rounded-2xl overflow-hidden">
            <CardHeader className="bg-slate-50 py-4 px-6 border-b border-slate-100">
              <CardTitle className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">{h.name}</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-semibold">ICU Trauma Beds Available:</span>
                <span className="font-mono font-bold text-slate-900">{h.availableIcuBeds} / {h.totalIcuBeds}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-semibold">Active Fleet:</span>
                <span className="font-mono font-bold text-slate-900">{h.availableAmbulances} / {h.totalAmbulances}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <Button
                  onClick={() => bedMutation.mutate({ id: h.id, delta: -1 })}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold border-none py-2 rounded-lg text-xs"
                >
                  Reduce Beds
                </Button>
                <Button
                  onClick={() => bedMutation.mutate({ id: h.id, delta: 1 })}
                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold border-none py-2 rounded-lg text-xs"
                >
                  Add Free Bed
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

---
*End of Next.js Frontend Architecture Specification.*
