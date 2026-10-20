import { Secret, TOTP } from "otpauth";

/** Code TOTP courant d'un secret au format Better-Auth (octets UTF-8 bruts). */
export function currentTotp(secret: string, timestamp = Date.now()): string {
  return new TOTP({ secret: Secret.fromUTF8(secret), digits: 6, period: 30 }).generate({
    timestamp,
  });
}

export function secondsLeftInPeriod(timestamp = Date.now()): number {
  return 30 - (Math.floor(timestamp / 1000) % 30);
}
