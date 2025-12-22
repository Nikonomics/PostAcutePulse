import React, { useState, useRef, useEffect } from 'react';
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
import './SNFalyzePanel.css';

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

  // Load conversation when panel opens
  useEffect(() => {
    if (isOpen && dealId) {
      loadExistingConversation();
    }
  }, [isOpen, dealId]);

  // Load metrics and evaluation when deal data is available
  useEffect(() => {
    if (isOpen && deal && !dealEvaluation && !metricsLoading) {
      loadMetricsAndEvaluation();
    }
  }, [isOpen, deal, dealEvaluation, metricsLoading]);

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
    <div className="snfalyze-panel-overlay">
      <div className="snfalyze-panel">
        {/* Header */}
        <div className="snfalyze-panel-header">
          <h3>
            <Brain size={16} />
            SNFalyze AI
          </h3>
          <div className="snfalyze-panel-header-actions">
            {messages.length > 0 && (
              <button
                className="snfalyze-panel-btn"
                onClick={handleClearConversation}
                title="Clear conversation"
              >
                <Trash2 size={14} />
              </button>
            )}
            <button
              className="snfalyze-panel-btn"
              onClick={handleInitialAnalysis}
              title="Refresh analysis"
              disabled={isLoading}
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            </button>
            <button className="snfalyze-panel-btn" onClick={onClose}>
              <X size={16} />
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
              <MessageSquare size={40} className="snfalyze-empty-icon" />
              <p>Ask SNFalyze about this deal</p>
              <span>Get AI-powered insights and recommendations</span>
              <button
                className="snfalyze-analyze-btn"
                onClick={handleInitialAnalysis}
                disabled={isLoading || metricsLoading}
              >
                <Sparkles size={14} />
                {metricsLoading ? 'Loading...' : 'Generate Analysis'}
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
                      <span className="snfalyze-loading-text">Analyzing...</span>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="snfalyze-error">
                  <AlertCircle size={14} />
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
              placeholder="Ask about this deal..."
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
              <Send size={14} />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default SNFalyzePanel;
