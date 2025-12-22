import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Alert, Spinner } from 'react-bootstrap';
import { Mail, UserPlus, Check, AlertCircle } from 'lucide-react';
import { sendInvitation, getRoles } from '../api/authService';
import { toast } from 'react-toastify';

const InviteUserModal = ({ show, onHide, onInviteSent }) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('analyst');
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch available roles on mount
  useEffect(() => {
    const fetchRoles = async () => {
      setRolesLoading(true);
      try {
        const response = await getRoles();
        if (response.success) {
          setRoles(response.body);
        }
      } catch (err) {
        console.error('Failed to fetch roles:', err);
        // Fallback roles if API fails
        setRoles([
          { value: 'admin', label: 'Admin', description: 'Full platform access including user management' },
          { value: 'deal_manager', label: 'Deal Manager', description: 'Create and manage M&A deals' },
          { value: 'analyst', label: 'Analyst', description: 'Work on assigned deals and run analyses' },
          { value: 'viewer', label: 'Viewer', description: 'View-only access to assigned deals' }
        ]);
      } finally {
        setRolesLoading(false);
      }
    };

    if (show) {
      fetchRoles();
    }
  }, [show]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      const response = await sendInvitation(email, role);

      if (response.success) {
        toast.success(`Invitation sent to ${email}`);
        setEmail('');
        setRole('analyst');
        onInviteSent?.();
        onHide();
      } else {
        setError(response.message || 'Failed to send invitation');
      }
    } catch (err) {
      setError(err.message || 'Failed to send invitation');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setEmail('');
    setRole('analyst');
    setError('');
    onHide();
  };

  return (
    <Modal show={show} onHide={handleClose} centered>
      <Modal.Header closeButton>
        <Modal.Title className="d-flex align-items-center gap-2">
          <UserPlus size={24} />
          Invite User
        </Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          {error && (
            <Alert variant="danger" className="d-flex align-items-center gap-2">
              <AlertCircle size={18} />
              {error}
            </Alert>
          )}

          <Form.Group className="mb-4">
            <Form.Label className="fw-medium">Email Address</Form.Label>
            <div className="position-relative">
              <Mail
                size={18}
                className="position-absolute"
                style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }}
              />
              <Form.Control
                type="email"
                placeholder="colleague@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{ paddingLeft: '40px' }}
              />
            </div>
            <Form.Text className="text-muted">
              They'll receive an email with a link to create their account
            </Form.Text>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label className="fw-medium">Role</Form.Label>
            {rolesLoading ? (
              <div className="text-center py-3">
                <Spinner animation="border" size="sm" />
              </div>
            ) : (
              <div className="d-flex flex-column gap-2">
                {roles.map((r) => (
                  <div
                    key={r.value}
                    onClick={() => setRole(r.value)}
                    className={`p-3 border rounded cursor-pointer transition-all ${
                      role === r.value
                        ? 'border-primary bg-primary bg-opacity-10'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="d-flex align-items-center justify-content-between">
                      <div>
                        <div className="fw-medium">{r.label}</div>
                        <div className="text-muted small">{r.description}</div>
                      </div>
                      {role === r.value && (
                        <Check size={20} className="text-primary" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            disabled={loading || !email}
            className="d-flex align-items-center gap-2"
          >
            {loading ? (
              <>
                <Spinner animation="border" size="sm" />
                Sending...
              </>
            ) : (
              <>
                <Mail size={16} />
                Send Invitation
              </>
            )}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default InviteUserModal;
