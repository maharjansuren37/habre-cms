import { sql } from "#app/lib/db.server.ts";
import { domainLookups } from "./own-domain-dns.server.ts";
import { createOwnDomainStore } from "./own-domain-store.ts";

export type { AddResult, CheckResult, SiteDomain } from "./own-domain-store.ts";

// The store holds the SQL; this binds it to the app's database and resolver.
export const ownDomainStore = createOwnDomainStore(sql, { lookups: domainLookups });
export const { findSiteDomain, addDomain, checkDomain, removeDomain } = ownDomainStore;
