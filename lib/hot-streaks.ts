import { AtBat, Game, HotStreak, Session } from './types';
import { calculateStats, formatAvg } from './stats';

// Thresholds for "hot" status
const THRESHOLDS = {
  HR_RECENT_GAMES: 2, // 2+ HRs in last N games
  AVG_HOT: 0.4, // .400+ in window
  RBI_RECENT_GAMES: 4, // 4+ RBIs in recent games
  RBI_SESSION: 3, // 3+ RBIs in last session
  HITTING_STREAK: 3, // 3+ consecutive games with a hit
};

interface GameWithAtBats extends Game {
  at_bats: AtBat[];
}

// Calculate hot streaks for a player
export function calculateHotStreaks(
  playerId: string,
  recentGames: GameWithAtBats[],
  lastSession: Session | null,
  lastSessionGames: GameWithAtBats[]
): HotStreak[] {
  const streaks: HotStreak[] = [];

  // === RECENT GAMES (last 2-3) ===
  if (recentGames.length > 0) {
    const recentAtBats = recentGames.flatMap((g) =>
      g.at_bats.filter((ab) => ab.player_id === playerId)
    );

    if (recentAtBats.length > 0) {
      const stats = calculateStats(playerId, '', recentAtBats, recentGames.length);
      const gameCount = recentGames.length;

      // HRs in recent games
      if (stats.homeruns >= THRESHOLDS.HR_RECENT_GAMES) {
        streaks.push({
          type: 'hr',
          label: `${stats.homeruns} HRs`,
          value: String(stats.homeruns),
          timeframe: `last ${gameCount} game${gameCount > 1 ? 's' : ''}`,
        });
      }

      // RBIs in recent games
      if (stats.rbi >= THRESHOLDS.RBI_RECENT_GAMES) {
        streaks.push({
          type: 'rbi',
          label: `${stats.rbi} RBIs`,
          value: String(stats.rbi),
          timeframe: `last ${gameCount} game${gameCount > 1 ? 's' : ''}`,
        });
      }

      // AVG in recent games
      if (stats.avg >= THRESHOLDS.AVG_HOT && stats.at_bats >= 5) {
        streaks.push({
          type: 'avg',
          label: `${formatAvg(stats.avg)} AVG`,
          value: String(stats.avg),
          timeframe: `last ${gameCount} game${gameCount > 1 ? 's' : ''}`,
        });
      }
    }
  }

  // === LAST SESSION ===
  if (lastSession && lastSessionGames.length > 0) {
    const sessionAtBats = lastSessionGames.flatMap((g) =>
      g.at_bats.filter((ab) => ab.player_id === playerId)
    );

    if (sessionAtBats.length > 0) {
      const sessionStats = calculateStats(
        playerId,
        '',
        sessionAtBats,
        lastSessionGames.length
      );

      // HRs last session
      if (sessionStats.homeruns >= THRESHOLDS.HR_RECENT_GAMES) {
        // Avoid duplicate if already shown in recent games
        const existingHr = streaks.find((s) => s.type === 'hr');
        if (!existingHr || existingHr.value !== String(sessionStats.homeruns)) {
          streaks.push({
            type: 'hr',
            label: `${sessionStats.homeruns} HRs`,
            value: String(sessionStats.homeruns),
            timeframe: 'last session',
          });
        }
      }

      // RBIs last session
      if (sessionStats.rbi >= THRESHOLDS.RBI_SESSION) {
        const existingRbi = streaks.find((s) => s.type === 'rbi');
        if (!existingRbi || existingRbi.value !== String(sessionStats.rbi)) {
          streaks.push({
            type: 'rbi',
            label: `${sessionStats.rbi} RBIs`,
            value: String(sessionStats.rbi),
            timeframe: 'last session',
          });
        }
      }

      // AVG last session
      if (sessionStats.avg >= THRESHOLDS.AVG_HOT && sessionStats.at_bats >= 5) {
        const existingAvg = streaks.find((s) => s.type === 'avg');
        if (!existingAvg) {
          streaks.push({
            type: 'avg',
            label: `${formatAvg(sessionStats.avg)} AVG`,
            value: String(sessionStats.avg),
            timeframe: 'last session',
          });
        }
      }

      // Multi-hit game
      if (sessionStats.hits >= 3 && lastSessionGames.length === 1) {
        streaks.push({
          type: 'multi_hit',
          label: `${sessionStats.hits}-for-${sessionStats.at_bats}`,
          value: `${sessionStats.hits}-${sessionStats.at_bats}`,
          timeframe: 'last game',
        });
      }
    }
  }

  // === HITTING STREAK ===
  const hittingStreak = calculateHittingStreak(playerId, recentGames);
  if (hittingStreak >= THRESHOLDS.HITTING_STREAK) {
    streaks.push({
      type: 'hitting_streak',
      label: `${hittingStreak}-game hit streak`,
      value: String(hittingStreak),
      timeframe: '',
    });
  }

  // Return top 2 most impressive streaks
  return streaks.slice(0, 2);
}

// Calculate consecutive games with at least one hit
function calculateHittingStreak(
  playerId: string,
  games: GameWithAtBats[]
): number {
  let streak = 0;

  // Games should be sorted newest first
  for (const game of games) {
    const playerAtBats = game.at_bats.filter((ab) => ab.player_id === playerId);
    const hits = playerAtBats.filter((ab) =>
      ['single', 'double', 'triple', 'homerun'].includes(ab.result)
    ).length;

    if (hits > 0) {
      streak++;
    } else if (playerAtBats.length > 0) {
      // Had at-bats but no hits - streak ends
      break;
    }
    // If no at-bats in game, skip (didn't play)
  }

  return streak;
}

// Format a hot streak for display
export function formatHotStreak(streak: HotStreak): string {
  if (streak.timeframe) {
    return `${streak.label} ${streak.timeframe}`;
  }
  return streak.label;
}

// Check if player has any hot streaks
export function hasHotStreaks(streaks: HotStreak[]): boolean {
  return streaks.length > 0;
}
