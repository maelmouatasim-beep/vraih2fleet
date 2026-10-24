/**
 * Analyse antivirus derrière une interface. `createEicarScanner` ne reconnaît
 * que la signature de test EICAR (développement, démonstration, CI) ; un
 * service réel (ClamAV ou managé) implémentera la même interface avant toute
 * donnée client réelle.
 */
export type ScanVerdict = { clean: true } | { clean: false; signature: string };

export interface MalwareScanner {
  readonly name: string;
  /** `real` faux : scanner de test, à remplacer avant la production. */
  readonly real: boolean;
  scan(bytes: Uint8Array): Promise<ScanVerdict>;
}

const EICAR = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";

export function createEicarScanner(): MalwareScanner {
  return {
    name: "eicar-test",
    real: false,
    scan(bytes) {
      const text = Buffer.from(bytes).toString("latin1");
      return Promise.resolve(
        text.includes(EICAR) ? { clean: false, signature: "EICAR-Test-File" } : { clean: true },
      );
    },
  };
}

export const EICAR_TEST_STRING = EICAR;
