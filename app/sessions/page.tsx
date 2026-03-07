'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Calendar, Trophy, ChevronRight, Plus } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Session, Game, Player } from '@/lib/types';

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
      className="inline-block w-2 h-2 rounded-full flex-shrink-0"
      style={{ background: result === 'W' ? '#34D399' : '#F87171' }}
    />
  );
}

// Session card
function SessionCard({
  session,
  games,
  mvpPlayer,
  index,
}: {
  session: Session;
  games: Game[];
  mvpPlayer: Player | undefined;
  index: number;
}) {
  const sessionGames = games.filter((g) => g.session_id === session.id);
  const wins = sessionGames.filter((g) => g.score?.includes('W')).length;
  const losses = sessionGames.length - wins;

  return (
    <Link href={`/sessions/${session.id}`}>
      <motion.div
        custom={index}
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        whileHover={{ x: 2 }}
        className="flex items-center gap-4 p-4 rounded-lg cursor-pointer"
        style={{ background: '#0F1829', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div className="min-w-12 text-center">
          <div className="text-lg font-bold text-[#EFF2FF]">
            {new Date(session.date).getDate()}
          </div>
          <div className="text-[10px] text-[#4A5772] uppercase">
            {new Date(session.date).toLocaleDateString('en-US', { month: 'short' })}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-[#EFF2FF] mb-1">
            {session.label || 'Game Night'}
          </div>
          <div className="flex items-center gap-1.5">
            {sessionGames.slice(0, 6).map((g, i) => (
              <ResultDot key={i} result={g.score?.includes('W') ? 'W' : 'L'} />
            ))}
            {sessionGames.length > 6 && (
              <span className="text-[10px] text-[#4A5772]">+{sessionGames.length - 6}</span>
            )}
          </div>
        </div>

        <div className="text-right">
          <div className="text-sm font-bold text-[#EFF2FF]">
            {wins}W – {losses}L
          </div>
          {mvpPlayer && (
            <div className="flex items-center gap-1 justify-end mt-0.5">
              <Trophy size={10} color="#F0B429" />
              <span className="text-[10px] text-[#F0B429]">{mvpPlayer.name}</span>
            </div>
          )}
        </div>

        <ChevronRight size={16} color="#4A5772" />
      </motion.div>
    </Link>
  );
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const [sessionsRes, gamesRes, playersRes] = await Promise.all([
        supabase.from('sessions').select('*').order('date', { ascending: false }),
        supabase.from('games').select('*'),
        supabase.from('players').select('*'),
      ]);

      setSessions(sessionsRes.data || []);
      setGames(gamesRes.data || []);
      setPlayers(playersRes.data || []);
      setLoading(false);
    }
    loadData();
  }, []);

  // Group sessions by month
  const groupedSessions = sessions.reduce((acc, session) => {
    const monthYear = new Date(session.date).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
    if (!acc[monthYear]) acc[monthYear] = [];
    acc[monthYear].push(session);
    return acc;
  }, {} as Record<string, Session[]>);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#080D18' }}>
        <div className="text-[#4A5772]">Loading...</div>
      </div>
    );
  }

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
          <h1 className="font-display font-bold text-lg text-[#EFF2FF]">SESSIONS</h1>
          <div className="text-xs text-[#4A5772]">{sessions.length} total sessions</div>
        </div>
        <Link href="/log">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold"
            style={{ background: '#F0B429', color: '#080D18' }}
          >
            <Plus size={14} />
            Log
          </motion.button>
        </Link>
      </div>

      <div className="max-w-2xl mx-auto p-5 space-y-6">
        {Object.entries(groupedSessions).map(([monthYear, monthSessions]) => (
          <div key={monthYear}>
            <div className="text-[11px] text-[#4A5772] uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <Calendar size={11} />
              {monthYear}
            </div>
            <div className="space-y-2">
              {monthSessions.map((session, i) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  games={games}
                  mvpPlayer={players.find((p) => p.id === session.mvp_player_id)}
                  index={i}
                />
              ))}
            </div>
          </div>
        ))}

        {sessions.length === 0 && (
          <div
            className="text-center py-12 rounded-lg"
            style={{ background: '#0F1829', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <Calendar size={32} color="#4A5772" className="mx-auto mb-3" />
            <div className="text-[#4A5772] text-sm">No sessions yet</div>
            <Link href="/log">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                className="mt-4 px-4 py-2 rounded-lg text-sm font-semibold"
                style={{ background: '#F0B429', color: '#080D18' }}
              >
                Log your first game
              </motion.button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
