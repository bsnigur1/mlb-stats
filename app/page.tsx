'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Player, Game } from '@/lib/types';

const PLAYERS = ['B', 'Greg', 'Andrew'];

export default function Home() {
  const router = useRouter();
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [activeGame, setActiveGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      // Fetch or create players
      const { data: existingPlayers } = await supabase
        .from('players')
        .select('*');

      if (!existingPlayers || existingPlayers.length === 0) {
        // Seed players
        const { data: newPlayers } = await supabase
          .from('players')
          .insert(PLAYERS.map((name) => ({ name })))
          .select();
        setPlayers(newPlayers || []);
      } else {
        setPlayers(existingPlayers);
      }

      // Check for active game
      const { data: games } = await supabase
        .from('games')
        .select('*')
        .eq('status', 'in_progress')
        .order('created_at', { ascending: false })
        .limit(1);

      if (games && games.length > 0) {
        setActiveGame(games[0]);
      }

      setLoading(false);
    }
    init();
  }, []);

  const togglePlayer = (playerName: string) => {
    setSelectedPlayers((prev) =>
      prev.includes(playerName)
        ? prev.filter((p) => p !== playerName)
        : [...prev, playerName]
    );
  };

  const startGame = async () => {
    if (selectedPlayers.length < 2) return;

    const selectedPlayerIds = players
      .filter((p) => selectedPlayers.includes(p.name))
      .map((p) => p.id);

    // Create new game
    const { data: game, error: gameError } = await supabase
      .from('games')
      .insert({
        date: new Date().toISOString().split('T')[0],
        status: 'in_progress',
        current_inning: 1,
        current_outs: 0,
      })
      .select()
      .single();

    if (gameError || !game) {
      console.error('Error creating game:', gameError);
      return;
    }

    // Add players to game
    const gamePlayers = selectedPlayerIds.map((playerId, index) => ({
      game_id: game.id,
      player_id: playerId,
      batting_order: index + 1,
    }));

    await supabase.from('game_players').insert(gamePlayers);

    router.push(`/game/${game.id}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-zinc-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {activeGame && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4">
          <p className="text-yellow-500 font-medium mb-2">Game in progress</p>
          <button
            onClick={() => router.push(`/game/${activeGame.id}`)}
            className="text-sm text-yellow-400 hover:text-yellow-300 underline"
          >
            Continue game from {activeGame.date}
          </button>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold mb-2">Start New Game</h1>
        <p className="text-zinc-500">Select who's playing today</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {PLAYERS.map((name) => {
          const isSelected = selectedPlayers.includes(name);
          return (
            <button
              key={name}
              onClick={() => togglePlayer(name)}
              className={`
                p-6 rounded-lg border-2 text-center transition-all
                ${
                  isSelected
                    ? 'border-blue-500 bg-blue-500/20 text-white'
                    : 'border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:border-zinc-600'
                }
              `}
            >
              <span className="text-xl font-semibold">{name}</span>
            </button>
          );
        })}
      </div>

      <button
        onClick={startGame}
        disabled={selectedPlayers.length < 2}
        className={`
          w-full py-4 rounded-lg font-semibold text-lg transition-all
          ${
            selectedPlayers.length >= 2
              ? 'bg-green-600 hover:bg-green-500 text-white'
              : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
          }
        `}
      >
        {selectedPlayers.length < 2
          ? 'Select at least 2 players'
          : `Start Game (${selectedPlayers.join(' vs ')})`}
      </button>
    </div>
  );
}
