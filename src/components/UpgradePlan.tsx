import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Crown, Zap, Star, Gem } from 'lucide-react';
import { getPlans, createPaymentOrder, getPaymentStatus, mockPay, getUserProfile, redeemCode } from '../api';

interface UpgradePlanProps {
  onClose: () => void;
}

interface Plan {
  id: number;
  name: string;
  price: number;
  duration_days: number;
  token_quota: number;
  description: string;
}

const PLAN_ICONS = [Zap, Star, Crown, Gem];

const UpgradePlan = ({ onClose }: UpgradePlanProps) => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [activeSub, setActiveSub] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [payStep, setPayStep] = useState<'select' | 'method' | 'paying' | 'success' | 'timeout'>('select');
  const [orderId, setOrderId] = useState('');
  const [error, setError] = useState('');
  const [redeemInput, setRedeemInput] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [redeemResult, setRedeemResult] = useState<any>(null);
  const [redeemError, setRedeemError] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Promise.all([
      getPlans(),
      getUserProfile(),
    ]).then(([plansData, profile]) => {
      setPlans(plansData);
      setActiveSub(profile);
      setLoading(false);
    }).catch(() => setLoading(false));

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const formatPrice = (cents: number) => {
    return `¥${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 1)}`;
  };

  const formatTokens = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(0)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
    return String(n);
  };

  const estimateConversations = (tokens: number) => {
    // 约 50K tokens 一轮对话
    return Math.floor(tokens / 50000);
  };

  const handleBuy = (plan: Plan) => {
    setSelectedPlan(plan);
    setPayStep('method');
    setError('');
  };

  const handlePay = async (method: string) => {
    if (!selectedPlan) return;
    setError('');
    setPayStep('paying');

    try {
      const data = await createPaymentOrder(selectedPlan.id, method);
      setOrderId(data.orderId);
      startPolling(data.orderId);
    } catch (err: any) {
      setError(err.message || '创建订单失败');
      setPayStep('method');
    }
  };

  const startPolling = (oid: string) => {
    // 每 2 秒轮询
    pollRef.current = setInterval(async () => {
      try {
        const status = await getPaymentStatus(oid);
        if (status.status === 'paid') {
          clearPolling();
          setPayStep('success');
        }
      } catch {}
    }, 2000);

    // 5 分钟超时
    timeoutRef.current = setTimeout(() => {
      clearPolling();
      setPayStep('timeout');
    }, 5 * 60 * 1000);
  };

  const clearPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
  };

  const handleMockPay = async () => {
    if (!orderId) return;
    try {
      await mockPay(orderId);
      clearPolling();
      setPayStep('success');
    } catch (err: any) {
      setError(err.message || '模拟支付失败');
    }
  };

  const handleRetry = () => {
    setPayStep('method');
    setOrderId('');
    setError('');
  };

  // 兑换码自动格式化：每4位加横线，自动转大写
  const formatRedeemInput = (val: string) => {
    const cleaned = val.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 16);
    const parts = [];
    for (let i = 0; i < cleaned.length; i += 4) {
      parts.push(cleaned.slice(i, i + 4));
    }
    return parts.join('-');
  };

  const handleRedeemInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRedeemInput(formatRedeemInput(e.target.value));
    setRedeemError('');
    setRedeemResult(null);
  };

  const handleRedeem = async () => {
    if (!redeemInput) return;
    setRedeeming(true);
    setRedeemError('');
    setRedeemResult(null);
    try {
      const data = await redeemCode(redeemInput);
      setRedeemResult(data);
      setRedeemInput('');
      // 3 秒后刷新页面数据
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    } catch (err: any) {
      setRedeemError(err.message || '兑换失败');
    } finally {
      setRedeeming(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center h-full bg-claude-bg">
        <div className="text-[14px] text-[#999]">加载中...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-claude-bg">
      <div className="max-w-[900px] w-full mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <button onClick={onClose} className="flex items-center gap-1.5 text-[13px] text-[#666] hover:text-[#333] mb-4 transition-colors">
            <ArrowLeft size={16} /> 返回
          </button>
          <h1 className="text-[24px] font-serif-claude text-[#222]">选择适合您的套餐</h1>
          <p className="text-[14px] text-[#666] mt-1">升级后即可享受更多对话额度</p>
        </div>

        {/* Redemption Code */}
        {payStep === 'select' && (
          <div className="mb-8">
            <div className="bg-white rounded-2xl border border-[#E0DFDC] p-5">
              <h3 className="text-[15px] font-semibold text-[#222] mb-3">已有兑换码？</h3>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={redeemInput}
                  onChange={handleRedeemInputChange}
                  placeholder="请输入兑换码，如 A3X7-K9M2-P5R8-W1Q4"
                  className="flex-1 px-3 py-2.5 bg-[#F9F8F5] border border-[#E0DFDC] rounded-lg text-[14px] text-[#222] font-mono tracking-wider focus:outline-none focus:border-[#D97757] focus:ring-1 focus:ring-[#D97757] transition-all"
                  maxLength={19}
                  onKeyDown={e => { if (e.key === 'Enter') handleRedeem(); }}
                />
                <button
                  onClick={handleRedeem}
                  disabled={redeeming || redeemInput.replace(/[^a-zA-Z0-9]/g, '').length !== 16}
                  className="px-5 py-2.5 bg-[#D97757] hover:bg-[#c4694a] text-white text-[14px] font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {redeeming ? '兑换中...' : '兑换'}
                </button>
              </div>
              {redeemError && (
                <div className="mt-3 p-3 bg-red-50 text-red-600 text-[13px] rounded-lg">{redeemError}</div>
              )}
              {redeemResult && (
                <div className="mt-3 p-3 bg-green-50 text-green-700 text-[13px] rounded-lg">
                  兑换成功！已激活「{redeemResult.plan.name}」，有效期至 {redeemResult.subscription.expires_at.slice(0, 10)}，页面即将刷新...
                </div>
              )}
            </div>
          </div>
        )}

        {/* Plan Cards */}
        {payStep === 'select' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {plans.map((plan, idx) => {
              const Icon = PLAN_ICONS[idx] || Star;
              const isSelected = selectedPlan?.id === plan.id;
              return (
                <div
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan)}
                  className={`relative flex flex-col p-5 rounded-2xl border-2 bg-white transition-all cursor-pointer ${
                    isSelected ? 'border-[#D97757] shadow-md' : 'border-[#E0DFDC] hover:border-[#CCC]'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${
                    isSelected ? 'bg-[#FDF3EE] text-[#D97757]' : 'bg-[#F5F4F1] text-[#666]'
                  }`}>
                    <Icon size={20} />
                  </div>
                  <h3 className="text-[16px] font-semibold text-[#222] mb-1">{plan.name}</h3>
                  <p className="text-[13px] text-[#666] mb-3">{plan.description}</p>
                  <div className="text-[28px] font-bold text-[#222] mb-1">
                    {formatPrice(plan.price)}
                  </div>
                  <div className="text-[12px] text-[#999] mb-4">{plan.duration_days} 天</div>
                  <div className="text-[13px] text-[#555] mb-4 space-y-1">
                    <div>{formatTokens(plan.token_quota)} tokens</div>
                  </div>
                  <button
                    onClick={() => handleBuy(plan)}
                    className={`mt-auto w-full py-2.5 rounded-lg text-[14px] font-medium transition-colors ${
                      isSelected
                        ? 'bg-[#D97757] hover:bg-[#c4694a] text-white'
                        : 'bg-[#F5F4F1] hover:bg-[#EAE8E3] text-[#333]'
                    }`}
                  >
                    立即购买
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Payment Method Selection */}
        {payStep === 'method' && selectedPlan && (
          <div className="max-w-[400px] mx-auto">
            <div className="bg-white rounded-2xl border border-[#E0DFDC] p-6">
              <h3 className="text-[16px] font-semibold text-[#222] mb-1">确认购买</h3>
              <p className="text-[14px] text-[#666] mb-4">{selectedPlan.name} — {formatPrice(selectedPlan.price)}</p>
              {error && <div className="mb-4 p-3 bg-red-50 text-red-600 text-[13px] rounded-lg">{error}</div>}
              <div className="space-y-3">
                <button
                  onClick={() => handlePay('wechat')}
                  className="w-full flex items-center gap-3 p-3 border border-[#E0DFDC] rounded-xl hover:bg-[#F9F8F5] transition-colors"
                >
                  <div className="w-8 h-8 bg-[#07C160] rounded-lg flex items-center justify-center text-white text-[12px] font-bold">微</div>
                  <span className="text-[14px] text-[#333]">微信支付</span>
                </button>
                <button
                  onClick={() => handlePay('alipay')}
                  className="w-full flex items-center gap-3 p-3 border border-[#E0DFDC] rounded-xl hover:bg-[#F9F8F5] transition-colors"
                >
                  <div className="w-8 h-8 bg-[#1677FF] rounded-lg flex items-center justify-center text-white text-[12px] font-bold">支</div>
                  <span className="text-[14px] text-[#333]">支付宝</span>
                </button>
              </div>
              <button onClick={() => setPayStep('select')} className="w-full mt-4 text-[13px] text-[#666] hover:text-[#333] transition-colors">
                返回选择套餐
              </button>
            </div>
          </div>
        )}

        {/* Paying / QR Code */}
        {payStep === 'paying' && selectedPlan && (
          <div className="max-w-[400px] mx-auto">
            <div className="bg-white rounded-2xl border border-[#E0DFDC] p-6 text-center">
              <h3 className="text-[16px] font-semibold text-[#222] mb-2">等待支付</h3>
              <p className="text-[14px] text-[#666] mb-4">{selectedPlan.name} — {formatPrice(selectedPlan.price)}</p>
              <div className="w-48 h-48 mx-auto bg-[#F5F4F1] rounded-xl flex items-center justify-center mb-4">
                <div className="text-[13px] text-[#999] text-center px-4">
                  支付平台未接入<br />请使用模拟支付测试
                </div>
              </div>
              <p className="text-[13px] text-[#999] mb-4">请在 5 分钟内完成支付</p>
              {error && <div className="mb-4 p-3 bg-red-50 text-red-600 text-[13px] rounded-lg">{error}</div>}
              <button
                onClick={handleMockPay}
                className="w-full py-2.5 bg-[#D97757] hover:bg-[#c4694a] text-white rounded-lg text-[14px] font-medium transition-colors mb-3"
              >
                模拟支付（开发测试）
              </button>
              <button onClick={handleRetry} className="text-[13px] text-[#666] hover:text-[#333] transition-colors">
                取消
              </button>
            </div>
          </div>
        )}

        {/* Success */}
        {payStep === 'success' && (
          <div className="max-w-[400px] mx-auto">
            <div className="bg-white rounded-2xl border border-[#E0DFDC] p-6 text-center">
              <div className="w-16 h-16 mx-auto bg-[#4B9C68]/10 rounded-full flex items-center justify-center mb-4">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4B9C68" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h3 className="text-[18px] font-semibold text-[#222] mb-2">支付成功</h3>
              <p className="text-[14px] text-[#666] mb-6">您的套餐已激活，现在可以开始使用了</p>
              <button
                onClick={onClose}
                className="w-full py-2.5 bg-[#D97757] hover:bg-[#c4694a] text-white rounded-lg text-[14px] font-medium transition-colors"
              >
                开始使用
              </button>
            </div>
          </div>
        )}

        {/* Timeout */}
        {payStep === 'timeout' && (
          <div className="max-w-[400px] mx-auto">
            <div className="bg-white rounded-2xl border border-[#E0DFDC] p-6 text-center">
              <h3 className="text-[16px] font-semibold text-[#222] mb-2">订单已超时</h3>
              <p className="text-[14px] text-[#666] mb-6">支付超时，请重新下单</p>
              <button
                onClick={handleRetry}
                className="w-full py-2.5 bg-[#D97757] hover:bg-[#c4694a] text-white rounded-lg text-[14px] font-medium transition-colors"
              >
                重新支付
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UpgradePlan;
