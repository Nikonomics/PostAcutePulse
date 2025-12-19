import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography,
  Card, CardContent, Chip, Link, RadioGroup, FormControlLabel, Radio,
  TextField, Alert, Divider
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import HotelIcon from '@mui/icons-material/Hotel';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

/**
 * Format field name for display
 */
const formatFieldName = (field) => {
  const fieldLabels = {
    bed_count: 'Bed Count',
    street_address: 'Street Address',
    city: 'City',
    state: 'State',
    zip_code: 'ZIP Code',
    facility_name: 'Facility Name'
  };
  return fieldLabels[field] || field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

/**
 * Format value for display based on field type
 */
const formatValue = (field, value) => {
  if (value === null || value === undefined) return 'Not provided';
  if (field === 'bed_count') return `${value} beds`;
  return value.toString();
};

/**
 * Conflict Resolution Component
 */
const ConflictResolution = ({ conflicts, resolutions, onResolve }) => {
  if (!conflicts || conflicts.length === 0) return null;

  const unresolvedConflicts = conflicts.filter(c => !c.resolved);
  if (unresolvedConflicts.length === 0) return null;

  return (
    <Box sx={{ mb: 3 }}>
      <Alert
        severity="warning"
        icon={<WarningAmberIcon />}
        sx={{ mb: 2 }}
      >
        <Typography variant="subtitle2" fontWeight="bold">
          Data Conflicts Detected
        </Typography>
        <Typography variant="body2">
          The extracted data differs from the database. Please choose which values to use.
        </Typography>
      </Alert>

      {unresolvedConflicts.map((conflict) => (
        <Card
          key={conflict.field}
          variant="outlined"
          sx={{
            mb: 2,
            borderColor: resolutions[conflict.field] ? 'success.main' : 'warning.main',
            borderWidth: 2
          }}
        >
          <CardContent>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              {formatFieldName(conflict.field)}
            </Typography>

            <RadioGroup
              value={resolutions[conflict.field]?.choice || ''}
              onChange={(e) => {
                const choice = e.target.value;
                let value;
                if (choice === 'extracted') {
                  value = conflict.extracted_value;
                } else if (choice === 'database') {
                  value = conflict.database_value;
                } else {
                  value = resolutions[conflict.field]?.customValue || '';
                }
                onResolve(conflict.field, choice, value);
              }}
            >
              <FormControlLabel
                value="extracted"
                control={<Radio color="primary" />}
                label={
                  <Box>
                    <Typography variant="body2" fontWeight="medium">
                      {formatValue(conflict.field, conflict.extracted_value)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Extracted from: {conflict.source_extracted || 'Document'}
                    </Typography>
                  </Box>
                }
                sx={{
                  mb: 1,
                  p: 1,
                  borderRadius: 1,
                  bgcolor: resolutions[conflict.field]?.choice === 'extracted' ? 'action.selected' : 'transparent',
                  '&:hover': { bgcolor: 'action.hover' }
                }}
              />

              <FormControlLabel
                value="database"
                control={<Radio color="primary" />}
                label={
                  <Box>
                    <Typography variant="body2" fontWeight="medium">
                      {formatValue(conflict.field, conflict.database_value)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      From: {conflict.source_database || 'Database'}
                    </Typography>
                  </Box>
                }
                sx={{
                  mb: 1,
                  p: 1,
                  borderRadius: 1,
                  bgcolor: resolutions[conflict.field]?.choice === 'database' ? 'action.selected' : 'transparent',
                  '&:hover': { bgcolor: 'action.hover' }
                }}
              />

              <FormControlLabel
                value="custom"
                control={<Radio color="primary" />}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" fontWeight="medium">
                      Other:
                    </Typography>
                    <TextField
                      size="small"
                      variant="outlined"
                      placeholder={conflict.field === 'bed_count' ? 'Enter beds' : 'Enter value'}
                      type={conflict.field === 'bed_count' ? 'number' : 'text'}
                      value={resolutions[conflict.field]?.customValue || ''}
                      onChange={(e) => {
                        onResolve(conflict.field, 'custom', e.target.value);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      sx={{ width: conflict.field === 'bed_count' ? 120 : 200 }}
                      InputProps={{
                        endAdornment: conflict.field === 'bed_count' ? (
                          <Typography variant="caption" color="text.secondary">beds</Typography>
                        ) : null
                      }}
                    />
                  </Box>
                }
                sx={{
                  p: 1,
                  borderRadius: 1,
                  bgcolor: resolutions[conflict.field]?.choice === 'custom' ? 'action.selected' : 'transparent',
                  '&:hover': { bgcolor: 'action.hover' }
                }}
              />
            </RadioGroup>

            {resolutions[conflict.field]?.choice && (
              <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <CheckCircleIcon fontSize="small" color="success" />
                <Typography variant="caption" color="success.main">
                  Resolved: Using {resolutions[conflict.field]?.choice === 'extracted' ? 'extracted' :
                    resolutions[conflict.field]?.choice === 'database' ? 'database' : 'custom'} value
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>
      ))}
    </Box>
  );
};

/**
 * Facility Match Review Modal
 * Shows facility matches from ALF database after extraction
 * User can select match, skip, or mark as "not sure"
 * Now also handles conflict resolution between extracted and database values
 */
const FacilityMatchModal = ({
  open,
  matches,
  searchName,
  conflicts = [],  // Array of conflict objects from extraction_data._conflicts
  onSelect,        // Called with (facilityId, resolvedConflicts)
  onSkip,
  onNotSure
}) => {
  const [showAll, setShowAll] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [conflictResolutions, setConflictResolutions] = useState({});

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      setSelectedId(null);
      setConflictResolutions({});
    }
  }, [open]);

  // Show top 5 by default, all when "Show More" clicked
  const displayedMatches = showAll ? matches : matches.slice(0, 5);
  const hasMore = matches.length > 5;

  // Get unresolved conflicts
  const unresolvedConflicts = (conflicts || []).filter(c => !c.resolved);
  const hasUnresolvedConflicts = unresolvedConflicts.length > 0;

  // Check if all conflicts are resolved
  const allConflictsResolved = unresolvedConflicts.every(
    c => conflictResolutions[c.field]?.choice &&
         (conflictResolutions[c.field].choice !== 'custom' || conflictResolutions[c.field].customValue)
  );

  // Can confirm only if a match is selected AND all conflicts are resolved
  const canConfirm = selectedId && (!hasUnresolvedConflicts || allConflictsResolved);

  const getConfidenceColor = (confidence) => {
    switch (confidence) {
      case 'high': return 'success';
      case 'medium': return 'warning';
      case 'low': return 'error';
      default: return 'default';
    }
  };

  const handleSelectMatch = (facilityId) => {
    setSelectedId(facilityId);
  };

  const handleResolveConflict = (field, choice, value) => {
    setConflictResolutions(prev => ({
      ...prev,
      [field]: {
        choice,
        value: choice === 'custom' ? value : (choice === 'extracted' ?
          conflicts.find(c => c.field === field)?.extracted_value :
          conflicts.find(c => c.field === field)?.database_value),
        customValue: choice === 'custom' ? value : prev[field]?.customValue
      }
    }));
  };

  const handleConfirm = () => {
    if (!selectedId) return;

    // Build resolved_conflicts object for API
    const resolvedConflicts = {};
    for (const [field, resolution] of Object.entries(conflictResolutions)) {
      if (resolution.choice && resolution.value !== undefined) {
        // Convert to appropriate type
        let value = resolution.value;
        if (field === 'bed_count') {
          value = parseInt(value) || 0;
        }
        resolvedConflicts[field] = value;
      }
    }

    // Call onSelect with facility ID and resolved conflicts
    onSelect(selectedId, Object.keys(resolvedConflicts).length > 0 ? resolvedConflicts : null);
  };

  return (
    <Dialog
      open={open}
      maxWidth="md"
      fullWidth
      disableEscapeKeyDown
      onClose={(event, reason) => {
        if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
          return;
        }
      }}
    >
      <DialogTitle>
        <Typography variant="h5" component="div" fontWeight="bold">
          Review Facility Matches
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          We found {matches.length} potential match{matches.length !== 1 ? 'es' : ''} for <strong>{searchName}</strong> in our database
        </Typography>
      </DialogTitle>

      <DialogContent dividers>
        {/* Conflict Resolution Section - Show first if conflicts exist */}
        {hasUnresolvedConflicts && (
          <>
            <ConflictResolution
              conflicts={unresolvedConflicts}
              resolutions={conflictResolutions}
              onResolve={handleResolveConflict}
            />
            <Divider sx={{ my: 2 }} />
          </>
        )}

        {/* Facility Matches Section */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {displayedMatches.map((match, index) => (
            <Card
              key={match.facility_id}
              variant="outlined"
              sx={{
                cursor: 'pointer',
                transition: 'all 0.2s',
                border: selectedId === match.facility_id ? '2px solid' : '1px solid',
                borderColor: selectedId === match.facility_id ? 'primary.main' : 'divider',
                bgcolor: selectedId === match.facility_id ? 'action.selected' : 'background.paper',
                '&:hover': {
                  boxShadow: 3,
                  borderColor: 'primary.light'
                }
              }}
              onClick={() => handleSelectMatch(match.facility_id)}
            >
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Typography variant="h6" component="div">
                        {match.facility_name}
                      </Typography>
                      {match.federal_provider_number && (
                        <Link
                          href={`/facility-metrics/${match.federal_provider_number}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 0.25,
                            fontSize: '0.75rem',
                            textDecoration: 'none',
                            '&:hover': { textDecoration: 'underline' }
                          }}
                        >
                          View
                          <OpenInNewIcon sx={{ fontSize: 12 }} />
                        </Link>
                      )}
                      {index === 0 && (
                        <Chip
                          label="Best Match"
                          size="small"
                          color="primary"
                          sx={{ fontWeight: 'bold' }}
                        />
                      )}
                    </Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      {match.facility_type || 'Assisted Living Facility'}
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
                    <Chip
                      label={`${(match.match_score * 100).toFixed(0)}% Match`}
                      color={getConfidenceColor(match.match_confidence)}
                      size="small"
                    />
                    <Typography variant="caption" color="text.secondary">
                      {match.match_confidence?.toUpperCase()} confidence
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                    <LocationOnIcon fontSize="small" color="action" />
                    <Typography variant="body2">
                      {match.address}
                      <br />
                      {match.city}, {match.state} {match.zip_code}
                    </Typography>
                  </Box>

                  {match.capacity && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <HotelIcon fontSize="small" color="action" />
                      <Typography variant="body2">
                        <strong>{match.capacity}</strong> Licensed Beds
                      </Typography>
                    </Box>
                  )}

                  {match.phone && (
                    <Typography variant="body2" color="text.secondary">
                      Phone: {match.phone}
                    </Typography>
                  )}
                </Box>

                {selectedId === match.facility_id && (
                  <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1, color: 'primary.main' }}>
                    <CheckCircleIcon />
                    <Typography variant="body2" fontWeight="bold">
                      Selected {hasUnresolvedConflicts && !allConflictsResolved ?
                        '- Resolve conflicts above to confirm' :
                        '- Click "Confirm" to apply'}
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          ))}

          {hasMore && !showAll && (
            <Button
              variant="outlined"
              onClick={() => setShowAll(true)}
              endIcon={<ExpandMoreIcon />}
              sx={{ mt: 1 }}
            >
              Show {matches.length - 5} More Matches
            </Button>
          )}

          {hasMore && showAll && (
            <Button
              variant="outlined"
              onClick={() => setShowAll(false)}
              endIcon={<ExpandLessIcon />}
              sx={{ mt: 1 }}
            >
              Show Less
            </Button>
          )}
        </Box>

        <Box sx={{ mt: 3, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
          <Typography variant="body2" color="text.secondary">
            <strong>Note:</strong> Selecting a facility will automatically populate its address, bed count, and coordinates in your deal.
            {hasUnresolvedConflicts && ' Conflicting values will use your chosen resolution.'}
            {' '}You can always change this later in the General Info tab.
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            onClick={onNotSure}
            variant="outlined"
            color="inherit"
          >
            Not Sure
          </Button>
          <Button
            onClick={onSkip}
            variant="outlined"
            color="inherit"
          >
            None of These
          </Button>
        </Box>

        <Button
          onClick={handleConfirm}
          variant="contained"
          color="primary"
          disabled={!canConfirm}
          size="large"
        >
          {hasUnresolvedConflicts && !allConflictsResolved ?
            `Resolve ${unresolvedConflicts.length - Object.keys(conflictResolutions).filter(k => conflictResolutions[k]?.choice).length} Conflict(s)` :
            'Confirm Selection'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default FacilityMatchModal;
