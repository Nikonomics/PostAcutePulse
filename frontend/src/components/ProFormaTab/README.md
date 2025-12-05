# ProFormaTab Component

A comprehensive React component for displaying and editing pro forma analysis with real-time benchmark adjustments.

## Features

### 1. **Summary Cards**
- Total Opportunity: Shows aggregated improvement potential
- Stabilized EBITDA: Displays target EBITDA with current comparison
- Stabilized Margin: Shows target margin percentage
- Issues Count: Number of metrics above acceptable thresholds

### 2. **Interactive Pro Forma Table**

**Columns:**
- **Category**: Expense or revenue line item name
- **Actual**: Current value from extracted data
- **% Rev**: Percentage of total revenue
- **Benchmark**: Editable target value (inputs for key metrics)
- **Variance**: Difference between actual and benchmark (color-coded)
- **Opportunity**: Annual improvement potential

**Sections:**
- Revenue & Occupancy
- Labor Costs
- Other Operating Expenses
- Profitability Metrics

### 3. **Color-Coded Variance Indicators**

```css
.variance-on_target      /* Green - Meeting or exceeding target */
.variance-above_target   /* Yellow - Slightly above target */
.variance-critical       /* Red - Significantly above target */
.variance-below_target   /* Blue - Below target (for revenue/margins) */
```

**Status Logic:**
- **For expenses** (reversed logic): Lower is better
  - On Target: At or below benchmark
  - Above Target: 1-10% above benchmark
  - Critical: >10% above benchmark

- **For revenue/margins**: Higher is better
  - On Target: At or above benchmark
  - Below Target: 1-10% below benchmark
  - Critical: >10% below benchmark

### 4. **Editable Benchmarks**

Users can edit these benchmark values directly in the table:
- Occupancy Target (%)
- Labor % of Revenue Target
- Agency % of Labor Target
- Food Cost per Day Target ($)
- Management Fee % Target
- Bad Debt % Target
- Utilities % Target
- Insurance % Target
- EBITDA Margin Target (%)
- EBITDAR Margin Target (%)

### 5. **Scenario Management**
- Scenario name input field
- Save button to persist scenario to database
- Reset button to restore default benchmarks
- Load existing scenarios (via parent component)

### 6. **Opportunity Breakdown Table**

Displays detailed breakdown of each improvement opportunity:
- Category name
- Current value
- Target value
- Annual opportunity amount
- Description of the improvement

## Props

```jsx
<ProFormaTab
  deal={dealObject}
  extractionData={parsedExtractionData}
  onSaveScenario={handleSaveScenario}
/>
```

### `deal` (required)
Deal object from the API containing:
```javascript
{
  id: 123,
  deal_name: "Sunrise Senior Living",
  // ... other deal fields
}
```

### `extractionData` (required)
Parsed extraction data containing financial metrics:
```javascript
{
  annual_revenue: 5000000,
  t12m_revenue: 5000000,
  ebitda: 450000,
  ebitdar: 1150000,
  current_occupancy: 82,
  no_of_beds: 120,

  // Expense ratios
  labor_pct_of_revenue: 58.5,
  agency_pct_of_labor: 8.2,
  food_cost_per_resident_day: 12.50,
  management_fee_pct: 5.5,
  bad_debt_pct: 1.2,
  utilities_pct_of_revenue: 3.2,
  insurance_pct_of_revenue: 3.5,

  // ... other extracted fields
}
```

### `onSaveScenario` (required)
Callback function to save the scenario:
```javascript
const handleSaveScenario = async (scenarioData) => {
  // scenarioData contains:
  // {
  //   scenario_name: "Base Case",
  //   benchmarks: { occupancy_target: 85, ... },
  //   analysis: { total_opportunity: 350000, ... }
  // }

  await DealService.saveProformaScenario(dealId, scenarioData);
};
```

## State Management

### Local State

```javascript
const [benchmarks, setBenchmarks] = useState(DEFAULT_BENCHMARKS);
// User-editable benchmark values

const [analysis, setAnalysis] = useState(null);
// Calculated pro forma results from API

const [scenarioName, setScenarioName] = useState('Base Case');
// Current scenario name

const [isLoading, setIsLoading] = useState(false);
// Loading state during API calls

const [error, setError] = useState(null);
// Error message display

const [isSaving, setIsSaving] = useState(false);
// Saving state for save button
```

### Computed Values

```javascript
const currentFinancials = useMemo(() => {
  // Extract current metrics from extractionData
}, [extractionData]);

const summaryMetrics = useMemo(() => {
  // Calculate summary card values from analysis
}, [analysis, currentFinancials]);
```

## API Integration

### Required DealService Method

Add this method to your `DealService.js`:

```javascript
// src/api/DealService.js

const DealService = {
  // ... existing methods ...

  /**
   * Calculate pro forma analysis
   * @param {number} dealId - Deal ID
   * @param {object} params - Calculation parameters
   * @returns {Promise<object>} Pro forma analysis result
   */
  async calculateProforma(dealId, params) {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/deals/${dealId}/proforma/calculate`,
        params
      );
      return response.data;
    } catch (error) {
      console.error('Calculate proforma error:', error);
      throw error;
    }
  },

  /**
   * Save pro forma scenario
   * @param {number} dealId - Deal ID
   * @param {object} scenarioData - Scenario data to save
   * @returns {Promise<object>} Saved scenario
   */
  async saveProformaScenario(dealId, scenarioData) {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/deals/${dealId}/proforma/scenarios`,
        scenarioData
      );
      return response.data;
    } catch (error) {
      console.error('Save scenario error:', error);
      throw error;
    }
  },

  /**
   * Get all scenarios for a deal
   * @param {number} dealId - Deal ID
   * @returns {Promise<array>} Array of scenarios
   */
  async getProformaScenarios(dealId) {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/deals/${dealId}/proforma/scenarios`
      );
      return response.data;
    } catch (error) {
      console.error('Get scenarios error:', error);
      throw error;
    }
  }
};

export default DealService;
```

### Expected API Response Format

#### Calculate Proforma Response:

```json
{
  "total_opportunity": 350000,
  "stabilized_revenue": 5500000,
  "stabilized_ebitda": 495000,
  "stabilized_ebitdar": 1265000,
  "stabilized_noi": 450000,
  "opportunities": [
    {
      "category": "Labor Optimization",
      "current": 2925000,
      "target": 2750000,
      "opportunity": 175000,
      "unit": "$",
      "description": "Reduce labor to 55% of revenue from 58.5%"
    },
    {
      "category": "Occupancy Growth",
      "current": 82,
      "target": 85,
      "opportunity": 150000,
      "unit": "%",
      "description": "Increase occupancy from 82% to 85%"
    }
  ],
  "issues": [
    {
      "category": "Agency Staffing",
      "actual": 8.2,
      "benchmark": 2.0,
      "status": "critical",
      "message": "Agency staffing at 8.2% of labor (target: 2.0%)"
    }
  ]
}
```

## Usage Example

```jsx
import React from 'react';
import ProFormaTab from './components/ProFormaTab/ProFormaTab';
import DealService from './api/DealService';

const DealDetailPage = ({ dealId }) => {
  const [deal, setDeal] = useState(null);
  const [extractionData, setExtractionData] = useState(null);

  useEffect(() => {
    // Load deal data
    const loadDeal = async () => {
      const dealData = await DealService.getDeal(dealId);
      setDeal(dealData);

      // Parse extraction_data if it's a JSON string
      if (dealData.extraction_data) {
        const parsed = typeof dealData.extraction_data === 'string'
          ? JSON.parse(dealData.extraction_data)
          : dealData.extraction_data;
        setExtractionData(parsed);
      }
    };

    loadDeal();
  }, [dealId]);

  const handleSaveScenario = async (scenarioData) => {
    await DealService.saveProformaScenario(dealId, scenarioData);
    console.log('Scenario saved successfully');
  };

  if (!deal || !extractionData) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      {/* Other tabs */}
      <ProFormaTab
        deal={deal}
        extractionData={extractionData}
        onSaveScenario={handleSaveScenario}
      />
    </div>
  );
};

export default DealDetailPage;
```

## Styling Customization

The component uses React Bootstrap and custom CSS. To customize:

### Color Scheme
Edit the variance colors in `ProFormaTab.css`:

```css
.variance-on_target {
  color: #28a745;  /* Change green tone */
  background-color: #d4edda;
}

.variance-critical {
  color: #721c24;  /* Change red tone */
  background-color: #f8d7da;
}
```

### Typography
Adjust font sizes in the CSS:

```css
.proforma-table {
  font-size: 0.9rem;  /* Base table font size */
}

.summary-card h3 {
  font-size: 1.75rem;  /* Summary card value size */
}
```

### Spacing
Modify padding and margins:

```css
.proforma-table tbody td {
  padding: 0.75rem;  /* Cell padding */
}

.section-header td {
  padding: 0.875rem 0.75rem !important;  /* Section header padding */
}
```

## Performance Optimization

### Debounced Recalculation
The component uses lodash's `debounce` to prevent excessive API calls:

```javascript
const calculateProforma = useCallback(
  debounce(async (benchmarkValues) => {
    // API call
  }, 500),  // 500ms delay
  [deal?.id, currentFinancials]
);
```

### Memoized Calculations
Expensive calculations are memoized:

```javascript
const currentFinancials = useMemo(() => {
  // Extract and calculate current metrics
}, [extractionData]);

const summaryMetrics = useMemo(() => {
  // Calculate summary values
}, [analysis, currentFinancials]);
```

## Dependencies

Required packages:
```json
{
  "react": "^18.x",
  "react-bootstrap": "^2.x",
  "lucide-react": "^0.x",
  "lodash": "^4.x",
  "axios": "^1.x"
}
```

Install if not present:
```bash
npm install react-bootstrap lucide-react lodash axios
```

## Testing

### Manual Testing Checklist

- [ ] Component loads with valid deal and extraction data
- [ ] Summary cards display correct values
- [ ] All benchmark inputs are editable
- [ ] Changing a benchmark triggers recalculation (debounced)
- [ ] Variance colors update correctly based on values
- [ ] Opportunity column shows improvement amounts
- [ ] Scenario name can be changed
- [ ] Save button persists scenario
- [ ] Reset button restores default benchmarks
- [ ] Loading spinner shows during API calls
- [ ] Error alert displays on API failures
- [ ] Opportunity breakdown table shows detailed items
- [ ] Component handles missing/null extraction data gracefully

### Unit Test Example

```javascript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProFormaTab from './ProFormaTab';

test('renders summary cards', () => {
  const mockDeal = { id: 1, deal_name: 'Test Deal' };
  const mockExtraction = { annual_revenue: 5000000, ebitda: 450000 };

  render(
    <ProFormaTab
      deal={mockDeal}
      extractionData={mockExtraction}
      onSaveScenario={jest.fn()}
    />
  );

  expect(screen.getByText('Total Opportunity')).toBeInTheDocument();
  expect(screen.getByText('Stabilized EBITDA')).toBeInTheDocument();
});

test('benchmark inputs trigger recalculation', async () => {
  const mockDeal = { id: 1 };
  const mockExtraction = { annual_revenue: 5000000 };

  render(<ProFormaTab deal={mockDeal} extractionData={mockExtraction} />);

  const occupancyInput = screen.getByDisplayValue('85');
  fireEvent.change(occupancyInput, { target: { value: '90' } });

  await waitFor(() => {
    // Verify API was called with new benchmark
  }, { timeout: 1000 });
});
```

## Troubleshooting

### Common Issues

**Issue: "No financial data available" message**
- Ensure `extractionData` prop contains required fields
- Check that extraction_data was properly parsed if it's a JSON string

**Issue: Benchmarks not updating**
- Verify `handleBenchmarkChange` callback is connected
- Check browser console for errors in debounced function

**Issue: Variance colors not showing**
- Ensure `getVarianceStatus` function receives valid actual and benchmark values
- Check CSS classes are properly applied

**Issue: API calls failing**
- Verify backend endpoint exists: `/api/deals/:id/proforma/calculate`
- Check CORS settings if making cross-origin requests
- Verify authentication token is included in request headers

## Future Enhancements

Potential improvements:
- [ ] Scenario comparison side-by-side
- [ ] Export to Excel functionality
- [ ] Historical scenario tracking/versioning
- [ ] Sensitivity analysis (what-if scenarios)
- [ ] Custom benchmark configurations per user
- [ ] Benchmark presets (Conservative, Moderate, Aggressive)
- [ ] Visual charts showing opportunity waterfall
- [ ] Multi-year projection timeline
- [ ] ROI calculator integration
- [ ] Peer benchmarking data overlay
