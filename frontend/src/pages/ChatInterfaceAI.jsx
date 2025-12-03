import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send,
  Paperclip,
  Mic,
  FileText,
  ArrowLeft,
  Target,
  Download,
  Sparkles
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { SNFDealEvaluator } from '../services/snfAlgorithm/snfEvaluator';

// IndexedDB helper functions
const DB_NAME = 'SNFalyzeAIChatDB';
const DB_VERSION = 1;
const STORE_NAME = 'chatMessages';

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

async function saveMessagesToDB(dealId, messages) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put({ dealId, messages });
    tx.oncomplete = () => resolve();
    tx.onerror = (event) => reject(event.target.error);
  });
}

async function getMessagesFromDB(dealId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(dealId);
    req.onsuccess = () => resolve(req.result ? req.result.messages : null);
    req.onerror = (event) => reject(event.target.error);
  });
}

const quickActions = [
  { label: 'SNF Algorithm Analysis', color: 'bg-purple-500', icon: '🧠', action: 'snf_analysis' },
  { label: 'Financial Performance', color: 'bg-green-500', icon: '💰', action: 'financial_performance' },
  { label: 'Risk Assessment', color: 'bg-red-500', icon: '⚠️', action: 'risk_assessment' },
  { label: 'REIT Compatibility', color: 'bg-blue-500', icon: '🏢', action: 'reit_compatibility' },
  { label: 'Market Analysis', color: 'bg-orange-500', icon: '📊', action: 'market_analysis' },
  { label: 'Investment Recommendation', color: 'bg-teal-500', icon: '🎯', action: 'investment_recommendation' },
  { label: 'Generate Report', color: 'bg-pink-500', icon: '📋', action: 'generate_report' }
];

const GEMINI_API_KEY = process.env.REACT_APP_GEMINI_API_KEY;
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
const STORAGE_KEY = "ai_assistant_chat_messages";

const getDealId = (deal) => {
  // Use a unique identifier for the deal, fallback to name if no id
  return deal?.id || deal?.deal_id || deal?.deal_name || deal?.name || 'default';
};

const ChatInterfaceAI = () => {
  const navigate = useNavigate();
  const { deal } = useLocation().state;
  const [selectedDeal, setSelectedDeal] = useState(deal);
  const [messages, setMessages] = useState([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [dealEvaluation, setDealEvaluation] = useState(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Load messages from localStorage and IndexedDB on mount
  useEffect(() => {
    const dealId = getDealId(deal);

    // Try IndexedDB first
    getMessagesFromDB(dealId)
      .then((dbMessages) => {
        if (dbMessages && dbMessages.length > 0) {
          setMessages(dbMessages.map(m => ({ ...m, timestamp: new Date(m.timestamp) })));
        } else {
          // Fallback to localStorage
          const local = localStorage.getItem(`${STORAGE_KEY}_${dealId}`);
          if (local) {
            try {
              const parsed = JSON.parse(local);
              setMessages(parsed.map(m => ({ ...m, timestamp: new Date(m.timestamp) })));
            } catch {
              setMessages([getWelcomeMessage(deal)]);
            }
          } else {
            setMessages([getWelcomeMessage(deal)]);
          }
        }
      })
      .catch(() => {
        // On error, fallback to localStorage or default
        const local = localStorage.getItem(`${STORAGE_KEY}_${dealId}`);
        if (local) {
          try {
            const parsed = JSON.parse(local);
            setMessages(parsed.map(m => ({ ...m, timestamp: new Date(m.timestamp) })));
          } catch {
            setMessages([getWelcomeMessage(deal)]);
          }
        } else {
          setMessages([getWelcomeMessage(deal)]);
        }
      });

    // Don't run SNF algorithm evaluation automatically - let user request it
    // runSNFEvaluation(deal);
    // eslint-disable-next-line
  }, [deal]);

  // Save messages to localStorage and IndexedDB whenever they change
  useEffect(() => {
    if (!selectedDeal) return;
    const dealId = getDealId(selectedDeal);
    if (messages && messages.length > 0) {
      // Save to localStorage
      localStorage.setItem(`${STORAGE_KEY}_${dealId}`, JSON.stringify(messages));
      // Save to IndexedDB
      saveMessagesToDB(dealId, messages).catch(() => {});
    }
  }, [messages, selectedDeal]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Cleanup effect to prevent memory leaks
  useEffect(() => {
    return () => {
      // Cleanup any pending operations when component unmounts
      setDealEvaluation(null);
      setMessages([]);
      setCurrentMessage('');
    };
  }, []);

  // Run SNF algorithm evaluation
  const runSNFEvaluation = async (deal) => {
    try {
      const evaluation = await SNFDealEvaluator.evaluateDeal(deal);
      setDealEvaluation(evaluation);
      return evaluation;
    } catch (error) {
      console.error('Error running SNF evaluation:', error);
      throw error;
    }
  };

  function getWelcomeMessage(deal) {
    return {
      id: Date.now(),
      type: 'ai',
      title: 'Ready to Analyze!',
      content: `I'm here to help you analyze "${deal.deal_name || deal.name}" using Cascadia Healthcare's proprietary SNF Deal Evaluation Algorithm. 

I can provide comprehensive analysis including:
• Financial performance vs Cascadia benchmarks
• Risk assessment and mitigation strategies  
• REIT compatibility evaluation
• Market analysis and competitive positioning
• Investment recommendations

Use the quick action buttons below to get started, or ask me any specific questions about this deal!`,
      timestamp: new Date()
    };
  }

  const handleBackToDealSelection = useCallback(() => {
    if (isNavigating) return; // Prevent multiple clicks
    
    setIsNavigating(true);
    
    // Clean up state first, then navigate
    // setSelectedDeal();
    setMessages([]);
    setCurrentMessage('');
    setDealEvaluation(null);
    
    // Use requestAnimationFrame to ensure state updates are processed before navigation
    requestAnimationFrame(() => {
      navigate("/ai-deals");
    });
  }, [navigate, isNavigating]);

  // Generate evaluation summary
  const generateEvaluationSummary = (evaluation) => {
    const { summary, overallMetrics, riskAssessment, reitCompatibility, facilities } = evaluation;
    
    // Check if any facilities have estimated data
    const hasEstimatedData = facilities?.some(f => !f.hasActualData);
    
    return `🎯 **Investment Recommendation: ${summary.investmentRecommendation}**
📊 **Deal Score: ${summary.dealScore}/100**
${hasEstimatedData ? '⚠️ **Note: Some financial data estimated based on industry benchmarks**' : ''}

**Key Metrics:**
• Total Deal Value: $${overallMetrics.totalPurchasePrice?.toLocaleString() || 'N/A'}
• Total Beds: ${overallMetrics.totalBeds || 'N/A'}
• Weighted Average Cap Rate: ${(overallMetrics.weightedAverageCapRate * 100)?.toFixed(2) || 'N/A'}%
• Average Occupancy: ${(overallMetrics.weightedAverageOccupancy * 100)?.toFixed(1) || 'N/A'}%

**Risk Assessment: ${riskAssessment.overallRisk?.toUpperCase()}**
• High Risk Factors: ${riskAssessment.riskCounts?.high || 0}
• Medium Risk Factors: ${riskAssessment.riskCounts?.medium || 0}

**REIT Compatibility:**
• Public REIT Yield: ${(reitCompatibility.publicREITYield * 100)?.toFixed(2) || 'N/A'}%
• Coverage Ratio: ${reitCompatibility.coverageRatio?.toFixed(2) || 'N/A'}
• Meets Requirements: ${reitCompatibility.meetsPublicREITRequirements ? '✅' : '❌'}

**Key Strengths:**
${summary.keyStrengths?.map(s => `• ${s}`).join('\n') || '• None identified'}

**Key Concerns:**
${summary.keyConcerns?.map(c => `• ${c}`).join('\n') || '• None identified'}

Use the quick actions below to dive deeper into specific areas of analysis.`;
  };

  // Quick action prompt
  const handleQuickAction = useCallback(async (action) => {
    if (!action.action || !selectedDeal) return;
    
    setIsLoading(true);
    
    try {
      let evaluation = dealEvaluation;
      
      // If no evaluation exists yet, run it first
      if (!evaluation) {
        evaluation = await runSNFEvaluation(selectedDeal);
      }
      
      // Generate the specific analysis
      const analysisContent = generateSpecificAnalysis(action.action, evaluation);
      
      const analysisMessage = {
        id: Date.now(),
        type: 'ai',
        title: action.label,
        content: analysisContent,
        timestamp: new Date()
      };
      
      setMessages(prev => {
        const updated = [...prev, analysisMessage];
        const dealId = getDealId(selectedDeal);
        localStorage.setItem(`${STORAGE_KEY}_${dealId}`, JSON.stringify(updated));
        saveMessagesToDB(dealId, updated).catch(() => {});
        return updated;
      });
    } catch (error) {
      console.error('Error running SNF evaluation:', error);
      const errorMessage = {
        id: Date.now(),
        type: 'ai',
        title: 'Error',
        content: 'Sorry, I encountered an error while analyzing the deal. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [dealEvaluation, selectedDeal]);

  // Generate specific analysis based on action type
  const generateSpecificAnalysis = (actionType, evaluation) => {
    const { facilities, overallMetrics, riskAssessment, reitCompatibility, recommendations, marketAnalysis } = evaluation;
    
    switch (actionType) {
      case 'snf_analysis':
        return generateEvaluationSummary(evaluation);

      case 'financial_performance':
        return `💰 **Financial Performance Analysis**

**Overall Financial Metrics:**
• Total Revenue: $${overallMetrics.totalRevenue?.toLocaleString() || 'N/A'}
• Total EBITDA: $${overallMetrics.totalEBITDA?.toLocaleString() || 'N/A'}
• Total EBITDAR: $${overallMetrics.totalEBITDAR?.toLocaleString() || 'N/A'}
• Weighted Average Cap Rate: ${(overallMetrics.weightedAverageCapRate * 100)?.toFixed(2) || 'N/A'}%
• Average Price per Bed: $${overallMetrics.averagePricePerBed?.toLocaleString() || 'N/A'}

**Performance Analysis:**
${facilities?.map(f => `
**${f.facilityName}:**
• EBITDA Margin: ${f.t12mRevenue > 0 ? ((f.t12mEBITDA / f.t12mRevenue) * 100).toFixed(1) : 'N/A'}%
• Revenue per Bed: $${f.t12mRevenue > 0 ? (f.t12mRevenue / f.totalBeds).toLocaleString() : 'N/A'}
• Performance vs Target: ${f.performance?.ebitdaVsTarget >= 0.8 ? '✅ Good' : '❌ Needs Improvement'}
`).join('') || 'No facility data available'}`;

      case 'risk_assessment':
        return `⚠️ **Risk Assessment Analysis**

**Overall Risk Level: ${riskAssessment.overallRisk?.toUpperCase()}**

**Risk Breakdown:**
• High Risk Factors: ${riskAssessment.riskCounts?.high || 0}
• Medium Risk Factors: ${riskAssessment.riskCounts?.medium || 0}
• Low Risk Factors: ${riskAssessment.riskCounts?.low || 0}

**Top Risk Factors:**
${riskAssessment.topRisks?.map(risk => `
• **${risk.type.toUpperCase()}** (${risk.severity}): ${risk.description}
`).join('') || '• No high-risk factors identified'}

**Facility-Specific Risks:**
${facilities?.map(f => `
**${f.facilityName}:**
${f.riskFactors?.map(rf => `• ${rf.description} (${rf.severity})`).join('\n') || '• No significant risks identified'}
`).join('') || 'No facility data available'}`;

      case 'reit_compatibility':
        return `🏢 **REIT Compatibility Analysis**

**Public REIT Requirements:**
• Current Yield: ${(reitCompatibility.publicREITYield * 100)?.toFixed(2) || 'N/A'}%
• Required Yield: 9.0%
• Meets Requirements: ${reitCompatibility.meetsPublicREITRequirements ? '✅ YES' : '❌ NO'}

**Private REIT Requirements:**
• Current Yield: ${(reitCompatibility.privateREITYield * 100)?.toFixed(2) || 'N/A'}%
• Required Yield: 10.0%
• Meets Requirements: ${reitCompatibility.meetsPrivateREITRequirements ? '✅ YES' : '❌ NO'}

**Coverage Ratio Analysis:**
• Current Coverage Ratio: ${reitCompatibility.coverageRatio?.toFixed(2) || 'N/A'}
• Required Coverage Ratio: 1.4+
• Meets Requirements: ${reitCompatibility.meetsCoverageRatio ? '✅ YES' : '❌ NO'}

**REIT Optimization Recommendations:**
${reitCompatibility.meetsPublicREITRequirements ? '• Deal structure is REIT-compatible' : '• Consider operational improvements to meet REIT yield requirements'}
${reitCompatibility.meetsCoverageRatio ? '• Coverage ratio meets REIT standards' : '• Improve cash flow to meet coverage ratio requirements'}`;

      case 'market_analysis':
        return `📊 **Market Analysis**

**Market Overview:**
${marketAnalysis?.map(ma => `
**${ma.facilityId} - ${ma.marketAnalysis.city}, ${ma.marketAnalysis.state}:**
• Medicare Rate: $${ma.marketAnalysis.reimbursementRates?.medicare || 'N/A'}
• Medicaid Rate: $${ma.marketAnalysis.reimbursementRates?.medicaid || 'N/A'}
• Market Trends: ${ma.marketAnalysis.marketTrends?.occupancyTrend || 'Unknown'}
• Competition Level: ${ma.marketAnalysis.marketTrends?.competitionTrend || 'Unknown'}
`).join('') || 'No market data available'}

**Competitive Position:**
${marketAnalysis?.map(ma => `
**${ma.facilityId}:**
• Market Share: ${ma.marketAnalysis.competitivePosition?.marketShare || 'Unknown'}
• Competitive Advantages: ${ma.marketAnalysis.competitivePosition?.competitiveAdvantages?.join(', ') || 'None identified'}
• Competitive Threats: ${ma.marketAnalysis.competitivePosition?.competitiveThreats?.join(', ') || 'None identified'}
`).join('') || 'No competitive data available'}`;

      case 'investment_recommendation':
        return `🎯 **Investment Recommendation**

**Overall Recommendation: ${evaluation.summary?.investmentRecommendation || 'N/A'}**
**Deal Score: ${evaluation.summary?.dealScore || 'N/A'}/100**

**Key Strengths:**
${evaluation.summary?.keyStrengths?.map(s => `• ${s}`).join('\n') || '• None identified'}

**Key Concerns:**
${evaluation.summary?.keyConcerns?.map(c => `• ${c}`).join('\n') || '• None identified'}

**Recommended Next Steps:**
${evaluation.summary?.nextSteps?.map(step => `• ${step}`).join('\n') || '• No specific steps identified'}

**Action Items:**
${recommendations?.map(rec => `
• **${rec.title}** (${rec.priority} priority)
  ${rec.description}
`).join('') || '• No specific recommendations'}`;

      case 'generate_report':
        return `📋 **Comprehensive Deal Report**

**Executive Summary:**
This deal analysis was conducted using Cascadia Healthcare's proprietary SNF Deal Evaluation Algorithm. The analysis evaluates financial performance, risk factors, REIT compatibility, and market conditions.

**Investment Recommendation: ${evaluation.summary?.investmentRecommendation || 'N/A'}**
**Deal Score: ${evaluation.summary?.dealScore || 'N/A'}/100**

**Financial Summary:**
• Total Investment: $${overallMetrics.totalPurchasePrice?.toLocaleString() || 'N/A'}
• Total Beds: ${overallMetrics.totalBeds || 'N/A'}
• Weighted Average Cap Rate: ${(overallMetrics.weightedAverageCapRate * 100)?.toFixed(2) || 'N/A'}%
• Average Occupancy: ${(overallMetrics.weightedAverageOccupancy * 100)?.toFixed(1) || 'N/A'}%

**Risk Assessment: ${riskAssessment.overallRisk?.toUpperCase()}**
• High Risk Factors: ${riskAssessment.riskCounts?.high || 0}
• Medium Risk Factors: ${riskAssessment.riskCounts?.medium || 0}

**REIT Compatibility:**
• Public REIT Compatible: ${reitCompatibility.meetsPublicREITRequirements ? '✅ YES' : '❌ NO'}
• Coverage Ratio Met: ${reitCompatibility.meetsCoverageRatio ? '✅ YES' : '❌ NO'}

**Recommendations:**
${recommendations?.map(rec => `• ${rec.title}: ${rec.description}`).join('\n') || '• No specific recommendations'}

*Report generated by SNFalyze.ai using Cascadia Healthcare's SNF Deal Evaluation Algorithm*`;

      default:
        return 'Analysis not available. Please try again.';
    }
  };

  // Sample question prompt
  const handleSampleQuestion = (question) => {
    setCurrentMessage(question);
    inputRef.current?.focus();
  };

  // Send message to Gemini AI
  const handleSendMessage = async () => {
    if (!currentMessage.trim() || isLoading) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: currentMessage,
      timestamp: new Date()
    };

    setMessages(prev => {
      const updated = [...prev, userMessage];
      // Save to localStorage and IndexedDB
      const dealId = getDealId(selectedDeal);
      localStorage.setItem(`${STORAGE_KEY}_${dealId}`, JSON.stringify(updated));
      saveMessagesToDB(dealId, updated).catch(() => {});
      return updated;
    });
    setCurrentMessage('');
    setIsLoading(true);

    try {
      // Helper to format beds - handles both string and array formats
      const formatBeds = (beds) => {
        if (!beds) return 'N/A';
        if (Array.isArray(beds)) {
          return beds.map(bed => `${bed.count} ${bed.type}`).join(', ') || 'N/A';
        }
        // Handle string format (e.g., "120" or JSON string)
        if (typeof beds === 'string') {
          try {
            const parsed = JSON.parse(beds);
            if (Array.isArray(parsed)) {
              return parsed.map(bed => `${bed.count} ${bed.type}`).join(', ');
            }
          } catch {
            return beds; // Return as-is if not JSON
          }
        }
        return String(beds);
      };

      // Compose prompt with deal context
      // Note: Deal data is stored flat on the deal object (not in deal_facility array)
      const dealContext = `
      Deal Name: ${selectedDeal.deal_name || selectedDeal.name}
      Type: ${selectedDeal.deal_type || '-'}
      Total Deal Amount: ${selectedDeal.total_deal_amount ? `$${selectedDeal.total_deal_amount.toLocaleString()}` : '-'}
      Status: ${selectedDeal.deal_status || selectedDeal.status || '-'}
      Priority: ${selectedDeal.priority_level || '-'}
      Deal Source: ${selectedDeal.deal_source || '-'}
      Target Close Date: ${selectedDeal.target_close_date || '-'}

      Facility Information:
      - Facility Name: ${selectedDeal.facility_name || '-'}
      - Facility Type: ${selectedDeal.facility_type || '-'}
      - Location: ${selectedDeal.city || '-'}, ${selectedDeal.state || '-'} ${selectedDeal.zip_code || ''}
      - Address: ${selectedDeal.street_address || '-'}
      - Number of Beds: ${formatBeds(selectedDeal.no_of_beds)}

      Financial Metrics:
      - Purchase Price: ${selectedDeal.purchase_price ? `$${selectedDeal.purchase_price.toLocaleString()}` : 'N/A'}
      - Price Per Bed: ${selectedDeal.price_per_bed ? `$${selectedDeal.price_per_bed.toLocaleString()}` : 'N/A'}
      - Annual Revenue: ${selectedDeal.annual_revenue ? `$${selectedDeal.annual_revenue.toLocaleString()}` : 'N/A'}
      - Revenue Multiple: ${selectedDeal.revenue_multiple ? `${selectedDeal.revenue_multiple}x` : 'N/A'}
      - EBITDA: ${selectedDeal.ebitda ? `$${selectedDeal.ebitda.toLocaleString()}` : 'N/A'}
      - EBITDA Multiple: ${selectedDeal.ebitda_multiple ? `${selectedDeal.ebitda_multiple}x` : 'N/A'}
      - EBITDA Margin: ${selectedDeal.ebitda_margin ? `${selectedDeal.ebitda_margin}%` : 'N/A'}
      - Net Operating Income: ${selectedDeal.net_operating_income ? `$${selectedDeal.net_operating_income.toLocaleString()}` : 'N/A'}

      Operational Metrics:
      - Current Occupancy: ${selectedDeal.current_occupancy ? `${selectedDeal.current_occupancy}%` : 'N/A'}
      - Average Daily Rate: ${selectedDeal.average_daily_rate ? `$${selectedDeal.average_daily_rate.toLocaleString()}` : 'N/A'}

      Payer Mix:
      - Medicare: ${selectedDeal.medicare_percentage ? `${selectedDeal.medicare_percentage}%` : 'N/A'}
      - Private Pay: ${selectedDeal.private_pay_percentage ? `${selectedDeal.private_pay_percentage}%` : 'N/A'}

      Investment Targets:
      - Target IRR: ${selectedDeal.target_irr_percentage ? `${selectedDeal.target_irr_percentage}%` : 'N/A'}
      - Target Hold Period: ${selectedDeal.target_hold_period ? `${selectedDeal.target_hold_period} years` : 'N/A'}
      - Projected Cap Rate: ${selectedDeal.projected_cap_rate_percentage ? `${selectedDeal.projected_cap_rate_percentage}%` : 'N/A'}
      - Exit Multiple: ${selectedDeal.exit_multiple ? `${selectedDeal.exit_multiple}x` : 'N/A'}

      ${dealEvaluation ? `
      SNF Algorithm Analysis Available:
      - Deal Score: ${dealEvaluation.summary?.dealScore || 'N/A'}/100
      - Investment Recommendation: ${dealEvaluation.summary?.investmentRecommendation || 'N/A'}
      - Risk Level: ${dealEvaluation.riskAssessment?.overallRisk || 'N/A'}
      - REIT Compatible: ${dealEvaluation.reitCompatibility?.meetsPublicREITRequirements ? 'Yes' : 'No'}
      ` : ''}
      `;

      // Build chat history for Gemini
      const chatHistory = messages.map(m => ({
        role: m.type === 'user' ? 'user' : 'assistant',
        content: m.content
      }));

      // Add the new user message
      chatHistory.push({ role: 'user', content: currentMessage });

      // Compose the prompt for Gemini
      const prompt = `You are SNFalyze.ai, an advanced M&A deal analysis assistant specializing in Skilled Nursing Facility (SNF) deals. You use Cascadia Healthcare's proprietary SNF Deal Evaluation Algorithm to provide sophisticated analysis.

Here is the deal context:\n${dealContext}\n\nConversation so far:\n${chatHistory.map(m => `${m.role}: ${m.content}`).join('\n')}\n\nRespond to the user's last message with actionable, insightful, and concise analysis based on SNF industry expertise and the algorithm results. Focus on:
- Financial performance vs Cascadia benchmarks (9% EBITDA, 23% EBITDAR, 85% occupancy)
- Risk assessment and mitigation strategies
- REIT compatibility and optimization opportunities
- Market analysis and competitive positioning
- Turnaround potential and operational improvements

If relevant, suggest next steps or offer to generate a comprehensive report.`;

      // Call Gemini API
      const response = await fetch(
        `${GEMINI_URL}?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt }
                ]
              }
            ]
          })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      const data = await response.json();
      // Gemini's response is in data.candidates[0].content.parts[0].text
      let aiText = "Sorry, I couldn't understand the response from Gemini.";
      if (
        data &&
        data.candidates &&
        data.candidates[0] &&
        data.candidates[0].content &&
        data.candidates[0].content.parts &&
        data.candidates[0].content.parts[0] &&
        data.candidates[0].content.parts[0].text
      ) {
        aiText = data.candidates[0].content.parts[0].text;
      }

      const aiMessage = {
        id: Date.now() + 1,
        type: 'ai',
        title: undefined,
        content: aiText,
        actions: [],
        timestamp: new Date()
      };

      setMessages(prev => {
        const updated = [...prev, aiMessage];
        // Save to localStorage and IndexedDB
        const dealId = getDealId(selectedDeal);
        localStorage.setItem(`${STORAGE_KEY}_${dealId}`, JSON.stringify(updated));
        saveMessagesToDB(dealId, updated).catch(() => {});
        return updated;
      });
    } catch (err) {
      const errorMessage = {
        id: Date.now() + 2,
        type: 'ai',
        content: "Sorry, I couldn't process your request. Please try again.",
        timestamp: new Date()
      };
      setMessages(prev => {
        const updated = [...prev, errorMessage];
        // Save to localStorage and IndexedDB
        const dealId = getDealId(selectedDeal);
        localStorage.setItem(`${STORAGE_KEY}_${dealId}`, JSON.stringify(updated));
        saveMessagesToDB(dealId, updated).catch(() => {});
        return updated;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
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
                    {/* <Brain size={24} /> */}
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
              <div className="text-right">
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
          {/* Quick Actions */}
          <div className="p-4 bg-gray-50 border-b border-gray-200">
            <div className="flex gap-2 overflow-x-auto pb-2">
              {quickActions.map((action, index) => (
                <button
                  key={index}
                  onClick={() => handleQuickAction(action)}
                  className={`flex items-center gap-2 px-3 py-2 ${action.color} text-white rounded-lg text-xs font-medium whitespace-nowrap hover:opacity-90 transition-opacity flex-shrink-0`}
                >
                  <span>{action.icon}</span>
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        {/* Chat Messages */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 mb-6 overflow-hidden ">
          <div className="h-96 overflow-y-auto p-6">
            <div className="space-y-6">
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {message.type === 'ai' && (
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full flex items-center justify-center text-white font-bold mr-3 flex-shrink-0">
                      AI
                    </div>
                  )}
                  <div className={`max-w-2xl ${message.type === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-50 border border-gray-200'} rounded-xl p-4 shadow-sm`}>
                    {message.title && (
                      <h4 className="font-semibold text-purple-600 mb-3 flex items-center gap-2">
                        <Target size={16} />
                        {message.title}
                      </h4>
                    )}
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                      {message.content}
                    </div>
                    {message.actions && Array.isArray(message.actions) && message.actions.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-gray-200">
                        {message.actions.map((action, index) => (
                          <button
                            key={index}
                            className="bg-purple-600 text-white px-3 py-1 rounded-lg text-xs hover:bg-purple-700 transition-colors flex items-center gap-1"
                          >
                            <Download size={12} />
                            {action}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="flex justify-between items-center gap-1 pt-3 mt-3 border-t border-gray-200 border-opacity-50">
                      <span className="text-xs opacity-70">
                        {formatTimestamp(message.timestamp)}
                      </span>
                      {message.type === 'user' && (
                        <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                          JD
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
            {/* <button className="px-4 py-3 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
              <Paperclip size={20} />
            </button> */}
            {/* <button className="px-4 py-3 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
              <Mic size={20} />
            </button>
            <button className="px-4 py-3 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
              <FileText size={20} />
            </button> */}
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