export interface ImportantCountryLeagues {
  country: string;
  countryCode: string;
  flagUrl: string;
  leagues: {
    id: number;
    name: string;
    logo: string;
    type: "league" | "cup" | "international";
    priority: number;
  }[];
}

export const MAIN_NATIONS_LEAGUES: ImportantCountryLeagues[] = [
  {
    country: "Spain",
    countryCode: "ES",
    flagUrl: "https://media.api-sports.io/flags/es.svg",
    leagues: [
      {
        id: 140,
        name: "La Liga",
        logo: "https://media.api-sports.io/football/leagues/140.png",
        type: "league",
        priority: 1
      },
      {
        id: 143,
        name: "Copa del Rey",
        logo: "https://media.api-sports.io/football/leagues/143.png",
        type: "cup",
        priority: 2
      },
      {
        id: 556,
        name: "Supercopa de España",
        logo: "https://media.api-sports.io/football/leagues/556.png",
        type: "cup",
        priority: 3
      },
      {
        id: 141,
        name: "Segunda División (La Liga 2)",
        logo: "https://media.api-sports.io/football/leagues/141.png",
        type: "league",
        priority: 4
      }
    ]
  },
  {
    country: "England",
    countryCode: "GB",
    flagUrl: "https://media.api-sports.io/flags/gb.svg",
    leagues: [
      {
        id: 39,
        name: "Premier League",
        logo: "https://media.api-sports.io/football/leagues/39.png",
        type: "league",
        priority: 1
      },
      {
        id: 45,
        name: "FA Cup",
        logo: "https://media.api-sports.io/football/leagues/45.png",
        type: "cup",
        priority: 2
      },
      {
        id: 48,
        name: "Carabao Cup (EFL Cup)",
        logo: "https://media.api-sports.io/football/leagues/48.png",
        type: "cup",
        priority: 3
      },
      {
        id: 40,
        name: "Championship",
        logo: "https://media.api-sports.io/football/leagues/40.png",
        type: "league",
        priority: 4
      },
      {
        id: 528,
        name: "FA Community Shield",
        logo: "https://media.api-sports.io/football/leagues/528.png",
        type: "cup",
        priority: 5
      }
    ]
  },
  {
    country: "Europe / International",
    countryCode: "WORLD",
    flagUrl: "https://media.api-sports.io/flags/world.svg",
    leagues: [
      {
        id: 2,
        name: "UEFA Champions League",
        logo: "https://media.api-sports.io/football/leagues/2.png",
        type: "international",
        priority: 1
      },
      {
        id: 3,
        name: "UEFA Europa League",
        logo: "https://media.api-sports.io/football/leagues/3.png",
        type: "international",
        priority: 2
      },
      {
        id: 848,
        name: "UEFA Europa Conference League",
        logo: "https://media.api-sports.io/football/leagues/848.png",
        type: "international",
        priority: 3
      },
      {
        id: 531,
        name: "UEFA Super Cup",
        logo: "https://media.api-sports.io/football/leagues/531.png",
        type: "cup",
        priority: 4
      },
      {
        id: 1,
        name: "FIFA World Cup",
        logo: "https://media.api-sports.io/football/leagues/1.png",
        type: "international",
        priority: 1
      },
      {
        id: 4,
        name: "UEFA European Championship (Euro)",
        logo: "https://media.api-sports.io/football/leagues/4.png",
        type: "international",
        priority: 1
      },
      {
        id: 9,
        name: "Copa América",
        logo: "https://media.api-sports.io/football/leagues/9.png",
        type: "international",
        priority: 2
      },
      {
        id: 5,
        name: "UEFA Nations League",
        logo: "https://media.api-sports.io/football/leagues/5.png",
        type: "international",
        priority: 3
      },
      {
        id: 15,
        name: "FIFA Club World Cup",
        logo: "https://media.api-sports.io/football/leagues/15.png",
        type: "cup",
        priority: 4
      },
      {
        id: 17,
        name: "AFC Champions League",
        logo: "https://media.api-sports.io/football/leagues/17.png",
        type: "international",
        priority: 5
      }
    ]
  },
  {
    country: "Italy",
    countryCode: "IT",
    flagUrl: "https://media.api-sports.io/flags/it.svg",
    leagues: [
      {
        id: 135,
        name: "Serie A",
        logo: "https://media.api-sports.io/football/leagues/135.png",
        type: "league",
        priority: 1
      },
      {
        id: 137,
        name: "Coppa Italia",
        logo: "https://media.api-sports.io/football/leagues/137.png",
        type: "cup",
        priority: 2
      },
      {
        id: 547,
        name: "Supercoppa Italiana",
        logo: "https://media.api-sports.io/football/leagues/547.png",
        type: "cup",
        priority: 3
      }
    ]
  },
  {
    country: "Germany",
    countryCode: "DE",
    flagUrl: "https://media.api-sports.io/flags/de.svg",
    leagues: [
      {
        id: 78,
        name: "Bundesliga",
        logo: "https://media.api-sports.io/football/leagues/78.png",
        type: "league",
        priority: 1
      },
      {
        id: 81,
        name: "DFB-Pokal",
        logo: "https://media.api-sports.io/football/leagues/81.png",
        type: "cup",
        priority: 2
      },
      {
        id: 529,
        name: "DFL-Supercup",
        logo: "https://media.api-sports.io/football/leagues/529.png",
        type: "cup",
        priority: 3
      }
    ]
  },
  {
    country: "France",
    countryCode: "FR",
    flagUrl: "https://media.api-sports.io/flags/fr.svg",
    leagues: [
      {
        id: 61,
        name: "Ligue 1",
        logo: "https://media.api-sports.io/football/leagues/61.png",
        type: "league",
        priority: 1
      },
      {
        id: 66,
        name: "Coupe de France",
        logo: "https://media.api-sports.io/football/leagues/66.png",
        type: "cup",
        priority: 2
      },
      {
        id: 526,
        name: "Trophée des Champions",
        logo: "https://media.api-sports.io/football/leagues/526.png",
        type: "cup",
        priority: 3
      }
    ]
  },
  {
    country: "Saudi Arabia",
    countryCode: "SA",
    flagUrl: "https://media.api-sports.io/flags/sa.svg",
    leagues: [
      {
        id: 307,
        name: "Saudi Pro League (Roshn Saudi League)",
        logo: "https://media.api-sports.io/football/leagues/307.png",
        type: "league",
        priority: 1
      },
      {
        id: 308,
        name: "King's Cup",
        logo: "https://media.api-sports.io/football/leagues/308.png",
        type: "cup",
        priority: 2
      },
      {
        id: 585,
        name: "Saudi Super Cup",
        logo: "https://media.api-sports.io/football/leagues/585.png",
        type: "cup",
        priority: 3
      }
    ]
  },
  {
    country: "Portugal",
    countryCode: "PT",
    flagUrl: "https://media.api-sports.io/flags/pt.svg",
    leagues: [
      {
        id: 94,
        name: "Primeira Liga (Liga Portugal)",
        logo: "https://media.api-sports.io/football/leagues/94.png",
        type: "league",
        priority: 1
      },
      {
        id: 96,
        name: "Taça de Portugal",
        logo: "https://media.api-sports.io/football/leagues/96.png",
        type: "cup",
        priority: 2
      }
    ]
  },
  {
    country: "Netherlands",
    countryCode: "NL",
    flagUrl: "https://media.api-sports.io/flags/nl.svg",
    leagues: [
      {
        id: 88,
        name: "Eredivisie",
        logo: "https://media.api-sports.io/football/leagues/88.png",
        type: "league",
        priority: 1
      },
      {
        id: 90,
        name: "KNVB Beker",
        logo: "https://media.api-sports.io/football/leagues/90.png",
        type: "cup",
        priority: 2
      }
    ]
  },
  {
    country: "Brazil",
    countryCode: "BR",
    flagUrl: "https://media.api-sports.io/flags/br.svg",
    leagues: [
      {
        id: 71,
        name: "Serie A (Brasileirão)",
        logo: "https://media.api-sports.io/football/leagues/71.png",
        type: "league",
        priority: 1
      },
      {
        id: 73,
        name: "Copa do Brasil",
        logo: "https://media.api-sports.io/football/leagues/73.png",
        type: "cup",
        priority: 2
      }
    ]
  },
  {
    country: "USA",
    countryCode: "US",
    flagUrl: "https://media.api-sports.io/flags/us.svg",
    leagues: [
      {
        id: 253,
        name: "Major League Soccer (MLS)",
        logo: "https://media.api-sports.io/football/leagues/253.png",
        type: "league",
        priority: 1
      },
      {
        id: 850,
        name: "Leagues Cup",
        logo: "https://media.api-sports.io/football/leagues/850.png",
        type: "cup",
        priority: 2
      },
      {
        id: 257,
        name: "US Open Cup",
        logo: "https://media.api-sports.io/football/leagues/257.png",
        type: "cup",
        priority: 3
      }
    ]
  },
  {
    country: "Argentina",
    countryCode: "AR",
    flagUrl: "https://media.api-sports.io/flags/ar.svg",
    leagues: [
      {
        id: 128,
        name: "Liga Profesional (Primera División)",
        logo: "https://media.api-sports.io/football/leagues/128.png",
        type: "league",
        priority: 1
      },
      {
        id: 130,
        name: "Copa Argentina",
        logo: "https://media.api-sports.io/football/leagues/130.png",
        type: "cup",
        priority: 2
      }
    ]
  },
  {
    country: "Turkey",
    countryCode: "TR",
    flagUrl: "https://media.api-sports.io/flags/tr.svg",
    leagues: [
      {
        id: 203,
        name: "Süper Lig",
        logo: "https://media.api-sports.io/football/leagues/203.png",
        type: "league",
        priority: 1
      },
      {
        id: 206,
        name: "Turkish Cup",
        logo: "https://media.api-sports.io/football/leagues/206.png",
        type: "cup",
        priority: 2
      }
    ]
  },
  {
    country: "Scotland",
    countryCode: "GB",
    flagUrl: "https://media.api-sports.io/flags/gb.svg",
    leagues: [
      {
        id: 179,
        name: "Scottish Premiership",
        logo: "https://media.api-sports.io/football/leagues/179.png",
        type: "league",
        priority: 1
      }
    ]
  },
  {
    country: "Belgium",
    countryCode: "BE",
    flagUrl: "https://media.api-sports.io/flags/be.svg",
    leagues: [
      {
        id: 144,
        name: "Jupiler Pro League",
        logo: "https://media.api-sports.io/football/leagues/144.png",
        type: "league",
        priority: 1
      }
    ]
  }
];

// Flat array of all important league IDs for quick matching
export const IMPORTANT_LEAGUE_IDS = new Set<number>(
  MAIN_NATIONS_LEAGUES.flatMap(n => n.leagues.map(l => l.id))
);

export function isImportantLeague(leagueId: number): boolean {
  return IMPORTANT_LEAGUE_IDS.has(leagueId);
}

export function getLeagueDetailsById(leagueId: number) {
  for (const nation of MAIN_NATIONS_LEAGUES) {
    const found = nation.leagues.find(l => l.id === leagueId);
    if (found) {
      return {
        ...found,
        country: nation.country,
        countryCode: nation.countryCode,
        flagUrl: nation.flagUrl
      };
    }
  }
  return null;
}
