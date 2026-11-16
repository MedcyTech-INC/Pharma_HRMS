import React, { useState, useRef } from 'react';
import { Upload, X, Users, CheckCircle, AlertCircle, RefreshCw, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Employee } from '../types';
import { bulkCreateEmployees } from '../lib/services/employee-service';

interface EmployeeBulkUploadModalProps {
  onClose: () => void;
  employees: Employee[];
  onSuccess: () => void;
}

export default function EmployeeBulkUploadModal({ onClose, employees, onSuccess }: EmployeeBulkUploadModalProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const templateRows = [
      ['Name', 'Email', 'Designation', 'Phone', 'Gender', 'Zone (AP/TS/Corporate)', 'Hierarchy Level (BE/RSM/ZSM/Admin)', 'Reporting Manager ID'],
      ['Rajesh Varma', 'rajesh.varma@orcalabs.in', 'Business Executive', '9876543210', 'Male', 'AP', 'BE', 'OL008'],
      ['Suresh Kumar', 'suresh.kumar@orcalabs.in', 'Regional Sales Manager', '9876543211', 'Male', 'TS', 'RSM', 'OL001']
    ];
    const ws = XLSX.utils.aoa_to_sheet(templateRows);
    // Set column widths for readability
    ws['!cols'] = [
      { wch: 22 }, { wch: 30 }, { wch: 26 }, { wch: 16 }, { wch: 12 }, { wch: 24 }, { wch: 32 }, { wch: 22 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Employees');
    XLSX.writeFile(wb, 'OrcaLabs_Employee_Upload_Template.xlsx');
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
        if (!firstRow['Name'] || !firstRow['Email'] || !firstRow['Designation']) {
          setError('Invalid template. Required columns: Name, Email, Designation');
          return;
        }

        // Map data and check emails
        const mappedRows = parsedData.map((row: any, index: number) => {
          const email = row['Email']?.toString().trim().toLowerCase();
          const existingEmployee = employees.find(emp => emp.email.toLowerCase() === email);
          
          return {
            rowIndex: index + 2, // +2 because 1-based and header row
            original: row,
            isValid: !existingEmployee,
            error: existingEmployee ? `An employee with email ${email} already exists.` : null
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
      // Find max numeric OL ID among current employees
      const maxNumericId = employees.reduce((max, e) => {
        const num = parseInt(e.id?.replace(/\D/g, '') || '0', 10);
        return num > max ? num : max;
      }, 30);

      const employeesPayload: Partial<Employee>[] = rows.map((r, idx) => {
        const data = r.original;
        
        // Form non-colliding sequential employee ID
        const generatedId = `OL${(maxNumericId + idx + 1).toString().padStart(3, '0')}`;
        const employeeId = data['Employee ID']?.toString() || data['ID']?.toString() || generatedId;

        // Zone and branch normalization
        const rawZone = (data['Zone (AP/TS/Corporate)'] || data['Zone'] || 'AP').toString().trim().toUpperCase();
        const zone = rawZone.includes('TS') ? 'TS' : rawZone.includes('CORP') ? 'Corporate' : 'AP';
        const branch = zone === 'TS' ? 'ts_zone' : zone === 'Corporate' ? 'corporate' : 'ap_zone';

        // Hierarchy level normalization
        const rawLevel = (data['Hierarchy Level (BE/RSM/ZSM/Admin)'] || data['Hierarchy Level'] || 'BE').toString().trim().toLowerCase();
        let hierarchyLevel: 'be' | 'rsm' | 'zsm' | 'admin' | 'executive' = 'be';
        if (rawLevel.includes('admin')) hierarchyLevel = 'admin';
        else if (rawLevel.includes('exec')) hierarchyLevel = 'executive';
        else if (rawLevel.includes('zsm')) hierarchyLevel = 'zsm';
        else if (rawLevel.includes('rsm')) hierarchyLevel = 'rsm';

        // Reporting manager
        const reportingTo = (data['Reporting Manager ID'] || data['Reporting Manager'] || data['Reporting To'] || '').toString().trim();

        const role = hierarchyLevel === 'admin' || hierarchyLevel === 'executive' ? 'admin' : 'employee';

        return {
          id: employeeId,
          employeeCode: employeeId,
          name: data['Name']?.toString() || 'Unknown',
          email: data['Email']?.toString()?.trim()?.toLowerCase(),
          designation: data['Designation']?.toString() || (hierarchyLevel === 'be' ? 'Business Executive' : hierarchyLevel === 'rsm' ? 'Regional Sales Manager' : 'Zonal Sales Manager'),
          phone: data['Phone']?.toString() || '',
          hierarchyLevel,
          zone,
          branch,
          reportingTo: reportingTo || undefined,
          password: 'password123',
          gender: (data['Gender']?.toString()?.toLowerCase().startsWith('f') ? 'female' : 'male') as 'male' | 'female',
          status: 'active',
          role,
        };
      });

      await bulkCreateEmployees(employeesPayload);
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
            <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Bulk Add Employees</h2>
              <p className="text-xs text-slate-500">Upload an Excel/CSV file to add multiple staff members</p>
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
                isDragging ? 'border-blue-400 bg-blue-50' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
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
                  <span className="px-2 py-1 bg-slate-100 rounded text-[10px] text-slate-600 font-mono">Name</span>
                  <span className="px-2 py-1 bg-slate-100 rounded text-[10px] text-slate-600 font-mono">Email</span>
                  <span className="px-2 py-1 bg-slate-100 rounded text-[10px] text-slate-600 font-mono">Designation</span>
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
              <p className="text-sm font-medium">Successfully added {rows.length} employees! Refreshing data...</p>
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
                      <th className="px-4 py-3 font-semibold text-slate-600">Name</th>
                      <th className="px-4 py-3 font-semibold text-slate-600">Email</th>
                      <th className="px-4 py-3 font-semibold text-slate-600">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((r, i) => (
                      <tr key={i} className={r.isValid ? '' : 'bg-rose-50/50'}>
                        <td className="px-4 py-2 text-slate-500">{r.rowIndex}</td>
                        <td className="px-4 py-2 font-medium text-slate-700">{r.original['Name']}</td>
                        <td className="px-4 py-2 text-slate-600">{r.original['Email']}</td>
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
            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isProcessing ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> Uploading...</>
            ) : (
              <><Upload className="w-4 h-4" /> Import Employees</>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
