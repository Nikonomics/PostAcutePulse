import React, { useState, useRef, useEffect } from 'react';
import {
  HelpCircle,
  X,
  Send,
  RefreshCw,
  AlertCircle,
  Trash2,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import {
  HELP_QUICK_ACTIONS,
  getWelcomeMessage,
  saveHelpConversation,
  loadHelpConversation,
  clearHelpConversation,
  generateQuickActionResponse,
  sendHelpMessage,
  renderMarkdown,
} from '../../services/appHelpChatService';
import './AppHelpPanel.css';

// =============================================================================
// MAIN COMPONENT
// =============================================================================
const AppHelpPanel = ({
  isOpen,
  onClose,
  currentPage,
  currentTab
}) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Load conversation when panel opens
  useEffect(() => {
    if (isOpen) {
      loadExistingConversation();
    }
  }, [isOpen]);

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

  const loadExistingConversation = async () => {
    const savedMessages = await loadHelpConversation();
    if (savedMessages && savedMessages.length > 0) {
      setMessages(savedMessages.map(m => ({
        ...m,
        timestamp: new Date(m.timestamp)
      })));
    }
  };

  const handleQuickAction = async (action) => {
    if (!action.action) return;

    setIsLoading(true);
    setError(null);

    try {
      // Generate the quick action response
      const responseContent = generateQuickActionResponse(action.action, currentPage, currentTab);

      const responseMessage = {
        id: Date.now(),
        role: 'assistant',
        title: action.label,
        content: responseContent,
        timestamp: new Date()
      };

      const newMessages = [...messages, responseMessage];
      setMessages(newMessages);
      await saveHelpConversation(newMessages);
    } catch (err) {
      setError(err.message || 'Failed to generate help response');
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
      const aiText = await sendHelpMessage(
        inputMessage.trim(),
        updatedMessages,
        currentPage,
        currentTab
      );

      const aiMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: aiText,
        timestamp: new Date()
      };

      const newMessages = [...updatedMessages, aiMessage];
      setMessages(newMessages);
      await saveHelpConversation(newMessages);
    } catch (err) {
      setError(err.message || 'Failed to get help response');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearConversation = async () => {
    if (window.confirm('Clear help conversation history?')) {
      setMessages([]);
      await clearHelpConversation();
    }
  };

  const handleShowWelcome = () => {
    const welcome = getWelcomeMessage();
    setMessages([welcome]);
    saveHelpConversation([welcome]);
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
    <div className="help-panel-overlay">
      <div className="help-panel">
        {/* Header */}
        <div className="help-panel-header">
          <h3>
            <HelpCircle size={16} />
            SNFalyze Help
          </h3>
          <div className="help-panel-header-actions">
            {messages.length > 0 && (
              <button
                className="help-panel-btn"
                onClick={handleClearConversation}
                title="Clear conversation"
              >
                <Trash2 size={14} />
              </button>
            )}
            <button
              className="help-panel-btn"
              onClick={handleShowWelcome}
              title="Show welcome message"
              disabled={isLoading}
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            </button>
            <button className="help-panel-btn" onClick={onClose}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="help-quick-actions">
          <div className="help-quick-actions-row">
            {HELP_QUICK_ACTIONS.map((action, index) => (
              <button
                key={index}
                onClick={() => handleQuickAction(action)}
                disabled={isLoading}
                className={`help-quick-btn ${action.color}`}
              >
                <span>{action.icon}</span>
                {action.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="help-panel-content">
          {messages.length === 0 && !isLoading ? (
            <div className="help-empty-state">
              <MessageSquare size={36} className="help-empty-icon" />
              <p>Need help with SNFalyze?</p>
              <span>Ask questions about features, data sources, and calculations</span>
              <button
                className="help-start-btn"
                onClick={handleShowWelcome}
                disabled={isLoading}
              >
                <Sparkles size={14} />
                Get Started
              </button>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <div key={message.id} className={`help-message ${message.role === 'user' ? 'user' : 'ai'}`}>
                  <div className={`help-avatar ${message.role === 'user' ? 'user' : 'ai'}`}>
                    {message.role === 'user' ? 'You' : '?'}
                  </div>
                  <div>
                    <div className="help-message-content">
                      {message.title && (
                        <div className="help-message-title">
                          {message.title}
                        </div>
                      )}
                      {message.role === 'assistant' ? (
                        <div
                          className="help-response"
                          dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
                        />
                      ) : (
                        message.content
                      )}
                    </div>
                    <div className="help-message-timestamp">
                      {formatTimestamp(message.timestamp)}
                    </div>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="help-message ai">
                  <div className="help-avatar ai">?</div>
                  <div className="help-message-content">
                    <div className="help-loading">
                      <div className="help-loading-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                      <span className="help-loading-text">Looking up help info...</span>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="help-error">
                  <AlertCircle size={14} />
                  {error}
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="help-panel-input-area">
          <div className="help-input-row">
            <input
              ref={inputRef}
              type="text"
              className="help-input"
              placeholder="Ask a question about SNFalyze..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isLoading}
            />
            <button
              className="help-send-btn"
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

export default AppHelpPanel;
