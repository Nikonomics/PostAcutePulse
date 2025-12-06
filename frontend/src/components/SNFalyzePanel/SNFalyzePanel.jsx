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
import { calculateDealMetrics } from '../../api/DealService';

// =============================================================================
// GEMINI API CONFIGURATION
// =============================================================================
const GEMINI_API_KEY = process.env.REACT_APP_GEMINI_API_KEY;
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

// =============================================================================
// IndexedDB PERSISTENCE (for conversation history per deal)
// =============================================================================
const DB_NAME = 'SNFalyzePanelDB';
const DB_VERSION = 1;
const STORE_NAME = 'conversations';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = (event) => reject(event.target.error);
    request.onsuccess = (event) => resolve(event.target.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'dealId' });
      }
    };
  });
}

async function saveConversationToDB(dealId, messages) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put({ dealId, messages, lastUpdated: new Date().toISOString() });
      tx.oncomplete = () => resolve();
      tx.onerror = (event) => reject(event.target.error);
    });
  } catch (err) {
    console.error('Error saving conversation:', err);
  }
}

async function getConversationFromDB(dealId) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(dealId);
      req.onsuccess = () => resolve(req.result ? req.result.messages : null);
      req.onerror = (event) => reject(event.target.error);
    });
  } catch (err) {
    console.error('Error loading conversation:', err);
    return null;
  }
}

async function clearConversationFromDB(dealId) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(dealId);
      tx.oncomplete = () => resolve();
      tx.onerror = (event) => reject(event.target.error);
    });
  } catch (err) {
    console.error('Error clearing conversation:', err);
  }
}

// =============================================================================
// MARKDOWN RENDERING
// =============================================================================
const renderMarkdown = (text) => {
  if (!text) return '';

  const lines = text.split('\n');
  let html = '';
  let inList = false;
  let inOrderedList = false;

  lines.forEach((line) => {
    if (inList && !line.trim().startsWith('-') && !line.trim().startsWith('*')) {
      html += '</ul>';
      inList = false;
    }
    if (inOrderedList && !/^\d+\./.test(line.trim())) {
      html += '</ol>';
      inOrderedList = false;
    }

    if (line.startsWith('## ')) {
      html += `<h3 class="snf-header">${line.substring(3)}</h3>`;
    } else if (line.startsWith('# ')) {
      html += `<h2 class="snf-header-main">${line.substring(2)}</h2>`;
    } else if (line.startsWith('**') && line.endsWith('**')) {
      html += `<h4 class="snf-subheader">${line.slice(2, -2)}</h4>`;
    } else if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      if (!inList) {
        html += '<ul class="snf-list">';
        inList = true;
      }
      const content = line.trim().substring(2);
      html += `<li>${formatInlineMarkdown(content)}</li>`;
    } else if (/^\d+\.\s/.test(line.trim())) {
      if (!inOrderedList) {
        html += '<ol class="snf-ordered-list">';
        inOrderedList = true;
      }
      const content = line.trim().replace(/^\d+\.\s/, '');
      html += `<li>${formatInlineMarkdown(content)}</li>`;
    } else if (line.trim() === '') {
      html += '<div class="snf-spacer"></div>';
    } else {
      html += `<p class="snf-paragraph">${formatInlineMarkdown(line)}</p>`;
    }
  });

  if (inList) html += '</ul>';
  if (inOrderedList) html += '</ol>';

  return html;
};

const formatInlineMarkdown = (text) => {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/_(.+?)_/g, '<em>$1</em>');
};

// =============================================================================
// BUILD CONTEXT SUMMARY
// =============================================================================

/**
 * Build comprehensive context from deal data and calculator metrics
 */
const buildDealContext = (deal, calculatorMetrics) => {
  if (!deal) return '';

  const val = (v) => (v !== null && v !== undefined) ? String(v) : 'N/A';

  let context = `DEAL INFORMATION
================
Deal Name: ${deal.deal_name || deal.name || 'Unknown'}
Deal Type: ${deal.deal_type || 'N/A'}
Status: ${deal.deal_status || deal.status || 'N/A'}
Priority: ${deal.priority_level || 'N/A'}
Deal Source: ${deal.deal_source || 'N/A'}
Target Close Date: ${deal.target_close_date || 'N/A'}

FACILITY INFORMATION
====================
Facility Name: ${deal.facility_name || 'N/A'}
Facility Type: ${deal.facility_type || 'N/A'}
Location: ${deal.city || 'N/A'}, ${deal.state || 'N/A'} ${deal.zip_code || ''}
Address: ${deal.street_address || 'N/A'}
Number of Beds: ${deal.no_of_beds || 'N/A'}

FINANCIAL METRICS (from deal record)
====================================
Purchase Price: ${deal.purchase_price ? `$${deal.purchase_price.toLocaleString()}` : 'N/A'}
Price Per Bed: ${deal.price_per_bed ? `$${deal.price_per_bed.toLocaleString()}` : 'N/A'}
Annual Revenue: ${deal.annual_revenue ? `$${deal.annual_revenue.toLocaleString()}` : 'N/A'}
Revenue Multiple: ${deal.revenue_multiple ? `${deal.revenue_multiple}x` : 'N/A'}
EBITDA: ${deal.ebitda ? `$${deal.ebitda.toLocaleString()}` : 'N/A'}
EBITDA Multiple: ${deal.ebitda_multiple ? `${deal.ebitda_multiple}x` : 'N/A'}
EBITDA Margin: ${deal.ebitda_margin ? `${deal.ebitda_margin}%` : 'N/A'}

OPERATIONAL METRICS
===================
Current Occupancy: ${deal.current_occupancy ? `${deal.current_occupancy}%` : 'N/A'}
Average Daily Rate: ${deal.average_daily_rate ? `$${deal.average_daily_rate.toLocaleString()}` : 'N/A'}

PAYER MIX
=========
Medicare: ${deal.medicare_percentage ? `${deal.medicare_percentage}%` : 'N/A'}
Private Pay: ${deal.private_pay_percentage ? `${deal.private_pay_percentage}%` : 'N/A'}

INVESTMENT TARGETS
==================
Target IRR: ${deal.target_irr_percentage ? `${deal.target_irr_percentage}%` : 'N/A'}
Target Hold Period: ${deal.target_hold_period ? `${deal.target_hold_period} years` : 'N/A'}
Projected Cap Rate: ${deal.projected_cap_rate_percentage ? `${deal.projected_cap_rate_percentage}%` : 'N/A'}
Exit Multiple: ${deal.exit_multiple ? `${deal.exit_multiple}x` : 'N/A'}`;

  // Add calculator metrics if available
  if (calculatorMetrics) {
    const { inputs, computed, dataQuality } = calculatorMetrics;

    context += `

CALCULATOR METRICS (computed)
=============================
Data Completeness: ${val(dataQuality?.completenessScore)}%
Has Revenue Data: ${dataQuality?.hasRevenueData ? 'Yes' : 'No'}
Has EBITDA Data: ${dataQuality?.hasEBITDAData ? 'Yes' : 'No'}
Has Occupancy Data: ${dataQuality?.hasOccupancyData ? 'Yes' : 'No'}
Has Payer Mix Data: ${dataQuality?.hasPayerMixData ? 'Yes' : 'No'}

INPUT VALUES
------------
Purchase Price: ${val(inputs?.purchasePrice)}
Annual Revenue: ${val(inputs?.annualRevenue)}
EBITDA: ${val(inputs?.ebitda)}
EBITDAR: ${val(inputs?.ebitdar)}
Number of Beds: ${val(inputs?.numberOfBeds)}
Current Occupancy: ${val(inputs?.currentOccupancy)}
Average Daily Rate: ${val(inputs?.averageDailyRate)}
Annual Rent: ${val(inputs?.annualRent)}
Target IRR: ${val(inputs?.targetIRR)}
Target Hold Period: ${val(inputs?.targetHoldPeriod)}
Exit Multiple: ${val(inputs?.exitMultiple)}
Target Cap Rate: ${val(inputs?.targetCapRate)}

COMPUTED METRICS
----------------
Price Per Bed: ${val(computed?.pricePerBed)}
Revenue Multiple: ${val(computed?.revenueMultiple)}
EBITDA Multiple: ${val(computed?.ebitdaMultiple)}
EBITDAR Multiple: ${val(computed?.ebitdarMultiple)}
Cap Rate: ${val(computed?.capRate)}
EBITDA Margin: ${val(computed?.ebitdaMargin)}
Revenue Per Bed: ${val(computed?.revenuePerBed)}
EBITDA Per Bed: ${val(computed?.ebitdaPerBed)}
Rent Coverage Ratio: ${val(computed?.rentCoverageRatio)}
Stabilized Cap Rate: ${val(computed?.stabilizedCapRate)}
Exit Value at Multiple: ${val(computed?.exitValueAtMultiple)}
Implied Value at Target Cap: ${val(computed?.impliedValueAtTargetCap)}`;

    if (computed?.payerMix) {
      context += `

PAYER MIX (computed)
--------------------
Medicare: ${val(computed.payerMix.medicare)}
Medicaid: ${val(computed.payerMix.medicaid)}
Private Pay: ${val(computed.payerMix.privatePay)}
Other: ${val(computed.payerMix.other)}`;
    }
  }

  return context;
};

// =============================================================================
// INITIAL ANALYSIS PROMPT
// =============================================================================
const getInitialAnalysisPrompt = (dealContext) => {
  return `You are SNFalyze.ai, an advanced M&A deal analysis assistant specializing in Skilled Nursing Facility (SNF) deals. You use Cascadia Healthcare's proprietary SNF Deal Evaluation Algorithm to provide sophisticated analysis.

Here is the complete deal data:

${dealContext}

Please analyze this deal and provide a well-formatted comprehensive analysis with the following sections. Use clear headers, spacing, and bullet points for readability:

## 1. Financial Health Assessment
Provide a concise 2-3 sentence assessment of the deal's overall financial health.

## 2. Key Strengths
List 2-4 strengths as bullet points, each with a brief explanation.

## 3. Key Concerns & Red Flags
List 2-4 concerns as bullet points, each with a brief explanation of why it matters.

## 4. Benchmark Comparison
Compare key metrics to Cascadia benchmarks in a clear format:
- EBITDA Margin: [deal value] vs 9% benchmark
- EBITDAR Margin: [deal value] vs 23% benchmark
- Occupancy: [deal value] vs 85% benchmark

## 5. Recommended Next Steps
Provide 4-6 actionable next steps as numbered items, each on its own line.

## Summary
End with a 2-3 sentence overall recommendation.

Format your response with proper markdown using ## for headers, bullet points (-) for lists, and numbered lists (1. 2. 3.) for sequential steps. Include blank lines between sections for readability.`;
};

// =============================================================================
// FOLLOW-UP CONVERSATION PROMPT
// =============================================================================
const getConversationPrompt = (dealContext, conversationHistory, userMessage) => {
  const historyText = conversationHistory
    .map(m => `${m.role === 'user' ? 'User' : 'SNFalyze'}: ${m.content}`)
    .join('\n\n');

  return `You are SNFalyze.ai, an advanced M&A deal analysis assistant specializing in Skilled Nursing Facility (SNF) deals. You use Cascadia Healthcare's proprietary SNF Deal Evaluation Algorithm to provide sophisticated analysis.

Here is the complete deal data:

${dealContext}

Previous conversation:
${historyText}

User's new question: ${userMessage}

Respond to the user's question with actionable, insightful, and concise analysis based on SNF industry expertise. Focus on:
- Financial performance vs Cascadia benchmarks (9% EBITDA, 23% EBITDAR, 85% occupancy)
- Risk assessment and mitigation strategies
- REIT compatibility and optimization opportunities
- Market analysis and competitive positioning
- Turnaround potential and operational improvements

Format your response with proper markdown using ## for headers when appropriate, bullet points (-) for lists, and bold (**text**) for emphasis.`;
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================
const SNFalyzePanel = ({
  isOpen,
  onClose,
  dealId,
  deal,
  autoAnalyze = false // Set to true to automatically run analysis on open
}) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [calculatorMetrics, setCalculatorMetrics] = useState(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Load conversation from IndexedDB when panel opens
  useEffect(() => {
    if (isOpen && dealId) {
      loadConversation();
      fetchCalculatorMetrics();
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
      runInitialAnalysis();
    }
  }, [isOpen, autoAnalyze, messages.length, deal, metricsLoading]);

  const loadConversation = async () => {
    if (!dealId) return;
    const savedMessages = await getConversationFromDB(dealId);
    if (savedMessages && savedMessages.length > 0) {
      setMessages(savedMessages.map(m => ({
        ...m,
        timestamp: new Date(m.timestamp)
      })));
    }
  };

  const fetchCalculatorMetrics = async () => {
    if (!dealId) return;
    setMetricsLoading(true);
    try {
      const response = await calculateDealMetrics(dealId);
      if (response.success) {
        setCalculatorMetrics(response.body);
      }
    } catch (err) {
      console.error('Error fetching calculator metrics:', err);
    } finally {
      setMetricsLoading(false);
    }
  };

  const runInitialAnalysis = async () => {
    if (!deal) return;

    setIsLoading(true);
    setError(null);

    try {
      const dealContext = buildDealContext(deal, calculatorMetrics);
      const prompt = getInitialAnalysisPrompt(dealContext);

      const response = await fetch(
        `${GEMINI_URL}?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      const data = await response.json();
      const aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!aiText) {
        throw new Error('Invalid response format from Gemini API');
      }

      const aiMessage = {
        id: Date.now(),
        role: 'assistant',
        content: aiText,
        timestamp: new Date()
      };

      const newMessages = [aiMessage];
      setMessages(newMessages);
      await saveConversationToDB(dealId, newMessages);
    } catch (err) {
      setError(err.message || 'Failed to get SNFalyze analysis');
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
      const dealContext = buildDealContext(deal, calculatorMetrics);

      // Build conversation history for context
      const conversationHistory = updatedMessages.map(m => ({
        role: m.role,
        content: m.content
      }));

      const prompt = getConversationPrompt(dealContext, conversationHistory.slice(0, -1), inputMessage.trim());

      const response = await fetch(
        `${GEMINI_URL}?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      const data = await response.json();
      const aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!aiText) {
        throw new Error('Invalid response format from Gemini API');
      }

      const aiMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: aiText,
        timestamp: new Date()
      };

      const newMessages = [...updatedMessages, aiMessage];
      setMessages(newMessages);
      await saveConversationToDB(dealId, newMessages);
    } catch (err) {
      setError(err.message || 'Failed to get SNFalyze response');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearConversation = async () => {
    if (window.confirm('Clear conversation history for this deal?')) {
      setMessages([]);
      await clearConversationFromDB(dealId);
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
              onClick={() => { runInitialAnalysis(); }}
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

        {/* Content */}
        <div className="snfalyze-panel-content">
          {messages.length === 0 && !isLoading ? (
            <div className="snfalyze-empty-state">
              <MessageSquare size={48} style={{ color: '#7c3aed', opacity: 0.5 }} />
              <p>Ask SNFalyze about this deal</p>
              <span>Get AI-powered insights, analysis, and recommendations</span>
              <button
                className="snfalyze-analyze-btn"
                onClick={runInitialAnalysis}
                disabled={isLoading || metricsLoading}
              >
                <Sparkles size={18} />
                {metricsLoading ? 'Loading metrics...' : 'Generate Analysis'}
              </button>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <div key={message.id} className={`snfalyze-message ${message.role}`}>
                  <div className={`snfalyze-avatar ${message.role === 'user' ? 'user' : 'ai'}`}>
                    {message.role === 'user' ? 'You' : 'AI'}
                  </div>
                  <div>
                    <div className="snfalyze-message-content">
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
              placeholder="Ask a follow-up question..."
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
