import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Bookmark, Handshake, Building2, MapPin, StickyNote, Trash2, ExternalLink, ChevronDown, ChevronUp, Users } from 'lucide-react';
import { getSavedItems, removeSavedItem, updateSavedItemNote } from '../api/savedItemsService';

const SavedItems = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [savedItems, setSavedItems] = useState({ deals: [], facilities: [], markets: [], ownershipGroups: [], cmsFacilities: [] });
  const [counts, setCounts] = useState({ deals: 0, facilities: 0, markets: 0, ownershipGroups: 0, cmsFacilities: 0, total: 0 });
  const [editingNote, setEditingNote] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [expandedNotes, setExpandedNotes] = useState({});

  useEffect(() => {
    fetchSavedItems();
  }, []);

  const fetchSavedItems = async () => {
    try {
      setLoading(true);
      const response = await getSavedItems();
      if (response.success) {
        setSavedItems(response.data);
        setCounts(response.counts);
      }
    } catch (error) {
      toast.error('Failed to load saved items');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (id, type) => {
    try {
      await removeSavedItem(id);
      toast.success('Item removed from saved');
      // Update local state
      setSavedItems(prev => ({
        ...prev,
        [type]: prev[type].filter(item => item.id !== id)
      }));
      setCounts(prev => ({
        ...prev,
        [type]: prev[type] - 1,
        total: prev.total - 1
      }));
    } catch (error) {
      toast.error('Failed to remove item');
    }
  };

  const handleUpdateNote = async (id, type) => {
    try {
      await updateSavedItemNote(id, noteText);
      toast.success('Note updated');
      // Update local state
      setSavedItems(prev => ({
        ...prev,
        [type]: prev[type].map(item =>
          item.id === id ? { ...item, note: noteText || null } : item
        )
      }));
      setEditingNote(null);
      setNoteText('');
    } catch (error) {
      toast.error('Failed to update note');
    }
  };

  const startEditNote = (id, currentNote) => {
    setEditingNote(id);
    setNoteText(currentNote || '');
  };

  const toggleNoteExpand = (id) => {
    setExpandedNotes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Pipeline': return 'bg-blue-100 text-blue-800';
      case 'Due Diligence': return 'bg-yellow-100 text-yellow-800';
      case 'Final Review': return 'bg-purple-100 text-purple-800';
      case 'Closed': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const tabs = [
    { id: 'all', label: 'All', count: counts.total },
    { id: 'deals', label: 'Deals', count: counts.deals, icon: Handshake },
    { id: 'facilities', label: 'Deal Facilities', count: counts.facilities, icon: Building2 },
    { id: 'cmsFacilities', label: 'SNF Facilities', count: counts.cmsFacilities, icon: Building2 },
    { id: 'markets', label: 'Markets', count: counts.markets, icon: MapPin },
    { id: 'ownershipGroups', label: 'Ownership Groups', count: counts.ownershipGroups, icon: Users },
  ];

  const renderDealCard = (item) => {
    const deal = item.deal;
    const isDeleted = deal?.deleted;

    return (
      <div
        key={item.id}
        className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow ${
          isDeleted ? 'opacity-60' : ''
        }`}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Handshake size={20} className="text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900 truncate">
                  {isDeleted ? 'Deleted Deal' : deal?.deal_name || 'Unknown Deal'}
                </h3>
                {!isDeleted && deal?.deal_status && (
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(deal.deal_status)}`}>
                    {deal.deal_status}
                  </span>
                )}
              </div>
              {!isDeleted && deal && (
                <p className="text-sm text-gray-500 mt-1">
                  {deal.facility_name && <span>{deal.facility_name}</span>}
                  {deal.city && deal.state && (
                    <span className="ml-2">{deal.city}, {deal.state}</span>
                  )}
                </p>
              )}
              <p className="text-xs text-gray-400 mt-1">
                Saved {formatDate(item.created_at)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isDeleted && (
              <button
                onClick={() => navigate(`/deals/${item.deal_id}`)}
                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="View Deal"
              >
                <ExternalLink size={18} />
              </button>
            )}
            <button
              onClick={() => handleRemove(item.id, 'deals')}
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Remove"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>

        {/* Note section */}
        {renderNoteSection(item, 'deals')}
      </div>
    );
  };

  const renderFacilityCard = (item) => {
    const facility = item.facility;
    const isDeleted = facility?.deleted;
    const source = facility?.source;

    return (
      <div
        key={item.id}
        className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow ${
          isDeleted ? 'opacity-60' : ''
        }`}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Building2 size={20} className="text-purple-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900 truncate">
                  {isDeleted ? 'Deleted Facility' : facility?.facility_name || 'Unknown Facility'}
                </h3>
                {source && (
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                    source === 'deal' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                  }`}>
                    {source === 'deal' ? 'Deal' : facility?.facility_type || 'Market'}
                  </span>
                )}
              </div>
              {!isDeleted && facility && (
                <p className="text-sm text-gray-500 mt-1">
                  {facility.city && facility.state && (
                    <span>{facility.city}, {facility.state}</span>
                  )}
                  {facility.bed_count && (
                    <span className="ml-2">• {facility.bed_count} beds</span>
                  )}
                </p>
              )}
              <p className="text-xs text-gray-400 mt-1">
                Saved {formatDate(item.created_at)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleRemove(item.id, 'facilities')}
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Remove"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>

        {/* Note section */}
        {renderNoteSection(item, 'facilities')}
      </div>
    );
  };

  const renderMarketCard = (item) => {
    return (
      <div
        key={item.id}
        className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <div className="p-2 bg-green-100 rounded-lg">
              <MapPin size={20} className="text-green-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900">
                {item.market_county}, {item.market_state}
              </h3>
              {item.market_cbsa_code && (
                <p className="text-sm text-gray-500 mt-1">
                  CBSA: {item.market_cbsa_code}
                </p>
              )}
              <p className="text-xs text-gray-400 mt-1">
                Saved {formatDate(item.created_at)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(`/market-analysis?state=${item.market_state}&county=${item.market_county}`)}
              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="View Market"
            >
              <ExternalLink size={18} />
            </button>
            <button
              onClick={() => handleRemove(item.id, 'markets')}
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Remove"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>

        {/* Note section */}
        {renderNoteSection(item, 'markets')}
      </div>
    );
  };

  const renderOwnershipGroupCard = (item) => {
    return (
      <div
        key={item.id}
        className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Users size={20} className="text-orange-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900">
                {item.ownership_group_name}
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                Saved {formatDate(item.created_at)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(`/ownership-research?owner=${encodeURIComponent(item.ownership_group_name)}`)}
              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="View Owner"
            >
              <ExternalLink size={18} />
            </button>
            <button
              onClick={() => handleRemove(item.id, 'ownershipGroups')}
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Remove"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>

        {/* Note section */}
        {renderNoteSection(item, 'ownershipGroups')}
      </div>
    );
  };

  const renderCmsFacilityCard = (item) => {
    return (
      <div
        key={item.id}
        className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <div className="p-2 bg-teal-100 rounded-lg">
              <Building2 size={20} className="text-teal-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900 truncate">
                  {item.facility_name || 'Unknown Facility'}
                </h3>
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-teal-100 text-teal-800">
                  SNF
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                CCN: {item.ccn}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Saved {formatDate(item.created_at)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(`/operator/${item.ccn}`)}
              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="View Facility"
            >
              <ExternalLink size={18} />
            </button>
            <button
              onClick={() => handleRemove(item.id, 'cmsFacilities')}
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Remove"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>

        {/* Note section */}
        {renderNoteSection(item, 'cmsFacilities')}
      </div>
    );
  };

  const renderNoteSection = (item, type) => {
    const isEditing = editingNote === item.id;
    const isExpanded = expandedNotes[item.id];
    const hasNote = item.note && item.note.length > 0;
    const isLongNote = item.note && item.note.length > 100;

    if (isEditing) {
      return (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            rows={2}
            placeholder="Add a note..."
            autoFocus
          />
          <div className="flex justify-end gap-2 mt-2">
            <button
              onClick={() => { setEditingNote(null); setNoteText(''); }}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={() => handleUpdateNote(item.id, type)}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Save Note
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="mt-3 pt-3 border-t border-gray-100">
        {hasNote ? (
          <div className="flex items-start gap-2">
            <StickyNote size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className={`text-sm text-gray-600 ${!isExpanded && isLongNote ? 'line-clamp-2' : ''}`}>
                {item.note}
              </p>
              {isLongNote && (
                <button
                  onClick={() => toggleNoteExpand(item.id)}
                  className="text-xs text-blue-600 hover:text-blue-700 mt-1 flex items-center gap-1"
                >
                  {isExpanded ? (
                    <>Show less <ChevronUp size={12} /></>
                  ) : (
                    <>Show more <ChevronDown size={12} /></>
                  )}
                </button>
              )}
            </div>
            <button
              onClick={() => startEditNote(item.id, item.note)}
              className="text-xs text-gray-400 hover:text-blue-600"
            >
              Edit
            </button>
          </div>
        ) : (
          <button
            onClick={() => startEditNote(item.id, '')}
            className="text-sm text-gray-400 hover:text-blue-600 flex items-center gap-1"
          >
            <StickyNote size={14} />
            Add a note
          </button>
        )}
      </div>
    );
  };

  const getFilteredItems = () => {
    if (activeTab === 'all') {
      return {
        deals: savedItems.deals,
        facilities: savedItems.facilities,
        cmsFacilities: savedItems.cmsFacilities,
        markets: savedItems.markets,
        ownershipGroups: savedItems.ownershipGroups
      };
    }
    return {
      deals: activeTab === 'deals' ? savedItems.deals : [],
      facilities: activeTab === 'facilities' ? savedItems.facilities : [],
      cmsFacilities: activeTab === 'cmsFacilities' ? savedItems.cmsFacilities : [],
      markets: activeTab === 'markets' ? savedItems.markets : [],
      ownershipGroups: activeTab === 'ownershipGroups' ? savedItems.ownershipGroups : []
    };
  };

  const filteredItems = getFilteredItems();
  const hasItems = filteredItems.deals.length + filteredItems.facilities.length + filteredItems.cmsFacilities.length + filteredItems.markets.length + filteredItems.ownershipGroups.length > 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-blue-100 rounded-lg">
          <Bookmark size={24} className="text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Saved Items</h1>
          <p className="text-sm text-gray-500">
            {counts.total} item{counts.total !== 1 ? 's' : ''} saved for later review
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {Icon && <Icon size={16} />}
              {tab.label}
              <span className={`px-2 py-0.5 rounded-full text-xs ${
                activeTab === tab.id
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-600'
              }`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Items */}
      {!hasItems ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Bookmark size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No saved items</h3>
          <p className="text-gray-500 max-w-sm mx-auto">
            Save deals, facilities, and markets to review them later. Look for the bookmark icon throughout the app.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Deals Section */}
          {filteredItems.deals.length > 0 && (
            <div>
              {activeTab === 'all' && (
                <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Handshake size={20} className="text-blue-600" />
                  Deals ({filteredItems.deals.length})
                </h2>
              )}
              <div className="space-y-3">
                {filteredItems.deals.map(renderDealCard)}
              </div>
            </div>
          )}

          {/* Deal Facilities Section */}
          {filteredItems.facilities.length > 0 && (
            <div>
              {activeTab === 'all' && (
                <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Building2 size={20} className="text-purple-600" />
                  Deal Facilities ({filteredItems.facilities.length})
                </h2>
              )}
              <div className="space-y-3">
                {filteredItems.facilities.map(renderFacilityCard)}
              </div>
            </div>
          )}

          {/* CMS/SNF Facilities Section */}
          {filteredItems.cmsFacilities.length > 0 && (
            <div>
              {activeTab === 'all' && (
                <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Building2 size={20} className="text-teal-600" />
                  SNF Facilities ({filteredItems.cmsFacilities.length})
                </h2>
              )}
              <div className="space-y-3">
                {filteredItems.cmsFacilities.map(renderCmsFacilityCard)}
              </div>
            </div>
          )}

          {/* Markets Section */}
          {filteredItems.markets.length > 0 && (
            <div>
              {activeTab === 'all' && (
                <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <MapPin size={20} className="text-green-600" />
                  Markets ({filteredItems.markets.length})
                </h2>
              )}
              <div className="space-y-3">
                {filteredItems.markets.map(renderMarketCard)}
              </div>
            </div>
          )}

          {/* Ownership Groups Section */}
          {filteredItems.ownershipGroups.length > 0 && (
            <div>
              {activeTab === 'all' && (
                <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Users size={20} className="text-orange-600" />
                  Ownership Groups ({filteredItems.ownershipGroups.length})
                </h2>
              )}
              <div className="space-y-3">
                {filteredItems.ownershipGroups.map(renderOwnershipGroupCard)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SavedItems;
