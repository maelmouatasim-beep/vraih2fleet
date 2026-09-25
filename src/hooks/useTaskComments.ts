import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { TaskComment, TaskCommentRow, rowToTaskComment, UserProfile } from '@/types/project-management';

export function useTaskComments(taskId: string | undefined) {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  const fetchComments = useCallback(async () => {
    if (!taskId) {
      setComments([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('task_comments')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const commentsData = (data || []).map((row: TaskCommentRow) => rowToTaskComment(row));

      // Fetch user profiles for comments
      const userIds = [...new Set(commentsData.map(c => c.userId))];
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', userIds);

        const profileMap = new Map<string, UserProfile>();
        (profiles || []).forEach(p => {
          profileMap.set(p.id, {
            id: p.id,
            fullName: p.full_name,
            avatarUrl: p.avatar_url,
          });
        });

        commentsData.forEach(comment => {
          comment.user = profileMap.get(comment.userId);
        });
      }

      setComments(commentsData);
    } catch (error) {
      console.error('Error fetching task comments:', error);
    } finally {
      setIsLoading(false);
    }
  }, [taskId]);

  // Subscribe to realtime changes
  useEffect(() => {
    if (!taskId) return;

    fetchComments();

    const channel = supabase
      .channel(`task-comments-${taskId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_comments',
          filter: `task_id=eq.${taskId}`,
        },
        () => {
          fetchComments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [taskId, fetchComments]);

  // Parse @mentions from content
  const parseMentions = (content: string, collaborators: UserProfile[]): string[] => {
    const mentionRegex = /@(\w+)/g;
    const matches: string[] = content.match(mentionRegex) ?? [];
    const mentionedIds: string[] = [];

    matches.forEach(match => {
      const name = match.slice(1).toLowerCase();
      const matchedUser = collaborators.find(
        c => c.fullName?.toLowerCase().includes(name)
      );
      if (matchedUser) {
        mentionedIds.push(matchedUser.id);
      }
    });

    return mentionedIds;
  };

  // Send email notification for mentions
  const sendMentionEmails = async (
    mentionedIds: string[],
    content: string
  ) => {
    // Le serveur résout l'email du mentionné, vérifie son appartenance au
    // projet et ses préférences de notification (la RLS de profiles ne
    // permet pas de lire les emails d'autrui côté client).
    for (const mentionedUserId of mentionedIds) {
      try {
        await supabase.functions.invoke('send-email', {
          body: {
            templateType: 'task_mention',
            data: {
              taskId,
              mentionedUserId,
              commentPreview: content.length > 300 ? content.slice(0, 297) + '...' : content,
            },
          },
        });
      } catch (err) {
        console.error('Error sending mention email:', err);
      }
    }
  };

  // Add a comment
  const addComment = async (content: string, collaborators: UserProfile[] = []): Promise<boolean> => {
    if (!user || !taskId) {
      toast.error('Vous devez être connecté');
      return false;
    }

    if (!content.trim()) {
      toast.error('Le commentaire ne peut pas être vide');
      return false;
    }

    try {
      const mentions = parseMentions(content, collaborators);

      // Get task info for email
      const { data: task } = await supabase
        .from('tasks')
        .select('title, project_id')
        .eq('id', taskId)
        .single();

      const { error } = await supabase
        .from('task_comments')
        .insert({
          task_id: taskId,
          user_id: user.id,
          content: content.trim(),
          mentions,
        });

      if (error) throw error;

      // Send email notifications for mentions (fire and forget)
      if (mentions.length > 0 && task) {
        sendMentionEmails(mentions, content);
      }

      return true;
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error('Erreur lors de l\'ajout du commentaire');
      return false;
    }
  };

  // Update a comment
  const updateComment = async (commentId: string, content: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('task_comments')
        .update({ content: content.trim() })
        .eq('id', commentId);

      if (error) throw error;

      toast.success('Commentaire modifié');
      return true;
    } catch (error) {
      console.error('Error updating comment:', error);
      toast.error('Erreur lors de la modification');
      return false;
    }
  };

  // Delete a comment
  const deleteComment = async (commentId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('task_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;

      toast.success('Commentaire supprimé');
      return true;
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast.error('Erreur lors de la suppression');
      return false;
    }
  };

  return {
    comments,
    isLoading,
    addComment,
    updateComment,
    deleteComment,
    refetch: fetchComments,
  };
}
