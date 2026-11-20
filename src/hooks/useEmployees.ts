import { useState, useCallback } from 'react';
import { Employee } from '../types';
import * as employeeService from '../lib/services/employee-service';

export function useEmployees() {
  const [employees, setEmployees] = useState<Employee[]>(() => {
    try {
      // Actively purge any legacy Medcy/Vizag IVF cache key
      localStorage.removeItem('hrms_local_employees');

      const saved = localStorage.getItem('pharma_hrms_local_employees');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (
          Array.isArray(parsed) && 
          parsed.length > 0 && 
          parsed.every(e => (e.id || '').toUpperCase().startsWith('OL') && e.id !== 'OL001')
        ) {
          return parsed;
        }
      }
      return [];
    } catch {
      return [];
    }
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const saveLocalData = (emps: Employee[]) => {
    try {
      // Strip heavy photo payloads and historical archives before caching to prevent QuotaExceededError (5MB limit)
      const lightweightEmps = emps.map(emp => ({
        ...emp,
        attendanceRecords: (emp.attendanceRecords || []).slice(-5).map(a => ({
          date: a.date,
          status: a.status,
          note: a.note
        })),
        checkInLogs: (emp.checkInLogs || []).slice(-5).map(c => ({
          ...c,
          photoUrl: undefined,
          checkOutPhotoUrl: undefined
        })),
        locationPins: (emp.locationPins || []).slice(-5).map(p => ({
          ...p,
          photoUrl: undefined
        })),
        payslips: (emp.payslips || []).slice(-3)
      }));

      localStorage.setItem('pharma_hrms_local_employees', JSON.stringify(lightweightEmps));
    } catch (storageErr) {
      console.warn('Could not cache employees to localStorage:', storageErr);
      try {
        // If quota was already corrupted or exceeded by previous sessions, purge old cache safely
        localStorage.removeItem('pharma_hrms_local_employees');
        localStorage.removeItem('hrms_local_employees');
      } catch {
        // Ignore
      }
    }
  };

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      try {
        await employeeService.seedInitialDatabase();
      } catch (seedErr) {
        console.warn('Seed database checked/passed:', seedErr);
      }

      const emps = await employeeService.fetchAllEmployeesData();
      setEmployees(emps);
      saveLocalData(emps);
    } catch (err: any) {
      console.error('Error fetching Supabase employee data:', err);
      const errDetails = err?.message || err?.details || 'Database connection offline.';
      setError(`Database connection notice: "${errDetails}". Ensure Supabase is configured and tables are migrated.`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const addEmployee = async (emp: Omit<Employee, 'isCheckedIn' | 'leaveBalance' | 'leaveRequests' | 'attendanceRecords' | 'checkInLogs' | 'payslips'>) => {
    await employeeService.createEmployee(emp);
    await loadData();
  };

  const updateEmployee = async (id: string, fields: Partial<Employee>) => {
    await employeeService.updateEmployee(id, fields);
    await loadData();
  };

  const deleteEmployee = async (id: string) => {
    await employeeService.deleteEmployee(id);
    await loadData();
  };

  const toggleStatus = async (id: string, status: 'active' | 'inactive') => {
    await employeeService.toggleEmployeeStatus(id, status);
    await loadData();
  };

  const changePassword = async (id: string, newPassword: string) => {
    await employeeService.updateEmployeePassword(id, newPassword);
    setEmployees(prev => {
      const updated = prev.map(e => e.id === id ? { ...e, password: newPassword } : e);
      saveLocalData(updated);
      return updated;
    });
    await loadData();
  };

  return {
    employees,
    isLoading,
    error,
    isLocalMode: false,
    loadData,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    toggleStatus,
    changePassword
  };
}
