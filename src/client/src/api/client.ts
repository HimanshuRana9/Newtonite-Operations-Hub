export interface ApiError extends Error {
  statusCode?: number;
  details?: any;
}

export function getAuthToken(): string | null {
  return localStorage.getItem('newtonite_token');
}

export function setAuthToken(token: string) {
  localStorage.setItem('newtonite_token', token);
}

export function removeAuthToken() {
  localStorage.removeItem('newtonite_token');
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit & { idempotencyKey?: string } = {}
): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>)
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (options.idempotencyKey) {
    headers['Idempotency-Key'] = options.idempotencyKey;
  }

  const response = await fetch(endpoint.startsWith('/api') ? endpoint : `/api${endpoint}`, {
    ...options,
    headers
  });

  if (response.status === 401 && !endpoint.includes('/auth/login')) {
    removeAuthToken();
    window.location.href = '/login';
    const err: ApiError = new Error('Authentication expired. Please log in again.');
    err.statusCode = 401;
    throw err;
  }

  let data: any;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const error: ApiError = new Error(
      typeof data === 'object' && data?.error ? data.error : `HTTP ${response.status} Request Failed`
    );
    error.statusCode = response.status;
    error.details = data?.details;
    throw error;
  }

  return data as T;
}
