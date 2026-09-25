// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

// OAuthConsent importe le client Supabase (qui exige les variables VITE_*) :
// on le neutralise, seuls les helpers purs sont testés ici.
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

import { safeRedirectTarget, safeSameOriginPath } from '../OAuthConsent';

describe('safeSameOriginPath', () => {
  it('accepte un chemin interne', () => {
    expect(safeSameOriginPath('/dashboard')).toBe('/dashboard');
    expect(safeSameOriginPath('/a?b=c')).toBe('/a?b=c');
  });

  it('refuse les URL absolues et protocol-relative', () => {
    expect(safeSameOriginPath('https://evil.example')).toBeNull();
    expect(safeSameOriginPath('//evil.example')).toBeNull();
    expect(safeSameOriginPath('javascript:alert(1)')).toBeNull();
    expect(safeSameOriginPath(null)).toBeNull();
  });
});

describe('safeRedirectTarget', () => {
  it('accepte un chemin interne ou une URL https', () => {
    expect(safeRedirectTarget('/dashboard')).toBe('/dashboard');
    expect(safeRedirectTarget('https://client.example/callback?code=x')).toBe(
      'https://client.example/callback?code=x',
    );
  });

  it('refuse javascript:, data: et http:', () => {
    expect(safeRedirectTarget('javascript:alert(1)')).toBeNull();
    expect(safeRedirectTarget('data:text/html,x')).toBeNull();
    expect(safeRedirectTarget('http://client.example/callback')).toBeNull();
    expect(safeRedirectTarget(undefined)).toBeNull();
  });
});
