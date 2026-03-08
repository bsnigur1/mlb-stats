'use client';

import { motion } from 'framer-motion';
import { ArrowLeft, Target, Sparkles, Zap } from 'lucide-react';
import Link from 'next/link';

// Animation variants
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.25, ease: 'easeOut' as const },
  }),
};

// Achievement data
const ACHIEVEMENTS = [
  {
    id: 'longest-hr',
    title: 'Longest Homerun',
    player: 'Bryan',
    description: 'Giancarlo Stanton',
    detail: '526 feet',
    date: 'March 6th',
    icon: Target,
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

// Achievement card
function AchievementCard({
  achievement,
  index,
}: {
  achievement: (typeof ACHIEVEMENTS)[0];
  index: number;
}) {
  const IconComponent = achievement.icon;

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
            background: `${achievement.color}15`,
            border: `1px solid ${achievement.color}30`,
          }}
        >
          <IconComponent size={24} color={achievement.color} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-lg font-bold"
              style={{ color: achievement.color }}
            >
              {achievement.title}
            </span>
          </div>

          <div className="text-xl font-bold text-[#EFF2FF] mb-2">
            {achievement.player}
          </div>

          <div className="flex items-center gap-3 text-sm">
            <span className="text-[#8A9BBB]">{achievement.description}</span>
            <span className="text-[#4A5772]">·</span>
            <span className="text-[#F0B429] font-semibold">{achievement.detail}</span>
          </div>

          <div className="text-xs text-[#4A5772] mt-2">{achievement.date}</div>
        </div>
      </div>
    </motion.div>
  );
}

export default function AwardsPage() {
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
          <h1 className="font-display font-bold text-lg text-[#EFF2FF]">ACHIEVEMENTS</h1>
          <div className="text-xs text-[#4A5772]">Memorable moments</div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-5 space-y-4">
        {ACHIEVEMENTS.map((achievement, i) => (
          <AchievementCard key={achievement.id} achievement={achievement} index={i} />
        ))}
      </div>
    </div>
  );
}
