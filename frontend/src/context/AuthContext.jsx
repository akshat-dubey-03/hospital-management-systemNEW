// src/context/AuthContext.jsx
// Provides authentication state to the entire React application.
// Stores the access token in memory (not localStorage) for security.

import { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { authService } from '../services/auth.service.js';

const AuthContext = createContext(null);

const initialState = {
  user: null,
  accessToken: null,
  isLoading: true, // True while checking existing session
  isAuthenticated: false,
};

function authReducer(state, action) {
  switch (action.type) {
    case 'AUTH_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        accessToken: action.payload.accessToken,
        isAuthenticated: true,
        isLoading: false,
      };
    case 'LOGOUT':
      return {
        ...state,
        user: null,
        accessToken: null,
        isAuthenticated: false,
        isLoading: false,
      };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    default:
      return state;
  }
}

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // On mount, try to restore session via refresh token cookie
  useEffect(() => {
    async function restoreSession() {
      try {
        const data = await authService.refresh();
        const user = await authService.getMe(data.accessToken);
        dispatch({
          type: 'AUTH_SUCCESS',
          payload: { user, accessToken: data.accessToken },
        });
      } catch {
        // No valid session — user needs to log in
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    }

    restoreSession();
  }, []);

  const login = useCallback(async (credentials) => {
    const data = await authService.login(credentials);
    dispatch({
      type: 'AUTH_SUCCESS',
      payload: { user: data.user, accessToken: data.accessToken },
    });
    return data.user;
  }, []);

  const register = useCallback(async (userData) => {
    const data = await authService.register(userData);
    return data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout(state.accessToken);
    } catch {
      // Logout locally even if server call fails
    }
    dispatch({ type: 'LOGOUT' });
  }, [state.accessToken]);

  const updateToken = useCallback((accessToken) => {
    dispatch({
      type: 'AUTH_SUCCESS',
      payload: { user: state.user, accessToken },
    });
  }, [state.user]);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        register,
        logout,
        updateToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
