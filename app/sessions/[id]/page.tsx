'use client';

import { useState, useEffect, use } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Trophy, Calendar, Users, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Session, Game, Player, AtBat, GamePlayer } from '@/lib/types';

// Animation variants
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.25, ease: 'easeOut' as const },
  }),
};

// Result dot
function ResultDot({ result }: { result: 'W' | 'L' }) {
  return (
    <span
      className="inline-block w-3 h-3 rounded-full flex-shrink-0"
      style={{ background: result === 'W' ? '#34D399' : '#F87171' }}
    />
  );
}

// Type badge for game modes
function TypeBadge({ type }: { type: string }) {
  const config = {
    '2v2': { bg: 'rgba(96,165,250,0.1)', color: '#60A5FA', border: 'rgba(96,165,250,0.2)', label: '2v2' },
    '3v3': { bg: 'rgba(52,211,153,0.1)', color: '#34D399', border: 'rgba(52,211,153,0.2)', label: '3v3' },
    '1v1': { bg: 'rgba(240,180,41,0.1)', color: '#F0B429', border: 'rgba(240,180,41,0.2)', label: 'H2H' },
  }[type] || { bg: 'rgba(96,165,250,0.1)', color: '#60A5FA', border: 'rgba(96,165,250,0.2)', label: type };

  return (
    <span
      className="px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide"
      style={{
        background: config.bg,
        color: config.color,
        border: `1px solid ${config.border}`,
      }}
    >
      {config.label}
    </span>
  );
}

// Player stat line
function PlayerStatLine({
  player,
  stats,
}: {
  player: Player;
  stats: { ab: number; h: number; hr: number; rbi: number; bb: number; k: number };
}) {
  const avg = stats.ab > 0 ? stats.h / stats.ab : 0;

  return (
    <div className="flex items-center gap-3 py-2">
      <div
        className="w-7 h-7 rounded flex items-center justify-center text-xs font-bold flex-shrink-0"
        style={{ background: '#162035', color: '#8A9BBB' }}
      >
        {player.name[0]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-[#EFF2FF]">{player.name}</div>
      </div>
      <div className="flex items-center gap-4 text-xs tabular-nums">
        <div className="text-center w-8">
          <div className="text-[#EFF2FF] font-medium">{stats.ab}</div>
          <div className="text-[#4A5772] text-[9px]">AB</div>
        </div>
        <div className="text-center w-8">
          <div className="text-[#EFF2FF] font-medium">{stats.h}</div>
          <div className="text-[#4A5772] text-[9px]">H</div>
        </div>
        <div className="text-center w-8">
          <div className="text-[#EFF2FF] font-medium">{stats.hr}</div>
          <div className="text-[#4A5772] text-[9px]">HR</div>
        </div>
        <div className="text-center w-8">
          <div className="text-[#EFF2FF] font-medium">{stats.rbi}</div>
          <div className="text-[#4A5772] text-[9px]">RBI</div>
        </div>
        <div className="text-center w-12">
          <div className="text-[#F0B429] font-bold">.{String(Math.round(avg * 1000)).padStart(3, '0')}</div>
          <div className="text-[#4A5772] text-[9px]">AVG</div>
        </div>
      </div>
    </div>
  );
}

// Game card
function GameCard({
  game,
  players,
  atBats,
  index,
}: {
  game: Game & { game_players: (GamePlayer & { player: Player })[] };
  players: Player[];
  atBats: AtBat[];
  index: number;
}) {
  const result = game.score?.includes('W') ? 'W' : 'L';
  const gameAtBats = atBats.filter((ab) => ab.game_id === game.id);
  const gamePlayers = game.game_players || [];

  // Calculate stats per player
  const playerStats = gamePlayers.map((gp) => {
    const playerAtBats = gameAtBats.filter((ab) => ab.player_id === gp.player_id);
    const singles = playerAtBats.filter((ab) => ab.result === 'single').length;
    const doubles = playerAtBats.filter((ab) => ab.result === 'double').length;
    const triples = playerAtBats.filter((ab) => ab.result === 'triple').length;
    const homeruns = playerAtBats.filter((ab) => ab.result === 'homerun').length;
    const walks = playerAtBats.filter((ab) => ab.result === 'walk').length;
    const strikeouts = playerAtBats.filter((ab) => ab.result === 'strikeout').length;
    const outs = playerAtBats.filter((ab) => ab.result === 'out').length;
    const rbi = playerAtBats.reduce((sum, ab) => sum + (ab.rbi || 0), 0);

    const hits = singles + doubles + triples + homeruns;
    const ab = hits + strikeouts + outs;

    return {
      player: gp.player || players.find((p) => p.id === gp.player_id),
      stats: { ab, h: hits, hr: homeruns, rbi, bb: walks, k: strikeouts },
    };
  });

  return (
    <motion.div
      custom={index}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="relative"
    >
      {/* Timeline connector */}
      <div
        className="absolute left-[15px] top-0 bottom-0 w-0.5"
        style={{ background: 'rgba(255,255,255,0.07)' }}
      />

      <div className="flex gap-4">
        {/* Timeline dot */}
        <div className="relative z-10 mt-4">
          <ResultDot result={result as 'W' | 'L'} />
        </div>

        {/* Game content */}
        <div
          className="flex-1 rounded-lg p-4 mb-4"
          style={{ background: '#0F1829', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="text-lg font-bold"
                  style={{ color: result === 'W' ? '#34D399' : '#F87171' }}
                >
                  {game.score || `${result} 0-0`}
                </span>
                <TypeBadge type={game.game_mode} />
              </div>
              <div className="text-xs text-[#4A5772]">vs {game.opponent || 'Unknown'}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-[#4A5772]">{game.innings} innings</div>
              {game.mvp_player_id && (
                <div className="flex items-center gap-1 mt-1 text-xs text-[#F0B429]">
                  <Trophy size={10} />
                  MVP
                </div>
              )}
            </div>
          </div>

          {/* Player stats */}
          <div className="border-t border-white/5 pt-3">
            {playerStats.map((ps) =>
              ps.player ? (
                <PlayerStatLine key={ps.player.id} player={ps.player} stats={ps.stats} />
              ) : null
            )}
          </div>

          {/* View game link */}
          <Link href={`/game/${game.id}`}>
            <motion.div
              whileHover={{ x: 2 }}
              className="flex items-center gap-1 mt-3 text-xs text-[#60A5FA] font-medium"
            >
              View full game <ChevronRight size={12} />
            </motion.div>
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

export default function SessionLog({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [session, setSession] = useState<Session | null>(null);
  const [games, setGames] = useState<(Game & { game_players: (GamePlayer & { player: Player })[] })[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [atBats, setAtBats] = useState<AtBat[]>([]);
  const [mvpPlayer, setMvpPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const [sessionRes, gamesRes, playersRes, atBatsRes] = await Promise.all([
        supabase.from('sessions').select('*').eq('id', id).single(),
        supabase
          .from('games')
          .select('*, game_players(*, player:players(*))')
          .eq('session_id', id)
          .order('created_at', { ascending: true }),
        supabase.from('players').select('*'),
        supabase.from('at_bats').select('*'),
      ]);

      const sessionData = sessionRes.data;
      setSession(sessionData);
      setGames(gamesRes.data || []);
      setPlayers(playersRes.data || []);
      setAtBats(atBatsRes.data || []);

      // Get MVP player if set
      if (sessionData?.mvp_player_id) {
        const mvp = playersRes.data?.find((p) => p.id === sessionData.mvp_player_id);
        setMvpPlayer(mvp || null);
      }

      setLoading(false);
    }
    loadData();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#080D18' }}>
        <div className="text-[#4A5772]">Loading...</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#080D18' }}>
        <div className="text-[#4A5772]">Session not found</div>
      </div>
    );
  }

  const wins = games.filter((g) => g.score?.includes('W')).length;
  const losses = games.length - wins;
  const formattedDate = new Date(session.date).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="min-h-screen pb-24" style={{ background: '#080D18' }}>
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
          <h1 className="font-display font-bold text-lg text-[#EFF2FF]">
            {session.label || 'GAME NIGHT'}
          </h1>
          <div className="text-xs text-[#4A5772]">{formattedDate}</div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-5 space-y-6">
        {/* Session summary */}
        <motion.div
          custom={0}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="rounded-lg p-5 pinstripe"
          style={{ background: '#0F1829', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-[11px] text-[#4A5772] uppercase tracking-widest">
              <Calendar size={11} />
              Session Summary
            </div>
            <div className="flex items-center gap-2">
              <Users size={12} color="#4A5772" />
              <span className="text-xs text-[#4A5772]">{games.length} games</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="font-display font-bold text-4xl text-[#EFF2FF]">
                {wins}W – {losses}L
              </div>
              <div className="text-xs text-[#4A5772] mt-1">
                {wins > losses ? 'Winning session' : wins < losses ? 'Tough session' : 'Split session'}
              </div>
            </div>

            {mvpPlayer && (
              <div
                className="flex items-center gap-3 px-4 py-3 rounded-lg"
                style={{ background: 'rgba(240,180,41,0.08)', border: '1px solid rgba(240,180,41,0.2)' }}
              >
                <Trophy size={16} color="#F0B429" />
                <div>
                  <div className="text-[10px] text-[#F0B429] uppercase tracking-wide">Session MVP</div>
                  <div className="text-sm font-semibold text-[#EFF2FF]">{mvpPlayer.name}</div>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Games timeline */}
        <div>
          <div className="text-[11px] text-[#4A5772] uppercase tracking-widest mb-4">Games</div>
          {games.map((game, i) => (
            <GameCard key={game.id} game={game} players={players} atBats={atBats} index={i + 1} />
          ))}
          {games.length === 0 && (
            <div
              className="text-center py-8 rounded-lg"
              style={{ background: '#0F1829', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <div className="text-[#4A5772] text-sm">No games in this session yet</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
