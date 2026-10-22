import { z } from "zod";

// CSP stricte (pas d'eval) : Zod 4 renonce à sa compilation par `new Function`.
z.config({ jitless: true });

export { z };
