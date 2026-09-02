import React from 'react';
import { Navigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';

export const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode, allowedRoles: string[] }) => {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to='/login' />;
  
  try {
    const decoded: any = jwtDecode(token);
    if (!allowedRoles.includes(decoded.role)) {
      return <Navigate to='/login' />;
    }
    return <>{children}</>;
  } catch (e) {
    return <Navigate to='/login' />;
  }
};
