'use client';

import { useState, useEffect, Suspense } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Users,
  User,
  Check,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Play,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Player, GameMode } from '@/lib/types';

// Animation variants
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.25, ease: 'easeOut' as const },
  }),
};

// Toggle button
function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="flex-1 py-3 px-4 rounded-lg text-sm font-semibold transition-colors"
      style={{
        background: active ? '#F0B429' : 'rgba(255,255,255,0.05)',
        color: active ? '#080D18' : '#8A9BBB',
        border: `1px solid ${active ? '#F0B429' : 'rgba(255,255,255,0.1)'}`,
      }}
    >
      {children}
    </motion.button>
  );
}

function StartGameContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode = (searchParams.get('mode') as GameMode) || '2v2';

  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  // Form state
  const [gameMode, setGameMode] = useState<GameMode>(initialMode);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [battingOrder, setBattingOrder] = useState<string[]>([]);
  const [h2hOpponent, setH2hOpponent] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      const { data: playerData } = await supabase.from('players').select('*');
      setPlayers(playerData || []);
      setLoading(false);
    }
    loadData();
  }, []);

  const handleStartGame = async () => {
    if (starting) return;
    setStarting(true);

    try {
      const today = new Date().toISOString().split('T')[0];
      const now = new Date();
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
      let sessionId: string;

      // For co-op games, check for an active session (activity within last 2 hours)
      // H2H games don't need sessions
      if (gameMode !== '1v1') {
        const { data: recentSessions } = await supabase
          .from('sessions')
          .select('*')
          .neq('id', 'a0000000-0000-0000-0000-000000000001') // Exclude the historical 2025 season
          .gte('last_activity', twoHoursAgo)
          .order('last_activity', { ascending: false })
          .limit(1);

        if (recentSessions && recentSessions.length > 0) {
          // Use existing active session
          sessionId = recentSessions[0].id;
          await supabase
            .from('sessions')
            .update({ last_activity: now.toISOString() })
            .eq('id', sessionId);
        } else {
          // Create new session
          const { data: newSession } = await supabase
            .from('sessions')
            .insert({
              date: today,
              label: `Game Night ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
              last_activity: now.toISOString(),
              is_active: true,
            })
            .select()
            .single();
          sessionId = newSession?.id;
        }
      } else {
        // H2H games don't belong to a session
        sessionId = null as unknown as string;
      }

      // Create game in 'in_progress' state
      const currentPlayerId = selectedPlayers[0];
      const { data: game } = await supabase
        .from('games')
        .insert({
          session_id: sessionId,
          date: today,
          status: 'in_progress',
          current_inning: 1,
          current_outs: 0,
          innings: 9,
          game_mode: gameMode,
          h2h_player1_id: gameMode === '1v1' ? currentPlayerId : null,
          h2h_player2_id: gameMode === '1v1' ? h2hOpponent : null,
        })
        .select()
        .single();

      if (!game) throw new Error('Failed to create game');

      // Add game players with batting order
      const playerIdsToAdd = gameMode === '1v1' && h2hOpponent
        ? [currentPlayerId, h2hOpponent]
        : battingOrder.filter(id => selectedPlayers.includes(id));

      const gamePlayers = playerIdsToAdd.map((playerId, idx) => ({
        game_id: game.id,
        player_id: playerId,
        batting_order: idx + 1,
      }));
      await supabase.from('game_players').insert(gamePlayers);

      // Navigate to live game tracking
      router.push(`/game/${game.id}`);
    } catch (error) {
      console.error('Error starting game:', error);
      alert('Failed to start game');
      setStarting(false);
    }
  };

  const togglePlayer = (playerId: string) => {
    setSelectedPlayers((prev) => {
      if (prev.includes(playerId)) {
        setBattingOrder((bo) => bo.filter((id) => id !== playerId));
        return prev.filter((id) => id !== playerId);
      } else {
        setBattingOrder((bo) => [...bo, playerId]);
        return [...prev, playerId];
      }
    });
  };

  const moveBattingOrder = (playerId: string, direction: 'up' | 'down') => {
    setBattingOrder((prev) => {
      const index = prev.indexOf(playerId);
      if (index === -1) return prev;
      if (direction === 'up' && index === 0) return prev;
      if (direction === 'down' && index === prev.length - 1) return prev;

      const newOrder = [...prev];
      const swapIndex = direction === 'up' ? index - 1 : index + 1;
      [newOrder[index], newOrder[swapIndex]] = [newOrder[swapIndex], newOrder[index]];
      return newOrder;
    });
  };

  const canStart = gameMode === '1v1'
    ? selectedPlayers.length === 1 && h2hOpponent
    : selectedPlayers.length >= 2;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#080D18' }}>
        <div className="text-[#4A5772]">Loading...</div>
      </div>
    );
  }

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  return (
    <div className="min-h-screen" style={{ background: '#080D18' }}>
      {/* Header */}
      <div
        className="sticky top-0 z-50 flex items-center gap-3 px-5 py-4"
        style={{
          background: 'rgba(8,13,24,0.92)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        <Link href="/">
          <motion.div whileTap={{ scale: 0.95 }} className="p-2 -m-2">
            <ArrowLeft size={20} color="#8A9BBB" />
          </motion.div>
        </Link>
        <div className="flex-1">
          <h1 className="font-display font-bold text-lg text-[#EFF2FF]">START GAME</h1>
          <div className="text-[11px] text-[#4A5772]">{today}</div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-5 pb-24 space-y-6">
        {/* Game mode */}
        <motion.div custom={0} variants={fadeUp} initial="hidden" animate="visible">
          <label className="text-[11px] text-[#4A5772] uppercase tracking-widest mb-2 block">Game Mode</label>
          <div className="flex gap-2">
            <ToggleButton active={gameMode === '2v2'} onClick={() => { setGameMode('2v2'); setH2hOpponent(null); setSelectedPlayers([]); setBattingOrder([]); }}>
              <Users size={14} className="inline mr-1.5" />
              2v2 Co-Op
            </ToggleButton>
            <ToggleButton active={gameMode === '3v3'} onClick={() => { setGameMode('3v3'); setH2hOpponent(null); setSelectedPlayers([]); setBattingOrder([]); }}>
              <Users size={14} className="inline mr-1.5" />
              3v3 Co-Op
            </ToggleButton>
            <ToggleButton active={gameMode === '1v1'} onClick={() => { setGameMode('1v1'); setSelectedPlayers([]); setBattingOrder([]); }}>
              <User size={14} className="inline mr-1.5" />
              1v1 H2H
            </ToggleButton>
          </div>
        </motion.div>

        {/* Players - for Co-Op modes */}
        {(gameMode === '2v2' || gameMode === '3v3') && (
          <motion.div custom={1} variants={fadeUp} initial="hidden" animate="visible">
            <label className="text-[11px] text-[#4A5772] uppercase tracking-widest mb-2 block">
              Who&apos;s playing? ({gameMode === '2v2' ? 'Select 2' : 'Select 3'})
            </label>
            <div className="flex gap-2 flex-wrap">
              {players.map((player) => (
                <motion.button
                  key={player.id}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => togglePlayer(player.id)}
                  className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium"
                  style={{
                    background: selectedPlayers.includes(player.id) ? 'rgba(240,180,41,0.15)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${selectedPlayers.includes(player.id) ? 'rgba(240,180,41,0.3)' : 'rgba(255,255,255,0.1)'}`,
                    color: selectedPlayers.includes(player.id) ? '#F0B429' : '#8A9BBB',
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
                    style={{ background: '#162035', color: '#8A9BBB' }}
                  >
                    {player.name[0]}
                  </div>
                  {player.name}
                  {selectedPlayers.includes(player.id) && <Check size={14} />}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Batting Order - for Co-Op modes */}
        {(gameMode === '2v2' || gameMode === '3v3') && selectedPlayers.length > 1 && (
          <motion.div custom={2} variants={fadeUp} initial="hidden" animate="visible">
            <label className="text-[11px] text-[#4A5772] uppercase tracking-widest mb-2 block">
              Batting Order
            </label>
            <div className="space-y-2">
              {battingOrder
                .filter(id => selectedPlayers.includes(id))
                .map((playerId, index) => {
                  const player = players.find(p => p.id === playerId);
                  if (!player) return null;
                  return (
                    <div
                      key={playerId}
                      className="flex items-center gap-3 p-3 rounded-lg"
                      style={{ background: '#0F1829', border: '1px solid rgba(255,255,255,0.07)' }}
                    >
                      <div className="flex items-center gap-2 text-[#4A5772]">
                        <GripVertical size={14} />
                        <span className="text-sm font-bold text-[#F0B429] tabular-nums w-5">{index + 1}</span>
                      </div>
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
                        style={{ background: '#162035', color: '#8A9BBB' }}
                      >
                        {player.name[0]}
                      </div>
                      <span className="flex-1 text-sm font-medium text-[#EFF2FF]">{player.name}</span>
                      <div className="flex gap-1">
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          onClick={() => moveBattingOrder(playerId, 'up')}
                          disabled={index === 0}
                          className="w-7 h-7 rounded flex items-center justify-center disabled:opacity-30"
                          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                        >
                          <ChevronUp size={14} color="#8A9BBB" />
                        </motion.button>
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          onClick={() => moveBattingOrder(playerId, 'down')}
                          disabled={index === battingOrder.filter(id => selectedPlayers.includes(id)).length - 1}
                          className="w-7 h-7 rounded flex items-center justify-center disabled:opacity-30"
                          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                        >
                          <ChevronDown size={14} color="#8A9BBB" />
                        </motion.button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </motion.div>
        )}

        {/* Player selection - for 1v1 mode */}
        {gameMode === '1v1' && (
          <>
            <motion.div custom={1} variants={fadeUp} initial="hidden" animate="visible">
              <label className="text-[11px] text-[#4A5772] uppercase tracking-widest mb-2 block">
                Who are you?
              </label>
              <div className="flex gap-2 flex-wrap">
                {players.map((player) => (
                  <motion.button
                    key={player.id}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setSelectedPlayers([player.id]);
                      if (h2hOpponent === player.id) setH2hOpponent(null);
                    }}
                    className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium"
                    style={{
                      background: selectedPlayers[0] === player.id ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${selectedPlayers[0] === player.id ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.1)'}`,
                      color: selectedPlayers[0] === player.id ? '#34D399' : '#8A9BBB',
                    }}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
                      style={{ background: '#162035', color: '#8A9BBB' }}
                    >
                      {player.name[0]}
                    </div>
                    {player.name}
                    {selectedPlayers[0] === player.id && <Check size={14} />}
                  </motion.button>
                ))}
              </div>
            </motion.div>

            <motion.div custom={2} variants={fadeUp} initial="hidden" animate="visible">
              <label className="text-[11px] text-[#4A5772] uppercase tracking-widest mb-2 block">
                Who are you playing against?
              </label>
              <div className="flex gap-2 flex-wrap">
                {players
                  .filter((p) => p.id !== selectedPlayers[0])
                  .map((player) => (
                    <motion.button
                      key={player.id}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setH2hOpponent(player.id)}
                      className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium"
                      style={{
                        background: h2hOpponent === player.id ? 'rgba(248,113,113,0.15)' : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${h2hOpponent === player.id ? 'rgba(248,113,113,0.3)' : 'rgba(255,255,255,0.1)'}`,
                        color: h2hOpponent === player.id ? '#F87171' : '#8A9BBB',
                      }}
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
                        style={{ background: '#162035', color: '#8A9BBB' }}
                      >
                        {player.name[0]}
                      </div>
                      {player.name}
                      {h2hOpponent === player.id && <Check size={14} />}
                    </motion.button>
                  ))}
              </div>
            </motion.div>
          </>
        )}

        {/* Start Game Button */}
        <motion.div custom={3} variants={fadeUp} initial="hidden" animate="visible" className="pt-4">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleStartGame}
            disabled={!canStart || starting}
            className="w-full py-4 rounded-lg text-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ background: '#F0B429', color: '#080D18' }}
          >
            <Play size={20} />
            {starting ? 'Starting...' : 'Start Game'}
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
}

export default function StartGame() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center" style={{ background: '#080D18' }}><div className="text-[#4A5772]">Loading...</div></div>}>
      <StartGameContent />
    </Suspense>
  );
}
