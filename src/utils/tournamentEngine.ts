import { Team, Match, GroupStanding, MatchStage } from '../types';

// Calendar dates helper
export const GAME_CALENDAR = [
  { day: 0, date: '10. Juni 2026', type: 'training', label: 'Vorbereitung & Training' },
  { day: 1, date: '11. Juni 2026', type: 'matchday', label: 'Gruppenphase - Spieltag 1 (Gr. A-D)' },
  { day: 2, date: '12. Juni 2026', type: 'matchday', label: 'Gruppenphase - Spieltag 1 (Gr. E-H)' },
  { day: 3, date: '13. Juni 2026', type: 'training', label: 'Training & Transferfenster' },
  { day: 4, date: '14. Juni 2026', type: 'matchday', label: 'Gruppenphase - Spieltag 2 (Gr. A-D)' },
  { day: 5, date: '15. Juni 2026', type: 'matchday', label: 'Gruppenphase - Spieltag 2 (Gr. E-H)' },
  { day: 6, date: '16. Juni 2026', type: 'training', label: 'Training & Transferfenster' },
  { day: 7, date: '17. Juni 2026', type: 'matchday', label: 'Gruppenphase - Spieltag 3 (Gr. A-D)' },
  { day: 8, date: '18. Juni 2026', type: 'matchday', label: 'Gruppenphase - Spieltag 3 (Gr. E-H)' },
  { day: 9, date: '19. Juni 2026', type: 'training', label: 'Training & Transferfenster' },
  { day: 10, date: '20. Juni 2026', type: 'matchday', label: 'Achtelfinale' },
  { day: 11, date: '21. Juni 2026', type: 'training', label: 'Training & Transferfenster' },
  { day: 12, date: '22. Juni 2026', type: 'matchday', label: 'Viertelfinale' },
  { day: 13, date: '23. Juni 2026', type: 'training', label: 'Training & Transferfenster' },
  { day: 14, date: '24. Juni 2026', type: 'matchday', label: 'Halbfinale' },
  { day: 15, date: '25. Juni 2026', type: 'training', label: 'Training & Letzte Transfers' },
  { day: 16, date: '26. Juni 2026', type: 'matchday', label: 'Finale & Spiel um Platz 3' }
];

const GROUPS: ('A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H')[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

// Generates all 48 group stage matches scheduled across days 1, 2, 4, 5, 7, 8
export function generateGroupMatches(teams: Team[]): Match[] {
  const matches: Match[] = [];

  for (const group of GROUPS) {
    const groupTeams = teams.filter(t => {
      // Find group designation from initial database placement
      // Teams configuration maps to Group based on original setup
      // We will read team configs or we can deduce it
      return getGroupForTeam(t.id) === group;
    });

    if (groupTeams.length !== 4) continue;

    // Index mapping for schedule
    const t0 = groupTeams[0];
    const t1 = groupTeams[1];
    const t2 = groupTeams[2];
    const t3 = groupTeams[3];

    // Determine match days based on group letter:
    // A-D play on Day 1, Day 4, Day 7
    // E-H play on Day 2, Day 5, Day 8
    const isEarlyGroup = ['A', 'B', 'C', 'D'].includes(group);
    const day1 = isEarlyGroup ? 1 : 2;
    const day2 = isEarlyGroup ? 4 : 5;
    const day3 = isEarlyGroup ? 7 : 8;

    const date1 = GAME_CALENDAR.find(c => c.day === day1)?.date || '';
    const date2 = GAME_CALENDAR.find(c => c.day === day2)?.date || '';
    const date3 = GAME_CALENDAR.find(c => c.day === day3)?.date || '';

    const stage: MatchStage = `Gruppe ${group}`;

    // Round 1
    matches.push(createMatchPlaceholder(t0.id, t1.id, stage, date1, day1));
    matches.push(createMatchPlaceholder(t2.id, t3.id, stage, date1, day1));

    // Round 2
    matches.push(createMatchPlaceholder(t0.id, t2.id, stage, date2, day2));
    matches.push(createMatchPlaceholder(t1.id, t3.id, stage, date2, day2));

    // Round 3
    matches.push(createMatchPlaceholder(t0.id, t3.id, stage, date3, day3));
    matches.push(createMatchPlaceholder(t1.id, t2.id, stage, date3, day3));
  }

  return matches;
}

function createMatchPlaceholder(homeId: string, awayId: string, stage: MatchStage, date: string, dayIndex: number): Match {
  return {
    id: Math.random().toString(36).substring(2, 9),
    homeTeamId: homeId,
    awayTeamId: awayId,
    homeScore: null,
    awayScore: null,
    played: false,
    stage,
    events: [],
    date,
    dayIndex
  };
}

// Map team code to group (consistent helper)
export function getGroupForTeam(teamId: string): string {
  const mapping: { [id: string]: string } = {
    GER: 'A', FRA: 'A', SEN: 'A', CRC: 'A',
    ARG: 'B', BRA: 'B', DEN: 'B', ECU: 'B',
    ENG: 'C', ESP: 'C', MEX: 'C', GHA: 'C',
    ITA: 'D', POR: 'D', POL: 'D', IRN: 'D',
    NED: 'E', BEL: 'E', KOR: 'E', KSA: 'E',
    CRO: 'F', MAR: 'F', AUS: 'F', SRB: 'F',
    JPN: 'G', USA: 'G', CMR: 'G', TUN: 'G',
    URU: 'H', SUI: 'H', CAN: 'H', WAL: 'H'
  };
  return mapping[teamId] || 'A';
}

// Calculate table standings for a single group
export function calculateGroupStandings(groupName: string, matches: Match[], teams: Team[]): GroupStanding[] {
  const groupTeams = teams.filter(t => getGroupForTeam(t.id) === groupName);
  const groupMatches = matches.filter(m => m.stage === `Gruppe ${groupName}`);

  const standings: { [id: string]: GroupStanding } = {};

  // Initialize
  for (const team of groupTeams) {
    standings[team.id] = {
      teamId: team.id,
      teamName: team.name,
      flag: team.flag,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      points: 0
    };
  }

  // Aggregate matches
  for (const match of groupMatches) {
    if (!match.played || match.homeScore === null || match.awayScore === null) continue;

    const home = standings[match.homeTeamId];
    const away = standings[match.awayTeamId];

    if (!home || !away) continue;

    home.played++;
    away.played++;

    home.goalsFor += match.homeScore;
    home.goalsAgainst += match.awayScore;
    away.goalsFor += match.awayScore;
    away.goalsAgainst += match.homeScore;

    if (match.homeScore > match.awayScore) {
      home.wins++;
      home.points += 3;
      away.losses++;
    } else if (match.homeScore < match.awayScore) {
      away.wins++;
      away.points += 3;
      home.losses++;
    } else {
      home.draws++;
      home.points += 1;
      away.draws++;
      away.points += 1;
    }
  }

  // Sort standings: Points -> Goal Difference -> Goals For -> Alphabetical (Fallback)
  return Object.values(standings).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    
    const diffA = a.goalsFor - a.goalsAgainst;
    const diffB = b.goalsFor - b.goalsAgainst;
    if (diffB !== diffA) return diffB - diffA;

    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;

    return a.teamName.localeCompare(b.teamName);
  });
}

// Generate the Round of 16 (Achtelfinale) scheduled on Day 10
export function generateRoundOf16(allMatches: Match[], teams: Team[]): Match[] {
  const matches: Match[] = [];
  const date = GAME_CALENDAR.find(c => c.day === 10)?.date || '';
  const dayIndex = 10;

  // Calculate standings for all groups A-H
  const standings: { [group: string]: GroupStanding[] } = {};
  for (const group of GROUPS) {
    standings[group] = calculateGroupStandings(group, allMatches, teams);
  }

  // Round of 16 matchups:
  // Match 1: AF1: 1A vs 2B
  // Match 2: AF2: 1B vs 2A
  // Match 3: AF3: 1C vs 2D
  // Match 4: AF4: 1D vs 2C
  // Match 5: AF5: 1E vs 2F
  // Match 6: AF6: 1F vs 2E
  // Match 7: AF7: 1G vs 2H
  // Match 8: AF8: 1H vs 2G

  const matchups = [
    { g1: 'A', idx1: 0, g2: 'B', idx2: 1 }, // 1A vs 2B
    { g1: 'B', idx1: 0, g2: 'A', idx2: 1 }, // 1B vs 2A
    { g1: 'C', idx1: 0, g2: 'D', idx2: 1 }, // 1C vs 2D
    { g1: 'D', idx1: 0, g2: 'C', idx2: 1 }, // 1D vs 2C
    { g1: 'E', idx1: 0, g2: 'F', idx2: 1 }, // 1E vs 2F
    { g1: 'F', idx1: 0, g2: 'E', idx2: 1 }, // 1F vs 2E
    { g1: 'G', idx1: 0, g2: 'H', idx2: 1 }, // 1G vs 2H
    { g1: 'H', idx1: 0, g2: 'G', idx2: 1 }  // 1H vs 2G
  ];

  for (const match of matchups) {
    const home = standings[match.g1]?.[match.idx1];
    const away = standings[match.g2]?.[match.idx2];

    if (home && away) {
      matches.push(createMatchPlaceholder(home.teamId, away.teamId, 'Achtelfinale', date, dayIndex));
    }
  }

  return matches;
}

// Generate the Quarterfinals (Viertelfinale) scheduled on Day 12
export function generateQuarterfinals(previousRound: Match[]): Match[] {
  const matches: Match[] = [];
  const date = GAME_CALENDAR.find(c => c.day === 12)?.date || '';
  const dayIndex = 12;

  // We have 8 matches in Round of 16. Get their winners.
  const winners: string[] = getWinners(previousRound);
  if (winners.length !== 8) return [];

  // Matchups:
  // VF1: Winner AF1 (idx 0) vs Winner AF3 (idx 2)
  // VF2: Winner AF2 (idx 1) vs Winner AF4 (idx 3)
  // VF3: Winner AF5 (idx 4) vs Winner AF7 (idx 6)
  // VF4: Winner AF6 (idx 5) vs Winner AF8 (idx 7)
  matches.push(createMatchPlaceholder(winners[0], winners[2], 'Viertelfinale', date, dayIndex));
  matches.push(createMatchPlaceholder(winners[1], winners[3], 'Viertelfinale', date, dayIndex));
  matches.push(createMatchPlaceholder(winners[4], winners[6], 'Viertelfinale', date, dayIndex));
  matches.push(createMatchPlaceholder(winners[5], winners[7], 'Viertelfinale', date, dayIndex));

  return matches;
}

// Generate Semifinals (Halbfinale) scheduled on Day 14
export function generateSemifinals(previousRound: Match[]): Match[] {
  const matches: Match[] = [];
  const date = GAME_CALENDAR.find(c => c.day === 14)?.date || '';
  const dayIndex = 14;

  const winners = getWinners(previousRound);
  if (winners.length !== 4) return [];

  // Matchups:
  // HF1: Winner VF1 (idx 0) vs Winner VF3 (idx 2)
  // HF2: Winner VF2 (idx 1) vs Winner VF4 (idx 3)
  matches.push(createMatchPlaceholder(winners[0], winners[2], 'Halbfinale', date, dayIndex));
  matches.push(createMatchPlaceholder(winners[1], winners[3], 'Halbfinale', date, dayIndex));

  return matches;
}

// Generate Finals (Finals + Third Place) scheduled on Day 16
export function generateFinals(previousRound: Match[]): Match[] {
  const matches: Match[] = [];
  const date = GAME_CALENDAR.find(c => c.day === 16)?.date || '';
  const dayIndex = 16;

  const winners = getWinners(previousRound);
  const losers = getLosers(previousRound);

  if (winners.length !== 2 || losers.length !== 2) return [];

  // Match 1: Spiel um Platz 3 (Loser HF1 vs Loser HF2)
  matches.push(createMatchPlaceholder(losers[0], losers[1], 'Spiel um Platz 3', date, dayIndex));

  // Match 2: Finale (Winner HF1 vs Winner HF2)
  matches.push(createMatchPlaceholder(winners[0], winners[1], 'Finale', date, dayIndex));

  return matches;
}

// Helper to extract winner IDs from matches
export function getWinners(matches: Match[]): string[] {
  return matches.map(m => {
    if (m.homeScore === null || m.awayScore === null) return '';
    return m.homeScore > m.awayScore ? m.homeTeamId : m.awayTeamId;
  }).filter(id => id !== '');
}

// Helper to extract loser IDs from matches
export function getLosers(matches: Match[]): string[] {
  return matches.map(m => {
    if (m.homeScore === null || m.awayScore === null) return '';
    return m.homeScore < m.awayScore ? m.homeTeamId : m.awayTeamId;
  }).filter(id => id !== '');
}
