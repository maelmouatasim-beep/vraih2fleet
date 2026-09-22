import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY");
const FROM_EMAIL = "contact@h2fleet.ca";
const FROM_NAME = "H2Fleet Planner";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  to: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  templateType?: 'subsidy_reminder' | 'collaboration_invite' | 'project_comment' | 'task_mention' | 'weekly_digest' | 'custom';
  data?: Record<string, any>;
}

// Email templates
const getSubsidyReminderTemplate = (data: { programName: string; amount: string; daysRemaining: number; deadline: string; applyUrl: string; isUrgent: boolean; lang: string }) => {
  const isEnglish = data.lang === 'en';
  const urgentBadge = data.isUrgent 
    ? `<span style="background: #ef4444; color: white; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: bold;">${isEnglish ? 'URGENT' : 'URGENT'}</span>` 
    : '';
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f4f4f5; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    <div style="background: linear-gradient(135deg, #0ea5e9 0%, #22c55e 100%); padding: 32px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">H2Fleet Planner</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0;">${isEnglish ? 'Subsidy Deadline Reminder' : 'Rappel d\'échéance de subvention'}</p>
    </div>
    <div style="padding: 32px;">
      <div style="text-align: center; margin-bottom: 24px;">
        ${urgentBadge}
      </div>
      <h2 style="color: #1f2937; margin: 0 0 16px 0;">${data.programName}</h2>
      <div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 16px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
        <p style="margin: 0; color: #166534; font-size: 24px; font-weight: bold;">${data.amount}</p>
        <p style="margin: 4px 0 0 0; color: #15803d; font-size: 14px;">${isEnglish ? 'Available funding' : 'Financement disponible'}</p>
      </div>
      <div style="background: ${data.isUrgent ? '#fef2f2' : '#fffbeb'}; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <p style="margin: 0; color: ${data.isUrgent ? '#991b1b' : '#92400e'}; font-weight: 600;">
          ⏰ ${data.daysRemaining} ${isEnglish ? 'days remaining' : 'jours restants'}
        </p>
        <p style="margin: 8px 0 0 0; color: ${data.isUrgent ? '#b91c1c' : '#a16207'}; font-size: 14px;">
          ${isEnglish ? 'Deadline' : 'Date limite'}: ${data.deadline}
        </p>
      </div>
      <a href="${data.applyUrl}" style="display: block; background: #0ea5e9; color: white; text-align: center; padding: 16px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-bottom: 16px;">
        ${isEnglish ? 'Apply Now' : 'Faire une demande'}
      </a>
      <p style="color: #6b7280; font-size: 14px; text-align: center;">
        ${isEnglish ? 'Don\'t miss this opportunity to fund your fleet transition!' : 'Ne manquez pas cette opportunité de financer votre transition de flotte!'}
      </p>
    </div>
    <div style="background: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0; color: #9ca3af; font-size: 12px;">
        ${isEnglish ? 'You received this email because you enabled subsidy reminders.' : 'Vous avez reçu cet email car vous avez activé les rappels de subventions.'}
      </p>
      <p style="margin: 8px 0 0 0; color: #9ca3af; font-size: 12px;">
        <a href="https://h2fleet.app/dashboard/settings" style="color: #0ea5e9;">${isEnglish ? 'Manage preferences' : 'Gérer les préférences'}</a>
      </p>
    </div>
  </div>
</body>
</html>`;
};

const getCollaborationInviteTemplate = (data: { projectName: string; inviterName: string; role: string; projectUrl: string; lang: string }) => {
  const isEnglish = data.lang === 'en';
  const roleLabels: Record<string, { en: string; fr: string }> = {
    owner: { en: 'Owner', fr: 'Propriétaire' },
    editor: { en: 'Editor', fr: 'Éditeur' },
    viewer: { en: 'Viewer', fr: 'Lecteur' },
  };
  const roleLabel = roleLabels[data.role]?.[isEnglish ? 'en' : 'fr'] || data.role;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f4f4f5; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    <div style="background: linear-gradient(135deg, #8b5cf6 0%, #0ea5e9 100%); padding: 32px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">H2Fleet Planner</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0;">${isEnglish ? 'Collaboration Invitation' : 'Invitation à collaborer'}</p>
    </div>
    <div style="padding: 32px; text-align: center;">
      <div style="width: 64px; height: 64px; background: linear-gradient(135deg, #8b5cf6 0%, #0ea5e9 100%); border-radius: 50%; margin: 0 auto 24px; display: flex; align-items: center; justify-content: center;">
        <span style="color: white; font-size: 28px;">👥</span>
      </div>
      <h2 style="color: #1f2937; margin: 0 0 16px 0;">
        ${isEnglish ? 'You\'ve been invited!' : 'Vous avez été invité(e)!'}
      </h2>
      <p style="color: #6b7280; margin: 0 0 24px 0; font-size: 16px;">
        <strong>${data.inviterName}</strong> ${isEnglish ? 'has invited you to collaborate on' : 'vous a invité(e) à collaborer sur'}
      </p>
      <div style="background: #f3f4f6; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <p style="margin: 0; color: #1f2937; font-size: 20px; font-weight: 600;">${data.projectName}</p>
        <p style="margin: 8px 0 0 0; color: #6b7280; font-size: 14px;">
          ${isEnglish ? 'Role' : 'Rôle'}: <span style="background: #dbeafe; color: #1e40af; padding: 2px 8px; border-radius: 4px; font-weight: 500;">${roleLabel}</span>
        </p>
      </div>
      <a href="${data.projectUrl}" style="display: inline-block; background: #8b5cf6; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">
        ${isEnglish ? 'View Project' : 'Voir le projet'}
      </a>
    </div>
    <div style="background: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0; color: #9ca3af; font-size: 12px;">
        <a href="https://h2fleet.app/dashboard/settings" style="color: #8b5cf6;">${isEnglish ? 'Manage notification preferences' : 'Gérer les préférences de notification'}</a>
      </p>
    </div>
  </div>
</body>
</html>`;
};

const getTaskMentionTemplate = (data: { taskTitle: string; mentionerName: string; commentPreview: string; taskUrl: string; projectName: string; lang: string }) => {
  const isEnglish = data.lang === 'en';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f4f4f5; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    <div style="background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%); padding: 32px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">H2Fleet Planner</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0;">${isEnglish ? 'You were mentioned' : 'Vous avez été mentionné'}</p>
    </div>
    <div style="padding: 32px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="width: 64px; height: 64px; background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%); border-radius: 50%; margin: 0 auto; display: flex; align-items: center; justify-content: center;">
          <span style="color: white; font-size: 28px;">@</span>
        </div>
      </div>
      <h2 style="color: #1f2937; margin: 0 0 8px 0; text-align: center;">
        ${isEnglish ? 'You were mentioned in a comment' : 'Vous avez été mentionné dans un commentaire'}
      </h2>
      <p style="color: #6b7280; margin: 0 0 24px 0; font-size: 14px; text-align: center;">
        ${isEnglish ? 'on task' : 'sur la tâche'} <strong>"${data.taskTitle}"</strong> ${isEnglish ? 'in project' : 'dans le projet'} <strong>${data.projectName}</strong>
      </p>
      <div style="background: #f3f4f6; border-left: 4px solid #f59e0b; padding: 16px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
        <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 12px; font-weight: 600;">
          ${data.mentionerName} ${isEnglish ? 'wrote' : 'a écrit'}:
        </p>
        <p style="margin: 0; color: #1f2937; font-size: 14px; font-style: italic;">
          "${data.commentPreview}"
        </p>
      </div>
      <a href="${data.taskUrl}" style="display: block; background: #f59e0b; color: white; text-align: center; padding: 14px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
        ${isEnglish ? 'View Task' : 'Voir la tâche'}
      </a>
    </div>
    <div style="background: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0; color: #9ca3af; font-size: 12px;">
        <a href="https://h2fleet.app/dashboard/settings" style="color: #f59e0b;">${isEnglish ? 'Manage notification preferences' : 'Gérer les préférences de notification'}</a>
      </p>
    </div>
  </div>
</body>
</html>`;
};

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, subject, htmlContent, textContent, templateType, data }: EmailRequest = await req.json();

    // Email send initiated

    if (!SENDGRID_API_KEY) {
      throw new Error("SENDGRID_API_KEY is not configured");
    }

    // Generate HTML based on template type or use provided content
    let finalHtml = htmlContent;
    
    if (templateType === 'subsidy_reminder' && data) {
      finalHtml = getSubsidyReminderTemplate(data as any);
    } else if (templateType === 'collaboration_invite' && data) {
      finalHtml = getCollaborationInviteTemplate(data as any);
    } else if (templateType === 'task_mention' && data) {
      finalHtml = getTaskMentionTemplate(data as any);
    }

    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: FROM_EMAIL, name: FROM_NAME },
        subject,
        content: [
          { type: "text/plain", value: textContent || subject },
          { type: "text/html", value: finalHtml },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("SendGrid API error:", response.status, errorText);
      throw new Error(`SendGrid error: ${response.status} - ${errorText}`);
    }

    // Email sent successfully

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error sending email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
