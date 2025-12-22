import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, CheckCircle, XCircle, Loader } from 'lucide-react';
import { toast } from "react-toastify";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { useAuth } from "../context/UserContext";
import { validateInvitation, acceptInvitation } from "../api/authService";
import { useNavigate, useSearchParams, Link } from 'react-router-dom';

// Validation schema for accept invite form
const acceptInviteSchema = yup.object().shape({
  first_name: yup.string().required("First name is required"),
  last_name: yup.string().required("Last name is required"),
  password: yup.string()
    .min(8, "Password must be at least 8 characters")
    .required("Password is required"),
  confirm_password: yup.string()
    .oneOf([yup.ref('password'), null], 'Passwords must match')
    .required("Please confirm your password"),
});

const AcceptInvite = () => {
  const { login: loginUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [invitationData, setInvitationData] = useState(null);
  const [validationError, setValidationError] = useState(null);
  const [isValidating, setIsValidating] = useState(true);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(acceptInviteSchema),
  });

  // Validate token on mount
  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setValidationError("No invitation token provided");
        setIsValidating(false);
        return;
      }

      try {
        const response = await validateInvitation(token);
        if (response.success) {
          setInvitationData(response.body);
        } else {
          setValidationError(response.message || "Invalid invitation");
        }
      } catch (error) {
        setValidationError(error.message || "Failed to validate invitation");
      } finally {
        setIsValidating(false);
      }
    };

    validateToken();
  }, [token]);

  const onSubmit = async (data) => {
    try {
      const response = await acceptInvitation(
        token,
        data.first_name,
        data.last_name,
        data.password
      );

      if (response.success) {
        loginUser(response.body.user, response.body.token);
        toast.success("Account created successfully! Welcome to SNFalyze.");
        navigate('/dashboard');
      } else {
        toast.error(response.message || "Failed to create account");
      }
    } catch (error) {
      toast.error(error.message || "Failed to create account");
    }
  };

  // Role display helper
  const getRoleDisplay = (role) => {
    const roleLabels = {
      'admin': 'Administrator',
      'deal_manager': 'Deal Manager',
      'analyst': 'Analyst',
      'viewer': 'Viewer'
    };
    return roleLabels[role] || role;
  };

  // Loading state
  if (isValidating) {
    return (
      <div className="login-page">
        <div className="login-container">
          <div className="login-card">
            <div className="login-header">
              <h1>SNFalyze.ai</h1>
              <p>M&A Deal Analysis Platform</p>
            </div>
            <div className="login-form-container" style={{ textAlign: 'center', padding: '60px 20px' }}>
              <Loader size={48} style={{ animation: 'spin 1s linear infinite', color: '#6366f1' }} />
              <p style={{ marginTop: '20px', color: '#6b7280' }}>Validating your invitation...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (validationError) {
    return (
      <div className="login-page">
        <div className="login-container">
          <div className="login-card">
            <div className="login-header">
              <h1>SNFalyze.ai</h1>
              <p>M&A Deal Analysis Platform</p>
            </div>
            <div className="login-form-container" style={{ textAlign: 'center', padding: '40px 20px' }}>
              <XCircle size={64} style={{ color: '#ef4444', marginBottom: '20px' }} />
              <h2 style={{ color: '#1f2937', marginBottom: '12px' }}>Invalid Invitation</h2>
              <p style={{ color: '#6b7280', marginBottom: '24px' }}>{validationError}</p>
              <Link
                to="/login"
                style={{
                  display: 'inline-block',
                  padding: '12px 24px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  textDecoration: 'none',
                  borderRadius: '8px',
                  fontWeight: '500'
                }}
              >
                Go to Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Success - show registration form
  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <h1>SNFalyze.ai</h1>
            <p>M&A Deal Analysis Platform</p>
            <span className="admin-badge">INVITATION</span>
          </div>

          <div className="login-form-container">
            <div style={{
              background: '#f0fdf4',
              border: '1px solid #86efac',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px'
            }}>
              <CheckCircle size={24} style={{ color: '#22c55e', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <p style={{ margin: 0, fontWeight: '500', color: '#166534' }}>
                  You've been invited by {invitationData?.invited_by}
                </p>
                <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#15803d' }}>
                  You'll be joining as <strong>{getRoleDisplay(invitationData?.role)}</strong>
                </p>
              </div>
            </div>

            <h2>Complete Your Account</h2>
            <p style={{ color: '#6b7280', marginBottom: '24px' }}>
              Create your password for <strong>{invitationData?.email}</strong>
            </p>

            <form onSubmit={handleSubmit(onSubmit)} className="login-form">
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
                  value={invitationData?.email || ''}
                  disabled
                  style={{ backgroundColor: '#f3f4f6', cursor: 'not-allowed' }}
                />
              </div>

              <div className="form-group">
                <label>Password</label>
                <div className="form-group password-input">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Create a password (min 8 characters)"
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
                {isSubmitting ? 'Creating Account...' : 'Complete Setup'}
              </button>
            </form>

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

export default AcceptInvite;
