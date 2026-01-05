/**
 * MarketDetailPage.jsx
 *
 * Full market detail view with all metrics for a single CBSA or county.
 *
 * Features:
 * - Market summary with grade cards (national + state rankings)
 * - Tabbed metric sections
 * - Facility list with filtering
 * - Export functionality
 * - Nearby markets sidebar
 *
 * Route: /market-grading/market/:cbsaCode
 *
 * API calls:
 * - getMarketDetail(cbsaCode)
 * - getMarketFacilities(cbsaCode, type)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Container, Row, Col, Spinner, Alert, Button, Nav, Tab, Badge, Form } from 'react-bootstrap';
import {
  GradeCard,
  GradeBadge,
  ArchetypeTag,
  OpportunityBadge,
  MetricRow,
  QuadrantDisplay,
  HHIDisplay,
  TAMDisplay,
  SupplyGapDisplay,
  ThroughputDisplay,
  PACPenetrationDisplay,
  CARE_TYPES
} from '../../components/MarketGrading';
import {
  getMarketDetail,
  getMarketFacilities,
  formatCurrency,
  formatPercent
} from '../../api/marketGradingService';

const MarketDetailPage = () => {
  const { cbsaCode } = useParams();
  const navigate = useNavigate();

  // Market data
  const [marketData, setMarketData] = useState(null);
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [facilitiesLoading, setFacilitiesLoading] = useState(false);
  const [error, setError] = useState(null);

  // UI state
  const [activeTab, setActiveTab] = useState('demographics');
  const [facilityFilter, setFacilityFilter] = useState('all');

  // Fetch market data
  const fetchMarketData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getMarketDetail(cbsaCode);
      setMarketData(data);
    } catch (err) {
      console.error('Failed to fetch market data:', err);
      setError(err.message || 'Failed to load market data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [cbsaCode]);

  // Fetch facilities when tab changes or filter changes
  const fetchFacilities = useCallback(async () => {
    if (activeTab !== 'facilities') return;

    setFacilitiesLoading(true);
    try {
      const data = await getMarketFacilities(cbsaCode, facilityFilter, 'name', 100);
      setFacilities(data);
    } catch (err) {
      console.error('Failed to fetch facilities:', err);
      setFacilities([]);
    } finally {
      setFacilitiesLoading(false);
    }
  }, [cbsaCode, activeTab, facilityFilter]);

  useEffect(() => {
    fetchMarketData();
  }, [fetchMarketData]);

  useEffect(() => {
    fetchFacilities();
  }, [fetchFacilities]);

  // Navigation handlers
  const handleBackClick = () => {
    if (marketData?.state) {
      navigate(`/market-grading/state/${marketData.state}`);
    } else {
      navigate('/market-grading');
    }
  };

  const handleRetry = () => {
    fetchMarketData();
  };

  const handleNearbyMarketClick = (nearbyCode) => {
    navigate(`/market-grading/market/${nearbyCode}`);
  };

  const handleFacilityClick = (facility) => {
    // Navigate to facility profile if exists
    if (facility.ccn) {
      window.open(`/facility/${facility.ccn}`, '_blank');
    }
  };

  // Export data as JSON
  const handleExport = () => {
    if (!marketData) return;

    const exportData = {
      market: {
        cbsa_code: marketData.cbsa_code,
        name: marketData.name,
        state: marketData.state,
        grades: marketData.grades,
        scores: marketData.scores,
        rankings: marketData.rankings,
        archetype: marketData.archetype
      },
      demographics: marketData.demographics,
      snf: marketData.snf,
      hha: marketData.hha,
      alf: marketData.alf,
      competition: marketData.competition,
      tam: marketData.tam,
      exported_at: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `market-${cbsaCode}-${marketData.name.replace(/\s+/g, '-').toLowerCase()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Styles
  const pageStyle = {
    minHeight: '100vh',
    backgroundColor: '#f9fafb',
    paddingTop: 24,
    paddingBottom: 48
  };

  const backLinkStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 14,
    color: '#3b82f6',
    textDecoration: 'none',
    marginBottom: 20,
    cursor: 'pointer'
  };

  const headerStyle = {
    marginBottom: 24
  };

  const headerTopStyle = {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 8
  };

  const titleStyle = {
    fontSize: 32,
    fontWeight: 700,
    color: '#111827',
    margin: 0
  };

  const subtitleStyle = {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 0
  };

  const gradeCardsContainerStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 16,
    marginBottom: 24
  };

  const opportunitiesRowStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 24,
    marginBottom: 24,
    flexWrap: 'wrap'
  };

  const opportunityLabelStyle = {
    fontSize: 14,
    color: '#6b7280',
    marginRight: 8
  };

  const sectionStyle = {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    border: '1px solid #e5e7eb',
    padding: 20,
    marginBottom: 20
  };

  const sectionTitleStyle = {
    fontSize: 16,
    fontWeight: 600,
    color: '#111827',
    marginBottom: 16
  };

  const loadingContainerStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 400,
    gap: 16
  };

  const tabContentStyle = {
    padding: '20px 0'
  };

  const metricsGridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: 20
  };

  const nearbyMarketStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 0',
    borderBottom: '1px solid #f3f4f6',
    cursor: 'pointer'
  };

  const facilityRowStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 0',
    borderBottom: '1px solid #f3f4f6',
    cursor: 'pointer'
  };

  const facilityTypeColors = {
    snf: '#8b5cf6',
    hha: '#f59e0b',
    alf: '#06b6d4'
  };

  // Loading state
  if (loading) {
    return (
      <div style={pageStyle}>
        <Container>
          <div style={backLinkStyle} onClick={handleBackClick}>
            ← Back
          </div>
          <div style={sectionStyle}>
            <div style={loadingContainerStyle}>
              <Spinner animation="border" variant="primary" />
              <span style={{ fontSize: 14, color: '#6b7280' }}>Loading market data...</span>
            </div>
          </div>
        </Container>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div style={pageStyle}>
        <Container>
          <div style={backLinkStyle} onClick={handleBackClick}>
            ← Back
          </div>
          <div style={sectionStyle}>
            <div style={loadingContainerStyle}>
              <Alert variant="danger" className="mb-3">
                <Alert.Heading>Error Loading Data</Alert.Heading>
                <p className="mb-0">{error}</p>
              </Alert>
              <Button variant="primary" onClick={handleRetry}>
                Retry
              </Button>
            </div>
          </div>
        </Container>
      </div>
    );
  }

  // Get state name for back link
  const backLabel = marketData?.state ? `← ${marketData.state}` : '← Back';

  // Render Demographics Tab
  const renderDemographicsTab = () => {
    const demo = marketData?.demographics || {};
    return (
      <div style={metricsGridStyle}>
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>Population</div>
          <MetricRow
            label="Total Population"
            value={demo.pop_total?.toLocaleString() || 'N/A'}
          />
          <MetricRow
            label="Population 65+"
            value={demo.pop_65_plus?.toLocaleString() || 'N/A'}
            comparison={{ value: formatPercent(demo.pop_65_pct), direction: 'neutral' }}
          />
          <MetricRow
            label="Population 85+"
            value={demo.pop_85_plus?.toLocaleString() || 'N/A'}
          />
          <MetricRow
            label="65+ Growth (5yr)"
            value={formatPercent(demo.pop_65_growth_5yr)}
            comparison={{ direction: demo.pop_65_growth_5yr > 0.15 ? 'up' : 'neutral' }}
          />
        </div>
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>Economics</div>
          <MetricRow
            label="Median Household Income"
            value={formatCurrency(demo.median_household_income)}
          />
          <MetricRow
            label="Median Home Value"
            value={formatCurrency(demo.median_home_value)}
          />
        </div>
      </div>
    );
  };

  // Render SNF Tab
  const renderSNFTab = () => {
    const snf = marketData?.snf || {};
    return (
      <div style={metricsGridStyle}>
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>SNF Overview</div>
          <MetricRow label="Facilities" value={snf.facility_count?.toLocaleString() || 'N/A'} />
          <MetricRow label="Total Beds" value={snf.total_beds?.toLocaleString() || 'N/A'} />
          <MetricRow label="Beds per 1K 65+" value={snf.beds_per_1k_65?.toFixed(1) || 'N/A'} />
          <MetricRow
            label="Avg Occupancy"
            value={formatPercent(snf.avg_occupancy)}
            comparison={{ direction: snf.avg_occupancy > 0.8 ? 'up' : snf.avg_occupancy < 0.7 ? 'down' : 'neutral' }}
          />
          <MetricRow label="Avg Star Rating" value={snf.avg_overall_rating?.toFixed(1) || 'N/A'} />
        </div>
        {snf.quadrant_distribution && (
          <QuadrantDisplay
            data={{
              'Growth + Competitive': snf.quadrant_distribution.growth_competitive || 0,
              'Growth + Concentrated': snf.quadrant_distribution.growth_concentrated || 0,
              'Stable + Competitive': snf.quadrant_distribution.stable_competitive || 0,
              'Stable + Concentrated': snf.quadrant_distribution.stable_concentrated || 0
            }}
            title="SNF Market Position"
          />
        )}
      </div>
    );
  };

  // Render HHA Tab
  const renderHHATab = () => {
    const hha = marketData?.hha || {};
    const demo = marketData?.demographics || {};

    // Calculate capture metrics
    const estimatedDischarges = Math.round((demo.pop_65_plus || 100000) * 0.04); // ~4% annual discharge rate
    const captureRatio = estimatedDischarges > 0 ? Math.min(1, (hha.total_episodes || 0) / estimatedDischarges) : 0.5;

    return (
      <div style={metricsGridStyle}>
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>HHA Overview</div>
          <MetricRow label="Agencies" value={hha.agency_count?.toLocaleString() || 'N/A'} />
          <MetricRow label="Total Episodes" value={hha.total_episodes?.toLocaleString() || 'N/A'} />
          <MetricRow label="Episodes per 1K 65+" value={hha.episodes_per_1k_65?.toFixed(1) || 'N/A'} />
          <MetricRow label="Avg Quality Rating" value={hha.avg_quality_rating?.toFixed(1) || 'N/A'} />
        </div>
        <ThroughputDisplay
          captureRatio={captureRatio}
          capturePct={Math.round(captureRatio * 100)}
          uncapturedPct={Math.round((1 - captureRatio) * 100)}
          dischargesPerAgency={hha.agency_count ? Math.round((hha.total_episodes || 0) / hha.agency_count) : 0}
          signal={captureRatio > 0.6 ? 'saturated' : captureRatio > 0.4 ? 'moderate' : 'opportunity'}
          ranking={{
            rank: marketData?.rankings?.state?.rank || 1,
            total: marketData?.rankings?.state?.total || 10
          }}
        />
      </div>
    );
  };

  // Render ALF Tab
  const renderALFTab = () => {
    const alf = marketData?.alf || {};
    const demo = marketData?.demographics || {};

    const alNeed = Math.round((demo.pop_65_plus || 100000) * 0.022);
    const currentCapacity = alf.total_capacity || 1000;
    const coverageRatio = alNeed > 0 ? (currentCapacity / alNeed) * 100 : 0;
    const bedsNeeded = Math.max(0, alNeed - currentCapacity);

    return (
      <div style={metricsGridStyle}>
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>ALF Overview</div>
          <MetricRow label="Facilities" value={alf.facility_count?.toLocaleString() || 'N/A'} />
          <MetricRow label="Total Capacity" value={alf.total_capacity?.toLocaleString() || 'N/A'} />
          <MetricRow label="Capacity per 1K 65+" value={alf.capacity_per_1k_65?.toFixed(1) || 'N/A'} />
          <MetricRow
            label="Supply Gap"
            value={formatPercent(alf.supply_gap)}
            comparison={{ direction: alf.supply_gap > 0.1 ? 'up' : 'down' }}
          />
        </div>
        <SupplyGapDisplay
          alNeed={alNeed}
          currentCapacity={currentCapacity}
          coverageRatio={coverageRatio}
          bedsNeeded={bedsNeeded}
          ranking={{
            rank: marketData?.rankings?.state?.rank || 1,
            total: marketData?.rankings?.state?.total || 10,
            context: 'in state'
          }}
        />
      </div>
    );
  };

  // Render Competition Tab
  const renderCompetitionTab = () => {
    const comp = marketData?.competition || {};
    const snfComp = comp.snf || {};
    const hhaComp = comp.hha || {};

    return (
      <div style={metricsGridStyle}>
        <HHIDisplay
          hhi={snfComp.hhi || 1500}
          level={snfComp.level || 'Moderate'}
          top3Share={(snfComp.top3_share || 0.35) * 100}
          operatorCount={snfComp.operator_count || 10}
          careType="SNF"
        />
        <HHIDisplay
          hhi={hhaComp.hhi || 1800}
          level={hhaComp.level || 'Moderate'}
          top3Share={(hhaComp.top3_share || 0.40) * 100}
          operatorCount={hhaComp.operator_count || 8}
          careType="HHA"
        />
      </div>
    );
  };

  // Render TAM Tab
  const renderTAMTab = () => {
    const tam = marketData?.tam || {};
    const snf = marketData?.snf || {};
    const alf = marketData?.alf || {};
    const hha = marketData?.hha || {};

    return (
      <div style={metricsGridStyle}>
        <TAMDisplay
          snfMedicare={tam.snf_medicare || 0}
          snfMedicaid={tam.snf_medicaid || 0}
          hhaMedicare={tam.hha_medicare || 0}
          totalPac={tam.total || 0}
          rankings={{
            state: { rank: marketData?.rankings?.state?.rank || 1, total: marketData?.rankings?.state?.total || 10 },
            national: { rank: marketData?.rankings?.national?.rank || 100, total: 879 }
          }}
          perFacility={{
            snf: snf.facility_count ? Math.round((tam.snf_medicare || 0) / snf.facility_count) : 0,
            hha: hha.agency_count ? Math.round((tam.hha_medicare || 0) / hha.agency_count) : 0
          }}
        />
        <PACPenetrationDisplay
          index={marketData?.scores?.overall || 50}
          snfComponent={snf.beds_per_1k_65 || 20}
          alfComponent={alf.capacity_per_1k_65 || 25}
          hhaComponent={hha.episodes_per_1k_65 || 90}
          ranking={{
            national: { rank: marketData?.rankings?.national?.rank || 100, total: 879 },
            state: { rank: marketData?.rankings?.state?.rank || 1, total: marketData?.rankings?.state?.total || 10 }
          }}
        />
      </div>
    );
  };

  // Render Facilities Tab
  const renderFacilitiesTab = () => {
    return (
      <div>
        {/* Filter */}
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 14, color: '#6b7280' }}>Filter:</span>
          <Form.Select
            size="sm"
            value={facilityFilter}
            onChange={(e) => setFacilityFilter(e.target.value)}
            style={{ width: 150 }}
          >
            <option value="all">All Types</option>
            <option value="snf">SNF Only</option>
            <option value="hha">HHA Only</option>
            <option value="alf">ALF Only</option>
          </Form.Select>
        </div>

        {/* Facility list */}
        {facilitiesLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spinner animation="border" size="sm" />
          </div>
        ) : facilities.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
            No facilities found for this filter.
          </div>
        ) : (
          <div style={sectionStyle}>
            {facilities.map((facility, idx) => (
              <div
                key={facility.ccn || idx}
                style={facilityRowStyle}
                onClick={() => handleFacilityClick(facility)}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, color: '#111827', marginBottom: 4 }}>
                    {facility.name}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    <Badge
                      bg="light"
                      text="dark"
                      style={{
                        backgroundColor: `${facilityTypeColors[facility.type]}20`,
                        color: facilityTypeColors[facility.type],
                        marginRight: 8
                      }}
                    >
                      {facility.type?.toUpperCase()}
                    </Badge>
                    {facility.beds && `${facility.beds} beds`}
                    {facility.capacity && `${facility.capacity} capacity`}
                    {facility.owner && ` • ${facility.owner}`}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {(facility.overall_rating || facility.quality_rating) && (
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>
                      {(facility.overall_rating || facility.quality_rating).toFixed(1)} ★
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={pageStyle}>
      <Container>
        {/* Back link */}
        <div style={backLinkStyle} onClick={handleBackClick}>
          {backLabel}
        </div>

        {/* Header */}
        <div style={headerStyle}>
          <div style={headerTopStyle}>
            <div>
              <h1 style={titleStyle}>
                {marketData?.name}, {marketData?.state}
              </h1>
              <p style={subtitleStyle}>
                CBSA: {marketData?.cbsa_code}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {marketData?.archetype && (
                <ArchetypeTag archetype={marketData.archetype} />
              )}
              <Button variant="outline-secondary" size="sm" onClick={handleExport}>
                Export
              </Button>
            </div>
          </div>
        </div>

        {/* Grade Cards */}
        <div style={gradeCardsContainerStyle}>
          <GradeCard
            type="Overall"
            grade={marketData?.grades?.overall || 'C'}
            score={marketData?.scores?.overall || 50}
            nationalRank={marketData?.rankings?.national?.rank || 0}
            nationalTotal={marketData?.rankings?.national?.total || 879}
            stateRank={marketData?.rankings?.state?.rank}
            stateTotal={marketData?.rankings?.state?.total}
            stateName={marketData?.state}
          />
          <GradeCard
            type="SNF"
            grade={marketData?.grades?.snf || 'C'}
            score={marketData?.scores?.snf || 50}
            nationalRank={marketData?.rankings?.national?.rank || 0}
            nationalTotal={marketData?.rankings?.national?.total || 879}
          />
          <GradeCard
            type="ALF"
            grade={marketData?.grades?.alf || 'C'}
            score={marketData?.scores?.alf || 50}
            nationalRank={marketData?.rankings?.national?.rank || 0}
            nationalTotal={marketData?.rankings?.national?.total || 879}
          />
          <GradeCard
            type="HHA"
            grade={marketData?.grades?.hha || 'C'}
            score={marketData?.scores?.hha || 50}
            nationalRank={marketData?.rankings?.national?.rank || 0}
            nationalTotal={marketData?.rankings?.national?.total || 879}
          />
        </div>

        {/* Opportunities */}
        <div style={opportunitiesRowStyle}>
          <div>
            <span style={opportunityLabelStyle}>Primary Opportunity:</span>
            {marketData?.primary_opportunity && (
              <OpportunityBadge type={marketData.primary_opportunity} variant="primary" />
            )}
          </div>
          <div>
            <span style={opportunityLabelStyle}>Secondary Opportunity:</span>
            {marketData?.secondary_opportunity && (
              <OpportunityBadge type={marketData.secondary_opportunity} variant="secondary" />
            )}
          </div>
        </div>

        <Row>
          <Col lg={9}>
            {/* Metrics Tabs */}
            <div style={sectionStyle}>
              <Tab.Container activeKey={activeTab} onSelect={setActiveTab}>
                <Nav variant="tabs" className="mb-3">
                  <Nav.Item>
                    <Nav.Link eventKey="demographics">Demographics</Nav.Link>
                  </Nav.Item>
                  <Nav.Item>
                    <Nav.Link eventKey="snf">SNF</Nav.Link>
                  </Nav.Item>
                  <Nav.Item>
                    <Nav.Link eventKey="hha">HHA</Nav.Link>
                  </Nav.Item>
                  <Nav.Item>
                    <Nav.Link eventKey="alf">ALF</Nav.Link>
                  </Nav.Item>
                  <Nav.Item>
                    <Nav.Link eventKey="competition">Competition</Nav.Link>
                  </Nav.Item>
                  <Nav.Item>
                    <Nav.Link eventKey="tam">TAM</Nav.Link>
                  </Nav.Item>
                  <Nav.Item>
                    <Nav.Link eventKey="facilities">Facilities</Nav.Link>
                  </Nav.Item>
                </Nav>
                <Tab.Content>
                  <Tab.Pane eventKey="demographics">
                    <div style={tabContentStyle}>{renderDemographicsTab()}</div>
                  </Tab.Pane>
                  <Tab.Pane eventKey="snf">
                    <div style={tabContentStyle}>{renderSNFTab()}</div>
                  </Tab.Pane>
                  <Tab.Pane eventKey="hha">
                    <div style={tabContentStyle}>{renderHHATab()}</div>
                  </Tab.Pane>
                  <Tab.Pane eventKey="alf">
                    <div style={tabContentStyle}>{renderALFTab()}</div>
                  </Tab.Pane>
                  <Tab.Pane eventKey="competition">
                    <div style={tabContentStyle}>{renderCompetitionTab()}</div>
                  </Tab.Pane>
                  <Tab.Pane eventKey="tam">
                    <div style={tabContentStyle}>{renderTAMTab()}</div>
                  </Tab.Pane>
                  <Tab.Pane eventKey="facilities">
                    <div style={tabContentStyle}>{renderFacilitiesTab()}</div>
                  </Tab.Pane>
                </Tab.Content>
              </Tab.Container>
            </div>
          </Col>

          <Col lg={3}>
            {/* Nearby Markets */}
            {marketData?.nearby_markets?.length > 0 && (
              <div style={sectionStyle}>
                <div style={sectionTitleStyle}>Nearby Markets</div>
                {marketData.nearby_markets.map((nearby) => (
                  <div
                    key={nearby.cbsa_code}
                    style={nearbyMarketStyle}
                    onClick={() => handleNearbyMarketClick(nearby.cbsa_code)}
                  >
                    <div>
                      <div style={{ fontWeight: 500, color: '#374151', marginBottom: 2 }}>
                        {nearby.name}
                      </div>
                      <div style={{ fontSize: 12, color: '#9ca3af' }}>
                        {nearby.distance_miles} miles
                      </div>
                    </div>
                    <GradeBadge grade={nearby.grade} size="sm" />
                  </div>
                ))}
              </div>
            )}

            {/* TAM Summary */}
            <div style={sectionStyle}>
              <div style={sectionTitleStyle}>TAM Summary</div>
              <MetricRow
                label="Total PAC TAM"
                value={marketData?.tam?.formatted || formatCurrency(marketData?.tam?.total, true)}
              />
              <MetricRow
                label="National Rank"
                value={`#${marketData?.rankings?.national?.rank || '-'} / ${marketData?.rankings?.national?.total || '-'}`}
              />
            </div>
          </Col>
        </Row>
      </Container>
    </div>
  );
};

export default MarketDetailPage;
