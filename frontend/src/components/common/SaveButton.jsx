import React, { useState, useEffect } from 'react';
import { IconButton, Tooltip, CircularProgress } from '@mui/material';
import { Bookmark, BookmarkBorder } from '@mui/icons-material';
import { saveDeal, saveDealFacility, saveMarketFacility, saveMarket, saveOwnershipGroup, saveFacility, removeSavedItem, checkSavedItems } from '../../api/savedItemsService';
import SaveForLaterModal from './SaveForLaterModal';

/**
 * SaveButton Component
 * A reusable bookmark/save button for deals, facilities, markets, and ownership groups
 *
 * Props:
 * - itemType: 'deal' | 'facility' | 'market' | 'ownership_group' | 'cms_facility'
 * - itemId: number (for deals and deal facilities)
 * - facilityType: 'SNF' | 'ALF' (for market facilities)
 * - marketFacilityId: number (for market facilities)
 * - state: string (for markets)
 * - county: string (for markets)
 * - cbsaCode: string (optional, for markets)
 * - ownershipGroupName: string (for ownership groups)
 * - ccn: string (for CMS facilities)
 * - facilityName: string (for CMS facilities display name)
 * - size: 'small' | 'medium' | 'large'
 * - showLabel: boolean - show "Save" text next to icon
 * - onSaveChange: (isSaved, savedItemId) => void - callback when save state changes
 */
const SaveButton = ({
  itemType,
  itemId,
  facilityType,
  marketFacilityId,
  state,
  county,
  cbsaCode,
  ownershipGroupName,
  ccn,
  facilityName,
  size = 'medium',
  showLabel = false,
  onSaveChange
}) => {
  const [isSaved, setIsSaved] = useState(false);
  const [savedItemId, setSavedItemId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  // Check if item is already saved on mount
  useEffect(() => {
    const checkIfSaved = async () => {
      setChecking(true);
      try {
        let result;
        if (itemType === 'deal' && itemId) {
          result = await checkSavedItems('deal', { ids: [itemId] });
          if (result.success && result.data[itemId]) {
            setIsSaved(true);
            setSavedItemId(result.data[itemId]);
          }
        } else if (itemType === 'facility' && itemId) {
          result = await checkSavedItems('facility', { ids: [itemId] });
          if (result.success && result.data[itemId]) {
            setIsSaved(true);
            setSavedItemId(result.data[itemId]);
          }
        } else if (itemType === 'market' && state && county) {
          result = await checkSavedItems('market', { markets: [{ state, county }] });
          const key = `${state}-${county}`;
          if (result.success && result.data[key]) {
            setIsSaved(true);
            setSavedItemId(result.data[key]);
          }
        } else if (itemType === 'ownership_group' && ownershipGroupName) {
          result = await checkSavedItems('ownership_group', { names: [ownershipGroupName] });
          if (result.success && result.data[ownershipGroupName]) {
            setIsSaved(true);
            setSavedItemId(result.data[ownershipGroupName]);
          }
        } else if (itemType === 'cms_facility' && ccn) {
          result = await checkSavedItems('cms_facility', { ccns: [ccn] });
          if (result.success && result.data[ccn]) {
            setIsSaved(true);
            setSavedItemId(result.data[ccn]);
          }
        }
      } catch (error) {
        console.error('Error checking saved status:', error);
      } finally {
        setChecking(false);
      }
    };

    checkIfSaved();
  }, [itemType, itemId, facilityType, marketFacilityId, state, county, ownershipGroupName, ccn]);

  const handleClick = async (e) => {
    e.stopPropagation();
    e.preventDefault();

    if (isSaved) {
      // Unsave
      setLoading(true);
      try {
        await removeSavedItem(savedItemId);
        setIsSaved(false);
        setSavedItemId(null);
        onSaveChange?.(false, null);
      } catch (error) {
        console.error('Error unsaving item:', error);
      } finally {
        setLoading(false);
      }
    } else {
      // Open modal to add note
      setModalOpen(true);
    }
  };

  const handleSave = async (note) => {
    setLoading(true);
    setModalOpen(false);
    try {
      let result;

      if (itemType === 'deal') {
        result = await saveDeal(itemId, note);
      } else if (itemType === 'facility') {
        if (facilityType && marketFacilityId) {
          // Market facility (from SNF/ALF database)
          result = await saveMarketFacility(facilityType, marketFacilityId, note);
        } else {
          // Deal facility
          result = await saveDealFacility(itemId, note);
        }
      } else if (itemType === 'market') {
        result = await saveMarket(state, county, cbsaCode, note);
      } else if (itemType === 'ownership_group') {
        result = await saveOwnershipGroup(ownershipGroupName, note);
      } else if (itemType === 'cms_facility') {
        result = await saveFacility(ccn, facilityName, note);
      }

      if (result?.success) {
        setIsSaved(true);
        setSavedItemId(result.data?.id);
        onSaveChange?.(true, result.data?.id);
      } else if (result?.alreadySaved) {
        // Already saved (shouldn't happen but handle gracefully)
        setIsSaved(true);
        setSavedItemId(result.saved_item_id);
        onSaveChange?.(true, result.saved_item_id);
      }
    } catch (error) {
      console.error('Error saving item:', error);
    } finally {
      setLoading(false);
    }
  };

  const iconSize = size === 'small' ? 18 : size === 'large' ? 28 : 22;

  if (checking) {
    return (
      <IconButton size={size} disabled>
        <CircularProgress size={iconSize - 4} />
      </IconButton>
    );
  }

  return (
    <>
      <Tooltip title={isSaved ? 'Remove from saved' : 'Save for later'}>
        <IconButton
          size={size}
          onClick={handleClick}
          disabled={loading}
          sx={{
            color: isSaved ? 'primary.main' : 'text.secondary',
            '&:hover': {
              color: isSaved ? 'primary.dark' : 'primary.main',
              backgroundColor: 'action.hover'
            }
          }}
        >
          {loading ? (
            <CircularProgress size={iconSize - 4} />
          ) : isSaved ? (
            <Bookmark sx={{ fontSize: iconSize }} />
          ) : (
            <BookmarkBorder sx={{ fontSize: iconSize }} />
          )}
        </IconButton>
      </Tooltip>

      <SaveForLaterModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        itemType={itemType}
      />
    </>
  );
};

export default SaveButton;
