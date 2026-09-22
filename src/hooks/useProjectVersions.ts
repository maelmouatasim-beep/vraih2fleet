import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface ProjectVersion {
  id: string;
  projectId: string;
  createdBy: string;
  versionName: string;
  versionNote: string | null;
  snapshot: {
    project: any;
    scenarios: any[];
  };
  createdAt: string;
  profile?: {
    fullName: string | null;
    avatarUrl: string | null;
  };
}

export function useProjectVersions(projectId: string | undefined) {
  const { user } = useAuth();
  const [versions, setVersions] = useState<ProjectVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchVersions = useCallback(async () => {
    if (!projectId) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("project_versions")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch profiles for version creators
      const userIds = [...new Set(data?.map((v) => v.created_by) || [])];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", userIds);

      const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

      const mapped: ProjectVersion[] = (data || []).map((v) => ({
        id: v.id,
        projectId: v.project_id,
        createdBy: v.created_by,
        versionName: v.version_name,
        versionNote: v.version_note,
        snapshot: v.snapshot as { project: any; scenarios: any[] },
        createdAt: v.created_at,
        profile: profileMap.get(v.created_by)
          ? {
              fullName: profileMap.get(v.created_by)!.full_name,
              avatarUrl: profileMap.get(v.created_by)!.avatar_url,
            }
          : undefined,
      }));

      setVersions(mapped);
    } catch (error) {
      console.error("Error fetching versions:", error);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchVersions();
  }, [fetchVersions]);

  const createVersion = async (name: string, note?: string) => {
    if (!projectId || !user) throw new Error("Missing project or user");

    // Fetch current project state
    const { data: project } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single();

    const { data: scenarios } = await supabase
      .from("scenarios")
      .select("*")
      .eq("project_id", projectId);

    const snapshot = {
      project,
      scenarios: scenarios || [],
    };

    const { data, error } = await supabase
      .from("project_versions")
      .insert({
        project_id: projectId,
        created_by: user.id,
        version_name: name,
        version_note: note || null,
        snapshot,
      })
      .select()
      .single();

    if (error) throw error;
    await fetchVersions();
    return data;
  };

  const restoreVersion = async (versionId: string) => {
    if (!projectId || !user) throw new Error("Missing project or user");

    const version = versions.find((v) => v.id === versionId);
    if (!version) throw new Error("Version not found");

    // Create a new version with current state before restoring
    await createVersion(
      `Avant restauration vers ${version.versionName}`,
      "Sauvegarde automatique avant restauration"
    );

    // Restore project settings
    if (version.snapshot.project) {
      const { error: projectError } = await supabase
        .from("projects")
        .update({
          name: version.snapshot.project.name,
          description: version.snapshot.project.description,
          country_or_region: version.snapshot.project.country_or_region,
          currency: version.snapshot.project.currency,
          default_analysis_horizon_years: version.snapshot.project.default_analysis_horizon_years,
          default_discount_rate: version.snapshot.project.default_discount_rate,
        })
        .eq("id", projectId);

      if (projectError) throw projectError;
    }

    // Note: Full scenario restoration would require more complex logic
    // For now, we only restore project-level settings

    await fetchVersions();
  };

  const deleteVersion = async (versionId: string) => {
    const { error } = await supabase
      .from("project_versions")
      .delete()
      .eq("id", versionId);

    if (error) throw error;
    await fetchVersions();
  };

  return {
    versions,
    isLoading,
    createVersion,
    restoreVersion,
    deleteVersion,
    refetch: fetchVersions,
  };
}
