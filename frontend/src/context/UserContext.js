// src/context/UserContext.js
import { createContext, useContext, useState, useEffect } from "react";

const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  // Load user from localStorage if available
  useEffect(() => {
    const authUser = localStorage.getItem("authUser");
    if (authUser && authUser !== "undefined") {
      // Fetch user profile if needed here
      setUser(JSON.parse(authUser)); // or full user data
    }
  }, []);

  const login = (userData, token, refreshToken) => {
    localStorage.setItem("authToken", token);
    localStorage.setItem("refreshToken", refreshToken);
    setUser(userData);
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
