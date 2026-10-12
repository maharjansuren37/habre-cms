import { Resolver } from "node:dns/promises";
import type { Lookup } from "./own-domain.ts";

export type DomainLookups = {
  /** TXT strings, each answer's chunks joined. */
  txt(name: string): Promise<Lookup>;
  /** A and AAAA together; the resolver follows a CNAME. */
  addresses(name: string): Promise<Lookup>;
};

type Resolve = {
  resolveTxt(name: string): Promise<string[][]>;
  resolve4(name: string): Promise<string[]>;
  resolve6(name: string): Promise<string[]>;
};

// A name with no records, or a server that did not answer in time, is an
// answer about the person's DNS. Anything else is our resolver failing.
const NO_RECORDS = new Set(["ENOTFOUND", "ENODATA", "ECONNREFUSED", "ETIMEOUT"]);

/** What a failed lookup means: no records, or an error on our side. */
export function lookupAnswer(error: unknown): Lookup {
  const code =
    typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
  return typeof code === "string" && NO_RECORDS.has(code) ? [] : "error";
}

/** The A and AAAA answers as one: an error only when it hides the truth. */
export function addressesAnswer(a: Lookup, aaaa: Lookup): Lookup {
  if (a !== "error" && aaaa !== "error") return [...a, ...aaaa];
  const answered = a === "error" ? aaaa : a;
  if (answered !== "error" && answered.length > 0) return answered;
  return "error";
}

async function lookup(run: () => Promise<string[]>): Promise<Lookup> {
  try {
    return await run();
  } catch (error) {
    return lookupAnswer(error);
  }
}

export function createDomainLookups(resolver?: Resolve): DomainLookups {
  const resolve: Resolve =
    resolver ??
    (() => {
      const real = new Resolver({ timeout: 2000, tries: 1 });
      return {
        resolveTxt: (name) => real.resolveTxt(name),
        resolve4: (name) => real.resolve4(name),
        resolve6: (name) => real.resolve6(name),
      };
    })();
  return {
    txt: (name) =>
      lookup(async () => (await resolve.resolveTxt(name)).map((chunks) => chunks.join(""))),
    async addresses(name) {
      const [a, aaaa] = await Promise.all([
        lookup(() => resolve.resolve4(name)),
        lookup(() => resolve.resolve6(name)),
      ]);
      return addressesAnswer(a, aaaa);
    },
  };
}

export const domainLookups = createDomainLookups();
