'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { AtBatResult, Player, Game, GamePlayer, AtBat } from '@/lib/types';
import { calculateStats, formatAvg } from '@/lib/stats';
import Link from 'next/link';

const AT_BAT_BUTTONS: { result: AtBatResult; label: string; color: string }[] = [
  { result: 'out', label: 'Out', color: 'bg-zinc-600 hover:bg-zinc-500' },
  { result: 'strikeout', label: 'K', color: 'bg-red-700 hover:bg-red-600' },
  { result: 'walk', label: 'BB', color: 'bg-yellow-600 hover:bg-yellow-500' },
  { result: 'single', label: '1B', color: 'bg-green-600 hover:bg-green-500' },
  { result: 'double', label: '2B', color: 'bg-blue-600 hover:bg-blue-500' },
  { result: 'triple', label: '3B', color: 'bg-purple-600 hover:bg-purple-500' },
  { result: 'homerun', label: 'HR', color: 'bg-orange-600 hover:bg-orange-500' },
  { result: 'error', label: 'ROE', color: 'bg-zinc-500 hover:bg-zinc-400' },
];

export default function GamePage() {
  const router = useRouter();
  const params = useParams();
  const gameId = params.id as string;

  const [game, setGame] = useState<Game | null>(null);
  const [gamePlayers, setGamePlayers] = useState<(GamePlayer & { player: Player })[]>([]);
  const [atBats, setAtBats] = useState<AtBat[]>([]);
  const [currentBatterIndex, setCurrentBatterIndex] = useState(0);
  const [pendingResult, setPendingResult] = useState<AtBatResult | null>(null);
  const [rbiInput, setRbiInput] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadGame = useCallback(async () => {
    const { data: gameData } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single();

    if (!gameData) {
      router.push('/');
      return;
    }

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

    // Calculate current batter based on at-bats
    if (atBatsData && gamePlayersData) {
      const batterIndex = atBatsData.length % gamePlayersData.length;
      setCurrentBatterIndex(batterIndex);
    }

    setLoading(false);
  }, [gameId, router]);

  useEffect(() => {
    loadGame();
  }, [loadGame]);

  const recordAtBat = async () => {
    if (!pendingResult || !game) return;

    const currentPlayer = gamePlayers[currentBatterIndex];

    // Record the at-bat
    const { data: newAtBat } = await supabase
      .from('at_bats')
      .insert({
        game_id: gameId,
        player_id: currentPlayer.player_id,
        inning: game.current_inning,
        result: pendingResult,
        rbi: rbiInput,
      })
      .select()
      .single();

    if (newAtBat) {
      const updatedAtBats = [...atBats, newAtBat];
      setAtBats(updatedAtBats);

      // Check if this was an out
      const isOut = pendingResult === 'out' || pendingResult === 'strikeout';
      let newOuts = game.current_outs;
      let newInning = game.current_inning;

      if (isOut) {
        newOuts++;
        if (newOuts >= 3) {
          newOuts = 0;
          newInning++;
        }
      }

      // Update game state
      await supabase
        .from('games')
        .update({ current_outs: newOuts, current_inning: newInning })
        .eq('id', gameId);

      setGame({ ...game, current_outs: newOuts, current_inning: newInning });

      // Move to next batter
      setCurrentBatterIndex((prev) => (prev + 1) % gamePlayers.length);
    }

    // Reset input state
    setPendingResult(null);
    setRbiInput(0);
  };

  const undoLastAtBat = async () => {
    if (atBats.length === 0) return;

    const lastAtBat = atBats[atBats.length - 1];

    await supabase.from('at_bats').delete().eq('id', lastAtBat.id);

    // Recalculate game state
    const remainingAtBats = atBats.slice(0, -1);
    const outs = remainingAtBats.filter(
      (ab) => ab.result === 'out' || ab.result === 'strikeout'
    ).length;

    // Simple recalc - this could be more sophisticated
    const newInning = Math.floor(outs / 3) + 1;
    const newOuts = outs % 3;

    await supabase
      .from('games')
      .update({ current_outs: newOuts, current_inning: newInning })
      .eq('id', gameId);

    loadGame();
  };

  const endGame = async () => {
    await supabase.from('games').update({ status: 'completed' }).eq('id', gameId);
    router.push(`/recap/${gameId}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-zinc-500">Loading game...</div>
      </div>
    );
  }

  if (!game || gamePlayers.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-zinc-500">Game not found</p>
        <Link href="/" className="text-blue-500 hover:underline">
          Go home
        </Link>
      </div>
    );
  }

  const currentPlayer = gamePlayers[currentBatterIndex];
  const needsRbi =
    pendingResult &&
    ['single', 'double', 'triple', 'homerun', 'error'].includes(pendingResult);

  return (
    <div className="space-y-6">
      {/* Scoreboard */}
      <div className="flex items-center justify-between bg-zinc-800 rounded-lg p-4">
        <div className="text-center">
          <div className="text-sm text-zinc-500">Inning</div>
          <div className="text-3xl font-bold">{game.current_inning}</div>
        </div>
        <div className="text-center">
          <div className="text-sm text-zinc-500">Outs</div>
          <div className="flex gap-2 justify-center mt-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={`w-4 h-4 rounded-full ${
                  i < game.current_outs ? 'bg-red-500' : 'bg-zinc-600'
                }`}
              />
            ))}
          </div>
        </div>
        <div className="text-center">
          <div className="text-sm text-zinc-500">At Bats</div>
          <div className="text-3xl font-bold">{atBats.length}</div>
        </div>
      </div>

      {/* Current Batter */}
      <div className="text-center py-6 bg-zinc-800/50 rounded-lg">
        <div className="text-sm text-zinc-500 mb-1">Now Batting</div>
        <div className="text-4xl font-bold">{currentPlayer.player.name}</div>
        <div className="text-sm text-zinc-500 mt-2">
          {(() => {
            const stats = calculateStats(
              currentPlayer.player_id,
              currentPlayer.player.name,
              atBats
            );
            return `${stats.hits}-${stats.at_bats} (${formatAvg(stats.avg)})`;
          })()}
        </div>
      </div>

      {/* At-Bat Buttons or RBI Input */}
      {!pendingResult ? (
        <div className="grid grid-cols-4 gap-3">
          {AT_BAT_BUTTONS.map(({ result, label, color }) => (
            <button
              key={result}
              onClick={() => {
                if (['out', 'strikeout', 'walk'].includes(result)) {
                  // No RBI needed, record directly
                  setPendingResult(result);
                  setTimeout(() => {
                    // Auto-submit for non-RBI results
                  }, 0);
                } else {
                  setPendingResult(result);
                }
              }}
              className={`${color} py-4 rounded-lg font-bold text-xl transition-all active:scale-95`}
            >
              {label}
            </button>
          ))}
        </div>
      ) : needsRbi ? (
        <div className="space-y-4">
          <div className="text-center">
            <div className="text-lg mb-2">
              {pendingResult.toUpperCase()} - How many RBIs?
            </div>
            <div className="flex justify-center gap-3">
              {[0, 1, 2, 3, 4].map((num) => (
                <button
                  key={num}
                  onClick={() => setRbiInput(num)}
                  className={`w-14 h-14 rounded-lg font-bold text-xl transition-all ${
                    rbiInput === num
                      ? 'bg-blue-600 text-white'
                      : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setPendingResult(null);
                setRbiInput(0);
              }}
              className="flex-1 py-3 bg-zinc-700 hover:bg-zinc-600 rounded-lg font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={recordAtBat}
              className="flex-1 py-3 bg-green-600 hover:bg-green-500 rounded-lg font-semibold"
            >
              Confirm
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-3">
          <button
            onClick={() => setPendingResult(null)}
            className="flex-1 py-3 bg-zinc-700 hover:bg-zinc-600 rounded-lg font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={recordAtBat}
            className="flex-1 py-3 bg-green-600 hover:bg-green-500 rounded-lg font-semibold"
          >
            Confirm {pendingResult?.toUpperCase()}
          </button>
        </div>
      )}

      {/* Game Stats Summary */}
      <div className="bg-zinc-800/50 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-zinc-400 mb-3">This Game</h3>
        <div className="space-y-2">
          {gamePlayers.map((gp) => {
            const stats = calculateStats(gp.player_id, gp.player.name, atBats);
            return (
              <div key={gp.id} className="flex justify-between items-center">
                <span className="font-medium">{gp.player.name}</span>
                <span className="text-zinc-400 text-sm">
                  {stats.hits}-{stats.at_bats}, {stats.rbi} RBI
                  {stats.homeruns > 0 && `, ${stats.homeruns} HR`}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={undoLastAtBat}
          disabled={atBats.length === 0}
          className="flex-1 py-3 bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-800 disabled:text-zinc-600 rounded-lg font-semibold transition-colors"
        >
          Undo Last
        </button>
        <button
          onClick={endGame}
          className="flex-1 py-3 bg-red-700 hover:bg-red-600 rounded-lg font-semibold"
        >
          End Game
        </button>
      </div>

      {/* Recent At-Bats */}
      {atBats.length > 0 && (
        <div className="bg-zinc-800/30 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-zinc-400 mb-3">Recent At-Bats</h3>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {[...atBats].reverse().slice(0, 10).map((ab, i) => {
              const player = gamePlayers.find((gp) => gp.player_id === ab.player_id);
              return (
                <div
                  key={ab.id}
                  className="flex justify-between text-sm text-zinc-400"
                >
                  <span>{player?.player.name}</span>
                  <span>
                    {ab.result.toUpperCase()}
                    {ab.rbi > 0 && ` (${ab.rbi} RBI)`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
