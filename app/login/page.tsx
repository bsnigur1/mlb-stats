'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Lock, ArrowRight } from 'lucide-react';

const PASSWORD = 'SnigurField';

// Logo component
function YardLogo() {
  return (
    <div className="flex flex-col items-center gap-4">
      <svg width={48} height={48} viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="18" height="18" rx="3" transform="rotate(45 12 12)" fill="#F0B429" />
        <rect
          x="5.5"
          y="5.5"
          width="13"
          height="13"
          rx="2"
          transform="rotate(45 12 12)"
          fill="none"
          stroke="rgba(8,13,24,0.5)"
          strokeWidth="1.5"
        />
      </svg>
      <span className="font-display font-bold text-3xl tracking-widest text-[#EFF2FF]">THE YARD</span>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    setTimeout(() => {
      if (password === PASSWORD) {
        document.cookie = 'mlb-auth=authenticated; path=/; max-age=2592000';
        router.push('/');
        router.refresh();
      } else {
        setError('Wrong password');
        setLoading(false);
      }
    }, 300);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-5" style={{ background: '#080D18' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' as const }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-10">
          <YardLogo />
          <p className="text-xs text-[#4A5772] mt-3 uppercase tracking-widest">MLB The Show 25</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Lock
              size={16}
              className="absolute left-4 top-1/2 -translate-y-1/2"
              color="#4A5772"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full pl-11 pr-4 py-3.5 rounded-lg text-sm text-[#EFF2FF] placeholder-[#4A5772] focus:outline-none focus:ring-2 focus:ring-[#F0B429]/50"
              style={{
                background: '#0F1829',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
              autoFocus
            />
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-[#F87171] text-sm text-center py-2 rounded-lg"
              style={{ background: 'rgba(248,113,113,0.1)' }}
            >
              {error}
            </motion.p>
          )}

          <motion.button
            type="submit"
            disabled={!password || loading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className="w-full py-3.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-opacity disabled:opacity-50"
            style={{ background: '#F0B429', color: '#080D18' }}
          >
            {loading ? (
              'Entering...'
            ) : (
              <>
                Enter The Yard
                <ArrowRight size={16} />
              </>
            )}
          </motion.button>
        </form>

        <p className="text-[10px] text-[#4A5772] text-center mt-8 uppercase tracking-wider">
          Private stat tracker
        </p>
      </motion.div>
    </div>
  );
}
