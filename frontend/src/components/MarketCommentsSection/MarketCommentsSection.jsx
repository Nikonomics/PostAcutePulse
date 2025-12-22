import React, { useState, useEffect } from 'react';
import { MessageCircle, Send, Trash2, Reply, User, ChevronDown, ChevronUp } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'react-toastify';
import { getMarketComments, addMarketComment, deleteMarketComment } from '../../api/marketService';
import MentionInput from '../common/MentionInput';
import { useAuth } from '../../context/UserContext';
import './MarketCommentsSection.css';

const MarketCommentsSection = ({ state, county }) => {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [mentionedUserIds, setMentionedUserIds] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [replyMentions, setReplyMentions] = useState([]);
  const [expandedReplies, setExpandedReplies] = useState({});

  useEffect(() => {
    if (state && county) {
      loadComments();
    }
  }, [state, county]);

  const loadComments = async () => {
    try {
      setLoading(true);
      const response = await getMarketComments(state, county);
      if (response.success) {
        setComments(response.comments || []);
      }
    } catch (error) {
      console.error('Failed to load comments:', error);
      toast.error('Failed to load comments');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setSubmitting(true);
    try {
      const response = await addMarketComment(state, county, {
        comment: newComment,
        mentioned_user_ids: mentionedUserIds
      });

      if (response.success) {
        setComments([response.comment, ...comments]);
        setNewComment('');
        setMentionedUserIds([]);
        toast.success('Comment added');
      }
    } catch (error) {
      console.error('Failed to add comment:', error);
      toast.error('Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitReply = async (parentId) => {
    if (!replyText.trim()) return;

    setSubmitting(true);
    try {
      const response = await addMarketComment(state, county, {
        comment: replyText,
        parent_id: parentId,
        mentioned_user_ids: replyMentions
      });

      if (response.success) {
        // Add reply to parent comment
        setComments(comments.map(c => {
          if (c.id === parentId) {
            return {
              ...c,
              replies: [...(c.replies || []), response.comment]
            };
          }
          return c;
        }));
        setReplyingTo(null);
        setReplyText('');
        setReplyMentions([]);
        setExpandedReplies({ ...expandedReplies, [parentId]: true });
        toast.success('Reply added');
      }
    } catch (error) {
      console.error('Failed to add reply:', error);
      toast.error('Failed to add reply');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId, parentId = null) => {
    if (!window.confirm('Are you sure you want to delete this comment?')) return;

    try {
      const response = await deleteMarketComment(state, county, commentId);
      if (response.success) {
        if (parentId) {
          // Remove reply from parent
          setComments(comments.map(c => {
            if (c.id === parentId) {
              return {
                ...c,
                replies: c.replies.filter(r => r.id !== commentId)
              };
            }
            return c;
          }));
        } else {
          // Remove top-level comment
          setComments(comments.filter(c => c.id !== commentId));
        }
        toast.success('Comment deleted');
      }
    } catch (error) {
      console.error('Failed to delete comment:', error);
      toast.error('Failed to delete comment');
    }
  };

  const toggleReplies = (commentId) => {
    setExpandedReplies({
      ...expandedReplies,
      [commentId]: !expandedReplies[commentId]
    });
  };

  const renderComment = (comment, isReply = false, parentId = null) => {
    const canDelete = user && (user.id === comment.user_id || user.role === 'admin');
    const hasReplies = comment.replies && comment.replies.length > 0;
    const showReplies = expandedReplies[comment.id];

    return (
      <div key={comment.id} className={`market-comment ${isReply ? 'reply' : ''}`}>
        <div className="comment-header">
          <div className="comment-user">
            {comment.user?.profile_url ? (
              <img src={comment.user.profile_url} alt="" className="user-avatar" />
            ) : (
              <div className="user-avatar-placeholder">
                <User size={16} />
              </div>
            )}
            <span className="user-name">
              {comment.user ? `${comment.user.first_name} ${comment.user.last_name}` : 'Unknown User'}
            </span>
          </div>
          <span className="comment-time">
            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
          </span>
        </div>

        <div className="comment-body">
          {comment.comment}
        </div>

        <div className="comment-actions">
          {!isReply && (
            <button
              className="action-btn"
              onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
            >
              <Reply size={14} />
              Reply
            </button>
          )}
          {canDelete && (
            <button
              className="action-btn delete"
              onClick={() => handleDeleteComment(comment.id, parentId)}
            >
              <Trash2 size={14} />
              Delete
            </button>
          )}
        </div>

        {/* Reply input */}
        {replyingTo === comment.id && (
          <div className="reply-form">
            <MentionInput
              value={replyText}
              onChange={setReplyText}
              onMentionsChange={setReplyMentions}
              placeholder="Write a reply... Use @ to mention someone"
              className="reply-input"
              rows={2}
            />
            <div className="reply-actions">
              <button
                className="btn-cancel"
                onClick={() => {
                  setReplyingTo(null);
                  setReplyText('');
                  setReplyMentions([]);
                }}
              >
                Cancel
              </button>
              <button
                className="btn-submit"
                onClick={() => handleSubmitReply(comment.id)}
                disabled={!replyText.trim() || submitting}
              >
                <Send size={14} />
                Reply
              </button>
            </div>
          </div>
        )}

        {/* Show replies toggle */}
        {hasReplies && (
          <button
            className="toggle-replies"
            onClick={() => toggleReplies(comment.id)}
          >
            {showReplies ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {showReplies ? 'Hide' : 'Show'} {comment.replies.length} {comment.replies.length === 1 ? 'reply' : 'replies'}
          </button>
        )}

        {/* Replies */}
        {showReplies && hasReplies && (
          <div className="replies-container">
            {comment.replies.map(reply => renderComment(reply, true, comment.id))}
          </div>
        )}
      </div>
    );
  };

  if (!state || !county) {
    return null;
  }

  return (
    <div className="market-comments-section">
      <div className="comments-header">
        <h3>
          <MessageCircle size={20} />
          Market Discussion
        </h3>
        <span className="comment-count">{comments.length}</span>
      </div>

      {/* Add comment form */}
      <form onSubmit={handleSubmitComment} className="add-comment-form">
        <MentionInput
          value={newComment}
          onChange={setNewComment}
          onMentionsChange={setMentionedUserIds}
          placeholder={`Add a comment about ${county} County, ${state}... Use @ to mention someone`}
          className="comment-textarea"
          rows={3}
        />
        <div className="form-actions">
          <button
            type="submit"
            className="submit-btn"
            disabled={!newComment.trim() || submitting}
          >
            {submitting ? (
              <>
                <div className="spinner"></div>
                Posting...
              </>
            ) : (
              <>
                <Send size={16} />
                Post Comment
              </>
            )}
          </button>
        </div>
      </form>

      {/* Comments list */}
      <div className="comments-list">
        {loading ? (
          <div className="comments-loading">
            <div className="spinner"></div>
            Loading comments...
          </div>
        ) : comments.length === 0 ? (
          <div className="comments-empty">
            <MessageCircle size={32} />
            <p>No comments yet</p>
            <span>Be the first to comment on this market</span>
          </div>
        ) : (
          comments.map(comment => renderComment(comment))
        )}
      </div>
    </div>
  );
};

export default MarketCommentsSection;
