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
    const matches = content.match(mentionRegex) || [];
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
    collaborators: UserProfile[],
    content: string,
    taskTitle: string,
    projectId: string
  ) => {
    // Get project name
    const { data: project } = await supabase
      .from('projects')
      .select('name')
      .eq('id', projectId)
      .single();

    // Get author name
    const authorName = collaborators.find(c => c.id === user?.id)?.fullName || 'Someone';
    
    // Get emails of mentioned users
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, email_notifications')
      .in('id', mentionedIds);

    if (!profiles) return;

    const baseUrl = window.location.origin;
    const taskUrl = `${baseUrl}/dashboard/projects/${projectId}/tasks`;

    for (const profile of profiles) {
      if (!profile.email) continue;
      
      // Check if user has comment notifications enabled
      const emailPrefs = profile.email_notifications as Record<string, boolean> | null;
      if (emailPrefs?.comment_replies === false) continue;

      try {
        await supabase.functions.invoke('send-email', {
          body: {
            to: profile.email,
            subject: `@${authorName} vous a mentionné sur "${taskTitle}"`,
            htmlContent: '',
            templateType: 'task_mention',
            data: {
              taskTitle,
              mentionerName: authorName,
              commentPreview: content.length > 100 ? content.slice(0, 100) + '...' : content,
              taskUrl,
              projectName: project?.name || 'Project',
              lang: 'fr',
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
        sendMentionEmails(mentions, collaborators, content, task.title, task.project_id);
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
