export type PlayerPosition = 'TW' | 'ABW' | 'MF' | 'ANG';

export interface PlayerSkills {
  shooting: number;
  passing: number;
  defending: number;
  physical: number;
  goalkeeping: number;
}

export interface Player {
  id: string;
  name: string;
  nationality: string;
  age: number;
  position: PlayerPosition;
  overall: number; // 30 - 99
  fitness: number; // 0 - 100
  form: number; // 0 - 100
  morale: number; // 0 - 100
  skills: PlayerSkills;
  value: number; // in EUR
  salary: number; // in EUR / week
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  injuryWeeks: number; // 0 = fit
  contractYears: number;
}

export type PlayStyle = 'defensiv' | 'konter' | 'ausgeglichen' | 'ballbesitz' | 'offensiv' | 'brechstange';
export type PassStyle = 'kurz' | 'lang' | 'gemischt';

export interface TeamTactics {
  formation: '4-4-2' | '4-3-3' | '3-5-2' | '4-2-3-1' | '5-3-2';
  style: PlayStyle;
  passing: PassStyle;
  aggression: number; // 1 - 5 (sehr zahm bis sehr aggressiv)
}

export interface Team {
  id: string;
  name: string;
  flag: string; // Emoji
  players: Player[];
  lineup: string[]; // Player IDs (should contain exactly 11 IDs)
  captainId: string;
  penaltyTakerId: string;
  budget: number; // in EUR
  tactics: TeamTactics;
  isUser: boolean;
}

export type MatchStage = 
  | 'Gruppe A' | 'Gruppe B' | 'Gruppe C' | 'Gruppe D'
  | 'Gruppe E' | 'Gruppe F' | 'Gruppe G' | 'Gruppe H'
  | 'Achtelfinale' | 'Viertelfinale' | 'Halbfinale' | 'Spiel um Platz 3' | 'Finale'
  | 'Freundschaftsspiel';

export interface MatchEvent {
  minute: number;
  type: 'goal' | 'yellow' | 'red' | 'injury' | 'text';
  teamId?: string;
  playerName?: string;
  description: string;
}

export interface Match {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
  played: boolean;
  stage: MatchStage;
  events: MatchEvent[];
  date: string;
  dayIndex: number;
}

export interface GroupStanding {
  teamId: string;
  teamName: string;
  flag: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export interface NewsItem {
  id: string;
  date: string;
  title: string;
  content: string;
  type: 'transfer' | 'injury' | 'match' | 'tournament' | 'system';
}

export interface GameState {
  currentDayIndex: number; // Index in the game calendar
  currentDate: string;
  userTeamId: string;
  teams: Team[];
  matches: Match[];
  news: NewsItem[];
  stage: 'group_stage' | 'round_of_16' | 'quarterfinals' | 'semifinals' | 'final' | 'finished';
  history: {
    winnerId?: string;
    secondId?: string;
    thirdId?: string;
  };
}
