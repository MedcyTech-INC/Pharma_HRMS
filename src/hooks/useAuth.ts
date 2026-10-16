import { useState, useEffect } from 'react';
import { Employee } from '../types';
import { clearStoredTokens, getStoredToken, apiGetMe } from '../lib/api-client';
import { mapRawEmployeeToFrontend } from '../lib/services/employee-service';

export function useAuth(employees: Employee[]) {
  const [currentUserId, setCurrentUserId] = useState<string | null>(() => {
    return localStorage.getItem('hrms_user_session') || null;
  });
  const [profileUser, setProfileUser] = useState<Employee | null>(() => {
    try {
      const cached = localStorage.getItem('hrms_cached_profile');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  // Validate session against backend on mount
  useEffect(() => {
    const token = getStoredToken();
    const savedUserId = localStorage.getItem('hrms_user_session');

    if (!token && !savedUserId) {
      setCurrentUserId(null);
      setProfileUser(null);
      return;
    }

    if (token) {
      apiGetMe()
        .then((me) => {
          if (me && me.id) {
            setCurrentUserId(me.id);
            localStorage.setItem('hrms_user_session', me.id);
            const mapped = mapRawEmployeeToFrontend(me);
            setProfileUser(mapped);
            localStorage.setItem('hrms_cached_profile', JSON.stringify(mapped));
          }
        })
        .catch(() => {
          if (!savedUserId) {
            logout();
          }
        });
    }
  }, []);

  const login = (id: string, profile?: Employee) => {
    setCurrentUserId(id);
    localStorage.setItem('hrms_user_session', id);
    if (profile) {
      setProfileUser(profile);
      localStorage.setItem('hrms_cached_profile', JSON.stringify(profile));
    }
  };

  const logout = () => {
    setCurrentUserId(null);
    setProfileUser(null);
    localStorage.removeItem('hrms_user_session');
    localStorage.removeItem('hrms_cached_profile');
    clearStoredTokens();
  };

  const matchedEmp = currentUserId
    ? employees.find(e =>
        (e.id && e.id.toLowerCase() === currentUserId.toLowerCase()) ||
        (e.employeeCode && e.employeeCode.toLowerCase() === currentUserId.toLowerCase()) ||
        (e.email && e.email.toLowerCase() === currentUserId.toLowerCase())
      ) || null
    : null;

  const currentUser = matchedEmp || profileUser;

  return {
    currentUser,
    currentUserId,
    login,
    logout,
    isAuthenticated: !!currentUser
  };
}
