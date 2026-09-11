export interface LeagueItem {
  name: string;
  logo: string;
  category: string;
}

export const POPULAR_LEAGUES: LeagueItem[] = [
  // Football / Soccer
  {
    name: "UEFA Champions League",
    logo: "https://upload.wikimedia.org/wikipedia/en/b/bf/UEFA_Champions_League_logo_2.svg",
    category: "football"
  },
  {
    name: "Premier League",
    logo: "https://upload.wikimedia.org/wikipedia/en/f/f2/Premier_League_Logo.svg",
    category: "football"
  },
  {
    name: "La Liga",
    logo: "https://upload.wikimedia.org/wikipedia/commons/0/0f/LaLiga_logo_2023.svg",
    category: "football"
  },
  {
    name: "Serie A",
    logo: "https://upload.wikimedia.org/wikipedia/commons/e/e9/Serie_A_logo_2019.svg",
    category: "football"
  },
  {
    name: "Bundesliga",
    logo: "https://upload.wikimedia.org/wikipedia/en/d/df/Bundesliga_logo_%282017%29.svg",
    category: "football"
  },
  {
    name: "Ligue 1",
    logo: "https://upload.wikimedia.org/wikipedia/commons/4/4c/Ligue_1_logo_%282024%29.svg",
    category: "football"
  },
  {
    name: "UEFA Europa League",
    logo: "https://upload.wikimedia.org/wikipedia/en/0/03/UEFA_Europa_League_logo_%282021%29.svg",
    category: "football"
  },
  {
    name: "FIFA World Cup",
    logo: "https://upload.wikimedia.org/wikipedia/en/e/e3/2026_FIFA_World_Cup_emblem.svg",
    category: "football"
  },
  {
    name: "Copa América",
    logo: "https://upload.wikimedia.org/wikipedia/en/3/30/2024_Copa_Am%C3%A9rica_logo.svg",
    category: "football"
  },
  {
    name: "UEFA Euro",
    logo: "https://upload.wikimedia.org/wikipedia/en/9/96/UEFA_Euro_2024_logo.svg",
    category: "football"
  },
  {
    name: "MLS (Major League Soccer)",
    logo: "https://upload.wikimedia.org/wikipedia/commons/7/76/MLS_crest_logo_RGB_gradient.svg",
    category: "football"
  },
  {
    name: "Saudi Pro League",
    logo: "https://upload.wikimedia.org/wikipedia/en/4/4b/Saudi_Pro_League_logo.svg",
    category: "football"
  },

  // Cricket
  {
    name: "ICC Men's T20 World Cup, 2026",
    logo: "https://upload.wikimedia.org/wikipedia/en/5/5a/2024_ICC_Men%27s_T20_World_Cup_logo.svg",
    category: "cricket"
  },
  {
    name: "Indian Premier League (IPL)",
    logo: "https://upload.wikimedia.org/wikipedia/en/8/84/Indian_Premier_League_Official_Logo.svg",
    category: "cricket"
  },
  {
    name: "ICC Cricket World Cup",
    logo: "https://upload.wikimedia.org/wikipedia/en/7/7b/2023_Cricket_World_Cup_logo.svg",
    category: "cricket"
  },
  {
    name: "ICC Champions Trophy",
    logo: "https://upload.wikimedia.org/wikipedia/en/b/b3/ICC_Champions_Trophy_2025_Logo.svg",
    category: "cricket"
  },
  {
    name: "ICC World Test Championship",
    logo: "https://upload.wikimedia.org/wikipedia/en/e/e0/ICC_World_Test_Championship_Logo.svg",
    category: "cricket"
  },
  {
    name: "Big Bash League (BBL)",
    logo: "https://upload.wikimedia.org/wikipedia/en/d/db/Big_Bash_League_%28logo%29.svg",
    category: "cricket"
  },
  {
    name: "Pakistan Super League (PSL)",
    logo: "https://upload.wikimedia.org/wikipedia/en/3/36/Pakistan_Super_League_Logo.svg",
    category: "cricket"
  },
  {
    name: "The Ashes",
    logo: "https://upload.wikimedia.org/wikipedia/en/1/1a/The_Ashes_logo.svg",
    category: "cricket"
  },
  {
    name: "Caribbean Premier League (CPL)",
    logo: "https://upload.wikimedia.org/wikipedia/en/5/5c/Caribbean_Premier_League_logo.svg",
    category: "cricket"
  },
  {
    name: "SA20 League",
    logo: "https://upload.wikimedia.org/wikipedia/en/2/29/SA20_logo.svg",
    category: "cricket"
  },

  // Motorsport
  {
    name: "Formula 1 World Championship",
    logo: "https://upload.wikimedia.org/wikipedia/commons/3/33/F1.svg",
    category: "motorsport"
  },
  {
    name: "MotoGP World Championship",
    logo: "https://upload.wikimedia.org/wikipedia/commons/a/a0/Moto_Gp_logo.svg",
    category: "motorsport"
  },
  {
    name: "NASCAR Cup Series",
    logo: "https://upload.wikimedia.org/wikipedia/commons/e/ea/NASCAR_Cup_Series_logo.svg",
    category: "motorsport"
  },
  {
    name: "World Rally Championship (WRC)",
    logo: "https://upload.wikimedia.org/wikipedia/commons/f/ff/FIA_World_Rally_Championship_logo.svg",
    category: "motorsport"
  },

  // Basketball
  {
    name: "NBA (National Basketball Association)",
    logo: "https://upload.wikimedia.org/wikipedia/en/0/03/National_Basketball_Association_logo.svg",
    category: "basketball"
  },
  {
    name: "EuroLeague Basketball",
    logo: "https://upload.wikimedia.org/wikipedia/en/1/10/Euroleague_Basketball_logo.svg",
    category: "basketball"
  },
  {
    name: "FIBA Basketball World Cup",
    logo: "https://upload.wikimedia.org/wikipedia/en/b/b3/FIBA_Basketball_World_Cup_logo.svg",
    category: "basketball"
  },

  // Tennis
  {
    name: "Wimbledon Championship",
    logo: "https://upload.wikimedia.org/wikipedia/en/b/b8/Wimbledon_logo.svg",
    category: "tennis"
  },
  {
    name: "US Open Tennis",
    logo: "https://upload.wikimedia.org/wikipedia/en/c/c5/US_Open_logo.svg",
    category: "tennis"
  },
  {
    name: "Australian Open",
    logo: "https://upload.wikimedia.org/wikipedia/en/6/6f/Australian_Open_logo.svg",
    category: "tennis"
  },
  {
    name: "Roland Garros (French Open)",
    logo: "https://upload.wikimedia.org/wikipedia/en/8/87/Roland_Garros_logo.svg",
    category: "tennis"
  },
  {
    name: "ATP Tour Masters 1000",
    logo: "https://upload.wikimedia.org/wikipedia/en/d/df/ATP_Tour_logo.svg",
    category: "tennis"
  },

  // Wrestling & MMA
  {
    name: "WWE Raw / SmackDown / PLE",
    logo: "https://upload.wikimedia.org/wikipedia/commons/0/03/WWE_Logo.svg",
    category: "wrestling"
  },
  {
    name: "WWE WrestleMania",
    logo: "https://upload.wikimedia.org/wikipedia/en/0/07/WrestleMania_XL_logo.svg",
    category: "wrestling"
  },
  {
    name: "AEW (All Elite Wrestling)",
    logo: "https://upload.wikimedia.org/wikipedia/commons/e/eb/All_Elite_Wrestling_logo.svg",
    category: "wrestling"
  },
  {
    name: "UFC (Ultimate Fighting Championship)",
    logo: "https://upload.wikimedia.org/wikipedia/commons/0/0d/UFC_logo.svg",
    category: "mma"
  },
  {
    name: "ONE Championship",
    logo: "https://upload.wikimedia.org/wikipedia/en/d/dc/ONE_Championship_logo.svg",
    category: "mma"
  },

  // American Football & Baseball & Hockey
  {
    name: "NFL (National Football League)",
    logo: "https://upload.wikimedia.org/wikipedia/en/a/a2/National_Football_League_logo.svg",
    category: "americanfootball"
  },
  {
    name: "MLB (Major League Baseball)",
    logo: "https://upload.wikimedia.org/wikipedia/en/a/a6/Major_League_Baseball_logo.svg",
    category: "baseball"
  },
  {
    name: "NHL (National Hockey League)",
    logo: "https://upload.wikimedia.org/wikipedia/en/3/3a/05_NHL_Shield.svg",
    category: "hockey"
  },

  // Rugby & Golf & Badminton
  {
    name: "Rugby World Cup / Six Nations",
    logo: "https://upload.wikimedia.org/wikipedia/en/6/6c/Six_Nations_Championship_logo.svg",
    category: "rugby"
  },
  {
    name: "PGA Tour / The Masters",
    logo: "https://upload.wikimedia.org/wikipedia/en/0/01/PGA_Tour_logo.svg",
    category: "golf"
  },
  {
    name: "BWF World Tour (Badminton)",
    logo: "https://upload.wikimedia.org/wikipedia/en/a/a3/Badminton_World_Federation_logo.svg",
    category: "badminton"
  },

  // Esports & Cinema
  {
    name: "League of Legends Worlds (LoL)",
    logo: "https://upload.wikimedia.org/wikipedia/en/thumb/7/77/League_of_Legends_logo.svg/500px-League_of_Legends_logo.svg.png",
    category: "esports"
  },
  {
    name: "Valorant Champions Tour (VCT)",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fc/Valorant_logo_-_pink_color_version.svg/500px-Valorant_logo_-_pink_color_version.svg.png",
    category: "esports"
  },
  {
    name: "Dota 2 The International",
    logo: "https://upload.wikimedia.org/wikipedia/en/thumb/2/20/Dota_2_The_International_Logo.svg/500px-Dota_2_The_International_Logo.svg.png",
    category: "esports"
  }
];
