// src/context/UserContext.js
import { createContext, useContext, useState, useEffect } from "react";
import { identifyUser, resetUser } from "../analytics";

const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  // Load user from localStorage if available
  useEffect(() => {
    const authUser = localStorage.getItem("authUser");
    if (authUser && authUser !== "undefined") {
      const userData = JSON.parse(authUser);
      setUser(userData);
      // Identify user in PostHog when loading from localStorage
      identifyUser(userData);
    }
  }, []);

  const login = (userData, token, refreshToken) => {
    localStorage.setItem("authToken", token);
    localStorage.setItem("refreshToken", refreshToken);
    setUser(userData);
    // Identify user in PostHog on login
    identifyUser(userData);
  };

  const setUpdateUser = (value) => {
    setUser((prev) => ({ ...prev, ...value }));
  };

  const logout = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("authUser");
    localStorage.clear();
    setUser(null);
    // Reset PostHog user identity on logout
    resetUser();
  };

  const value = {
    user,
    isLoggedIn: !!user,
    login,
    logout,
    setUpdateUser
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

export const useAuth = () => useContext(UserContext);
