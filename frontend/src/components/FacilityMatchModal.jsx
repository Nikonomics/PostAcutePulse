import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, Card, CardContent, Chip, IconButton, Collapse } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import HotelIcon from '@mui/icons-material/Hotel';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

/**
 * Facility Match Review Modal
 * Shows facility matches from ALF database after extraction
 * User can select match, skip, or mark as "not sure"
 */
const FacilityMatchModal = ({ open, matches, searchName, onSelect, onSkip, onNotSure }) => {
  const [showAll, setShowAll] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  // Show top 5 by default, all when "Show More" clicked
  const displayedMatches = showAll ? matches : matches.slice(0, 5);
  const hasMore = matches.length > 5;

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
    // Give visual feedback before calling API
    setTimeout(() => {
      onSelect(facilityId);
    }, 300);
  };

  return (
    <Dialog
      open={open}
      maxWidth="md"
      fullWidth
      disableEscapeKeyDown
      onClose={(event, reason) => {
        // Prevent closing by clicking outside or pressing escape
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
                      Selected - Click "Confirm" to apply
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
            <strong>Note:</strong> Selecting a facility will automatically populate its address, bed count, and coordinates in your deal. You can always change this later in the General Info tab.
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
          onClick={() => selectedId && onSelect(selectedId)}
          variant="contained"
          color="primary"
          disabled={!selectedId}
          size="large"
        >
          Confirm Selection
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default FacilityMatchModal;
