import React, { useState, useRef } from 'react';
import { 
  Upload, 
  X, 
  FileSpreadsheet, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw, 
  Download, 
  User, 
  Stethoscope,
  MapPin, 
  Calendar, 
  Clock 
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Employee, FieldVisit, PharmaCallCategory } from '../types';
import { bulkCreateVisits } from '../lib/services/field-visit-service';

interface BulkUploadModalProps {
  onClose: () => void;
  employees: Employee[];
  currentUser: Employee;
  onSuccess: () => void;
  initialEmployeeId?: string;
}

function parseExcelDate(val: any): string {
  if (!val) return new Date().toISOString().split('T')[0];
  if (typeof val === 'number') {
    // Excel serial date number
    const dateObj = new Date(Math.round((val - 25569) * 86400 * 1000));
    return dateObj.toISOString().split('T')[0];
  }
  const s = String(val).trim();
  // Check DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // Standard parse fallback
  try {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  } catch {}
  return new Date().toISOString().split('T')[0];
}

function parseExcelTime(val: any): string {
  if (val === null || val === undefined || val === '') return '10:00';
  if (typeof val === 'number') {
    // Excel fraction of a day (e.g. 0.41666667 is 10:00)
    const totalMinutes = Math.round(val * 24 * 60);
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }
  const s = String(val).trim();
  // If string contains floating point like "0.4166666666666667"
  const numVal = parseFloat(s);
  if (!isNaN(numVal) && numVal >= 0 && numVal <= 1 && s.includes('.')) {
    const totalMinutes = Math.round(numVal * 24 * 60);
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }
  const timeMatch = s.match(/^(\d{1,2}):(\d{2})/);
  if (timeMatch) {
    const [, h, m] = timeMatch;
    return `${h.padStart(2, '0')}:${m}`;
  }
  return s || '10:00';
}

export default function BulkUploadModal({ 
  onClose, 
  employees, 
  currentUser, 
  onSuccess,
  initialEmployeeId 
}: BulkUploadModalProps) {
  // Target employee: defaults to the current logged-in employee (or targeted rep if explicitly opened for them)
  const targetEmployeeId = initialEmployeeId || currentUser.id;
  const targetEmployee = employees.find(e => e.id === targetEmployeeId) || currentUser;

  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Template download: A clean doctor visit template with doctor details
  const downloadTemplate = () => {
    const data = [
      ['Doctor Name', 'Category', 'Visit Location', 'Purpose', 'Call Date', 'Time'],
      ['Dr. Siva Sankar', 'doctor', 'Nellore Clinic', 'Cloud-D3 promotion', '2026-11-25', '10:00'],
      ['Dr. Shanmukh', 'doctor', 'Sabbavaram Hospital', 'Product sample discussion', '2026-11-25', '11:30'],
      ['Sri Krishna Pharma', 'chemist', 'Main Road, Nellore', 'Stock replenishment & POB booking', '2026-11-25', '14:00'],
      ['Dr. K Narayana Rao', 'doctor', 'Anakapalli Hospital', 'Monthly follow-up visit', '2026-11-25', '16:00'],
      ['Dr. K Nageswara Rao', 'doctor', 'Srikakulam Clinic', 'New product range briefing', '2026-11-25', '17:30']
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [
      { wch: 25 }, { wch: 15 }, { wch: 30 }, { wch: 35 }, { wch: 15 }, { wch: 10 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Doctor Calls');
    XLSX.writeFile(wb, 'Doctor_Visits_Bulk_Upload_Template.xlsx');
  };

  const processFile = (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);
    setSuccess(false);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const parsedData = XLSX.utils.sheet_to_json(sheet);
        
        if (parsedData.length === 0) {
          setError('The uploaded file is empty.');
          return;
        }

        const firstRow = parsedData[0] as any;
        const hasDoctorCol = Object.keys(firstRow).some(k => 
          /doctor|target|clinic|hospital|chemist|stockist|customer|party|title|name/i.test(k)
        );

        if (!hasDoctorCol) {
          setError('Invalid Excel format. Please include a "Doctor Name" or "Target Name" column.');
          return;
        }

        const mappedRows = parsedData.map((row: any, index: number) => {
          const targetKey = Object.keys(row).find(k => 
            /doctor|target|clinic|hospital|chemist|stockist|customer|party|title|name/i.test(k)
          ) || 'Doctor Name';

          const dateKey = Object.keys(row).find(k => 
            /date|call\s*date|scheduled|day/i.test(k)
          ) || 'Call Date';

          const locationKey = Object.keys(row).find(k => 
            /location|address|place|area|city|clinic\s*name|hospital\s*name/i.test(k)
          ) || 'Visit Location';

          const categoryKey = Object.keys(row).find(k => 
            /category|type|call\s*type/i.test(k)
          ) || 'Category';

          const purposeKey = Object.keys(row).find(k => 
            /purpose|objective|notes|remarks|agenda/i.test(k)
          ) || 'Purpose';

          const timeKey = Object.keys(row).find(k => 
            /time|start\s*time|slot/i.test(k)
          ) || 'Time';

          const doctorName = (row[targetKey] || row['Doctor Name'] || row['Target Name'] || '').toString().trim();
          const rawDate = row[dateKey] || row['Call Date'] || row['Scheduled Date'] || row['Date'];
          const parsedDate = parseExcelDate(rawDate);
          const visitLocation = (row[locationKey] || row['Visit Location'] || row['Location'] || row['Address'] || '').toString().trim();
          const rawCat = (row[categoryKey] || row['Category'] || 'doctor').toString().trim().toLowerCase();
          const category: PharmaCallCategory = ['doctor', 'chemist', 'stockist', 'hospital'].includes(rawCat) 
            ? (rawCat as PharmaCallCategory) 
            : 'doctor';
          const purpose = (row[purposeKey] || row['Purpose'] || row['Visit Purpose'] || '').toString().trim();
          const time = parseExcelTime(row[timeKey] ?? row['Time']);

          const isValid = !!doctorName;

          return {
            rowIndex: index + 2,
            original: row,
            doctorName: doctorName || 'Unnamed Doctor Visit',
            category,
            visitLocation,
            purpose,
            time,
            parsedDate,
            isValid,
            error: !doctorName ? 'Doctor / Target Name is missing.' : null
          };
        });

        setRows(mappedRows);
      } catch (err: any) {
        setError('Error reading file: ' + err.message);
      }
    };
    reader.readAsBinaryString(selectedFile);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleUpload = async () => {
    if (rows.some(r => !r.isValid)) {
      setError('Please fix any rows with missing doctor names before uploading.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const visitsPayload: Partial<FieldVisit>[] = rows.map(r => {
        const cat = r.category || 'doctor';
        return {
          employeeId: targetEmployeeId,
          assignedBy: currentUser.id,
          title: `Visit: ${r.doctorName}`,
          scheduledDate: r.parsedDate,
          scheduledStart: r.time || '10:00',
          scheduledEnd: '11:00',
          category: cat,
          doctorName: r.doctorName,
          clinicName: r.visitLocation || undefined,
          assignedAddress: r.visitLocation || undefined,
          visitPurpose: r.purpose || undefined,
          description: r.purpose || '',
          visitType: 'DOCTOR_VISIT',
          approvalStatus: 'approved'
        };
      });

      await bulkCreateVisits(visitsPayload);
      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      setError('Upload failed: ' + (err.message || 'Unknown error'));
      setIsProcessing(false);
    }
  };

  const hasErrors = rows.some(r => !r.isValid);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-slideUp">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Bulk Upload Doctor Visits</h2>
              <p className="text-xs text-slate-500">
                Upload your Excel doctor list to add all visits to your schedule at once
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-slate-50/50">

          {/* User Confirmation Banner */}
          <div className="bg-teal-50/70 border border-teal-200/80 rounded-2xl p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-teal-600 text-white flex items-center justify-center font-bold text-xs">
                {targetEmployee.name.charAt(0)}
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800">
                  {targetEmployee.name} <span className="text-slate-400 font-mono text-[11px]">({targetEmployee.id})</span>
                </p>
                <p className="text-[11px] text-teal-700 font-medium">
                  All doctor visits in your Excel sheet will be added directly to your schedule
                </p>
              </div>
            </div>
            <span className="text-[10px] bg-teal-600 text-white font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
              {targetEmployee.designation || 'Medical Rep'}
            </span>
          </div>
          
          {/* Dropzone */}
          {!file && (
            <div 
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${
                isDragging ? 'border-teal-400 bg-teal-50' : 'border-slate-300 hover:border-teal-400 hover:bg-slate-50'
              }`}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".xlsx, .xls, .csv"
                onChange={(e) => e.target.files && processFile(e.target.files[0])}
              />
              <Upload className="w-10 h-10 text-teal-600 mb-3" />
              <p className="text-sm font-bold text-slate-800">
                Click or drag Excel file with your doctor list
              </p>
              <p className="text-xs text-slate-500 mt-1">Supports .xlsx and .csv formats</p>
              
              <div className="mt-4 p-3.5 bg-white rounded-xl border border-slate-200 text-left w-full max-w-md shadow-2xs space-y-1.5">
                <p className="text-[10px] font-black text-slate-800 uppercase tracking-wider">
                  Excel Columns (No employee ID required):
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2 py-0.5 bg-teal-50 border border-teal-200 rounded text-[10px] text-teal-800 font-mono font-bold">
                    Doctor Name *
                  </span>
                  <span className="px-2 py-0.5 bg-teal-50 border border-teal-200 rounded text-[10px] text-teal-800 font-mono font-bold">
                    Call Date *
                  </span>
                  <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] text-slate-600 font-mono">
                    Visit Location
                  </span>
                  <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] text-slate-600 font-mono">
                    Category (doctor/chemist)
                  </span>
                  <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] text-slate-600 font-mono">
                    Purpose
                  </span>
                  <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] text-slate-600 font-mono">
                    Time
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); downloadTemplate(); }}
                className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Download Doctor Visits Template (.xlsx)
              </button>
            </div>
          )}

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-rose-700">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-xs font-semibold">{error}</p>
            </div>
          )}

          {success && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3 text-emerald-700">
              <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-xs font-bold">Successfully added {rows.length} doctor visits to your schedule!</p>
            </div>
          )}

          {/* Validation & Preview Results */}
          {rows.length > 0 && !success && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    Preview ({rows.length} doctor visits to add)
                  </h3>
                  <p className="text-xs text-teal-700 font-semibold mt-0.5">
                    ✓ All {rows.length} visits will be scheduled for your daily tour plan
                  </p>
                </div>
                <button 
                  onClick={() => { setFile(null); setRows([]); setError(null); }} 
                  className="text-xs text-slate-500 hover:text-slate-800 underline font-medium cursor-pointer"
                >
                  Upload different file
                </button>
              </div>
              
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs max-h-64 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2.5 font-bold text-slate-600">#</th>
                      <th className="px-3 py-2.5 font-bold text-slate-600">Doctor / Chemist Name</th>
                      <th className="px-3 py-2.5 font-bold text-slate-600">Category</th>
                      <th className="px-3 py-2.5 font-bold text-slate-600">Location</th>
                      <th className="px-3 py-2.5 font-bold text-slate-600">Date & Time</th>
                      <th className="px-3 py-2.5 font-bold text-slate-600">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((r, i) => (
                      <tr key={i} className={r.isValid ? 'hover:bg-slate-50/50' : 'bg-rose-50/50'}>
                        <td className="px-3 py-2 text-slate-500 font-mono text-[11px]">{r.rowIndex}</td>
                        <td className="px-3 py-2 font-bold text-slate-800">{r.doctorName}</td>
                        <td className="px-3 py-2">
                          <span className="capitalize px-2 py-0.5 bg-slate-100 rounded text-[10px] font-semibold text-slate-600">
                            {r.category}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-600 truncate max-w-[150px]" title={r.visitLocation}>
                          {r.visitLocation || '—'}
                        </td>
                        <td className="px-3 py-2 text-slate-600 font-mono text-[11px]">
                          {r.parsedDate} {r.time}
                        </td>
                        <td className="px-3 py-2">
                          {r.isValid ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                              <CheckCircle className="w-3 h-3 text-emerald-600" /> Ready
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full" title={r.error}>
                              <AlertCircle className="w-3 h-3 text-rose-600" /> Error
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 bg-white flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {rows.length > 0 && !hasErrors && (
              <span className="text-emerald-700 font-bold">
                ✓ Ready to add {rows.length} visits to schedule
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <button 
              onClick={onClose}
              disabled={isProcessing}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button 
              onClick={handleUpload}
              disabled={isProcessing || !file || hasErrors || success || rows.length === 0}
              className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-md shadow-teal-600/20 cursor-pointer"
            >
              {isProcessing ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> Adding Visits...</>
              ) : (
                <><Upload className="w-4 h-4" /> Add Visits to Schedule</>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
