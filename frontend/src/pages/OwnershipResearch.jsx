import { useState } from 'react';
import { Building2, Search } from 'lucide-react';
import FacilitySearch from '../components/OwnershipResearch/FacilitySearch';
import OwnershipSearch from '../components/OwnershipResearch/OwnershipSearch';
import './OwnershipResearch.css';

function OwnershipResearchPage() {
  const [activeTab, setActiveTab] = useState('facility');

  return (
    <div className="ownership-research-page">
      {/* Page Header */}
      <div className="ownership-page-header">
        <div className="ownership-title-section">
          <h1 className="ownership-title">
            <Building2 size={28} />
            Ownership Research
          </h1>
          <p className="ownership-subtitle">
            Explore SNF facilities and ownership chains nationwide
          </p>
        </div>
      </div>

      {/* Tab Card */}
      <div className="ownership-tab-card">
        {/* Tab Navigation */}
        <div className="ownership-tab-navigation">
          <button
            className={`ownership-tab-button ${activeTab === 'facility' ? 'active' : ''}`}
            onClick={() => setActiveTab('facility')}
          >
            <Search size={18} />
            <span>Facility Search</span>
          </button>
          <button
            className={`ownership-tab-button ${activeTab === 'ownership' ? 'active' : ''}`}
            onClick={() => setActiveTab('ownership')}
          >
            <Building2 size={18} />
            <span>Ownership Search</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="ownership-tab-content">
          {activeTab === 'facility' && <FacilitySearch />}
          {activeTab === 'ownership' && <OwnershipSearch />}
        </div>
      </div>
    </div>
  );
}

export default OwnershipResearchPage;
