'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Player, AtBat } from '@/lib/types';
import { calculateStats, formatAvg, formatPercent, formatRatio } from '@/lib/stats';

export default function StatsPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [atBats, setAtBats] = useState<AtBat[]>([]);
  const [gamesPerPlayer, setGamesPerPlayer] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      const { data: playersData } = await supabase
        .from('players')
        .select('*');

      setPlayers(playersData || []);

      const { data: atBatsData } = await supabase
        .from('at_bats')
        .select('*');

      setAtBats(atBatsData || []);

      // Count games per player
      const { data: gamePlayersData } = await supabase
        .from('game_players')
        .select('player_id, game_id');

      const counts: Record<string, Set<string>> = {};
      gamePlayersData?.forEach((gp) => {
        if (!counts[gp.player_id]) counts[gp.player_id] = new Set();
        counts[gp.player_id].add(gp.game_id);
      });

      const gamesCount: Record<string, number> = {};
      Object.entries(counts).forEach(([playerId, gameSet]) => {
        gamesCount[playerId] = gameSet.size;
      });

      setGamesPerPlayer(gamesCount);
      setLoading(false);
    }

    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-zinc-500">Loading stats...</div>
      </div>
    );
  }

  const playerStats = players.map((player) =>
    calculateStats(
      player.id,
      player.name,
      atBats,
      gamesPerPlayer[player.id] || 0
    )
  );

  // Sort by OPS descending
  playerStats.sort((a, b) => b.ops - a.ops);

  if (playerStats.every((p) => p.plate_appearances === 0)) {
    return (
      <div className="text-center py-20">
        <h1 className="text-2xl font-bold mb-2">Career Stats</h1>
        <p className="text-zinc-500">No games played yet. Start a game to see stats.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Career Stats</h1>

      {playerStats.map((stats) => (
        <div key={stats.player_id} className="bg-zinc-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">{stats.player_name}</h2>
            <span className="text-sm text-zinc-500">{stats.games} games</span>
          </div>

          {/* Primary Stats */}
          <div className="grid grid-cols-4 gap-3 text-center mb-4">
            <div className="bg-zinc-700/50 rounded-lg p-3">
              <div className="text-2xl font-bold">{formatAvg(stats.avg)}</div>
              <div className="text-xs text-zinc-500">AVG</div>
            </div>
            <div className="bg-zinc-700/50 rounded-lg p-3">
              <div className="text-2xl font-bold">{formatAvg(stats.obp)}</div>
              <div className="text-xs text-zinc-500">OBP</div>
            </div>
            <div className="bg-zinc-700/50 rounded-lg p-3">
              <div className="text-2xl font-bold">{formatAvg(stats.slg)}</div>
              <div className="text-xs text-zinc-500">SLG</div>
            </div>
            <div className="bg-zinc-700/50 rounded-lg p-3">
              <div className="text-2xl font-bold">{formatAvg(stats.ops)}</div>
              <div className="text-xs text-zinc-500">OPS</div>
            </div>
          </div>

          {/* Counting Stats */}
          <div className="grid grid-cols-5 gap-2 text-center text-sm mb-4">
            <div>
              <div className="font-semibold text-lg">{stats.at_bats}</div>
              <div className="text-xs text-zinc-500">AB</div>
            </div>
            <div>
              <div className="font-semibold text-lg">{stats.hits}</div>
              <div className="text-xs text-zinc-500">H</div>
            </div>
            <div>
              <div className="font-semibold text-lg">{stats.homeruns}</div>
              <div className="text-xs text-zinc-500">HR</div>
            </div>
            <div>
              <div className="font-semibold text-lg">{stats.rbi}</div>
              <div className="text-xs text-zinc-500">RBI</div>
            </div>
            <div>
              <div className="font-semibold text-lg">{stats.walks}</div>
              <div className="text-xs text-zinc-500">BB</div>
            </div>
          </div>

          {/* Hit Breakdown */}
          <div className="grid grid-cols-4 gap-2 text-center text-sm mb-4">
            <div className="bg-zinc-900/50 rounded p-2">
              <div className="font-medium">{stats.singles}</div>
              <div className="text-xs text-zinc-500">1B</div>
            </div>
            <div className="bg-zinc-900/50 rounded p-2">
              <div className="font-medium">{stats.doubles}</div>
              <div className="text-xs text-zinc-500">2B</div>
            </div>
            <div className="bg-zinc-900/50 rounded p-2">
              <div className="font-medium">{stats.triples}</div>
              <div className="text-xs text-zinc-500">3B</div>
            </div>
            <div className="bg-zinc-900/50 rounded p-2">
              <div className="font-medium">{stats.strikeouts}</div>
              <div className="text-xs text-zinc-500">K</div>
            </div>
          </div>

          {/* Advanced Stats */}
          <div className="grid grid-cols-3 gap-3 text-center text-sm border-t border-zinc-700 pt-4">
            <div>
              <div className="font-semibold">{formatPercent(stats.k_percent)}</div>
              <div className="text-xs text-zinc-500">K%</div>
            </div>
            <div>
              <div className="font-semibold">{formatRatio(stats.ab_per_hr)}</div>
              <div className="text-xs text-zinc-500">AB/HR</div>
            </div>
            <div>
              <div className="font-semibold">{formatAvg(stats.rbi_per_ab)}</div>
              <div className="text-xs text-zinc-500">RBI/AB</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
