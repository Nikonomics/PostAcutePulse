import React, { useState, useEffect, useCallback } from 'react';
import GooglePlacesAutocomplete from 'react-google-places-autocomplete';
import { X, MapPin, Plus } from 'lucide-react';
import { toast } from 'react-toastify';

const LocationMultiSelect = ({ 
  selectedLocations = [], 
  onLocationsChange, 
  placeholder = "Search for states or cities...",
  maxLocations = 20,
  showType = true 
}) => {
  const [selectedStates, setSelectedStates] = useState([]);
  const [selectedCities, setSelectedCities] = useState([]);
  const [isStatesOpen, setIsStatesOpen] = useState(false);
  const [isCitiesOpen, setIsCitiesOpen] = useState(false);

  // Initialize selected states and cities from selectedLocations (only on mount)
  useEffect(() => {
    if (selectedLocations.length === 0) return;
    
    const states = selectedLocations.filter(loc => loc.type === 'state');
    const cities = selectedLocations.filter(loc => loc.type === 'city');
    
    setSelectedStates(states);
    setSelectedCities(cities);
  }, []); // Empty dependency array - only run on mount



  // Update parent component when selections change
  const updateParentLocations = useCallback(() => {
    const allLocations = [...selectedStates, ...selectedCities];
    onLocationsChange(allLocations);
  }, [selectedStates, selectedCities, onLocationsChange]);

  const handleStateSelect = (place) => {
    if (!place) return;
    if (totalLocations >= maxLocations) {
      toast.warning(`Maximum ${maxLocations} locations reached. Please remove some locations before adding more.`);
      return;
    }

    const stateLocation = parseStateDetails(place);
    if (stateLocation) {
      // Check if location is duplicate using helper function
      if (isLocationDuplicate(stateLocation)) {
        toast.warning('This location is already selected');
        return;
      }

      setSelectedStates(prev => {
        const newStates = [...prev, stateLocation];
        // Update parent after state change
        setTimeout(() => updateParentLocations(), 0);
        return newStates;
      });
      toast.success(`${stateLocation.state} added successfully`);
      setIsStatesOpen(false);
    }
  };

  const handleCitySelect = (place) => {
    if (!place) return;
    if (totalLocations >= maxLocations) {
      toast.warning(`Maximum ${maxLocations} locations reached. Please remove some locations before adding more.`);
      return;
    }

    const cityLocation = parseCityDetails(place);
    if (cityLocation) {
      // Check if location is duplicate using helper function
      if (isLocationDuplicate(cityLocation)) {
        toast.warning('This location is already selected');
        return;
      }

      setSelectedCities(prev => {
        const newCities = [...prev, cityLocation];
        // Update parent after city change
        setTimeout(() => updateParentLocations(), 0);
        return newCities;
      });
      toast.success(`${cityLocation.city}, ${cityLocation.state} added successfully`);
      setIsCitiesOpen(false);
    }
  };

  const parseStateDetails = (place) => {
    if (!place || !place.value) return null;

    const placeId = place.value.place_id;
    const description = place.label;
    
    // Parse state description (e.g., "California, United States")
    const parts = description.split(', ');
    const stateName = parts[0].trim();
    const country = parts[1] || 'United States';

    return {
      place_id: placeId,
      description: description,
      city: '',
      state: stateName,
      country: country,
      type: 'state'
    };
  };

  const parseCityDetails = (place) => {
    if (!place || !place.value) return null;

    const placeId = place.value.place_id;
    const description = place.label;
    
    // Parse city description (e.g., "Phoenix, AZ, United States")
    const parts = description.split(', ');
    const cityName = parts[0].trim();
    const stateAbbr = parts[1]?.trim() || '';
    const country = parts[2] || 'United States';

    return {
      place_id: placeId,
      description: description,
      city: cityName,
      state: stateAbbr,
      country: country,
      type: 'city'
    };
  };

  const removeState = (placeId) => {
    const stateToRemove = selectedStates.find(state => state.place_id === placeId);
    setSelectedStates(prev => {
      const newStates = prev.filter(state => state.place_id !== placeId);
      // Update parent after state removal
      setTimeout(() => updateParentLocations(), 0);
      return newStates;
    });
    if (stateToRemove) {
      toast.success(`${stateToRemove.state} removed successfully`);
    }
  };

  const removeCity = (placeId) => {
    const cityToRemove = selectedCities.find(city => city.place_id === placeId);
    setSelectedCities(prev => {
      const newCities = prev.filter(city => city.place_id !== placeId);
      // Update parent after city removal
      setTimeout(() => updateParentLocations(), 0);
      return newCities;
    });
    if (cityToRemove) {
      toast.success(`${cityToRemove.city}, ${cityToRemove.state} removed successfully`);
    }
  };

  const getLocationDisplay = (location) => {
    if (location.type === 'state') {
      return location.state;
    }
    if (location.city && location.state) {
      return `${location.city}, ${location.state}`;
    }
    return location.description;
  };

  const getLocationTypeColor = (type) => {
    return type === 'state' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800';
  };

  const totalLocations = selectedStates.length + selectedCities.length;
  const canAddMore = totalLocations < maxLocations;

  // Helper function to check for duplicates
  const isLocationDuplicate = (newLocation) => {
    // Check by place_id
    const idExists = selectedStates.some(loc => loc.place_id === newLocation.place_id) ||
                    selectedCities.some(loc => loc.place_id === newLocation.place_id);
    
    if (idExists) return true;
    
    // Check by name (for states)
    if (newLocation.type === 'state') {
      const nameExists = selectedStates.some(state => 
        state.state.toLowerCase() === newLocation.state.toLowerCase()
      );
      
      if (nameExists) return true;
      
      // Also check if any cities from this state are already selected
      const citiesFromState = selectedCities.some(city => 
        city.state.toLowerCase() === newLocation.state.toLowerCase()
      );
      
      if (citiesFromState) {
        toast.warning(`Cannot add ${newLocation.state} as a state because cities from this state are already selected`);
        return true;
      }
    }
    
    // Check by city+state combination (for cities)
    if (newLocation.type === 'city') {
      const combinationExists = selectedCities.some(city => 
        city.city.toLowerCase() === newLocation.city.toLowerCase() &&
        city.state.toLowerCase() === newLocation.state.toLowerCase()
      );
      
      if (combinationExists) return true;
      
      // Also check if the state is already selected as a state
      const stateAlreadySelected = selectedStates.some(state => 
        state.state.toLowerCase() === newLocation.state.toLowerCase()
      );
      
      if (stateAlreadySelected) {
        toast.warning(`${newLocation.state} is already selected as a state`);
        return true;
      }
    }
    
    return false;
  };

  return (
    <div className="location-multi-select">
      {/* Selected Locations Summary */}
      {totalLocations > 0 && (
        <div className="mb-3">
          <label className="form-label">Selected Locations ({totalLocations}/{maxLocations})</label>
          <div className="d-flex flex-wrap gap-2">
            {selectedStates.map((state, index) => (
              <span
                key={`state-${state.place_id}-${index}`}
                className={`badge ${getLocationTypeColor('state')} d-flex align-items-center gap-1 px-3 py-2`}
              >
                <MapPin size={14} />
                <span>{state.state}</span>
                {showType && (
                  <span className="badge bg-secondary ms-1">State</span>
                )}
                <button
                  type="button"
                  className="btn-close btn-close-white ms-2"
                  onClick={() => removeState(state.place_id)}
                  aria-label="Remove state"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
            {selectedCities.map((city, index) => (
              <span
                key={`city-${city.place_id}-${index}`}
                className={`badge ${getLocationTypeColor('city')} d-flex align-items-center gap-1 px-3 py-2`}
              >
                <MapPin size={14} />
                <span>{`${city.city}, ${city.state}`}</span>
                {showType && (
                  <span className="badge bg-secondary ms-1">City</span>
                )}
                <button
                  type="button"
                  className="btn-close btn-close-white ms-2"
                  onClick={() => removeCity(city.place_id)}
                  aria-label="Remove city"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* States Dropdown */}
      <div className="mb-3">
        <label className="form-label">States/Provinces</label>
        <div className="position-relative">
          <GooglePlacesAutocomplete
            apiKey={process.env.REACT_APP_GOOGLE_MAPS_API_KEY}
            selectProps={{
              value: null,
              onChange: handleStateSelect,
              placeholder: canAddMore ? 'Search for states...' : `Maximum ${maxLocations} locations reached`,
              isDisabled: !canAddMore,
              isClearable: true,
              className: 'form-control',
              noOptionsMessage: () => 'No states found',
              loadingMessage: () => 'Searching...',
            }}
            autocompletionRequest={{
              types: ['administrative_area_level_1'],
              componentRestrictions: {
                country: ['us', 'ca'],
              },
            }}
          />
          {canAddMore && (
            <div className="form-text">
              <Plus size={14} className="me-1" />
              Search and select states/provinces
            </div>
          )}
        </div>
      </div>

      {/* Cities Dropdown */}
      <div className="mb-3">
        <label className="form-label">Cities</label>
        <div className="position-relative">
          <GooglePlacesAutocomplete
            apiKey={process.env.REACT_APP_GOOGLE_MAPS_API_KEY}
            selectProps={{
              value: null,
              onChange: handleCitySelect,
              placeholder: canAddMore ? 'Search for cities...' : `Maximum ${maxLocations} locations reached`,
              isDisabled: !canAddMore,
              isClearable: true,
              className: 'form-control',
              noOptionsMessage: () => 'No cities found',
              loadingMessage: () => 'Searching...',
            }}
            autocompletionRequest={{
              types: ['(cities)'],
              componentRestrictions: {
                country: ['us', 'ca'],
              },
            }}
          />
          {canAddMore && (
            <div className="form-text">
              <Plus size={14} className="me-1" />
              Search and select specific cities
            </div>
          )}
        </div>
      </div>

      {/* Location Type Legend */}
      {showType && (
        <div className="mt-2 d-flex gap-3 text-muted small">
          <div className="d-flex align-items-center gap-1">
            <div className="badge bg-blue-100 text-blue-800">State</div>
            <span>State/Province</span>
          </div>
          <div className="d-flex align-items-center gap-1">
            <div className="badge bg-green-100 text-green-800">City</div>
            <span>City with State</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default LocationMultiSelect;
