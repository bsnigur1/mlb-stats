'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Player, Game, GamePlayer, AtBat } from '@/lib/types';
import { calculateStats, formatAvg, formatPercent } from '@/lib/stats';

export default function RecapPage() {
  const params = useParams();
  const gameId = params.id as string;

  const [game, setGame] = useState<Game | null>(null);
  const [gamePlayers, setGamePlayers] = useState<(GamePlayer & { player: Player })[]>([]);
  const [atBats, setAtBats] = useState<AtBat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadGame() {
      const { data: gameData } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single();

      setGame(gameData);

      const { data: gamePlayersData } = await supabase
        .from('game_players')
        .select('*, player:players(*)')
        .eq('game_id', gameId)
        .order('batting_order');

      setGamePlayers(gamePlayersData || []);

      const { data: atBatsData } = await supabase
        .from('at_bats')
        .select('*')
        .eq('game_id', gameId)
        .order('created_at');

      setAtBats(atBatsData || []);
      setLoading(false);
    }

    loadGame();
  }, [gameId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-zinc-500">Loading recap...</div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="text-center py-20">
        <p className="text-zinc-500">Game not found</p>
        <Link href="/" className="text-blue-500 hover:underline">
          Go home
        </Link>
      </div>
    );
  }

  const playerStats = gamePlayers.map((gp) =>
    calculateStats(gp.player_id, gp.player.name, atBats)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Game Recap</h1>
          <p className="text-zinc-500">{game.date}</p>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-sm font-medium ${
            game.status === 'completed'
              ? 'bg-green-500/20 text-green-400'
              : 'bg-yellow-500/20 text-yellow-400'
          }`}
        >
          {game.status === 'completed' ? 'Final' : 'In Progress'}
        </span>
      </div>

      <div className="bg-zinc-800 rounded-lg p-4">
        <div className="flex justify-around text-center">
          <div>
            <div className="text-sm text-zinc-500">Innings</div>
            <div className="text-2xl font-bold">{game.current_inning}</div>
          </div>
          <div>
            <div className="text-sm text-zinc-500">Total ABs</div>
            <div className="text-2xl font-bold">{atBats.length}</div>
          </div>
          <div>
            <div className="text-sm text-zinc-500">Total Hits</div>
            <div className="text-2xl font-bold">
              {playerStats.reduce((sum, p) => sum + p.hits, 0)}
            </div>
          </div>
        </div>
      </div>

      {/* Player Stats */}
      {playerStats.map((stats) => (
        <div key={stats.player_id} className="bg-zinc-800/50 rounded-lg p-4">
          <h3 className="text-xl font-bold mb-4">{stats.player_name}</h3>

          <div className="grid grid-cols-4 gap-4 text-center mb-4">
            <div>
              <div className="text-2xl font-bold">{stats.hits}-{stats.at_bats}</div>
              <div className="text-xs text-zinc-500">H-AB</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.rbi}</div>
              <div className="text-xs text-zinc-500">RBI</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{formatAvg(stats.avg)}</div>
              <div className="text-xs text-zinc-500">AVG</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{formatAvg(stats.ops)}</div>
              <div className="text-xs text-zinc-500">OPS</div>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-2 text-center text-sm">
            <div className="bg-zinc-700/50 rounded p-2">
              <div className="font-semibold">{stats.singles}</div>
              <div className="text-xs text-zinc-500">1B</div>
            </div>
            <div className="bg-zinc-700/50 rounded p-2">
              <div className="font-semibold">{stats.doubles}</div>
              <div className="text-xs text-zinc-500">2B</div>
            </div>
            <div className="bg-zinc-700/50 rounded p-2">
              <div className="font-semibold">{stats.triples}</div>
              <div className="text-xs text-zinc-500">3B</div>
            </div>
            <div className="bg-zinc-700/50 rounded p-2">
              <div className="font-semibold">{stats.homeruns}</div>
              <div className="text-xs text-zinc-500">HR</div>
            </div>
            <div className="bg-zinc-700/50 rounded p-2">
              <div className="font-semibold">{stats.strikeouts}</div>
              <div className="text-xs text-zinc-500">K</div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
            <div className="text-zinc-400">
              OBP: <span className="text-white">{formatAvg(stats.obp)}</span>
            </div>
            <div className="text-zinc-400">
              SLG: <span className="text-white">{formatAvg(stats.slg)}</span>
            </div>
            <div className="text-zinc-400">
              K%: <span className="text-white">{formatPercent(stats.k_percent)}</span>
            </div>
          </div>
        </div>
      ))}

      <div className="flex gap-3">
        <Link
          href="/"
          className="flex-1 py-3 bg-zinc-700 hover:bg-zinc-600 rounded-lg font-semibold text-center"
        >
          New Game
        </Link>
        <Link
          href="/stats"
          className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold text-center"
        >
          Career Stats
        </Link>
      </div>
    </div>
  );
}
