/**
 * Game/platform presets for STAG.
 * Shared between client (names/icons) and server (TCP ports) code.
 *
 * icon: either a key into BRAND_GLYPHS (real brand glyph, bundled offline)
 *       or "img:/games/<file>.png" for logos bundled as raster images.
 */

export interface GamePreset {
  id: string;
  name: string;
  latin: string;
  icon: string;
  hint: string;
  /** Domains probed through the user's DNS */
  domains: string[];
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
    // Verified live: official site, NetEase service domain and NetEase account auth
    domains: ["marvelrivals.com", "www.marvelrivals.com", "neteasegames.com", "id.163.com"],
    tcpPorts: [443],
  },
  {
    id: "valorant",
    name: "والورانت",
    latin: "Valorant",
    icon: "valorant",
    hint: "شوتر تاکتیکی Riot — سرورهای رقابتی",
    domains: ["riotgames.com", "auth.riotgames.com", "valorant.com"],
    tcpPorts: [443, 2099],
  },
  {
    id: "cod",
    name: "کالاف دیوتی / وارزون",
    latin: "Call of Duty",
    icon: "activision",
    hint: "Warzone / MW3 / BO6 (سرویس Demonware)",
    domains: ["activision.com", "callofduty.com", "demonware.net"],
    tcpPorts: [443, 3074],
  },
  {
    id: "pubg",
    name: "پی‌یوبی‌جی",
    latin: "PUBG",
    icon: "pubg",
    hint: "PUBG: Battlegrounds — Krafton",
    domains: ["pubg.com", "www.pubg.com"],
    tcpPorts: [443],
  },
  {
    id: "fortnite",
    name: "فورتنایت",
    latin: "Fortnite",
    icon: "fortnite",
    hint: "سرویس‌های Epic Games",
    domains: ["epicgames.com", "fortnite.com", "account-public-service-prod03.ol.epicgames.com"],
    tcpPorts: [443, 5222],
  },
  {
    id: "cs2",
    name: "کانتر استرایک ۲",
    latin: "Counter-Strike 2",
    icon: "counterstrike",
    hint: "CS2 — مچ‌میکینگ از زیرساخت Steam",
    domains: ["counter-strike.net", "www.counter-strike.net", "steamcommunity.com"],
    tcpPorts: [443, 27017],
  },
  {
    id: "dota2",
    name: "دوتا ۲",
    latin: "Dota 2",
    icon: "dota2",
    hint: "Dota 2 — Valve",
    domains: ["www.dota2.com", "api.steampowered.com", "steamcommunity.com"],
    tcpPorts: [443, 27017],
  },
  {
    id: "lol",
    name: "لیگ اف لجندز",
    latin: "League of Legends",
    icon: "leagueoflegends",
    hint: "LoL — Riot Games",
    domains: ["riotgames.com", "auth.riotgames.com", "leagueoflegends.com"],
    tcpPorts: [443, 2099],
  },
  {
    id: "ea",
    name: "ای‌ای / FC",
    latin: "EA Sports",
    icon: "ea",
    hint: "EA FC, Battlefield، آنلاین‌های EA",
    domains: ["ea.com", "accounts.ea.com", "update.ea.com"],
    tcpPorts: [443],
  },
  {
    id: "psn",
    name: "پلی‌استیشن",
    latin: "PSN",
    icon: "playstation",
    hint: "PS4 / PS5 و استور پلی‌استیشن",
    domains: [
      "playstation.com",
      "auth.api.sonyentertainmentnetwork.com",
      "store.playstation.com",
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
      "xboxlive.com",
      "user.auth.xboxlive.com",
      "title.auth.xboxlive.com",
      "assets1.xboxlive.com",
    ],
    tcpPorts: [443, 3074],
  },
  {
    id: "nintendo",
    name: "نینتندو سوییچ",
    latin: "Nintendo Switch",
    icon: "nintendoswitch",
    hint: "Switch و eShop",
    domains: ["nintendo.com", "accounts.nintendo.com", "ctest.cdn.nintendo.net"],
    tcpPorts: [443],
  },
  {
    id: "steam",
    name: "استیم",
    latin: "Steam",
    icon: "steam",
    hint: "استور و شبکه استیم",
    domains: ["store.steampowered.com", "steamcommunity.com", "api.steampowered.com"],
    tcpPorts: [443, 27017],
  },
  {
    id: "battlenet",
    name: "بتل‌نت",
    latin: "Battle.net",
    icon: "battledotnet",
    hint: "Blizzard — Diablo، Overwatch، CoD PC",
    domains: ["battle.net", "dist.blizzard.com", "us.actual.battle.net"],
    tcpPorts: [443, 1119],
  },
  {
    id: "rockstar",
    name: "GTA آنلاین",
    latin: "Rockstar",
    icon: "rockstargames",
    hint: "GTA Online و RDR2",
    domains: ["rockstargames.com", "prod.ros.rockstargames.com"],
    tcpPorts: [443],
  },
  {
    id: "roblox",
    name: "رابلاکس",
    latin: "Roblox",
    icon: "roblox",
    hint: "کلاینت و سرویس احراز هویت",
    domains: ["roblox.com", "auth.roblox.com", "assetdelivery.roblox.com"],
    tcpPorts: [443],
  },
  {
    id: "epic",
    name: "اپیک گیمز",
    latin: "Epic Games",
    icon: "epicgames",
    hint: "استور و اکانت Epic",
    domains: ["epicgames.com", "store.epicgames.com", "account-public-service-prod03.ol.epicgames.com"],
    tcpPorts: [443],
  },
  {
    id: "genshin",
    name: "جنشین ایمپکت",
    latin: "Genshin Impact",
    icon: "img:/games/genshin.png",
    hint: "هویورس — Genshin / HSR / ZZZ",
    domains: ["hoyoverse.com", "genshin.hoyoverse.com", "mihoyo.com"],
    tcpPorts: [443],
  },
];

export function getPreset(id: string | null): GamePreset | null {
  if (!id) return null;
  return GAME_PRESETS.find((g) => g.id === id) ?? null;
}
