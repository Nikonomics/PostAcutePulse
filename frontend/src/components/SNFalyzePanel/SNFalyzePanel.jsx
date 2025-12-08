import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Brain,
  X,
  Send,
  Sparkles,
  RefreshCw,
  AlertCircle,
  Trash2,
  MessageSquare,
} from 'lucide-react';
import {
  QUICK_ACTIONS,
  getDealId,
  getWelcomeMessage,
  saveConversation,
  loadConversation,
  clearConversation,
  runSNFEvaluation,
  fetchCalculatorMetrics,
  generateQuickActionAnalysis,
  sendChatMessage,
  generateInitialAnalysis,
  renderMarkdown,
} from '../../services/snfalyzeChatService';

// =============================================================================
// MAIN COMPONENT
// =============================================================================
const SNFalyzePanel = ({
  isOpen,
  onClose,
  dealId,
  deal,
  autoAnalyze = false
}) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [calculatorMetrics, setCalculatorMetrics] = useState(null);
  const [dealEvaluation, setDealEvaluation] = useState(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Load conversation and metrics when panel opens
  useEffect(() => {
    if (isOpen && dealId) {
      loadExistingConversation();
      loadMetricsAndEvaluation();
    }
  }, [isOpen, dealId]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  // Auto-analyze when opening with autoAnalyze=true and no existing conversation
  useEffect(() => {
    if (isOpen && autoAnalyze && messages.length === 0 && !isLoading && deal && !metricsLoading) {
      handleInitialAnalysis();
    }
  }, [isOpen, autoAnalyze, messages.length, deal, metricsLoading]);

  const loadExistingConversation = async () => {
    if (!dealId) return;
    const savedMessages = await loadConversation(getDealId({ id: dealId }));
    if (savedMessages && savedMessages.length > 0) {
      setMessages(savedMessages.map(m => ({
        ...m,
        timestamp: new Date(m.timestamp)
      })));
    }
  };

  const loadMetricsAndEvaluation = async () => {
    if (!dealId) return;
    setMetricsLoading(true);
    try {
      // Fetch calculator metrics
      const metrics = await fetchCalculatorMetrics(dealId);
      setCalculatorMetrics(metrics);

      // Run SNF evaluation if we have deal data
      if (deal) {
        const evaluation = await runSNFEvaluation(deal);
        setDealEvaluation(evaluation);
      }
    } catch (err) {
      console.error('Error loading metrics/evaluation:', err);
    } finally {
      setMetricsLoading(false);
    }
  };

  const handleInitialAnalysis = async () => {
    if (!deal) return;

    setIsLoading(true);
    setError(null);

    try {
      const aiText = await generateInitialAnalysis(deal, calculatorMetrics, dealEvaluation);

      const aiMessage = {
        id: Date.now(),
        role: 'assistant',
        content: aiText,
        timestamp: new Date()
      };

      const newMessages = [aiMessage];
      setMessages(newMessages);
      await saveConversation(getDealId(deal), newMessages);
    } catch (err) {
      setError(err.message || 'Failed to get SNFalyze analysis');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAction = async (action) => {
    if (!action.action || !deal) return;

    setIsLoading(true);
    setError(null);

    try {
      let evaluation = dealEvaluation;

      // If no evaluation exists yet, run it first
      if (!evaluation) {
        evaluation = await runSNFEvaluation(deal);
        setDealEvaluation(evaluation);
      }

      // Generate the specific analysis
      const analysisContent = generateQuickActionAnalysis(action.action, evaluation);

      const analysisMessage = {
        id: Date.now(),
        role: 'assistant',
        title: action.label,
        content: analysisContent,
        timestamp: new Date()
      };

      const newMessages = [...messages, analysisMessage];
      setMessages(newMessages);
      await saveConversation(getDealId(deal), newMessages);
    } catch (err) {
      setError(err.message || 'Failed to generate analysis');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date()
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInputMessage('');
    setIsLoading(true);
    setError(null);

    try {
      const aiText = await sendChatMessage(
        inputMessage.trim(),
        updatedMessages,
        deal,
        calculatorMetrics,
        dealEvaluation
      );

      const aiMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: aiText,
        timestamp: new Date()
      };

      const newMessages = [...updatedMessages, aiMessage];
      setMessages(newMessages);
      await saveConversation(getDealId(deal), newMessages);
    } catch (err) {
      setError(err.message || 'Failed to get SNFalyze response');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearConversation = async () => {
    if (window.confirm('Clear conversation history for this deal?')) {
      setMessages([]);
      setDealEvaluation(null);
      await clearConversation(getDealId(deal));
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  if (!isOpen) return null;

  return (
    <div className="snfalyze-panel-overlay" onClick={onClose}>
      <style>{`
        .snfalyze-panel-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 1000;
          display: flex;
          justify-content: flex-end;
        }

        .snfalyze-panel {
          width: 100%;
          max-width: 650px;
          height: 100%;
          background: white;
          box-shadow: -4px 0 20px rgba(0, 0, 0, 0.15);
          display: flex;
          flex-direction: column;
          animation: slideIn 0.3s ease-out;
        }

        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }

        .snfalyze-panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 1.5rem;
          background: linear-gradient(135deg, #7c3aed 0%, #3b82f6 100%);
          color: white;
        }

        .snfalyze-panel-header h3 {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 1.125rem;
          font-weight: 600;
          margin: 0;
        }

        .snfalyze-panel-header-actions {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .snfalyze-panel-btn {
          background: rgba(255, 255, 255, 0.2);
          border: none;
          border-radius: 0.5rem;
          padding: 0.5rem;
          cursor: pointer;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s;
        }

        .snfalyze-panel-btn:hover {
          background: rgba(255, 255, 255, 0.3);
        }

        .snfalyze-quick-actions {
          padding: 0.75rem 1rem;
          background: #f9fafb;
          border-bottom: 1px solid #e5e7eb;
          overflow-x: auto;
        }

        .snfalyze-quick-actions-row {
          display: flex;
          gap: 0.5rem;
          flex-wrap: nowrap;
        }

        .snfalyze-quick-btn {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.375rem 0.75rem;
          border: none;
          border-radius: 0.5rem;
          font-size: 0.75rem;
          font-weight: 500;
          color: white;
          cursor: pointer;
          white-space: nowrap;
          transition: opacity 0.2s;
        }

        .snfalyze-quick-btn:hover {
          opacity: 0.9;
        }

        .snfalyze-quick-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .snfalyze-panel-content {
          flex: 1;
          overflow-y: auto;
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .snfalyze-empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          text-align: center;
          color: #6b7280;
          padding: 2rem;
        }

        .snfalyze-empty-state p {
          margin: 1rem 0 0.5rem;
          font-size: 1rem;
          color: #374151;
        }

        .snfalyze-empty-state span {
          font-size: 0.875rem;
        }

        .snfalyze-analyze-btn {
          margin-top: 1.5rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.5rem;
          background: linear-gradient(135deg, #7c3aed 0%, #3b82f6 100%);
          border: none;
          border-radius: 0.5rem;
          font-size: 0.9rem;
          color: white;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
        }

        .snfalyze-analyze-btn:hover {
          opacity: 0.9;
          transform: translateY(-1px);
        }

        .snfalyze-analyze-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }

        .snfalyze-message {
          display: flex;
          gap: 0.75rem;
        }

        .snfalyze-message.user {
          flex-direction: row-reverse;
        }

        .snfalyze-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.75rem;
          font-weight: 600;
          flex-shrink: 0;
        }

        .snfalyze-avatar.ai {
          background: linear-gradient(135deg, #7c3aed 0%, #3b82f6 100%);
          color: white;
        }

        .snfalyze-avatar.user {
          background: #3b82f6;
          color: white;
        }

        .snfalyze-message-content {
          max-width: 85%;
          padding: 0.875rem 1rem;
          border-radius: 1rem;
          font-size: 0.9rem;
          line-height: 1.6;
        }

        .snfalyze-message.ai .snfalyze-message-content {
          background: #f3f4f6;
          border-top-left-radius: 0.25rem;
        }

        .snfalyze-message.user .snfalyze-message-content {
          background: #3b82f6;
          color: white;
          border-top-right-radius: 0.25rem;
        }

        .snfalyze-message-title {
          font-weight: 600;
          color: #7c3aed;
          margin-bottom: 0.5rem;
          display: flex;
          align-items: center;
          gap: 0.375rem;
        }

        .snfalyze-message-timestamp {
          font-size: 0.7rem;
          color: #9ca3af;
          margin-top: 0.25rem;
        }

        .snfalyze-message.user .snfalyze-message-timestamp {
          text-align: right;
          color: rgba(255, 255, 255, 0.7);
        }

        .snfalyze-response {
          font-size: 0.9rem;
          line-height: 1.6;
          color: #374151;
        }

        .snfalyze-response strong {
          color: #111827;
          font-weight: 600;
        }

        .snfalyze-response .snf-header-main {
          font-size: 1.1rem;
          font-weight: 700;
          color: #111827;
          margin: 1.25rem 0 0.75rem 0;
          padding-bottom: 0.375rem;
          border-bottom: 2px solid #e5e7eb;
        }

        .snfalyze-response .snf-header {
          font-size: 0.95rem;
          font-weight: 600;
          color: #1f2937;
          margin: 1.25rem 0 0.5rem 0;
          padding-bottom: 0.375rem;
          border-bottom: 1px solid #f3f4f6;
        }

        .snfalyze-response .snf-header:first-child {
          margin-top: 0;
        }

        .snfalyze-response .snf-subheader {
          font-size: 0.9rem;
          font-weight: 600;
          color: #374151;
          margin: 0.875rem 0 0.375rem 0;
        }

        .snfalyze-response .snf-paragraph {
          margin: 0.375rem 0;
          line-height: 1.6;
        }

        .snfalyze-response .snf-list {
          margin: 0.5rem 0;
          padding-left: 1.25rem;
        }

        .snfalyze-response .snf-list li {
          margin: 0.375rem 0;
          line-height: 1.5;
        }

        .snfalyze-response .snf-list li::marker {
          color: #7c3aed;
        }

        .snfalyze-response .snf-ordered-list {
          margin: 0.5rem 0;
          padding-left: 1.5rem;
        }

        .snfalyze-response .snf-ordered-list li {
          margin: 0.5rem 0;
          line-height: 1.5;
          padding-left: 0.25rem;
        }

        .snfalyze-response .snf-ordered-list li::marker {
          color: #7c3aed;
          font-weight: 600;
        }

        .snfalyze-response .snf-spacer {
          height: 0.375rem;
        }

        .snfalyze-response em {
          font-style: italic;
          color: #4b5563;
        }

        .snfalyze-loading {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .snfalyze-loading-dots {
          display: flex;
          gap: 0.375rem;
        }

        .snfalyze-loading-dots span {
          width: 8px;
          height: 8px;
          background: #7c3aed;
          border-radius: 50%;
          animation: bounce 1.4s ease-in-out infinite;
        }

        .snfalyze-loading-dots span:nth-child(1) { animation-delay: 0s; }
        .snfalyze-loading-dots span:nth-child(2) { animation-delay: 0.2s; }
        .snfalyze-loading-dots span:nth-child(3) { animation-delay: 0.4s; }

        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }

        .snfalyze-loading-text {
          font-size: 0.875rem;
          color: #6b7280;
        }

        .snfalyze-error {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 0.5rem;
          color: #dc2626;
          font-size: 0.875rem;
        }

        .snfalyze-panel-input-area {
          padding: 1rem 1.5rem;
          border-top: 1px solid #e5e7eb;
          background: #f9fafb;
        }

        .snfalyze-input-row {
          display: flex;
          gap: 0.75rem;
        }

        .snfalyze-input {
          flex: 1;
          padding: 0.75rem 1rem;
          border: 1px solid #d1d5db;
          border-radius: 0.5rem;
          font-size: 0.9rem;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .snfalyze-input:focus {
          outline: none;
          border-color: #7c3aed;
          box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.2);
        }

        .snfalyze-send-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.75rem 1.25rem;
          background: linear-gradient(135deg, #7c3aed 0%, #3b82f6 100%);
          border: none;
          border-radius: 0.5rem;
          color: white;
          cursor: pointer;
          transition: all 0.2s;
        }

        .snfalyze-send-btn:hover {
          opacity: 0.9;
        }

        .snfalyze-send-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .snfalyze-panel-footer {
          padding: 0.75rem 1.5rem;
          border-top: 1px solid #e5e7eb;
          background: white;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          font-size: 0.75rem;
          color: #9ca3af;
        }
      `}</style>

      <div className="snfalyze-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="snfalyze-panel-header">
          <h3>
            <Brain size={20} />
            SNFalyze AI Analysis
          </h3>
          <div className="snfalyze-panel-header-actions">
            {messages.length > 0 && (
              <button
                className="snfalyze-panel-btn"
                onClick={handleClearConversation}
                title="Clear conversation"
              >
                <Trash2 size={18} />
              </button>
            )}
            <button
              className="snfalyze-panel-btn"
              onClick={handleInitialAnalysis}
              title="Refresh analysis"
              disabled={isLoading}
            >
              <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
            </button>
            <button className="snfalyze-panel-btn" onClick={onClose}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="snfalyze-quick-actions">
          <div className="snfalyze-quick-actions-row">
            {QUICK_ACTIONS.map((action, index) => (
              <button
                key={index}
                onClick={() => handleQuickAction(action)}
                disabled={isLoading}
                className={`snfalyze-quick-btn ${action.color}`}
              >
                <span>{action.icon}</span>
                {action.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="snfalyze-panel-content">
          {messages.length === 0 && !isLoading ? (
            <div className="snfalyze-empty-state">
              <MessageSquare size={48} style={{ color: '#7c3aed', opacity: 0.5 }} />
              <p>Ask SNFalyze about this deal</p>
              <span>Get AI-powered insights, analysis, and recommendations</span>
              <button
                className="snfalyze-analyze-btn"
                onClick={handleInitialAnalysis}
                disabled={isLoading || metricsLoading}
              >
                <Sparkles size={18} />
                {metricsLoading ? 'Loading metrics...' : 'Generate Analysis'}
              </button>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <div key={message.id} className={`snfalyze-message ${message.role === 'user' ? 'user' : 'ai'}`}>
                  <div className={`snfalyze-avatar ${message.role === 'user' ? 'user' : 'ai'}`}>
                    {message.role === 'user' ? 'You' : 'AI'}
                  </div>
                  <div>
                    <div className="snfalyze-message-content">
                      {message.title && (
                        <div className="snfalyze-message-title">
                          {message.title}
                        </div>
                      )}
                      {message.role === 'assistant' ? (
                        <div
                          className="snfalyze-response"
                          dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
                        />
                      ) : (
                        message.content
                      )}
                    </div>
                    <div className="snfalyze-message-timestamp">
                      {formatTimestamp(message.timestamp)}
                    </div>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="snfalyze-message ai">
                  <div className="snfalyze-avatar ai">AI</div>
                  <div className="snfalyze-message-content">
                    <div className="snfalyze-loading">
                      <div className="snfalyze-loading-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                      <span className="snfalyze-loading-text">SNFalyze is analyzing...</span>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="snfalyze-error">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="snfalyze-panel-input-area">
          <div className="snfalyze-input-row">
            <input
              ref={inputRef}
              type="text"
              className="snfalyze-input"
              placeholder="Ask a question about this deal..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isLoading}
            />
            <button
              className="snfalyze-send-btn"
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isLoading}
            >
              <Send size={18} />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="snfalyze-panel-footer">
          <Sparkles size={12} />
          Powered by SNFalyze.ai
        </div>
      </div>
    </div>
  );
};

export default SNFalyzePanel;
