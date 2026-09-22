import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface IncentiveProgram {
  id: string;
  program_name_en: string;
  program_name_fr: string;
  amount_cad: number;
  deadline: string;
  application_url: string;
}

interface Profile {
  id: string;
  email_notifications: {
    subsidy_reminders?: boolean;
    collaboration_invites?: boolean;
    project_comments?: boolean;
    weekly_digest?: boolean;
  } | null;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting subsidy deadline notification check...");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all active programs with upcoming deadlines (7 days or 1 day)
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const oneDayFromNow = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);

    const { data: programs, error: programsError } = await supabase
      .from("incentives_programs")
      .select("id, program_name_en, program_name_fr, amount_cad, deadline, application_url")
      .eq("status", "active")
      .not("deadline", "is", null);

    if (programsError) {
      console.error("Error fetching programs:", programsError);
      throw programsError;
    }

    console.log(`Found ${programs?.length || 0} active programs with deadlines`);

    // Filter programs with deadlines in 7 days or 1 day
    const programsToNotify: { program: IncentiveProgram; daysRemaining: number; isUrgent: boolean }[] = [];

    programs?.forEach((program: IncentiveProgram) => {
      const deadline = new Date(program.deadline);
      const daysRemaining = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      // 7-day reminder or 1-day urgent reminder
      if (daysRemaining === 7 || daysRemaining === 1) {
        programsToNotify.push({
          program,
          daysRemaining,
          isUrgent: daysRemaining === 1,
        });
      }
    });

    console.log(`${programsToNotify.length} programs need notifications`);

    if (programsToNotify.length === 0) {
      return new Response(
        JSON.stringify({ message: "No deadlines to notify about today", notificationsSent: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all users who have subsidy reminders enabled
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, email_notifications")
      .not("email_notifications", "is", null);

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      throw profilesError;
    }

    // Filter users with subsidy_reminders enabled
    const usersToNotify = profiles?.filter((profile: Profile) => {
      return profile.email_notifications?.subsidy_reminders === true;
    }) || [];

    console.log(`${usersToNotify.length} users have subsidy reminders enabled`);

    // Get user emails from auth
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error("Error fetching auth users:", authError);
      throw authError;
    }

    const userEmailMap = new Map<string, string>();
    authUsers.users.forEach(user => {
      if (user.email) {
        userEmailMap.set(user.id, user.email);
      }
    });

    // Send notifications
    let notificationsSent = 0;
    const errors: string[] = [];

    for (const user of usersToNotify) {
      const userEmail = userEmailMap.get(user.id);
      if (!userEmail) {
        console.log(`No email found for user ${user.id}`);
        continue;
      }

      for (const { program, daysRemaining, isUrgent } of programsToNotify) {
        try {
          // Determine user language (default to French for Canadian context)
          // TODO: Could be fetched from user preferences in the future
          const isEnglish = false;
          const lang = isEnglish ? 'en' : 'fr';
          const locale = isEnglish ? 'en-CA' : 'fr-CA';

          const deadline = new Date(program.deadline);
          const formattedDeadline = deadline.toLocaleDateString(locale, {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });

          const amount = new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: 'CAD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          }).format(program.amount_cad);

          const programName = isEnglish ? program.program_name_en : program.program_name_fr;
          
          const subject = isUrgent
            ? `🚨 URGENT: ${isEnglish ? 'Last day for' : 'Dernier jour pour'} ${programName}`
            : `⏰ ${isEnglish ? 'Reminder' : 'Rappel'}: 7 ${isEnglish ? 'days left for' : 'jours pour'} ${programName}`;

          // Call the send-email function
          const emailResponse = await supabase.functions.invoke('send-email', {
            body: {
              to: userEmail,
              subject,
              templateType: 'subsidy_reminder',
              data: {
                programName,
                amount,
                daysRemaining,
                deadline: formattedDeadline,
                applyUrl: program.application_url,
                isUrgent,
                lang,
              },
            },
          });

          if (emailResponse.error) {
            throw emailResponse.error;
          }

          notificationsSent++;
          console.log(`Sent ${isUrgent ? 'urgent' : ''} reminder to ${userEmail} for ${program.program_name_en}`);
        } catch (error: any) {
          console.error(`Failed to send email to ${userEmail}:`, error.message);
          errors.push(`${userEmail}: ${error.message}`);
        }
      }
    }

    console.log(`Notification job completed. Sent ${notificationsSent} emails.`);

    return new Response(
      JSON.stringify({
        message: "Notification job completed",
        notificationsSent,
        programsChecked: programsToNotify.length,
        usersChecked: usersToNotify.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in notify-subsidy-deadlines:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
