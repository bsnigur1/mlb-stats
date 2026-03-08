'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Undo2, Flag, Circle, X, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { AtBatResult, Player, Game, GamePlayer, AtBat } from '@/lib/types';
import { calculateStats, formatAvg } from '@/lib/stats';

// Animation variants
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.25, ease: 'easeOut' as const },
  }),
};

const AT_BAT_BUTTONS: { result: AtBatResult; label: string; color: string; needsRbi: boolean }[] = [
  { result: 'single', label: 'Single', color: '#22C55E', needsRbi: true },
  { result: 'double', label: 'Double', color: '#3B82F6', needsRbi: true },
  { result: 'triple', label: 'Triple', color: '#A855F7', needsRbi: true },
  { result: 'homerun', label: 'Homerun', color: '#F97316', needsRbi: true },
  { result: 'strikeout', label: 'Strikeout', color: '#EF4444', needsRbi: false },
  { result: 'out', label: 'In Play Out', color: '#6B7280', needsRbi: false },
  { result: 'error', label: 'Reached on Error', color: '#8B5CF6', needsRbi: true },
  { result: 'walk', label: 'Walk', color: '#F0B429', needsRbi: false },
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

  // End game modal state
  const [showEndModal, setShowEndModal] = useState(false);
  const [ourScore, setOurScore] = useState('');
  const [theirScore, setTheirScore] = useState('');
  const [inningsPlayed, setInningsPlayed] = useState('9');
  const [ending, setEnding] = useState(false);

  // Leave game modal state
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // Helper to calculate current batter for 1v1 based on total outs
  const calculateH2HBatterIndex = useCallback((atBatsData: AtBat[], numPlayers: number) => {
    if (numPlayers === 0) return 0;
    const totalOuts = atBatsData.filter(
      (ab) => ab.result === 'out' || ab.result === 'strikeout'
    ).length;
    // Every 3 outs, switch to next batter
    const halfInnings = Math.floor(totalOuts / 3);
    return halfInnings % numPlayers;
  }, []);

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

    // Calculate current batter
    if (atBatsData && gamePlayersData && gamePlayersData.length > 0) {
      if (gameData.game_mode === '1v1') {
        // For 1v1, switch every 3 outs
        const batterIndex = calculateH2HBatterIndex(atBatsData, gamePlayersData.length);
        setCurrentBatterIndex(batterIndex);
      } else {
        // For co-op, rotate every at-bat
        const batterIndex = atBatsData.length % gamePlayersData.length;
        setCurrentBatterIndex(batterIndex);
      }
    }

    setLoading(false);
  }, [gameId, router, calculateH2HBatterIndex]);

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

      // Update batter index
      if (game.game_mode === '1v1') {
        // For 1v1, switch batter when outs reset to 0 (every 3 outs)
        if (isOut && newOuts === 0) {
          setCurrentBatterIndex((prev) => (prev + 1) % gamePlayers.length);
        }
      } else {
        // For co-op modes, rotate every at-bat
        setCurrentBatterIndex((prev) => (prev + 1) % gamePlayers.length);
      }
    }

    // Reset input state
    setPendingResult(null);
    setRbiInput(0);
  };

  const handleButtonClick = (result: AtBatResult, needsRbi: boolean) => {
    if (needsRbi) {
      setPendingResult(result);
    } else {
      setPendingResult(result);
    }
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

    const newInning = Math.floor(outs / 3) + 1;
    const newOuts = outs % 3;

    await supabase
      .from('games')
      .update({ current_outs: newOuts, current_inning: newInning })
      .eq('id', gameId);

    loadGame();
  };

  const endGame = async () => {
    if (ending) return;
    setEnding(true);

    const us = parseInt(ourScore) || 0;
    const them = parseInt(theirScore) || 0;
    const innings = parseInt(inningsPlayed) || 9;
    const result = us > them ? 'W' : us < them ? 'L' : 'T';
    const score = `${result} ${us}-${them}`;

    await supabase
      .from('games')
      .update({ status: 'completed', score, innings })
      .eq('id', gameId);

    router.push(`/recap/${gameId}`);
  };

  const leaveGame = async () => {
    if (leaving) return;
    setLeaving(true);

    // Delete all at-bats for this game
    await supabase.from('at_bats').delete().eq('game_id', gameId);

    // Delete game_players
    await supabase.from('game_players').delete().eq('game_id', gameId);

    // Delete the game
    await supabase.from('games').delete().eq('id', gameId);

    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#080D18' }}>
        <div className="text-[#4A5772]">Loading game...</div>
      </div>
    );
  }

  if (!game || gamePlayers.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center flex-col gap-4" style={{ background: '#080D18' }}>
        <p className="text-[#4A5772]">Game not found</p>
        <button onClick={() => router.push('/')} className="text-[#60A5FA] hover:underline">
          Go home
        </button>
      </div>
    );
  }

  const currentPlayer = gamePlayers[currentBatterIndex];
  const pendingButton = AT_BAT_BUTTONS.find(b => b.result === pendingResult);
  const needsRbi = pendingButton?.needsRbi || false;

  return (
    <div className="min-h-screen pb-24" style={{ background: '#080D18' }}>
      {/* Leave Game Modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-5" style={{ background: 'rgba(0,0,0,0.8)' }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm rounded-xl p-5"
            style={{ background: '#0F1829', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ background: 'rgba(239,68,68,0.15)' }}
              >
                <AlertTriangle size={20} color="#EF4444" />
              </div>
              <h2 className="text-lg font-bold text-[#EFF2FF]">Leave Game?</h2>
            </div>

            <p className="text-sm text-[#8A9BBB] mb-6">
              Are you sure you want to leave this game? All stats won&apos;t be saved and the game will be deleted.
            </p>

            <div className="flex gap-3">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => setShowLeaveModal(false)}
                className="flex-1 py-3 rounded-xl font-semibold"
                style={{ background: '#162035', color: '#8A9BBB', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                No, Continue
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={leaveGame}
                disabled={leaving}
                className="flex-1 py-3 rounded-xl font-semibold"
                style={{ background: '#EF4444', color: '#FFF' }}
              >
                {leaving ? 'Leaving...' : 'Yes, Leave'}
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}

      {/* End Game Modal */}
      {showEndModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-5" style={{ background: 'rgba(0,0,0,0.8)' }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm rounded-xl p-5"
            style={{ background: '#0F1829', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-[#EFF2FF]">Final Score</h2>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setShowEndModal(false)}
                className="p-1"
              >
                <X size={20} color="#8A9BBB" />
              </motion.button>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="text-[11px] text-[#4A5772] uppercase tracking-widest mb-2 block">
                  {game.game_mode === '1v1' ? gamePlayers[0]?.player.name || 'Player 1' : 'Snigurs'}
                </label>
                <input
                  type="number"
                  min="0"
                  value={ourScore}
                  onChange={(e) => setOurScore(e.target.value)}
                  placeholder="0"
                  className="w-full px-4 py-3 rounded-lg text-xl font-bold text-center text-[#EFF2FF] placeholder-[#4A5772]"
                  style={{ background: '#162035', border: '1px solid rgba(255,255,255,0.1)' }}
                />
              </div>
              <div>
                <label className="text-[11px] text-[#4A5772] uppercase tracking-widest mb-2 block">
                  {game.game_mode === '1v1' ? gamePlayers[1]?.player.name || 'Player 2' : 'Opponents'}
                </label>
                <input
                  type="number"
                  min="0"
                  value={theirScore}
                  onChange={(e) => setTheirScore(e.target.value)}
                  placeholder="0"
                  className="w-full px-4 py-3 rounded-lg text-xl font-bold text-center text-[#EFF2FF] placeholder-[#4A5772]"
                  style={{ background: '#162035', border: '1px solid rgba(255,255,255,0.1)' }}
                />
              </div>
              <div>
                <label className="text-[11px] text-[#4A5772] uppercase tracking-widest mb-2 block">
                  Innings
                </label>
                <input
                  type="number"
                  min="1"
                  max="99"
                  value={inningsPlayed}
                  onChange={(e) => setInningsPlayed(e.target.value)}
                  placeholder="9"
                  className="w-full px-4 py-3 rounded-lg text-xl font-bold text-center text-[#EFF2FF] placeholder-[#4A5772]"
                  style={{ background: '#162035', border: '1px solid rgba(255,255,255,0.1)' }}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => setShowEndModal(false)}
                className="flex-1 py-3 rounded-xl font-semibold"
                style={{ background: '#162035', color: '#8A9BBB', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                Cancel
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={endGame}
                disabled={ending}
                className="flex-1 py-3 rounded-xl font-semibold"
                style={{ background: '#22C55E', color: '#080D18' }}
              >
                {ending ? 'Saving...' : 'Save & End'}
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Header */}
      <div
        className="sticky top-0 z-50 flex items-center gap-3 px-5 py-4"
        style={{
          background: 'rgba(8,13,24,0.92)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowLeaveModal(true)}
          className="p-2 -m-2"
        >
          <ArrowLeft size={20} color="#8A9BBB" />
        </motion.button>
        <div className="flex-1">
          <h1 className="font-display font-bold text-lg text-[#EFF2FF]">LIVE GAME</h1>
          <div className="text-[11px] text-[#4A5772]">
            Inning {game.current_inning}
            {game.game_mode === '1v1' && ' · Head to Head'}
          </div>
        </div>

        {/* Outs indicator in header */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#4A5772] uppercase tracking-wider">Outs</span>
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <Circle
                key={i}
                size={12}
                fill={i < game.current_outs ? '#EF4444' : 'transparent'}
                color={i < game.current_outs ? '#EF4444' : '#4A5772'}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-5 space-y-5">
        {/* Current Batter */}
        <motion.div
          custom={0}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="text-center py-8 rounded-xl"
          style={{ background: '#0F1829', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div className="text-[11px] text-[#4A5772] uppercase tracking-widest mb-2">Now Batting</div>
          <div
            className="w-16 h-16 rounded-xl flex items-center justify-center text-2xl font-bold mx-auto mb-3"
            style={{ background: '#162035', color: '#F0B429' }}
          >
            {currentPlayer.player.name[0]}
          </div>
          <div className="text-3xl font-bold text-[#EFF2FF]">{currentPlayer.player.name}</div>
          <div className="text-sm text-[#4A5772] mt-2">
            {(() => {
              const stats = calculateStats(
                currentPlayer.player_id,
                currentPlayer.player.name,
                atBats
              );
              return `${stats.hits}-${stats.at_bats} (${formatAvg(stats.avg)}) this game`;
            })()}
          </div>
        </motion.div>

        {/* At-Bat Buttons or RBI Input */}
        {!pendingResult ? (
          <motion.div
            custom={1}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-2 gap-3"
          >
            {AT_BAT_BUTTONS.map(({ result, label, color, needsRbi }) => (
              <motion.button
                key={result}
                whileTap={{ scale: 0.97 }}
                onClick={() => handleButtonClick(result, needsRbi)}
                className="py-5 rounded-xl font-bold text-lg transition-all"
                style={{
                  background: `${color}20`,
                  border: `1px solid ${color}50`,
                  color: color,
                }}
              >
                {label}
              </motion.button>
            ))}
          </motion.div>
        ) : needsRbi ? (
          <motion.div
            custom={1}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="rounded-xl p-5 space-y-5"
            style={{ background: '#0F1829', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="text-center">
              <div
                className="inline-block px-4 py-1.5 rounded-full text-sm font-bold mb-3"
                style={{ background: `${pendingButton?.color}30`, color: pendingButton?.color }}
              >
                {pendingButton?.label}
              </div>
              <div className="text-lg text-[#EFF2FF] font-semibold">How many RBIs?</div>
            </div>
            <div className="flex justify-center gap-3">
              {[0, 1, 2, 3, 4].map((num) => (
                <motion.button
                  key={num}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setRbiInput(num)}
                  className="w-14 h-14 rounded-xl font-bold text-xl transition-all"
                  style={{
                    background: rbiInput === num ? '#F0B429' : '#162035',
                    color: rbiInput === num ? '#080D18' : '#8A9BBB',
                    border: `1px solid ${rbiInput === num ? '#F0B429' : 'rgba(255,255,255,0.1)'}`,
                  }}
                >
                  {num}
                </motion.button>
              ))}
            </div>
            <div className="flex gap-3">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  setPendingResult(null);
                  setRbiInput(0);
                }}
                className="flex-1 py-3 rounded-xl font-semibold"
                style={{ background: '#162035', color: '#8A9BBB', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                Cancel
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={recordAtBat}
                className="flex-1 py-3 rounded-xl font-semibold"
                style={{ background: '#22C55E', color: '#080D18' }}
              >
                Confirm
              </motion.button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            custom={1}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="rounded-xl p-5 space-y-4"
            style={{ background: '#0F1829', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="text-center">
              <div
                className="inline-block px-4 py-1.5 rounded-full text-sm font-bold"
                style={{ background: `${pendingButton?.color}30`, color: pendingButton?.color }}
              >
                {pendingButton?.label}
              </div>
            </div>
            <div className="flex gap-3">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => setPendingResult(null)}
                className="flex-1 py-3 rounded-xl font-semibold"
                style={{ background: '#162035', color: '#8A9BBB', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                Cancel
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={recordAtBat}
                className="flex-1 py-3 rounded-xl font-semibold"
                style={{ background: '#22C55E', color: '#080D18' }}
              >
                Confirm
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* Game Stats Summary */}
        <motion.div
          custom={2}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="rounded-xl p-4"
          style={{ background: '#0F1829', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <h3 className="text-[11px] text-[#4A5772] uppercase tracking-widest mb-3">This Game</h3>
          <div className="space-y-2">
            {gamePlayers.map((gp) => {
              const stats = calculateStats(gp.player_id, gp.player.name, atBats);
              return (
                <div key={gp.id} className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-7 h-7 rounded flex items-center justify-center text-xs font-bold"
                      style={{ background: '#162035', color: '#8A9BBB' }}
                    >
                      {gp.player.name[0]}
                    </div>
                    <span className="text-sm font-medium text-[#EFF2FF]">{gp.player.name}</span>
                  </div>
                  <span className="text-sm text-[#8A9BBB] tabular-nums">
                    {stats.hits}-{stats.at_bats}, {stats.rbi} RBI
                    {stats.homeruns > 0 && `, ${stats.homeruns} HR`}
                  </span>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Recent At-Bats */}
        {atBats.length > 0 && (
          <motion.div
            custom={3}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="rounded-xl p-4"
            style={{ background: '#0F1829', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <h3 className="text-[11px] text-[#4A5772] uppercase tracking-widest mb-3">Recent At-Bats</h3>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {[...atBats].reverse().slice(0, 10).map((ab) => {
                const player = gamePlayers.find((gp) => gp.player_id === ab.player_id);
                const buttonInfo = AT_BAT_BUTTONS.find(b => b.result === ab.result);
                return (
                  <div
                    key={ab.id}
                    className="flex justify-between text-sm"
                  >
                    <span className="text-[#8A9BBB]">{player?.player.name}</span>
                    <span style={{ color: buttonInfo?.color || '#8A9BBB' }}>
                      {buttonInfo?.label || ab.result}
                      {ab.rbi > 0 && <span className="text-[#4A5772]"> ({ab.rbi} RBI)</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Actions */}
        <motion.div
          custom={4}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="flex gap-3 pt-4"
        >
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={undoLastAtBat}
            disabled={atBats.length === 0}
            className="flex-1 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
            style={{ background: '#162035', color: '#8A9BBB', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <Undo2 size={16} />
            Undo Last
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowEndModal(true)}
            className="flex-1 py-3 rounded-xl font-semibold flex items-center justify-center gap-2"
            style={{ background: '#EF4444', color: '#FFF' }}
          >
            <Flag size={16} />
            End Game
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
}
