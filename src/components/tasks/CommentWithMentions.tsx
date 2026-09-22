import React from 'react';
import { cn } from '@/lib/utils';

interface CommentWithMentionsProps {
  content: string;
  className?: string;
}

/**
 * Renders comment content with highlighted @mentions
 */
export function CommentWithMentions({ content, className }: CommentWithMentionsProps) {
  // Split content by @mention pattern
  const parts = content.split(/(@\w+)/g);
  
  return (
    <p className={cn('text-sm mt-1 whitespace-pre-wrap', className)}>
      {parts.map((part, index) => {
        if (part.startsWith('@')) {
          return (
            <span
              key={index}
              className="bg-primary/10 text-primary font-medium rounded px-0.5"
            >
              {part}
            </span>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </p>
  );
}
