import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { UserProfile } from '@/types/project-management';

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  collaborators: UserProfile[];
  placeholder?: string;
  rows?: number;
  className?: string;
  disabled?: boolean;
}

export function MentionInput({
  value,
  onChange,
  collaborators,
  placeholder,
  rows = 2,
  className,
  disabled = false,
}: MentionInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionQuery, setMentionQuery] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Detect @ mentions
  const checkForMention = useCallback((text: string, cursor: number) => {
    // Look backwards from cursor to find @
    const textBeforeCursor = text.slice(0, cursor);
    const atIndex = textBeforeCursor.lastIndexOf('@');
    
    if (atIndex === -1) {
      setShowSuggestions(false);
      return;
    }

    // Check if there's a space between @ and cursor (would close the mention)
    const textAfterAt = textBeforeCursor.slice(atIndex + 1);
    if (textAfterAt.includes(' ') || textAfterAt.includes('\n')) {
      setShowSuggestions(false);
      return;
    }

    // Check if @ is at start or preceded by whitespace/newline
    if (atIndex > 0 && !/[\s\n]/.test(text[atIndex - 1])) {
      setShowSuggestions(false);
      return;
    }

    setMentionQuery(textAfterAt.toLowerCase());
    setCursorPosition(cursor);

    const filtered = collaborators.filter(user =>
      user.fullName?.toLowerCase().includes(textAfterAt.toLowerCase())
    );

    setFilteredUsers(filtered);
    setShowSuggestions(filtered.length > 0);
    setSelectedIndex(0);
  }, [collaborators]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursor = e.target.selectionStart || 0;
    onChange(newValue);
    checkForMention(newValue, cursor);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showSuggestions) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filteredUsers.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredUsers.length) % filteredUsers.length);
        break;
      case 'Enter':
      case 'Tab':
        if (filteredUsers[selectedIndex]) {
          e.preventDefault();
          selectUser(filteredUsers[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        break;
    }
  };

  const selectUser = (user: UserProfile) => {
    const textBeforeCursor = value.slice(0, cursorPosition);
    const atIndex = textBeforeCursor.lastIndexOf('@');
    const textAfterCursor = value.slice(cursorPosition);
    
    // Replace @query with @FullName 
    const firstName = user.fullName?.split(' ')[0] || 'User';
    const newValue = value.slice(0, atIndex) + `@${firstName} ` + textAfterCursor;
    
    onChange(newValue);
    setShowSuggestions(false);

    // Focus textarea and set cursor position
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = atIndex + firstName.length + 2; // @ + name + space
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  const handleClick = () => {
    if (textareaRef.current) {
      const cursor = textareaRef.current.selectionStart || 0;
      checkForMention(value, cursor);
    }
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative flex-1">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onClick={handleClick}
        placeholder={placeholder}
        rows={rows}
        className={cn('resize-none', className)}
        disabled={disabled}
      />
      
      {showSuggestions && filteredUsers.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute bottom-full left-0 right-0 mb-1 bg-popover border rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto"
        >
          {filteredUsers.map((user, index) => (
            <button
              key={user.id}
              type="button"
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors',
                index === selectedIndex ? 'bg-accent' : 'hover:bg-muted'
              )}
              onClick={() => selectUser(user)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <Avatar className="w-6 h-6">
                <AvatarImage src={user.avatarUrl || undefined} />
                <AvatarFallback className="text-[10px]">
                  {user.fullName?.split(' ').map(n => n[0]).join('') || '?'}
                </AvatarFallback>
              </Avatar>
              <span>{user.fullName || 'User'}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
