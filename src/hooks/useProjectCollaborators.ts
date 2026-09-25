import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export type ProjectRole = "owner" | "editor" | "viewer";

export interface Collaborator {
  id: string;
  projectId: string;
  userId: string;
  role: ProjectRole;
  invitedBy: string | null;
  invitedAt: string;
  acceptedAt: string | null;
  profile?: {
    fullName: string | null;
    email: string | null;
    avatarUrl: string | null;
  };
}

export function useProjectCollaborators(projectId: string | undefined) {
  const { user } = useAuth();
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [myRole, setMyRole] = useState<ProjectRole | "owner" | null>(null);

  const fetchCollaborators = useCallback(async () => {
    if (!projectId || !user) return;

    setIsLoading(true);
    try {
      // Check if user is project owner
      const { data: project } = await supabase
        .from("projects")
        .select("user_id")
        .eq("id", projectId)
        .single();

      const isOwner = project?.user_id === user.id;
      
      // Fetch collaborators
      const { data, error } = await supabase
        .from("project_collaborators")
        .select("*")
        .eq("project_id", projectId);

      if (error) throw error;

      // Fetch profiles for collaborators
      const userIds = data?.map((c) => c.user_id) || [];
      if (isOwner && project?.user_id) {
        userIds.push(project.user_id);
      }

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", userIds);

      const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

      const mapped: Collaborator[] = (data || []).map((c) => ({
        id: c.id,
        projectId: c.project_id,
        userId: c.user_id,
        role: c.role as ProjectRole,
        invitedBy: c.invited_by,
        invitedAt: c.invited_at,
        acceptedAt: c.accepted_at,
        profile: profileMap.get(c.user_id)
          ? {
              fullName: profileMap.get(c.user_id)!.full_name,
              email: null,
              avatarUrl: profileMap.get(c.user_id)!.avatar_url,
            }
          : undefined,
      }));

      // Add owner as first collaborator
      if (isOwner && project?.user_id) {
        const ownerProfile = profileMap.get(project.user_id);
        mapped.unshift({
          id: "owner",
          projectId,
          userId: project.user_id,
          role: "owner",
          invitedBy: null,
          invitedAt: "",
          acceptedAt: null,
          profile: ownerProfile
            ? {
                fullName: ownerProfile.full_name,
                email: null,
                avatarUrl: ownerProfile.avatar_url,
              }
            : undefined,
        });
      }

      setCollaborators(mapped);

      // Determine my role
      if (isOwner) {
        setMyRole("owner");
      } else {
        const myCollab = data?.find((c) => c.user_id === user.id);
        setMyRole(myCollab ? (myCollab.role as ProjectRole) : null);
      }
    } catch (error) {
      console.error("Error fetching collaborators:", error);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, user]);

  useEffect(() => {
    fetchCollaborators();
  }, [fetchCollaborators]);

  const inviteCollaborator = async (email: string, role: ProjectRole) => {
    if (!projectId || !user) throw new Error("Missing project or user");

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Check if user already exists in profiles
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("email", normalizedEmail)
      .single();

    if (existingProfile) {
      // User exists - add them directly as collaborator
      const { error } = await supabase.from("project_collaborators").insert({
        project_id: projectId,
        user_id: existingProfile.id,
        role,
        invited_by: user.id,
        accepted_at: new Date().toISOString(),
      });

      if (error) {
        if (error.code === "23505") {
          throw new Error("Cet utilisateur est déjà collaborateur sur ce projet.");
        }
        throw error;
      }

      // La notification est créée par le trigger notify_on_collaboration
      // (SECURITY DEFINER) ; l'INSERT client direct est désormais refusé
      // par la RLS et créait un doublon.

      await fetchCollaborators();
      return { type: "added", email: normalizedEmail };
    }

    // 2. User doesn't exist - create pending invitation
    const { data: invitation, error: inviteError } = await supabase
      .from("pending_invitations")
      .insert({
        email: normalizedEmail,
        project_id: projectId,
        role,
        invited_by: user.id,
      })
      .select("id")
      .single();

    if (inviteError) {
      if (inviteError.code === "23505") {
        throw new Error("Une invitation a déjà été envoyée à cet email.");
      }
      throw inviteError;
    }

    // 3. Send invitation email — le destinataire est résolu côté serveur
    // à partir de l'invitation en base (plus de "to" libre).
    try {
      await supabase.functions.invoke("send-email", {
        body: {
          templateType: "collaboration_invite",
          data: { invitationId: invitation.id },
        },
      });

    toast.success(`Invitation envoyée à ${normalizedEmail}`);
    } catch (emailError) {
      // Email failed but invitation is saved
      toast.warning("Invitation créée, mais l'email n'a pas pu être envoyé.");
    }

    return { type: "pending", email: normalizedEmail };
  };

  const addCollaboratorByUserId = async (userId: string, role: ProjectRole) => {
    if (!projectId || !user) throw new Error("Missing project or user");

    const { error } = await supabase.from("project_collaborators").insert({
      project_id: projectId,
      user_id: userId,
      role,
      invited_by: user.id,
      accepted_at: new Date().toISOString(),
    });

    if (error) throw error;
    await fetchCollaborators();
  };

  const removeCollaborator = async (collaboratorId: string) => {
    if (collaboratorId === "owner") {
      throw new Error("Impossible de retirer le propriétaire");
    }

    const { error } = await supabase
      .from("project_collaborators")
      .delete()
      .eq("id", collaboratorId);

    if (error) throw error;
    await fetchCollaborators();
  };

  const updateCollaboratorRole = async (collaboratorId: string, newRole: ProjectRole) => {
    if (collaboratorId === "owner") {
      throw new Error("Impossible de modifier le rôle du propriétaire");
    }

    const { error } = await supabase
      .from("project_collaborators")
      .update({ role: newRole })
      .eq("id", collaboratorId);

    if (error) throw error;
    await fetchCollaborators();
  };

  const canManageCollaborators = myRole === "owner";
  const canEdit = myRole === "owner" || myRole === "editor";

  return {
    collaborators,
    isLoading,
    myRole,
    canManageCollaborators,
    canEdit,
    inviteCollaborator,
    addCollaboratorByUserId,
    removeCollaborator,
    updateCollaboratorRole,
    refetch: fetchCollaborators,
  };
}
