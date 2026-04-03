'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Pencil, Lock, X } from 'lucide-react';
import Link from 'next/link';

const EDIT_MODE_KEY = 'theyard_edit_mode';
const EDIT_PASSWORD = 'bryan';

export default function SettingsPage() {
  const [editModeEnabled, setEditModeEnabled] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState(false);

  useEffect(() => {
    // Load edit mode state from localStorage
    const stored = localStorage.getItem(EDIT_MODE_KEY);
    setEditModeEnabled(stored === 'true');
  }, []);

  const handleToggle = () => {
    if (editModeEnabled) {
      // Turning off - no password needed
      localStorage.setItem(EDIT_MODE_KEY, 'false');
      setEditModeEnabled(false);
    } else {
      // Turning on - show password prompt
      setShowPasswordModal(true);
      setPassword('');
      setPasswordError(false);
    }
  };

  const handlePasswordSubmit = () => {
    if (password === EDIT_PASSWORD) {
      localStorage.setItem(EDIT_MODE_KEY, 'true');
      setEditModeEnabled(true);
      setShowPasswordModal(false);
      setPassword('');
      setPasswordError(false);
    } else {
      setPasswordError(true);
    }
  };

  return (
    <div className="min-h-screen pb-24" style={{ background: '#080D18' }}>
      {/* Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-5" style={{ background: 'rgba(0,0,0,0.8)' }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm rounded-xl p-5"
            style={{ background: '#0F1829', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: 'rgba(240,180,41,0.15)' }}
                >
                  <Lock size={20} color="#F0B429" />
                </div>
                <h2 className="text-lg font-bold text-[#EFF2FF]">Enter Password</h2>
              </div>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setShowPasswordModal(false)}
                className="p-1"
              >
                <X size={20} color="#8A9BBB" />
              </motion.button>
            </div>

            <p className="text-sm text-[#8A9BBB] mb-4">
              Edit mode allows you to modify completed games. Enter the password to enable.
            </p>

            <div className="mb-4">
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setPasswordError(false);
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') handlePasswordSubmit(); }}
                placeholder="Password"
                autoFocus
                className="w-full px-4 py-3 rounded-lg text-[#EFF2FF] placeholder-[#4A5772]"
                style={{
                  background: '#162035',
                  border: `1px solid ${passwordError ? '#EF4444' : 'rgba(255,255,255,0.1)'}`,
                }}
              />
              {passwordError && (
                <p className="text-xs text-[#EF4444] mt-2">Incorrect password</p>
              )}
            </div>

            <div className="flex gap-3">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => setShowPasswordModal(false)}
                className="flex-1 py-3 rounded-xl font-semibold"
                style={{ background: '#162035', color: '#8A9BBB', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                Cancel
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handlePasswordSubmit}
                className="flex-1 py-3 rounded-xl font-semibold"
                style={{ background: '#F0B429', color: '#080D18' }}
              >
                Unlock
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
          <h1 className="font-display font-bold text-lg text-[#EFF2FF]">SETTINGS</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-5 space-y-4">
        {/* Edit Mode Toggle */}
        <div
          className="rounded-xl p-4"
          style={{ background: '#0F1829', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ background: editModeEnabled ? 'rgba(240,180,41,0.15)' : 'rgba(255,255,255,0.05)' }}
              >
                <Pencil size={18} color={editModeEnabled ? '#F0B429' : '#4A5772'} />
              </div>
              <div>
                <div className="text-sm font-semibold text-[#EFF2FF]">Edit Mode</div>
                <div className="text-xs text-[#4A5772]">
                  {editModeEnabled ? 'You can edit completed games' : 'Edit button is hidden'}
                </div>
              </div>
            </div>

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleToggle}
              className="w-14 h-8 rounded-full relative transition-colors"
              style={{ background: editModeEnabled ? '#F0B429' : '#374151' }}
            >
              <motion.div
                className="w-6 h-6 rounded-full bg-white absolute top-1"
                animate={{ left: editModeEnabled ? 30 : 4 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            </motion.button>
          </div>
        </div>

        {/* Status indicator */}
        {editModeEnabled && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg p-3 flex items-center gap-2"
            style={{ background: 'rgba(240,180,41,0.1)', border: '1px solid rgba(240,180,41,0.2)' }}
          >
            <Lock size={14} color="#F0B429" />
            <span className="text-xs text-[#F0B429]">
              Edit mode is ON. The Edit Game button is visible on recap pages.
            </span>
          </motion.div>
        )}
      </div>
    </div>
  );
}
