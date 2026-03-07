'use client';

import { useState, useEffect, Suspense } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Plus,
  Minus,
  Trophy,
  Users,
  User,
  Calendar,
  Target,
  Check,
  ChevronDown,
  ChevronUp,
  GripVertical,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Player, Session, Game, GameMode } from '@/lib/types';

// Animation variants
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.25, ease: 'easeOut' as const },
  }),
};

// Incrementor component
function Incrementor({
  label,
  value,
  onChange,
  min = 0,
  max = 99,
}: {
  label: string;
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-[11px] text-[#4A5772] uppercase tracking-wider">{label}</span>
      <div className="flex items-center gap-2">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => onChange(Math.max(min, value - 1))}
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <Minus size={14} color="#8A9BBB" />
        </motion.button>
        <span className="text-xl font-bold text-[#EFF2FF] tabular-nums w-8 text-center">
          {value}
        </span>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => onChange(Math.min(max, value + 1))}
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <Plus size={14} color="#8A9BBB" />
        </motion.button>
      </div>
    </div>
  );
}

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

// Player stat card for full mode
function PlayerStatCard({
  player,
  stats,
  onChange,
  index,
}: {
  player: Player;
  stats: {
    ab: number;
    h: number;
    hr: number;
    rbi: number;
    bb: number;
    k: number;
    ip: number;
    ha: number;
    er: number;
    so: number;
  };
  onChange: (key: string, val: number) => void;
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      custom={index}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="rounded-lg overflow-hidden"
      style={{ background: '#0F1829', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4"
      >
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold"
          style={{ background: 'linear-gradient(135deg, #162035 0%, #1A2640 100%)', color: '#8A9BBB' }}
        >
          {player.name[0]}
        </div>
        <div className="flex-1 text-left">
          <div className="text-sm font-semibold text-[#EFF2FF]">{player.name}</div>
          <div className="text-xs text-[#4A5772]">
            {stats.ab} AB · {stats.h} H · {stats.hr} HR · {stats.rbi} RBI
          </div>
        </div>
        <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={16} color="#4A5772" />
        </motion.div>
      </button>

      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="border-t border-white/5 p-4"
        >
          <div className="text-[10px] text-[#4A5772] uppercase tracking-widest mb-3">Batting</div>
          <div className="grid grid-cols-6 gap-3 mb-5">
            <Incrementor label="AB" value={stats.ab} onChange={(v) => onChange('ab', v)} />
            <Incrementor label="H" value={stats.h} onChange={(v) => onChange('h', v)} />
            <Incrementor label="HR" value={stats.hr} onChange={(v) => onChange('hr', v)} />
            <Incrementor label="RBI" value={stats.rbi} onChange={(v) => onChange('rbi', v)} />
            <Incrementor label="BB" value={stats.bb} onChange={(v) => onChange('bb', v)} />
            <Incrementor label="K" value={stats.k} onChange={(v) => onChange('k', v)} />
          </div>

          <div className="text-[10px] text-[#4A5772] uppercase tracking-widest mb-3">Pitching (optional)</div>
          <div className="grid grid-cols-4 gap-3">
            <Incrementor label="IP" value={stats.ip} onChange={(v) => onChange('ip', v)} />
            <Incrementor label="H" value={stats.ha} onChange={(v) => onChange('ha', v)} />
            <Incrementor label="ER" value={stats.er} onChange={(v) => onChange('er', v)} />
            <Incrementor label="SO" value={stats.so} onChange={(v) => onChange('so', v)} />
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

function LogGameContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode = (searchParams.get('mode') as GameMode) || '2v2';

  const [players, setPlayers] = useState<Player[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [mode, setMode] = useState<'quick' | 'full'>('quick');
  const [gameMode, setGameMode] = useState<GameMode>(initialMode);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [battingOrder, setBattingOrder] = useState<string[]>([]); // Ordered list of player IDs
  const [h2hOpponent, setH2hOpponent] = useState<string | null>(null); // For 1v1: who you played against
  const [opponent, setOpponent] = useState('');
  const [ourScore, setOurScore] = useState(0);
  const [theirScore, setTheirScore] = useState(0);
  const [innings, setInnings] = useState(9);
  const [mvpPlayerId, setMvpPlayerId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [newSessionLabel, setNewSessionLabel] = useState('');

  // Player stats for full mode
  const [playerStats, setPlayerStats] = useState<{
    [playerId: string]: {
      ab: number;
      h: number;
      hr: number;
      rbi: number;
      bb: number;
      k: number;
      ip: number;
      ha: number;
      er: number;
      so: number;
    };
  }>({});

  useEffect(() => {
    async function loadData() {
      const [playersRes, sessionsRes] = await Promise.all([
        supabase.from('players').select('*'),
        supabase.from('sessions').select('*').order('date', { ascending: false }).limit(10),
      ]);

      const playerData = playersRes.data || [];
      setPlayers(playerData);

      const sessionData = sessionsRes.data || [];

      // Auto-close sessions that have been inactive for 2+ hours
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const staleSessions = sessionData.filter(
        (s) => s.is_active && s.last_activity && s.last_activity < twoHoursAgo
      );

      if (staleSessions.length > 0) {
        // Mark stale sessions as inactive
        await supabase
          .from('sessions')
          .update({ is_active: false })
          .in('id', staleSessions.map(s => s.id));

        // Update local data
        sessionData.forEach(s => {
          if (staleSessions.find(stale => stale.id === s.id)) {
            s.is_active = false;
          }
        });
      }

      setSessions(sessionData);

      // Check for active session within 2 hours
      const activeSession = sessionData.find(
        (s) => s.is_active && s.last_activity && s.last_activity > twoHoursAgo
      );
      if (activeSession) {
        setSessionId(activeSession.id);
      }

      // Initialize all players as selected for co-op modes
      const allPlayerIds = playerData.map((p) => p.id);
      setSelectedPlayers(allPlayerIds);
      setBattingOrder(allPlayerIds);

      // Initialize stats
      const initialStats: typeof playerStats = {};
      playerData.forEach((p) => {
        initialStats[p.id] = { ab: 0, h: 0, hr: 0, rbi: 0, bb: 0, k: 0, ip: 0, ha: 0, er: 0, so: 0 };
      });
      setPlayerStats(initialStats);

      setLoading(false);
    }
    loadData();
  }, []);

  const result = ourScore > theirScore ? 'W' : ourScore < theirScore ? 'L' : 'T';
  const scoreDisplay = `${result} ${ourScore}-${theirScore}`;

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);

    try {
      // Create or use existing session
      let finalSessionId = sessionId;
      if (!sessionId) {
        const today = new Date().toISOString().split('T')[0];
        const { data: newSession } = await supabase
          .from('sessions')
          .insert({ date: today, label: newSessionLabel || null, last_activity: new Date().toISOString(), is_active: true })
          .select()
          .single();
        finalSessionId = newSession?.id || null;
      } else {
        // Update last_activity for existing session
        await supabase
          .from('sessions')
          .update({ last_activity: new Date().toISOString() })
          .eq('id', sessionId);
      }

      // Determine winner for 1v1
      const currentPlayerId = selectedPlayers[0]; // The player logging (you)
      const h2hWinnerId = gameMode === '1v1' && h2hOpponent
        ? (ourScore > theirScore ? currentPlayerId : ourScore < theirScore ? h2hOpponent : null)
        : null;

      // Create game
      const { data: game } = await supabase
        .from('games')
        .insert({
          session_id: finalSessionId,
          date: new Date().toISOString().split('T')[0],
          status: 'completed',
          current_inning: innings,
          current_outs: 0,
          opponent: gameMode === '1v1' ? null : opponent,
          score: scoreDisplay,
          innings,
          game_mode: gameMode,
          h2h_player1_id: gameMode === '1v1' ? currentPlayerId : null,
          h2h_player2_id: gameMode === '1v1' ? h2hOpponent : null,
          h2h_winner_id: h2hWinnerId,
          mvp_player_id: mvpPlayerId,
        })
        .select()
        .single();

      if (!game) throw new Error('Failed to create game');

      // Add game players - for 1v1, include both players; for co-op use batting order
      const playerIdsToAdd = gameMode === '1v1' && h2hOpponent
        ? [currentPlayerId, h2hOpponent]
        : battingOrder.filter(id => selectedPlayers.includes(id));

      const gamePlayers = playerIdsToAdd.map((playerId, idx) => ({
        game_id: game.id,
        player_id: playerId,
        batting_order: idx + 1,
      }));
      await supabase.from('game_players').insert(gamePlayers);

      // If full mode, add at-bats
      if (mode === 'full') {
        const atBats: {
          game_id: string;
          player_id: string;
          inning: number;
          result: string;
          rbi: number;
          innings_pitched: number;
          hits_allowed: number;
          runs_allowed: number;
          earned_runs: number;
          walks_allowed: number;
          strikeouts_pitched: number;
        }[] = [];

        // For 1v1, include both players' stats
        const playersToProcess = gameMode === '1v1' && h2hOpponent
          ? [currentPlayerId, h2hOpponent]
          : selectedPlayers;

        for (const playerId of playersToProcess) {
          const stats = playerStats[playerId];
          if (!stats) continue;

          // Convert summary stats to at-bats
          // Hits
          for (let i = 0; i < stats.hr; i++) {
            atBats.push({
              game_id: game.id,
              player_id: playerId,
              inning: 1,
              result: 'homerun',
              rbi: i === 0 ? stats.rbi : 0, // Assign RBI to first HR
              innings_pitched: 0,
              hits_allowed: 0,
              runs_allowed: 0,
              earned_runs: 0,
              walks_allowed: 0,
              strikeouts_pitched: 0,
            });
          }
          const nonHrHits = stats.h - stats.hr;
          for (let i = 0; i < nonHrHits; i++) {
            atBats.push({
              game_id: game.id,
              player_id: playerId,
              inning: 1,
              result: 'single',
              rbi: stats.hr === 0 && i === 0 ? stats.rbi : 0,
              innings_pitched: 0,
              hits_allowed: 0,
              runs_allowed: 0,
              earned_runs: 0,
              walks_allowed: 0,
              strikeouts_pitched: 0,
            });
          }
          // Walks
          for (let i = 0; i < stats.bb; i++) {
            atBats.push({
              game_id: game.id,
              player_id: playerId,
              inning: 1,
              result: 'walk',
              rbi: 0,
              innings_pitched: 0,
              hits_allowed: 0,
              runs_allowed: 0,
              earned_runs: 0,
              walks_allowed: 0,
              strikeouts_pitched: 0,
            });
          }
          // Strikeouts
          for (let i = 0; i < stats.k; i++) {
            atBats.push({
              game_id: game.id,
              player_id: playerId,
              inning: 1,
              result: 'strikeout',
              rbi: 0,
              innings_pitched: 0,
              hits_allowed: 0,
              runs_allowed: 0,
              earned_runs: 0,
              walks_allowed: 0,
              strikeouts_pitched: 0,
            });
          }
          // Outs (remaining AB - H - BB - K)
          const outs = stats.ab - stats.h - stats.bb - stats.k;
          for (let i = 0; i < Math.max(0, outs); i++) {
            atBats.push({
              game_id: game.id,
              player_id: playerId,
              inning: 1,
              result: 'out',
              rbi: 0,
              innings_pitched: 0,
              hits_allowed: 0,
              runs_allowed: 0,
              earned_runs: 0,
              walks_allowed: 0,
              strikeouts_pitched: 0,
            });
          }

          // Pitching stats - add as a single entry
          if (stats.ip > 0) {
            atBats.push({
              game_id: game.id,
              player_id: playerId,
              inning: 1,
              result: 'out', // Placeholder
              rbi: 0,
              innings_pitched: stats.ip,
              hits_allowed: stats.ha,
              runs_allowed: 0,
              earned_runs: stats.er,
              walks_allowed: 0,
              strikeouts_pitched: stats.so,
            });
          }
        }

        if (atBats.length > 0) {
          await supabase.from('at_bats').insert(atBats);
        }
      }

      router.push('/');
    } catch (error) {
      console.error('Error saving game:', error);
      alert('Failed to save game');
    } finally {
      setSaving(false);
    }
  };

  const togglePlayer = (playerId: string) => {
    setSelectedPlayers((prev) => {
      if (prev.includes(playerId)) {
        // Remove from selected and batting order
        setBattingOrder((bo) => bo.filter((id) => id !== playerId));
        return prev.filter((id) => id !== playerId);
      } else {
        // Add to selected and batting order
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

  const updatePlayerStat = (playerId: string, key: string, value: number) => {
    setPlayerStats((prev) => ({
      ...prev,
      [playerId]: { ...prev[playerId], [key]: value },
    }));
  };

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
          <h1 className="font-display font-bold text-lg text-[#EFF2FF]">LOG GAME</h1>
          <div className="text-[11px] text-[#4A5772]">{today}</div>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleSave}
          disabled={saving || selectedPlayers.length === 0 || (gameMode === '1v1' && !h2hOpponent)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
          style={{ background: '#F0B429', color: '#080D18' }}
        >
          <Check size={14} />
          {saving ? 'Saving...' : 'Save'}
        </motion.button>
      </div>

      <div className="max-w-2xl mx-auto p-5 pb-24 space-y-6">
        {/* Mode toggle */}
        <motion.div custom={0} variants={fadeUp} initial="hidden" animate="visible" className="flex gap-2">
          <ToggleButton active={mode === 'quick'} onClick={() => setMode('quick')}>
            Quick Log
          </ToggleButton>
          <ToggleButton active={mode === 'full'} onClick={() => setMode('full')}>
            Full Stats
          </ToggleButton>
        </motion.div>

        {/* Session selector */}
        <motion.div custom={1} variants={fadeUp} initial="hidden" animate="visible">
          <label className="text-[11px] text-[#4A5772] uppercase tracking-widest mb-2 block">
            <Calendar size={11} className="inline mr-1.5" />
            Session
          </label>
          <select
            value={sessionId || 'new'}
            onChange={(e) => setSessionId(e.target.value === 'new' ? null : e.target.value)}
            className="w-full p-3 rounded-lg text-sm bg-[#0F1829] border border-white/10 text-[#EFF2FF] appearance-none"
          >
            <option value="new">+ New Session</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — {s.label || 'Game Night'}
              </option>
            ))}
          </select>
          {!sessionId && (
            <input
              type="text"
              placeholder="Session label (optional)"
              value={newSessionLabel}
              onChange={(e) => setNewSessionLabel(e.target.value)}
              className="w-full mt-2 p-3 rounded-lg text-sm bg-[#0F1829] border border-white/10 text-[#EFF2FF] placeholder:text-[#4A5772]"
            />
          )}
        </motion.div>

        {/* Game mode */}
        <motion.div custom={2} variants={fadeUp} initial="hidden" animate="visible">
          <label className="text-[11px] text-[#4A5772] uppercase tracking-widest mb-2 block">Game Mode</label>
          <div className="flex gap-2">
            <ToggleButton active={gameMode === '2v2'} onClick={() => { setGameMode('2v2'); setH2hOpponent(null); }}>
              <Users size={14} className="inline mr-1.5" />
              2v2 Co-Op
            </ToggleButton>
            <ToggleButton active={gameMode === '3v3'} onClick={() => { setGameMode('3v3'); setH2hOpponent(null); }}>
              <Users size={14} className="inline mr-1.5" />
              3v3 Co-Op
            </ToggleButton>
            <ToggleButton active={gameMode === '1v1'} onClick={() => setGameMode('1v1')}>
              <User size={14} className="inline mr-1.5" />
              1v1 H2H
            </ToggleButton>
          </div>
        </motion.div>

        {/* 1v1 Opponent selection */}
        {gameMode === '1v1' && (
          <motion.div custom={2.5} variants={fadeUp} initial="hidden" animate="visible">
            <label className="text-[11px] text-[#4A5772] uppercase tracking-widest mb-2 block">
              Who did you play?
            </label>
            <div className="flex gap-2 flex-wrap">
              {players
                .filter((p) => !selectedPlayers.includes(p.id) || selectedPlayers.length > 1)
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
        )}

        {/* Players - for Co-Op modes */}
        {(gameMode === '2v2' || gameMode === '3v3') && (
          <motion.div custom={3} variants={fadeUp} initial="hidden" animate="visible">
            <label className="text-[11px] text-[#4A5772] uppercase tracking-widest mb-2 block">
              Who played? ({gameMode === '2v2' ? 'Select 2' : 'Select 3'})
            </label>
            <div className="flex gap-2 flex-wrap">
              {players.map((player) => (
                <motion.button
                  key={player.id}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => togglePlayer(player.id)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium"
                  style={{
                    background: selectedPlayers.includes(player.id) ? 'rgba(240,180,41,0.15)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${selectedPlayers.includes(player.id) ? 'rgba(240,180,41,0.3)' : 'rgba(255,255,255,0.1)'}`,
                    color: selectedPlayers.includes(player.id) ? '#F0B429' : '#8A9BBB',
                  }}
                >
                  <div
                    className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold"
                    style={{ background: '#162035', color: '#8A9BBB' }}
                  >
                    {player.name[0]}
                  </div>
                  {player.name}
                  {selectedPlayers.includes(player.id) && <Check size={12} />}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Batting Order - for Co-Op modes */}
        {(gameMode === '2v2' || gameMode === '3v3') && selectedPlayers.length > 1 && (
          <motion.div custom={3.5} variants={fadeUp} initial="hidden" animate="visible">
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

        {/* Player - for 1v1 mode (who is logging) */}
        {gameMode === '1v1' && (
          <motion.div custom={3} variants={fadeUp} initial="hidden" animate="visible">
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
        )}

        {/* Opponent - only for co-op modes */}
        {(gameMode === '2v2' || gameMode === '3v3') && (
          <motion.div custom={4} variants={fadeUp} initial="hidden" animate="visible">
            <label className="text-[11px] text-[#4A5772] uppercase tracking-widest mb-2 block">
              <Target size={11} className="inline mr-1.5" />
              Opponent Team
            </label>
            <input
              type="text"
              placeholder="Team name (optional)"
              value={opponent}
              onChange={(e) => setOpponent(e.target.value)}
              className="w-full p-3 rounded-lg text-sm bg-[#0F1829] border border-white/10 text-[#EFF2FF] placeholder:text-[#4A5772]"
            />
          </motion.div>
        )}

        {/* Score */}
        <motion.div custom={5} variants={fadeUp} initial="hidden" animate="visible">
          <label className="text-[11px] text-[#4A5772] uppercase tracking-widest mb-3 block">Final Score</label>
          <div className="flex items-center gap-4">
            <div className="flex-1 text-center">
              <div className="text-[10px] text-[#4A5772] uppercase tracking-wide mb-2">
                {gameMode === '1v1' ? (players.find(p => p.id === selectedPlayers[0])?.name || 'You') : 'Us'}
              </div>
              <div className="flex items-center justify-center gap-3">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setOurScore(Math.max(0, ourScore - 1))}
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  <Minus size={16} color="#8A9BBB" />
                </motion.button>
                <span className="text-4xl font-bold text-[#EFF2FF] tabular-nums w-12 text-center">{ourScore}</span>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setOurScore(ourScore + 1)}
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  <Plus size={16} color="#8A9BBB" />
                </motion.button>
              </div>
            </div>

            <div
              className="text-2xl font-bold px-4 py-2 rounded-lg"
              style={{
                color: result === 'W' ? '#34D399' : result === 'L' ? '#F87171' : '#8A9BBB',
                background: result === 'W' ? 'rgba(52,211,153,0.1)' : result === 'L' ? 'rgba(248,113,113,0.1)' : 'rgba(255,255,255,0.05)',
              }}
            >
              {result}
            </div>

            <div className="flex-1 text-center">
              <div className="text-[10px] text-[#4A5772] uppercase tracking-wide mb-2">
                {gameMode === '1v1' ? (players.find(p => p.id === h2hOpponent)?.name || 'Them') : 'Them'}
              </div>
              <div className="flex items-center justify-center gap-3">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setTheirScore(Math.max(0, theirScore - 1))}
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  <Minus size={16} color="#8A9BBB" />
                </motion.button>
                <span className="text-4xl font-bold text-[#EFF2FF] tabular-nums w-12 text-center">{theirScore}</span>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setTheirScore(theirScore + 1)}
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  <Plus size={16} color="#8A9BBB" />
                </motion.button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Innings */}
        <motion.div custom={6} variants={fadeUp} initial="hidden" animate="visible">
          <label className="text-[11px] text-[#4A5772] uppercase tracking-widest mb-2 block">Innings</label>
          <div className="flex gap-2">
            {[3, 6, 9].map((n) => (
              <motion.button
                key={n}
                whileTap={{ scale: 0.95 }}
                onClick={() => setInnings(n)}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold"
                style={{
                  background: innings === n ? '#F0B429' : 'rgba(255,255,255,0.05)',
                  color: innings === n ? '#080D18' : '#8A9BBB',
                  border: `1px solid ${innings === n ? '#F0B429' : 'rgba(255,255,255,0.1)'}`,
                }}
              >
                {n}
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* MVP - only for co-op modes */}
        {(gameMode === '2v2' || gameMode === '3v3') && (
          <motion.div custom={7} variants={fadeUp} initial="hidden" animate="visible">
            <label className="text-[11px] text-[#4A5772] uppercase tracking-widest mb-2 block">
              <Trophy size={11} className="inline mr-1.5" color="#F0B429" />
              Game MVP
            </label>
            <div className="flex gap-2 flex-wrap">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setMvpPlayerId(null)}
                className="px-3 py-2 rounded-lg text-sm font-medium"
                style={{
                  background: !mvpPlayerId ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)',
                  color: !mvpPlayerId ? '#EFF2FF' : '#4A5772',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                None
              </motion.button>
              {players
                .filter((p) => selectedPlayers.includes(p.id))
                .map((player) => (
                  <motion.button
                    key={player.id}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setMvpPlayerId(player.id)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium"
                    style={{
                      background: mvpPlayerId === player.id ? 'rgba(240,180,41,0.15)' : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${mvpPlayerId === player.id ? 'rgba(240,180,41,0.3)' : 'rgba(255,255,255,0.1)'}`,
                      color: mvpPlayerId === player.id ? '#F0B429' : '#8A9BBB',
                    }}
                  >
                    {mvpPlayerId === player.id && <Trophy size={12} />}
                    {player.name}
                  </motion.button>
                ))}
            </div>
          </motion.div>
        )}

        {/* Full mode: player stats */}
        {mode === 'full' && (
          <motion.div custom={8} variants={fadeUp} initial="hidden" animate="visible">
            <label className="text-[11px] text-[#4A5772] uppercase tracking-widest mb-3 block">
              {gameMode === '1v1' ? 'Both Players Stats' : 'Player Stats'}
            </label>
            <div className="space-y-2">
              {players
                .filter((p) => {
                  // For 1v1, show both the selected player and opponent
                  if (gameMode === '1v1') {
                    return p.id === selectedPlayers[0] || p.id === h2hOpponent;
                  }
                  return selectedPlayers.includes(p.id);
                })
                .map((player, i) => (
                  <PlayerStatCard
                    key={player.id}
                    player={player}
                    stats={playerStats[player.id]}
                    onChange={(key, val) => updatePlayerStat(player.id, key, val)}
                    index={i}
                  />
                ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

export default function LogGame() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center" style={{ background: '#080D18' }}><div className="text-[#4A5772]">Loading...</div></div>}>
      <LogGameContent />
    </Suspense>
  );
}
