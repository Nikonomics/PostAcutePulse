import React, { useState, useEffect } from 'react';
import { DollarSign, CheckCircle, Loader, Calendar, Ban } from 'lucide-react';
import { getFacilityPenalties } from '../../../api/facilityService';
import DrillDownModal from './DrillDownModal';

const PenaltyDrillDown = ({ isOpen, onClose, ccn, facilityName }) => {
  const [penalties, setPenalties] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && ccn) {
      loadPenalties();
    }
  }, [isOpen, ccn]);

  const loadPenalties = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getFacilityPenalties(ccn);
      if (response.success) {
        setPenalties(response.penalties);
      } else {
        setError('Failed to load penalties');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const totalFines = penalties.reduce((sum, p) => sum + (parseFloat(p.fine_amount) || 0), 0);
  const totalDenialDays = penalties.reduce((sum, p) => sum + (parseInt(p.payment_denial_days) || 0), 0);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <DrillDownModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Penalties - ${facilityName || 'Facility'}`}
      icon={DollarSign}
    >
      {loading ? (
        <div className="drilldown-loading">
          <Loader size={24} className="spinning" />
          <span>Loading penalties...</span>
        </div>
      ) : error ? (
        <div className="drilldown-error">{error}</div>
      ) : penalties.length === 0 ? (
        <div className="drilldown-empty">
          <CheckCircle size={32} style={{ color: '#22c55e' }} />
          <p>No penalties on record</p>
        </div>
      ) : (
        <>
          <div className="penalty-summary">
            <div className="penalty-summary-item">
              <DollarSign size={18} className="status-problem" />
              <div>
                <span className="penalty-summary-value">{formatCurrency(totalFines)}</span>
                <span className="penalty-summary-label">Total Fines</span>
              </div>
            </div>
            {totalDenialDays > 0 && (
              <div className="penalty-summary-item">
                <Ban size={18} className="status-watch" />
                <div>
                  <span className="penalty-summary-value">{totalDenialDays} days</span>
                  <span className="penalty-summary-label">Payment Denial</span>
                </div>
              </div>
            )}
            <div className="penalty-summary-item">
              <Calendar size={18} />
              <div>
                <span className="penalty-summary-value">{penalties.length}</span>
                <span className="penalty-summary-label">Penalty Events</span>
              </div>
            </div>
          </div>

          <div className="penalty-list">
            {penalties.map((penalty, index) => (
              <div key={index} className="penalty-item">
                <div className="penalty-header">
                  <span className="penalty-type">{penalty.penalty_type || 'Penalty'}</span>
                  <span className="penalty-date">
                    {penalty.penalty_date
                      ? new Date(penalty.penalty_date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })
                      : 'Date unknown'}
                  </span>
                </div>
                <div className="penalty-details">
                  {penalty.fine_amount > 0 && (
                    <div className="penalty-detail">
                      <DollarSign size={14} />
                      <span className="penalty-amount">{formatCurrency(penalty.fine_amount)}</span>
                    </div>
                  )}
                  {penalty.payment_denial_days > 0 && (
                    <div className="penalty-detail">
                      <Ban size={14} />
                      <span>{penalty.payment_denial_days} days payment denial</span>
                      {penalty.payment_denial_start_date && (
                        <span className="penalty-denial-date">
                          starting {new Date(penalty.payment_denial_start_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </DrillDownModal>
  );
};

export default PenaltyDrillDown;
