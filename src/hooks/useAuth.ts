import { useState, useEffect } from 'react';
import { Employee } from '../types';
import { clearStoredTokens, getStoredToken, apiGetMe } from '../lib/api-client';
import { mapRawEmployeeToFrontend } from '../lib/services/employee-service';

export function useAuth(employees: Employee[]) {
  const [currentUserId, setCurrentUserId] = useState<string | null>(() => {
    return localStorage.getItem('hrms_user_session') || null;
  });
  const [profileUser, setProfileUser] = useState<Employee | null>(null);

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
            setProfileUser(mapRawEmployeeToFrontend(me));
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
    }
  };

  const logout = () => {
    setCurrentUserId(null);
    setProfileUser(null);
    localStorage.removeItem('hrms_user_session');
    clearStoredTokens();
  };

  const currentUser = (currentUserId ? employees.find(e => e.id === currentUserId) : null) || profileUser;

  return {
    currentUser,
    currentUserId,
    login,
    logout,
    isAuthenticated: !!currentUser
  };
}
