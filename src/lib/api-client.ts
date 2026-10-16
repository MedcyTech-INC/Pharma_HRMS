/**
 * Pharma HRMS API Client
 * Provides unified HTTP communication between Frontend PWA and FastAPI Backend.
 * Automatically routes calls through Vite dev proxy or Nginx reverse proxy.
 */

const API_BASE_URL = (import.meta as any).env.VITE_API_URL || '/api';
const TOKEN_KEY = 'pharma_hrms_token';
const REFRESH_TOKEN_KEY = 'pharma_hrms_refresh_token';

export interface HealthResponse {
  status: string;
  app: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user_id: string;
  role: string;
}

export interface ApiRootResponse {
  status: string;
  app: string;
  version: string;
  docs_url?: string;
  endpoints?: Record<string, string>;
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setStoredTokens(accessToken: string, refreshToken?: string) {
  localStorage.setItem(TOKEN_KEY, accessToken);
  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
}

export function clearStoredTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

/**
 * Perform a typed HTTP request against the backend API with automatic token attachment
 * and automatic refresh token renewal on 401 responses.
 */
export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const token = getStoredToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response = await fetch(url, {
    ...options,
    headers,
  });

  // Handle automatic token refresh on 401
  if (response.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/refresh')) {
    const refreshed = await apiRefreshToken();
    if (refreshed) {
      headers.set('Authorization', `Bearer ${refreshed}`);
      response = await fetch(url, {
        ...options,
        headers,
      });
    }
  }

  if (!response.ok) {
    let errorDetail = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const errJson = await response.json();
      if (errJson && errJson.detail) {
        errorDetail = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
      }
    } catch {
      // Ignore JSON parse failure on error responses
    }
    throw new Error(errorDetail);
  }

  return response.json() as Promise<T>;
}

/**
 * Refresh access token using the stored refresh token.
 */
export async function apiRefreshToken(): Promise<string | null> {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken })
    });

    if (!res.ok) {
      clearStoredTokens();
      return null;
    }

    const data = await res.json();
    if (data.access_token) {
      setStoredTokens(data.access_token);
      return data.access_token;
    }
  } catch {
    clearStoredTokens();
  }
  return null;
}

/**
 * Verify backend connectivity and health status.
 */
export async function checkBackendHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>('/health');
}

/**
 * Check backend root endpoint information.
 */
export async function checkBackendRoot(): Promise<ApiRootResponse> {
  return apiFetch<ApiRootResponse>('');
}

/**
 * Authenticate against the FastAPI backend /api/auth/login route.
 */
export async function apiLogin(email: string, password: string): Promise<LoginResponse> {
  const result = await apiFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  if (result.access_token) {
    setStoredTokens(result.access_token, result.refresh_token);
  }

  return result;
}

/**
 * Fetch authenticated current user profile from /api/auth/me.
 */
export async function apiGetMe(): Promise<any> {
  return apiFetch<any>('/auth/me');
}
