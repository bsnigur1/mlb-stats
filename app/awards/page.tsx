'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Trophy, Star, Zap, TrendingUp, Award as AwardIcon } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Player, Award as AwardType } from '@/lib/types';

// Animation variants
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.25, ease: 'easeOut' as const },
  }),
};

// Award type tabs
const AWARD_TABS = [
  { id: 'all', label: 'All', icon: Trophy },
  { id: 'MVP_GAME', label: 'Game MVP', icon: Star },
  { id: 'MVP_SESSION', label: 'Session MVP', icon: AwardIcon },
  { id: 'HOT_STREAK', label: 'Hot Streak', icon: Zap },
  { id: 'SEASON_HIGH', label: 'Season High', icon: TrendingUp },
];

// Award card
function AwardCard({
  award,
  player,
  index,
}: {
  award: AwardType;
  player: Player | undefined;
  index: number;
}) {
  const getAwardIcon = () => {
    switch (award.type) {
      case 'MVP_GAME':
        return <Star size={16} fill="#F0B429" color="#F0B429" />;
      case 'MVP_SESSION':
        return <AwardIcon size={16} color="#F0B429" />;
      case 'HOT_STREAK':
        return <Zap size={16} fill="#F0B429" color="#F0B429" />;
      case 'SEASON_HIGH':
        return <TrendingUp size={16} color="#34D399" />;
      default:
        return <Trophy size={16} color="#F0B429" />;
    }
  };

  const getAwardBg = () => {
    switch (award.type) {
      case 'SEASON_HIGH':
        return { bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.2)' };
      default:
        return { bg: 'rgba(240,180,41,0.08)', border: 'rgba(240,180,41,0.2)' };
    }
  };

  const colors = getAwardBg();

  return (
    <motion.div
      custom={index}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="flex items-center gap-4 p-4 rounded-lg"
      style={{ background: '#0F1829', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: colors.bg, border: `1px solid ${colors.border}` }}
      >
        {getAwardIcon()}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-semibold text-[#EFF2FF]">
            {award.label || award.type.replace(/_/g, ' ')}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#4A5772]">
          {player && (
            <Link href={`/players/${player.id}`}>
              <span className="text-[#60A5FA] hover:underline">{player.name}</span>
            </Link>
          )}
          <span>·</span>
          <span>
            {new Date(award.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// Player leaderboard card
function LeaderboardCard({
  player,
  count,
  rank,
  index,
}: {
  player: Player;
  count: number;
  rank: number;
  index: number;
}) {
  return (
    <motion.div
      custom={index}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="flex items-center gap-3 p-4 rounded-lg"
      style={{
        background: '#0F1829',
        border: `1px solid ${rank === 1 ? 'rgba(240,180,41,0.2)' : 'rgba(255,255,255,0.07)'}`,
        boxShadow: rank === 1 ? '0 0 16px rgba(240,180,41,0.08)' : 'none',
      }}
    >
      <span
        className="text-lg font-bold w-8 text-center"
        style={{ color: rank === 1 ? '#F0B429' : rank === 2 ? '#C0C0C0' : rank === 3 ? '#CD7F32' : '#4A5772' }}
      >
        {rank}
      </span>

      <Link href={`/players/${player.id}`} className="flex items-center gap-3 flex-1">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold"
          style={{ background: rank === 1 ? 'rgba(240,180,41,0.15)' : '#162035', color: rank === 1 ? '#F0B429' : '#8A9BBB' }}
        >
          {player.name[0]}
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-[#EFF2FF]">{player.name}</div>
          {player.handle && <div className="text-xs text-[#4A5772]">{player.handle}</div>}
        </div>
      </Link>

      <div className="text-right">
        <div className="text-2xl font-bold text-[#F0B429] tabular-nums">{count}</div>
        <div className="text-[10px] text-[#4A5772] uppercase tracking-wide">awards</div>
      </div>
    </motion.div>
  );
}

export default function AwardsPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [awards, setAwards] = useState<AwardType[]>([]);
  const [activeTab, setActiveTab] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const [playersRes, awardsRes] = await Promise.all([
        supabase.from('players').select('*'),
        supabase.from('awards').select('*').order('date', { ascending: false }),
      ]);

      setPlayers(playersRes.data || []);
      setAwards(awardsRes.data || []);
      setLoading(false);
    }
    loadData();
  }, []);

  // Filter awards by type
  const filteredAwards = activeTab === 'all' ? awards : awards.filter((a) => a.type === activeTab);

  // Calculate leaderboard
  const leaderboard = players
    .map((player) => ({
      player,
      count: awards.filter((a) => a.player_id === player.id).length,
    }))
    .sort((a, b) => b.count - a.count);

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
          <div className="text-xs text-[#4A5772]">{awards.length} total awards</div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-5 space-y-6">
        {/* Leaderboard */}
        <motion.div custom={0} variants={fadeUp} initial="hidden" animate="visible">
          <div className="text-[11px] text-[#4A5772] uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <Trophy size={11} color="#F0B429" />
            Award Leaders
          </div>
          <div className="space-y-2">
            {leaderboard.map((item, i) => (
              <LeaderboardCard
                key={item.player.id}
                player={item.player}
                count={item.count}
                rank={i + 1}
                index={i}
              />
            ))}
          </div>
        </motion.div>

        {/* Tabs */}
        <motion.div
          custom={1}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="flex gap-2 overflow-x-auto pb-2 -mx-5 px-5"
        >
          {AWARD_TABS.map((tab) => (
            <motion.button
              key={tab.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold whitespace-nowrap"
              style={{
                background: activeTab === tab.id ? 'rgba(240,180,41,0.15)' : 'rgba(255,255,255,0.05)',
                color: activeTab === tab.id ? '#F0B429' : '#8A9BBB',
                border: `1px solid ${activeTab === tab.id ? 'rgba(240,180,41,0.3)' : 'rgba(255,255,255,0.1)'}`,
              }}
            >
              <tab.icon size={12} />
              {tab.label}
            </motion.button>
          ))}
        </motion.div>

        {/* Awards list */}
        <div className="space-y-2">
          {filteredAwards.length > 0 ? (
            filteredAwards.map((award, i) => (
              <AwardCard
                key={award.id}
                award={award}
                player={players.find((p) => p.id === award.player_id)}
                index={i + 2}
              />
            ))
          ) : (
            <div
              className="text-center py-12 rounded-lg"
              style={{ background: '#0F1829', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <Trophy size={32} color="#4A5772" className="mx-auto mb-3" />
              <div className="text-[#4A5772] text-sm">No awards yet</div>
              <div className="text-xs text-[#4A5772] mt-1">Start logging games to earn awards!</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
