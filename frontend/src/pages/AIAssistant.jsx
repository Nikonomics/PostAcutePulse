import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Brain, MessageSquare, ArrowRight } from 'lucide-react';

const AIAssistant = () => {
  const navigate = useNavigate();

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: '48px' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '64px',
          height: '64px',
          borderRadius: '16px',
          backgroundColor: '#eef2ff',
          marginBottom: '16px'
        }}>
          <Brain size={32} color="#6366f1" />
        </div>
        <h1 style={{ fontSize: '28px', fontWeight: '600', color: '#1f2937', marginBottom: '8px' }}>
          AI Assistant
        </h1>
        <p style={{ color: '#6b7280', fontSize: '16px', maxWidth: '500px', margin: '0 auto' }}>
          Get AI-powered insights and analysis for your market intelligence research.
        </p>
      </div>

      <div
        onClick={() => navigate('/ai-assistant/chat')}
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '24px',
          cursor: 'pointer',
          border: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          transition: 'all 0.2s ease',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
          e.currentTarget.style.borderColor = '#6366f1';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
          e.currentTarget.style.borderColor = '#e5e7eb';
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            backgroundColor: '#f0fdf4',
            borderRadius: '10px',
            padding: '12px'
          }}>
            <MessageSquare size={24} color="#22c55e" />
          </div>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1f2937', marginBottom: '4px' }}>
              Start a Conversation
            </h3>
            <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>
              Chat with the AI assistant about facilities, markets, and analytics
            </p>
          </div>
        </div>
        <ArrowRight size={20} color="#9ca3af" />
      </div>
    </div>
  );
};

export default AIAssistant;
