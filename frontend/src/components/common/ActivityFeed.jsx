import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  MessageSquare,
  FileText,
  RefreshCw,
  TrendingUp,
  UserPlus,
  UserMinus,
  Clock,
  ChevronDown,
  Filter,
  Handshake
} from 'lucide-react';
import { getActivityFeed } from '../../api/savedItemsService';

/**
 * ActivityFeed Component
 * Displays activity for deals the user is associated with
 *
 * Props:
 * - limit: number - Initial items to show (default 10)
 * - showFilters: boolean - Show filter buttons (default true)
 * - compact: boolean - Compact view for embedding (default false)
 */
const ActivityFeed = ({ limit = 10, showFilters = true, compact = false }) => {
  const navigate = useNavigate();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [selectedTypes, setSelectedTypes] = useState([]);

  const activityTypes = [
    { id: 'comment_added', label: 'Comments', icon: MessageSquare },
    { id: 'document_added', label: 'Documents', icon: FileText },
    { id: 'field_update', label: 'Updates', icon: RefreshCw },
    { id: 'status_change', label: 'Status', icon: TrendingUp },
    { id: 'team_member_added', label: 'Team Added', icon: UserPlus },
    { id: 'team_member_removed', label: 'Team Removed', icon: UserMinus },
  ];

  useEffect(() => {
    fetchActivities(true);
  }, [selectedTypes]);

  const fetchActivities = async (reset = false) => {
    try {
      if (reset) {
        setLoading(true);
        setOffset(0);
      } else {
        setLoadingMore(true);
      }

      const newOffset = reset ? 0 : offset;
      const response = await getActivityFeed({
        limit,
        offset: newOffset,
        types: selectedTypes.length > 0 ? selectedTypes : undefined
      });

      if (response.success) {
        if (reset) {
          setActivities(response.data.activities);
        } else {
          setActivities(prev => [...prev, ...response.data.activities]);
        }
        setTotal(response.data.total);
        setHasMore(response.data.hasMore);
        setOffset(newOffset + response.data.activities.length);
      }
    } catch (error) {
      toast.error('Failed to load activity feed');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      fetchActivities(false);
    }
  };

  const toggleFilter = (typeId) => {
    setSelectedTypes(prev =>
      prev.includes(typeId)
        ? prev.filter(t => t !== typeId)
        : [...prev, typeId]
    );
  };

  const getActivityIcon = (type) => {
    switch (type) {
      case 'comment_added': return <MessageSquare size={16} className="text-blue-500" />;
      case 'document_added': return <FileText size={16} className="text-green-500" />;
      case 'field_update': return <RefreshCw size={16} className="text-orange-500" />;
      case 'status_change': return <TrendingUp size={16} className="text-purple-500" />;
      case 'team_member_added': return <UserPlus size={16} className="text-teal-500" />;
      case 'team_member_removed': return <UserMinus size={16} className="text-red-500" />;
      default: return <Clock size={16} className="text-gray-500" />;
    }
  };

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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

  const handleActivityClick = (activity) => {
    navigate(`/deals/deal-detail/${activity.deal_id}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className={compact ? '' : 'bg-white rounded-lg shadow-sm border border-gray-200'}>
      {/* Header & Filters */}
      {showFilters && (
        <div className={`border-b border-gray-200 ${compact ? 'pb-3 mb-3' : 'p-4'}`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Clock size={18} className="text-gray-500" />
              Recent Activity
              <span className="text-sm font-normal text-gray-500">({total})</span>
            </h3>
          </div>

          <div className="flex flex-wrap gap-2">
            {activityTypes.map(type => {
              const Icon = type.icon;
              const isActive = selectedTypes.includes(type.id);
              return (
                <button
                  key={type.id}
                  onClick={() => toggleFilter(type.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-100 text-blue-700 border border-blue-300'
                      : 'bg-gray-100 text-gray-600 border border-transparent hover:bg-gray-200'
                  }`}
                >
                  <Icon size={12} />
                  {type.label}
                </button>
              );
            })}
            {selectedTypes.length > 0 && (
              <button
                onClick={() => setSelectedTypes([])}
                className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      )}

      {/* Activity List */}
      <div className={compact ? '' : 'p-4'}>
        {activities.length === 0 ? (
          <div className="text-center py-8">
            <Clock size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No activity to show</p>
            <p className="text-sm text-gray-400 mt-1">
              Updates from your associated deals will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {activities.map(activity => (
              <div
                key={activity.id}
                onClick={() => handleActivityClick(activity)}
                className="flex gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors group"
              >
                {/* Icon */}
                <div className="flex-shrink-0 mt-0.5">
                  {getActivityIcon(activity.change_type)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">
                        {activity.message}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="flex items-center gap-1 text-xs text-blue-600 font-medium">
                          <Handshake size={12} />
                          {activity.deal_name}
                        </span>
                        {activity.deal_status && (
                          <span className={`px-1.5 py-0.5 rounded text-xs ${getStatusColor(activity.deal_status)}`}>
                            {activity.deal_status}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      {formatTimeAgo(activity.created_at)}
                    </span>
                  </div>

                  {/* Additional details for certain types */}
                  {activity.change_type === 'field_update' && activity.field_label && (
                    <p className="text-xs text-gray-500 mt-1">
                      Changed <span className="font-medium">{activity.field_label}</span>
                      {activity.old_value && activity.new_value && (
                        <span> from "{activity.old_value}" to "{activity.new_value}"</span>
                      )}
                    </p>
                  )}

                  {activity.metadata?.comment_preview && (
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                      "{activity.metadata.comment_preview}"
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Load More */}
        {hasMore && (
          <div className="mt-4 text-center">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="flex items-center gap-2 mx-auto px-4 py-2 text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50"
            >
              {loadingMore ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                  Loading...
                </>
              ) : (
                <>
                  <ChevronDown size={16} />
                  Load more
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityFeed;
