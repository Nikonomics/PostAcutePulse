import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box
} from '@mui/material';
import { Bookmark } from '@mui/icons-material';

/**
 * SaveForLaterModal Component
 * Modal for adding an optional note when saving an item
 *
 * Props:
 * - open: boolean
 * - onClose: () => void
 * - onSave: (note: string | null) => void
 * - itemType: 'deal' | 'facility' | 'market' | 'ownership_group'
 */
const SaveForLaterModal = ({ open, onClose, onSave, itemType }) => {
  const [note, setNote] = useState('');

  const getItemTypeLabel = () => {
    switch (itemType) {
      case 'deal': return 'deal';
      case 'facility': return 'facility';
      case 'market': return 'market';
      case 'ownership_group': return 'ownership group';
      default: return 'item';
    }
  };

  const handleSave = () => {
    onSave(note.trim() || null);
    setNote('');
  };

  const handleClose = () => {
    setNote('');
    onClose();
  };

  const handleSkipNote = () => {
    onSave(null);
    setNote('');
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Bookmark color="primary" />
          <Typography variant="h6" component="span">
            Save {getItemTypeLabel()} for later
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Add an optional note to help you remember why you saved this {getItemTypeLabel()}.
        </Typography>

        <TextField
          autoFocus
          multiline
          rows={3}
          fullWidth
          variant="outlined"
          placeholder={`e.g., "Review with team next week" or "Interesting opportunity in target market"`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          sx={{ mt: 1 }}
        />
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleClose} color="inherit">
          Cancel
        </Button>
        <Button onClick={handleSkipNote} variant="outlined">
          Save without note
        </Button>
        <Button onClick={handleSave} variant="contained" color="primary">
          Save with note
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SaveForLaterModal;
