// The Yard — Type Definitions

export type AtBatResult =
  | 'out'
  | 'double_play'
  | 'strikeout'
  | 'walk'
  | 'single'
  | 'double'
  | 'triple'
  | 'homerun'
  | 'error';

export type HeatStatus = 'hot' | 'cold' | 'neutral';
export type GameResult = 'W' | 'L';
export type GameMode = '2v2' | '3v3' | '1v1';
export type AwardType = 'MVP_GAME' | 'MVP_SESSION' | 'MVP_WEEK' | 'SEASON_HIGH' | 'HOT_STREAK';

export interface Season {
  id: string;
  year: number;
  name: string;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  is_locked: boolean;
  created_at: string;
}

export interface HotStreak {
  type: 'hr' | 'avg' | 'rbi' | 'hitting_streak' | 'multi_hit';
  value: string;
  label: string;
  timeframe: string;
}

export interface Player {
  id: string;
  name: string;
  handle: string | null;
  heat: HeatStatus;
  streak: number;
  streak_type: 'W' | 'L';
  created_at: string;
}

export interface Session {
  id: string;
  date: string;
  label: string | null;
  mvp_player_id: string | null;
  last_activity: string;
  is_active: boolean;
  created_at: string;
  // Relations
  games?: Game[];
  mvp_player?: Player;
}

export interface Game {
  id: string;
  session_id: string | null;
  season_id: string | null;
  date: string;
  status: 'in_progress' | 'completed';
  current_inning: number;
  current_outs: number;
  opponent: string | null;
  score: string | null;
  innings: number;
  game_mode: GameMode;
  // For 1v1 games - which players faced off
  h2h_player1_id: string | null;
  h2h_player2_id: string | null;
  h2h_winner_id: string | null;
  h2h_difficulty: string | null;
  mvp_player_id: string | null;
  // Pitching tracking
  track_pitching: boolean;
  batting_first: boolean;
  current_pitcher_id: string | null;
  created_at: string;
  // Relations
  game_players?: GamePlayer[];
  at_bats?: AtBat[];
  mvp_player?: Player;
}

export interface GamePlayer {
  id: string;
  game_id: string;
  player_id: string;
  batting_order: number;
  player?: Player;
}

export interface AtBat {
  id: string;
  game_id: string;
  player_id: string;
  pitcher_id: string | null;
  inning: number;
  result: AtBatResult;
  rbi: number;
  // Pitching stats (optional - legacy fields)
  innings_pitched: number;
  hits_allowed: number;
  runs_allowed: number;
  earned_runs: number;
  walks_allowed: number;
  strikeouts_pitched: number;
  created_at: string;
  player?: Player;
}

// Baserunner tracking for ERA calculation
export interface Baserunner {
  base: 1 | 2 | 3;
  pitcher_id: string; // Who put them on base (for ERA)
}

export interface Award {
  id: string;
  player_id: string;
  type: AwardType;
  label: string | null;
  session_id: string | null;
  game_id: string | null;
  date: string;
  created_at: string;
  player?: Player;
}

// Computed stats interfaces
export interface BattingStats {
  games: number;
  plate_appearances: number;
  at_bats: number;
  hits: number;
  singles: number;
  doubles: number;
  triples: number;
  homeruns: number;
  walks: number;
  strikeouts: number;
  errors: number;
  rbi: number;
  avg: number;
  obp: number;
  slg: number;
  ops: number;
  k_percent: number;
  ab_per_hr: number | null;
  rbi_per_ab: number;
}

export interface PitchingStats {
  games: number;
  wins: number;
  losses: number;
  innings_pitched: number;
  hits_allowed: number;
  runs_allowed: number;
  earned_runs: number;
  walks: number;
  strikeouts: number;
  era: number;
  whip: number;
}

export interface PlayerStats {
  player_id: string;
  player_name: string;
  player_handle: string | null;
  heat: HeatStatus;
  streak: number;
  streak_type: 'W' | 'L';
  batting: BattingStats;
  pitching: PitchingStats;
}

// Legacy game stats (for live game tracking)
export interface GamePlayerStats {
  player_id: string;
  player_name: string;
  games: number;
  plate_appearances: number;
  at_bats: number;
  hits: number;
  singles: number;
  doubles: number;
  triples: number;
  homeruns: number;
  walks: number;
  strikeouts: number;
  errors: number;
  rbi: number;
  avg: number;
  slg: number;
  obp: number;
  ops: number;
  k_percent: number;
  ab_per_hr: number | null;
  rbi_per_ab: number;
}

// Session with computed data
export interface SessionWithGames extends Session {
  games: (Game & {
    game_players: (GamePlayer & { player: Player })[];
    at_bats: AtBat[];
  })[];
}
