import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send,
  ArrowLeft,
  Target,
  Sparkles,
  Trash2,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
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
} from '../services/snfalyzeChatService';

const ChatInterfaceAI = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const deal = location.state?.deal;

  const [selectedDeal, setSelectedDeal] = useState(deal);
  const [messages, setMessages] = useState([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dealEvaluation, setDealEvaluation] = useState(null);
  const [calculatorMetrics, setCalculatorMetrics] = useState(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Redirect if no deal
  useEffect(() => {
    if (!deal) {
      navigate('/ai-deals');
    }
  }, [deal, navigate]);

  // Load messages and metrics on mount
  useEffect(() => {
    if (deal) {
      loadExistingConversation();
      loadMetricsAndEvaluation();
    }
  }, [deal]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      setDealEvaluation(null);
      setMessages([]);
      setCurrentMessage('');
    };
  }, []);

  const loadExistingConversation = async () => {
    if (!deal) return;
    const dealId = getDealId(deal);
    const savedMessages = await loadConversation(dealId);
    if (savedMessages && savedMessages.length > 0) {
      setMessages(savedMessages.map(m => ({
        ...m,
        timestamp: new Date(m.timestamp)
      })));
    } else {
      // Show welcome message if no existing conversation
      setMessages([getWelcomeMessage(deal)]);
    }
  };

  const loadMetricsAndEvaluation = async () => {
    if (!deal) return;
    setMetricsLoading(true);
    try {
      // Fetch calculator metrics
      if (deal.id) {
        const metrics = await fetchCalculatorMetrics(deal.id);
        setCalculatorMetrics(metrics);
      }

      // Run SNF evaluation
      const evaluation = await runSNFEvaluation(deal);
      setDealEvaluation(evaluation);
    } catch (err) {
      console.error('Error loading metrics/evaluation:', err);
    } finally {
      setMetricsLoading(false);
    }
  };

  const handleBackToDealSelection = useCallback(() => {
    if (isNavigating) return;
    setIsNavigating(true);
    setMessages([]);
    setCurrentMessage('');
    setDealEvaluation(null);
    requestAnimationFrame(() => {
      navigate('/ai-deals');
    });
  }, [navigate, isNavigating]);

  const handleQuickAction = async (action) => {
    if (!action.action || !selectedDeal) return;

    setIsLoading(true);
    setError(null);

    try {
      let evaluation = dealEvaluation;

      // If no evaluation exists yet, run it first
      if (!evaluation) {
        evaluation = await runSNFEvaluation(selectedDeal);
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
      await saveConversation(getDealId(selectedDeal), newMessages);
    } catch (err) {
      setError(err.message || 'Failed to generate analysis');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!currentMessage.trim() || isLoading) return;

    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: currentMessage.trim(),
      timestamp: new Date()
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setCurrentMessage('');
    setIsLoading(true);
    setError(null);

    try {
      const aiText = await sendChatMessage(
        currentMessage.trim(),
        updatedMessages,
        selectedDeal,
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
      await saveConversation(getDealId(selectedDeal), newMessages);
    } catch (err) {
      setError(err.message || 'Failed to get SNFalyze response');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearConversation = async () => {
    if (window.confirm('Clear conversation history for this deal?')) {
      setMessages([getWelcomeMessage(selectedDeal)]);
      setDealEvaluation(null);
      await clearConversation(getDealId(selectedDeal));
    }
  };

  const handleRefreshAnalysis = async () => {
    if (!selectedDeal || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const aiText = await generateInitialAnalysis(selectedDeal, calculatorMetrics, dealEvaluation);

      const aiMessage = {
        id: Date.now(),
        role: 'assistant',
        title: 'Deal Analysis',
        content: aiText,
        timestamp: new Date()
      };

      const newMessages = [...messages, aiMessage];
      setMessages(newMessages);
      await saveConversation(getDealId(selectedDeal), newMessages);
    } catch (err) {
      setError(err.message || 'Failed to generate analysis');
    } finally {
      setIsLoading(false);
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

  const getRiskColor = (risk) => {
    switch ((risk || '').toLowerCase()) {
      case 'low':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'medium':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'high':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  if (!deal) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <style>{`
        .snf-response {
          font-size: 0.9rem;
          line-height: 1.6;
          color: #374151;
        }

        .snf-response strong {
          color: #111827;
          font-weight: 600;
        }

        .snf-response .snf-header-main {
          font-size: 1.1rem;
          font-weight: 700;
          color: #111827;
          margin: 1.25rem 0 0.75rem 0;
          padding-bottom: 0.375rem;
          border-bottom: 2px solid #e5e7eb;
        }

        .snf-response .snf-header {
          font-size: 0.95rem;
          font-weight: 600;
          color: #1f2937;
          margin: 1.25rem 0 0.5rem 0;
          padding-bottom: 0.375rem;
          border-bottom: 1px solid #f3f4f6;
        }

        .snf-response .snf-header:first-child {
          margin-top: 0;
        }

        .snf-response .snf-subheader {
          font-size: 0.9rem;
          font-weight: 600;
          color: #374151;
          margin: 0.875rem 0 0.375rem 0;
        }

        .snf-response .snf-paragraph {
          margin: 0.375rem 0;
          line-height: 1.6;
        }

        .snf-response .snf-list {
          margin: 0.5rem 0;
          padding-left: 1.25rem;
        }

        .snf-response .snf-list li {
          margin: 0.375rem 0;
          line-height: 1.5;
        }

        .snf-response .snf-list li::marker {
          color: #7c3aed;
        }

        .snf-response .snf-ordered-list {
          margin: 0.5rem 0;
          padding-left: 1.5rem;
        }

        .snf-response .snf-ordered-list li {
          margin: 0.5rem 0;
          line-height: 1.5;
          padding-left: 0.25rem;
        }

        .snf-response .snf-ordered-list li::marker {
          color: #7c3aed;
          font-weight: 600;
        }

        .snf-response .snf-spacer {
          height: 0.375rem;
        }

        .snf-response em {
          font-style: italic;
          color: #4b5563;
        }
      `}</style>

      <div className="max-w-7xl mx-auto">
        {/* Chat Header */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 mb-6 overflow-hidden">
          <div className="bg-primary p-6 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={handleBackToDealSelection}
                  disabled={isNavigating}
                  className="w-10 h-10 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ArrowLeft size={18} />
                </button>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center">
                  </div>
                  <div>
                    <h1 className="text-xl font-semibold">
                      Analyzing: {selectedDeal.deal_name || selectedDeal.name}
                    </h1>
                    <p className="text-purple-100">
                      Value: {selectedDeal.purchase_price ? `$${selectedDeal.purchase_price.toLocaleString()}` : (selectedDeal.value || '-')}
                      {selectedDeal.deal_status || selectedDeal.status
                        ? ` • Status: ${(selectedDeal.deal_status || selectedDeal.status)
                            .replace(/_/g, ' ')
                            .replace(/\b\w/g, l => l.toUpperCase())}`
                        : ''}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleClearConversation}
                  className="w-10 h-10 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg flex items-center justify-center transition-colors"
                  title="Clear conversation"
                >
                  <Trash2 size={18} />
                </button>
                <button
                  onClick={handleRefreshAnalysis}
                  disabled={isLoading}
                  className="w-10 h-10 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50"
                  title="Generate new analysis"
                >
                  <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
                </button>
                <div className="text-right ml-2">
                  <div className="flex items-center gap-2 text-green-300 mb-1">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-sm">AI Online</span>
                  </div>
                  {selectedDeal.priority_level && (
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getRiskColor(selectedDeal.priority_level)}`}>
                      {selectedDeal.priority_level} Priority
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="p-4 bg-gray-50 border-b border-gray-200">
            <div className="flex gap-2 overflow-x-auto pb-2">
              {QUICK_ACTIONS.map((action, index) => (
                <button
                  key={index}
                  onClick={() => handleQuickAction(action)}
                  disabled={isLoading}
                  className={`flex items-center gap-2 px-3 py-2 ${action.color} text-white rounded-lg text-xs font-medium whitespace-nowrap hover:opacity-90 transition-opacity flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <span>{action.icon}</span>
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 mb-6 overflow-hidden">
          <div className="h-96 overflow-y-auto p-6">
            <div className="space-y-6">
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {message.role === 'assistant' && (
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full flex items-center justify-center text-white font-bold mr-3 flex-shrink-0">
                      AI
                    </div>
                  )}
                  <div className={`max-w-2xl ${message.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-50 border border-gray-200'} rounded-xl p-4 shadow-sm`}>
                    {message.title && (
                      <h4 className="font-semibold text-purple-600 mb-3 flex items-center gap-2">
                        <Target size={16} />
                        {message.title}
                      </h4>
                    )}
                    {message.role === 'assistant' ? (
                      <div
                        className="snf-response text-sm leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
                      />
                    ) : (
                      <div className="whitespace-pre-wrap text-sm leading-relaxed">
                        {message.content}
                      </div>
                    )}
                    <div className="flex justify-between items-center gap-1 pt-3 mt-3 border-t border-gray-200 border-opacity-50">
                      <span className="text-xs opacity-70">
                        {formatTimestamp(message.timestamp)}
                      </span>
                      {message.role === 'user' && (
                        <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                          You
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full flex items-center justify-center text-white font-bold mr-3">
                    AI
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 shadow-sm">
                    <div className="flex items-center gap-2">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                      <span className="text-sm text-gray-600">SNFalyze.ai is analyzing...</span>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>

        {/* Input Area */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 chat-footer-ai">
          <div className="flex gap-3 mb-4">
            <input
              ref={inputRef}
              value={currentMessage}
              onChange={(e) => setCurrentMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={`Ask me anything about ${selectedDeal.deal_name || selectedDeal.name}...`}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-gray-50 focus:bg-white transition-colors"
              disabled={isLoading}
            />
            <button
              onClick={handleSendMessage}
              disabled={!currentMessage.trim() || isLoading}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 send-ai-btn disabled:cursor-not-allowed transition-all flex items-center gap-2 font-medium"
            >
              <span>Send</span>
              <Send size={16} />
            </button>
          </div>
          <div className="flex items-center justify-center gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-1">
              <Sparkles size={14} className="text-purple-500" />
              <span>Powered by SNFalyze.ai</span>
            </div>
            <span>•</span>
            <span>Response time: ~1.5s</span>
            <span>•</span>
            <span>Secure & Confidential</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInterfaceAI;
