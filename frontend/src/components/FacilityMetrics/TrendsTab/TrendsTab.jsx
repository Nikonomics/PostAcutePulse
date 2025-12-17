import React from 'react';
import { TrendingUp } from 'lucide-react';
import RatingTrendsChart from './RatingTrendsChart';
import StaffingTrendsChart from './StaffingTrendsChart';
import TurnoverTrendsChart from './TurnoverTrendsChart';
import OccupancyTrendsChart from './OccupancyTrendsChart';
import DeficiencyHistoryChart from './DeficiencyHistoryChart';
import PenaltyTimelineChart from './PenaltyTimelineChart';

const TrendsTab = ({ facility }) => {
  if (!facility) {
    return (
      <div className="placeholder-tab">
        <TrendingUp size={48} strokeWidth={1.5} />
        <h3>Select a Facility</h3>
        <p>Use the search above to select a facility and view trends.</p>
      </div>
    );
  }

  // Use snapshots from facility object
  const historicalData = facility.snapshots || [];

  if (historicalData.length === 0) {
    return (
      <div className="placeholder-tab">
        <TrendingUp size={48} strokeWidth={1.5} />
        <h3>No Historical Data</h3>
        <p>Historical trend data is not available for this facility.</p>
      </div>
    );
  }

  return (
    <div className="trends-tab">
      <div className="trends-grid">
        <RatingTrendsChart data={historicalData} />
        <StaffingTrendsChart data={historicalData} />
        <TurnoverTrendsChart data={historicalData} />
        <OccupancyTrendsChart data={historicalData} />
        <DeficiencyHistoryChart data={historicalData} />
        <PenaltyTimelineChart data={historicalData} />
      </div>
    </div>
  );
};

export default TrendsTab;
