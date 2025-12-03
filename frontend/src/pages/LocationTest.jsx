import React, { useState } from 'react';
import LocationMultiSelect from '../components/ui/LocationMultiSelect';

const LocationTest = () => {
  const [selectedLocations, setSelectedLocations] = useState([]);

  const handleLocationsChange = (locations) => {
    setSelectedLocations(locations);
    console.log('Selected locations:', locations);
  };

  return (
    <div className="container mt-5">
      <div className="row justify-content-center">
        <div className="col-lg-8">
          <div className="card shadow">
            <div className="card-header bg-primary text-white">
              <h3 className="mb-0">Location Multi-Select Test</h3>
            </div>
            <div className="card-body">
              <p className="text-muted mb-4">
                This is a test page for the new LocationMultiSelect component. 
                The component now has separate dropdowns for states and cities.
                Try searching in both fields to see how it works.
              </p>
              
              <LocationMultiSelect
                selectedLocations={selectedLocations}
                onLocationsChange={handleLocationsChange}
                placeholder="Search for states or cities..."
                maxLocations={5}
                showType={true}
              />

              <div className="mt-4">
                <h5>Selected Locations Data:</h5>
                <pre className="bg-light p-3 rounded">
                  {JSON.stringify(selectedLocations, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LocationTest;
