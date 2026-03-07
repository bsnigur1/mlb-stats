export type AtBatResult =
  | 'out'
  | 'strikeout'
  | 'walk'
  | 'single'
  | 'double'
  | 'triple'
  | 'homerun'
  | 'error';

export interface Player {
  id: string;
  name: string;
  created_at: string;
}

export interface Game {
  id: string;
  date: string;
  status: 'in_progress' | 'completed';
  current_inning: number;
  current_outs: number;
  created_at: string;
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
  inning: number;
  result: AtBatResult;
  rbi: number;
  created_at: string;
  player?: Player;
}

export interface PlayerStats {
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

export interface GameWithPlayers extends Game {
  game_players: (GamePlayer & { player: Player })[];
  at_bats: AtBat[];
}
