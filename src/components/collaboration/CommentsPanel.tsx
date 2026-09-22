import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MessageSquare, Send, MoreHorizontal, Reply, Pencil, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import { useProjectComments, type Comment, type CommentSection } from "@/hooks/useProjectComments";
import { useAuth } from "@/hooks/useAuth";

interface CommentsPanelProps {
  projectId: string;
}

const sectionColors: Record<string, string> = {
  general: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  scenarios: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  infrastructure: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  analytics: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  subsidies: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
};

export function CommentsPanel({ projectId }: CommentsPanelProps) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { comments, isLoading, totalCount, addComment, updateComment, deleteComment } =
    useProjectComments(projectId);

  const [newComment, setNewComment] = useState("");
  const [selectedSection, setSelectedSection] = useState<CommentSection | "all">("all");
  const [newCommentSection, setNewCommentSection] = useState<CommentSection>("general");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const dateLocale = i18n.language === "fr" ? fr : enUS;

  const filteredComments =
    selectedSection === "all"
      ? comments
      : comments.filter((c) => c.section === selectedSection);

  const handleSubmit = async () => {
    if (!newComment.trim()) return;

    setIsSubmitting(true);
    try {
      await addComment(newComment, newCommentSection, replyTo || undefined);
      setNewComment("");
      setReplyTo(null);
      toast({
        title: t("collaboration.comments.sent", "Commentaire envoyé"),
      });
    } catch (error: any) {
      toast({
        title: t("common.error", "Erreur"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (commentId: string) => {
    if (!editContent.trim()) return;

    try {
      await updateComment(commentId, editContent);
      setEditingComment(null);
      setEditContent("");
      toast({
        title: t("collaboration.comments.updated", "Commentaire modifié"),
      });
    } catch (error: any) {
      toast({
        title: t("common.error", "Erreur"),
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      await deleteComment(commentId);
      toast({
        title: t("collaboration.comments.deleted", "Commentaire supprimé"),
      });
    } catch (error: any) {
      toast({
        title: t("common.error", "Erreur"),
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const renderComment = (comment: Comment, isReply = false) => {
    const isOwn = comment.userId === user?.id;
    const isEditing = editingComment === comment.id;

    return (
      <div
        key={comment.id}
        className={`p-3 rounded-lg border bg-card ${isReply ? "ml-8 mt-2" : ""}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Avatar className="h-7 w-7">
              <AvatarImage src={comment.profile?.avatarUrl || undefined} />
              <AvatarFallback className="text-xs">
                {getInitials(comment.profile?.fullName)}
              </AvatarFallback>
            </Avatar>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">
                {comment.profile?.fullName || t("collaboration.comments.unknown", "Inconnu")}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(comment.createdAt), {
                  addSuffix: true,
                  locale: dateLocale,
                })}
              </span>
              {comment.section && (
                <Badge variant="secondary" className={`text-xs ${sectionColors[comment.section]}`}>
                  {t(`collaboration.comments.sections.${comment.section}`, comment.section)}
                </Badge>
              )}
            </div>
          </div>

          {isOwn && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    setEditingComment(comment.id);
                    setEditContent(comment.content);
                  }}
                >
                  <Pencil className="w-4 h-4 mr-2" />
                  {t("collaboration.comments.edit", "Modifier")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => handleDelete(comment.id)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {t("collaboration.comments.delete", "Supprimer")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {isEditing ? (
          <div className="mt-2 space-y-2">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="min-h-[60px]"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => handleUpdate(comment.id)}>
                {t("common.save", "Enregistrer")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingComment(null);
                  setEditContent("");
                }}
              >
                {t("common.cancel", "Annuler")}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm whitespace-pre-wrap">{comment.content}</p>
            {!isReply && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 h-7 text-xs"
                onClick={() => setReplyTo(comment.id)}
              >
                <Reply className="w-3 h-3 mr-1" />
                {t("collaboration.comments.reply", "Répondre")}
              </Button>
            )}
          </>
        )}

        {/* Replies */}
        {comment.replies?.map((reply) => renderComment(reply, true))}

        {/* Reply input */}
        {replyTo === comment.id && (
          <div className="mt-3 ml-8 flex gap-2">
            <Textarea
              placeholder={t("collaboration.comments.replyPlaceholder", "Votre réponse...")}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="min-h-[60px] flex-1"
            />
            <div className="flex flex-col gap-1">
              <Button size="sm" onClick={handleSubmit} disabled={isSubmitting}>
                <Send className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setReplyTo(null);
                  setNewComment("");
                }}
              >
                {t("common.cancel", "×")}
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <MessageSquare className="w-4 h-4" />
        <span>{t("collaboration.comments.loading", "Chargement...")}</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with filter */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />
          {t("collaboration.comments.title", "Commentaires")} ({totalCount})
        </h4>
        <Select value={selectedSection} onValueChange={(v) => setSelectedSection(v as any)}>
          <SelectTrigger className="w-36 h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("collaboration.comments.sections.all", "Tous")}</SelectItem>
            <SelectItem value="general">
              {t("collaboration.comments.sections.general", "Général")}
            </SelectItem>
            <SelectItem value="scenarios">
              {t("collaboration.comments.sections.scenarios", "Scénarios")}
            </SelectItem>
            <SelectItem value="infrastructure">
              {t("collaboration.comments.sections.infrastructure", "Infrastructure")}
            </SelectItem>
            <SelectItem value="analytics">
              {t("collaboration.comments.sections.analytics", "Analytique")}
            </SelectItem>
            <SelectItem value="subsidies">
              {t("collaboration.comments.sections.subsidies", "Subventions")}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Comments list */}
      <div className="space-y-3 max-h-[400px] overflow-y-auto">
        {filteredComments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">{t("collaboration.comments.empty", "Aucun commentaire")}</p>
          </div>
        ) : (
          filteredComments.map((comment) => renderComment(comment))
        )}
      </div>

      {/* New comment input */}
      {!replyTo && (
        <div className="border-t pt-4 space-y-2">
          <div className="flex gap-2">
            <Textarea
              placeholder={t("collaboration.comments.placeholder", "Écrire un commentaire...")}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="min-h-[60px] flex-1"
            />
          </div>
          <div className="flex items-center justify-between">
            <Select
              value={newCommentSection}
              onValueChange={(v) => setNewCommentSection(v as CommentSection)}
            >
              <SelectTrigger className="w-36 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">
                  {t("collaboration.comments.sections.general", "Général")}
                </SelectItem>
                <SelectItem value="scenarios">
                  {t("collaboration.comments.sections.scenarios", "Scénarios")}
                </SelectItem>
                <SelectItem value="infrastructure">
                  {t("collaboration.comments.sections.infrastructure", "Infrastructure")}
                </SelectItem>
                <SelectItem value="analytics">
                  {t("collaboration.comments.sections.analytics", "Analytique")}
                </SelectItem>
                <SelectItem value="subsidies">
                  {t("collaboration.comments.sections.subsidies", "Subventions")}
                </SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleSubmit} disabled={isSubmitting || !newComment.trim()}>
              <Send className="w-4 h-4 mr-2" />
              {t("collaboration.comments.send", "Envoyer")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
