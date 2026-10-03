import { tauxDepuisSaisiePourcent } from "@/lib/projectParams";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Plus,
  Search,
  MoreHorizontal,
  FolderKanban,
  Truck,
  Calendar,
  MapPin,
  TrendingUp,
  Eye,
  Pencil,
  Trash2,
  Copy,
  PlayCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Page, PageHeader } from "@/components/layout/Page";
import { availableRegions, availableCurrencies } from "@/data/mockData";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import type { CreateProjectForm } from "@/types";
import {
  createProject,
  deleteProject,
  duplicateProject,
  listProjects,
  type ProjectDTO,
} from "@/lib/supabase/projects";
import { seedDemoProject, getDemoProjectInfo } from "@/lib/demoData";
import { formaterDate, formaterPourcentage } from "@/lib/format";

const Projects = () => {
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [projects, setProjects] = useState<ProjectDTO[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingDemo, setIsLoadingDemo] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newProject, setNewProject] = useState<CreateProjectForm>({
    name: "",
    description: "",
    countryOrRegion: "CA_QC",
    currency: "CAD",
    defaultAnalysisHorizonYears: 10,
    defaultDiscountRate: 0.05,
  });

  useEffect(() => {
    document.title = `${t('pages.projects.title')} | H2Fleet`;
  }, [t]);

  // Open dialog if URL has ?create=true
  useEffect(() => {
    if (searchParams.get("create") === "true") {
      setIsCreateDialogOpen(true);
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  // Load projects from backend for the current user
  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    (async () => {
      try {
        setIsLoadingProjects(true);
        const data = await listProjects();
        if (!cancelled) setProjects(data);
      } catch (error) {
        console.error("Error loading projects:", error);
        if (!cancelled) setProjects([]);
        toast({
          title: t('pages.projects.toast.error'),
          description: t('pages.projects.toast.errorLoading'),
          variant: "destructive",
        });
      } finally {
        if (!cancelled) setIsLoadingProjects(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, t]);

  const filteredProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return projects;

    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) || (p.description ?? "").toLowerCase().includes(q)
    );
  }, [projects, searchQuery]);

  // Vehicle groups are not persisted yet; keep count at 0 for now.
  const getVehicleCount = (_projectId: string) => 0;

  const handleCreateProject = async () => {
    if (!user) return;

    try {
      setIsSaving(true);
      const created = await createProject(user.id, newProject);
      setProjects((prev) => [created, ...prev]);

      setIsCreateDialogOpen(false);
      setNewProject({
        name: "",
        description: "",
        countryOrRegion: "CA_QC",
        currency: "CAD",
        defaultAnalysisHorizonYears: 10,
        defaultDiscountRate: 0.05,
      });

      toast({
        title: t('pages.projects.toast.created'),
        description: t('pages.projects.toast.createdDesc', { name: created.name }),
      });

      navigate(`/dashboard/projects/${created.id}/flotte`);
    } catch (error) {
      console.error("Error creating project:", error);
      toast({
        title: t('pages.projects.toast.error'),
        description: t('pages.projects.toast.createError'),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    const project = projects.find((p) => p.id === projectId);

    try {
      await deleteProject(projectId);
      setProjects((prev) => prev.filter((p) => p.id !== projectId));

      toast({
        title: t('pages.projects.toast.deleted'),
        description: t('pages.projects.toast.deletedDesc', { name: project?.name ?? "" }),
        variant: "destructive",
      });
    } catch (error) {
      console.error("Error deleting project:", error);
      toast({
        title: t('pages.projects.toast.error'),
        description: t('pages.projects.toast.deleteError'),
        variant: "destructive",
      });
    }
  };

  const handleDuplicateProject = async (projectId: string) => {
    if (!user) return;

    const original = projects.find((p) => p.id === projectId);
    if (!original) return;

    try {
      const duplicate = await duplicateProject(user.id, projectId, `${original.name} (copie)`);
      setProjects((prev) => [duplicate, ...prev]);

      toast({
        title: t('pages.projects.toast.duplicated'),
        description: t('pages.projects.toast.duplicatedDesc', { name: duplicate.name }),
      });
    } catch (error) {
      console.error("Error duplicating project:", error);
      toast({
        title: t('pages.projects.toast.error'),
        description: t('pages.projects.toast.duplicateError'),
        variant: "destructive",
      });
    }
  };

  const handleLoadDemoProject = async () => {
    if (!user) return;

    try {
      setIsLoadingDemo(true);
      const demoInfo = getDemoProjectInfo();
      
      const { projectId } = await seedDemoProject(user.id);
      
      // Refresh projects list
      const updatedProjects = await listProjects();
      setProjects(updatedProjects);

      toast({
        title: t('pages.projects.demo.loaded', 'Demo project loaded'),
        description: t('pages.projects.demo.loadedDesc', { name: demoInfo.name }),
      });

      // Navigate to the demo project
      navigate(`/dashboard/projects/${projectId}/flotte`);
    } catch (error) {
      console.error("Error loading demo project:", error);
      toast({
        title: t('pages.projects.toast.error'),
        description: t('pages.projects.demo.loadError', 'Failed to load demo project'),
        variant: "destructive",
      });
    } finally {
      setIsLoadingDemo(false);
    }
  };

  return (
    <>
      <DashboardLayout>
      <Page>
        <PageHeader
          titre={t('pages.projects.title')}
          sousTitre={t('pages.projects.subtitle')}
          actions={
          <>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t('pages.projects.searchPlaceholder')}
                aria-label={t('pages.projects.searchPlaceholder')}
                className="pl-9 w-full"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button 
              variant="outline" 
              className="gap-2"
              onClick={handleLoadDemoProject}
              disabled={isLoadingDemo}
            >
              {isLoadingDemo ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <PlayCircle className="w-4 h-4" />
              )}
              {t('pages.projects.loadDemo', 'Load Demo')}
            </Button>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  {t('pages.projects.newProject')}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>{t('pages.projects.createDialog.title')}</DialogTitle>
                  <DialogDescription>
                    {t('pages.projects.createDialog.subtitle')}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">{t('pages.projects.createDialog.name')}</Label>
                    <Input
                      id="name"
                      placeholder={t('pages.projects.createDialog.namePlaceholder')}
                      value={newProject.name}
                      onChange={(e) =>
                        setNewProject({ ...newProject, name: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">{t('pages.projects.createDialog.description')}</Label>
                    <Textarea
                      id="description"
                      placeholder={t('pages.projects.createDialog.descriptionPlaceholder')}
                      value={newProject.description}
                      onChange={(e) =>
                        setNewProject({ ...newProject, description: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t('pages.projects.createDialog.region')}</Label>
                      <Input value={t('settings.regions.ca_qc')} disabled readOnly />
                      <p className="text-xs text-muted-foreground">{t('organization.identity.regionHint')}</p>
                    </div>
                    <div className="space-y-2">
                      <Label>{t('pages.projects.createDialog.currency')}</Label>
                      <Select
                        value={newProject.currency}
                        onValueChange={(v) =>
                          setNewProject({ ...newProject, currency: v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {availableCurrencies.map((c) => (
                            <SelectItem key={c.value} value={c.value}>
                              {c.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t('pages.projects.createDialog.analysisHorizon')}</Label>
                      <Input
                        type="number"
                        min={1}
                        max={30}
                        value={newProject.defaultAnalysisHorizonYears}
                        onChange={(e) =>
                          setNewProject({
                            ...newProject,
                            defaultAnalysisHorizonYears: parseInt(e.target.value) || 10,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('pages.projects.createDialog.discountRate')}</Label>
                      <Input
                        type="number"
                        min={0}
                        max={20}
                        step={0.5}
                        value={(newProject.defaultDiscountRate * 100).toFixed(1)}
                        onChange={(e) =>
                          setNewProject({
                            ...newProject,
                            defaultDiscountRate: tauxDepuisSaisiePourcent(e.target.value) ?? newProject.defaultDiscountRate,
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    {t('pages.projects.createDialog.cancel')}
                  </Button>
                  <Button onClick={handleCreateProject} disabled={!newProject.name.trim()}>
                    {t('pages.projects.createDialog.create')}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
          }
        />

        {/* Projects grid */}
        {isLoadingProjects ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[0, 1, 2].map((i) => (
              <Card key={i}>
                <CardHeader className="pb-3">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-4 w-full" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Skeleton className="h-6 w-24" />
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-6 w-16" />
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-8 w-20" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredProjects.length === 0 ? (
          <Card className="py-16">
            <CardContent className="flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <FolderKanban className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{t('pages.projects.noProjects')}</h3>
              <p className="text-muted-foreground mb-4 max-w-sm">
                {searchQuery
                  ? t('pages.projects.noProjectsSearch')
                  : t('pages.projects.noProjectsEmpty')}
              </p>
              {!searchQuery && (
                <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2">
                  <Plus className="w-4 h-4" />
                  {t('pages.projects.createProject')}
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((project) => {
              const vehicleCount = getVehicleCount(project.id);
              const region = availableRegions.find((r) => r.value === project.countryOrRegion);

              return (
                <Card
                  key={project.id}
                  className="group hover:shadow-lg transition-all duration-200 hover:border-primary/30"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-lg line-clamp-1">{project.name}</CardTitle>
                        <CardDescription className="line-clamp-2">
                          {project.description || ""}
                        </CardDescription>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link to={`/dashboard/projects/${project.id}`}>
                              <Eye className="w-4 h-4 mr-2" />
                              {t('pages.projects.card.viewProject')}
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Pencil className="w-4 h-4 mr-2" />
                            {t('pages.projects.card.edit')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicateProject(project.id)}>
                            <Copy className="w-4 h-4 mr-2" />
                            {t('pages.projects.card.duplicate')}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDeleteProject(project.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            {t('pages.projects.card.delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary" className="gap-1">
                        <Truck className="w-3 h-3" />
                        {vehicleCount} {t('pages.projects.card.vehicles')}
                      </Badge>
                      <Badge variant="outline" className="gap-1">
                        <MapPin className="w-3 h-3" />
                        {region?.label || project.countryOrRegion}
                      </Badge>
                      <Badge variant="outline" className="gap-1">
                        <Calendar className="w-3 h-3" />
                        {project.defaultAnalysisHorizonYears} {t('pages.projects.card.horizon')}
                      </Badge>
                      <Badge variant="outline" className="gap-1">
                        <TrendingUp className="w-3 h-3" />
                        {formaterPourcentage(i18n.language, project.defaultDiscountRate)} {t('pages.projects.card.discountRate')}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formaterDate(i18n.language, project.updatedAt)}
                      </span>
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/dashboard/projects/${project.id}`}>
                          {t('pages.projects.card.viewProject')}
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </Page>
    </DashboardLayout>
    </>
  );
};

export default Projects;
