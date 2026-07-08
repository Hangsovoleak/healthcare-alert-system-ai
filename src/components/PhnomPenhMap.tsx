import React, { useEffect, useRef, useState, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Hospital, Ambulance, Incident } from "../types";
import { MapPin, ShieldAlert, Crosshair, HelpCircle, Navigation, Info, Eye, Compass } from "lucide-react";

// Phnom Penh boundary landmarks
const LANDMARKS = [
  { name: "Central Market (Phsar Thmey)", lat: 11.5694, lng: 104.9211 },
  { name: "Wat Phnom", lat: 11.5761, lng: 104.9230 },
  { name: "Royal Palace Area", lat: 11.5632, lng: 104.9312 },
  { name: "Tuol Sleng District", lat: 11.5494, lng: 104.9174 },
  { name: "Olympic Stadium", lat: 11.5583, lng: 104.9122 },
  { name: "Aeon Mall Area", lat: 11.5482, lng: 104.9351 },
  { name: "Boeng Keng Kang I", lat: 11.5524, lng: 104.9255 },
  { name: "Russian Market (TTP)", lat: 11.5332, lng: 104.9142 },
  { name: "Chbar Ampov District", lat: 11.5285, lng: 104.9582 },
  { name: "Steung Meanchey District", lat: 11.5292, lng: 104.8891 },
  { name: "Teuk Thla Area", lat: 11.5641, lng: 104.8724 }
];

// Helper to estimate nearest landmark on tap/click
function getNearestLandmark(clickLat: number, clickLng: number): string {
  let nearestName = "Phnom Penh Grid Intersection";
  let minDistance = Infinity;

  LANDMARKS.forEach(lm => {
    const dist = Math.sqrt(Math.pow(lm.lat - clickLat, 2) + Math.pow(lm.lng - clickLng, 2));
    if (dist < minDistance && dist < 0.015) {
      minDistance = dist;
      nearestName = lm.name;
    }
  });

  if (minDistance === Infinity) {
    nearestName = `Street Node (${clickLat.toFixed(4)}, ${clickLng.toFixed(4)})`;
  }

  return nearestName;
}

// Haversine distance calculator (in km)
function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

interface PhnomPenhMapProps {
  hospitals: Hospital[];
  ambulances: Ambulance[];
  incidents: Incident[];
  selectedIncident: Incident | null;
  onSelectIncident: (inc: Incident) => void;
  onMapClick?: (lat: number, lng: number, name: string) => void;
  interactive?: boolean;
  pinLocation?: { lat: number; lng: number; name: string } | null;
}

export function PhnomPenhMap({
  hospitals,
  ambulances,
  incidents,
  selectedIncident,
  onSelectIncident,
  onMapClick,
  interactive = true,
  pinLocation = null,
}: PhnomPenhMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const routeGroupRef = useRef<L.LayerGroup | null>(null);
  const isAnimatingRef = useRef<boolean>(false);

  const [zoom, setZoom] = useState(13);
  const [redrawTrigger, setRedrawTrigger] = useState(0);
  const [userGps, setUserGps] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);

  // 1. Geolocation Finder (GPS)
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setUserGps({ lat: latitude, lng: longitude });
        setLocating(false);
        if (mapRef.current) {
          mapRef.current.setView([latitude, longitude], 15);
        }
      },
      (err) => {
        console.warn("Geolocation permission blocked or timed out. Placing high-fidelity mock current location near Independence Monument.", err);
        // Fallback simulated current location (Independence Monument)
        const mockLat = 11.5564 + (Math.random() - 0.5) * 0.005;
        const mockLng = 104.9282 + (Math.random() - 0.5) * 0.005;
        setUserGps({ lat: mockLat, lng: mockLng });
        setLocating(false);
        if (mapRef.current) {
          mapRef.current.setView([mockLat, mockLng], 15);
        }
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  };

  // 2. Map-level Responsive Zoom Bounds
  const handleFitAll = () => {
    if (!mapRef.current) return;
    const boundsPoints: L.LatLngExpression[] = hospitals.map(h => [h.lat, h.lng]);
    incidents.forEach(inc => {
      if (inc.status !== "Resolved") {
        boundsPoints.push([inc.lat, inc.lng]);
      }
    });
    if (pinLocation) boundsPoints.push([pinLocation.lat, pinLocation.lng]);
    if (userGps) boundsPoints.push([userGps.lat, userGps.lng]);

    if (boundsPoints.length > 0) {
      const bounds = L.latLngBounds(boundsPoints);
      mapRef.current.fitBounds(bounds, { padding: [40, 40] });
    }
  };

  // 3. Simple Zoom-Sensitive Marker Clustering Logic
  const clusteredIncidents = useMemo(() => {
    const activeIncidents = incidents.filter(inc => inc.status !== "Resolved");

    if (zoom >= 13) {
      // High zoom: render all incidents individually
      return activeIncidents.map(inc => ({
        ...inc,
        isCluster: false,
        count: 1,
        idList: [inc.id],
      }));
    }

    // Low zoom: group incidents within critical distance bounds
    const clusters: any[] = [];
    const thresholdDegrees = (13 - zoom) * 0.012; // zoom scaling radius

    activeIncidents.forEach(inc => {
      let added = false;
      for (const cl of clusters) {
        const dist = Math.sqrt(Math.pow(inc.lat - cl.lat, 2) + Math.pow(inc.lng - cl.lng, 2));
        if (dist < thresholdDegrees) {
          cl.latList.push(inc.lat);
          cl.lngList.push(inc.lng);
          // Re-center on centroid
          cl.lat = cl.latList.reduce((a: number, b: number) => a + b, 0) / cl.latList.length;
          cl.lng = cl.lngList.reduce((a: number, b: number) => a + b, 0) / cl.lngList.length;
          cl.count += 1;
          cl.idList.push(inc.id);
          cl.incidentsList.push(inc);
          added = true;
          break;
        }
      }

      if (!added) {
        clusters.push({
          id: `cluster-${inc.id}`,
          lat: inc.lat,
          lng: inc.lng,
          isCluster: true,
          count: 1,
          idList: [inc.id],
          latList: [inc.lat],
          lngList: [inc.lng],
          incidentsList: [inc],
        });
      }
    });

    return clusters;
  }, [incidents, zoom]);

  // 4. Distance & ETA Routing HUD computations
  const routeInfo = useMemo(() => {
    if (!selectedIncident) return null;

    const inc = selectedIncident;
    const h = hospitals.find(hosp => hosp.id === inc.assignedHospitalId);
    const a = ambulances.find(amb => amb.id === inc.assignedAmbulanceId);

    const stats = {
      leg1Dist: 0,
      leg1Eta: 0,
      leg2Dist: 0,
      leg2Eta: 0,
      totalDist: 0,
      totalEta: 0,
      ambulancePlate: a?.plateNumber || null,
      hospitalName: h?.name || null,
      incidentName: inc.locationName,
      status: inc.status,
    };

    if (h) {
      // Leg 2: Patient to Emergency Hospital Trauma Node
      stats.leg2Dist = calculateHaversineDistance(inc.lat, inc.lng, h.lat, h.lng);
      stats.leg2Eta = Math.ceil((stats.leg2Dist / 35) * 60); // 35 km/h sirens travel time

      if (a) {
        // Leg 1: Ambulance base to active Patient
        stats.leg1Dist = calculateHaversineDistance(a.lat, a.lng, inc.lat, inc.lng);
        stats.leg1Eta = Math.ceil((stats.leg1Dist / 35) * 60);

        stats.totalDist = stats.leg1Dist + stats.leg2Dist;
        stats.totalEta = stats.leg1Eta + stats.leg2Eta;
      } else {
        stats.totalDist = stats.leg2Dist;
        stats.totalEta = stats.leg2Eta;
      }
    }

    return stats;
  }, [selectedIncident, hospitals, ambulances]);

  // Initialize Map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Build standard Leaflet instance with bounds focused in Phnom Penh
    const map = L.map(containerRef.current, {
      center: [11.5564, 104.9282],
      zoom: 13,
      zoomControl: false,
      zoomAnimation: false,
      fadeAnimation: false,
      markerZoomAnimation: false,
    });

    // Dark-slate tactical map layout matching LifeLink AI aesthetic
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(map);

    // Zoom controls aligned beautifully
    L.control.zoom({ position: "topright" }).addTo(map);

    // Robust ResizeObserver to handle tab switching and dynamic layout changes
    const resizeObserver = new ResizeObserver(() => {
      if (map) {
        map.invalidateSize();
      }
    });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // Track map zoom and move states to avoid race conditions when clearing/redrawing layers
    map.on("zoomstart", () => {
      isAnimatingRef.current = true;
    });
    map.on("movestart", () => {
      isAnimatingRef.current = true;
    });
    map.on("zoomend", () => {
      isAnimatingRef.current = false;
      setZoom(map.getZoom());
      setRedrawTrigger(prev => prev + 1);
    });
    map.on("moveend", () => {
      isAnimatingRef.current = false;
      setRedrawTrigger(prev => prev + 1);
    });

    // Track clicks on map to place pin location
    map.on("click", (e: L.LeafletMouseEvent) => {
      if (!interactive || !onMapClick) return;

      const target = e.originalEvent.target as HTMLElement;
      if (
        target.classList.contains("leaflet-marker-icon") ||
        target.closest(".leaflet-popup") ||
        target.closest(".custom-leaflet-icon")
      ) {
        return;
      }

      const { lat, lng } = e.latlng;
      const nearestLandmark = getNearestLandmark(lat, lng);
      onMapClick(lat, lng, nearestLandmark);
    });

    mapRef.current = map;
    markersGroupRef.current = L.layerGroup().addTo(map);
    routeGroupRef.current = L.layerGroup().addTo(map);

    // Dynamic auto-detect user GPS on load silently
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserGps({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        // Silent block is fine
      }
    );

    return () => {
      resizeObserver.disconnect();
      if (mapRef.current) {
        try {
          mapRef.current.closePopup();
        } catch (e) {}
        try {
          mapRef.current.remove();
        } catch (e) {}
        mapRef.current = null;
      }
    };
  }, [interactive, onMapClick]);

  // Handle selected incident bounds focusing
  useEffect(() => {
    if (selectedIncident && mapRef.current) {
      mapRef.current.setView([selectedIncident.lat, selectedIncident.lng], 15);
    }
  }, [selectedIncident]);

  // Handle pin placement centering
  useEffect(() => {
    if (pinLocation && mapRef.current) {
      mapRef.current.setView([pinLocation.lat, pinLocation.lng], 15);
    }
  }, [pinLocation]);

  // Redraw all markers & routes on data changes
  useEffect(() => {
    const mapVal = mapRef.current;
    const markersGroupVal = markersGroupRef.current;
    const routeGroupVal = routeGroupRef.current;

    if (!mapVal || !markersGroupVal || !routeGroupVal) return;

    // Skip redrawing if map is currently animating (zooming/panning) to avoid Leaflet pos exceptions
    if (isAnimatingRef.current || (mapVal as any)._animating) {
      return;
    }

    const timer = setTimeout(() => {
      try {
        const map = mapRef.current;
        const markersGroup = markersGroupRef.current;
        const routeGroup = routeGroupRef.current;
        if (!map || !markersGroup || !routeGroup) return;

        if (isAnimatingRef.current || (map as any)._animating || !(map as any)._loaded) return;

        // Safely close popup first to avoid _leaflet_pos error on cleared elements
        try {
          map.closePopup();
        } catch (e) {
          // Ignore
        }

        markersGroup.clearLayers();
        routeGroup.clearLayers();

    // 1. Render Hospital Markers
    hospitals.forEach(h => {
      const icon = L.divIcon({
        className: "custom-hospital-icon-marker",
        html: `<div class="w-8 h-8 rounded-full bg-emerald-500 border-2 border-white shadow-lg flex items-center justify-center text-white select-none"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" class="w-4 h-4"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -16]
      });

      const marker = L.marker([h.lat, h.lng], { icon })
        .bindPopup(`
          <div class="font-sans p-1 text-slate-800" style="min-width: 170px;">
            <h4 class="font-bold text-sm text-slate-900 border-b border-slate-100 pb-1">${h.name}</h4>
            <p class="text-[10px] text-slate-400 font-mono mt-0.5">${h.nameKhmer}</p>
            <div class="grid grid-cols-2 gap-2 mt-2 pt-1 text-[11px]">
              <div>
                <span class="text-slate-400 block uppercase font-bold text-[8px] tracking-wide">Ambulances</span>
                <span class="font-bold text-blue-600">${h.availableAmbulances} / ${h.totalAmbulances} Free</span>
              </div>
              <div>
                <span class="text-slate-400 block uppercase font-bold text-[8px] tracking-wide">Trauma ICU Beds</span>
                <span class="font-bold text-emerald-600">${h.availableIcuBeds} / ${h.totalIcuBeds} Free</span>
              </div>
            </div>
            <p class="text-[9.5px] font-medium text-slate-600 mt-2 bg-slate-50 px-1 py-0.5 rounded leading-normal">
              Specialties: ${h.specialties.join(", ")}
            </p>
          </div>
        `);
      markersGroup.addLayer(marker);
    });

    // 2. Render Clustered Active Incidents
    clusteredIncidents.forEach(item => {
      if (item.isCluster) {
        const icon = L.divIcon({
          className: "custom-incident-cluster-icon",
          html: `<div class="relative flex items-center justify-center">
            <div class="absolute w-10 h-10 rounded-full bg-red-500/25 animate-pulse"></div>
            <div class="w-8 h-8 rounded-full bg-slate-950 border-2 border-red-500 shadow-xl flex items-center justify-center text-red-400 font-extrabold font-mono text-xs">
              ${item.count}
            </div>
          </div>`,
          iconSize: [40, 40],
          iconAnchor: [20, 20]
        });

        const marker = L.marker([item.lat, item.lng], { icon });
        marker.on("click", () => {
          map.setView([item.lat, item.lng], zoom + 2);
        });
        markersGroup.addLayer(marker);
      } else {
        const inc = item;
        const isRed = inc.triageLevel === "RED";

        const icon = L.divIcon({
          className: `custom-incident-marker-${inc.id}`,
          html: `<div class="relative flex items-center justify-center">
            <div class="absolute w-8 h-8 rounded-full ${isRed ? 'bg-red-500/30' : 'bg-amber-500/30'} animate-ping" style="animation-duration: 2.2s;"></div>
            <div class="w-7 h-7 rounded-full ${isRed ? 'bg-red-600' : 'bg-amber-500'} border-2 border-white shadow-xl flex items-center justify-center text-white select-none">
              ${isRed 
                ? '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" class="w-3.5 h-3.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>' 
                : '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" class="w-3.5 h-3.5"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>'
              }
            </div>
          </div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
          popupAnchor: [0, -14]
        });

        const marker = L.marker([inc.lat, inc.lng], { icon })
          .bindPopup(`
            <div class="font-sans p-1 max-w-xs text-slate-800">
              <div class="flex items-center justify-between border-b border-slate-100 pb-1.5 mb-1.5">
                <span class="px-1.5 py-0.5 rounded text-[8.5px] font-bold tracking-wider uppercase text-white ${isRed ? 'bg-red-500' : 'bg-amber-500'}">
                  ${inc.triageLevel} TRIAGE
                </span>
                <span class="text-[9px] font-mono text-slate-400 font-semibold">Priority: ${inc.priorityScore}/100</span>
              </div>
              <h4 class="font-bold text-xs text-slate-900 truncate">${inc.locationName}</h4>
              <p class="text-[10.5px] text-slate-500 mt-1 italic line-clamp-2">"${inc.description}"</p>
              <div class="mt-2.5 pt-2 border-t border-slate-100 flex justify-between items-center text-[10px]">
                <span class="font-bold text-slate-700">Status: <span class="text-indigo-600 font-extrabold">${inc.status}</span></span>
                <button class="bg-indigo-600 text-white font-bold px-2 py-1 rounded cursor-pointer transition-colors hover:bg-indigo-700 font-sans border-none select-incident-btn" data-id="${inc.id}">
                  Focus Dispatch
                </button>
              </div>
            </div>
          `);

        marker.on("popupopen", (e) => {
          const button = e.popup.getElement()?.querySelector(".select-incident-btn");
          if (button) {
            button.addEventListener("click", () => {
              onSelectIncident(inc);
              map.closePopup();
            });
          }
        });

        markersGroup.addLayer(marker);
      }
    });

    // 3. Render Dispatched/Transporting Moving Ambulances
    ambulances.forEach(amb => {
      if (amb.status === "Available") return;

      const icon = L.divIcon({
        className: `custom-ambulance-marker-${amb.id}`,
        html: `<div class="relative flex items-center justify-center">
          <div class="absolute w-7 h-7 rounded-full bg-blue-500/30 animate-pulse"></div>
          <div class="w-6 h-6 rounded-full bg-blue-600 border border-white shadow-lg flex items-center justify-center text-white select-none">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5"><path d="M14 18H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"></path><circle cx="7" cy="18" r="2"></circle><circle cx="17" cy="18" r="2"></circle><path d="M19 18h2a1 1 0 0 0 1-1v-3.5a1.5 1.5 0 0 0-1.5-1.5H19"></path></svg>
          </div>
        </div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        popupAnchor: [0, -12]
      });

      const marker = L.marker([amb.lat, amb.lng], { icon })
        .bindPopup(`
          <div class="font-sans p-1 text-slate-800" style="min-width: 130px;">
            <div class="flex items-center space-x-1.5 border-b border-slate-100 pb-1">
              <span class="text-xs font-bold text-slate-900">${amb.plateNumber}</span>
              <span class="text-[8px] bg-blue-50 text-blue-600 px-1 py-0.5 rounded font-mono font-bold">GPS ACTIVE</span>
            </div>
            <p class="text-[10px] text-slate-500 mt-1.5 font-bold uppercase tracking-wide">
              Status: <span class="text-blue-600">${amb.status}</span>
            </p>
            <p class="text-[9.5px] text-slate-500 mt-1 font-mono">
              Coordinates: ${amb.lat.toFixed(4)}, ${amb.lng.toFixed(4)}
            </p>
          </div>
        `);
      markersGroup.addLayer(marker);
    });

    // 4. Render Locked coordinates pin
    if (pinLocation) {
      const icon = L.divIcon({
        className: "custom-reporter-pin-marker",
        html: `<div class="relative flex items-center justify-center">
          <div class="absolute w-9 h-9 rounded-full bg-indigo-500/30 animate-pulse"></div>
          <div class="w-6 h-6 rounded-full bg-indigo-600 border-2 border-white shadow-xl flex items-center justify-center text-white">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="w-3 h-3"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
          </div>
        </div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      const marker = L.marker([pinLocation.lat, pinLocation.lng], { icon })
        .bindPopup(`
          <div class="font-sans p-1 text-slate-800 text-center">
            <span class="text-[8.5px] bg-indigo-50 text-indigo-600 font-bold px-1.5 py-0.5 rounded">GPS INCIDENT POSITION LOCK</span>
            <h5 class="font-bold text-xs text-slate-900 mt-1">${pinLocation.name}</h5>
            <p class="text-[9.5px] text-slate-500 font-mono mt-0.5">${pinLocation.lat.toFixed(4)}, ${pinLocation.lng.toFixed(4)}</p>
          </div>
        `);
      markersGroup.addLayer(marker);
    }

    // 5. Render User Current GPS location
    if (userGps) {
      const icon = L.divIcon({
        className: "custom-user-gps-marker",
        html: `<div class="relative flex items-center justify-center animate-pulse">
          <div class="absolute w-8 h-8 rounded-full bg-sky-400/50 animate-ping" style="animation-duration: 2.5s"></div>
          <div class="w-4 h-4 rounded-full bg-sky-500 border-2 border-white shadow-xl"></div>
        </div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      });

      const marker = L.marker([userGps.lat, userGps.lng], { icon })
        .bindPopup(`
          <div class="font-sans p-1 text-center">
            <span class="text-[9px] font-bold text-sky-600 flex items-center justify-center space-x-1 uppercase font-mono">
              <span class="w-1.5 h-1.5 bg-sky-400 rounded-full animate-ping"></span>
              <span>Your Live Device GPS</span>
            </span>
            <p class="text-[9.5px] text-slate-400 font-mono mt-1">${userGps.lat.toFixed(4)}, ${userGps.lng.toFixed(4)}</p>
          </div>
        `);
      markersGroup.addLayer(marker);
    }

    // 6. Draw Navigation Route Polylines
    if (selectedIncident) {
      const inc = selectedIncident;
      const incidentLatlng: L.LatLngTuple = [inc.lat, inc.lng];

      const h = hospitals.find(hosp => hosp.id === inc.assignedHospitalId);
      const a = ambulances.find(amb => amb.id === inc.assignedAmbulanceId);

      if (h) {
        const hospitalLatlng: L.LatLngTuple = [h.lat, h.lng];

        if (a && inc.status === "Ambulance Dispatched") {
          const ambLatlng: L.LatLngTuple = [a.lat, a.lng];
          
          // Ambulance -> Incident (Leg 1: High Visibility Blue Dotted Line)
          L.polyline([ambLatlng, incidentLatlng], {
            color: "#3b82f6",
            dashArray: "6, 6",
            weight: 4,
            opacity: 0.9,
            lineCap: "round",
          }).addTo(routeGroup);

          // Incident -> Hospital (Leg 2: Faint Emerald Guideline Line)
          L.polyline([incidentLatlng, hospitalLatlng], {
            color: "#10b981",
            weight: 3,
            opacity: 0.6,
            lineCap: "round",
          }).addTo(routeGroup);

        } else if (a && inc.status === "Transporting") {
          const ambLatlng: L.LatLngTuple = [a.lat, a.lng];

          // Moving Ambulance -> Hospital (Leg 3: Red Line Showing Critical Transit)
          L.polyline([ambLatlng, hospitalLatlng], {
            color: "#ef4444",
            weight: 5,
            opacity: 0.95,
            lineCap: "round",
          }).addTo(routeGroup);

        } else {
          // Direct baseline connection for reported incident to recommend hospital
          L.polyline([incidentLatlng, hospitalLatlng], {
            color: "#f59e0b",
            dashArray: "4, 4",
            weight: 3,
            opacity: 0.7,
            lineCap: "round"
          }).addTo(routeGroup);
        }
      }
      }
      } catch (err) {
        console.warn("Error during redraw:", err);
      }
    }, 0);

    return () => {
      clearTimeout(timer);
    };
  }, [hospitals, ambulances, incidents, selectedIncident, pinLocation, clusteredIncidents, userGps, zoom, redrawTrigger]);

  return (
    <div className="relative w-full overflow-hidden bg-slate-950 rounded-2xl shadow-xl border border-slate-800">
      {/* HUD Header overlay (Absolute top) */}
      <div className="absolute top-4 left-4 z-[400] bg-slate-950/90 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-800 flex items-center space-x-2 text-xs select-none">
        <div className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse inline-block"></span>
          <span className="font-mono text-emerald-400 font-extrabold tracking-wider">LIVELINK HYBRID GRID</span>
        </div>
        <span className="text-slate-700 font-bold">|</span>
        <span className="font-mono text-slate-300 font-bold text-[10px]">PHNOM PENH, CAMBODIA</span>
      </div>

      {/* Control Quick Action Buttons (Absolute right) */}
      <div className="absolute bottom-4 right-4 z-[400] flex flex-col space-y-2">
        {/* Geolocation Lock Button */}
        <button
          onClick={handleLocateMe}
          disabled={locating}
          className="bg-slate-950/95 hover:bg-slate-900 text-slate-200 border border-slate-800 rounded-xl p-2.5 shadow-xl backdrop-blur-md transition-all flex items-center justify-center active:scale-95 cursor-pointer disabled:opacity-50"
          title="Find Current Location"
        >
          <Compass className={`w-4 h-4 text-sky-400 ${locating ? 'animate-spin' : ''}`} />
        </button>

        {/* Fit Map Boundary View */}
        <button
          onClick={handleFitAll}
          className="bg-slate-950/95 hover:bg-slate-900 text-slate-200 border border-slate-800 rounded-xl p-2.5 shadow-xl backdrop-blur-md transition-all flex items-center justify-center active:scale-95 cursor-pointer"
          title="Fit Map bounds to items"
        >
          <Crosshair className="w-4 h-4 text-emerald-400" />
        </button>
      </div>

      {/* Geolocation tutorial helper card */}
      {interactive && !pinLocation && !selectedIncident && (
        <div className="absolute bottom-4 left-4 z-[400] bg-slate-950/95 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-800 max-w-xs text-[10.5px] text-slate-400 shadow-xl flex items-start space-x-2">
          <HelpCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <span>
            <b>Bystander Tip:</b> Click anywhere inside Phnom Penh's map boundaries to place a locked incident pin coordinates on the map grid.
          </span>
        </div>
      )}

      {/* ROUTING TACTICAL INFRASTRUCTURE HUD CARD */}
      {routeInfo && (
        <div className="absolute top-16 left-4 right-4 sm:right-auto z-[400] bg-slate-950/95 border border-slate-800/80 backdrop-blur-md rounded-2xl p-4 shadow-2xl max-w-sm space-y-3">
          <div className="flex items-center space-x-1.5 border-b border-slate-800/60 pb-2">
            <Navigation className="w-4 h-4 text-blue-500 animate-pulse" />
            <span className="text-[10.5px] font-extrabold font-mono text-blue-400 uppercase tracking-widest">
              Live Transit Telemetry
            </span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-500 font-semibold font-mono text-[9px] uppercase">Incident Location:</span>
              <span className="font-bold max-w-[190px] truncate">{routeInfo.incidentName}</span>
            </div>

            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-500 font-semibold font-mono text-[9px] uppercase">Allocated ER Base:</span>
              <span className="font-bold text-emerald-400 max-w-[190px] truncate">{routeInfo.hospitalName || "Pending Triage"}</span>
            </div>

            {routeInfo.ambulancePlate && (
              <div className="flex items-center justify-between text-slate-300 border-b border-slate-800/50 pb-2">
                <span className="text-slate-500 font-semibold font-mono text-[9px] uppercase">Responder Unit:</span>
                <span className="font-mono text-[11px] font-bold bg-blue-950/50 text-blue-300 px-1.5 py-0.5 rounded border border-blue-900/30">
                  {routeInfo.ambulancePlate}
                </span>
              </div>
            )}

            {/* Path details */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="bg-slate-900/40 border border-slate-800/40 p-2 rounded-xl text-center">
                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block font-mono">Leg 1: To Patient</span>
                <span className="text-sm font-extrabold font-mono text-slate-200 mt-1 block">
                  {routeInfo.leg1Dist ? `${routeInfo.leg1Dist.toFixed(2)} km` : "N/A"}
                </span>
                <span className="text-[9px] text-slate-400 font-medium block mt-0.5">
                  {routeInfo.leg1Eta ? `~${routeInfo.leg1Eta} mins ETA` : "No unit active"}
                </span>
              </div>

              <div className="bg-slate-900/40 border border-slate-800/40 p-2 rounded-xl text-center">
                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block font-mono">Leg 2: To ER Bed</span>
                <span className="text-sm font-extrabold font-mono text-slate-200 mt-1 block">
                  {routeInfo.leg2Dist ? `${routeInfo.leg2Dist.toFixed(2)} km` : "N/A"}
                </span>
                <span className="text-[9px] text-slate-400 font-medium block mt-0.5">
                  {routeInfo.leg2Eta ? `~${routeInfo.leg2Eta} mins ETA` : "Triage unresolved"}
                </span>
              </div>
            </div>

            {/* Total Combined Stats */}
            {routeInfo.totalDist > 0 && (
              <div className="bg-blue-950/15 border border-blue-900/30 p-2.5 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block font-mono">Total Route Length</span>
                  <span className="text-xs font-mono font-bold text-slate-300">{routeInfo.totalDist.toFixed(2)} km</span>
                </div>
                <div className="text-right">
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block font-mono">Combined ETA</span>
                  <span className="text-xs font-mono font-extrabold text-blue-400">~{routeInfo.totalEta} mins</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actual Map Container */}
      <div ref={containerRef} className="w-full h-[380px] sm:h-[480px] lg:h-[550px] rounded-2xl z-0" />
    </div>
  );
}
