/**
 * NationalMapView.jsx
 *
 * Main entry point/landing page for the Market Grading feature.
 * Displays a US choropleth map with states colored by score.
 *
 * Features:
 * - Interactive US map colored by state average grade
 * - Score type toggle (Overall, SNF, ALF, HHA)
 * - Hover cards showing state summaries
 * - Click-to-navigate to StateDetailPage
 * - Gradient legend showing score-to-color mapping
 *
 * Route: /market-grading
 *
 * API calls:
 * - getNationalMapData(scoreType) - on mount and scoreType change
 * - getStateSummary(stateCode) - on hover
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Row, Col, Spinner, Alert, Button } from 'react-bootstrap';
import {
  ScoreTypeToggle,
  GradientLegend,
  USChoroplethMap,
  StateHoverCard
} from '../../components/MarketGrading';
import {
  getNationalMapData,
  getStateSummary
} from '../../api/marketGradingService';

const NationalMapView = () => {
  const navigate = useNavigate();

  // Score type selection
  const [scoreType, setScoreType] = useState('overall');

  // National map data
  const [nationalData, setNationalData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Hover state
  const [hoveredState, setHoveredState] = useState(null);
  const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });
  const [hoverData, setHoverData] = useState(null);
  const [hoverLoading, setHoverLoading] = useState(false);

  // Ref for tracking hover requests
  const hoverAbortRef = useRef(null);

  // Fetch national map data
  const fetchNationalData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getNationalMapData(scoreType);
      setNationalData(data);
    } catch (err) {
      console.error('Failed to fetch national map data:', err);
      setError(err.message || 'Failed to load map data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [scoreType]);

  // Fetch on mount and when scoreType changes
  useEffect(() => {
    fetchNationalData();
  }, [fetchNationalData]);

  // Fetch state summary on hover
  useEffect(() => {
    if (!hoveredState) {
      setHoverData(null);
      return;
    }

    let cancelled = false;
    setHoverLoading(true);

    const fetchHoverData = async () => {
      try {
        const data = await getStateSummary(hoveredState);
        if (!cancelled) {
          setHoverData(data);
          setHoverLoading(false);
        }
      } catch (err) {
        console.error('Failed to fetch state summary:', err);
        if (!cancelled) {
          setHoverData(null);
          setHoverLoading(false);
        }
      }
    };

    fetchHoverData();

    return () => {
      cancelled = true;
    };
  }, [hoveredState]);

  // Handle state click - navigate to state detail
  const handleStateClick = (stateCode) => {
    navigate(`/market-grading/state/${stateCode}`);
  };

  // Handle state hover
  const handleStateHover = (stateCode, event) => {
    setHoveredState(stateCode);
    if (event && stateCode) {
      setHoverPosition({
        x: event.clientX,
        y: event.clientY
      });
    }
  };

  // Handle score type change
  const handleScoreTypeChange = (newType) => {
    setScoreType(newType);
  };

  // Retry button handler
  const handleRetry = () => {
    fetchNationalData();
  };

  // Prepare map data
  const mapData = nationalData?.states?.map(state => ({
    stateCode: state.state_code,
    score: state.scores[scoreType],
    grade: state.grades[scoreType]
  })) || [];

  // Container styles
  const pageStyle = {
    minHeight: '100vh',
    backgroundColor: '#f9fafb',
    paddingTop: 24,
    paddingBottom: 48
  };

  const headerStyle = {
    marginBottom: 24
  };

  const titleStyle = {
    fontSize: 28,
    fontWeight: 700,
    color: '#111827',
    marginBottom: 8
  };

  const subtitleStyle = {
    fontSize: 15,
    color: '#6b7280',
    marginBottom: 0
  };

  const controlsRowStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 20
  };

  const mapContainerStyle = {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    border: '1px solid #e5e7eb',
    padding: '16px 8px',
    marginBottom: 20,
    position: 'relative',
    minHeight: '70vh'
  };

  const legendContainerStyle = {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: 20
  };

  const hintStyle = {
    textAlign: 'center',
    fontSize: 14,
    color: '#9ca3af',
    fontStyle: 'italic'
  };

  const metricCardStyle = {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    border: '1px solid #e5e7eb',
    padding: '12px 16px',
    textAlign: 'center'
  };

  const metricLabelStyle = {
    fontSize: 11,
    fontWeight: 500,
    color: '#6b7280',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  };

  const metricValueStyle = {
    fontSize: 18,
    fontWeight: 700,
    color: '#111827'
  };

  const loadingContainerStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 400,
    gap: 16
  };

  const loadingTextStyle = {
    fontSize: 14,
    color: '#6b7280'
  };

  // Render loading state
  if (loading) {
    return (
      <div style={pageStyle}>
        <Container>
          <div style={headerStyle}>
            <h1 style={titleStyle}>Market Analysis</h1>
            <p style={subtitleStyle}>National overview of Post-Acute Care markets</p>
          </div>
          <div style={mapContainerStyle}>
            <div style={loadingContainerStyle}>
              <Spinner animation="border" variant="primary" />
              <span style={loadingTextStyle}>Loading market data...</span>
            </div>
          </div>
        </Container>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div style={pageStyle}>
        <Container>
          <div style={headerStyle}>
            <h1 style={titleStyle}>Market Analysis</h1>
            <p style={subtitleStyle}>National overview of Post-Acute Care markets</p>
          </div>
          <div style={mapContainerStyle}>
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

  return (
    <div style={pageStyle}>
      <Container>
        {/* Header */}
        <div style={headerStyle}>
          <h1 style={titleStyle}>Market Analysis</h1>
          <p style={subtitleStyle}>National overview of Post-Acute Care markets</p>
        </div>

        {/* Controls */}
        <div style={controlsRowStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: '#374151' }}>
              Score View:
            </span>
            <ScoreTypeToggle
              value={scoreType}
              onChange={handleScoreTypeChange}
            />
          </div>
        </div>

        {/* National Metrics */}
        {nationalData?.national_metrics && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: 12,
            marginBottom: 20
          }}>
            <div style={metricCardStyle}>
              <div style={metricLabelStyle}>Beds per 1K 65+</div>
              <div style={metricValueStyle}>{nationalData.national_metrics.beds_per_1k_65}</div>
            </div>
            <div style={metricCardStyle}>
              <div style={metricLabelStyle}>HHA per 1K 65+</div>
              <div style={metricValueStyle}>{nationalData.national_metrics.hha_per_1k_65}</div>
            </div>
            <div style={metricCardStyle}>
              <div style={metricLabelStyle}>Avg Star Rating</div>
              <div style={metricValueStyle}>{nationalData.national_metrics.avg_star_rating} ★</div>
            </div>
            <div style={metricCardStyle}>
              <div style={metricLabelStyle}>SNF TAM</div>
              <div style={metricValueStyle}>${(nationalData.national_metrics.snf_tam / 1e9).toFixed(1)}B</div>
            </div>
            <div style={metricCardStyle}>
              <div style={metricLabelStyle}>Timely Initiation</div>
              <div style={metricValueStyle}>{(nationalData.national_metrics.timely_initiation_pct * 100).toFixed(1)}%</div>
            </div>
            <div style={metricCardStyle}>
              <div style={metricLabelStyle}>Pop 65+ Share</div>
              <div style={metricValueStyle}>{(nationalData.national_metrics.pop_65_plus_pct * 100).toFixed(1)}%</div>
            </div>
          </div>
        )}

        {/* Map */}
        <div style={mapContainerStyle}>
          <USChoroplethMap
            data={mapData}
            scoreType={scoreType}
            scale={nationalData?.scale || { min: 30, max: 70, median: 50 }}
            onStateClick={handleStateClick}
            onStateHover={handleStateHover}
            hoveredState={hoveredState}
          />

          {/* Hover card */}
          {hoveredState && hoverData && (
            <StateHoverCard
              stateCode={hoverData.state_code}
              stateName={hoverData.state_name}
              grades={hoverData.grades}
              highlights={{
                marketCount: hoverData.highlights.market_count,
                totalTam: hoverData.highlights.total_tam,
                topMarket: hoverData.highlights.top_market,
                archetypeDominant: hoverData.highlights.archetype_dominant
              }}
              position={hoverPosition}
            />
          )}
        </div>

        {/* Legend */}
        <div style={legendContainerStyle}>
          <GradientLegend
            min={nationalData?.scale?.min || 30}
            max={nationalData?.scale?.max || 70}
          />
        </div>

        {/* Hint */}
        <p style={hintStyle}>
          Click a state to view detailed market analysis
        </p>
      </Container>
    </div>
  );
};

export default NationalMapView;
