import React, { createContext, useContext, useState, useEffect } from 'react';
import { AdminRole, AdminUser, Permission, ROLE_PERMISSIONS, ROLE_INFO } from '../types/auth';
import { api } from '../lib/api';

// Pre-seeded operator profiles for instant RBAC switching & multi-user testing
export const KNOWN_OPERATORS: Array<{ id: string; name: string; phone: string; role: AdminRole; title: string }> = [
  { id: 'admin-super', name: 'Super Admin Root', phone: '+919000000001', role: 'superadmin', title: 'Chief System Administrator' },
  { id: 'admin-ops', name: 'Vikram Shinde', phone: '+919000000002', role: 'operations_lead', title: 'Head of Rural Logistics & Nurseries' },
  { id: 'admin-finance', name: 'Ramesh Kulkarni', phone: '+919000000003', role: 'finance_admin', title: 'Chief Financial Officer' },
  { id: 'admin-compliance', name: 'Pooja Deshmukh', phone: '+919000000004', role: 'compliance_officer', title: 'Legal & SHG Compliance Officer' },
  { id: 'admin-agronomy', name: 'Dr. Arvind Joshi', phone: '+919000000005', role: 'agronomist', title: 'Chief Agricultural Scientist' },
  { id: 'admin-moderator', name: 'Sunita Patil', phone: '+919000000006', role: 'content_moderator', title: 'Catalog & Public Grievance Lead' },
];

interface AuthContextType {
  currentUser: AdminUser | null;
  currentRole: AdminRole;
  isAuthenticated: boolean;
  hasPermission: (permission: Permission) => boolean;
  login: (phone: string, mpin: string) => Promise<void>;
  switchOperator: (operatorId: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(null);
  const [currentRole, setCurrentRole] = useState<AdminRole>('superadmin');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initialize from storage or auto-login with default superadmin
  useEffect(() => {
    const initAuth = async () => {
      try {
        const storedUser = localStorage.getItem('agrovercity_superadmin_user');
        const storedToken = localStorage.getItem('agrovercity_superadmin_token');

        if (storedUser && storedToken) {
          const parsed = JSON.parse(storedUser);
          setCurrentUser(parsed);
          const role = (parsed.adminRole || 'superadmin') as AdminRole;
          setCurrentRole(role);
          api.setRole(role);
        } else {
          // Auto-login with default superadmin account
          const { user } = await api.loginWithPhoneMpin('+919000000001', '1234');
          setCurrentUser(user);
          const role = (user.adminRole || 'superadmin') as AdminRole;
          setCurrentRole(role);
          api.setRole(role);
          localStorage.setItem('agrovercity_superadmin_user', JSON.stringify(user));
        }
      } catch (err) {
        console.warn('Auto-login initialization fallback:', err);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (phone: string, mpin: string) => {
    setIsLoading(true);
    try {
      const { user } = await api.loginWithPhoneMpin(phone, mpin);
      setCurrentUser(user);
      const role = (user.adminRole || 'superadmin') as AdminRole;
      setCurrentRole(role);
      api.setRole(role);
      localStorage.setItem('agrovercity_superadmin_user', JSON.stringify(user));
    } finally {
      setIsLoading(false);
    }
  };

  const switchOperator = async (operatorId: string) => {
    setIsLoading(true);
    try {
      const op = KNOWN_OPERATORS.find((o) => o.id === operatorId);
      if (!op) throw new Error('Unknown operator');

      const { user } = await api.loginWithPhoneMpin(op.phone, '1234');
      setCurrentUser(user);
      const role = (user.adminRole || op.role) as AdminRole;
      setCurrentRole(role);
      api.setRole(role);
      localStorage.setItem('agrovercity_superadmin_user', JSON.stringify(user));
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('agrovercity_superadmin_token');
    localStorage.removeItem('agrovercity_superadmin_user');
    setCurrentUser(null);
    setCurrentRole('superadmin');
  };

  const hasPermission = (permission: Permission): boolean => {
    if (!currentUser) return false;
    if (currentRole === 'superadmin') return true;
    const permissions = ROLE_PERMISSIONS[currentRole] || [];
    return permissions.includes(permission);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        currentRole,
        isAuthenticated: !!currentUser,
        hasPermission,
        login,
        switchOperator,
        logout,
        isLoading,
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
