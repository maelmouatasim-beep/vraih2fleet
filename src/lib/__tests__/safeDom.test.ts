// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { el, httpsUrlOrNull, safeExternalLink } from '../safeDom';

describe('httpsUrlOrNull', () => {
  it('accepte les URL https', () => {
    expect(httpsUrlOrNull('https://example.com/page')).toBe('https://example.com/page');
  });

  it('refuse javascript:, data:, http: et les chaînes invalides', () => {
    expect(httpsUrlOrNull('javascript:alert(1)')).toBeNull();
    // eslint-disable-next-line no-script-url
    expect(httpsUrlOrNull('JAVASCRIPT:alert(1)')).toBeNull();
    expect(httpsUrlOrNull('data:text/html,<script>alert(1)</script>')).toBeNull();
    expect(httpsUrlOrNull('http://example.com')).toBeNull();
    expect(httpsUrlOrNull('not a url')).toBeNull();
    expect(httpsUrlOrNull(null)).toBeNull();
    expect(httpsUrlOrNull(undefined)).toBeNull();
  });
});

describe('el', () => {
  it('rend le texte via textContent : le HTML reste inerte', () => {
    const node = el('div', {}, '<img src=x onerror=alert(1)>');
    expect(node.querySelector('img')).toBeNull();
    expect(node.textContent).toBe('<img src=x onerror=alert(1)>');
  });

  it('applique les styles', () => {
    const node = el('span', { fontSize: '12px' }, 'ok');
    expect(node.style.fontSize).toBe('12px');
    expect(node.tagName).toBe('SPAN');
  });
});

describe('safeExternalLink', () => {
  it("retourne null pour une URL non https (pas de lien injectable)", () => {
    expect(safeExternalLink('javascript:alert(1)', 'clic')).toBeNull();
    expect(safeExternalLink('http://example.com', 'clic')).toBeNull();
  });

  it('construit un lien https avec rel noopener et texte échappé', () => {
    const a = safeExternalLink('https://fournisseur.example', '<b>site</b>');
    expect(a).not.toBeNull();
    expect(a!.rel).toContain('noopener');
    expect(a!.target).toBe('_blank');
    expect(a!.querySelector('b')).toBeNull();
    expect(a!.textContent).toBe('<b>site</b>');
  });
});
