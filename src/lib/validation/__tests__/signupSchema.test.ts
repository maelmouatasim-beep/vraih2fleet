import { describe, expect, it } from 'vitest';
import { createSignupSchema } from '../signupSchema';

const schema = createSignupSchema((key) => key);

describe('createSignupSchema', () => {
  it('accepte un profil valide', () => {
    const result = schema.safeParse({
      fullName: 'Marie Tremblay',
      email: 'marie@ville.qc.ca',
      password: 'Transit2026',
    });
    expect(result.success).toBe(true);
  });

  it('refuse un email invalide', () => {
    const result = schema.safeParse({
      fullName: 'Marie',
      email: 'pas-un-email',
      password: 'Transit2026',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('auth.validation.invalidEmail');
  });

  it('refuse un mot de passe trop court, sans majuscule ou sans chiffre', () => {
    expect(schema.safeParse({ fullName: 'M M', email: 'a@b.co', password: 'Ab1' }).success).toBe(false);
    expect(schema.safeParse({ fullName: 'M M', email: 'a@b.co', password: 'transit2026' }).success).toBe(false);
    expect(schema.safeParse({ fullName: 'M M', email: 'a@b.co', password: 'TransitQuebec' }).success).toBe(false);
  });

  it('refuse un nom trop court', () => {
    const result = schema.safeParse({ fullName: 'M', email: 'a@b.co', password: 'Transit2026' });
    expect(result.success).toBe(false);
  });
});
