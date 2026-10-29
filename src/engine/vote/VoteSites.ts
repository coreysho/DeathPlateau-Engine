import fs from 'fs';

import Environment from '#/util/Environment.js';
import { printError, printInfo } from '#/util/Logger.js';

// WHICH SITES THIS SERVER IS LISTED ON - configuration, not code, because the answer changes
// without the game changing and because it carries secrets.
//
// There are no sites until somebody writes the file. That is the honest default: a server that is
// not listed anywhere has nothing to claim, and the Vote clerk says so rather than pretending to
// check. Everything behind this - the ledger, the callback route, the claim path, the tickets - is
// built and tested with no file present; adding a site is one entry in data/vote/sites.json.
//
// TWO WAYS A VOTE ARRIVES, and a site may offer either or both:
//
//   callback   the site calls us when somebody votes (a "postback" or "callback URL"). Give it
//              <server>/vote/<id>/callback and put the shared secret here. This is the better one
//              where it exists: the player gets their ticket without asking.
//
//   check      we call the site when the player clicks Claim ("has this user voted?"). Most RSPS
//              toplists offer this and nothing else. It needs the URL to call and how to read a
//              yes out of what comes back.
//
// SECRETS DO NOT GO IN THIS FILE. Write "env:VOTE_TOPG_KEY" and the value is read from that
// environment variable at load. A literal is accepted so a test can use one, and warned about.

export type VoteCheckSuccess = {
    /** The response body counts as a yes if it contains this text. */
    contains?: string;
    /** ...or if this dotted path in the JSON body equals `equals`. */
    json?: string;
    equals?: string | number | boolean;
};

export type VoteSite = {
    /** Url-safe, and the name this site is filed under in the ledger for ever. Do not rename it. */
    id: string;
    /** What the Vote clerk calls it. */
    name: string;
    /** Where the player goes to vote. Shown in game. */
    url: string;
    /** Tickets one vote is worth. */
    tickets: number;
    /** How long before the same player can be paid for this site again. */
    cooldownHours: number;
    callback?: {
        /** Shared secret the site sends back. The route refuses anything that does not match. */
        secret: string;
        /** Which parameter carries the secret. Sites call it key, token, hash, secret... */
        secretParam?: string;
        /** Which parameter carries the player's name. */
        userParam: string;
        /** Which parameter carries the site's own id for this vote, if it sends one. */
        refParam?: string;
    };
    check?: {
        /** {user} and {key} are substituted. */
        url: string;
        method?: 'GET' | 'POST';
        key?: string;
        headers?: Record<string, string>;
        success: VoteCheckSuccess;
        /** Where in a JSON response the site's own vote id is, if it sends one. */
        refJson?: string;
    };
};

function resolveSecret(value: string | undefined, where: string): string | undefined {
    if (!value) {
        return undefined;
    }
    if (value.startsWith('env:')) {
        const name = value.slice(4);
        const got = process.env[name];
        if (!got) {
            printError(`vote: ${where} wants ${name} and it is not set - the site is loaded without it and will refuse everything`);
            return undefined;
        }
        return got;
    }
    printError(`vote: ${where} has a literal secret in the file - move it to an environment variable and write env:NAME`);
    return value;
}

/** Everything wrong with one entry, as a list, so one bad site does not hide the next. */
function faults(site: Partial<VoteSite>, index: number): string[] {
    const out: string[] = [];
    const at = `sites[${index}]`;
    if (typeof site.id !== 'string' || !/^[a-z0-9_-]+$/.test(site.id)) {
        out.push(`${at}.id must be lowercase letters, digits, - or _ (it goes in the callback URL and in the ledger)`);
    }
    if (typeof site.name !== 'string' || !site.name.length) {
        out.push(`${at}.name is missing`);
    }
    if (typeof site.url !== 'string' || !/^https?:\/\//.test(site.url)) {
        out.push(`${at}.url must be the http(s) address a player votes at`);
    }
    if (typeof site.tickets !== 'number' || !Number.isInteger(site.tickets) || site.tickets < 1) {
        out.push(`${at}.tickets must be a whole number of tickets, 1 or more`);
    }
    if (typeof site.cooldownHours !== 'number' || site.cooldownHours < 0) {
        out.push(`${at}.cooldownHours must be hours, 0 or more`);
    }
    if (!site.callback && !site.check) {
        out.push(`${at} has neither a callback nor a check, so no vote could ever reach it`);
    }
    if (site.check && (typeof site.check.url !== 'string' || !/^https?:\/\//.test(site.check.url))) {
        out.push(`${at}.check.url must be the http(s) address to ask`);
    }
    if (site.check && !site.check.success?.contains && !site.check.success?.json) {
        out.push(`${at}.check.success must say how to read a yes: "contains", or "json" and "equals"`);
    }
    if (site.callback && typeof site.callback.userParam !== 'string') {
        out.push(`${at}.callback.userParam must name the parameter the site puts the player's name in`);
    }
    return out;
}

export default class VoteSites {
    private static sites: VoteSite[] = [];
    private static loaded = false;

    /** Read the file. Safe to call more than once; a reload replaces the list wholesale. */
    static load(file = Environment.VOTE_SITES_CONFIG): VoteSite[] {
        VoteSites.loaded = true;
        VoteSites.sites = [];
        if (!file || !fs.existsSync(file)) {
            return VoteSites.sites;
        }

        let parsed: unknown;
        try {
            parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
        } catch (err) {
            printError(`vote: ${file} is not valid JSON (${err instanceof Error ? err.message : err}) - no sites loaded`);
            return VoteSites.sites;
        }
        if (!Array.isArray(parsed)) {
            printError(`vote: ${file} must be a JSON array of sites - no sites loaded`);
            return VoteSites.sites;
        }

        const seen = new Set<string>();
        for (let i = 0; i < parsed.length; i++) {
            const site = parsed[i] as Partial<VoteSite>;
            const wrong = faults(site, i);
            if (wrong.length) {
                for (const line of wrong) {
                    printError(`vote: ${line}`);
                }
                continue;
            }
            if (seen.has(site.id!)) {
                printError(`vote: two sites share the id "${site.id}" - the second is ignored`);
                continue;
            }
            seen.add(site.id!);

            const full = { ...site } as VoteSite;
            if (full.callback) {
                const secret = resolveSecret(full.callback.secret, `sites[${i}].callback.secret`);
                if (!secret) {
                    // Keep the site, drop the callback: a site with a check can still work, and a
                    // callback route with no secret must never answer.
                    delete full.callback;
                } else {
                    full.callback = { ...full.callback, secret };
                }
            }
            if (full.check?.key) {
                full.check = { ...full.check, key: resolveSecret(full.check.key, `sites[${i}].check.key`) };
            }
            VoteSites.sites.push(full);
        }

        if (VoteSites.sites.length) {
            printInfo(`Vote sites: ${VoteSites.sites.map(s => s.id).join(', ')}`);
        }
        return VoteSites.sites;
    }

    static all(): VoteSite[] {
        if (!VoteSites.loaded) {
            VoteSites.load();
        }
        return VoteSites.sites;
    }

    static get(id: string): VoteSite | null {
        return VoteSites.all().find(s => s.id === id) ?? null;
    }

    static count(): number {
        return VoteSites.all().length;
    }

    /** Only for the tests, which build sites in memory rather than on disk. */
    static override(sites: VoteSite[]) {
        VoteSites.loaded = true;
        VoteSites.sites = sites;
    }

    static cooldownMs(site: VoteSite): number {
        return Math.round(site.cooldownHours * 3600000);
    }
}
