import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Check, X, Loader } from 'lucide-react';
import { useWizard, WIZARD_STEPS } from '../WizardContext';
import { getActiveUsers } from '../../../api/authService';

const TeamTimeline = ({ onSubmit }) => {
  const {
    dealData,
    updateDealData,
    errors,
    validateStep,
    goToPreviousStep,
    isSubmitting,
    isExtracting,
    extractionProgress,
    path,
  } = useWizard();

  // For AI path, require extraction to complete before allowing deal creation
  const isAIPath = path === 'ai';
  const extractionComplete = !isExtracting && extractionProgress >= 100;
  const canSubmit = !isSubmitting && (!isAIPath || extractionComplete);

  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [teamMemberSearch, setTeamMemberSearch] = useState('');
  const [showTeamDropdown, setShowTeamDropdown] = useState(false);
  const teamDropdownRef = useRef(null);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await getActiveUsers();
        if (response.body) {
          setUsers(response.body);
          // Set default deal lead if not set
          if (!dealData.deal_lead_id && response.body.length > 0) {
            updateDealData({ deal_lead_id: response.body[0].id });
          }
        }
      } catch (error) {
        console.error('Error fetching users:', error);
      } finally {
        setLoadingUsers(false);
      }
    };

    fetchUsers();
  }, [dealData.deal_lead_id, updateDealData]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (teamDropdownRef.current && !teamDropdownRef.current.contains(e.target)) {
        setShowTeamDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Note: Extraction progress is handled by DocumentUpload component

  const handleChange = (field, value) => {
    updateDealData({ [field]: value });
  };

  const handleAddTeamMember = (user) => {
    if (!dealData.deal_team_members.find(m => m.id === user.id)) {
      updateDealData({
        deal_team_members: [...dealData.deal_team_members, { id: user.id, name: `${user.first_name} ${user.last_name}` }],
      });
    }
    setTeamMemberSearch('');
    setShowTeamDropdown(false);
  };

  const handleRemoveTeamMember = (userId) => {
    updateDealData({
      deal_team_members: dealData.deal_team_members.filter(m => m.id !== userId),
    });
  };

  const handleSubmit = () => {
    if (validateStep(WIZARD_STEPS.TEAM_TIMELINE)) {
      onSubmit();
    }
  };

  const filteredUsers = users.filter(user => {
    const fullName = `${user.first_name} ${user.last_name}`.toLowerCase();
    const isNotAlreadySelected = !dealData.deal_team_members.find(m => m.id === user.id);
    const isNotLead = user.id !== dealData.deal_lead_id;
    const isNotAssistant = user.id !== dealData.assistant_deal_lead_id;
    return fullName.includes(teamMemberSearch.toLowerCase()) && isNotAlreadySelected && isNotLead && isNotAssistant;
  });

  if (loadingUsers) {
    return (
      <div className="step-container" style={{ textAlign: 'center', padding: '48px' }}>
        <Loader size={32} className="extraction-progress-spinner" style={{ color: '#7c3aed' }} />
        <p style={{ marginTop: '16px', color: '#64748b' }}>Loading team members...</p>
      </div>
    );
  }

  return (
    <div className="step-container">
      {/* Extraction Status - AI Path Only */}
      {isAIPath && isExtracting && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 16px',
          backgroundColor: '#ede9fe',
          borderRadius: '8px',
          marginBottom: '24px',
          color: '#5b21b6',
        }}>
          <Loader size={20} className="extraction-progress-spinner" />
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: '14px' }}>Analyzing documents... {Math.round(extractionProgress)}%</span>
            <div style={{
              marginTop: '8px',
              height: '4px',
              backgroundColor: '#c4b5fd',
              borderRadius: '2px',
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${extractionProgress}%`,
                backgroundColor: '#7c3aed',
                transition: 'width 0.3s',
              }} />
            </div>
          </div>
        </div>
      )}

      {/* Extraction Complete */}
      {isAIPath && extractionComplete && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 16px',
          backgroundColor: '#f0fdf4',
          borderRadius: '8px',
          marginBottom: '24px',
          color: '#166534',
        }}>
          <Check size={20} />
          <span style={{ fontSize: '14px' }}>Document analysis complete</span>
        </div>
      )}

      <h2 className="step-title">Team & Timeline</h2>

      {/* Deal Lead */}
      <div className="form-group">
        <label className="form-label required">Deal Lead</label>
        <select
          className={`form-select ${errors.deal_lead_id ? 'error' : ''}`}
          value={dealData.deal_lead_id || ''}
          onChange={(e) => handleChange('deal_lead_id', parseInt(e.target.value))}
        >
          <option value="">Select deal lead...</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.first_name} {user.last_name}
            </option>
          ))}
        </select>
        {errors.deal_lead_id && <span className="form-error">{errors.deal_lead_id}</span>}
      </div>

      {/* Assistant Deal Lead */}
      <div className="form-group">
        <label className="form-label">Assistant Deal Lead</label>
        <select
          className="form-select"
          value={dealData.assistant_deal_lead_id || ''}
          onChange={(e) => handleChange('assistant_deal_lead_id', e.target.value ? parseInt(e.target.value) : null)}
        >
          <option value="">Select assistant (optional)...</option>
          {users
            .filter(u => u.id !== dealData.deal_lead_id)
            .map((user) => (
              <option key={user.id} value={user.id}>
                {user.first_name} {user.last_name}
              </option>
            ))}
        </select>
      </div>

      {/* Team Members */}
      <div className="form-group">
        <label className="form-label">Team Members</label>
        <div className="team-member-select" ref={teamDropdownRef}>
          <input
            type="text"
            className="form-input"
            placeholder="Search and add team members..."
            value={teamMemberSearch}
            onChange={(e) => setTeamMemberSearch(e.target.value)}
            onFocus={() => setShowTeamDropdown(true)}
          />
          {showTeamDropdown && filteredUsers.length > 0 && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              backgroundColor: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              maxHeight: '200px',
              overflowY: 'auto',
              zIndex: 10,
            }}>
              {filteredUsers.map((user) => (
                <div
                  key={user.id}
                  onClick={() => handleAddTeamMember(user)}
                  style={{
                    padding: '10px 12px',
                    cursor: 'pointer',
                    borderBottom: '1px solid #f1f5f9',
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = '#f8fafc'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
                >
                  {user.first_name} {user.last_name}
                  {user.role && (
                    <span style={{ fontSize: '12px', color: '#94a3b8', marginLeft: '8px' }}>
                      {user.role}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        {dealData.deal_team_members.length > 0 && (
          <div className="team-member-tags">
            {dealData.deal_team_members.map((member) => (
              <span key={member.id} className="team-member-tag">
                {member.name}
                <button
                  type="button"
                  className="team-member-tag-remove"
                  onClick={() => handleRemoveTeamMember(member.id)}
                >
                  <X size={14} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Target Close Date */}
      <div className="form-group">
        <label className="form-label">Target Close Date</label>
        <input
          type="date"
          className="form-input"
          value={dealData.target_close_date}
          onChange={(e) => handleChange('target_close_date', e.target.value)}
        />
      </div>

      {/* Deal Summary */}
      <div style={{
        backgroundColor: '#f8fafc',
        borderRadius: '8px',
        padding: '16px',
        marginTop: '24px',
      }}>
        <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b', marginBottom: '12px' }}>
          Deal Summary
        </div>
        <div style={{ display: 'grid', gap: '8px', fontSize: '13px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#64748b' }}>Deal Name</span>
            <span style={{ color: '#1e293b', fontWeight: '500' }}>{dealData.deal_name || '—'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#64748b' }}>Source</span>
            <span style={{ color: '#1e293b' }}>
              {dealData.deal_source === 'Other' ? dealData.deal_source_other : dealData.deal_source || '—'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#64748b' }}>Facilities</span>
            <span style={{ color: '#1e293b' }}>{dealData.facilities.length}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#64748b' }}>Purchase Price</span>
            <span style={{ color: '#1e293b', fontWeight: '500' }}>
              {dealData.purchase_price
                ? `$${parseInt(dealData.purchase_price).toLocaleString()}`
                : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="step-navigation">
        <button className="btn btn-secondary" onClick={goToPreviousStep}>
          <ArrowLeft size={16} />
          Back
        </button>
        <button
          className="btn btn-primary"
          onClick={handleSubmit}
          disabled={!canSubmit}
          style={!canSubmit ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
        >
          {isSubmitting ? (
            <>
              <Loader size={16} className="extraction-progress-spinner" />
              Creating Deal...
            </>
          ) : isAIPath && isExtracting ? (
            <>
              <Loader size={16} className="extraction-progress-spinner" />
              Waiting for analysis...
            </>
          ) : (
            <>
              <Check size={16} />
              Create Deal
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default TeamTimeline;
