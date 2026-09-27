import { z } from 'zod';

/**
 * Schéma du formulaire d'inscription minimal (nom, email, mot de passe).
 * Factory pour injecter t() : les messages restent traduits, le schéma
 * reste testable avec un t identité.
 */
export function createSignupSchema(t: (key: string) => string) {
  return z.object({
    fullName: z.string().trim().min(2, t('auth.validation.nameMinLength')),
    email: z.string().trim().email(t('auth.validation.invalidEmail')),
    password: z
      .string()
      .min(8, t('auth.validation.passwordMinLength'))
      .regex(/[A-Z]/, t('auth.validation.passwordUppercase'))
      .regex(/[0-9]/, t('auth.validation.passwordDigit')),
  });
}

export type SignupFormValues = z.infer<ReturnType<typeof createSignupSchema>>;
