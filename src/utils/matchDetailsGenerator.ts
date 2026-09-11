import { Match, MatchEvent, MatchLineups, MatchStats, MatchH2H, MatchVenue, MatchScore } from "../types";
import { getSportMatchInfo } from "./sportsSchedule";

/**
 * Real-world team rosters database for instant realistic squads & lineups
 */
const KNOWN_TEAM_ROSTERS: Record<string, { coach: string; formation: string; xi: string[]; subs: string[] }> = {
  "Real Madrid": {
    coach: "Carlo Ancelotti",
    formation: "4-3-3",
    xi: ["Thibaut Courtois (GK)", "Dani Carvajal", "Antonio Rüdiger", "Éder Militão", "Ferland Mendy", "Federico Valverde", "Aurélien Tchouaméni", "Jude Bellingham", "Rodrygo", "Kylian Mbappé", "Vinícius Júnior"],
    subs: ["Andriy Lunin", "Luka Modrić", "Eduardo Camavinga", "Brahim Díaz", "Endrick", "Arda Güler", "Lucas Vázquez"]
  },
  "Barcelona": {
    coach: "Hansi Flick",
    formation: "4-2-3-1",
    xi: ["Marc-André ter Stegen (GK)", "Jules Koundé", "Pau Cubarsí", "Iñigo Martínez", "Alejandro Balde", "Marc Casadó", "Pedri", "Lamine Yamal", "Dani Olmo", "Raphinha", "Robert Lewandowski"],
    subs: ["Iñaki Peña", "Gavi", "Ferran Torres", "Frenkie de Jong", "Ansu Fati", "Pau Víctor", "Eric García"]
  },
  "Manchester City": {
    coach: "Pep Guardiola",
    formation: "4-1-4-1",
    xi: ["Ederson (GK)", "Kyle Walker", "Rúben Dias", "Manuel Akanji", "Joško Gvardiol", "Rodri", "Bernardo Silva", "Kevin De Bruyne", "Phil Foden", "Jeremy Doku", "Erling Haaland"],
    subs: ["Stefan Ortega", "John Stones", "Nathan Aké", "Mateo Kovačić", "Jack Grealish", "Savinho", "Matheus Nunes"]
  },
  "Arsenal": {
    coach: "Mikel Arteta",
    formation: "4-3-3",
    xi: ["David Raya (GK)", "Ben White", "William Saliba", "Gabriel Magalhães", "Jurriën Timber", "Thomas Partey", "Declan Rice", "Martin Ødegaard", "Bukayo Saka", "Kai Havertz", "Gabriel Martinelli"],
    subs: ["Neto", "Riccardo Calafiori", "Oleksandr Zinchenko", "Jorginho", "Mikel Merino", "Leandro Trossard", "Gabriel Jesus"]
  },
  "Liverpool": {
    coach: "Arne Slot",
    formation: "4-2-3-1",
    xi: ["Alisson Becker (GK)", "Trent Alexander-Arnold", "Ibrahima Konaté", "Virgil van Dijk", "Andy Robertson", "Ryan Gravenberch", "Alexis Mac Allister", "Mohamed Salah", "Dominik Szoboszlai", "Luis Díaz", "Diogo Jota"],
    subs: ["Caoimhín Kelleher", "Joe Gomez", "Kostas Tsimikas", "Wataru Endo", "Curtis Jones", "Cody Gakpo", "Darwin Núñez"]
  },
  "Bayern Munich": {
    coach: "Vincent Kompany",
    formation: "4-2-3-1",
    xi: ["Manuel Neuer (GK)", "Konrad Laimer", "Dayot Upamecano", "Kim Min-jae", "Alphonso Davies", "Joshua Kimmich", "Aleksandar Pavlović", "Michael Olise", "Jamal Musiala", "Serge Gnabry", "Harry Kane"],
    subs: ["Sven Ulreich", "Eric Dier", "Raphaël Guerreiro", "João Palhinha", "Leon Goretzka", "Leroy Sané", "Kingsley Coman"]
  },
  "Paris Saint-Germain": {
    coach: "Luis Enrique",
    formation: "4-3-3",
    xi: ["Gianluigi Donnarumma (GK)", "Achraf Hakimi", "Marquinhos", "Willian Pacho", "Nuno Mendes", "Warren Zaïre-Emery", "Vitinha", "João Neves", "Ousmane Dembélé", "Marco Asensio", "Bradley Barcola"],
    subs: ["Matvey Safonov", "Lucas Beraldo", "Milan Škriniar", "Fabián Ruiz", "Lee Kang-in", "Randal Kolo Muani", "Gonçalo Ramos"]
  },
  "India": {
    coach: "Gautam Gambhir",
    formation: "T20 / ODI XI",
    xi: ["Rohit Sharma (C)", "Yashasvi Jaiswal", "Virat Kohli", "Suryakumar Yadav", "Rishabh Pant (WK)", "Hardik Pandya", "Ravindra Jadeja", "Axar Patel", "Kuldeep Yadav", "Jasprit Bumrah", "Mohammed Siraj"],
    subs: ["Shubman Gill", "Sanju Samson", "Arshdeep Singh", "Mohammed Shami", "Yuzvendra Chahal"]
  },
  "Australia": {
    coach: "Andrew McDonald",
    formation: "T20 / ODI XI",
    xi: ["Travis Head", "David Warner", "Mitchell Marsh (C)", "Steve Smith", "Glenn Maxwell", "Marcus Stoinis", "Josh Inglis (WK)", "Pat Cummins", "Mitchell Starc", "Adam Zampa", "Josh Hazlewood"],
    subs: ["Matthew Wade", "Tim David", "Ashton Agar", "Nathan Ellis", "Sean Abbott"]
  },
  "Pakistan": {
    coach: "Gary Kirsten",
    formation: "T20 / ODI XI",
    xi: ["Babar Azam (C)", "Mohammad Rizwan (WK)", "Fakhar Zaman", "Usman Khan", "Iftikhar Ahmed", "Shadab Khan", "Imad Wasim", "Shaheen Shah Afridi", "Naseem Shah", "Haris Rauf", "Mohammad Amir"],
    subs: ["Saim Ayub", "Azam Khan", "Abrar Ahmed", "Abbas Afridi"]
  },
  "England": {
    coach: "Brendon McCullum",
    formation: "T20 / ODI XI",
    xi: ["Jos Buttler (C & WK)", "Phil Salt", "Will Jacks", "Jonny Bairstow", "Harry Brook", "Liam Livingstone", "Moeen Ali", "Sam Curran", "Jofra Archer", "Adil Rashid", "Reece Topley"],
    subs: ["Ben Duckett", "Chris Jordan", "Tom Hartley", "Mark Wood"]
  }
};

/**
 * Famous stadiums per team/league
 */
const KNOWN_VENUES: Record<string, MatchVenue> = {
  "Real Madrid": { name: "Santiago Bernabéu", city: "Madrid", country: "Spain", capacity: "85,000", surface: "Natural Grass" },
  "Barcelona": { name: "Estadi Olímpic Lluís Companys", city: "Barcelona", country: "Spain", capacity: "54,367", surface: "Natural Grass" },
  "Manchester City": { name: "Etihad Stadium", city: "Manchester", country: "England", capacity: "53,400", surface: "Hybrid Grass" },
  "Arsenal": { name: "Emirates Stadium", city: "London", country: "England", capacity: "60,704", surface: "Hybrid Grass" },
  "Liverpool": { name: "Anfield", city: "Liverpool", country: "England", capacity: "61,276", surface: "Hybrid Grass" },
  "Chelsea": { name: "Stamford Bridge", city: "London", country: "England", capacity: "40,341", surface: "Hybrid Grass" },
  "Manchester United": { name: "Old Trafford", city: "Manchester", country: "England", capacity: "74,310", surface: "Hybrid Grass" },
  "Bayern Munich": { name: "Allianz Arena", city: "Munich", country: "Germany", capacity: "75,024", surface: "Natural Grass" },
  "Paris Saint-Germain": { name: "Parc des Princes", city: "Paris", country: "France", capacity: "47,929", surface: "Hybrid Grass" },
  "Juventus": { name: "Allianz Stadium", city: "Turin", country: "Italy", capacity: "41,507", surface: "Natural Grass" },
  "Inter": { name: "San Siro (Giuseppe Meazza)", city: "Milan", country: "Italy", capacity: "75,817", surface: "Hybrid Grass" },
  "Milan": { name: "San Siro", city: "Milan", country: "Italy", capacity: "75,817", surface: "Hybrid Grass" },
  "India": { name: "Narendra Modi Stadium", city: "Ahmedabad", country: "India", capacity: "132,000", surface: "Cricket Turf" },
  "Australia": { name: "Melbourne Cricket Ground (MCG)", city: "Melbourne", country: "Australia", capacity: "100,024", surface: "Cricket Turf" },
  "England Cricket": { name: "Lord's Cricket Ground", city: "London", country: "United Kingdom", capacity: "31,100", surface: "Cricket Turf" }
};

/**
 * Generate smart deterministic squads if team not in static table
 */
function generateProceduralSquad(teamName: string, sport: string): { coach: string; formation: string; xi: string[]; subs: string[] } {
  const isCricket = sport.toLowerCase().includes("cricket");
  const isBasketball = sport.toLowerCase().includes("basket") || sport.toLowerCase().includes("nba");

  if (isCricket) {
    return {
      coach: `${teamName} Head Coach`,
      formation: "Playing XI",
      xi: [
        `${teamName} Opener 1 (C)`,
        `${teamName} Opener 2`,
        `${teamName} Top Order 3`,
        `${teamName} Batsman 4`,
        `${teamName} Wicket Keeper (WK)`,
        `${teamName} All-Rounder 1`,
        `${teamName} All-Rounder 2`,
        `${teamName} Spin Specialist`,
        `${teamName} Pace Bowler 1`,
        `${teamName} Fast Bowler 2`,
        `${teamName} Strike Bowler`
      ],
      subs: [`${teamName} 12th Man`, `${teamName} Reserve Batter`, `${teamName} Backup Pacer`, `${teamName} Extra Keeper`]
    };
  }

  if (isBasketball) {
    return {
      coach: `${teamName} Head Coach`,
      formation: "Starting Five (1-2-2)",
      xi: [
        `PG • ${teamName} Point Guard`,
        `SG • ${teamName} Shooting Guard`,
        `SF • ${teamName} Small Forward`,
        `PF • ${teamName} Power Forward`,
        `C • ${teamName} Center`
      ],
      subs: [`6th Man • Sixth Guard`, `Bench Forward`, `Backup Center`, `Shooter`, `Rookie`]
    };
  }

  // Standard Football 4-3-3 default
  return {
    coach: `${teamName} Technical Coach`,
    formation: "4-3-3",
    xi: [
      `1 • ${teamName} Keeper (GK)`,
      `2 • ${teamName} Right Back`,
      `4 • ${teamName} Center Back (C)`,
      `5 • ${teamName} Center Back`,
      `3 • ${teamName} Left Back`,
      `6 • ${teamName} Defensive Midfielder`,
      `8 • ${teamName} Central Midfielder`,
      `10 • ${teamName} Playmaker`,
      `7 • ${teamName} Right Winger`,
      `9 • ${teamName} Center Forward`,
      `11 • ${teamName} Left Winger`
    ],
    subs: [`13 • Reserve Keeper`, `15 • Defender`, `18 • Midfielder`, `19 • Winger`, `21 • Striker`]
  };
}

/**
 * Generates or extracts full match intelligence details for any Match
 */
export function getEnrichedMatchDetails(match: Match): {
  score: MatchScore;
  venue: MatchVenue;
  referee: string;
  round: string;
  season: string;
  lineups: MatchLineups;
  events: MatchEvent[];
  stats: MatchStats;
  h2h: MatchH2H[];
  weather: { temp: string; condition: string; humidity: string; wind: string };
  isLive: boolean;
  matchElapsedMinutes: number;
} {
  const sport = match.category || "football";
  const isCricket = sport.toLowerCase().includes("cricket");
  const isBasketball = sport.toLowerCase().includes("basket") || sport.toLowerCase().includes("nba");

  const startMs = match.startTime ? new Date(match.startTime).getTime() : Date.now();
  const now = Date.now();
  const elapsedMs = Math.max(0, now - startMs);
  const elapsedMins = Math.min(120, Math.floor(elapsedMs / 60000));
  const isLive = match.status === "live" || (now >= startMs && now <= startMs + (match.durationMinutes || 115) * 60000);

  // 1. Score Calculation / Parsing
  let parsedScore: MatchScore = {
    home: "-",
    away: "-",
    text: "",
    period: isLive ? "LIVE" : "Upcoming",
    minute: isLive ? elapsedMins : undefined
  };

  if (match.score) {
    if (typeof match.score === "string") {
      const parts = match.score.split("-").map(s => s.trim());
      if (parts.length === 2) {
        parsedScore.home = parts[0];
        parsedScore.away = parts[1];
        parsedScore.text = match.score;
      }
    } else if (typeof match.score === "object") {
      parsedScore = { ...parsedScore, ...match.score };
    }
  }

  // 2. Venue details
  const team1Name = match.team1 || "Home";
  const team2Name = match.team2 || "Away";
  const matchedVenue = KNOWN_VENUES[team1Name] || KNOWN_VENUES[team2Name];
  const venue: MatchVenue = (typeof match.venue === "object" && match.venue) ? match.venue : {
    name: typeof match.venue === "string" ? match.venue : (matchedVenue?.name || `${team1Name} Arena / Sports Complex`),
    city: matchedVenue?.city || "Metropolis",
    country: matchedVenue?.country || "International",
    capacity: matchedVenue?.capacity || "62,500",
    surface: matchedVenue?.surface || (isCricket ? "Turf Pitch" : "Hybrid Grass")
  };

  // 3. Lineups
  const homeRoster = KNOWN_TEAM_ROSTERS[team1Name] || generateProceduralSquad(team1Name, sport);
  const awayRoster = KNOWN_TEAM_ROSTERS[team2Name] || generateProceduralSquad(team2Name, sport);

  const lineups: MatchLineups = match.lineups || {
    home: {
      formation: homeRoster.formation,
      coach: homeRoster.coach,
      startingXI: homeRoster.xi.map((name, idx) => ({
        name,
        number: idx + 1,
        position: idx === 0 ? "GK" : idx < 5 ? "DEF" : idx < 8 ? "MID" : "FWD",
        isCaptain: idx === 0 || name.includes("(C)")
      })),
      substitutes: homeRoster.subs.map((name, idx) => ({ name, number: 12 + idx }))
    },
    away: {
      formation: awayRoster.formation,
      coach: awayRoster.coach,
      startingXI: awayRoster.xi.map((name, idx) => ({
        name,
        number: idx + 1,
        position: idx === 0 ? "GK" : idx < 5 ? "DEF" : idx < 8 ? "MID" : "FWD",
        isCaptain: idx === 0 || name.includes("(C)")
      })),
      substitutes: awayRoster.subs.map((name, idx) => ({ name, number: 12 + idx }))
    }
  };

  // 4. Match Timeline Events
  const events: MatchEvent[] = match.events || [];
  if (events.length === 0 && (isLive || match.status === "finished" || match.status === "ended")) {
    events.push({ minute: "1'", type: "whistle", team: "system", detail: "Kick-off • Match underway at " + venue.name });
    if (elapsedMins >= 18) {
      events.push({
        minute: "18'",
        type: "goal",
        team: "home",
        player: homeRoster.xi[9] || `${team1Name} Striker`,
        detail: "Goal! Powerful strike into the top right corner"
      });
    }
    if (elapsedMins >= 34) {
      events.push({
        minute: "34'",
        type: "card_yellow",
        team: "away",
        player: awayRoster.xi[5] || `${team2Name} Midfielder`,
        detail: "Tactical foul on counter attack"
      });
    }
    if (elapsedMins >= 45) {
      events.push({ minute: "45+2'", type: "half", team: "system", detail: "Half-time whistle" });
    }
    if (elapsedMins >= 61) {
      events.push({
        minute: "61'",
        type: "goal",
        team: "away",
        player: awayRoster.xi[10] || `${team2Name} Forward`,
        detail: "Goal! Equalizer scored from close range"
      });
    }
    if (elapsedMins >= 75) {
      events.push({
        minute: "75'",
        type: "sub",
        team: "home",
        player: `${homeRoster.subs[0]} in for ${homeRoster.xi[7]}`,
        detail: "Tactical substitution"
      });
    }
    if (elapsedMins >= 82) {
      events.push({
        minute: "82'",
        type: "goal",
        team: "home",
        player: homeRoster.xi[10] || `${team1Name} Winger`,
        detail: "Goal! Clinical finish after a great team move"
      });
    }
  }

  // 5. Statistics
  const stats: MatchStats = match.stats || {
    possession: { home: 54, away: 46 },
    shots: { home: 14, away: 9 },
    shotsOnTarget: { home: 6, away: 4 },
    corners: { home: 7, away: 3 },
    fouls: { home: 10, away: 12 },
    yellowCards: { home: 1, away: 2 },
    redCards: { home: 0, away: 0 },
    passes: { home: 490, away: 412 },
    passAccuracy: { home: 88, away: 82 }
  };

  // 6. Head-to-Head History (Past 5 encounters)
  const h2h: MatchH2H[] = match.h2h || [
    { date: "2025-10-24", homeTeam: team1Name, awayTeam: team2Name, score: "2 - 1", winner: team1Name, tournament: match.tournament || "League" },
    { date: "2025-04-18", homeTeam: team2Name, awayTeam: team1Name, score: "1 - 1", winner: "Draw", tournament: match.tournament || "League" },
    { date: "2024-11-09", homeTeam: team1Name, awayTeam: team2Name, score: "3 - 2", winner: team1Name, tournament: match.tournament || "Cup" },
    { date: "2024-03-03", homeTeam: team2Name, awayTeam: team1Name, score: "0 - 1", winner: team1Name, tournament: match.tournament || "League" },
    { date: "2023-09-21", homeTeam: team1Name, awayTeam: team2Name, score: "2 - 2", winner: "Draw", tournament: match.tournament || "Super Cup" }
  ];

  return {
    score: parsedScore,
    venue,
    referee: match.referee || "Michael Oliver (FIFA)",
    round: match.round || match.eventName || "Matchday 26",
    season: String(match.season || "2025/2026"),
    lineups,
    events,
    stats,
    h2h,
    weather: match.weather ? {
      temp: match.weather.temp || "19°C",
      condition: match.weather.condition || "Clear Night",
      humidity: match.weather.humidity || "62%",
      wind: match.weather.wind || "8 km/h"
    } : { temp: "19°C", condition: "Clear Night", humidity: "62%", wind: "8 km/h" },
    isLive,
    matchElapsedMinutes: elapsedMins
  };
}
