import { z } from "./zod";

/** Validation du formulaire de contact (miroir des contraintes SQL). */
export const leadFormSchema = z.object({
  kind: z.enum(["lessor", "company"]),
  organizationName: z.string().trim().min(2).max(200),
  contactName: z.string().trim().min(2).max(120),
  email: z.email().max(254),
  phone: z
    .string()
    .trim()
    .max(30)
    .regex(/^[+0-9 ().-]*$/)
    .optional()
    .transform((v) => v || null),
  message: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => v || null),
  consent: z.literal("on"),
  locale: z.enum(["fr", "ar", "en"]),
  // Champ invisible : un humain le laisse vide.
  website: z.string().max(0).optional(),
});

export type LeadForm = z.infer<typeof leadFormSchema>;

export type LeadState =
  | { status: "idle" }
  | { status: "success" }
  | {
      status: "error";
      error: "invalid" | "tooMany" | "generic";
      fields?: string[];
      /** Saisie renvoyée au formulaire : React le réinitialise après l'action. */
      values?: Partial<
        Record<"organizationName" | "contactName" | "email" | "phone" | "message", string>
      >;
    };

export function echoValues(raw: Record<string, FormDataEntryValue>) {
  const pick = (k: string) => (typeof raw[k] === "string" ? raw[k] : "");
  return {
    organizationName: pick("organizationName"),
    contactName: pick("contactName"),
    email: pick("email"),
    phone: pick("phone"),
    message: pick("message"),
  };
}

export function pgErrorCode(error: unknown): string | undefined {
  const e = error as { cause?: { code?: string }; code?: string };
  return e.cause?.code ?? e.code;
}
