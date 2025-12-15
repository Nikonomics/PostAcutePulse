import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getActiveUsers } from '../../api/authService';
import { User } from 'lucide-react';

/**
 * MentionInput Component
 * A textarea with @mention autocomplete functionality
 *
 * Props:
 * - value: string - The current text value
 * - onChange: (value: string) => void - Called when text changes
 * - onMentionsChange: (userIds: number[]) => void - Called when mentioned users change
 * - placeholder: string - Placeholder text
 * - className: string - Additional CSS classes
 * - rows: number - Number of rows
 * - disabled: boolean
 */
const MentionInput = ({
  value,
  onChange,
  onMentionsChange,
  placeholder = 'Add a comment... Use @ to mention someone',
  className = '',
  rows = 3,
  disabled = false
}) => {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [mentionedUsers, setMentionedUsers] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const textareaRef = useRef(null);
  const dropdownRef = useRef(null);

  // Fetch users on mount
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await getActiveUsers();
        if (response.success || response.body) {
          setUsers(response.body || response.data || []);
        }
      } catch (error) {
        console.error('Failed to fetch users:', error);
      }
    };
    fetchUsers();
  }, []);

  // Update filtered users when search term changes
  useEffect(() => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const filtered = users.filter(user => {
        const fullName = `${user.first_name} ${user.last_name}`.toLowerCase();
        const email = (user.email || '').toLowerCase();
        return fullName.includes(term) || email.includes(term);
      }).slice(0, 5); // Limit to 5 results
      setFilteredUsers(filtered);
      setSelectedIndex(0);
    } else {
      setFilteredUsers(users.slice(0, 5));
      setSelectedIndex(0);
    }
  }, [searchTerm, users]);

  // Notify parent of mention changes
  useEffect(() => {
    onMentionsChange?.(mentionedUsers.map(u => u.id));
  }, [mentionedUsers, onMentionsChange]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target) &&
          textareaRef.current && !textareaRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart;
    onChange(newValue);

    // Check for @ mention
    const textBeforeCursor = newValue.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      // Check if there's a space before @ or it's at the start
      const charBeforeAt = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : ' ';

      if (charBeforeAt === ' ' || charBeforeAt === '\n' || lastAtIndex === 0) {
        // Check if there's no space after @ (meaning we're still typing the mention)
        const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
        if (!textAfterAt.includes(' ')) {
          setMentionStartIndex(lastAtIndex);
          setSearchTerm(textAfterAt);
          setShowDropdown(true);
          updateDropdownPosition(e.target, lastAtIndex);
          return;
        }
      }
    }

    setShowDropdown(false);
    setMentionStartIndex(-1);
    setSearchTerm('');

    // Re-validate mentioned users (in case text was deleted)
    validateMentions(newValue);
  };

  const validateMentions = (text) => {
    // Check which mentioned users are still in the text
    const stillMentioned = mentionedUsers.filter(user => {
      const mentionText = `@${user.first_name} ${user.last_name}`;
      return text.includes(mentionText);
    });

    if (stillMentioned.length !== mentionedUsers.length) {
      setMentionedUsers(stillMentioned);
    }
  };

  const updateDropdownPosition = (textarea, atIndex) => {
    // Simple positioning - place below the textarea
    const rect = textarea.getBoundingClientRect();
    setDropdownPosition({
      top: rect.height + 4,
      left: 0
    });
  };

  const selectUser = (user) => {
    if (!textareaRef.current) return;

    const mentionText = `@${user.first_name} ${user.last_name} `;
    const beforeMention = value.substring(0, mentionStartIndex);
    const afterCursor = value.substring(textareaRef.current.selectionStart);

    const newValue = beforeMention + mentionText + afterCursor;
    onChange(newValue);

    // Add to mentioned users if not already there
    if (!mentionedUsers.find(u => u.id === user.id)) {
      setMentionedUsers([...mentionedUsers, user]);
    }

    setShowDropdown(false);
    setMentionStartIndex(-1);
    setSearchTerm('');

    // Focus back to textarea and set cursor position
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = beforeMention.length + mentionText.length;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  const handleKeyDown = (e) => {
    if (!showDropdown) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev < filteredUsers.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : 0);
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredUsers[selectedIndex]) {
          selectUser(filteredUsers[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowDropdown(false);
        break;
      case 'Tab':
        if (filteredUsers[selectedIndex]) {
          e.preventDefault();
          selectUser(filteredUsers[selectedIndex]);
        }
        break;
    }
  };

  // Reset mentioned users when value is cleared
  useEffect(() => {
    if (!value || value.trim() === '') {
      setMentionedUsers([]);
    }
  }, [value]);

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none ${className}`}
        rows={rows}
        disabled={disabled}
      />

      {/* Mention Dropdown */}
      {showDropdown && filteredUsers.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-72 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden"
          style={{
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`
          }}
        >
          <div className="py-1">
            {filteredUsers.map((user, index) => (
              <button
                key={user.id}
                onClick={() => selectUser(user)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                  index === selectedIndex
                    ? 'bg-blue-50 text-blue-700'
                    : 'hover:bg-gray-50'
                }`}
              >
                {user.profile_url ? (
                  <img
                    src={user.profile_url}
                    alt=""
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                    <User size={16} className="text-gray-500" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user.first_name} {user.last_name}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {user.email}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Mentioned users indicator */}
      {mentionedUsers.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {mentionedUsers.map(user => (
            <span
              key={user.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full"
            >
              @{user.first_name} {user.last_name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default MentionInput;
