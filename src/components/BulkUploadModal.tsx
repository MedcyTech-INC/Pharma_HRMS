import React, { useState, useRef } from 'react';
import { Upload, X, FileSpreadsheet, CheckCircle, AlertCircle, RefreshCw, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Employee, FieldVisit, PharmaCallCategory } from '../types';
import { bulkCreateVisits } from '../lib/services/field-visit-service';

interface BulkUploadModalProps {
  onClose: () => void;
  employees: Employee[];
  currentUser: Employee;
  onSuccess: () => void;
}

export default function BulkUploadModal({ onClose, employees, currentUser, onSuccess }: BulkUploadModalProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const headers = [
      ['Employee Email', 'Category', 'Target Name', 'Visit Location', 'Purpose', 'Call Date', 'Time']
    ];
    const ws = XLSX.utils.aoa_to_sheet(headers);
    ws['!cols'] = [
      { wch: 25 }, { wch: 15 }, { wch: 25 }, { wch: 30 }, { wch: 20 }, { wch: 15 }, { wch: 10 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Visits');
    XLSX.writeFile(wb, 'Bulk_Visit_Upload_Template.xlsx');
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

        // Validate structure
        const firstRow = parsedData[0] as any;
        if (!firstRow['Employee Email'] || !firstRow['Target Name'] || !firstRow['Call Date']) {
          setError('Invalid template. Required columns: Employee Email, Target Name, Call Date');
          return;
        }

        // Map data and check emails
        const mappedRows = parsedData.map((row: any, index: number) => {
          const email = row['Employee Email']?.toString().trim().toLowerCase();
          const matchedEmployee = employees.find(e => e.email.toLowerCase() === email);
          
          return {
            rowIndex: index + 2, // +2 because 1-based and header row
            original: row,
            employeeId: matchedEmployee?.id,
            isValid: !!matchedEmployee,
            error: matchedEmployee ? null : `No employee found with email: ${email}`
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
      setError('Please fix the errors in the highlighted rows before uploading.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const visitsPayload: Partial<FieldVisit>[] = rows.map(r => {
        const data = r.original;
        // Basic YYYY-MM-DD parsing, assuming Excel passes as string or serial number
        let parsedDate = data['Call Date'] || data['Scheduled Date'];
        if (typeof parsedDate === 'number') {
          // Excel serial number to date
          const dateObj = new Date(Math.round((parsedDate - 25569) * 86400 * 1000));
          parsedDate = dateObj.toISOString().split('T')[0];
        } else if (parsedDate) {
           parsedDate = new Date(parsedDate).toISOString().split('T')[0];
        } else {
           parsedDate = new Date().toISOString().split('T')[0];
        }
        
        const cat = String(data['Category'] || 'doctor').trim().toLowerCase();
        const validCategory = (['doctor', 'chemist', 'stockist', 'hospital'].includes(cat) ? cat : 'doctor') as PharmaCallCategory;
        const targetName = data['Target Name']?.toString() || data['Title']?.toString() || 'Doctor Visit';

        return {
          employeeId: r.employeeId!,
          assignedBy: currentUser.id,
          title: `Visit: ${targetName}`,
          scheduledDate: parsedDate,
          scheduledStart: data['Time']?.toString() || data['Start Time']?.toString() || '09:00',
          scheduledEnd: data['End Time']?.toString() || '10:00',
          category: validCategory,
          doctorName: validCategory === 'doctor' ? targetName : undefined,
          clinicName: validCategory === 'doctor' ? data['Visit Location']?.toString() : undefined,
          chemistShopName: validCategory === 'chemist' ? targetName : undefined,
          stockistName: validCategory === 'stockist' ? targetName : undefined,
          hospitalName: validCategory === 'hospital' ? targetName : undefined,
          assignedAddress: data['Visit Location']?.toString(),
          visitPurpose: data['Purpose']?.toString() || data['Visit Purpose']?.toString(),
          description: data['Purpose']?.toString() || data['Notes']?.toString() || '',
          visitType: 'DOCTOR_VISIT'
        };
      });

      await bulkCreateVisits(visitsPayload);
      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);
    } catch (err: any) {
      setError('Upload failed: ' + (err.message || 'Unknown error'));
      setIsProcessing(false);
    }
  };

  const hasErrors = rows.some(r => !r.isValid);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-slideUp">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Bulk Upload Visits</h2>
              <p className="text-xs text-slate-500">Upload an Excel/CSV file with doctor visits</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
          
          {/* Dropzone */}
          {!file && (
            <div 
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${
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
              <Upload className="w-10 h-10 text-slate-400 mb-4" />
              <p className="text-sm font-bold text-slate-700">Click or drag Excel file to upload</p>
              <p className="text-xs text-slate-500 mt-1">Supports .xlsx and .csv formats</p>
              <div className="mt-4 p-3 bg-white rounded-lg border border-slate-200 text-left w-full max-w-sm">
                <p className="text-[10px] font-bold text-slate-800 uppercase tracking-wider mb-2">Required Columns:</p>
                <div className="flex flex-wrap gap-2">
                  <span className="px-2 py-1 bg-slate-100 rounded text-[10px] text-slate-600 font-mono">Employee Email</span>
                  <span className="px-2 py-1 bg-slate-100 rounded text-[10px] text-slate-600 font-mono">Target Name</span>
                  <span className="px-2 py-1 bg-slate-100 rounded text-[10px] text-slate-600 font-mono">Call Date</span>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); downloadTemplate(); }}
                className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white text-xs font-bold rounded-xl shadow-md hover:shadow-lg transition-all duration-200"
              >
                <Download className="w-4 h-4" />
                Download Template (.xlsx)
              </button>
            </div>
          )}

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-rose-700">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {success && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3 text-emerald-700">
              <CheckCircle className="w-5 h-5 shrink-0" />
              <p className="text-sm font-medium">Successfully uploaded {rows.length} visits! Refreshing data...</p>
            </div>
          )}

          {/* Validation Results */}
          {rows.length > 0 && !success && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800">Preview ({rows.length} rows)</h3>
                <button onClick={() => { setFile(null); setRows([]); setError(null); }} className="text-[11px] text-slate-500 hover:text-slate-700 underline">
                  Upload different file
                </button>
              </div>
              
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm max-h-64 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 font-semibold text-slate-600">Row</th>
                      <th className="px-4 py-3 font-semibold text-slate-600">Employee Email</th>
                      <th className="px-4 py-3 font-semibold text-slate-600">Target Name</th>
                      <th className="px-4 py-3 font-semibold text-slate-600">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((r, i) => (
                      <tr key={i} className={r.isValid ? '' : 'bg-rose-50/50'}>
                        <td className="px-4 py-2 text-slate-500">{r.rowIndex}</td>
                        <td className="px-4 py-2 font-medium text-slate-700">{r.original['Employee Email']}</td>
                        <td className="px-4 py-2 text-slate-600">{r.original['Target Name'] || r.original['Title']}</td>
                        <td className="px-4 py-2">
                          {r.isValid ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                              <CheckCircle className="w-3 h-3" /> Valid
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full" title={r.error}>
                              <AlertCircle className="w-3 h-3" /> Error
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
        <div className="p-6 border-t border-slate-100 bg-white flex justify-end gap-3">
          <button 
            onClick={onClose}
            disabled={isProcessing}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleUpload}
            disabled={isProcessing || !file || hasErrors || success}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isProcessing ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> Uploading...</>
            ) : (
              <><Upload className="w-4 h-4" /> Start Bulk Upload</>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
