import React, { useState, useEffect } from 'react';
import {
  Clock,
  Edit3,
  FileText,
  MessageCircle,
  User,
  Building2,
  DollarSign,
  UserPlus,
  RefreshCw,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { getDealChangeHistory } from '../../api/DealService';
import './ActivityHistory.css';

// Icon mapping for different change types
const getChangeIcon = (changeType) => {
  switch (changeType) {
    case 'status_changed':
      return <RefreshCw size={14} />;
    case 'field_updated':
    case 'deal_updated':
    case 'field_update':
      return <Edit3 size={14} />;
    case 'facility_added':
    case 'facility_updated':
      return <Building2 size={14} />;
    case 'document_uploaded':
      return <FileText size={14} />;
    case 'comment_added':
      return <MessageCircle size={14} />;
    case 'team_member_added':
      return <UserPlus size={14} />;
    case 'financial_update':
      return <DollarSign size={14} />;
    default:
      return <Clock size={14} />;
  }
};

// Color mapping for different change types
const getChangeColor = (changeType) => {
  switch (changeType) {
    case 'status_changed':
      return 'activity-status';
    case 'field_updated':
    case 'deal_updated':
    case 'field_update':
      return 'activity-edit';
    case 'facility_added':
    case 'facility_updated':
      return 'activity-facility';
    case 'document_uploaded':
      return 'activity-document';
    case 'comment_added':
      return 'activity-comment';
    case 'team_member_added':
      return 'activity-team';
    case 'financial_update':
      return 'activity-financial';
    default:
      return 'activity-default';
  }
};

// Format the change message
const formatChangeMessage = (change) => {
  const { change_type, field_label, old_value, new_value, metadata } = change;

  switch (change_type) {
    case 'status_changed':
      return (
        <span>
          Changed status from <strong>{old_value || 'None'}</strong> to <strong>{new_value}</strong>
        </span>
      );
    case 'field_updated':
    case 'deal_updated':
    case 'field_update':
      if (old_value && new_value) {
        return (
          <span>
            Updated <strong>{field_label}</strong>: {old_value} → {new_value}
          </span>
        );
      } else if (new_value) {
        return (
          <span>
            Set <strong>{field_label}</strong> to {new_value}
          </span>
        );
      } else {
        return (
          <span>
            Cleared <strong>{field_label}</strong>
          </span>
        );
      }
    case 'facility_added':
      return (
        <span>
          Added facility <strong>{metadata?.facility_name || 'Unknown'}</strong>
        </span>
      );
    case 'facility_updated':
      return (
        <span>
          Updated facility <strong>{metadata?.facility_name || 'Unknown'}</strong>
        </span>
      );
    case 'document_uploaded':
      return (
        <span>
          Uploaded document <strong>{metadata?.document_name || 'Unknown'}</strong>
        </span>
      );
    case 'comment_added':
      return (
        <span>
          Added a comment{metadata?.preview ? `: "${metadata.preview.substring(0, 50)}..."` : ''}
        </span>
      );
    case 'team_member_added':
      return (
        <span>
          Added team member <strong>{metadata?.member_name || 'Someone'}</strong>
        </span>
      );
    default:
      return (
        <span>
          {field_label ? `Updated ${field_label}` : 'Made changes'}
        </span>
      );
  }
};

const ActivityHistory = ({ dealId, limit = 10 }) => {
  const [changes, setChanges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (dealId) {
      fetchChangeHistory();
    }
  }, [dealId, page]);

  const fetchChangeHistory = async () => {
    try {
      setLoading(true);
      const response = await getDealChangeHistory(dealId, page);
      if (response.status) {
        setChanges(response.body.changes || []);
        setTotalPages(response.body.totalPages || 1);
      }
    } catch (err) {
      console.error('Error fetching change history:', err);
      setError('Failed to load activity history');
    } finally {
      setLoading(false);
    }
  };

  if (!dealId) return null;

  return (
    <div className="activity-history-card">
      <div
        className="activity-history-header"
        onClick={() => setExpanded(!expanded)}
      >
        <h3 className="activity-history-title">
          <Clock size={18} />
          Activity History
        </h3>
        <button className="expand-btn">
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </div>

      {expanded && (
        <div className="activity-history-content">
          {loading && changes.length === 0 ? (
            <div className="activity-loading">
              <div className="loading-spinner"></div>
              <span>Loading activity...</span>
            </div>
          ) : error ? (
            <div className="activity-error">
              <p>{error}</p>
              <button onClick={fetchChangeHistory} className="retry-btn">
                Try Again
              </button>
            </div>
          ) : changes.length === 0 ? (
            <div className="activity-empty">
              <Clock size={32} className="empty-icon" />
              <p>No activity recorded yet</p>
            </div>
          ) : (
            <>
              <div className="activity-timeline">
                {changes.slice(0, limit).map((change, index) => (
                  <div key={change.id || index} className="activity-item">
                    <div className={`activity-icon ${getChangeColor(change.change_type)}`}>
                      {getChangeIcon(change.change_type)}
                    </div>
                    <div className="activity-content">
                      <div className="activity-message">
                        {formatChangeMessage(change)}
                      </div>
                      <div className="activity-meta">
                        <span className="activity-user">
                          {change.user ? (
                            <>
                              {change.user.profile_url ? (
                                <img
                                  src={change.user.profile_url}
                                  alt=""
                                  className="activity-user-avatar"
                                />
                              ) : (
                                <User size={12} />
                              )}
                              {change.user.first_name} {change.user.last_name}
                            </>
                          ) : (
                            'System'
                          )}
                        </span>
                        <span className="activity-time">
                          {formatDistanceToNow(new Date(change.created_at), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="activity-pagination">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="pagination-btn"
                  >
                    Previous
                  </button>
                  <span className="pagination-info">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="pagination-btn"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ActivityHistory;
