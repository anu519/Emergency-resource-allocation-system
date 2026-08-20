import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { io } from "socket.io-client";
import {
  Mic, MapPin, Phone, Clock, Bed, Stethoscope, ShieldCheck, Navigation, X, ChevronRight,
  AlertTriangle, Calendar, CheckCircle2, ArrowLeft, Search, Activity, Star, Video, HeartPulse,
  Plus, Minus, RotateCcw, Send, PhoneOff, MicOff, VideoOff, FileText, Users, Globe,
  Bone, Droplet, Thermometer, Baby, Eye, Syringe, Brain, Pill as PillIcon, Scissors,
  Truck, Wind, Flame, Zap, Skull, Loader2,
} from "lucide-react";

/* ============================================================================
   UYIR CARE — frontend wired to the live Uyir Care backend.

   Everything that used to be a hardcoded local array (HOSPITALS, DOCTORS,
   SYMPTOM_MAP, live bed-status simulation) now comes from the API. The
   backend already does specialty detection, hospital ranking, and
   ambulance-trip simulation, so this file's job is: fetch, render, and
   subscribe to the live socket feed.

   Set VITE-style env or just edit API_BASE/SOCKET_URL below to point at
   wherever you deploy the backend.
   ============================================================================ */

const API_BASE = "http://localhost:4000/api";
const SOCKET_URL = "http://localhost:4000";

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

/* ---------------------------- DESIGN TOKENS ---------------------------- */
const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&family=Noto+Sans+Tamil:wght@400;500;600;700&display=swap');`;

const STRINGS = {
  en: {
    tagline: "Tirunelveli · private hospital finder",
    home: "Home",
    callEmergency: "Call 108",
    heroTitle: "Find the right private hospital in Tirunelveli — before you dial anyone.",
    heroSubtitle: "Tap what's wrong, or describe it. We rank nearby hospitals on specialist match, open beds and distance — you make the call, literally.",
    modeEmergency: "Emergency / Urgent",
    modeBooking: "Book Appointment",
    modeVideo: "Video Consult",
    modeSubscription: "Care Plan",
    whatsHappening: "What's happening?",
    symptomHint: "Tap a common emergency below, or type/speak the symptom.",
    findHospitals: "Find hospitals now",
    useLocation: "Use my current location",
    requestingLocation: "Requesting location permission…",
    locationGranted: "Using your current location",
    locationDenied: "Location denied — showing Tirunelveli town centre",
    retry: "retry",
    listeningHint: "Listening — this is a live transcript of what you say, not a script.",
    voiceUnsupported: "Voice input isn't supported in this browser. Try Chrome on desktop or Android — typing works everywhere.",
    lifeThreatening: "Life-threatening right now — unconscious, not breathing, chest pain, stroke signs?",
    callNow: "Call 108 immediately.",
    parallelNote: "This app finds private-hospital options in parallel; it does not replace emergency dispatch.",
    bookHeading: "What's the reason for your visit?",
    bookSub: "Pick what best matches — we'll show doctors who treat it nearby.",
    allHospitals: "All listed hospitals",
    moreShown: "more shown when you search above.",
    statHospitals: "private hospitals listed in Tirunelveli",
    statAmbulance: "24/7 direct-dial ambulance access, no middleman routing",
    stat108: "always shown alongside, never hidden",
    exploreMore: "More ways Uyir Care can help",
    videoCardTitle: "Talk to a doctor by video",
    videoCardSub: "Skip the travel — consult a specialist from home in minutes.",
    subCardTitle: "Long-term Care Plan",
    subCardSub: "For ongoing illness — a personal doctor, prescriptions & health tracking in one place.",
    back: "Back",
    footer: "Uyir Care is a discovery layer, not an emergency dispatcher. For true emergencies always call 108. Hospital directory data is sourced from public listings; live bed/wait figures shown are illustrative pending direct hospital integration. Map data © OpenStreetMap contributors.",
  },
};
const t = (key) => STRINGS.en[key] || key;

/* ---------------------------- EMERGENCY QUICK-TAP GRID ---------------------------- */
/* Tapping one of these fills a canned phrase and searches immediately —
   nobody in an emergency wants to type. The backend's /emergency/search
   still runs full specialty-detection + severity-detection on the text,
   so quick-tap and free-text always resolve the same way. */
const EMERGENCY_QUICK_TAPS = [
  { id: "cardiac", label: "Cardiac arrest", text: "cardiac arrest, not breathing", icon: HeartPulse, critical: true },
  { id: "stroke", label: "Stroke", text: "stroke symptoms, face drooping and slurred speech", icon: Brain, critical: true },
  { id: "accident", label: "Road accident", text: "road accident, major trauma", icon: Truck, critical: true },
  { id: "bleeding", label: "Severe bleeding", text: "severe bleeding, deep cut", icon: Droplet, critical: true },
  { id: "breathing", label: "Can't breathe", text: "severe breathing difficulty, cannot breathe", icon: Wind, critical: true },
  { id: "unconscious", label: "Unconscious", text: "unconscious, not responding", icon: Skull, critical: true },
  { id: "seizure", label: "Seizure / fit", text: "seizure, convulsions", icon: Zap, critical: true },
  { id: "burns", label: "Burns", text: "severe burns", icon: Flame, critical: true },
  { id: "poisoning", label: "Poisoning", text: "poisoning, ingested something toxic", icon: Syringe, critical: true },
  { id: "snakebite", label: "Snake / animal bite", text: "snake bite", icon: Bone, critical: true },
  { id: "fracture", label: "Fracture / fall", text: "fell down, suspected fracture", icon: Bone, critical: false },
  { id: "pregnancy", label: "Pregnancy emergency", text: "pregnancy emergency, labour contractions", icon: Baby, critical: true },
];

/* ---------------------------- CAUSE ICON MAP ---------------------------- */
/* The backend's /causes endpoint returns an icon *key* string (so it never
   has to know about lucide-react). This maps that key to an actual icon
   component for rendering. */
const CAUSE_ICON_MAP = {
  bone: Bone, activity: Activity, droplet: Droplet, thermometer: Thermometer,
  baby: Baby, users: Users, eye: Eye, "heart-pulse": HeartPulse,
  syringe: Syringe, brain: Brain, pill: PillIcon, scissors: Scissors,
};

/* ---------------------------- UTIL: distance / breakdown ---------------------------- */
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Recomputes the same score breakdown the backend used, purely for the
 *  "why ranked" visual — the backend already returns the final `score`. */
function breakdownFor(h) {
  const bedsAvailable = h.status?.bedsAvailable ?? 0;
  const doctorOnDuty = !!h.status?.doctorOnDuty;
  const waitMinutes = h.status?.waitMinutes ?? 20;
  const specialtyScore = h.specialtyMatch ? 40 : 10;
  const distScore = Math.max(0, 25 - (h.distanceKm || 0) * 3.2);
  const availScore = Math.min(20, bedsAvailable * 1.3) + (doctorOnDuty ? 8 : 0);
  const waitScore = Math.max(0, 12 - waitMinutes / 3);
  return [
    { label: "Specialty match", value: Math.round(specialtyScore), max: 40 },
    { label: "Distance", value: Math.round(distScore), max: 25 },
    { label: "Bed / staff availability", value: Math.round(availScore), max: 28 },
    { label: "Wait time", value: Math.round(waitScore), max: 12 },
  ];
}

const TIRUNELVELI_CENTER = { lat: 8.7192, lng: 77.7449 };

/* ============================================================================
   OPENSTREETMAP TILE VIEW — unchanged from the prototype, plus support for
   an "ambulance" marker type that shows a moving Truck icon.
   ============================================================================ */
const TILE_SIZE = 256;
const MIN_ZOOM = 4;
const MAX_ZOOM = 18;

function project(lat, lng, zoom) {
  const scale = TILE_SIZE * Math.pow(2, zoom);
  const siny = Math.min(Math.max(Math.sin((lat * Math.PI) / 180), -0.9999), 0.9999);
  const x = (0.5 + lng / 360) * scale;
  const y = (0.5 - Math.log((1 + siny) / (1 - siny)) / (4 * Math.PI)) * scale;
  return { x, y };
}

function OsmMap({ center, zoom: initialZoom = 13, markers = [], height = 300, onSelect }) {
  const containerRef = useRef(null);
  const [size, setSize] = useState({ w: 600, h: height });
  const [zoom, setZoom] = useState(initialZoom);
  const [centerPx, setCenterPx] = useState(() => project(center.lat, center.lng, initialZoom));
  const dragRef = useRef(null);
  const lastCenterKeyRef = useRef(`${center.lat},${center.lng}`);

  useEffect(() => {
    const key = `${center.lat},${center.lng}`;
    if (key !== lastCenterKeyRef.current) {
      lastCenterKeyRef.current = key;
      setZoom(initialZoom);
      setCenterPx(project(center.lat, center.lng, initialZoom));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center.lat, center.lng]);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setSize({ w: e.contentRect.width, h: height });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [height]);

  const zoomTo = useCallback((newZoomRaw) => {
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, newZoomRaw));
    setZoom((prevZoom) => {
      if (newZoom === prevZoom) return prevZoom;
      const factor = Math.pow(2, newZoom - prevZoom);
      setCenterPx((prevPx) => ({ x: prevPx.x * factor, y: prevPx.y * factor }));
      return newZoom;
    });
  }, []);

  const onWheel = useCallback((e) => { e.preventDefault(); zoomTo(zoom + (e.deltaY < 0 ? 1 : -1)); }, [zoom, zoomTo]);
  const onPointerDown = useCallback((e) => {
    dragRef.current = { startX: e.clientX, startY: e.clientY, startCenterPx: centerPx };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }, [centerPx]);
  const onPointerMove = useCallback((e) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setCenterPx({ x: dragRef.current.startCenterPx.x - dx, y: dragRef.current.startCenterPx.y - dy });
  }, []);
  const onPointerUp = useCallback(() => { dragRef.current = null; }, []);
  const recenter = useCallback(() => {
    setZoom(initialZoom);
    setCenterPx(project(center.lat, center.lng, initialZoom));
  }, [center.lat, center.lng, initialZoom]);

  const originX = centerPx.x - size.w / 2;
  const originY = centerPx.y - size.h / 2;
  const minTileX = Math.floor(originX / TILE_SIZE);
  const maxTileX = Math.floor((originX + size.w) / TILE_SIZE);
  const minTileY = Math.floor(originY / TILE_SIZE);
  const maxTileY = Math.floor((originY + size.h) / TILE_SIZE);

  const tiles = [];
  const maxTile = Math.pow(2, zoom) - 1;
  for (let tx = minTileX; tx <= maxTileX; tx++) {
    for (let ty = minTileY; ty <= maxTileY; ty++) {
      if (ty < 0 || ty > maxTile) continue;
      const wrappedX = ((tx % (maxTile + 1)) + (maxTile + 1)) % (maxTile + 1);
      tiles.push({ key: `${zoom}-${tx}-${ty}`, left: tx * TILE_SIZE - originX, top: ty * TILE_SIZE - originY, src: `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${ty}.png` });
    }
  }

  return (
    <div
      ref={containerRef}
      onWheel={onWheel} onPointerDown={onPointerDown} onPointerMove={onPointerMove}
      onPointerUp={onPointerUp} onPointerLeave={onPointerUp}
      style={{ position: "relative", width: "100%", height, overflow: "hidden", background: "#dde3e0", borderRadius: 14, cursor: dragRef.current ? "grabbing" : "grab", touchAction: "none", userSelect: "none" }}
    >
      {tiles.map((tl) => (
        <img key={tl.key} src={tl.src} alt="" draggable={false} style={{ position: "absolute", left: tl.left, top: tl.top, width: TILE_SIZE, height: TILE_SIZE, userSelect: "none", pointerEvents: "none" }} />
      ))}
      {markers.map((m, i) => {
        const p = project(m.lat, m.lng, zoom);
        const left = p.x - originX;
        const top = p.y - originY;
        if (left < -30 || left > size.w + 30 || top < -30 || top > size.h + 30) return null;
        return (
          <div
            key={m.id || i}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onSelect && onSelect(m)}
            title={m.label}
            style={{ position: "absolute", left, top, transform: "translate(-50%, -100%)", cursor: onSelect ? "pointer" : "default", zIndex: m.type === "ambulance" ? 6 : m.isUser ? 5 : 3, display: "flex", flexDirection: "column", alignItems: "center" }}
          >
            {m.type === "ambulance" ? (
              <div style={{ position: "relative", width: 34, height: 34, transform: "translateY(17px)" }}>
                <span style={{ position: "absolute", inset: -6, borderRadius: "50%", border: "2px solid #E4572E", animation: "uyirPing 1.2s ease-out infinite" }} />
                <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#E4572E", border: "2px solid white", boxShadow: "0 2px 8px rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Truck size={17} color="white" />
                </div>
              </div>
            ) : m.isUser ? (
              <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#2563eb", border: "3px solid white", boxShadow: "0 0 0 4px rgba(37,99,235,0.25)" }} />
            ) : (
              <div style={{ width: 30, height: 30, borderRadius: "50% 50% 50% 0", background: m.critical ? "#E4572E" : "#146A63", transform: "rotate(-45deg)", border: "2px solid white", boxShadow: "0 2px 6px rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ transform: "rotate(45deg)", color: "white", fontSize: 12, fontWeight: 700 }}>+</div>
              </div>
            )}
          </div>
        );
      })}
      <div style={{ position: "absolute", top: 10, right: 10, display: "flex", flexDirection: "column", gap: 6, zIndex: 8 }}>
        <MapCtrlBtn onClick={() => zoomTo(zoom + 1)} label="Zoom in"><Plus size={15} /></MapCtrlBtn>
        <MapCtrlBtn onClick={() => zoomTo(zoom - 1)} label="Zoom out"><Minus size={15} /></MapCtrlBtn>
        <MapCtrlBtn onClick={recenter} label="Recenter"><RotateCcw size={14} /></MapCtrlBtn>
      </div>
      <div style={{ position: "absolute", bottom: 6, right: 8, fontSize: 9, color: "#33403d", background: "rgba(255,255,255,0.75)", padding: "2px 6px", borderRadius: 6, fontFamily: "Inter, sans-serif", pointerEvents: "none" }}>
        © OpenStreetMap contributors · drag to pan · scroll to zoom
      </div>
    </div>
  );
}

function MapCtrlBtn({ onClick, label, children }) {
  return (
    <button onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onClick(); }} title={label}
      style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid #DCE3E1", background: "white", boxShadow: "0 2px 6px rgba(0,0,0,0.15)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#17212B" }}>
      {children}
    </button>
  );
}

/* ============================================================================
   VOICE INPUT — fixed to auto-restart on the browser's natural silence
   timeout instead of silently going dead. Chrome/webkit speech recognition
   ends itself after a few seconds of silence even in "continuous" mode;
   the old version treated that as "stopped" and never resumed, which is
   why it looked broken after the first short pause. Now: if the user
   hasn't tapped stop, an onend event triggers an automatic restart.
   ============================================================================ */
function useVoiceInput() {
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [micError, setMicError] = useState(null);
  const recognitionRef = useRef(null);
  const shouldListenRef = useRef(false); // true whenever the user wants mic on
  const restartTimerRef = useRef(null);

  const buildRecognition = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return null;
    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-IN";

    rec.onresult = (event) => {
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        if (res.isFinal) finalText += res[0].transcript;
        else interimText += res[0].transcript;
      }
      if (finalText) setTranscript((prev) => (prev ? prev + " " : "") + finalText.trim());
      setInterim(interimText);
    };

    rec.onerror = (e) => {
      const code = e.error;
      if (code === "no-speech" || code === "aborted" || code === "network") {
        // Transient — the onend auto-restart below will pick it back up
        // as long as the user still wants the mic on. Don't surface an
        // error for these; that's what made voice input feel broken.
        return;
      }
      shouldListenRef.current = false;
      setListening(false);
      if (code === "not-allowed" || code === "service-not-allowed") {
        setMicError("Microphone permission denied — allow mic access in your browser's site settings, then try again.");
      } else {
        setMicError("Voice recognition hit a snag. Tap the mic to try again, or type instead.");
      }
    };

    rec.onend = () => {
      if (shouldListenRef.current) {
        // Browser closed the session on its own (silence timeout). Restart
        // immediately so it feels continuous to the user.
        clearTimeout(restartTimerRef.current);
        restartTimerRef.current = setTimeout(() => {
          try { rec.start(); } catch (err) { /* may already be starting */ }
        }, 250);
      } else {
        setListening(false);
      }
    };

    return rec;
  }, []);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { setSupported(false); return; }
    recognitionRef.current = buildRecognition();
    return () => {
      shouldListenRef.current = false;
      clearTimeout(restartTimerRef.current);
      try { recognitionRef.current && recognitionRef.current.stop(); } catch (e) {}
    };
  }, [buildRecognition]);

  const start = useCallback(() => {
    setMicError(null);
    setInterim("");
    shouldListenRef.current = true;
    if (!recognitionRef.current) recognitionRef.current = buildRecognition();
    try {
      recognitionRef.current.start();
      setListening(true);
    } catch (e) {
      recognitionRef.current = buildRecognition();
      try {
        recognitionRef.current.start();
        setListening(true);
      } catch (e2) {
        setMicError("Couldn't start the microphone. Please type instead.");
        shouldListenRef.current = false;
      }
    }
  }, [buildRecognition]);

  const stop = useCallback(() => {
    shouldListenRef.current = false;
    clearTimeout(restartTimerRef.current);
    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch (e) {} }
    setListening(false);
  }, []);

  const reset = useCallback(() => { setTranscript(""); setInterim(""); setMicError(null); }, []);

  return { supported, listening, transcript, interim, micError, start, stop, reset, setTranscript };
}

/* ============================================================================
   GEOLOCATION
   ============================================================================ */
function useGeolocation() {
  const [status, setStatus] = useState("idle");
  const [coords, setCoords] = useState(null);
  const [error, setError] = useState(null);

  const request = useCallback(() => {
    if (!navigator.geolocation) { setStatus("unsupported"); return; }
    setStatus("requesting");
    navigator.geolocation.getCurrentPosition(
      (pos) => { setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setStatus("granted"); },
      (err) => { setError(err.message); setStatus("denied"); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  return { status, coords, error, request };
}

/* ============================================================================
   SMALL UI ATOMS
   ============================================================================ */
function LiveDot({ color = "#16a34a" }) {
  return (
    <span style={{ position: "relative", display: "inline-flex", width: 8, height: 8, marginRight: 6 }}>
      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: color, opacity: 0.5, animation: "uyirPing 1.6s cubic-bezier(0,0,0.2,1) infinite" }} />
      <span style={{ position: "relative", width: 8, height: 8, borderRadius: "50%", background: color }} />
    </span>
  );
}

function Pill({ children, tone = "neutral" }) {
  const tones = { neutral: { bg: "#EEF2F1", fg: "#3A4A48" }, good: { bg: "#E5F5EC", fg: "#137A44" }, warn: { bg: "#FDEEE9", fg: "#C03F1F" }, info: { bg: "#E8F1FB", fg: "#1D5A9C" } };
  const tn = tones[tone];
  return <span style={{ background: tn.bg, color: tn.fg, fontSize: 11.5, fontWeight: 600, padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap", fontFamily: "Inter, sans-serif" }}>{children}</span>;
}

function Avatar({ name, size = 44, tone = "#146A63" }) {
  const initials = (name || "").replace("Dr.", "").trim().split(" ").map((w) => w[0]).slice(0, 2).join("");
  return <div style={{ width: size, height: size, borderRadius: "50%", background: tone, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: size * 0.36, flexShrink: 0, fontFamily: "'Space Grotesk', sans-serif" }}>{initials}</div>;
}

function Spinner({ label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#5B6B6A", fontSize: 13, padding: "20px 0" }}>
      <Loader2 size={16} className="uyir-spin" /> {label}
    </div>
  );
}

function AnalysisBreakdown({ breakdown, score }) {
  const maxScore = 105;
  const pct = Math.min(100, Math.round((score / maxScore) * 100));
  return (
    <div style={{ marginTop: 10, background: "linear-gradient(135deg, #F0F7F5 0%, #F6F7F5 100%)", border: "1px solid #DCEAE6", borderRadius: 12, padding: "12px 13px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 12, color: "#146A63", display: "flex", alignItems: "center", gap: 5 }}><Activity size={13} /> Match analysis</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#0E2A2E", background: "white", borderRadius: 999, padding: "2px 9px", border: "1px solid #DCEAE6" }}>{pct}% match</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {breakdown.map((b) => {
          const barPct = Math.max(4, Math.round((Math.max(0, b.value) / b.max) * 100));
          return (
            <div key={b.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 118, fontSize: 10.8, color: "#3A4A48", flexShrink: 0 }}>{b.label}</div>
              <div style={{ flex: 1, height: 6, borderRadius: 999, background: "#E4E9E7", overflow: "hidden" }}>
                <div style={{ width: `${barPct}%`, height: "100%", borderRadius: 999, background: "linear-gradient(90deg,#146A63,#1E9E8F)" }} />
              </div>
              <div style={{ width: 26, textAlign: "right", fontSize: 10.5, fontWeight: 700, color: "#146A63", flexShrink: 0 }}>{Math.max(0, b.value)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================================
   MAIN APP
   ============================================================================ */
export default function UyirCare() {
  const [screen, setScreen] = useState("home");
  const geo = useGeolocation();
  const voice = useVoiceInput();
  const socketRef = useRef(null);

  /* ---- backend data ---- */
  const [hospitals, setHospitals] = useState([]);
  const [causes, setCauses] = useState([]);
  const [loadingHome, setLoadingHome] = useState(true);
  const [apiError, setApiError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [hRes, cRes] = await Promise.all([api("/hospitals"), api("/causes")]);
        if (cancelled) return;
        setHospitals(hRes.hospitals || []);
        setCauses(cRes.causes || []);
      } catch (err) {
        if (!cancelled) setApiError(err.message);
      } finally {
        if (!cancelled) setLoadingHome(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    socketRef.current = io(SOCKET_URL, { transports: ["websocket"] });
    return () => socketRef.current?.disconnect();
  }, []);

  /* ---- emergency / symptom search ---- */
  const [symptomText, setSymptomText] = useState("");
  const [detected, setDetected] = useState(null);
  const [severe, setSevere] = useState(false);
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedHospital, setSelectedHospital] = useState(null);

  /* ---- ambulance tracking ---- */
  const [ambulanceTrip, setAmbulanceTrip] = useState(null); // { id, hospitalId, originLat, originLng, destLat, destLng, etaMinutes, status }
  const [ambulancePos, setAmbulancePos] = useState(null); // { lat, lng, progress }

  const userCoords = geo.coords;
  const mapCenter = userCoords || TIRUNELVELI_CENTER;

  const combinedTranscript = (voice.transcript + " " + voice.interim).trim();
  useEffect(() => { if (combinedTranscript) setSymptomText(combinedTranscript); }, [combinedTranscript]);

  const runSearch = useCallback(async (textOverride) => {
    const text = (textOverride ?? symptomText).trim();
    if (!text) return;
    setSearching(true);
    setApiError(null);
    try {
      const data = await api("/emergency/search", {
        method: "POST",
        body: JSON.stringify({ symptomText: text, lat: userCoords?.lat, lng: userCoords?.lng }),
      });
      setDetected(data.detected);
      setSevere(data.isCritical);
      setResults(data.results || []);
      setScreen("emergency");
    } catch (err) {
      setApiError(err.message);
    } finally {
      setSearching(false);
    }
  }, [symptomText, userCoords]);

  const callAmbulance = useCallback(async (hospital) => {
    try {
      const patientLat = userCoords?.lat ?? TIRUNELVELI_CENTER.lat;
      const patientLng = userCoords?.lng ?? TIRUNELVELI_CENTER.lng;
      const data = await api("/emergency/call-ambulance", {
        method: "POST",
        body: JSON.stringify({ hospitalId: hospital.id, patientLat, patientLng }),
      });
      const trip = data.trip;
      setAmbulanceTrip(trip);
      setAmbulancePos({ lat: trip.originLat, lng: trip.originLng, progress: 0 });
      socketRef.current?.emit("trip:subscribe", trip.id);
    } catch (err) {
      setApiError(err.message);
    }
  }, [userCoords]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    const onPosition = (payload) => {
      if (!ambulanceTrip || payload.tripId !== ambulanceTrip.id) return;
      setAmbulancePos({ lat: payload.lat, lng: payload.lng, progress: payload.progress });
    };
    const onArrived = (payload) => {
      if (!ambulanceTrip || payload.tripId !== ambulanceTrip.id) return;
      setAmbulanceTrip((tr) => (tr ? { ...tr, status: "ARRIVED" } : tr));
    };
    socket.on("position_update", onPosition);
    socket.on("trip_arrived", onArrived);
    return () => {
      socket.off("position_update", onPosition);
      socket.off("trip_arrived", onArrived);
    };
  }, [ambulanceTrip]);

  return (
    <div style={{ fontFamily: "Inter, sans-serif", background: "#F6F7F5", minHeight: "100%", color: "#17212B" }}>
      <style>{`
        ${FONT_IMPORT}
        @keyframes uyirPing { 0% { transform: scale(1); opacity: 0.6; } 75%,100% { transform: scale(2.4); opacity: 0; } }
        @keyframes uyirFade { from { opacity: 0; transform: translateY(6px);} to { opacity: 1; transform: translateY(0);} }
        @keyframes uyirSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .uyir-fade { animation: uyirFade 0.25s ease both; }
        .uyir-spin { animation: uyirSpin 1s linear infinite; }
        .uyir-scroll::-webkit-scrollbar { height: 6px; width: 6px; }
        .uyir-scroll::-webkit-scrollbar-thumb { background: #c7d0cd; border-radius: 8px; }
        button { font-family: 'Inter', sans-serif; }
        input, textarea { font-family: 'Inter', sans-serif; }
      `}</style>

      <Header screen={screen} setScreen={setScreen} />

      {apiError && (
        <div style={{ maxWidth: 1080, margin: "10px auto 0", padding: "0 20px" }}>
          <div style={{ background: "#FDEEE9", border: "1px solid #F3C7BA", color: "#C03F1F", borderRadius: 10, padding: "10px 14px", fontSize: 12.5 }}>
            Couldn't reach the backend ({apiError}). Make sure it's running at {API_BASE}.
          </div>
        </div>
      )}

      {screen === "home" && (
        <HomeScreen
          symptomText={symptomText} setSymptomText={setSymptomText} voice={voice} geo={geo}
          runSearch={runSearch} searching={searching} setScreen={setScreen}
          hospitals={hospitals} loadingHome={loadingHome}
        />
      )}

      {screen === "emergency" && (
        <EmergencyResults
          detected={detected} severe={severe} symptomText={symptomText} results={results}
          mapCenter={mapCenter} userCoords={userCoords} geo={geo}
          setSelectedHospital={setSelectedHospital} setScreen={setScreen}
          callAmbulance={callAmbulance} ambulanceTrip={ambulanceTrip} ambulancePos={ambulancePos}
        />
      )}

      {screen === "booking" && (
        <BookingFlow causes={causes} mapCenter={mapCenter} userCoords={userCoords} geo={geo} setScreen={setScreen} />
      )}

      {screen === "video" && <VideoConsultFlow setScreen={setScreen} />}
      {screen === "subscription" && <SubscriptionFlow setScreen={setScreen} />}

      {selectedHospital && <HospitalDetailModal hospital={selectedHospital} onClose={() => setSelectedHospital(null)} onCall={() => callAmbulance(selectedHospital)} />}

      <Footer />
    </div>
  );
}

/* ---------------------------- HEADER ---------------------------- */
function Header({ screen, setScreen }) {
  const navBtn = (key, label, icon) => (
    <button onClick={() => setScreen(key)} style={{ background: screen === key ? "#146A63" : "transparent", color: "white", border: "1px solid #2C4F4B", borderRadius: 8, padding: "8px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
      {icon}{label}
    </button>
  );
  return (
    <div style={{ position: "sticky", top: 0, zIndex: 40, background: "#0E2A2E", color: "white" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => setScreen("home")}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: "#146A63", display: "flex", alignItems: "center", justifyContent: "center" }}><Activity size={18} color="#F6F7F5" strokeWidth={2.5} /></div>
          <div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18, lineHeight: 1 }}>Uyir Care</div>
            <div style={{ fontSize: 10.5, color: "#9DB5B1", letterSpacing: 0.3 }}>{t("tagline")}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {navBtn("home", t("home"))}
          {navBtn("video", t("modeVideo"), <Video size={13} />)}
          {navBtn("subscription", t("modeSubscription"), <HeartPulse size={13} />)}
          <a href="tel:108" style={{ textDecoration: "none" }}>
            <button style={{ background: "#E4572E", color: "white", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}><Phone size={14} /> {t("callEmergency")}</button>
          </a>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------- HOME SCREEN ---------------------------- */
function HomeScreen({ symptomText, setSymptomText, voice, geo, runSearch, searching, setScreen, hospitals, loadingHome }) {
  const [mode, setMode] = useState("emergency");

  return (
    <div>
      <div style={{ background: "linear-gradient(180deg,#0E2A2E 0%, #123B37 100%)", color: "white", padding: "38px 20px 90px" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto" }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 30, fontWeight: 700, marginBottom: 8, maxWidth: 620 }}>{t("heroTitle")}</div>
          <div style={{ color: "#B9CCC8", fontSize: 14.5, maxWidth: 560, marginBottom: 26 }}>{t("heroSubtitle")}</div>
          <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
            <ModeTab active={mode === "emergency"} color="#E4572E" onClick={() => setMode("emergency")} icon={<AlertTriangle size={15} />} label={t("modeEmergency")} />
            <ModeTab active={mode === "booking"} color="#146A63" onClick={() => setScreen("booking")} icon={<Calendar size={15} />} label={t("modeBooking")} />
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1080, margin: "-64px auto 0", padding: "0 20px" }}>
        <div className="uyir-fade" style={{ background: "white", borderRadius: 16, boxShadow: "0 14px 40px rgba(14,42,46,0.18)", padding: 22 }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{t("whatsHappening")}</div>
          <div style={{ fontSize: 12.5, color: "#5B6B6A", marginBottom: 14 }}>{t("symptomHint")}</div>

          {/* QUICK-TAP EMERGENCY GRID */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px,1fr))", gap: 8, marginBottom: 16 }}>
            {EMERGENCY_QUICK_TAPS.map((q) => {
              const Icon = q.icon;
              return (
                <button
                  key={q.id}
                  onClick={() => { setSymptomText(q.text); runSearch(q.text); }}
                  disabled={searching}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, background: "#F6F7F5", border: "1.5px solid #E4E9E7", borderRadius: 12, padding: "12px 6px", cursor: searching ? "wait" : "pointer", opacity: searching ? 0.6 : 1 }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#E4572E")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#E4E9E7")}
                >
                  <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#FDEEE9", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon size={17} color="#E4572E" />
                  </div>
                  <div style={{ fontSize: 10.5, fontWeight: 600, textAlign: "center", lineHeight: 1.2, color: "#17212B" }}>{q.label}</div>
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <textarea
              value={symptomText}
              onChange={(e) => setSymptomText(e.target.value)}
              placeholder='Or describe it: "severe chest pain and sweating"'
              rows={2}
              style={{ flex: 1, resize: "none", border: "1.5px solid #DCE3E1", borderRadius: 12, padding: "12px 14px", fontSize: 14.5, outline: "none", color: "#17212B" }}
            />
            <VoiceButton voice={voice} />
          </div>

          {voice.micError && (
            <div style={{ marginTop: 8, fontSize: 12, color: "#C03F1F", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span>{voice.micError}</span>
              <button onClick={voice.start} style={{ background: "#FDEEE9", border: "none", color: "#C03F1F", fontWeight: 700, borderRadius: 7, padding: "3px 9px", cursor: "pointer", fontSize: 11.5 }}>{t("retry")}</button>
            </div>
          )}
          {!voice.supported && <div style={{ marginTop: 8, fontSize: 12, color: "#8a7a1a" }}>{t("voiceUnsupported")}</div>}
          {voice.listening && (
            <div style={{ marginTop: 8, fontSize: 12.5, color: "#146A63", display: "flex", alignItems: "center" }}>
              <LiveDot color="#146A63" /> {t("listeningHint")}
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16, flexWrap: "wrap", gap: 10 }}>
            <LocationChip geo={geo} />
            <button
              onClick={() => runSearch()}
              disabled={!symptomText.trim() || searching}
              style={{ background: symptomText.trim() && !searching ? "#E4572E" : "#E9D3CB", color: "white", border: "none", borderRadius: 10, padding: "12px 22px", fontWeight: 700, fontSize: 14.5, cursor: symptomText.trim() && !searching ? "pointer" : "not-allowed", display: "flex", alignItems: "center", gap: 8 }}
            >
              {searching ? <Loader2 size={16} className="uyir-spin" /> : <>{t("findHospitals")} <ChevronRight size={16} /></>}
            </button>
          </div>

          <div style={{ marginTop: 16, padding: "10px 12px", background: "#FDF6E9", border: "1px solid #F1E1B4", borderRadius: 10, fontSize: 12, color: "#7A5E12", display: "flex", gap: 8 }}>
            <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{t("lifeThreatening")} <b>{t("callNow")}</b> {t("parallelNote")}</span>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1080, margin: "34px auto 0", padding: "0 20px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 14 }}>
        <StatCard n={hospitals.length || "…"} label={t("statHospitals")} />
        <StatCard n="24/7" label={t("statAmbulance")} />
        <StatCard n="108" label={t("stat108")} />
      </div>

      <div style={{ maxWidth: 1080, margin: "34px auto 0", padding: "0 20px" }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18, marginBottom: 12 }}>{t("exploreMore")}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 14 }}>
          <div onClick={() => setScreen("video")} style={{ cursor: "pointer", background: "linear-gradient(135deg,#146A63,#0E2A2E)", color: "white", borderRadius: 16, padding: 20, display: "flex", gap: 14, alignItems: "flex-start" }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Video size={20} /></div>
            <div><div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{t("videoCardTitle")}</div><div style={{ fontSize: 12.5, color: "#C7DAD6" }}>{t("videoCardSub")}</div></div>
          </div>
          <div onClick={() => setScreen("subscription")} style={{ cursor: "pointer", background: "white", border: "1.5px solid #E4E9E7", borderRadius: 16, padding: 20, display: "flex", gap: 14, alignItems: "flex-start" }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "#FDEEE9", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><HeartPulse size={20} color="#E4572E" /></div>
            <div><div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4, color: "#17212B" }}>{t("subCardTitle")}</div><div style={{ fontSize: 12.5, color: "#5B6B6A" }}>{t("subCardSub")}</div></div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1080, margin: "40px auto 0", padding: "0 20px 60px" }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18, marginBottom: 12 }}>{t("allHospitals")}</div>
        {loadingHome ? <Spinner label="Loading hospitals from the backend…" /> : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))", gap: 12 }}>
              {hospitals.slice(0, 6).map((h) => (
                <div key={h.id} style={{ background: "white", border: "1px solid #E4E9E7", borderRadius: 12, padding: 14 }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 3 }}>{h.name}</div>
                  <div style={{ fontSize: 11.5, color: "#5B6B6A", marginBottom: 8 }}>{h.area}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>{h.specialties.slice(0, 2).map((s) => <Pill key={s}>{s}</Pill>)}</div>
                </div>
              ))}
            </div>
            {hospitals.length > 6 && <div style={{ fontSize: 11.5, color: "#8a95929e", marginTop: 10 }}>+ {hospitals.length - 6} {t("moreShown")}</div>}
          </>
        )}
      </div>
    </div>
  );
}

function ModeTab({ active, color, onClick, icon, label }) {
  return (
    <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 7, background: active ? "white" : "rgba(255,255,255,0.08)", color: active ? "#0E2A2E" : "white", border: active ? "none" : "1px solid rgba(255,255,255,0.25)", borderRadius: 999, padding: "9px 16px", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>
      <span style={{ color: active ? color : "white" }}>{icon}</span>{label}
    </button>
  );
}

function StatCard({ n, label }) {
  return (
    <div style={{ background: "white", border: "1px solid #E4E9E7", borderRadius: 12, padding: "16px 16px" }}>
      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 22, color: "#146A63" }}>{n}</div>
      <div style={{ fontSize: 12, color: "#5B6B6A", marginTop: 2 }}>{label}</div>
    </div>
  );
}

function VoiceButton({ voice }) {
  return (
    <button onClick={() => (voice.listening ? voice.stop() : voice.start())} disabled={!voice.supported} title={voice.supported ? "Tap to speak your symptom" : "Voice not supported in this browser"}
      style={{ width: 46, height: 46, borderRadius: 12, border: "none", flexShrink: 0, background: voice.listening ? "#E4572E" : "#146A63", color: "white", cursor: voice.supported ? "pointer" : "not-allowed", opacity: voice.supported ? 1 : 0.45, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
      {voice.listening && <span style={{ position: "absolute", inset: -4, borderRadius: 14, border: "2px solid #E4572E", animation: "uyirPing 1.4s ease-out infinite" }} />}
      <Mic size={19} />
    </button>
  );
}

function LocationChip({ geo }) {
  if (geo.status === "granted") return <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#137A44", fontWeight: 600 }}><MapPin size={14} /> {t("locationGranted")}</div>;
  if (geo.status === "denied") return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "#C03F1F" }}>
      <MapPin size={14} /> {t("locationDenied")}
      <button onClick={geo.request} style={{ background: "none", border: "none", color: "#146A63", fontWeight: 700, cursor: "pointer", fontSize: 12.5, textDecoration: "underline" }}>{t("retry")}</button>
    </div>
  );
  return (
    <button onClick={geo.request} disabled={geo.status === "requesting"} style={{ display: "flex", alignItems: "center", gap: 6, background: "#EEF2F1", border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 12.5, fontWeight: 600, color: "#17212B", cursor: "pointer" }}>
      <Navigation size={13} /> {geo.status === "requesting" ? t("requestingLocation") : t("useLocation")}
    </button>
  );
}

/* ---------------------------- EMERGENCY RESULTS ---------------------------- */
function EmergencyResults({ detected, severe, symptomText, results, mapCenter, userCoords, geo, setSelectedHospital, setScreen, callAmbulance, ambulanceTrip, ambulancePos }) {
  const markers = [
    ...(userCoords ? [{ id: "user", lat: userCoords.lat, lng: userCoords.lng, isUser: true, label: "You" }] : []),
    ...results.slice(0, 8).map((h) => ({ id: h.id, lat: h.lat, lng: h.lng, label: h.name, critical: severe })),
    ...(ambulancePos ? [{ id: "ambulance", type: "ambulance", lat: ambulancePos.lat, lng: ambulancePos.lng, label: "Ambulance" }] : []),
  ];

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "20px 20px 60px" }}>
      <button onClick={() => setScreen("home")} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#5B6B6A", fontSize: 13, cursor: "pointer", marginBottom: 14, padding: 0 }}><ArrowLeft size={15} /> {t("back")}</button>

      {severe && (
        <div className="uyir-fade" style={{ background: "#E4572E", color: "white", borderRadius: 14, padding: "16px 18px", marginBottom: 16, display: "flex", alignItems: "center", gap: 14, justifyContent: "space-between", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <AlertTriangle size={26} />
            <div><div style={{ fontWeight: 700, fontSize: 15 }}>{t("lifeThreatening")}</div><div style={{ fontSize: 12.5, opacity: 0.9 }}>{t("parallelNote")}</div></div>
          </div>
          <a href="tel:108" style={{ textDecoration: "none" }}>
            <button style={{ background: "white", color: "#E4572E", border: "none", borderRadius: 10, padding: "12px 20px", fontWeight: 800, fontSize: 14.5, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}><Phone size={16} /> {t("callEmergency")}</button>
          </a>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 4 }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 20 }}>Ranked for: {detected?.label}</div>
        <LocationChip geo={geo} />
      </div>
      <div style={{ fontSize: 12.5, color: "#5B6B6A", marginBottom: 16 }}>"{symptomText}"</div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 360px", gap: 18 }}>
        <div className="uyir-scroll" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {results.slice(0, 8).map((h, idx) => (
            <HospitalCard key={h.id} hospital={h} rank={idx + 1} onOpen={() => setSelectedHospital(h)} onCall={() => callAmbulance(h)} />
          ))}
          {results.length === 0 && <div style={{ color: "#8a9591", fontSize: 13 }}>No hospitals found for this yet — try the backend's seed data or check the connection.</div>}
        </div>
        <div style={{ position: "sticky", top: 78, height: "fit-content" }}>
          <OsmMap center={mapCenter} zoom={13} markers={markers} height={330} onSelect={(m) => { const h = results.find((x) => x.id === m.id); if (h) setSelectedHospital(h); }} />
          <div style={{ fontSize: 11.5, color: "#5B6B6A", marginTop: 8, display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
            <span style={{ width: 10, height: 10, borderRadius: "50% 50% 50% 0", background: "#146A63", transform: "rotate(-45deg)", display: "inline-block" }} /> hospital &nbsp;
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#2563eb", display: "inline-block" }} /> you &nbsp;
            {ambulancePos && <><span style={{ width: 10, height: 10, borderRadius: "50%", background: "#E4572E", display: "inline-block" }} /> ambulance</>}
          </div>

          {ambulanceTrip && (
            <AmbulanceTrackerCard trip={ambulanceTrip} position={ambulancePos} />
          )}
        </div>
      </div>
    </div>
  );
}

/** Live ambulance-en-route card: shows ETA + a progress bar that fills as
 *  `position_update` events arrive over the socket connection. */
function AmbulanceTrackerCard({ trip, position }) {
  const arrived = trip.status === "ARRIVED";
  const pct = position?.progress != null ? Math.round(position.progress * 100) : null;

  return (
    <div className="uyir-fade" style={{ marginTop: 14, background: arrived ? "#E5F5EC" : "white", border: `1px solid ${arrived ? "#BEE6CE" : "#E4E9E7"}`, borderRadius: 14, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: arrived ? "#137A44" : "#E4572E", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Truck size={16} color="white" />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13.5 }}>{arrived ? "Ambulance has arrived" : "Ambulance en route"}</div>
          <div style={{ fontSize: 11.5, color: "#5B6B6A" }}>ETA ~{trip.etaMinutes} min{!arrived && " · tracking live"}</div>
        </div>
      </div>
      {!arrived && (
        <div style={{ height: 8, borderRadius: 999, background: "#EEF2F1", overflow: "hidden" }}>
          <div style={{ width: `${pct ?? 5}%`, height: "100%", background: "linear-gradient(90deg,#E4572E,#F0805A)", transition: "width 1s linear" }} />
        </div>
      )}
      <div style={{ fontSize: 10.5, color: "#8a9591", marginTop: 8 }}>
        {trip.source === "SIMULATED" ? "Demo tracking — position is simulated between hospital and your location." : "Live GPS from the ambulance."}
      </div>
    </div>
  );
}

function HospitalCard({ hospital: h, rank, onOpen, onCall }) {
  const breakdown = breakdownFor(h);
  return (
    <div className="uyir-fade" style={{ background: "white", border: "1px solid #E4E9E7", borderRadius: 14, padding: 16, display: "flex", gap: 14 }}>
      <div style={{ width: 30, height: 30, borderRadius: 8, background: rank === 1 ? "#146A63" : "#EEF2F1", color: rank === 1 ? "white" : "#5B6B6A", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{rank}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div>
            <div onClick={onOpen} style={{ fontWeight: 700, fontSize: 15, cursor: "pointer" }}>{h.name}</div>
            <div style={{ fontSize: 12, color: "#5B6B6A", display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}><MapPin size={12} /> {h.area} · {h.distanceKm} km · ~{h.etaMinutes} min ETA</div>
          </div>
          <button onClick={onCall} style={{ background: "#E4572E", color: "white", border: "none", borderRadius: 9, padding: "9px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}><Phone size={14} /> Call ambulance</button>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
          <Pill tone={h.status?.doctorOnDuty ? "good" : "warn"}>{h.status?.doctorOnDuty ? "Specialist on duty" : "On-call only"}</Pill>
          <Pill tone={h.status?.bedsAvailable > 5 ? "good" : "warn"}><Bed size={11} style={{ verticalAlign: -1, marginRight: 3 }} />{h.status?.bedsAvailable} beds open</Pill>
          <Pill tone={h.status?.waitMinutes < 15 ? "good" : "neutral"}><Clock size={11} style={{ verticalAlign: -1, marginRight: 3 }} />~{h.status?.waitMinutes} min wait</Pill>
          {h.status?.icuAvailable > 0 && <Pill tone="info">{h.status.icuAvailable} ICU free</Pill>}
        </div>

        <AnalysisBreakdown breakdown={breakdown} score={h.score} />

        <div style={{ marginTop: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 4, alignItems: "center", fontSize: 11, color: "#8a9591" }}><LiveDot color="#8a9591" /> demo availability · synced moments ago</div>
          <button onClick={onOpen} style={{ background: "none", border: "none", color: "#146A63", fontWeight: 700, fontSize: 12.5, cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}>Details <ChevronRight size={14} /></button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------- HOSPITAL DETAIL MODAL ---------------------------- */
function HospitalDetailModal({ hospital: h, onClose, onCall }) {
  const breakdown = breakdownFor(h);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(14,42,46,0.55)", zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} className="uyir-scroll" style={{ background: "white", width: "100%", maxWidth: 560, maxHeight: "88vh", overflowY: "auto", borderRadius: "18px 18px 0 0", padding: 22, position: "relative" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 16, right: 16, background: "#F6F7F5", border: "none", borderRadius: 8, width: 30, height: 30, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={16} /></button>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 19, paddingRight: 30 }}>{h.name}</div>
        <div style={{ fontSize: 12.5, color: "#5B6B6A", marginTop: 4, display: "flex", alignItems: "center", gap: 5 }}><MapPin size={13} /> {h.address}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, fontSize: 12.5, color: "#5B6B6A" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Star size={13} color="#C9A227" fill="#C9A227" /> {h.rating}</span>
          <span>· Est. {h.established}</span><span>· {h.beds} beds</span>
        </div>
        {h.score != null && <AnalysisBreakdown breakdown={breakdown} score={h.score} />}
        {h.reasons && (
          <div style={{ marginTop: 10, background: "#F6F7F5", borderRadius: 12, padding: 13, fontSize: 12.5, color: "#3A4A48" }}>
            <div style={{ fontWeight: 700, color: "#146A63", marginBottom: 4 }}>Why this ranking</div>{h.reasons.join(" · ")}
          </div>
        )}
        <div style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Specialties</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{h.specialties.map((s) => <Pill key={s}><Stethoscope size={11} style={{ verticalAlign: -1, marginRight: 3 }} />{s}</Pill>)}</div>
        </div>
        <div style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Insurance accepted</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{h.insurers.map((s) => <Pill key={s} tone="info"><ShieldCheck size={11} style={{ verticalAlign: -1, marginRight: 3 }} />{s}</Pill>)}</div>
        </div>
        {h.status && (
          <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
            <MiniStat label="Beds open" value={h.status.bedsAvailable} />
            <MiniStat label="ICU free" value={h.status.icuAvailable} />
            <MiniStat label="Wait" value={`${h.status.waitMinutes}m`} />
          </div>
        )}
        <div style={{ fontSize: 10.5, color: "#a2aca9", marginTop: 6 }}>Demo figures — connect this hospital's system for a live feed.</div>
        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <a href={`tel:${h.phone}`} onClick={onCall} style={{ flex: 1, textDecoration: "none" }}>
            <button style={{ width: "100%", background: "#E4572E", color: "white", border: "none", borderRadius: 11, padding: "13px", fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><Phone size={16} /> Call {h.phone}</button>
          </a>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div style={{ background: "#F6F7F5", borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
      <div style={{ fontWeight: 700, fontSize: 16, color: "#146A63" }}>{value}</div>
      <div style={{ fontSize: 10.5, color: "#5B6B6A" }}>{label}</div>
    </div>
  );
}

/* ============================================================================
   BOOKING FLOW — cause icon grid -> hospitals with their doctors listed
   (name, role, experience) -> pick a doctor -> pick a slot -> confirm.
   ============================================================================ */
function BookingFlow({ causes, mapCenter, userCoords, geo, setScreen }) {
  const [selectedCause, setSelectedCause] = useState(null);
  const [causeDoctors, setCauseDoctors] = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);

  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);

  const [reasonText, setReasonText] = useState("");
  const [patientName, setPatientName] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [confirmed, setConfirmed] = useState(null);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState(null);

  const pickCause = async (cause) => {
    setSelectedCause(cause);
    setSelectedDoctor(null);
    setSlots([]);
    setLoadingDoctors(true);
    setError(null);
    try {
      const data = await api(`/doctors?causeSlug=${encodeURIComponent(cause.slug)}`);
      setCauseDoctors(data.doctors || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingDoctors(false);
    }
  };

  const pickDoctor = async (doctor) => {
    setSelectedDoctor(doctor);
    setSelectedSlot(null);
    setLoadingSlots(true);
    setError(null);
    try {
      const data = await api(`/doctors/${doctor.id}/slots`);
      setSlots(data.slots || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingSlots(false);
    }
  };

  // Group doctors by hospital so each hospital card lists its doctors
  // underneath with role + experience, as requested.
  const groupedByHospital = useMemo(() => {
    const map = new Map();
    for (const d of causeDoctors) {
      const key = d.hospital.id;
      if (!map.has(key)) map.set(key, { hospital: d.hospital, doctors: [] });
      map.get(key).doctors.push(d);
    }
    const list = Array.from(map.values());
    if (userCoords) {
      list.forEach((g) => { g.distanceKm = Math.round(haversineKm(userCoords.lat, userCoords.lng, g.hospital.lat, g.hospital.lng) * 10) / 10; });
      list.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
    }
    return list;
  }, [causeDoctors, userCoords]);

  const confirmBooking = async () => {
    if (!selectedDoctor || !selectedSlot || !patientName || !patientPhone) return;
    setBooking(true);
    setError(null);
    try {
      const data = await api("/appointments", {
        method: "POST",
        body: JSON.stringify({
          doctorId: selectedDoctor.id,
          hospitalId: selectedDoctor.hospitalId,
          slotId: selectedSlot.id,
          causeSlug: selectedCause?.slug,
          reasonText,
          patientName,
          patientPhone,
        }),
      });
      setConfirmed(data.appointment);
    } catch (err) {
      setError(err.message);
    } finally {
      setBooking(false);
    }
  };

  if (confirmed) {
    return (
      <div style={{ maxWidth: 560, margin: "40px auto", padding: "0 20px 60px" }}>
        <div className="uyir-fade" style={{ background: "white", borderRadius: 16, border: "1px solid #E4E9E7", padding: 28, textAlign: "center" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#E5F5EC", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}><CheckCircle2 size={28} color="#137A44" /></div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 19 }}>Appointment requested</div>
          <div style={{ fontSize: 13, color: "#5B6B6A", marginTop: 6 }}>{confirmed.hospital.name} · {new Date(confirmed.slot.startTime).toLocaleString()} · {confirmed.doctor.name}</div>
          <div style={{ marginTop: 14, background: "#F6F7F5", borderRadius: 12, padding: 14, textAlign: "left", fontSize: 12.5 }}>
            <div><b>Patient:</b> {confirmed.patientName}</div>
            <div><b>Phone:</b> {confirmed.patientPhone}</div>
            {confirmed.reasonText && <div style={{ marginTop: 6 }}><b>Reason for visit:</b> {confirmed.reasonText}</div>}
            <div style={{ marginTop: 6 }}><b>Booking fee:</b> ₹{confirmed.depositAmount} (payable at hospital)</div>
          </div>
          <button onClick={() => setScreen("home")} style={{ marginTop: 20, background: "#146A63", color: "white", border: "none", borderRadius: 10, padding: "12px 20px", fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}>Back to home</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "20px 20px 60px" }}>
      <button onClick={() => (selectedCause ? (setSelectedCause(null), setCauseDoctors([])) : setScreen("home"))} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#5B6B6A", fontSize: 13, cursor: "pointer", marginBottom: 14, padding: 0 }}>
        <ArrowLeft size={15} /> {t("back")}
      </button>

      {error && <div style={{ background: "#FDEEE9", border: "1px solid #F3C7BA", color: "#C03F1F", borderRadius: 10, padding: "10px 14px", fontSize: 12.5, marginBottom: 14 }}>{error}</div>}

      {!selectedCause ? (
        <>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 20, marginBottom: 4 }}>{t("bookHeading")}</div>
          <div style={{ fontSize: 12.5, color: "#5B6B6A", marginBottom: 18 }}>{t("bookSub")}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px,1fr))", gap: 12 }}>
            {causes.map((c) => {
              const Icon = CAUSE_ICON_MAP[c.icon] || Stethoscope;
              return (
                <button key={c.id} onClick={() => pickCause(c)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, background: "white", border: "1.5px solid #E4E9E7", borderRadius: 14, padding: "18px 10px", cursor: "pointer" }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#146A63")} onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#E4E9E7")}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#EAF4F2", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon size={21} color="#146A63" /></div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, textAlign: "center", color: "#17212B" }}>{c.label}</div>
                </button>
              );
            })}
            {causes.length === 0 && <Spinner label="Loading reasons for visit…" />}
          </div>
        </>
      ) : !selectedDoctor ? (
        <>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 20, marginBottom: 4 }}>{selectedCause.label}</div>
          <div style={{ fontSize: 12.5, color: "#5B6B6A", marginBottom: 16 }}>Doctors who treat this, grouped by hospital — pick one to see their open slots.</div>

          <div style={{ background: "white", border: "1px solid #E4E9E7", borderRadius: 14, padding: 14, marginBottom: 18 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}><FileText size={14} color="#146A63" /> Anything else to add? (optional)</div>
            <textarea value={reasonText} onChange={(e) => setReasonText(e.target.value)} placeholder='e.g. "Pain started 3 days ago after a fall"' rows={2} style={{ width: "100%", resize: "none", border: "1.5px solid #DCE3E1", borderRadius: 10, padding: "10px 12px", fontSize: 13.5, outline: "none" }} />
          </div>

          {loadingDoctors ? <Spinner label="Finding doctors…" /> : (
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 360px", gap: 18 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {groupedByHospital.map((g) => (
                  <div key={g.hospital.id} className="uyir-fade" style={{ background: "white", border: "1px solid #E4E9E7", borderRadius: 14, padding: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14.5 }}>{g.hospital.name}</div>
                        <div style={{ fontSize: 12, color: "#5B6B6A", display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}><MapPin size={12} /> {g.hospital.area}{g.distanceKm != null && ` · ${g.distanceKm} km`}</div>
                      </div>
                      <Pill tone="info"><Star size={11} fill="#1D5A9C" style={{ verticalAlign: -1, marginRight: 3 }} />{g.hospital.rating}</Pill>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {g.doctors.map((d) => (
                        <button key={d.id} onClick={() => pickDoctor(d)} style={{ display: "flex", alignItems: "center", gap: 10, background: "#F6F7F5", border: "none", borderRadius: 10, padding: "10px 12px", cursor: "pointer", textAlign: "left" }}>
                          <Avatar name={d.name} size={38} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 13 }}>{d.name}</div>
                            <div style={{ fontSize: 11.5, color: "#5B6B6A" }}>{d.specialty} · {d.expYears} yrs experience</div>
                          </div>
                          <ChevronRight size={16} color="#8a9591" />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {groupedByHospital.length === 0 && <div style={{ color: "#8a9591", fontSize: 13 }}>No doctors found for this yet in the seed data.</div>}
              </div>
              <div style={{ position: "sticky", top: 78, height: "fit-content" }}>
                <OsmMap center={mapCenter} zoom={13} markers={[
                  ...(userCoords ? [{ id: "user", lat: userCoords.lat, lng: userCoords.lng, isUser: true }] : []),
                  ...groupedByHospital.map((g) => ({ id: g.hospital.id, lat: g.hospital.lat, lng: g.hospital.lng, label: g.hospital.name })),
                ]} height={300} />
                <div style={{ marginTop: 10 }}><LocationChip geo={geo} /></div>
              </div>
            </div>
          )}
        </>
      ) : (
        <div style={{ maxWidth: 520 }}>
          <div className="uyir-fade" style={{ background: "white", border: "1px solid #E4E9E7", borderRadius: 14, padding: 18 }}>
            <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
              <Avatar name={selectedDoctor.name} size={50} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{selectedDoctor.name}</div>
                <div style={{ fontSize: 12.5, color: "#5B6B6A" }}>{selectedDoctor.specialty} · {selectedDoctor.expYears} yrs · {selectedDoctor.hospital.name}</div>
              </div>
            </div>

            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Choose a slot</div>
            {loadingSlots ? <Spinner label="Loading open slots…" /> : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                {slots.map((s) => (
                  <button key={s.id} onClick={() => setSelectedSlot(s)} style={{ background: selectedSlot?.id === s.id ? "#146A63" : "#F6F7F5", color: selectedSlot?.id === s.id ? "white" : "#17212B", border: "none", borderRadius: 9, padding: "9px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
                    {new Date(s.startTime).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })}
                  </button>
                ))}
                {slots.length === 0 && <div style={{ color: "#8a9591", fontSize: 12.5 }}>No open slots right now.</div>}
              </div>
            )}

            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Your details</div>
            <input value={patientName} onChange={(e) => setPatientName(e.target.value)} placeholder="Patient name" style={{ width: "100%", border: "1.5px solid #DCE3E1", borderRadius: 10, padding: "10px 12px", fontSize: 13.5, marginBottom: 10, outline: "none" }} />
            <input value={patientPhone} onChange={(e) => setPatientPhone(e.target.value)} placeholder="Phone number" style={{ width: "100%", border: "1.5px solid #DCE3E1", borderRadius: 10, padding: "10px 12px", fontSize: 13.5, marginBottom: 16, outline: "none" }} />

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setSelectedDoctor(null)} style={{ background: "#F6F7F5", border: "none", borderRadius: 10, padding: "12px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{t("back")}</button>
              <button disabled={!selectedSlot || !patientName || !patientPhone || booking} onClick={confirmBooking}
                style={{ flex: 1, background: selectedSlot && patientName && patientPhone && !booking ? "#E4572E" : "#EFD5CC", color: "white", border: "none", borderRadius: 10, padding: "12px 16px", fontWeight: 700, fontSize: 13.5, cursor: selectedSlot && patientName && patientPhone && !booking ? "pointer" : "not-allowed" }}>
                {booking ? "Booking…" : "Confirm booking · ₹150 deposit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   VIDEO CONSULTATION FLOW — now backed by /api/doctors + /api/doctors/:id/slots
   ============================================================================ */
function VideoConsultFlow({ setScreen }) {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [specialtyFilter, setSpecialtyFilter] = useState("All");
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [slots, setSlots] = useState([]);
  const [slot, setSlot] = useState(null);
  const [reason, setReason] = useState("");
  const [inCall, setInCall] = useState(false);
  const [callEnded, setCallEnded] = useState(false);

  useEffect(() => {
    api("/doctors").then((d) => setDoctors(d.doctors || [])).finally(() => setLoading(false));
  }, []);

  const specialties = ["All", ...new Set(doctors.map((d) => d.specialty))];
  const filtered = doctors.filter((d) => {
    const matchesSpecialty = specialtyFilter === "All" || d.specialty === specialtyFilter;
    const q = query.trim().toLowerCase();
    const matchesQuery = !q || d.name.toLowerCase().includes(q) || d.specialty.toLowerCase().includes(q) || d.hospital.name.toLowerCase().includes(q);
    return matchesSpecialty && matchesQuery;
  });

  const pickDoctor = async (d) => {
    setSelectedDoctor(d);
    setSlot(null);
    const data = await api(`/doctors/${d.id}/slots`);
    setSlots(data.slots || []);
  };

  if (inCall && selectedDoctor) return <VideoCallScreen doctor={selectedDoctor} onEnd={() => { setInCall(false); setCallEnded(true); }} />;

  if (callEnded && selectedDoctor) {
    return (
      <div style={{ maxWidth: 560, margin: "40px auto", padding: "0 20px 60px" }}>
        <div className="uyir-fade" style={{ background: "white", borderRadius: 16, border: "1px solid #E4E9E7", padding: 28, textAlign: "center" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#E5F5EC", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}><CheckCircle2 size={28} color="#137A44" /></div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 19 }}>Consultation complete</div>
          <div style={{ fontSize: 13, color: "#5B6B6A", marginTop: 6 }}>{selectedDoctor.name} · {selectedDoctor.specialty}</div>
          <button onClick={() => setScreen("home")} style={{ marginTop: 20, background: "#146A63", color: "white", border: "none", borderRadius: 10, padding: "12px 20px", fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}>Back to home</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "20px 20px 60px" }}>
      <button onClick={() => setScreen("home")} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#5B6B6A", fontSize: 13, cursor: "pointer", marginBottom: 14, padding: 0 }}><ArrowLeft size={15} /> {t("back")}</button>

      {loading ? <Spinner label="Loading doctors…" /> : !selectedDoctor ? (
        <>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 20, marginBottom: 4 }}>{t("modeVideo")}</div>
          <div style={{ fontSize: 12.5, color: "#5B6B6A", marginBottom: 16 }}>Search for a doctor by name, specialty, or hospital, then book a video slot.</div>
          <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 220, position: "relative" }}>
              <Search size={15} style={{ position: "absolute", left: 12, top: 12, color: "#8a9591" }} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search doctor, specialty, or hospital…" style={{ width: "100%", border: "1.5px solid #DCE3E1", borderRadius: 10, padding: "10px 12px 10px 34px", fontSize: 13.5, outline: "none" }} />
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 18 }}>
            {specialties.map((s) => (
              <button key={s} onClick={() => setSpecialtyFilter(s)} style={{ background: s === specialtyFilter ? "#146A63" : "white", color: s === specialtyFilter ? "white" : "#17212B", border: "1.5px solid " + (s === specialtyFilter ? "#146A63" : "#E4E9E7"), borderRadius: 999, padding: "7px 13px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>{s}</button>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 14 }}>
            {filtered.map((d) => (
              <div key={d.id} className="uyir-fade" style={{ background: "white", border: "1px solid #E4E9E7", borderRadius: 14, padding: 16 }}>
                <div style={{ display: "flex", gap: 12 }}>
                  <Avatar name={d.name} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14.5 }}>{d.name}</div>
                    <div style={{ fontSize: 12, color: "#5B6B6A" }}>{d.specialty} · {d.expYears} yrs exp</div>
                    <div style={{ fontSize: 11.5, color: "#8a9591", marginTop: 1 }}>{d.hospital.name}</div>
                  </div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 10 }}>
                  <Pill tone="info"><Star size={11} fill="#1D5A9C" style={{ verticalAlign: -1, marginRight: 3 }} />{d.rating}</Pill>
                  <Pill>₹{d.fee} / consult</Pill>
                  <Pill tone="good">{d.languages.join(" · ")}</Pill>
                </div>
                <button onClick={() => pickDoctor(d)} style={{ marginTop: 12, width: "100%", background: "#146A63", color: "white", border: "none", borderRadius: 10, padding: "10px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Video size={14} /> Book video consult</button>
              </div>
            ))}
            {filtered.length === 0 && <div style={{ color: "#8a9591", fontSize: 13, gridColumn: "1/-1" }}>No doctors match that search.</div>}
          </div>
        </>
      ) : (
        <div style={{ maxWidth: 520 }}>
          <div className="uyir-fade" style={{ background: "white", border: "1px solid #E4E9E7", borderRadius: 14, padding: 18 }}>
            <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
              <Avatar name={selectedDoctor.name} size={52} />
              <div><div style={{ fontWeight: 700, fontSize: 16 }}>{selectedDoctor.name}</div><div style={{ fontSize: 12.5, color: "#5B6B6A" }}>{selectedDoctor.specialty} · {selectedDoctor.hospital.name}</div></div>
            </div>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Choose a video slot</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {slots.map((s) => (
                <button key={s.id} onClick={() => setSlot(s)} style={{ background: slot?.id === s.id ? "#146A63" : "#F6F7F5", color: slot?.id === s.id ? "white" : "#17212B", border: "none", borderRadius: 9, padding: "9px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
                  {new Date(s.startTime).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })}
                </button>
              ))}
              {slots.length === 0 && <div style={{ color: "#8a9591", fontSize: 12.5 }}>No open slots right now.</div>}
            </div>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>What would you like to discuss? (optional)</div>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. reviewing my latest blood sugar readings" rows={2} style={{ width: "100%", resize: "none", border: "1.5px solid #DCE3E1", borderRadius: 10, padding: "10px 12px", fontSize: 13, outline: "none", marginBottom: 16 }} />
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setSelectedDoctor(null)} style={{ background: "#F6F7F5", border: "none", borderRadius: 10, padding: "12px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{t("back")}</button>
              <button disabled={!slot} onClick={() => setInCall(true)} style={{ flex: 1, background: slot ? "#146A63" : "#CFE0DC", color: "white", border: "none", borderRadius: 10, padding: "12px 16px", fontWeight: 700, fontSize: 13.5, cursor: slot ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><Video size={15} /> Join video call now (demo)</button>
            </div>
            <div style={{ fontSize: 10.5, color: "#8a9591", marginTop: 8 }}>This still simulates the call locally — wiring real WebRTC to the backend's /video/start + socket signaling is the next step when you're ready.</div>
          </div>
        </div>
      )}
    </div>
  );
}

function VideoCallScreen({ doctor, onEnd }) {
  const [seconds, setSeconds] = useState(0);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  useEffect(() => { const id = setInterval(() => setSeconds((s) => s + 1), 1000); return () => clearInterval(id); }, []);
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div style={{ maxWidth: 720, margin: "20px auto", padding: "0 20px 60px" }}>
      <div style={{ background: "#0E2A2E", borderRadius: 18, padding: 16, position: "relative", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", color: "white", marginBottom: 10, padding: "0 4px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600 }}><LiveDot color="#E4572E" /> {mm}:{ss}</div>
          <div style={{ fontSize: 12.5, color: "#B9CCC8" }}>Demo video call — no real stream</div>
        </div>
        <div style={{ background: "linear-gradient(135deg,#146A63,#1E9E8F)", borderRadius: 14, height: 340, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "white", position: "relative" }}>
          <Avatar name={doctor.name} size={84} tone="rgba(255,255,255,0.2)" />
          <div style={{ fontWeight: 700, fontSize: 16, marginTop: 12 }}>{doctor.name}</div>
          <div style={{ fontSize: 12.5, color: "#DCEFEA" }}>{doctor.specialty}</div>
          <div style={{ position: "absolute", bottom: 12, right: 12, width: 96, height: 72, borderRadius: 10, background: "#0E2A2E", border: "2px solid rgba(255,255,255,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {camOn ? <span style={{ fontSize: 11, color: "#B9CCC8" }}>You</span> : <VideoOff size={18} color="#B9CCC8" />}
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 14, marginTop: 16 }}>
          <CallBtn active={micOn} onClick={() => setMicOn((m) => !m)}>{micOn ? <Mic size={18} /> : <MicOff size={18} />}</CallBtn>
          <CallBtn active={camOn} onClick={() => setCamOn((c) => !c)}>{camOn ? <Video size={18} /> : <VideoOff size={18} />}</CallBtn>
          <button onClick={onEnd} style={{ width: 52, height: 52, borderRadius: "50%", background: "#E4572E", border: "none", color: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><PhoneOff size={20} /></button>
        </div>
      </div>
    </div>
  );
}

function CallBtn({ active, onClick, children }) {
  return <button onClick={onClick} style={{ width: 52, height: 52, borderRadius: "50%", background: active ? "rgba(255,255,255,0.15)" : "#E4572E", border: "1px solid rgba(255,255,255,0.3)", color: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>{children}</button>;
}

/* ============================================================================
   SUBSCRIPTION / CARE PLAN — still a lightweight local demo. Wiring this to
   /api/care-plans, /api/vitals, /api/prescriptions and /api/messages
   requires being logged in (JWT), so it's the natural next backend-linking
   step once you've added a login screen to the frontend.
   ============================================================================ */
function SubscriptionFlow({ setScreen }) {
  const [doctors, setDoctors] = useState([]);
  const [plan, setPlan] = useState(null);
  const [vitals, setVitals] = useState([]);
  const [newBp, setNewBp] = useState("");
  const [newSugar, setNewSugar] = useState("");
  const [newWeight, setNewWeight] = useState("");
  const [refillSent, setRefillSent] = useState(false);
  const [messages, setMessages] = useState([]);
  const [msgText, setMsgText] = useState("");

  const CARE_PLANS = [
    { id: "basic", name: "Basic", price: 499, tagline: "Stay on top of routine care", features: ["Monthly teleconsult with a general physician", "Prescription refill reminders", "Digital health record storage"] },
    { id: "care", name: "Care+", price: 999, tagline: "For managing an ongoing condition", highlight: true, features: ["Everything in Basic", "A personal doctor assigned to you", "Home health monitoring (BP, sugar, weight trends)", "Unlimited prescription refill requests", "Priority video consult booking"] },
    { id: "premium", name: "Premium", price: 1999, tagline: "Full hospital-at-home support", features: ["Everything in Care+", "Home sample collection for lab tests", "Priority ambulance dispatch flag on file", "Monthly in-person check-up at partner hospital", "24/7 nurse helpline"] },
  ];

  useEffect(() => { api("/doctors").then((d) => setDoctors(d.doctors || [])); }, []);
  const assignedDoctor = doctors.find((d) => d.specialty === "General Medicine") || doctors[0];

  const addVital = () => {
    if (!newBp && !newSugar && !newWeight) return;
    setVitals((v) => [...v, { date: "Today", bp: newBp || "—", sugar: newSugar ? Number(newSugar) : null, weight: newWeight ? Number(newWeight) : null }]);
    setNewBp(""); setNewSugar(""); setNewWeight("");
  };
  const sendMessage = () => {
    if (!msgText.trim()) return;
    setMessages((m) => [...m, { from: "you", text: msgText.trim() }]);
    setMsgText("");
    setTimeout(() => setMessages((m) => [...m, { from: "doctor", text: "Thanks for the update — I'll review this and respond within 24 hours. Call 108 if anything feels urgent in the meantime." }]), 900);
  };
  const maxSugar = Math.max(...vitals.map((v) => v.sugar || 0), 1);

  if (!plan) {
    return (
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "20px 20px 60px" }}>
        <button onClick={() => setScreen("home")} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#5B6B6A", fontSize: 13, cursor: "pointer", marginBottom: 14, padding: 0 }}><ArrowLeft size={15} /> {t("back")}</button>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 22, marginBottom: 6 }}>{t("subCardTitle")}</div>
        <div style={{ fontSize: 13, color: "#5B6B6A", marginBottom: 22, maxWidth: 560 }}>{t("subCardSub")}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 16 }}>
          {CARE_PLANS.map((p) => (
            <div key={p.id} style={{ background: "white", borderRadius: 16, padding: 22, border: p.highlight ? "2px solid #146A63" : "1px solid #E4E9E7", position: "relative", boxShadow: p.highlight ? "0 14px 34px rgba(20,106,99,0.16)" : "none" }}>
              {p.highlight && <div style={{ position: "absolute", top: -12, left: 20, background: "#146A63", color: "white", fontSize: 10.5, fontWeight: 700, padding: "3px 10px", borderRadius: 999 }}>MOST POPULAR</div>}
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18 }}>{p.name}</div>
              <div style={{ fontSize: 12, color: "#5B6B6A", marginBottom: 10 }}>{p.tagline}</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: "#146A63" }}>₹{p.price}<span style={{ fontSize: 12, color: "#8a9591", fontWeight: 500 }}> /month</span></div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14, marginBottom: 18 }}>
                {p.features.map((f) => <div key={f} style={{ display: "flex", gap: 8, fontSize: 12.5, color: "#3A4A48" }}><CheckCircle2 size={15} color="#146A63" style={{ flexShrink: 0, marginTop: 1 }} /> {f}</div>)}
              </div>
              <button onClick={() => setPlan(p)} style={{ width: "100%", background: p.highlight ? "#146A63" : "#F6F7F5", color: p.highlight ? "white" : "#17212B", border: "none", borderRadius: 10, padding: "12px 14px", fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}>Choose {p.name}</button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "20px 20px 60px" }}>
      <button onClick={() => setPlan(null)} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#5B6B6A", fontSize: 13, cursor: "pointer", marginBottom: 14, padding: 0 }}><ArrowLeft size={15} /> Change plan</button>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 18 }}>
        <div><div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 20 }}>Your Care Plan dashboard</div><div style={{ fontSize: 12.5, color: "#5B6B6A" }}>{plan.name} plan · ₹{plan.price}/month</div></div>
        <Pill tone="good"><CheckCircle2 size={12} style={{ verticalAlign: -1, marginRight: 3 }} />Active membership (demo)</Pill>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 16 }}>
        {assignedDoctor && (
          <div style={{ background: "white", border: "1px solid #E4E9E7", borderRadius: 14, padding: 18 }}>
            <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}><Users size={15} color="#146A63" /> Your personal doctor</div>
            <div style={{ display: "flex", gap: 12 }}><Avatar name={assignedDoctor.name} size={48} /><div><div style={{ fontWeight: 700, fontSize: 14.5 }}>{assignedDoctor.name}</div><div style={{ fontSize: 12, color: "#5B6B6A" }}>{assignedDoctor.specialty} · {assignedDoctor.hospital?.name}</div></div></div>
            <button onClick={() => setScreen("video")} style={{ marginTop: 14, width: "100%", background: "#146A63", color: "white", border: "none", borderRadius: 10, padding: "10px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Video size={14} /> Start video consult</button>
          </div>
        )}
        <div style={{ background: "white", border: "1px solid #E4E9E7", borderRadius: 14, padding: 18, gridColumn: "span 2" }}>
          <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}><HeartPulse size={15} color="#146A63" /> Health monitoring</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
            {vitals.map((v, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 52, fontSize: 11, color: "#8a9591", flexShrink: 0 }}>{v.date}</div>
                <div style={{ flex: 1, height: 8, borderRadius: 999, background: "#EEF2F1", overflow: "hidden" }}><div style={{ width: `${Math.min(100, ((v.sugar || 0) / maxSugar) * 100)}%`, height: "100%", background: "linear-gradient(90deg,#146A63,#1E9E8F)" }} /></div>
                <div style={{ width: 130, fontSize: 11, color: "#3A4A48", flexShrink: 0 }}>BP {v.bp} · sugar {v.sugar ?? "—"} · {v.weight ?? "—"}kg</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input value={newBp} onChange={(e) => setNewBp(e.target.value)} placeholder="BP e.g. 120/80" style={{ flex: 1, minWidth: 110, border: "1.5px solid #DCE3E1", borderRadius: 9, padding: "9px 10px", fontSize: 12.5, outline: "none" }} />
            <input value={newSugar} onChange={(e) => setNewSugar(e.target.value)} placeholder="Sugar mg/dL" style={{ flex: 1, minWidth: 110, border: "1.5px solid #DCE3E1", borderRadius: 9, padding: "9px 10px", fontSize: 12.5, outline: "none" }} />
            <input value={newWeight} onChange={(e) => setNewWeight(e.target.value)} placeholder="Weight kg" style={{ flex: 1, minWidth: 100, border: "1.5px solid #DCE3E1", borderRadius: 9, padding: "9px 10px", fontSize: 12.5, outline: "none" }} />
            <button onClick={addVital} style={{ background: "#146A63", color: "white", border: "none", borderRadius: 9, padding: "9px 16px", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>Log reading</button>
          </div>
        </div>
        <div style={{ background: "white", border: "1px solid #E4E9E7", borderRadius: 14, padding: 18, gridColumn: "span 2" }}>
          <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 12 }}>Message your doctor</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12, maxHeight: 160, overflowY: "auto" }} className="uyir-scroll">
            {messages.length === 0 && <div style={{ fontSize: 12, color: "#8a9591" }}>No messages yet.</div>}
            {messages.map((m, i) => <div key={i} style={{ alignSelf: m.from === "you" ? "flex-end" : "flex-start", background: m.from === "you" ? "#146A63" : "#F6F7F5", color: m.from === "you" ? "white" : "#17212B", borderRadius: 10, padding: "8px 12px", fontSize: 12.5, maxWidth: "80%" }}>{m.text}</div>)}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={msgText} onChange={(e) => setMsgText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendMessage()} placeholder="Type a message to your doctor…" style={{ flex: 1, border: "1.5px solid #DCE3E1", borderRadius: 9, padding: "10px 12px", fontSize: 12.5, outline: "none" }} />
            <button onClick={sendMessage} style={{ background: "#146A63", color: "white", border: "none", borderRadius: 9, width: 40, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Send size={15} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------- FOOTER ---------------------------- */
function Footer() {
  return <div style={{ borderTop: "1px solid #E4E9E7", padding: "18px 20px", textAlign: "center", fontSize: 11, color: "#8a9591" }}>{t("footer")}</div>;
}