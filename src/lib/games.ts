/**
 * Game/platform presets for STAG.
 * Shared between client (names/icons) and server (TCP ports) code.
 *
 * icon: either a key into BRAND_GLYPHS (real brand glyph, bundled offline)
 *       or "img:/games/<file>.png" for logos bundled as raster images.
 */

/**
 * The role a domain plays for actually PLAYING the game:
 *  - "auth": login / account authentication server (must reach it or the game won't start)
 *  - "game": live service / matchmaking / API the client depends on in-game
 *  - "web":  marketing / storefront website — nice to resolve, NOT needed to play
 *  - "cdn":  asset / download CDN — supplementary
 * Only `critical` domains (auth + core game service) drive the verdict and
 * ranking. A blocked marketing website must never mark a working DNS as broken,
 * and a resolvable website must never make a broken login look "healthy".
 */
export type DomainRole = "auth" | "game" | "web" | "cdn";

export interface GameDomain {
  host: string;
  role: DomainRole;
  /** Counted in the verdict/ranking. auth + core game service = true; web/cdn = false. */
  critical: boolean;
}

export interface GamePreset {
  id: string;
  name: string;
  latin: string;
  icon: string;
  hint: string;
  /** Domains probed through the user's DNS, each tagged with its role/weight */
  domains: GameDomain[];
  /** TCP ports optionally probed on the first resolved IP (supplementary check) */
  tcpPorts: number[];
}

export const GAME_PRESETS: GamePreset[] = [
  {
    id: "marvel-rivals",
    name: "مارول رایولز",
    latin: "Marvel Rivals",
    icon: "img:/games/marvel-rivals.png",
    hint: "شوتر قهرمان‌محور NetEase (استیم / PS5 / Xbox)",
    // Critical to PLAY: NetEase service + NetEase account auth. The two
    // marvelrivals.com hosts are only the marketing site (Google Cloud).
    domains: [
      { host: "id.163.com", role: "auth", critical: true },
      { host: "neteasegames.com", role: "game", critical: true },
      { host: "marvelrivals.com", role: "web", critical: false },
      { host: "www.marvelrivals.com", role: "web", critical: false },
    ],
    tcpPorts: [443],
  },
  {
    id: "valorant",
    name: "والورانت",
    latin: "Valorant",
    icon: "valorant",
    hint: "شوتر تاکتیکی Riot — سرورهای رقابتی",
    domains: [
      { host: "auth.riotgames.com", role: "auth", critical: true },
      { host: "riotgames.com", role: "game", critical: true },
      { host: "valorant.com", role: "web", critical: false },
    ],
    tcpPorts: [443, 2099],
  },
  {
    id: "cod",
    name: "کالاف دیوتی / وارزون",
    latin: "Call of Duty",
    icon: "activision",
    hint: "Warzone / MW3 / BO6 (سرویس Demonware)",
    domains: [
      { host: "demonware.net", role: "game", critical: true },
      { host: "activision.com", role: "web", critical: false },
      { host: "callofduty.com", role: "web", critical: false },
    ],
    tcpPorts: [443, 3074],
  },
  {
    id: "pubg",
    name: "پی‌یوبی‌جی",
    latin: "PUBG",
    icon: "pubg",
    hint: "PUBG: Battlegrounds — Krafton",
    domains: [
      { host: "pubg.com", role: "game", critical: true },
      { host: "www.pubg.com", role: "web", critical: false },
    ],
    tcpPorts: [443],
  },
  {
    id: "fortnite",
    name: "فورتنایت",
    latin: "Fortnite",
    icon: "fortnite",
    hint: "سرویس‌های Epic Games",
    domains: [
      { host: "account-public-service-prod03.ol.epicgames.com", role: "auth", critical: true },
      { host: "epicgames.com", role: "web", critical: false },
      { host: "fortnite.com", role: "web", critical: false },
    ],
    tcpPorts: [443, 5222],
  },
  {
    id: "cs2",
    name: "کانتر استرایک ۲",
    latin: "Counter-Strike 2",
    icon: "counterstrike",
    hint: "CS2 — مچ‌میکینگ از زیرساخت Steam",
    domains: [
      { host: "steamcommunity.com", role: "game", critical: true },
      { host: "counter-strike.net", role: "web", critical: false },
      { host: "www.counter-strike.net", role: "web", critical: false },
    ],
    tcpPorts: [443, 27017],
  },
  {
    id: "dota2",
    name: "دوتا ۲",
    latin: "Dota 2",
    icon: "dota2",
    hint: "Dota 2 — Valve",
    domains: [
      { host: "api.steampowered.com", role: "game", critical: true },
      { host: "steamcommunity.com", role: "game", critical: true },
      { host: "www.dota2.com", role: "web", critical: false },
    ],
    tcpPorts: [443, 27017],
  },
  {
    id: "lol",
    name: "لیگ اف لجندز",
    latin: "League of Legends",
    icon: "leagueoflegends",
    hint: "LoL — Riot Games",
    domains: [
      { host: "auth.riotgames.com", role: "auth", critical: true },
      { host: "riotgames.com", role: "game", critical: true },
      { host: "leagueoflegends.com", role: "web", critical: false },
    ],
    tcpPorts: [443, 2099],
  },
  {
    id: "ea",
    name: "ای‌ای / FC",
    latin: "EA Sports",
    icon: "ea",
    hint: "EA FC, Battlefield، آنلاین‌های EA",
    domains: [
      { host: "accounts.ea.com", role: "auth", critical: true },
      { host: "update.ea.com", role: "game", critical: true },
      { host: "ea.com", role: "web", critical: false },
    ],
    tcpPorts: [443],
  },
  {
    id: "psn",
    name: "پلی‌استیشن",
    latin: "PSN",
    icon: "playstation",
    hint: "PS4 / PS5 و استور پلی‌استیشن",
    domains: [
      { host: "auth.api.sonyentertainmentnetwork.com", role: "auth", critical: true },
      { host: "store.playstation.com", role: "web", critical: false },
      { host: "playstation.com", role: "web", critical: false },
    ],
    tcpPorts: [443, 3480],
  },
  {
    id: "xbox",
    name: "ایکس‌باکس لایو",
    latin: "Xbox Live",
    icon: "xbox",
    hint: "Xbox One / Series X|S و گیم‌پس",
    domains: [
      { host: "user.auth.xboxlive.com", role: "auth", critical: true },
      { host: "title.auth.xboxlive.com", role: "auth", critical: true },
      { host: "xboxlive.com", role: "game", critical: true },
      { host: "assets1.xboxlive.com", role: "cdn", critical: false },
    ],
    tcpPorts: [443, 3074],
  },
  {
    id: "nintendo",
    name: "نینتندو سوییچ",
    latin: "Nintendo Switch",
    icon: "nintendoswitch",
    hint: "Switch و eShop",
    domains: [
      { host: "accounts.nintendo.com", role: "auth", critical: true },
      { host: "ctest.cdn.nintendo.net", role: "game", critical: true },
      { host: "nintendo.com", role: "web", critical: false },
    ],
    tcpPorts: [443],
  },
  {
    id: "steam",
    name: "استیم",
    latin: "Steam",
    icon: "steam",
    hint: "استور و شبکه استیم",
    domains: [
      { host: "steamcommunity.com", role: "game", critical: true },
      { host: "api.steampowered.com", role: "game", critical: true },
      { host: "store.steampowered.com", role: "web", critical: false },
    ],
    tcpPorts: [443, 27017],
  },
  {
    id: "battlenet",
    name: "بتل‌نت",
    latin: "Battle.net",
    icon: "battledotnet",
    hint: "Blizzard — Diablo، Overwatch، CoD PC",
    domains: [
      { host: "us.actual.battle.net", role: "game", critical: true },
      { host: "battle.net", role: "game", critical: true },
      { host: "dist.blizzard.com", role: "cdn", critical: false },
    ],
    tcpPorts: [443, 1119],
  },
  {
    id: "rockstar",
    name: "GTA آنلاین",
    latin: "Rockstar",
    icon: "rockstargames",
    hint: "GTA Online و RDR2",
    domains: [
      { host: "prod.ros.rockstargames.com", role: "game", critical: true },
      { host: "rockstargames.com", role: "web", critical: false },
    ],
    tcpPorts: [443],
  },
  {
    id: "roblox",
    name: "رابلاکس",
    latin: "Roblox",
    icon: "roblox",
    hint: "کلاینت و سرویس احراز هویت",
    domains: [
      { host: "auth.roblox.com", role: "auth", critical: true },
      { host: "roblox.com", role: "web", critical: false },
      { host: "assetdelivery.roblox.com", role: "cdn", critical: false },
    ],
    tcpPorts: [443],
  },
  {
    id: "epic",
    name: "اپیک گیمز",
    latin: "Epic Games",
    icon: "epicgames",
    hint: "استور و اکانت Epic",
    domains: [
      { host: "account-public-service-prod03.ol.epicgames.com", role: "auth", critical: true },
      { host: "epicgames.com", role: "web", critical: false },
      { host: "store.epicgames.com", role: "web", critical: false },
    ],
    tcpPorts: [443],
  },
  {
    id: "genshin",
    name: "جنشین ایمپکت",
    latin: "Genshin Impact",
    icon: "img:/games/genshin.png",
    hint: "هویورس — Genshin / HSR / ZZZ",
    domains: [
      { host: "genshin.hoyoverse.com", role: "game", critical: true },
      { host: "mihoyo.com", role: "game", critical: true },
      { host: "hoyoverse.com", role: "web", critical: false },
    ],
    tcpPorts: [443],
  },
];

export function getPreset(id: string | null): GamePreset | null {
  if (!id) return null;
  return GAME_PRESETS.find((g) => g.id === id) ?? null;
}

/* --------------------------- domain helpers --------------------------- */

/** All domain host names of a preset (order preserved: critical first by data). */
export function domainHosts(g: GamePreset): string[] {
  return g.domains.map((d) => d.host);
}

/** Only the critical (auth + core game) host names — used for verdict/ranking. */
export function criticalHosts(g: GamePreset): string[] {
  const crit = g.domains.filter((d) => d.critical).map((d) => d.host);
  // Defensive: if a preset ever has no critical domain, fall back to all hosts
  // so the verdict engine still has something to judge.
  return crit.length > 0 ? crit : domainHosts(g);
}

/** Set of critical host names for O(1) membership checks in the API layer. */
export function criticalHostSet(g: GamePreset): Set<string> {
  return new Set(criticalHosts(g));
}

/**
 * The single most representative host to PING (measure latency to). We probe
 * the real game/auth server — never the marketing website — so the number
 * reflects the path that actually matters for playing. Preference: first auth
 * server, then first game service, then any critical, then first domain.
 */
export function primaryProbeHost(g: GamePreset): string | undefined {
  const auth = g.domains.find((d) => d.role === "auth");
  if (auth) return auth.host;
  const svc = g.domains.find((d) => d.role === "game");
  if (svc) return svc.host;
  const crit = g.domains.find((d) => d.critical);
  if (crit) return crit.host;
  return g.domains[0]?.host;
}
