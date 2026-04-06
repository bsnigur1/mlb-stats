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
  Plus,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Player, GameMode, Season } from '@/lib/types';

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
  const [activeSeason, setActiveSeason] = useState<Season | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  // Form state
  const [gameMode, setGameMode] = useState<GameMode>(initialMode);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [battingOrder, setBattingOrder] = useState<string[]>([]);
  const [h2hOpponent, setH2hOpponent] = useState<string | null>(null);
  const [trackPitching, setTrackPitching] = useState(false);
  const [battingFirst, setBattingFirst] = useState(true);

  // Add player modal state
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [addingPlayer, setAddingPlayer] = useState(false);

  // H2H quick log state
  const [h2hPlayer1, setH2hPlayer1] = useState<string | null>(null);
  const [h2hPlayer2, setH2hPlayer2] = useState<string | null>(null);
  const [h2hDifficulty, setH2hDifficulty] = useState<'rookie' | 'veteran' | 'all-star' | 'hall-of-fame' | 'legend'>('all-star');
  const [h2hInnings, setH2hInnings] = useState('9');
  const [h2hPlayer1Score, setH2hPlayer1Score] = useState('');
  const [h2hPlayer2Score, setH2hPlayer2Score] = useState('');

  useEffect(() => {
    async function loadData() {
      const [playersRes, seasonsRes] = await Promise.all([
        supabase.from('players').select('*'),
        supabase.from('seasons').select('*').eq('is_active', true).single(),
      ]);
      setPlayers(playersRes.data || []);
      setActiveSeason(seasonsRes.data || null);
      setLoading(false);
    }
    loadData();
  }, []);

  const addNewPlayer = async () => {
    if (addingPlayer || !newPlayerName.trim()) return;
    setAddingPlayer(true);

    const { data: newPlayer } = await supabase
      .from('players')
      .insert({ name: newPlayerName.trim() })
      .select()
      .single();

    if (newPlayer) {
      setPlayers((prev) => [...prev, newPlayer]);
    }

    setNewPlayerName('');
    setShowAddPlayer(false);
    setAddingPlayer(false);
  };

  const handleStartGame = async () => {
    if (starting) return;
    setStarting(true);

    try {
      const today = new Date().toISOString().split('T')[0];

      // For 1v1 mode, create a completed game directly (quick log)
      if (gameMode === '1v1' && h2hPlayer1 && h2hPlayer2) {
        const p1Score = parseInt(h2hPlayer1Score) || 0;
        const p2Score = parseInt(h2hPlayer2Score) || 0;
        const winnerId = p1Score > p2Score ? h2hPlayer1 : p2Score > p1Score ? h2hPlayer2 : null;
        const p1Player = players.find(p => p.id === h2hPlayer1);
        const p2Player = players.find(p => p.id === h2hPlayer2);

        // Determine score string from Player 1's perspective
        const scoreStr = p1Score > p2Score
          ? `W ${p1Score}-${p2Score}`
          : p2Score > p1Score
          ? `L ${p1Score}-${p2Score}`
          : `T ${p1Score}-${p2Score}`;

        // Create completed game
        const { data: game } = await supabase
          .from('games')
          .insert({
            session_id: null,
            season_id: activeSeason?.id || null,
            date: today,
            status: 'completed',
            current_inning: parseInt(h2hInnings) || 9,
            current_outs: 0,
            innings: parseInt(h2hInnings) || 9,
            game_mode: '1v1',
            h2h_player1_id: h2hPlayer1,
            h2h_player2_id: h2hPlayer2,
            h2h_winner_id: winnerId,
            // h2h_difficulty: h2hDifficulty, // TODO: add migration for this column
            score: scoreStr,
            track_pitching: false,
            batting_first: true,
          })
          .select()
          .single();

        if (!game) throw new Error('Failed to create game');

        // Add game players
        await supabase.from('game_players').insert([
          { game_id: game.id, player_id: h2hPlayer1, batting_order: 1 },
          { game_id: game.id, player_id: h2hPlayer2, batting_order: 2 },
        ]);

        // Navigate to H2H page to see updated records
        router.push('/h2h');
        return;
      }

      // For co-op modes, create game in 'in_progress' state
      const currentPlayerId = selectedPlayers[0];
      const { data: game } = await supabase
        .from('games')
        .insert({
          session_id: null,
          season_id: activeSeason?.id || null,
          date: today,
          status: 'in_progress',
          current_inning: 1,
          current_outs: 0,
          innings: 9,
          game_mode: gameMode,
          h2h_player1_id: null,
          h2h_player2_id: null,
          track_pitching: trackPitching,
          batting_first: battingFirst,
        })
        .select()
        .single();

      if (!game) throw new Error('Failed to create game');

      // Add game players with batting order (deduplicate to prevent duplicate stats)
      const playerIdsToAdd = [...new Set(battingOrder)].filter(id => selectedPlayers.includes(id));

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
    ? h2hPlayer1 && h2hPlayer2 && h2hPlayer1Score !== '' && h2hPlayer2Score !== ''
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
      {/* Add Player Modal */}
      {showAddPlayer && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-5" style={{ background: 'rgba(0,0,0,0.8)' }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm rounded-xl p-5"
            style={{ background: '#0F1829', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-[#EFF2FF]">Add New Player</h2>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => { setShowAddPlayer(false); setNewPlayerName(''); }}
                className="p-1"
              >
                <X size={20} color="#8A9BBB" />
              </motion.button>
            </div>

            <div className="mb-6">
              <label className="text-[11px] text-[#4A5772] uppercase tracking-widest mb-2 block">
                Player Name
              </label>
              <input
                type="text"
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                placeholder="Enter name"
                autoFocus
                className="w-full px-4 py-3 rounded-lg text-[#EFF2FF] placeholder-[#4A5772]"
                style={{ background: '#162035', border: '1px solid rgba(255,255,255,0.1)' }}
                onKeyDown={(e) => { if (e.key === 'Enter') addNewPlayer(); }}
              />
            </div>

            <div className="flex gap-3">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => { setShowAddPlayer(false); setNewPlayerName(''); }}
                className="flex-1 py-3 rounded-xl font-semibold"
                style={{ background: '#162035', color: '#8A9BBB', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                Cancel
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={addNewPlayer}
                disabled={addingPlayer || !newPlayerName.trim()}
                className="flex-1 py-3 rounded-xl font-semibold disabled:opacity-50"
                style={{ background: '#22C55E', color: '#080D18' }}
              >
                {addingPlayer ? 'Adding...' : 'Add Player'}
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
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowAddPlayer(true)}
                className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium"
                style={{
                  background: 'rgba(96,165,250,0.1)',
                  border: '1px solid rgba(96,165,250,0.3)',
                  color: '#60A5FA',
                }}
              >
                <Plus size={16} />
                Add Player
              </motion.button>
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
              {[...new Set(battingOrder)]
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

        {/* Player selection - for 1v1 mode (quick log) */}
        {gameMode === '1v1' && (
          <>
            {/* Player 1 */}
            <motion.div custom={1} variants={fadeUp} initial="hidden" animate="visible">
              <label className="text-[11px] text-[#4A5772] uppercase tracking-widest mb-2 block">
                Player 1
              </label>
              <div className="flex gap-2 flex-wrap">
                {players.map((player) => (
                  <motion.button
                    key={player.id}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setH2hPlayer1(player.id);
                      if (h2hPlayer2 === player.id) setH2hPlayer2(null);
                    }}
                    className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium"
                    style={{
                      background: h2hPlayer1 === player.id ? 'rgba(96,165,250,0.15)' : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${h2hPlayer1 === player.id ? 'rgba(96,165,250,0.3)' : 'rgba(255,255,255,0.1)'}`,
                      color: h2hPlayer1 === player.id ? '#60A5FA' : '#8A9BBB',
                    }}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
                      style={{ background: '#162035', color: '#8A9BBB' }}
                    >
                      {player.name[0]}
                    </div>
                    {player.name}
                    {h2hPlayer1 === player.id && <Check size={14} />}
                  </motion.button>
                ))}
              </div>
            </motion.div>

            {/* Player 2 */}
            <motion.div custom={2} variants={fadeUp} initial="hidden" animate="visible">
              <label className="text-[11px] text-[#4A5772] uppercase tracking-widest mb-2 block">
                Player 2
              </label>
              <div className="flex gap-2 flex-wrap">
                {players
                  .filter((p) => p.id !== h2hPlayer1)
                  .map((player) => (
                    <motion.button
                      key={player.id}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setH2hPlayer2(player.id)}
                      className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium"
                      style={{
                        background: h2hPlayer2 === player.id ? 'rgba(248,113,113,0.15)' : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${h2hPlayer2 === player.id ? 'rgba(248,113,113,0.3)' : 'rgba(255,255,255,0.1)'}`,
                        color: h2hPlayer2 === player.id ? '#F87171' : '#8A9BBB',
                      }}
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
                        style={{ background: '#162035', color: '#8A9BBB' }}
                      >
                        {player.name[0]}
                      </div>
                      {player.name}
                      {h2hPlayer2 === player.id && <Check size={14} />}
                    </motion.button>
                  ))}
              </div>
            </motion.div>

            {/* Difficulty */}
            <motion.div custom={3} variants={fadeUp} initial="hidden" animate="visible">
              <label className="text-[11px] text-[#4A5772] uppercase tracking-widest mb-2 block">
                Difficulty
              </label>
              <div className="flex gap-2 flex-wrap">
                {(['rookie', 'veteran', 'all-star', 'hall-of-fame', 'legend'] as const).map((diff) => (
                  <motion.button
                    key={diff}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setH2hDifficulty(diff)}
                    className="px-3 py-2 rounded-lg text-xs font-medium capitalize"
                    style={{
                      background: h2hDifficulty === diff ? 'rgba(240,180,41,0.15)' : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${h2hDifficulty === diff ? 'rgba(240,180,41,0.3)' : 'rgba(255,255,255,0.1)'}`,
                      color: h2hDifficulty === diff ? '#F0B429' : '#8A9BBB',
                    }}
                  >
                    {diff.replace('-', ' ')}
                  </motion.button>
                ))}
              </div>
            </motion.div>

            {/* Innings and Score */}
            <motion.div custom={4} variants={fadeUp} initial="hidden" animate="visible">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-[11px] text-[#4A5772] uppercase tracking-widest mb-2 block">
                    Innings
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={h2hInnings}
                    onChange={(e) => setH2hInnings(e.target.value)}
                    className="w-full px-3 py-3 rounded-lg text-center text-lg font-bold text-[#EFF2FF]"
                    style={{ background: '#0F1829', border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[#4A5772] uppercase tracking-widest mb-2 block">
                    {h2hPlayer1 ? players.find(p => p.id === h2hPlayer1)?.name : 'P1'} Score
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={h2hPlayer1Score}
                    onChange={(e) => setH2hPlayer1Score(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-3 rounded-lg text-center text-lg font-bold text-[#60A5FA] placeholder-[#4A5772]"
                    style={{ background: '#0F1829', border: '1px solid rgba(96,165,250,0.3)' }}
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[#4A5772] uppercase tracking-widest mb-2 block">
                    {h2hPlayer2 ? players.find(p => p.id === h2hPlayer2)?.name : 'P2'} Score
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={h2hPlayer2Score}
                    onChange={(e) => setH2hPlayer2Score(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-3 rounded-lg text-center text-lg font-bold text-[#F87171] placeholder-[#4A5772]"
                    style={{ background: '#0F1829', border: '1px solid rgba(248,113,113,0.3)' }}
                  />
                </div>
              </div>
            </motion.div>
          </>
        )}

        {/* Pitching Toggle - only for Co-Op modes */}
        {(gameMode === '2v2' || gameMode === '3v3') && selectedPlayers.length >= 2 && (
          <motion.div custom={3} variants={fadeUp} initial="hidden" animate="visible">
            <div className="flex items-center justify-between p-4 rounded-lg" style={{ background: '#0F1829', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div>
                <div className="text-sm font-semibold text-[#EFF2FF]">Track Pitching Stats</div>
                <div className="text-xs text-[#4A5772]">ERA, strikeouts, walks</div>
              </div>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setTrackPitching(!trackPitching)}
                className="w-12 h-7 rounded-full relative transition-colors"
                style={{ background: trackPitching ? '#22C55E' : '#374151' }}
              >
                <motion.div
                  className="w-5 h-5 rounded-full bg-white absolute top-1"
                  animate={{ left: trackPitching ? 26 : 4 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              </motion.button>
            </div>

            {/* Batting/Pitching First - only shows when pitching is enabled */}
            {trackPitching && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3"
              >
                <label className="text-[11px] text-[#4A5772] uppercase tracking-widest mb-2 block">
                  Starting on
                </label>
                <div className="flex gap-2">
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setBattingFirst(true)}
                    className="flex-1 py-3 px-4 rounded-lg text-sm font-semibold transition-colors"
                    style={{
                      background: battingFirst ? '#60A5FA' : 'rgba(255,255,255,0.05)',
                      color: battingFirst ? '#080D18' : '#8A9BBB',
                      border: `1px solid ${battingFirst ? '#60A5FA' : 'rgba(255,255,255,0.1)'}`,
                    }}
                  >
                    Batting First
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setBattingFirst(false)}
                    className="flex-1 py-3 px-4 rounded-lg text-sm font-semibold transition-colors"
                    style={{
                      background: !battingFirst ? '#EF4444' : 'rgba(255,255,255,0.05)',
                      color: !battingFirst ? '#FFF' : '#8A9BBB',
                      border: `1px solid ${!battingFirst ? '#EF4444' : 'rgba(255,255,255,0.1)'}`,
                    }}
                  >
                    Pitching First
                  </motion.button>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* Start Game Button */}
        <motion.div custom={4} variants={fadeUp} initial="hidden" animate="visible" className="pt-4">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleStartGame}
            disabled={!canStart || starting}
            className="w-full py-4 rounded-lg text-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ background: '#F0B429', color: '#080D18' }}
          >
            <Play size={20} />
            {starting ? (gameMode === '1v1' ? 'Logging...' : 'Starting...') : (gameMode === '1v1' ? 'Log Game' : 'Start Game')}
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
