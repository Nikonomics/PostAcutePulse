/**
 * StateDetailPage.jsx
 *
 * Full state detail view with map of CBSAs/counties and aggregated metrics.
 *
 * Features:
 * - State summary with grade cards
 * - Interactive state map with CBSA markers
 * - Top markets list and grade distribution
 * - Tabbed metric sections (Demographics, SNF, HHA, ALF, Competition, TAM)
 * - Click-to-navigate to market detail
 *
 * Route: /market-grading/state/:stateCode
 *
 * API calls:
 * - getStateDetail(stateCode)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Container, Row, Col, Spinner, Alert, Button, Nav, Tab } from 'react-bootstrap';
import {
  GradeCard,
  ScoreTypeToggle,
  ArchetypeTag,
  OpportunityBadge,
  GradeBadge,
  TopMarketsList,
  GradeDistributionChart,
  MetricRow,
  QuadrantDisplay,
  HHIDisplay,
  TAMDisplay,
  SupplyGapDisplay,
  ThroughputDisplay,
  PACPenetrationDisplay,
  StateChoroplethMap,
  CARE_TYPES
} from '../../components/MarketGrading';
import {
  getStateDetail,
  formatCurrency,
  formatPercent
} from '../../api/marketGradingService';

const StateDetailPage = () => {
  const { stateCode } = useParams();
  const navigate = useNavigate();

  // State data
  const [stateData, setStateData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // UI state
  const [scoreType, setScoreType] = useState('overall');
  const [activeTab, setActiveTab] = useState('demographics');

  // Fetch state data
  const fetchStateData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getStateDetail(stateCode);
      setStateData(data);
    } catch (err) {
      console.error('Failed to fetch state data:', err);
      setError(err.message || 'Failed to load state data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [stateCode]);

  useEffect(() => {
    fetchStateData();
  }, [fetchStateData]);

  // Navigation handlers
  const handleMarketClick = (cbsaCode) => {
    navigate(`/market-grading/market/${cbsaCode}`);
  };

  const handleBackClick = () => {
    navigate('/market-grading');
  };

  const handleRetry = () => {
    fetchStateData();
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
    fontSize: 15,
    color: '#6b7280',
    marginBottom: 0
  };

  const gradeCardsContainerStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 12,
    marginBottom: 24
  };

  // Responsive: 2 columns on smaller screens
  const gradeCardsResponsiveStyle = `
    @media (max-width: 768px) {
      .grade-cards-container {
        grid-template-columns: repeat(2, 1fr) !important;
      }
    }
  `;

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

  // Loading state
  if (loading) {
    return (
      <div style={pageStyle}>
        <Container>
          <div style={backLinkStyle} onClick={handleBackClick}>
            ← Back to National Map
          </div>
          <div style={sectionStyle}>
            <div style={loadingContainerStyle}>
              <Spinner animation="border" variant="primary" />
              <span style={{ fontSize: 14, color: '#6b7280' }}>Loading state data...</span>
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
            ← Back to National Map
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

  // Prepare data for components
  const gradeDistribution = stateData?.summary?.grade_distribution || {};
  const simplifiedDistribution = {
    A: (gradeDistribution['A+'] || 0) + (gradeDistribution['A'] || 0),
    B: (gradeDistribution['B+'] || 0) + (gradeDistribution['B'] || 0),
    C: gradeDistribution['C'] || 0,
    D: gradeDistribution['D'] || 0,
    F: gradeDistribution['F'] || 0
  };

  const topMarkets = stateData?.top_markets || [];

  // Render Demographics Tab
  const renderDemographicsTab = () => {
    const demo = stateData?.demographics || {};
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
    const snf = stateData?.snf || {};
    const quadrantData = snf.quadrant_distribution || {};
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
        <QuadrantDisplay
          data={{
            'Growth + Competitive': quadrantData.growth_competitive || 0,
            'Growth + Concentrated': quadrantData.growth_concentrated || 0,
            'Stable + Competitive': quadrantData.stable_competitive || 0,
            'Stable + Concentrated': quadrantData.stable_concentrated || 0
          }}
          title="SNF Market Quadrants"
        />
      </div>
    );
  };

  // Render HHA Tab
  const renderHHATab = () => {
    const hha = stateData?.hha || {};
    return (
      <div style={metricsGridStyle}>
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>HHA Overview</div>
          <MetricRow label="Agencies" value={hha.agency_count?.toLocaleString() || 'N/A'} />
          <MetricRow label="Total Episodes" value={hha.total_episodes?.toLocaleString() || 'N/A'} />
          <MetricRow label="Episodes per 1K 65+" value={hha.episodes_per_1k_65?.toFixed(1) || 'N/A'} />
          <MetricRow label="Avg Quality Rating" value={hha.avg_quality_rating?.toFixed(1) || 'N/A'} />
        </div>
        {hha.capture_ratio !== undefined && (
          <ThroughputDisplay
            captureRatio={hha.capture_ratio || 0.5}
            capturePct={Math.round((hha.capture_ratio || 0.5) * 100)}
            uncapturedPct={Math.round((1 - (hha.capture_ratio || 0.5)) * 100)}
            dischargesPerAgency={hha.discharges_per_agency || 500}
            signal={hha.capture_ratio > 0.6 ? 'saturated' : hha.capture_ratio > 0.4 ? 'moderate' : 'opportunity'}
            ranking={{ rank: 1, total: stateData?.summary?.cbsa_count || 10 }}
          />
        )}
      </div>
    );
  };

  // Render ALF Tab
  const renderALFTab = () => {
    const alf = stateData?.alf || {};
    const demo = stateData?.demographics || {};

    // Calculate supply gap metrics
    const alNeed = Math.round((demo.pop_65_plus || 300000) * 0.022); // ~2.2% of 65+ need AL
    const currentCapacity = alf.total_capacity || 5000;
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
          ranking={{ rank: stateData?.rankings?.alf?.rank || 1, total: 51, context: 'nationally' }}
        />
      </div>
    );
  };

  // Render Competition Tab
  const renderCompetitionTab = () => {
    const comp = stateData?.competition || {};
    const snfComp = comp.snf || {};
    const hhaComp = comp.hha || {};

    return (
      <div style={metricsGridStyle}>
        <HHIDisplay
          hhi={snfComp.hhi || 1500}
          level={snfComp.level || 'Moderate'}
          top3Share={(snfComp.top3_share || 0.35) * 100}
          operatorCount={snfComp.operator_count || 20}
          careType="SNF"
        />
        <HHIDisplay
          hhi={hhaComp.hhi || 1800}
          level={hhaComp.level || 'Moderate'}
          top3Share={(hhaComp.top3_share || 0.40) * 100}
          operatorCount={hhaComp.operator_count || 15}
          careType="HHA"
        />
      </div>
    );
  };

  // Render TAM Tab
  const renderTAMTab = () => {
    const tam = stateData?.tam || {};
    const demo = stateData?.demographics || {};

    return (
      <div style={metricsGridStyle}>
        <TAMDisplay
          snfMedicare={tam.snf_medicare || 0}
          snfMedicaid={tam.snf_medicaid || 0}
          hhaMedicare={tam.hha_medicare || 0}
          totalPac={tam.total_pac || 0}
          rankings={{
            state: { rank: 1, total: 1 },
            national: { rank: tam.rankings?.national || 25, total: tam.rankings?.total || 51 }
          }}
        />
        <PACPenetrationDisplay
          index={stateData?.scores?.overall || 50}
          snfComponent={stateData?.snf?.beds_per_1k_65 || 20}
          alfComponent={stateData?.alf?.capacity_per_1k_65 || 25}
          hhaComponent={stateData?.hha?.episodes_per_1k_65 || 90}
          ranking={{
            national: { rank: stateData?.rankings?.overall?.rank || 25, total: 51 },
            state: { rank: 1, total: 1 }
          }}
        />
      </div>
    );
  };

  return (
    <div style={pageStyle}>
      <Container>
        {/* Back link */}
        <div style={backLinkStyle} onClick={handleBackClick}>
          ← Back to National Map
        </div>

        {/* Header */}
        <div style={headerStyle}>
          <div style={headerTopStyle}>
            <div>
              <h1 style={titleStyle}>{stateData?.state_name || stateCode}</h1>
              <p style={subtitleStyle}>
                {stateData?.summary?.cbsa_count || 0} CBSAs
                {stateData?.summary?.non_cbsa_county_count > 0 &&
                  ` + ${stateData.summary.non_cbsa_county_count} non-CBSA counties`
                }
              </p>
            </div>
            {stateData?.archetype && (
              <ArchetypeTag archetype={stateData.archetype} />
            )}
          </div>
        </div>

        {/* Grade Cards */}
        <style>{gradeCardsResponsiveStyle}</style>
        <div style={gradeCardsContainerStyle} className="grade-cards-container">
          <GradeCard
            type="Overall"
            grade={stateData?.grades?.overall || 'C'}
            score={stateData?.scores?.overall || 50}
            nationalRank={stateData?.rankings?.overall?.rank || 0}
            nationalTotal={stateData?.rankings?.overall?.total || 51}
            facilityCount={(stateData?.snf?.facility_count || 0) + (stateData?.alf?.facility_count || 0) + (stateData?.hha?.agency_count || 0)}
            tam={stateData?.tam?.total}
          />
          <GradeCard
            type="SNF"
            grade={stateData?.grades?.snf || 'C'}
            score={stateData?.scores?.snf || 50}
            nationalRank={stateData?.rankings?.snf?.rank || 0}
            nationalTotal={stateData?.rankings?.snf?.total || 51}
            facilityCount={stateData?.snf?.facility_count}
            tam={stateData?.tam?.snf}
          />
          <GradeCard
            type="ALF"
            grade={stateData?.grades?.alf || 'C'}
            score={stateData?.scores?.alf || 50}
            nationalRank={stateData?.rankings?.alf?.rank || 0}
            nationalTotal={stateData?.rankings?.alf?.total || 51}
            facilityCount={stateData?.alf?.facility_count}
            tam={stateData?.tam?.alf}
          />
          <GradeCard
            type="HHA"
            grade={stateData?.grades?.hha || 'C'}
            score={stateData?.scores?.hha || 50}
            nationalRank={stateData?.rankings?.hha?.rank || 0}
            nationalTotal={stateData?.rankings?.hha?.total || 51}
            facilityCount={stateData?.hha?.agency_count}
            tam={stateData?.tam?.hha}
          />
        </div>

        {/* Opportunities */}
        <div style={opportunitiesRowStyle}>
          <div>
            <span style={opportunityLabelStyle}>Primary Opportunity:</span>
            {stateData?.primary_opportunity && (
              <OpportunityBadge type="primary" careType={stateData.primary_opportunity} />
            )}
          </div>
          <div>
            <span style={opportunityLabelStyle}>Secondary Opportunity:</span>
            {stateData?.secondary_opportunity && (
              <OpportunityBadge type="secondary" careType={stateData.secondary_opportunity} />
            )}
          </div>
        </div>

        {/* Map and Sidebar */}
        <Row className="mb-4">
          <Col lg={8}>
            <div style={sectionStyle}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={sectionTitleStyle}>Market Map</div>
                <ScoreTypeToggle value={scoreType} onChange={setScoreType} size="sm" />
              </div>
              <StateChoroplethMap
                stateCode={stateCode}
                cbsas={(stateData?.map_data?.cbsas || []).map(cbsa => ({
                  cbsaCode: cbsa.cbsa_code,
                  name: cbsa.name,
                  score: cbsa.score,
                  grade: cbsa.grade,
                  countyFips: [],
                  center: { lat: cbsa.lat, lng: cbsa.lng }
                }))}
                nonCbsaCounties={(stateData?.map_data?.non_cbsa_counties || []).map(county => ({
                  countyFips: county.fips,
                  countyName: county.name,
                  score: county.score,
                  grade: county.grade,
                  center: { lat: county.lat, lng: county.lng }
                }))}
                scoreType={scoreType}
                onAreaClick={(code, type) => {
                  if (type === 'cbsa') {
                    navigate(`/market-grading/market/${code}`);
                  } else {
                    navigate(`/market-grading/county/${code}`);
                  }
                }}
                onAreaHover={() => {}}
              />
            </div>
          </Col>
          <Col lg={4}>
            <TopMarketsList
              markets={topMarkets}
              onMarketClick={handleMarketClick}
              title={`Top Markets in ${stateData?.state_name || stateCode}`}
              maxItems={5}
              onViewAll={() => navigate(`/market-grading/list?state=${stateCode}`)}
            />
            <div style={{ marginTop: 20 }}>
              <GradeDistributionChart
                distribution={simplifiedDistribution}
                title="Grade Distribution"
                showCounts={true}
                showPercentages={true}
              />
            </div>
          </Col>
        </Row>

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
            </Tab.Content>
          </Tab.Container>
        </div>
      </Container>
    </div>
  );
};

export default StateDetailPage;
