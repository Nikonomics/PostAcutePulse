import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { toast } from "react-toastify";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { useAuth } from "../context/UserContext";
import { signUp } from "../api/authService";
import { useNavigate, Link } from 'react-router-dom';

// Validation schema for signup
const signupSchema = yup.object().shape({
  first_name: yup.string().required("First name is required"),
  last_name: yup.string().required("Last name is required"),
  email: yup.string().email("Invalid email address").required("Email is required"),
  password: yup.string()
    .min(6, "Password must be at least 6 characters")
    .required("Password is required"),
  confirm_password: yup.string()
    .oneOf([yup.ref('password'), null], 'Passwords must match')
    .required("Please confirm your password"),
});

const Signup = () => {
  const { login: loginUser } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(signupSchema),
  });

  const onSignupSubmit = async (data) => {
    try {
      const userData = {
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        password: data.password,
      };

      const res = await signUp(userData);
      if (res.success === true && res.code === 200) {
        loginUser(res.body.user, res.body.token);
        toast.success(res.message);
        reset();
        navigate('/dashboard');
      } else {
        toast.error(res.message);
      }
    } catch (err) {
      toast.error(err.message || "Registration failed");
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <h1>SNFalyze.ai</h1>
            <p>M&A Deal Analysis Platform</p>
            <span className="admin-badge">CREATE ACCOUNT</span>
          </div>

          <div className="login-form-container">
            <h2>Get Started</h2>
            <p>Create your account to access the platform</p>

            <form onSubmit={handleSubmit(onSignupSubmit)} className="login-form">
              <div className="form-row" style={{ display: 'flex', gap: '12px' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>First Name</label>
                  <input
                    type="text"
                    placeholder="First name"
                    {...register("first_name")}
                  />
                  {errors.first_name && <span className="error-message">{errors.first_name.message}</span>}
                </div>

                <div className="form-group" style={{ flex: 1 }}>
                  <label>Last Name</label>
                  <input
                    type="text"
                    placeholder="Last name"
                    {...register("last_name")}
                  />
                  {errors.last_name && <span className="error-message">{errors.last_name.message}</span>}
                </div>
              </div>

              <div className="form-group">
                <label>Email Address</label>
                <input
                  type="email"
                  placeholder="Enter your email address"
                  autoComplete="email"
                  {...register("email")}
                />
                {errors.email && <span className="error-message">{errors.email.message}</span>}
              </div>

              <div className="form-group">
                <label>Password</label>
                <div className="form-group password-input">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Create a password"
                    autoComplete="new-password"
                    {...register("password")}
                  />
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
                {errors.password && <span className="error-message">{errors.password.message}</span>}
              </div>

              <div className="form-group">
                <label>Confirm Password</label>
                <div className="form-group password-input">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Confirm your password"
                    autoComplete="new-password"
                    {...register("confirm_password")}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    tabIndex="-1"
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                {errors.confirm_password && <span className="error-message">{errors.confirm_password.message}</span>}
              </div>

              <button type="submit" className="login-btn" disabled={isSubmitting}>
                {isSubmitting ? 'Creating Account...' : 'Create Account'}
              </button>
            </form>

            <div className="signup-link" style={{ textAlign: 'center', marginTop: '20px' }}>
              <p style={{ color: '#6b7280', fontSize: '14px' }}>
                Already have an account?{' '}
                <Link to="/login" style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: '500' }}>
                  Sign in
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

export default Signup;
