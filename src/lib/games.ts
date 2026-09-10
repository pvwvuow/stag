/**
 * Game presets for the DNS tester.
 * Shared between client (names/icons) and server (TCP ports) code.
 */

export interface GamePreset {
  id: string;
  name: string;
  shortName: string;
  hint: string;
  /** Domains probed through the user's DNS */
  domains: string[];
  /** TCP ports optionally probed on the first resolved IP (supplementary check) */
  tcpPorts: number[];
}

export const GAME_PRESETS: GamePreset[] = [
  {
    id: "marvel-rivals",
    name: "Marvel Rivals",
    shortName: "Rivals",
    hint: "شوتر قهرمان‌محور NetEase (استیم / PS5 / Xbox)",
    // Verified live: official site, NetEase service domain and NetEase account auth
    domains: ["marvelrivals.com", "www.marvelrivals.com", "neteasegames.com", "id.163.com"],
    tcpPorts: [443],
  },
  {
    id: "psn",
    name: "پلی‌استیشن (PSN)",
    shortName: "PSN",
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
    shortName: "Xbox",
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
    id: "cod",
    name: "کالاف دیوتی / وارزون",
    shortName: "CoD",
    hint: "Warzone / MW3 / BO6 (سرویس Demonware)",
    domains: ["activision.com", "callofduty.com", "demonware.net"],
    tcpPorts: [443, 3074],
  },
  {
    id: "fortnite",
    name: "فورتنایت",
    shortName: "Fortnite",
    hint: "سرویس‌های Epic Games",
    domains: ["epicgames.com", "fortnite.com", "account-public-service-prod03.ol.epicgames.com"],
    tcpPorts: [443, 5222],
  },
  {
    id: "ea",
    name: "EA / FC و آنلاین",
    shortName: "EA",
    hint: "EA FC, Apex, Battlefield",
    domains: ["ea.com", "accounts.ea.com", "update.ea.com"],
    tcpPorts: [443],
  },
  {
    id: "riot",
    name: "والورانت / لول",
    shortName: "Riot",
    hint: "Valorant و League of Legends",
    domains: ["riotgames.com", "auth.riotgames.com", "valorant.com"],
    tcpPorts: [443, 2099],
  },
  {
    id: "steam",
    name: "استیم",
    shortName: "Steam",
    hint: "استور و شبکه استیم",
    domains: ["store.steampowered.com", "steamcommunity.com", "api.steampowered.com"],
    tcpPorts: [443, 27017],
  },
  {
    id: "nintendo",
    name: "نینتندو سوییچ",
    shortName: "Switch",
    hint: "Switch و eShop",
    domains: ["nintendo.com", "accounts.nintendo.com", "ctest.cdn.nintendo.net"],
    tcpPorts: [443],
  },
  {
    id: "roblox",
    name: "رابلاکس",
    shortName: "Roblox",
    hint: "کلاینت و سرویس احراز هویت",
    domains: ["roblox.com", "auth.roblox.com", "assetdelivery.roblox.com"],
    tcpPorts: [443],
  },
  {
    id: "rockstar",
    name: "GTA آنلاین / راکستار",
    shortName: "Rockstar",
    hint: "GTA Online و RDR2",
    domains: ["rockstargames.com", "prod.ros.rockstargames.com"],
    tcpPorts: [443],
  },
];

export function getPreset(id: string | null): GamePreset | null {
  if (!id) return null;
  return GAME_PRESETS.find((g) => g.id === id) ?? null;
}
