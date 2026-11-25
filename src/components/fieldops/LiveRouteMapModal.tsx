import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { fetchRoute, OsrmRoute } from '../../lib/osrm';
import { 
  X, 
  Navigation, 
  MapPin, 
  Clock, 
  ExternalLink, 
  Radio, 
  Building2, 
  CheckCircle2, 
  Stethoscope, 
  Camera, 
  Maximize2, 
  Package, 
  FileText, 
  ChevronLeft, 
  ChevronRight,
  ShieldCheck,
  IndianRupee,
  Calendar
} from 'lucide-react';
import { Employee, FieldVisit } from '../../types';

// Map Bounds Auto-Fitter
function BoundsFitter({ bounds }: { bounds: L.LatLngBoundsExpression | null }) {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    if (bounds) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [bounds, map]);
  return null;
}

// 1. START POINT MARKER: Strictly CIRCLE (as requested by client)
const createCircleStartIcon = (label: string, isEnd: boolean = false) => {
  const bg = isEnd ? '#475569' : '#0284c7';
  const iconSymbol = isEnd ? '🏁' : '🏢';
  return L.divIcon({
    className: 'custom-circle-start-icon',
    html: `
      <div style="position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center;">
        <div style="width: 38px; height: 38px; background: ${bg}; border-radius: 50%; border: 3px solid #ffffff; box-shadow: 0 4px 14px rgba(2,132,199,0.5); display: flex; align-items: center; justify-content: center; color: #ffffff; font-size: 15px;">
          ${iconSymbol}
        </div>
        <div style="margin-top: 2px; background: rgba(15,23,42,0.85); color: #ffffff; font-size: 9px; font-weight: 800; padding: 1px 6px; border-radius: 10px; white-space: nowrap; font-family: sans-serif; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">
          ${isEnd ? 'END' : 'START'}
        </div>
      </div>
    `,
    iconSize: [40, 52],
    iconAnchor: [20, 26]
  });
};

// 2. DOCTOR VISIT CALL MARKER: Strictly SQUARE (as requested by client)
const createSquareDoctorIcon = (
  stopNumber: number,
  status: 'COMPLETED' | 'IN_TRANSIT' | 'UPCOMING',
  isSelected: boolean = false
) => {
  let bgColor = '#475569'; // Upcoming (Slate)
  let shadowColor = 'rgba(71,85,105,0.4)';
  let badgeIcon = '';

  if (status === 'COMPLETED') {
    bgColor = '#059669'; // Completed (Green)
    shadowColor = 'rgba(5,150,105,0.5)';
    badgeIcon = '✓';
  } else if (status === 'IN_TRANSIT') {
    bgColor = '#d97706'; // In-Transit (Amber)
    shadowColor = 'rgba(217,119,6,0.6)';
    badgeIcon = '●';
  }

  const selectedRing = isSelected 
    ? 'outline: 3px solid #f59e0b; outline-offset: 3px; transform: scale(1.15); z-index: 1000;' 
    : '';

  return L.divIcon({
    className: 'custom-square-doctor-icon',
    html: `
      <div style="position: relative; display: flex; flex-direction: column; align-items: center; ${selectedRing} transition: transform 0.2s ease;">
        ${status === 'IN_TRANSIT' ? `
          <div style="position: absolute; width: 44px; height: 44px; background: ${bgColor}; border-radius: 8px; opacity: 0.3; animation: ping 2s cubic-bezier(0,0,0.2,1) infinite;"></div>
        ` : ''}
        
        <!-- Strict Square Box -->
        <div style="width: 34px; height: 34px; background: ${bgColor}; border-radius: 6px; border: 2.5px solid #ffffff; box-shadow: 0 4px 12px ${shadowColor}; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #ffffff; font-family: sans-serif;">
          <span style="font-size: 13px; font-weight: 900; line-height: 1;">${stopNumber}</span>
          ${badgeIcon ? `<span style="font-size: 9px; font-weight: 900; line-height: 1; margin-top: 1px;">${badgeIcon}</span>` : ''}
        </div>

        <div style="margin-top: 2px; background: rgba(15,23,42,0.85); color: #ffffff; font-size: 9px; font-weight: 800; padding: 1px 5px; border-radius: 4px; white-space: nowrap; font-family: sans-serif; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">
          Call ${stopNumber}
        </div>
      </div>
    `,
    iconSize: [36, 50],
    iconAnchor: [18, 25]
  });
};

// 3. Live Rep Marker (Radar beacon)
const createLiveRepLocationIcon = (repInitials: string) => {
  return L.divIcon({
    className: 'custom-map-rep-icon',
    html: `
      <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 54px; height: 54px;">
        <div style="position: absolute; width: 54px; height: 54px; background-color: #0d9488; border-radius: 50%; opacity: 0.25; animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
        <div style="position: absolute; width: 38px; height: 38px; background-color: #14b8a6; border-radius: 50%; opacity: 0.35;"></div>
        <div style="position: relative; width: 30px; height: 30px; background: linear-gradient(135deg, #0f766e, #115e59); border-radius: 50%; border: 3px solid #ffffff; box-shadow: 0 4px 14px rgba(15,118,110,0.6); display: flex; align-items: center; justify-content: center; color: #ffffff; font-weight: 900; font-size: 11px; font-family: sans-serif;">
          ${repInitials}
        </div>
      </div>
    `,
    iconSize: [54, 54],
    iconAnchor: [27, 27]
  });
};

export interface RouteTargetNode {
  id: string;
  type: 'start' | 'doctor' | 'end';
  nodeNumber?: number;
  label: string;
  doctorName?: string;
  clinicName?: string;
  address?: string;
  lat: number;
  lng: number;
  status: 'COMPLETED' | 'IN_TRANSIT' | 'UPCOMING';
  time?: string;
  visit?: FieldVisit;
}

interface LiveRouteMapModalProps {
  employee: Employee;
  startLocation: { lat: number; lng: number; label: string; time?: string };
  endLocation?: { lat: number; lng: number; label: string; time?: string };
  visits: FieldVisit[];
  initialSelectedVisitId?: string | null;
  onClose: () => void;
  onOpenPhoto?: (photoUrl: string, title: string) => void;
}

export const LiveRouteMapModal: React.FC<LiveRouteMapModalProps> = ({
  employee,
  startLocation,
  endLocation,
  visits,
  initialSelectedVisitId,
  onClose,
  onOpenPhoto
}) => {
  // Sort visits by schedule
  const sortedVisits = useMemo(() => {
    return [...visits].sort((a, b) => {
      const timeA = a.scheduledStart || a.startedAt || '99:99';
      const timeB = b.scheduledStart || b.startedAt || '99:99';
      return timeA.localeCompare(timeB);
    });
  }, [visits]);

  // Build the complete stops itinerary
  const routeNodes: RouteTargetNode[] = useMemo(() => {
    const nodes: RouteTargetNode[] = [];

    // 1. Start Node (Office) - Shape: CIRCLE
    nodes.push({
      id: 'start-node',
      type: 'start',
      label: startLocation.label || 'Start Location (Office)',
      address: startLocation.label,
      lat: startLocation.lat,
      lng: startLocation.lng,
      status: 'COMPLETED',
      time: startLocation.time || '09:00 AM'
    });

    // 2. Doctor Visits - Shape: SQUARE
    sortedVisits.forEach((v, idx) => {
      const isCompleted = v.status === 'COMPLETED';
      const isInTransit = v.status === 'EN_ROUTE' || v.status === 'ARRIVED' || v.status === 'IN_PROGRESS';
      const status = isCompleted ? 'COMPLETED' : isInTransit ? 'IN_TRANSIT' : 'UPCOMING';

      const docTitle = v.doctorName 
        ? `Dr. ${v.doctorName.replace(/^Dr\.?\s*/i, '')}`
        : v.title;

      const clinicTitle = v.clinicName || v.hospitalName || v.assignedAddress || 'Assigned Territory';

      nodes.push({
        id: v.id,
        type: 'doctor',
        nodeNumber: idx + 1,
        label: docTitle,
        doctorName: docTitle,
        clinicName: clinicTitle,
        address: v.assignedAddress || v.actualAddress || clinicTitle,
        lat: v.assignedLatitude ?? v.actualLatitude ?? startLocation.lat,
        lng: v.assignedLongitude ?? v.actualLongitude ?? startLocation.lng,
        status,
        time: isCompleted ? (v.completedAt?.split('T')[1]?.slice(0, 5) || v.scheduledStart) : v.scheduledStart,
        visit: v
      });
    });

    // 3. Final Office Return Node (if configured)
    if (endLocation) {
      nodes.push({
        id: 'end-node',
        type: 'end',
        label: endLocation.label || 'Final Stop (Office)',
        address: endLocation.label,
        lat: endLocation.lat,
        lng: endLocation.lng,
        status: endLocation.time ? 'COMPLETED' : 'UPCOMING',
        time: endLocation.time || '06:00 PM'
      });
    }

    return nodes;
  }, [startLocation, endLocation, sortedVisits]);

  // Selected Doctor for detail popup/drawer
  const [selectedNode, setSelectedNode] = useState<RouteTargetNode | null>(() => {
    if (initialSelectedVisitId) {
      const found = routeNodes.find(n => n.id === initialSelectedVisitId);
      if (found) return found;
    }
    // Default to the first doctor call if available
    const firstDoctor = routeNodes.find(n => n.type === 'doctor');
    return firstDoctor || null;
  });

  // State for Multi-Stop Entire Road Route Polylines
  const [combinedPolyline, setCombinedPolyline] = useState<[number, number][]>([]);
  const [totalDistanceKm, setTotalDistanceKm] = useState<string>('--');
  const [totalDurationFormatted, setTotalDurationFormatted] = useState<string>('--');
  const [loadingRoute, setLoadingRoute] = useState(true);

  // Close on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Fetch continuous road routes between all sequential stops of the day
  useEffect(() => {
    let isCancelled = false;

    async function loadEntireDayRoute() {
      if (routeNodes.length < 2) {
        setLoadingRoute(false);
        return;
      }

      setLoadingRoute(true);
      try {
        const fullCoords: [number, number][] = [];
        let totalMeters = 0;
        let totalSeconds = 0;

        // Fetch each leg sequentially
        for (let i = 0; i < routeNodes.length - 1; i++) {
          const from = routeNodes[i];
          const to = routeNodes[i + 1];

          if (!from.lat || !from.lng || !to.lat || !to.lng) continue;

          const legRoute = await fetchRoute(from.lat, from.lng, to.lat, to.lng);
          if (legRoute && legRoute.polylineCoords.length > 0) {
            fullCoords.push(...legRoute.polylineCoords);
            totalMeters += legRoute.distanceMeters;
            totalSeconds += legRoute.durationSeconds;
          } else {
            // Direct fallback line
            fullCoords.push([from.lat, from.lng], [to.lat, to.lng]);
          }
        }

        if (!isCancelled) {
          setCombinedPolyline(fullCoords);
          setTotalDistanceKm((totalMeters / 1000).toFixed(1));
          
          const totalMins = Math.round(totalSeconds / 60);
          const formatted = totalMins >= 60 
            ? `${Math.floor(totalMins / 60)} hr ${totalMins % 60} min`
            : `${totalMins} min`;
          setTotalDurationFormatted(formatted);
        }
      } catch (err) {
        console.error('Error fetching entire route:', err);
      } finally {
        if (!isCancelled) setLoadingRoute(false);
      }
    }

    loadEntireDayRoute();
    return () => {
      isCancelled = true;
    };
  }, [routeNodes]);

  const repInitials = employee.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  // Determine current rep position
  const activeVisit = sortedVisits.find(v => v.status === 'EN_ROUTE' || v.status === 'ARRIVED' || v.status === 'IN_PROGRESS');
  const repLat = activeVisit?.actualLatitude ?? startLocation.lat;
  const repLng = activeVisit?.actualLongitude ?? startLocation.lng;

  // Build bounds
  const mapPoints: [number, number][] = routeNodes.map(n => [n.lat, n.lng]);
  if (combinedPolyline.length > 0) {
    mapPoints.push(...combinedPolyline);
  }
  const bounds: L.LatLngBoundsExpression = mapPoints.length > 0 ? L.latLngBounds(mapPoints) : [[17.72, 83.30], [17.73, 83.31]];

  const doctorNodes = routeNodes.filter(n => n.type === 'doctor');

  // Next / Previous Doctor handlers
  // Lock background scroll when modal is active
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const handleNextDoctor = () => {
    if (!selectedNode || doctorNodes.length === 0) return;
    const currentIndex = doctorNodes.findIndex(d => d.id === selectedNode.id);
    const nextIndex = (currentIndex + 1) % doctorNodes.length;
    setSelectedNode(doctorNodes[nextIndex]);
  };

  const handlePrevDoctor = () => {
    if (!selectedNode || doctorNodes.length === 0) return;
    const currentIndex = doctorNodes.findIndex(d => d.id === selectedNode.id);
    const prevIndex = (currentIndex - 1 + doctorNodes.length) % doctorNodes.length;
    setSelectedNode(doctorNodes[prevIndex]);
  };

  const openGoogleMaps = (lat: number, lng: number) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[60] bg-slate-950/75 flex items-center justify-center p-2 sm:p-4 overflow-hidden select-none"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-6xl h-[88vh] max-h-[88vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-600 text-white flex items-center justify-center font-black text-sm shadow-md shadow-teal-600/20">
              {repInitials}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-slate-900 font-black text-base">{employee.name}</h3>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[10px] font-bold text-teal-700 bg-teal-50 border border-teal-200 rounded-full">
                  <Radio className="w-2.5 h-2.5 animate-pulse text-teal-600" /> Full Day Tour Route
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Entire circuit: <span className="font-bold text-slate-700">{doctorNodes.length} Doctor Visits</span> planned for today
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
              title="Close Map (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Map + Doctor Details Workspace */}
        <div className="relative flex-1 w-full bg-slate-100 overflow-hidden flex flex-col md:flex-row min-h-0">
          
          {/* MAP CANVAS AREA */}
          <div className="relative flex-1 h-full w-full min-h-0">
            
            {/* Top-Left Floating Day Route Overview Badge */}
            <div className="absolute top-4 left-4 z-[400] flex flex-col gap-2 pointer-events-none">
              <div className="bg-slate-900/95 backdrop-blur-md text-white px-4 py-3 rounded-2xl shadow-xl border border-slate-700 flex items-center gap-3.5 pointer-events-auto">
                <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-xs">
                  <Navigation className="w-4 h-4 fill-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-black text-white tracking-tight">
                      {loadingRoute ? 'Calculating Tour...' : `${totalDistanceKm} km Total`}
                    </span>
                    <span className="text-xs font-bold text-blue-300">
                      ({loadingRoute ? '--' : totalDurationFormatted})
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-300 font-medium mt-0.5">
                    ● Circle = Office Start &nbsp;|&nbsp; ■ Square = Doctor Calls (Click to inspect)
                  </p>
                </div>
              </div>

              {/* Map Legend Pill */}
              <div className="bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-xl shadow-md border border-slate-200 text-slate-800 flex items-center gap-3 text-[11px] font-bold pointer-events-auto">
                <span className="flex items-center gap-1 text-sky-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-600 inline-block" /> Start Office
                </span>
                <span className="flex items-center gap-1 text-emerald-700">
                  <span className="w-2.5 h-2.5 rounded-[3px] bg-emerald-600 inline-block" /> Completed Call
                </span>
                <span className="flex items-center gap-1 text-amber-700">
                  <span className="w-2.5 h-2.5 rounded-[3px] bg-amber-500 inline-block" /> Active
                </span>
                <span className="flex items-center gap-1 text-slate-500">
                  <span className="w-2.5 h-2.5 rounded-[3px] bg-slate-500 inline-block" /> Upcoming
                </span>
              </div>
            </div>

            {/* LEAFLET MAP */}
            <MapContainer
              bounds={bounds}
              zoom={12}
              scrollWheelZoom={true}
              attributionControl={false}
              style={{ height: '100%', width: '100%', zIndex: 0 }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                maxZoom={19}
              />

              <BoundsFitter bounds={bounds} />

              {/* 1. START NODE (Circle Marker) */}
              <Marker
                position={[startLocation.lat, startLocation.lng]}
                icon={createCircleStartIcon(startLocation.label, false)}
                eventHandlers={{
                  click: () => {
                    const startNode = routeNodes.find(n => n.type === 'start');
                    if (startNode) setSelectedNode(startNode);
                  }
                }}
              >
                <Popup>
                  <div className="text-xs font-sans">
                    <strong className="text-sky-700">● Start Location (Office):</strong>
                    <br />
                    {startLocation.label}
                    <br />
                    <span className="text-[10px] text-slate-500">Punch-in: {startLocation.time || '09:00 AM'}</span>
                  </div>
                </Popup>
              </Marker>

              {/* 2. DOCTOR VISITS (Square Markers) */}
              {doctorNodes.map((node) => {
                const isSelected = selectedNode?.id === node.id;
                return (
                  <Marker
                    key={node.id}
                    position={[node.lat, node.lng]}
                    icon={createSquareDoctorIcon(node.nodeNumber || 1, node.status, isSelected)}
                    eventHandlers={{
                      click: () => {
                        setSelectedNode(node);
                      }
                    }}
                  >
                    <Popup>
                      <div className="text-xs font-sans">
                        <strong className="text-teal-700">■ Stop {node.nodeNumber}: {node.label}</strong>
                        <br />
                        {node.clinicName}
                        <br />
                        <span className="text-[10px] text-slate-500 font-bold uppercase">Status: {node.status}</span>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}

              {/* 3. FINAL OFFICE NODE (Circle Marker) */}
              {endLocation && (
                <Marker
                  position={[endLocation.lat, endLocation.lng]}
                  icon={createCircleStartIcon(endLocation.label, true)}
                >
                  <Popup>
                    <div className="text-xs font-sans">
                      <strong className="text-slate-700">● Final Stop (Office):</strong>
                      <br />
                      {endLocation.label}
                    </div>
                  </Popup>
                </Marker>
              )}

              {/* 4. LIVE REP MARKER (Pulsing Radar Pin) */}
              <Marker
                position={[repLat, repLng]}
                icon={createLiveRepLocationIcon(repInitials)}
              >
                <Popup>
                  <div className="text-xs font-sans">
                    <strong className="text-teal-700">Current Rep Location (Live):</strong>
                    <br />
                    {employee.name}
                  </div>
                </Popup>
              </Marker>

              {/* 5. ENTIRE HIGHWAY ROUTE POLYLINE (Dark Blue Casing + Vibrant Cyan Route) */}
              {combinedPolyline.length > 0 && (
                <>
                  <Polyline
                    positions={combinedPolyline}
                    color="#1e3a8a"
                    weight={7}
                    opacity={0.4}
                  />
                  <Polyline
                    positions={combinedPolyline}
                    color="#0284c7"
                    weight={4.5}
                    opacity={0.9}
                  />
                </>
              )}
            </MapContainer>
          </div>

          {/* DOCTOR DETAILS SIDE-WINDOW / DRAWER (Opens when clicking any doctor square marker) */}
          {selectedNode && (
            <div className="w-full md:w-96 bg-white border-t md:border-t-0 md:border-l border-slate-200/90 shadow-2xl flex flex-col z-20 h-auto max-h-[50vh] md:max-h-full overflow-y-auto animate-in slide-in-from-right-10 duration-200">
              
              {/* Drawer Top Navigation & Header */}
              <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-sm z-10">
                <div className="flex items-center gap-1.5">
                  <span className="w-6 h-6 rounded-md bg-teal-600 text-white flex items-center justify-center text-xs font-black">
                    {selectedNode.type === 'start' ? '●' : selectedNode.nodeNumber || '■'}
                  </span>
                  <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
                    {selectedNode.type === 'start' 
                      ? 'Office Location' 
                      : `Doctor Call #${selectedNode.nodeNumber}`}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  {selectedNode.type === 'doctor' && (
                    <>
                      <button
                        onClick={handlePrevDoctor}
                        className="p-1 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors cursor-pointer"
                        title="Previous Doctor"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={handleNextDoctor}
                        className="p-1 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors cursor-pointer"
                        title="Next Doctor"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => setSelectedNode(null)}
                    className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors ml-1 cursor-pointer"
                    title="Close Details Window"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Drawer Content */}
              <div className="p-5 space-y-5 flex-1">
                {/* Title & Status Badge */}
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-base font-black text-slate-900 leading-snug">
                      {selectedNode.label}
                    </h4>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase shrink-0 ${
                      selectedNode.status === 'COMPLETED'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : selectedNode.status === 'IN_TRANSIT'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}>
                      {selectedNode.status}
                    </span>
                  </div>

                  <p className="text-xs font-bold text-teal-700 mt-1 flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5" />
                    {selectedNode.clinicName || selectedNode.address}
                  </p>

                  <p className="text-[11px] text-slate-500 font-medium mt-1 flex items-start gap-1">
                    <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400 mt-0.5" />
                    <span>{selectedNode.address}</span>
                  </p>
                </div>

                {/* Timings Card */}
                <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200/80 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Scheduled</span>
                    <span className="font-mono font-black text-slate-800 text-sm flex items-center gap-1 mt-0.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {selectedNode.visit?.scheduledStart || selectedNode.time || '--:--'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Visited / Arrived</span>
                    <span className="font-mono font-black text-teal-700 text-sm flex items-center gap-1 mt-0.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                      {selectedNode.visit?.completedAt?.split('T')[1]?.slice(0, 5) || selectedNode.visit?.arrivedAt?.split('T')[1]?.slice(0, 5) || 'Pending'}
                    </span>
                  </div>
                </div>

                {/* Photo Proof Section (If Completed) */}
                {(selectedNode.visit?.proofPhotoUrl || selectedNode.visit?.startPhotoUrl) && (
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-2">
                      Photo Proof Submitted
                    </span>
                    <div
                      onClick={() => {
                        const photo = selectedNode.visit?.proofPhotoUrl || selectedNode.visit?.startPhotoUrl;
                        if (photo && onOpenPhoto) {
                          onOpenPhoto(photo, `${selectedNode.label} - Proof Photo`);
                        }
                      }}
                      className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 h-40 shadow-xs group cursor-pointer"
                    >
                      <img
                        src={selectedNode.visit.proofPhotoUrl || selectedNode.visit.startPhotoUrl}
                        alt="Visit Proof"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-bold gap-1.5">
                        <Maximize2 className="w-4 h-4" /> Enlarge Photo
                      </div>
                    </div>
                  </div>
                )}

                {/* Detailing Products & Samples Given (Pharma DCR Info) */}
                {selectedNode.visit && (
                  <div className="space-y-3">
                    {/* Products Detailed */}
                    {selectedNode.visit.productsDetailed && selectedNode.visit.productsDetailed.length > 0 && (
                      <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1.5">
                          Products Promoted / Detailed
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedNode.visit.productsDetailed.map((prod: any, idx: number) => (
                            <span key={idx} className="px-2.5 py-1 rounded-lg text-xs font-bold bg-teal-50 text-teal-800 border border-teal-200/60">
                              💊 {typeof prod === 'string' ? prod : prod.name || prod.productName}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Order Booking / Samples */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">POB Order Value</span>
                        <span className="text-xs font-black text-slate-800 flex items-center gap-0.5 mt-0.5">
                          <IndianRupee className="w-3 h-3 text-emerald-600" />
                          {selectedNode.visit.pobAmount ? selectedNode.visit.pobAmount.toLocaleString() : '₹0'}
                        </span>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Samples Given</span>
                        <span className="text-xs font-black text-slate-800 flex items-center gap-1 mt-0.5">
                          <Package className="w-3 h-3 text-blue-600" />
                          {selectedNode.visit.samplesGiven?.length || 0} items
                        </span>
                      </div>
                    </div>

                    {/* Completion Notes */}
                    {selectedNode.visit.completionNotes && (
                      <div className="bg-amber-50/60 p-3 rounded-2xl border border-amber-200/60">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800 flex items-center gap-1 mb-1">
                          <FileText className="w-3 h-3" /> Representative's Call Report
                        </span>
                        <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed font-medium">
                          {selectedNode.visit.completionNotes}
                        </p>
                      </div>
                    )}

                    {/* GPS Arrival Verification */}
                    {selectedNode.visit.arrivalDistanceM !== undefined && (
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200/70">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        <span>GPS Verified: Arrived within {Math.round(selectedNode.visit.arrivalDistanceM)}m of clinic</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Bottom Quick Action */}
              <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-2">
                <button
                  onClick={() => openGoogleMaps(selectedNode.lat, selectedNode.lng)}
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white flex items-center justify-center gap-1.5 transition-colors shadow-xs shadow-teal-600/20 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Open Location in Google Maps
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
