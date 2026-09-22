import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface Comment {
  id: string;
  projectId: string;
  userId: string;
  content: string;
  section: string | null;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  profile?: {
    fullName: string | null;
    avatarUrl: string | null;
  };
  replies?: Comment[];
}

export type CommentSection = "general" | "scenarios" | "infrastructure" | "analytics" | "subsidies";

export function useProjectComments(projectId: string | undefined, section?: CommentSection) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchComments = useCallback(async () => {
    if (!projectId) return;

    setIsLoading(true);
    try {
      let query = supabase
        .from("project_comments")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (section) {
        query = query.eq("section", section);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Fetch profiles for comment authors
      const userIds = [...new Set(data?.map((c) => c.user_id) || [])];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", userIds);

      const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

      // Build comment tree
      const commentsMap = new Map<string, Comment>();
      const rootComments: Comment[] = [];

      (data || []).forEach((c) => {
        const comment: Comment = {
          id: c.id,
          projectId: c.project_id,
          userId: c.user_id,
          content: c.content,
          section: c.section,
          parentId: c.parent_id,
          createdAt: c.created_at,
          updatedAt: c.updated_at,
          profile: profileMap.get(c.user_id)
            ? {
                fullName: profileMap.get(c.user_id)!.full_name,
                avatarUrl: profileMap.get(c.user_id)!.avatar_url,
              }
            : undefined,
          replies: [],
        };
        commentsMap.set(c.id, comment);
      });

      // Build tree structure
      commentsMap.forEach((comment) => {
        if (comment.parentId && commentsMap.has(comment.parentId)) {
          commentsMap.get(comment.parentId)!.replies!.push(comment);
        } else if (!comment.parentId) {
          rootComments.push(comment);
        }
      });

      setComments(rootComments);
    } catch (error) {
      console.error("Error fetching comments:", error);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, section]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const addComment = async (content: string, commentSection?: CommentSection, parentId?: string) => {
    if (!projectId || !user) throw new Error("Missing project or user");

    const { data, error } = await supabase
      .from("project_comments")
      .insert({
        project_id: projectId,
        user_id: user.id,
        content,
        section: commentSection || null,
        parent_id: parentId || null,
      })
      .select()
      .single();

    if (error) throw error;
    await fetchComments();
    return data;
  };

  const updateComment = async (commentId: string, content: string) => {
    const { error } = await supabase
      .from("project_comments")
      .update({ content })
      .eq("id", commentId);

    if (error) throw error;
    await fetchComments();
  };

  const deleteComment = async (commentId: string) => {
    const { error } = await supabase
      .from("project_comments")
      .delete()
      .eq("id", commentId);

    if (error) throw error;
    await fetchComments();
  };

  const totalCount = comments.reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0);

  return {
    comments,
    isLoading,
    totalCount,
    addComment,
    updateComment,
    deleteComment,
    refetch: fetchComments,
  };
}
