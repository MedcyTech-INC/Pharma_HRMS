import React from 'react';
import { FieldVisit, Employee } from '../../types';
import { EmployeeCheckInLocation } from '../../lib/services/attendance-service';
import { 
  CheckCircle2, 
  MapPin, 
  Clock, 
  Radio, 
  Building2, 
  Camera, 
  Maximize2, 
  ExternalLink,
  Navigation2
} from 'lucide-react';

export interface RouteStop {
  id: string;
  type: 'start' | 'visit' | 'end';
  nodeNumber?: number;
  title: string;
  subtitle?: string;
  address?: string;
  status: 'COMPLETED' | 'IN_TRANSIT' | 'UPCOMING';
  timeLabel: string;
  timeValue: string;
  photoUrl?: string;
  lat?: number;
  lng?: number;
  visit?: FieldVisit;
}

interface ProgressRouteTrackerProps {
  employee: Employee;
  visits: FieldVisit[];
  checkIn?: EmployeeCheckInLocation | null;
  onOpenEntireRouteMap: (visitId?: string) => void;
  onOpenPhoto?: (photoUrl: string, title: string) => void;
}

export const ProgressRouteTracker: React.FC<ProgressRouteTrackerProps> = ({
  employee,
  visits,
  checkIn,
  onOpenEntireRouteMap,
  onOpenPhoto
}) => {
  // Sort visits by scheduledStart or startedAt
  const sortedVisits = [...visits].sort((a, b) => {
    const timeA = a.scheduledStart || a.startedAt || '99:99';
    const timeB = b.scheduledStart || b.startedAt || '99:99';
    return timeA.localeCompare(timeB);
  });

  // Determine Office / Start node
  const startLat = checkIn?.latitude || 17.7231;
  const startLng = checkIn?.longitude || 83.3013;
  const startLocationName = checkIn?.locationName || `${employee.branch ? employee.branch.charAt(0).toUpperCase() + employee.branch.slice(1) : 'Visakhapatnam'} Office`;
  const startTime = checkIn?.checkInTime || '09:00 AM';

  // Build the unified stops list
  const stops: RouteStop[] = [];

  // 1. Start Node (PUNCH-IN)
  stops.push({
    id: 'start-node',
    type: 'start',
    title: 'Start Location (Office)',
    subtitle: startLocationName,
    address: startLocationName,
    status: 'COMPLETED',
    timeLabel: 'Punch-In',
    timeValue: startTime,
    lat: startLat,
    lng: startLng,
  });

  // 2. Doctor/Clinic Visit Stops
  sortedVisits.forEach((visit, index) => {
    const isCompleted = visit.status === 'COMPLETED';
    const isInTransit = visit.status === 'EN_ROUTE' || visit.status === 'ARRIVED' || visit.status === 'IN_PROGRESS';
    const status: RouteStop['status'] = isCompleted ? 'COMPLETED' : isInTransit ? 'IN_TRANSIT' : 'UPCOMING';

    const clinicOrDoctor = visit.doctorName 
      ? `Dr. ${visit.doctorName.replace(/^Dr\.?\s*/i, '')}'s Clinic`
      : visit.clinicName || visit.hospitalName || visit.title;

    let timeLabel = 'Scheduled';
    let timeValue = visit.scheduledStart || '10:00 AM';

    if (isCompleted) {
      timeLabel = 'Visited at';
      timeValue = visit.completedAt?.split('T')[1]?.slice(0, 5) || visit.scheduledEnd || visit.scheduledStart || '11:00 AM';
    } else if (isInTransit) {
      timeLabel = 'ETA';
      timeValue = visit.scheduledStart || '11:30 AM';
    }

    stops.push({
      id: visit.id,
      type: 'visit',
      nodeNumber: index + 1,
      title: clinicOrDoctor,
      subtitle: visit.title !== clinicOrDoctor ? visit.title : undefined,
      address: visit.assignedAddress || visit.actualAddress || 'Assigned Territory',
      status,
      timeLabel,
      timeValue,
      photoUrl: visit.proofPhotoUrl || visit.startPhotoUrl,
      lat: visit.assignedLatitude ?? visit.actualLatitude ?? startLat,
      lng: visit.assignedLongitude ?? visit.actualLongitude ?? startLng,
      visit,
    });
  });

  // 3. Final Stop (Office Return / Punch-Out)
  const isCheckedOut = Boolean(checkIn?.checkOutTime);
  stops.push({
    id: 'end-node',
    type: 'end',
    nodeNumber: sortedVisits.length + 1,
    title: 'Final Stop: Office',
    subtitle: 'End of Day Punch-out',
    address: startLocationName,
    status: isCheckedOut ? 'COMPLETED' : 'UPCOMING',
    timeLabel: isCheckedOut ? 'Punched out at' : 'Scheduled',
    timeValue: checkIn?.checkOutTime || '06:00 PM',
    lat: startLat,
    lng: startLng,
  });

  // Find the currently active transit stop (if any) or default to first pending
  const activeStopIndex = stops.findIndex(s => s.status === 'IN_TRANSIT');

  const handleCardClick = (stop: RouteStop) => {
    onOpenEntireRouteMap(stop.visit?.id);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 sm:p-6 space-y-6">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200/60 flex items-center justify-center text-teal-700 shadow-2xs">
            <Navigation2 className="w-4 h-4 text-teal-600" />
          </div>
          <div>
            <h4 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2 uppercase">
              1. The Progress Route
            </h4>
            <p className="text-[11px] text-slate-500 font-medium">
              Daily scheduled call progression for <span className="font-bold text-slate-700">{employee.name}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeStopIndex !== -1 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-teal-50 border border-teal-200 text-teal-700 animate-pulse">
              <Radio className="w-3.5 h-3.5 text-teal-600" /> In-Transit Active
            </span>
          )}

          <button
            type="button"
            onClick={() => onOpenEntireRouteMap()}
            className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white flex items-center gap-1.5 transition-colors shadow-xs shadow-teal-600/20 cursor-pointer"
          >
            <Navigation2 className="w-3.5 h-3.5" /> View Entire Route Map
          </button>
        </div>
      </div>

      {/* Stepper Timeline */}
      <div className="relative pl-6 sm:pl-8 space-y-5">
        {stops.map((stop, index) => {
          const isFirst = index === 0;
          const isLast = index === stops.length - 1;
          const isCompleted = stop.status === 'COMPLETED';
          const isInTransit = stop.status === 'IN_TRANSIT';
          const isUpcoming = stop.status === 'UPCOMING';

          return (
            <div key={stop.id} className="relative group">
              {/* Vertical connector line */}
              {!isLast && (
                <div
                  className={`absolute -left-[17px] sm:-left-[21px] top-6 bottom-[-22px] w-1 transition-colors ${
                    isCompleted
                      ? 'bg-teal-500'
                      : isInTransit
                      ? 'bg-gradient-to-b from-teal-500 to-slate-200'
                      : 'border-l-2 border-dashed border-slate-300 w-0'
                  }`}
                />
              )}

              {/* Node Icon on Timeline */}
              <div
                className={`absolute -left-[27px] sm:-left-[31px] top-4 w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all shadow-xs z-10 ${
                  isCompleted
                    ? 'bg-teal-600 border-white text-white'
                    : isInTransit
                    ? 'bg-white border-teal-600 ring-4 ring-teal-100 text-teal-600'
                    : 'bg-slate-100 border-white text-slate-400'
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                ) : isInTransit ? (
                  <div className="w-2.5 h-2.5 rounded-full bg-teal-600 animate-ping" />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-slate-400" />
                )}
              </div>

              {/* Card Container */}
              <div
                onClick={() => handleCardClick(stop)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer select-none ${
                  isInTransit
                    ? 'bg-gradient-to-r from-teal-50/70 to-emerald-50/30 border-teal-300 ring-2 ring-teal-400/20 shadow-sm'
                    : isCompleted
                    ? 'bg-white hover:bg-slate-50/80 border-slate-200/90 shadow-2xs hover:border-teal-300'
                    : 'bg-slate-50/60 border-slate-200/60 text-slate-500 opacity-90 hover:opacity-100'
                }`}
              >
                {/* Card Header & Status */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[11px] font-black uppercase tracking-wider ${
                        isInTransit ? 'text-teal-700' : isCompleted ? 'text-slate-700' : 'text-slate-400'
                      }`}
                    >
                      {stop.type === 'start'
                        ? 'Start Node (PUNCH-IN)'
                        : stop.type === 'end'
                        ? `STOP ${stop.nodeNumber} (Upcoming)`
                        : `STOP ${stop.nodeNumber} (${isInTransit ? 'In-Transit' : isCompleted ? 'Completed' : 'Upcoming'})`}
                    </span>
                  </div>

                  {/* Right Header Badges */}
                  <div className="flex items-center gap-2">
                    {isCompleted && (
                      <span className="w-5 h-5 rounded-full bg-teal-500 text-white flex items-center justify-center shadow-2xs">
                        <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                      </span>
                    )}

                    {isInTransit && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-teal-600 text-white shadow-xs">
                        <Radio className="w-2.5 h-2.5 animate-pulse text-teal-200" />
                        Current Rep Location (Live)
                      </span>
                    )}
                  </div>
                </div>

                {/* Stop Main Details */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    {/* Optional Photo Proof Thumbnail (STOP 1 in Photo 1) */}
                    {stop.photoUrl ? (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onOpenPhoto && stop.photoUrl) {
                            onOpenPhoto(stop.photoUrl, `${stop.title} - Photo Proof`);
                          }
                        }}
                        className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-slate-200 bg-slate-100 shadow-2xs group/photo cursor-pointer"
                        title="Click to zoom photo proof"
                      >
                        <img
                          src={stop.photoUrl}
                          alt="Proof"
                          className="w-full h-full object-cover group-hover/photo:scale-110 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/photo:opacity-100 flex items-center justify-center transition-opacity">
                          <Maximize2 className="w-3.5 h-3.5 text-white" />
                        </div>
                      </div>
                    ) : (
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                          isInTransit
                            ? 'bg-teal-100/70 border-teal-200 text-teal-700'
                            : isCompleted
                            ? 'bg-slate-100 border-slate-200 text-slate-600'
                            : 'bg-slate-100/50 border-slate-200 text-slate-400'
                        }`}
                      >
                        {stop.type === 'start' || stop.type === 'end' ? (
                          <Building2 className="w-4 h-4" />
                        ) : (
                          <MapPin className="w-4 h-4" />
                        )}
                      </div>
                    )}

                    <div>
                      <h5 className="text-xs sm:text-sm font-black text-slate-900 leading-snug flex items-center gap-1.5">
                        {stop.title}
                      </h5>

                      {stop.photoUrl && (
                        <p className="text-[10px] font-bold text-slate-500 flex items-center gap-1 mt-0.5">
                          <Camera className="w-3 h-3 text-teal-600" /> Photo proof
                        </p>
                      )}

                      <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 shrink-0 text-slate-400" />
                        <span className="truncate max-w-[240px] sm:max-w-md">{stop.address}</span>
                      </p>
                    </div>
                  </div>

                  {/* Timing Pill & Map Trigger */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 border-slate-100 pt-2 sm:pt-0">
                    <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {stop.timeLabel}: <span className="font-mono font-black">{stop.timeValue}</span>
                    </span>

                    <span className="text-[10px] font-bold text-teal-600 hover:text-teal-700 flex items-center gap-0.5 mt-0.5">
                      <ExternalLink className="w-2.5 h-2.5" /> View Route Map
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
