import React, { createContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  // Initialize token from localStorage with explicit logging
  const savedToken = localStorage.getItem('token');
  console.log('Initial token from localStorage:', savedToken);
  
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(savedToken);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check if user is authenticated
  useEffect(() => {
    const fetchUser = async () => {
      if (!token) {
        console.log('No token available, skipping user fetch');
        setLoading(false);
        return;
      }

      try {
        console.log('Fetching current user with token:', token);
        const response = await authAPI.getCurrentUser();
        console.log('User data received:', response.data);
        setUser(response.data.user);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching user:', error.response?.data || error.message);
        logout();
        setLoading(false);
      }
    };

    fetchUser();
  }, [token]);

  // Register a new user
  const register = async (userData) => {
    try {
      setError(null);
      const response = await authAPI.register(userData);
      console.log('Register response:', response.data);
      
      const access_token = response.data.access_token;
      const user = response.data.user;
      
      if (!access_token) {
        console.error('No token received in register response');
        return { success: false, error: 'No token received from server' };
      }
      
      // Save token to localStorage and state
      localStorage.setItem('token', access_token);
      setToken(access_token);
      setUser(user);
      
      console.log('Token saved after register:', localStorage.getItem('token'));
      
      return { success: true };
    } catch (error) {
      console.error('Register error:', error.response?.data || error.message);
      setError(error.response?.data?.message || 'Registration failed. Please try again.');
      return { success: false, error: error.response?.data?.message || 'Registration failed' };
    }
  };

  // Login user
  const login = async (credentials) => {
    try {
      setError(null);
      const response = await authAPI.login(credentials);
      console.log('Login response:', response.data);
      
      const access_token = response.data.access_token;
      const user = response.data.user;
      
      if (!access_token) {
        console.error('No token received in login response');
        return { success: false, error: 'No token received from server' };
      }
      
      // Save token to localStorage and state
      localStorage.setItem('token', access_token);
      setToken(access_token);
      setUser(user);
      
      console.log('Token saved after login:', localStorage.getItem('token'));
      
      return { success: true };
    } catch (error) {
      console.error('Login error:', error.response?.data || error.message);
      setError(error.response?.data?.message || 'Login failed. Please check your credentials.');
      return { success: false, error: error.response?.data?.message || 'Login failed' };
    }
  };

  // Logout user
  const logout = () => {
    console.log('Logging out, removing token');
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setError(null);
  };

  // Update user settings (e.g., Twilio credentials)
  const updateSettings = async (settings) => {
    try {
      setError(null);
      const response = await authAPI.updateUser(settings);
      console.log('Settings update response:', response.data);
      setUser(response.data.user);
      return { success: true };
    } catch (error) {
      console.error('Update settings error:', error.response?.data || error.message);
      const msg = error.response?.data?.message || 'Failed to update settings';
      setError(msg);
      return { success: false, error: msg };
    }
  };

  const contextValue = {
    user, 
    token, 
    loading, 
    error,
    register,
    login,
    logout,
    updateSettings,
    isAuthenticated: !!token
  };
  
  console.log('AuthContext state:', {
    hasToken: !!token,
    loading,
    hasUser: !!user,
    isAuthenticated: !!token
  });

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};