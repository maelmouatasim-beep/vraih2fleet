import { describe, it, expect } from 'vitest';

// Extract the pure logic for testing without React hooks
const checkSessionExpired = (response: any): boolean => {
  if (response?.error === 'SESSION_EXPIRED' || response?.requiresReauth) {
    return true;
  }
  if (
    response?.error?.includes?.('InvalidCredentials') ||
    response?.error?.includes?.('session') ||
    response?.error?.includes?.('Session')
  ) {
    return true;
  }
  return false;
};

describe('TelematicsAuth - Session Expiration Detection', () => {
  describe('Direct error codes', () => {
    it('should detect SESSION_EXPIRED error', () => {
      expect(checkSessionExpired({ error: 'SESSION_EXPIRED' })).toBe(true);
    });

    it('should detect requiresReauth flag', () => {
      expect(checkSessionExpired({ requiresReauth: true })).toBe(true);
    });

    it('should detect requiresReauth even with other properties', () => {
      expect(
        checkSessionExpired({
          success: false,
          error: 'Some error',
          requiresReauth: true,
        })
      ).toBe(true);
    });
  });

  describe('Geotab error patterns', () => {
    it('should detect InvalidCredentials in error message', () => {
      expect(
        checkSessionExpired({ error: 'InvalidCredentials: session expired' })
      ).toBe(true);
    });

    it('should detect InvalidCredentials alone', () => {
      expect(checkSessionExpired({ error: 'InvalidCredentials' })).toBe(true);
    });

    it('should detect "session" keyword in error (lowercase)', () => {
      expect(
        checkSessionExpired({ error: 'Your session has expired' })
      ).toBe(true);
    });

    it('should detect "Session" keyword in error (capitalized)', () => {
      expect(
        checkSessionExpired({ error: 'Session timeout occurred' })
      ).toBe(true);
    });
  });

  describe('Valid responses (should NOT flag as expired)', () => {
    it('should NOT flag successful response', () => {
      expect(checkSessionExpired({ success: true, vehicles: [] })).toBe(false);
    });

    it('should NOT flag response with data', () => {
      expect(
        checkSessionExpired({
          success: true,
          vehicles: [{ id: '1', name: 'Truck' }],
          count: 1,
        })
      ).toBe(false);
    });

    it('should NOT flag null/undefined response', () => {
      expect(checkSessionExpired(null)).toBe(false);
      expect(checkSessionExpired(undefined)).toBe(false);
    });

    it('should NOT flag empty object', () => {
      expect(checkSessionExpired({})).toBe(false);
    });
  });

  describe('Other errors (should NOT flag as session expired)', () => {
    it('should NOT flag network timeout', () => {
      expect(checkSessionExpired({ error: 'Network timeout' })).toBe(false);
    });

    it('should NOT flag connection refused', () => {
      expect(checkSessionExpired({ error: 'Connection refused' })).toBe(false);
    });

    it('should NOT flag generic server error', () => {
      expect(checkSessionExpired({ error: 'Internal server error' })).toBe(false);
    });

    it('should NOT flag rate limit error', () => {
      expect(checkSessionExpired({ error: 'Rate limit exceeded' })).toBe(false);
    });

    it('should NOT flag permission denied', () => {
      expect(checkSessionExpired({ error: 'Permission denied' })).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('should handle error as non-string', () => {
      expect(checkSessionExpired({ error: 123 })).toBe(false);
      expect(checkSessionExpired({ error: { code: 'SESSION_EXPIRED' } })).toBe(false);
    });

    it('should handle requiresReauth as truthy but not true', () => {
      expect(checkSessionExpired({ requiresReauth: 1 })).toBe(true);
      expect(checkSessionExpired({ requiresReauth: 'yes' })).toBe(true);
    });

    it('should NOT flag requiresReauth as false', () => {
      expect(checkSessionExpired({ requiresReauth: false })).toBe(false);
    });

    it('should NOT flag requiresReauth as null', () => {
      expect(checkSessionExpired({ requiresReauth: null })).toBe(false);
    });
  });
});
