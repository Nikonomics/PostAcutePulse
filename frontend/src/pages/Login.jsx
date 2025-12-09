import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { toast } from "react-toastify";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import {loginSchema} from "../validations/authSchema";
import { useAuth } from "../context/UserContext";
import {login} from "../api/authService";
import { useNavigate, Link } from 'react-router-dom';
const Login = () => {
  const { login: loginUser } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(loginSchema),
  });

  const onLoginSubmit = async (data) => {
    try {
      const res = await login(data.email, data.password);
      if (res.success === true && res.code === 200) {
        loginUser(res.body.user, res.body.token, res.body.refresh); // store in context
        toast.success(res.message); 
        reset();
        navigate('/dashboard');
      } else {
        toast.error(res.message);
      }
    } catch (err) {
      toast.error(err.message || "Login failed");
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <h1>SNFalyze.ai</h1>
            <p>M&A Deal Analysis Platform</p>
            <span className="admin-badge">ADMIN PORTAL</span>
          </div>
          
          <div className="login-form-container">
            <h2>Welcome Back</h2>
            <p>Please sign in to your admin account</p>
            
            <form onSubmit={handleSubmit(onLoginSubmit)} className="login-form">
              <div className="form-group">
                <label>Email Address</label>
                <input
                  type="email"
                  name="email"
                  placeholder="Enter your email address"
                  autoComplete="username"
                  {...register("email")}
                />
                {errors.email && <span className="error-message">{errors.email.message}</span>}
              </div>
              
              <div className="form-group">
                <label>Password</label>
                <div className="form-group password-input">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    {...register("password")}
                  />
                  {errors.password && <span className="error-message">{errors.password.message}</span>}
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex="-1"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
              
              {/* <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="rememberMe"
                    checked={formData.rememberMe}
                    onChange={handleChange}
                  />
                  Remember me
                </label>
              </div> */}
              
              <button type="submit" className="login-btn" disabled={isSubmitting}>
                Sign In to Admin Panel
              </button>
            </form>
            
            <div className="signup-link" style={{ textAlign: 'center', marginTop: '20px' }}>
              <p style={{ color: '#6b7280', fontSize: '14px' }}>
                Don't have an account?{' '}
                <Link to="/signup" style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: '500' }}>
                  Create one
                </Link>
              </p>
            </div>

            <div className="security-features">
              <p>SECURITY FEATURES</p>
              <div className="security-items">
                <div className="security-item">
                  <span className="security-dot green"></span>
                  SSL Encrypted
                </div>
                <div className="security-item">
                  <span className="security-dot red"></span>
                  2FA Protected
                </div>
                <div className="security-item">
                  <span className="security-dot yellow"></span>
                  Secure Login
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;