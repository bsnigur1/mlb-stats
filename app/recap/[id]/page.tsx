'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Home, Play } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Player, Game, GamePlayer, AtBat } from '@/lib/types';
import { calculateStats, formatAvg, formatPercent } from '@/lib/stats';

// Animation variants
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.25, ease: 'easeOut' as const },
  }),
};

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
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#080D18' }}>
        <div className="text-[#4A5772]">Loading recap...</div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen flex items-center justify-center flex-col gap-4" style={{ background: '#080D18' }}>
        <p className="text-[#4A5772]">Game not found</p>
        <Link href="/" className="text-[#60A5FA] hover:underline">
          Go home
        </Link>
      </div>
    );
  }

  const playerStats = gamePlayers.map((gp) =>
    calculateStats(gp.player_id, gp.player.name, atBats)
  );

  const isWin = game.score?.startsWith('W');
  const isLoss = game.score?.startsWith('L');

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
          <h1 className="font-display font-bold text-lg text-[#EFF2FF]">GAME RECAP</h1>
          <div className="text-xs text-[#4A5772]">{game.date}</div>
        </div>
        <span
          className="px-3 py-1 rounded-full text-xs font-semibold"
          style={{
            background: game.status === 'completed' ? 'rgba(52,211,153,0.15)' : 'rgba(240,180,41,0.15)',
            color: game.status === 'completed' ? '#34D399' : '#F0B429',
            border: `1px solid ${game.status === 'completed' ? 'rgba(52,211,153,0.3)' : 'rgba(240,180,41,0.3)'}`,
          }}
        >
          {game.status === 'completed' ? 'Final' : 'In Progress'}
        </span>
      </div>

      <div className="max-w-2xl mx-auto p-5 space-y-5">
        {/* Score Card */}
        <motion.div
          custom={0}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="rounded-xl p-6 text-center"
          style={{ background: '#0F1829', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          {game.score && (
            <div
              className="text-4xl font-bold mb-2"
              style={{ color: isWin ? '#34D399' : isLoss ? '#F87171' : '#EFF2FF' }}
            >
              {game.score}
            </div>
          )}
          <div className="flex justify-center gap-8 text-center mt-4">
            <div>
              <div className="text-2xl font-bold text-[#EFF2FF]">{game.current_inning}</div>
              <div className="text-[10px] text-[#4A5772] uppercase tracking-wide">Innings</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-[#EFF2FF]">{atBats.length}</div>
              <div className="text-[10px] text-[#4A5772] uppercase tracking-wide">At Bats</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-[#F0B429]">
                {playerStats.reduce((sum, p) => sum + p.hits, 0)}
              </div>
              <div className="text-[10px] text-[#4A5772] uppercase tracking-wide">Hits</div>
            </div>
          </div>
        </motion.div>

        {/* Player Stats */}
        {playerStats.map((stats, i) => (
          <motion.div
            key={stats.player_id}
            custom={i + 1}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="rounded-xl p-5"
            style={{ background: '#0F1829', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold"
                style={{ background: '#162035', color: '#F0B429' }}
              >
                {stats.player_name[0]}
              </div>
              <h3 className="text-xl font-bold text-[#EFF2FF]">{stats.player_name}</h3>
            </div>

            <div className="grid grid-cols-4 gap-4 text-center mb-4">
              <div>
                <div className="text-2xl font-bold text-[#EFF2FF]">{stats.hits}-{stats.at_bats}</div>
                <div className="text-[10px] text-[#4A5772] uppercase tracking-wide">H-AB</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-[#EFF2FF]">{stats.rbi}</div>
                <div className="text-[10px] text-[#4A5772] uppercase tracking-wide">RBI</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-[#F0B429]">{formatAvg(stats.avg)}</div>
                <div className="text-[10px] text-[#4A5772] uppercase tracking-wide">AVG</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-[#EFF2FF]">{formatAvg(stats.ops)}</div>
                <div className="text-[10px] text-[#4A5772] uppercase tracking-wide">OPS</div>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-2 text-center text-sm">
              <div className="rounded-lg p-2" style={{ background: '#162035' }}>
                <div className="font-semibold text-[#EFF2FF]">{stats.singles}</div>
                <div className="text-[10px] text-[#4A5772]">1B</div>
              </div>
              <div className="rounded-lg p-2" style={{ background: '#162035' }}>
                <div className="font-semibold text-[#EFF2FF]">{stats.doubles}</div>
                <div className="text-[10px] text-[#4A5772]">2B</div>
              </div>
              <div className="rounded-lg p-2" style={{ background: '#162035' }}>
                <div className="font-semibold text-[#EFF2FF]">{stats.triples}</div>
                <div className="text-[10px] text-[#4A5772]">3B</div>
              </div>
              <div className="rounded-lg p-2" style={{ background: '#162035' }}>
                <div className="font-semibold text-[#F97316]">{stats.homeruns}</div>
                <div className="text-[10px] text-[#4A5772]">HR</div>
              </div>
              <div className="rounded-lg p-2" style={{ background: '#162035' }}>
                <div className="font-semibold text-[#EF4444]">{stats.strikeouts}</div>
                <div className="text-[10px] text-[#4A5772]">K</div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
              <div className="text-[#8A9BBB]">
                OBP: <span className="text-[#EFF2FF] font-medium">{formatAvg(stats.obp)}</span>
              </div>
              <div className="text-[#8A9BBB]">
                SLG: <span className="text-[#EFF2FF] font-medium">{formatAvg(stats.slg)}</span>
              </div>
              <div className="text-[#8A9BBB]">
                K%: <span className="text-[#EFF2FF] font-medium">{formatPercent(stats.k_percent)}</span>
              </div>
            </div>
          </motion.div>
        ))}

        {/* Actions */}
        <motion.div
          custom={playerStats.length + 1}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="flex gap-3 pt-4"
        >
          <Link href="/log" className="flex-1">
            <motion.button
              whileTap={{ scale: 0.97 }}
              className="w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2"
              style={{ background: '#162035', color: '#8A9BBB', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <Play size={16} />
              New Game
            </motion.button>
          </Link>
          <Link href="/" className="flex-1">
            <motion.button
              whileTap={{ scale: 0.97 }}
              className="w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2"
              style={{ background: '#60A5FA', color: '#080D18' }}
            >
              <Home size={16} />
              Dashboard
            </motion.button>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
