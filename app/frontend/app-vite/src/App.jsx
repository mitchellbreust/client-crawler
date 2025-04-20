import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Components
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import Dashboard from './components/Dashboard/Dashboard';
import JobList from './components/Jobs/JobList';
import JobDetail from './components/Jobs/JobDetail';
import ConversationView from './components/Conversations/ConversationView';
import Navbar from './components/Layout/Navbar';
import ProtectedRoute from './components/Auth/ProtectedRoute';

// Context
import { AuthProvider } from './context/AuthContext';

function App() {
  // Debug helper to monitor token state
  useEffect(() => {
    const checkToken = () => {
      const token = localStorage.getItem('token');
      console.log('App component token check:', token ? 'Token exists' : 'No token');
    };
    
    // Check on initial render
    checkToken();
    
    // Set up periodic checks to see if token gets cleared unexpectedly
    const interval = setInterval(checkToken, 5000);
    
    return () => clearInterval(interval);
  }, []);
  
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Navbar />
          <Routes>
            <Route path="/" element={<Navigate to="/login" />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            
            <Route path="/jobs" element={
              <ProtectedRoute>
                <JobList />
              </ProtectedRoute>
            } />
            
            <Route path="/jobs/:jobId" element={
              <ProtectedRoute>
                <JobDetail />
              </ProtectedRoute>
            } />
            
            <Route path="/conversations/:jobId" element={
              <ProtectedRoute>
                <ConversationView />
              </ProtectedRoute>
            } />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App; 