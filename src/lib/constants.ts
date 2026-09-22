// Admin user whitelist - emails with elevated access
// Can be overridden by VITE_ADMIN_EMAILS environment variable (comma-separated)
const envAdmins = import.meta.env.VITE_ADMIN_EMAILS;

export const ADMIN_EMAILS: string[] = envAdmins 
  ? envAdmins.split(',').map((email: string) => email.trim().toLowerCase())
  : ['ma.elmouatasim@gmail.com'];

// Check if an email is in the admin whitelist
export const isAdminEmail = (email: string | null | undefined): boolean => {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
};
