import React, { useState, useEffect } from 'react';
import { Sun, Moon, Monitor, Check } from 'lucide-react';
import { getUserProfile, updateUserProfile, getUserUsage } from '../api';

interface SettingsPageProps {
  onClose: () => void;
}

const WORK_OPTIONS = [
  '', 'Software Engineering', 'Product Management', 'Data Science',
  'Marketing', 'Design', 'Research', 'Education', 'Finance',
  'Legal', 'Healthcare', 'Other',
];

type Tab = 'general' | 'usage';

const SettingsPage = ({ onClose }: SettingsPageProps) => {
  const [tab, setTab] = useState<Tab>('general');
  const [profile, setProfile] = useState<any>(null);
  const [usage, setUsage] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // Form state
  const [fullName, setFullName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [workFunction, setWorkFunction] = useState('');
  const [personalPreferences, setPersonalPreferences] = useState('');
  const [theme, setTheme] = useState('light');
  const [chatFont, setChatFont] = useState('default');

  useEffect(() => {
    getUserProfile().then(data => {
      setProfile(data);
      setFullName(data.full_name || '');
      setDisplayName(data.display_name || '');
      setWorkFunction(data.work_function || '');
      setPersonalPreferences(data.personal_preferences || '');
      setTheme(data.theme || 'light');
      setChatFont(data.chat_font || 'default');
    }).catch(() => { });
    getUserUsage().then(setUsage).catch(() => { });
  }, []);

  const handleSave = async (silent = false) => {
    if (!silent) {
      setSaving(true);
      setSaveMsg('');
    }
    try {
      const data = await updateUserProfile({
        full_name: fullName,
        display_name: displayName,
        work_function: workFunction,
        personal_preferences: personalPreferences,
        theme,
        chat_font: chatFont,
      });
      setProfile(data);
      // Update localStorage user
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        localStorage.setItem('user', JSON.stringify({ ...user, ...data }));
      }
      if (!silent) {
        setSaveMsg('Saved');
        setTimeout(() => setSaveMsg(''), 2000);
      }
    } catch (err: any) {
      if (!silent) setSaveMsg(err.message || 'Failed');
    } finally {
      if (!silent) setSaving(false);
    }
  };

  // Auto-save on blur or selection
  const handleAutoSave = () => {
    // Optional: implement auto-save debounce if needed, currently manual save button is also fine
    // The screenshot shows a clean interface, maybe we can auto-save
    // But for now, let's keep the explicit save button as it's safer for "no new function" logic, 
    // or just match the UI. Official Claude settings mostly auto-save or have small confirms.
    // I'll keep the Save button for Profile but make Theme instant.
  };

  const applyTheme = (t: string) => {
    setTheme(t);
    if (t === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else if (t === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
    }
    localStorage.setItem('theme', t);
    // Auto-save theme
    updateUserProfile({ theme: t }).catch(() => { });
  };

  const applyFont = (f: string) => {
    setChatFont(f);
    document.documentElement.setAttribute('data-chat-font', f);
    localStorage.setItem('chat_font', f);
    updateUserProfile({ chat_font: f }).catch(() => { });
  };

  const initials = (fullName || profile?.nickname || 'U').charAt(0).toUpperCase();

  return (
    <div className="flex-1 flex h-full overflow-hidden bg-claude-bg text-[#393939]">
      {/* Left Sidebar Navigation */}
      <div className="w-[200px] flex-shrink-0 pt-16 pl-4 flex flex-col gap-1">
        <h2 className="font-serif-claude text-[22px] text-[#222] px-3 mb-6">Settings</h2>

        <button
          onClick={() => setTab('general')}
          className={`text-left px-3 py-1.5 rounded-md text-[14px] font-medium transition-colors ${tab === 'general' ? 'bg-[#EAE8E3] text-[#222]' : 'text-[#5E5E5E] hover:bg-[#EAE8E3]/50'
            }`}
        >
          General
        </button>
        <button
          onClick={() => setTab('usage')}
          className={`text-left px-3 py-1.5 rounded-md text-[14px] font-medium transition-colors ${tab === 'usage' ? 'bg-[#EAE8E3] text-[#222]' : 'text-[#5E5E5E] hover:bg-[#EAE8E3]/50'
            }`}
        >
          Usage
        </button>
      </div>

      {/* Right Content Area */}
      <div className="flex-1 overflow-y-auto min-w-0">
        <div className="max-w-[640px] pt-16 pl-12 pb-32">
          {tab === 'general' && renderGeneral()}
          {tab === 'usage' && renderUsage()}
        </div>
      </div>
    </div>
  );

  function renderGeneral() {
    return (
      <div className="space-y-10 animate-fade-in">
        {/* Profile Section */}
        <section>
          <h3 className="text-[16px] font-semibold text-[#222] mb-5">Profile</h3>

          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="w-12 h-12 rounded-full bg-[#D97757] text-white flex items-center justify-center text-[18px] font-medium flex-shrink-0">
                {initials}
              </div>
              <div className="flex-1">
                <label className="block text-[13px] font-medium text-[#5E5E5E] mb-1.5">Full name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#D1D1D1] rounded-md text-[14px] text-[#222] focus:outline-none focus:border-[#D97757] focus:ring-1 focus:ring-[#D97757] transition-all"
                  placeholder="Your full name"
                />
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[#5E5E5E] mb-1.5">What should Claude call you?</label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#D1D1D1] rounded-md text-[14px] text-[#222] focus:outline-none focus:border-[#D97757] focus:ring-1 focus:ring-[#D97757] transition-all"
                placeholder="e.g. your first name or nickname"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[#5E5E5E] mb-1.5">What best describes your work?</label>
              <div className="relative">
                <select
                  value={workFunction}
                  onChange={e => setWorkFunction(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#D1D1D1] rounded-md text-[14px] text-[#222] focus:outline-none focus:border-[#D97757] focus:ring-1 focus:ring-[#D97757] appearance-none transition-all"
                >
                  <option value="">Select your work function</option>
                  {WORK_OPTIONS.filter(Boolean).map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#666]">
                  <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[#5E5E5E] mb-1.5">
                What personal preferences should Claude consider in responses?
              </label>
              <textarea
                value={personalPreferences}
                onChange={e => setPersonalPreferences(e.target.value)}
                maxLength={2000}
                rows={4}
                className="w-full px-3 py-2 bg-white border border-[#D1D1D1] rounded-md text-[14px] text-[#222] focus:outline-none focus:border-[#D97757] focus:ring-1 focus:ring-[#D97757] resize-none transition-all"
                placeholder="e.g. when learning new concepts, I find analogies particularly helpful"
              />
              <div className="text-[12px] text-[#999] text-right mt-1.5">{personalPreferences.length}/2000</div>
            </div>

            {/* Save Button */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleSave()}
                disabled={saving}
                className="px-4 py-2 bg-[#D97757] hover:bg-[#c4694a] text-white text-[13px] font-medium rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              {saveMsg && (
                <span className="text-[13px] text-[#4B9C68] flex items-center gap-1 animate-fade-in">
                  <Check size={14} /> {saveMsg}
                </span>
              )}
            </div>
          </div>
        </section>

        <hr className="border-[#E0DFDC]" />

        {/* Appearance Section */}
        <section>
          <h3 className="text-[16px] font-semibold text-[#222] mb-5">Appearance</h3>

          <div className="space-y-6">
            <div>
              <label className="block text-[13px] font-medium text-[#5E5E5E] mb-2">Color mode</label>
              <div className="flex gap-3">
                {([
                  { value: 'light', label: 'Light', icon: <Sun size={20} /> },
                  { value: 'auto', label: 'Auto', icon: <Monitor size={20} /> },
                  { value: 'dark', label: 'Dark', icon: <Moon size={20} /> },
                ] as const).map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => applyTheme(opt.value)}
                    className={`
                      w-32 flex flex-col items-center gap-2 py-3 px-2 rounded-xl border transition-all
                      ${theme === opt.value
                        ? 'border-[#D97757] bg-white ring-1 ring-[#D97757] text-[#D97757]'
                        : 'border-[#E0DFDC] bg-white hover:border-[#CCC] text-[#5E5E5E] hover:text-[#222]'
                      }
                    `}
                  >
                    <span className={theme === opt.value ? 'text-[#D97757]' : 'text-current'}>{opt.icon}</span>
                    <span className={`text-[13px] ${theme === opt.value ? 'font-medium' : ''}`}>
                      {opt.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Chat Font - kept for feature parity even if not in screenshot */}
            <div>
              <label className="block text-[13px] font-medium text-[#5E5E5E] mb-2">Chat font</label>
              <div className="flex gap-3">
                {([
                  { value: 'default', label: 'Default', sample: 'Aa' },
                  { value: 'dyslexic', label: 'Dyslexic', sample: 'Aa' },
                ] as const).map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => applyFont(opt.value)}
                    className={`
                      w-32 flex flex-col items-center gap-2 py-3 px-2 rounded-xl border transition-all
                      ${chatFont === opt.value
                        ? 'border-[#D97757] bg-white ring-1 ring-[#D97757] text-[#D97757]'
                        : 'border-[#E0DFDC] bg-white hover:border-[#CCC] text-[#5E5E5E] hover:text-[#222]'
                      }
                    `}
                  >
                    <span className={`text-[20px] leading-none mb-1 ${opt.value === 'dyslexic' ? 'font-serif' : 'font-sans'
                      }`}>
                      {opt.sample}
                    </span>
                    <span className={`text-[13px] ${chatFont === opt.value ? 'font-medium' : ''}`}>
                      {opt.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  function renderUsage() {
    if (!usage) {
      return <div className="text-[14px] text-[#999] py-8">Loading usage data...</div>;
    }

    const tokenQuota = Number(usage.token_quota) || 0;
    const tokenUsed = Number(usage.token_used) || 0;
    const tokenRemaining = Number(usage.token_remaining) || 0;
    const usagePercent = Number(usage.usage_percent) || 0;
    const storageQuota = Number(usage.storage_quota) || 0;
    const storageUsed = Number(usage.storage_used) || 0;
    const storagePercent = Number(usage.storage_percent) || 0;
    const plan = usage.plan;
    const messages = usage.messages;

    const formatTokens = (n: number) => {
      if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
      if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
      return String(n);
    };

    const formatBytes = (n: number) => {
      if (n >= 1073741824) return `${(n / 1073741824).toFixed(1)} GB`;
      if (n >= 1048576) return `${(n / 1048576).toFixed(1)} MB`;
      if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`;
      return `${n} B`;
    };

    const daysRemaining = plan?.expires_at
      ? Math.max(0, Math.ceil((new Date(plan.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : 0;

    return (
      <div className="space-y-8 animate-fade-in">
        <section>
          <h3 className="text-[16px] font-semibold text-[#222] mb-5">Usage</h3>

          <div className="space-y-6">
            {/* Plan info */}
            <div className="p-4 bg-white border border-[#E0DFDC] rounded-xl shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[15px] font-semibold text-[#222]">
                  {plan ? plan.name : 'Free Plan'}
                </span>
                <span className={`px-2 py-0.5 text-[11px] font-medium rounded-full ${
                  plan ? 'bg-[#4B9C68]/10 text-[#4B9C68]' : 'bg-[#F5F4F1] text-[#999]'
                }`}>
                  {plan ? 'Active' : 'Free'}
                </span>
              </div>
              {plan ? (
                <p className="text-[13px] text-[#5E5E5E]">到期时间：{plan.expires_at?.slice(0, 10)}（剩余 {daysRemaining} 天）</p>
              ) : (
                <p className="text-[13px] text-[#5E5E5E]">您当前没有活跃套餐</p>
              )}
            </div>

            {/* Token Usage */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[13px] font-medium text-[#222]">Tokens</span>
                <span className="text-[13px] text-[#5E5E5E]">
                  {formatTokens(tokenUsed)} / {formatTokens(tokenQuota)} used
                </span>
              </div>
              <div className="h-2 bg-[#EAE8E3] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${Math.min(usagePercent, 100)}%`,
                    backgroundColor: usagePercent > 90 ? '#D93025' : usagePercent > 70 ? '#F9AB00' : '#D97757',
                  }}
                />
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-[12px] text-[#747474]">{usagePercent}% used</span>
                <span className="text-[12px] text-[#747474]">{formatTokens(tokenRemaining)} remaining</span>
              </div>
            </div>

            {/* Storage Usage */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[13px] font-medium text-[#222]">Storage</span>
                <span className="text-[13px] text-[#5E5E5E]">
                  {formatBytes(storageUsed)} / {formatBytes(storageQuota)} used
                </span>
              </div>
              <div className="h-2 bg-[#EAE8E3] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${Math.min(storagePercent, 100)}%`,
                    backgroundColor: storagePercent > 90 ? '#D93025' : storagePercent > 70 ? '#F9AB00' : '#1A73E8',
                  }}
                />
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-[12px] text-[#747474]">{storagePercent}% used</span>
                <span className="text-[12px] text-[#747474]">{formatBytes(storageQuota - storageUsed)} remaining</span>
              </div>
            </div>

            {/* Message Stats */}
            {messages && (
              <div className="flex gap-4">
                <div className="flex-1 p-3 bg-white border border-[#E0DFDC] rounded-xl text-center">
                  <div className="text-[20px] font-semibold text-[#222]">{messages.today}</div>
                  <div className="text-[12px] text-[#747474]">今日消息</div>
                </div>
                <div className="flex-1 p-3 bg-white border border-[#E0DFDC] rounded-xl text-center">
                  <div className="text-[20px] font-semibold text-[#222]">{messages.month}</div>
                  <div className="text-[12px] text-[#747474]">本月消息</div>
                </div>
              </div>
            )}

          </div>
        </section>
      </div>
    );
  }
};

export default SettingsPage;
