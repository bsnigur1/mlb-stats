'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Game, GamePlayer, Player } from '@/lib/types';

interface GameWithPlayers extends Game {
  game_players: (GamePlayer & { player: Player })[];
}

export default function HistoryPage() {
  const [games, setGames] = useState<GameWithPlayers[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadGames() {
      const { data: gamesData } = await supabase
        .from('games')
        .select(`
          *,
          game_players (
            *,
            player:players (*)
          )
        `)
        .order('created_at', { ascending: false });

      setGames(gamesData || []);
      setLoading(false);
    }

    loadGames();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-zinc-500">Loading history...</div>
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div className="text-center py-20">
        <h1 className="text-2xl font-bold mb-2">Game History</h1>
        <p className="text-zinc-500">No games played yet.</p>
        <Link href="/" className="text-blue-500 hover:underline mt-4 inline-block">
          Start your first game
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Game History</h1>

      <div className="space-y-3">
        {games.map((game) => {
          const playerNames = game.game_players
            .map((gp) => gp.player.name)
            .join(' vs ');

          return (
            <Link
              key={game.id}
              href={game.status === 'in_progress' ? `/game/${game.id}` : `/recap/${game.id}`}
              className="block bg-zinc-800 hover:bg-zinc-700 rounded-lg p-4 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">{playerNames}</div>
                  <div className="text-sm text-zinc-500">{game.date}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      game.status === 'completed'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-yellow-500/20 text-yellow-400'
                    }`}
                  >
                    {game.status === 'completed' ? 'Final' : 'In Progress'}
                  </span>
                  <span className="text-zinc-500">→</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
