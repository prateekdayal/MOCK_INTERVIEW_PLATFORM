// frontend/src/context/AuthContext.jsx
import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios'; // Ensure axios is imported

// Create the context
const AuthContext = createContext();

// Create a custom hook to use the AuthContext
export const useAuth = () => {
  return useContext(AuthContext);
};

// Create the AuthProvider component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // --- Initial check on component mount ---
  useEffect(() => {
    const checkAuth = async () => {
      console.log('AuthContext: Running initial checkAuth...');
      const storedToken = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');
      
      console.log('AuthContext: Stored Token:', storedToken ? 'Present' : 'Not Present');
      console.log('AuthContext: Stored User:', storedUser ? 'Present' : 'Not Present');

      if (storedToken && storedUser) {
        try {
          const config = {
            headers: {
              Authorization: `Bearer ${storedToken}`,
            },
          };
          const response = await axios.get('http://localhost:5000/api/auth/me', config);
          
          setUser(response.data.user);
          setToken(storedToken);
          setIsAuthenticated(true);
          console.log('AuthContext: Token validated. User is authenticated:', response.data.user.username);
        } catch (error) {
          console.error('AuthContext: Token validation failed, clearing local storage:', error.message);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setUser(null);
          setToken(null);
          setIsAuthenticated(false);
          console.log('AuthContext: Cleared local storage and set unauthenticated state.');
        }
      } else {
        setUser(null);
        setToken(null);
        setIsAuthenticated(false);
        console.log('AuthContext: No token/user in localStorage. Set unauthenticated state.');
      }
      setAuthLoading(false);
    };

    checkAuth();
  }, []); // Run once on mount

  // --- Login function ---
  const login = (userData, jwtToken) => {
    setUser(userData);
    setToken(jwtToken);
    setIsAuthenticated(true);
    localStorage.setItem('token', jwtToken);
    localStorage.setItem('user', JSON.stringify(userData));
    console.log('AuthContext: User logged in:', userData.username);
  };

  // --- Logout function ---
  const logout = () => {
    setUser(null);
    setToken(null);
    setIsAuthenticated(false);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    console.log('AuthContext: User logged out.');
    // Optionally, refresh page to clear all component state
    // window.location.reload(); 
  };

  // --- Axios Interceptors for Request and Response ---
  useEffect(() => {
    // Request Interceptor: Add Authorization header
    const requestInterceptor = axios.interceptors.request.use(
      (config) => {
        const currentToken = localStorage.getItem('token');
        if (currentToken) {
          config.headers.Authorization = `Bearer ${currentToken}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response Interceptor: Handle 401 Unauthorized errors globally
    const responseInterceptor = axios.interceptors.response.use(
      (response) => response, // Pass through successful responses
      (error) => {
        // If the error response status is 401 (Unauthorized)
        if (error.response && error.response.status === 401) {
          console.warn('AuthContext: Received 401 Unauthorized. Auto-logging out.');
          logout(); // Trigger logout
          // Optional: redirect to login page after logout
          // history.push('/login'); // Requires react-router-dom or similar
        }
        return Promise.reject(error); // Re-throw the error so component can handle it
      }
    );

    // Cleanup interceptors on unmount
    return () => {
      axios.interceptors.request.eject(requestInterceptor);
      axios.interceptors.response.eject(responseInterceptor);
    };
  }, []); // Empty dependency array, run once on mount

  const authContextValue = {
    user,
    token,
    isAuthenticated,
    authLoading,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={authContextValue}>
      {children}
    </AuthContext.Provider>
  );
};