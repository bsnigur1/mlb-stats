'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Target, Sparkles, Zap, Trophy } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Award, Player } from '@/lib/types';

// Animation variants
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.25, ease: 'easeOut' as const },
  }),
};

// Memorable moments (hardcoded special achievements)
const MEMORABLE_MOMENTS = [
  {
    id: 'back-to-back-hrs',
    title: 'Back-to-Back-to-Back-to-Back-to-Back HRs',
    player: 'Bryan & Greg',
    description: '5 consecutive homers',
    detail: '',
    date: 'March 15, 2026',
    icon: Zap,
    color: '#F0B429',
  },
  {
    id: '7-hr-game',
    title: '7 Homerun Game',
    player: 'Greg',
    description: 'Single game record',
    detail: '7 HRs',
    date: 'March 15, 2026',
    icon: Target,
    color: '#EF4444',
  },
  {
    id: '526-ft-hr',
    title: '526 Foot Homerun',
    player: 'Bryan',
    description: 'Using Stanton',
    detail: 'Longest HR',
    date: 'March 6, 2026',
    icon: Zap,
    color: '#F97316',
  },
  {
    id: 'perfect-game',
    title: 'Perfect Game',
    player: 'Greg & Bryan',
    description: 'Tarik Skubal',
    detail: '27 up, 27 down',
    date: 'July 2025',
    icon: Sparkles,
    color: '#A855F7',
  },
  {
    id: 'immaculate-inning',
    title: 'Immaculate Inning',
    player: 'Greg',
    description: '9 pitches, 9 strikes',
    detail: '3 strikeouts',
    date: 'March 7, 2026',
    icon: Zap,
    color: '#22C55E',
  },
];

// Memorable moment card
function MomentCard({
  moment,
  index,
}: {
  moment: (typeof MEMORABLE_MOMENTS)[0];
  index: number;
}) {
  const IconComponent = moment.icon;

  return (
    <motion.div
      custom={index}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="rounded-xl p-5"
      style={{
        background: '#0F1829',
        border: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      <div className="flex items-start gap-4">
        <div
          className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{
            background: `${moment.color}15`,
            border: `1px solid ${moment.color}30`,
          }}
        >
          <IconComponent size={24} color={moment.color} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-lg font-bold"
              style={{ color: moment.color }}
            >
              {moment.title}
            </span>
          </div>

          <div className="text-xl font-bold text-[#EFF2FF] mb-2">
            {moment.player}
          </div>

          <div className="flex items-center gap-3 text-sm">
            <span className="text-[#8A9BBB]">{moment.description}</span>
            {moment.detail && (
              <>
                <span className="text-[#4A5772]">·</span>
                <span className="text-[#F0B429] font-semibold">{moment.detail}</span>
              </>
            )}
          </div>

          <div className="text-xs text-[#4A5772] mt-2">{moment.date}</div>
        </div>
      </div>
    </motion.div>
  );
}

// Season award card
function SeasonAwardCard({
  award,
  player,
  index,
}: {
  award: Award;
  player: Player | undefined;
  index: number;
}) {
  return (
    <motion.div
      custom={index}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="rounded-xl p-5"
      style={{
        background: '#0F1829',
        border: '1px solid rgba(240,180,41,0.2)',
        boxShadow: '0 0 20px rgba(240,180,41,0.05)',
      }}
    >
      <div className="flex items-center gap-4">
        <div
          className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{
            background: 'rgba(240,180,41,0.15)',
            border: '1px solid rgba(240,180,41,0.3)',
          }}
        >
          <Trophy size={24} color="#F0B429" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-lg font-bold text-[#F0B429] mb-1">
            {award.label}
          </div>
          <div className="text-xl font-bold text-[#EFF2FF]">
            {player?.name || 'Unknown'}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function AwardsPage() {
  const [awards, setAwards] = useState<Award[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const [awardsRes, playersRes] = await Promise.all([
        supabase.from('awards').select('*').order('date', { ascending: false }),
        supabase.from('players').select('*'),
      ]);
      setAwards(awardsRes.data || []);
      setPlayers(playersRes.data || []);
      setLoading(false);
    }
    loadData();
  }, []);

  const getPlayer = (playerId: string) => players.find(p => p.id === playerId);

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
          <h1 className="font-display font-bold text-lg text-[#EFF2FF]">AWARDS</h1>
          <div className="text-xs text-[#4A5772]">Season awards & memorable moments</div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-5 space-y-6">
        {/* Season Awards */}
        {awards.length > 0 && (
          <div>
            <div className="text-[11px] text-[#4A5772] uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <Trophy size={11} color="#F0B429" />
              Season Awards
            </div>
            <div className="space-y-3">
              {awards.map((award, i) => (
                <SeasonAwardCard
                  key={award.id}
                  award={award}
                  player={getPlayer(award.player_id)}
                  index={i}
                />
              ))}
            </div>
          </div>
        )}

        {/* Memorable Moments */}
        <div>
          <div className="text-[11px] text-[#4A5772] uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <Sparkles size={11} color="#A855F7" />
            Memorable Moments
          </div>
          <div className="space-y-3">
            {MEMORABLE_MOMENTS.map((moment, i) => (
              <MomentCard key={moment.id} moment={moment} index={i + awards.length} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
