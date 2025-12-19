import React, { useState } from 'react';

const FeedbackBox = ({ onSubmit }) => {
  const [feedback, setFeedback] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!feedback.trim()) return;

    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      if (onSubmit) {
        await onSubmit({
          feedbackText: feedback.trim(),
          email: email.trim() || null,
          submittedAt: new Date().toISOString()
        });
      } else {
        // If no onSubmit provided, just log to console
        console.log('Feedback submitted:', { feedback, email });
      }

      setSubmitStatus('success');
      setFeedback('');
      setEmail('');

      setTimeout(() => setSubmitStatus(null), 5000);
    } catch (error) {
      console.error('Feedback submission error:', error);
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
      border: '1px solid #dee2e6',
      borderRadius: '8px',
      padding: '1.5rem',
      maxWidth: '600px',
      marginTop: '2rem'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '1.25rem' }}>💡</span>
        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '600' }}>
          What data would you like to see?
        </h3>
      </div>

      <p style={{ color: '#6c757d', marginBottom: '1rem', fontSize: '0.9rem' }}>
        Help us improve SNFalyze by suggesting new data sources, metrics, or documentation improvements.
      </p>

      <form onSubmit={handleSubmit}>
        <textarea
          placeholder="Describe the data or feature you'd like..."
          value={feedback}
          onChange={e => setFeedback(e.target.value)}
          rows={4}
          disabled={isSubmitting}
          style={{
            width: '100%',
            padding: '0.75rem',
            border: '1px solid #dee2e6',
            borderRadius: '4px',
            resize: 'vertical',
            fontFamily: 'inherit',
            fontSize: '0.9rem',
            marginBottom: '1rem',
            boxSizing: 'border-box'
          }}
        />

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="email"
            placeholder="Your email (optional)"
            value={email}
            onChange={e => setEmail(e.target.value)}
            disabled={isSubmitting}
            style={{
              flex: 1,
              minWidth: '200px',
              padding: '0.5rem 0.75rem',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              fontSize: '0.9rem'
            }}
          />

          <button
            type="submit"
            disabled={isSubmitting || !feedback.trim()}
            style={{
              padding: '0.5rem 1.25rem',
              backgroundColor: isSubmitting || !feedback.trim() ? '#6c757d' : '#0d6efd',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isSubmitting || !feedback.trim() ? 'not-allowed' : 'pointer',
              fontWeight: '500',
              fontSize: '0.9rem',
              transition: 'background-color 0.2s'
            }}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
          </button>
        </div>

        {submitStatus === 'success' && (
          <div style={{
            marginTop: '1rem',
            padding: '0.75rem',
            backgroundColor: '#d1e7dd',
            color: '#0f5132',
            borderRadius: '4px',
            fontSize: '0.9rem'
          }}>
            ✓ Thanks for your feedback! We'll review your suggestion.
          </div>
        )}

        {submitStatus === 'error' && (
          <div style={{
            marginTop: '1rem',
            padding: '0.75rem',
            backgroundColor: '#f8d7da',
            color: '#842029',
            borderRadius: '4px',
            fontSize: '0.9rem'
          }}>
            Something went wrong. Please try again.
          </div>
        )}
      </form>
    </div>
  );
};

export default FeedbackBox;
