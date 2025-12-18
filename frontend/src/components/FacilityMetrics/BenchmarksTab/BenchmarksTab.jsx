import React, { useState, useEffect } from 'react';
import { BarChart3, Loader2 } from 'lucide-react';
import PeerGroupSelector from './PeerGroupSelector';
import PercentileRankingsCard from './PercentileRankingsCard';
import DistributionChart from './DistributionChart';
import { getFacilityPercentiles } from '../../../api/facilityService';

const BenchmarksTab = ({ facility }) => {
  const [filters, setFilters] = useState({
    scope: 'national',
    state: '',
    size: '',
  });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPercentiles = async () => {
      if (!facility?.ccn) {
        setData(null);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const response = await getFacilityPercentiles(facility.ccn, filters);
        if (response.success) {
          setData(response);
        } else {
          setError('Failed to load benchmark data');
        }
      } catch (err) {
        console.error('Failed to fetch percentiles:', err);
        setError('Failed to load benchmark data');
      } finally {
        setLoading(false);
      }
    };

    fetchPercentiles();
  }, [facility?.ccn, filters]);

  if (!facility) {
    return (
      <div className="placeholder-tab">
        <BarChart3 size={48} strokeWidth={1.5} />
        <h3>Select a Facility</h3>
        <p>Use the search above to select a facility and view benchmarks.</p>
      </div>
    );
  }

  return (
    <div className="benchmarks-tab">
      {/* Row 1: Peer Group Selector */}
      <PeerGroupSelector
        filters={filters}
        onChange={setFilters}
        peerGroup={data?.peer_group}
      />

      {loading && (
        <div className="benchmarks-loading">
          <Loader2 size={24} className="spinning" />
          <span>Loading benchmark data...</span>
        </div>
      )}

      {error && !loading && (
        <div className="benchmarks-error">
          {error}
        </div>
      )}

      {data && !loading && (
        <>
          {/* Row 2: Percentile Rankings Grid (3x2) */}
          <div className="percentile-cards-grid">
            <PercentileRankingsCard
              metricKey="overall_rating"
              data={data.percentiles?.overall_rating}
            />
            <PercentileRankingsCard
              metricKey="quality_rating"
              data={data.percentiles?.quality_rating}
            />
            <PercentileRankingsCard
              metricKey="staffing_rating"
              data={data.percentiles?.staffing_rating}
            />
            <PercentileRankingsCard
              metricKey="inspection_rating"
              data={data.percentiles?.inspection_rating}
            />
            <PercentileRankingsCard
              metricKey="rn_turnover"
              data={data.percentiles?.rn_turnover}
            />
            <PercentileRankingsCard
              metricKey="occupancy"
              data={data.percentiles?.occupancy}
            />
          </div>

          {/* Row 3: Distribution Charts */}
          <div className="distribution-charts-row">
            <DistributionChart
              metricKey="total_nursing_hprd"
              distribution={data.distributions?.total_nursing_hprd}
              facilityValue={data.percentiles?.total_nursing_hprd?.value}
            />
            <DistributionChart
              metricKey="deficiency_count"
              distribution={data.distributions?.deficiency_count}
              facilityValue={data.percentiles?.deficiency_count?.value}
            />
          </div>

          {/* Row 4: Additional Distribution Charts */}
          <div className="distribution-charts-row">
            <DistributionChart
              metricKey="rn_turnover"
              distribution={data.distributions?.rn_turnover}
              facilityValue={data.percentiles?.rn_turnover?.value}
            />
            <DistributionChart
              metricKey="occupancy"
              distribution={data.distributions?.occupancy}
              facilityValue={data.percentiles?.occupancy?.value}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default BenchmarksTab;
