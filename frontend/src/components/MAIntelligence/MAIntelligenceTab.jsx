import React from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  TrendingUp,
  Search,
  BarChart3,
} from 'lucide-react';
import MarketOverviewTab from './MarketOverviewTab';
import TransactionExplorerTab from './TransactionExplorerTab';
import './MAIntelligence.css';

const TABS = [
  { id: 'overview', label: 'Market Overview', icon: BarChart3 },
  { id: 'explorer', label: 'Transaction Explorer', icon: Search },
];

const VALID_TABS = ['overview', 'explorer'];

const MAIntelligenceTab = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Derive activeTab directly from URL (single source of truth)
  const tabFromUrl = searchParams.get('tab');
  const activeTab = VALID_TABS.includes(tabFromUrl) ? tabFromUrl : 'overview';

  // Update URL when tab changes
  const handleTabChange = (tabId) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('tab', tabId);
    setSearchParams(newParams, { replace: true });
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <MarketOverviewTab />;
      case 'explorer':
        return <TransactionExplorerTab />;
      default:
        return <MarketOverviewTab />;
    }
  };

  return (
    <div className="ma-intelligence-container">
      {/* Header */}
      <div className="ma-intelligence-header">
        <div className="header-content">
          <div className="header-title-section">
            <div className="header-icon">
              <TrendingUp size={24} />
            </div>
            <div>
              <h1 className="header-title">M&A Market Intelligence</h1>
              <p className="header-subtitle">
                Track ownership changes, analyze transaction trends, and identify market opportunities
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="ma-tabs-container">
        <div className="ma-tabs">
          {TABS.map((tab) => {
            const IconComponent = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                className={`ma-tab ${isActive ? 'active' : ''}`}
                onClick={() => handleTabChange(tab.id)}
              >
                <IconComponent size={16} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="ma-tab-content">
        {renderTabContent()}
      </div>
    </div>
  );
};

export default MAIntelligenceTab;
