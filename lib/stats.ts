import { AtBat, GamePlayerStats, Game, Season } from './types';

export function calculateStats(
  playerId: string,
  playerName: string,
  atBats: AtBat[],
  gamesPlayed: number = 1
): GamePlayerStats {
  const playerAtBats = atBats.filter((ab) => ab.player_id === playerId);

  const singles = playerAtBats.filter((ab) => ab.result === 'single').length;
  const doubles = playerAtBats.filter((ab) => ab.result === 'double').length;
  const triples = playerAtBats.filter((ab) => ab.result === 'triple').length;
  const homeruns = playerAtBats.filter((ab) => ab.result === 'homerun').length;
  const walks = playerAtBats.filter((ab) => ab.result === 'walk').length;
  const strikeouts = playerAtBats.filter((ab) => ab.result === 'strikeout').length;
  const errors = playerAtBats.filter((ab) => ab.result === 'error').length;
  const outs = playerAtBats.filter((ab) => ab.result === 'out' || ab.result === 'double_play').length;

  const hits = singles + doubles + triples + homeruns;

  // ROE and walks don't count as at-bats
  const ab = singles + doubles + triples + homeruns + strikeouts + outs;

  // Plate appearances include everything
  const pa = ab + walks + errors;

  const rbi = playerAtBats.reduce((sum, ab) => sum + ab.rbi, 0);

  // Calculate rates
  const avg = ab > 0 ? hits / ab : 0;
  const slg = ab > 0 ? (singles + 2 * doubles + 3 * triples + 4 * homeruns) / ab : 0;
  const obp = ab + walks > 0 ? (hits + walks) / (ab + walks) : 0;
  const ops = obp + slg;
  const k_percent = pa > 0 ? strikeouts / pa : 0;
  const ab_per_hr = homeruns > 0 ? ab / homeruns : null;
  const rbi_per_ab = ab > 0 ? rbi / ab : 0;

  return {
    player_id: playerId,
    player_name: playerName,
    games: gamesPlayed,
    plate_appearances: pa,
    at_bats: ab,
    hits,
    singles,
    doubles,
    triples,
    homeruns,
    walks,
    strikeouts,
    errors,
    rbi,
    avg,
    slg,
    obp,
    ops,
    k_percent,
    ab_per_hr,
    rbi_per_ab,
  };
}

export function formatAvg(avg: number): string {
  return avg.toFixed(3).replace(/^0/, '');
}

export function formatPercent(pct: number): string {
  return (pct * 100).toFixed(1) + '%';
}

export function formatRatio(ratio: number | null): string {
  if (ratio === null) return '-';
  return ratio.toFixed(1);
}

// Season-based filtering
export function filterAtBatsBySeason(
  atBats: AtBat[],
  games: Game[],
  seasonId: string
): AtBat[] {
  const gameIdsInSeason = new Set(
    games.filter(g => g.season_id === seasonId).map(g => g.id)
  );
  return atBats.filter(ab => gameIdsInSeason.has(ab.game_id));
}

export function countGamesInSeason(games: Game[], seasonId: string): number {
  return games.filter(g => g.season_id === seasonId && g.status === 'completed').length;
}

export function isSeasonLocked(season: Season): boolean {
  return season.is_locked;
}

export function getActiveSeason(seasons: Season[]): Season | undefined {
  return seasons.find(s => s.is_active);
}
