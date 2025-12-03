// Sample location data for Google Maps testing
export const sampleLocations = [
  {
    id: 1,
    title: "San Francisco Office",
    description: "Main headquarters and operations center",
    lat: 37.7749,
    lng: -122.4194,
    type: "office"
  },
  {
    id: 2,
    title: "New York Branch",
    description: "East Coast regional office",
    lat: 40.7128,
    lng: -74.0060,
    type: "office"
  },
  {
    id: 3,
    title: "Los Angeles Branch",
    description: "West Coast regional office",
    lat: 34.0522,
    lng: -118.2437,
    type: "office"
  },
  {
    id: 4,
    title: "Chicago Branch",
    description: "Midwest regional office",
    lat: 41.8781,
    lng: -87.6298,
    type: "office"
  },
  {
    id: 5,
    title: "Miami Branch",
    description: "Southeast regional office",
    lat: 25.7617,
    lng: -80.1918,
    type: "office"
  },
  {
    id: 6,
    title: "Seattle Branch",
    description: "Pacific Northwest office",
    lat: 47.6062,
    lng: -122.3321,
    type: "office"
  },
  {
    id: 7,
    title: "Austin Branch",
    description: "Texas regional office",
    lat: 30.2672,
    lng: -97.7431,
    type: "office"
  },
  {
    id: 8,
    title: "Denver Branch",
    description: "Mountain region office",
    lat: 39.7392,
    lng: -104.9903,
    type: "office"
  }
];

// Sample deal locations (you can replace these with your actual deal data)
export const sampleDealLocations = [
  {
    id: "deal-1",
    title: "Deal #1234 - Golden Gate Property",
    description: "Senior living facility in San Francisco",
    lat: 37.7849,
    lng: -122.4094,
    type: "deal",
    status: "pipeline",
    value: "$2.5M"
  },
  {
    id: "deal-2",
    title: "Deal #1235 - Central Park Property",
    description: "Assisted living facility in Manhattan",
    lat: 40.7028,
    lng: -74.0160,
    type: "deal",
    status: "due_diligence",
    value: "$3.2M"
  },
  {
    id: "deal-3",
    title: "Deal #1236 - Hollywood Property",
    description: "Memory care facility in LA",
    lat: 34.0622,
    lng: -118.2337,
    type: "deal",
    status: "final_review",
    value: "$1.8M"
  },
  {
    id: "deal-4",
    title: "Deal #1237 - Lake View Property",
    description: "Independent living facility in Chicago",
    lat: 41.8881,
    lng: -87.6198,
    type: "deal",
    status: "closed",
    value: "$4.1M"
  }
];

// Function to generate random locations within a bounding box
export const generateRandomLocations = (count = 10, bounds = {
  north: 49.0,
  south: 24.0,
  east: -66.0,
  west: -125.0
}) => {
  const locations = [];
  
  for (let i = 0; i < count; i++) {
    const lat = bounds.south + Math.random() * (bounds.north - bounds.south);
    const lng = bounds.west + Math.random() * (bounds.east - bounds.west);
    
    locations.push({
      id: `random-${i + 1}`,
      title: `Random Location ${i + 1}`,
      description: `Generated location for testing`,
      lat: parseFloat(lat.toFixed(6)),
      lng: parseFloat(lng.toFixed(6)),
      type: "random"
    });
  }
  
  return locations;
};
