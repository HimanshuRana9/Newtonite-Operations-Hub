import React, { createContext, useContext, useState, useEffect } from 'react';
import { CurrentUser, Role } from '../types/index.js';
import { apiRequest, setAuthToken, removeAuthToken, getAuthToken } from '../api/client.js';

interface AuthContextType {
  user: CurrentUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasTeamRole: (teamId: string, minRole: Role) => boolean;
  refetchUser: () => Promise<void>;
}

const ROLE_WEIGHT: Record<Role, number> = {
  VIEWER: 1,
  MEMBER: 2,
  LEAD: 3,
  ADMIN: 4
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchCurrentUser = async () => {
    const token = getAuthToken();
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const data = await apiRequest<CurrentUser>('/api/auth/me');
      setUser(data);
    } catch {
      removeAuthToken();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await apiRequest<{ token: string; user: CurrentUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    setAuthToken(res.token);
    setUser(res.user);
  };

  const logout = () => {
    removeAuthToken();
    setUser(null);
  };

  const hasTeamRole = (teamId: string, minRole: Role): boolean => {
    if (!user) return false;
    const membership = user.memberships.find((m) => m.teamId === teamId);
    if (!membership) return false;
    return ROLE_WEIGHT[membership.role] >= ROLE_WEIGHT[minRole];
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        logout,
        hasTeamRole,
        refetchUser: fetchCurrentUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
