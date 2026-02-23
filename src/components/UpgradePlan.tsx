import React, { useState, useEffect, useRef } from 'react';
import { Crown, Zap, Star, Gem, Check } from 'lucide-react';
import { getPlans, createPaymentOrder, getPaymentStatus, getUserUsage, redeemCode } from '../api';

interface UpgradePlanProps {
  onClose: () => void;
}

interface Plan {
  id: number;
  name: string;
  price: number;
  duration_days: number;
  token_quota: number;
  window_budget: number;
  weekly_budget: number;
  description: string;
}

const PLAN_ICONS = [Zap, Star, Crown, Gem];

const UpgradePlan = ({ onClose }: UpgradePlanProps) => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentPlanPrice, setCurrentPlanPrice] = useState<number | null>(null);
  const [currentPlanQuota, setCurrentPlanQuota] = useState<number | null>(null);
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
      getUserUsage(),
    ]).then(([plansData, usage]) => {
      setPlans(plansData);
      if (usage.plan && typeof usage.plan.price === 'number') {
        setCurrentPlanPrice(usage.plan.price);
      }
      // 从套餐列表中找到当前套餐的 token_quota
      if (usage.plan) {
        const matched = plansData.find((p: Plan) => p.id === usage.plan.id);
        if (matched) setCurrentPlanQuota(matched.token_quota);
      }
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

  const formatQuota = (units: number) => {
    return `$${(units / 10000).toFixed(2)}`;
  };

  // 每轮对话成本估算（基于 Anthropic 官方定价，单位：美元）
  // 假设每轮：3k input, 2k output, 1k thinking (仅 Opus), 1k cache read
  const INPUT_TOKENS = 3000;
  const OUTPUT_TOKENS = 2000;
  const THINKING_TOKENS = 1000;
  const CACHE_READ_TOKENS = 1000;

  const OPUS_COST_PER_ROUND =
    (INPUT_TOKENS / 1e6) * 15 +
    (OUTPUT_TOKENS / 1e6) * 25 +
    (THINKING_TOKENS / 1e6) * 25 +
    (CACHE_READ_TOKENS / 1e6) * 1.875;
  const SONNET_COST_PER_ROUND =
    (INPUT_TOKENS / 1e6) * 3 +
    (OUTPUT_TOKENS / 1e6) * 15 +
    (CACHE_READ_TOKENS / 1e6) * 0.375;

  const estimateRounds = (budget: number, costPerRound: number) => {
    if (!budget || budget <= 0) return 0;
    return Math.floor(budget / costPerRound);
  };

  const getUpgradePrice = (plan: Plan) => {
    if (currentPlanPrice === null) return plan.price;
    return Math.max(plan.price - currentPlanPrice, 0);
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
      <div className="max-w-[1000px] w-full mx-auto px-6 py-10">
        {/* Header */}
        <div className="mb-8 text-center relative">
          <h1 className="text-[28px] font-serif-claude text-[#222] mb-2">选择适合您的套餐</h1>
          <p className="text-[15px] text-[#666]">升级后即可享受更多对话额度</p>
        </div>

        {/* Plan Cards */}
        {payStep === 'select' && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
              {plans.map((plan, idx) => {
                const Icon = PLAN_ICONS[idx] || Star;
                const isSelected = selectedPlan?.id === plan.id;
                const isCurrent = currentPlanPrice !== null && plan.price === currentPlanPrice;
                const isLower = currentPlanQuota !== null && plan.token_quota <= currentPlanQuota && !isCurrent;
                const isUpgrade = currentPlanQuota !== null && plan.token_quota > currentPlanQuota;
                const disabled = isCurrent || isLower;
              return (
                <div
                  key={plan.id}
                  onClick={() => !disabled && setSelectedPlan(plan)}
                  className={`relative flex flex-col p-5 rounded-2xl border transition-all ${
                    isCurrent ? 'border-[#4B9C68] bg-[#4B9C68]/5 cursor-default' :
                    disabled ? 'opacity-60 cursor-not-allowed' :
                    isSelected ? 'border-blue-500 shadow-md cursor-pointer' : 'border-[#C0C0C0] hover:border-[#999] cursor-pointer'
                  }`}
                >
                  {isCurrent && (
                    <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 bg-[#4B9C68]/10 text-[#4B9C68] text-[11px] font-medium rounded-full">
                      <Check size={12} /> 当前
                    </div>
                  )}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${
                    isSelected && !disabled ? 'bg-blue-50 text-blue-600' : 'bg-[#EAE9E6] text-[#666]'
                  }`}>
                    <Icon size={20} />
                  </div>
                  <h3 className="text-[16px] font-semibold text-[#222] mb-1">{plan.name}</h3>
                  <p className="text-[13px] text-[#666] mb-3 leading-relaxed h-10 overflow-hidden">{plan.description}</p>
                  <div className="text-[28px] font-bold text-[#222] mb-1">
                    {formatPrice(plan.price)}
                  </div>
                  <div className="text-[12px] text-[#999] mb-4">{plan.duration_days} 天</div>
                  <div className="text-[13px] text-[#555] mb-4 space-y-1">
                    {plan.window_budget > 0 && <div>5h 窗口：${plan.window_budget}</div>}
                    {plan.weekly_budget > 0 && <div>周限额：${plan.weekly_budget}</div>}
                    <div>总额度：{formatQuota(plan.token_quota)}</div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); if (!disabled) handleBuy(plan); }}
                    disabled={disabled}
                    className={`mt-auto w-full py-2.5 rounded-lg text-[14px] font-medium transition-colors ${
                      isCurrent
                        ? 'bg-transparent text-[#4B9C68] cursor-default'
                        : disabled
                          ? 'bg-[#EAE9E6] text-[#AAA] cursor-not-allowed'
                          : isSelected
                            ? 'bg-blue-600 hover:bg-blue-700 text-white'
                            : 'bg-[#EAE9E6] hover:bg-[#DCDbd9] text-[#333]'
                    }`}
                  >
                    {isCurrent ? '当前套餐' : isLower ? '低于当前套餐' : isUpgrade ? `升级 (${formatPrice(getUpgradePrice(plan))})` : '立即购买'}
                  </button>
                </div>
              );
            })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              {/* Redemption Code */}
              <div className="rounded-2xl border border-[#C0C0C0] p-6">
                <h3 className="text-[15px] font-semibold text-[#222] mb-3">已有兑换码？</h3>
                <div className="flex gap-3 mb-2">
                  <input
                    type="text"
                    value={redeemInput}
                    onChange={handleRedeemInputChange}
                    placeholder="请输入兑换码"
                    className="flex-1 px-4 py-2.5 bg-white border border-[#E0DFDC] rounded-lg text-[14px] text-[#222] font-mono tracking-wider focus:outline-none focus:border-[#666] focus:shadow-sm transition-all"
                    maxLength={19}
                    onKeyDown={e => { if (e.key === 'Enter') handleRedeem(); }}
                  />
                  <button
                    onClick={handleRedeem}
                    disabled={redeeming || redeemInput.replace(/[^a-zA-Z0-9]/g, '').length !== 16}
                    className={`px-5 py-2.5 text-white text-[14px] font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap ${
                      redeeming || redeemInput.replace(/[^a-zA-Z0-9]/g, '').length !== 16
                        ? 'bg-[#E0E0E0] text-[#999]'
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {redeeming ? '兑换中...' : '兑换'}
                  </button>
                </div>
                {redeemError && (
                  <div className="mt-2 p-2 bg-red-50 text-red-600 text-[13px] rounded-lg">{redeemError}</div>
                )}
                {redeemResult && (
                  <div className="mt-2 p-2 bg-green-50 text-green-700 text-[13px] rounded-lg">
                    兑换成功！已激活「{redeemResult.plan.name}」，有效期至 {redeemResult.subscription.expires_at.slice(0, 10)}，页面即将刷新...
                  </div>
                )}
              </div>

              {/* 额度说明 */}
              <div className="p-6 rounded-2xl border border-[#C0C0C0] h-full">
                <h3 className="text-[15px] font-semibold text-[#222] mb-2">额度说明</h3>
                <p className="text-[13px] text-[#666] mb-4 leading-relaxed">
                  单看美元可能觉得窗口额度少，但实际上网页对话的 token 消耗速度是远小于 vibe coding 的。所以不能以用 Claude Code 的习惯去看待网页版额度。以下为各套餐 5h 窗口额度的预估对话轮数，每轮对话按 3k input + 2k output + 1k thinking + 1k cache read 估算。大家可以自己做评估，根据自己的需求购买。
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px] text-[#555]">
                    <thead>
                      <tr className="border-b border-[#E0DFDC]">
                        <th className="text-left py-2 pr-3 font-medium text-[#333]">套餐</th>
                        <th className="text-left py-2 pr-3 font-medium text-[#333]">5h 窗口</th>
                        <th className="text-right py-2 pr-3 font-medium text-[#333]">Opus 4.6 Extended Thinking</th>
                        <th className="text-right py-2 font-medium text-[#333]">Sonnet 4.6</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plans.filter(p => p.id !== 1).map((plan, idx) => {
                        const hasWindow = plan.window_budget > 0;
                        const opusRounds = hasWindow ? estimateRounds(plan.window_budget, OPUS_COST_PER_ROUND) : 0;
                        const sonnetRounds = hasWindow ? estimateRounds(plan.window_budget, SONNET_COST_PER_ROUND) : 0;
                        return (
                          <tr key={plan.id} className={idx < plans.filter(p => p.id !== 1).length - 1 ? 'border-b border-[#E0DFDC]' : ''}>
                            <td className="py-2 pr-3">{plan.name}</td>
                            <td className="py-2 pr-3">{hasWindow ? `$${plan.window_budget}` : '无'}</td>
                            <td className="text-right py-2 pr-3">{hasWindow ? `~${opusRounds} 轮` : '-'}</td>
                            <td className="text-right py-2">{hasWindow ? `~${sonnetRounds} 轮` : '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Payment Method Selection */}
        {payStep === 'method' && selectedPlan && (
          <div className="max-w-[400px] mx-auto">
            <div className="rounded-2xl border border-[#E0DFDC] p-8 bg-transparent">
              <h3 className="text-[18px] font-semibold text-[#222] mb-2 text-center">确认购买</h3>
              <p className="text-[14px] text-[#666] mb-6 text-center">
                {selectedPlan.name} — {currentPlanPrice !== null && getUpgradePrice(selectedPlan) < selectedPlan.price
                  ? formatPrice(getUpgradePrice(selectedPlan))
                  : formatPrice(selectedPlan.price)
                }
              </p>
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
            <div className="rounded-2xl border border-[#E0DFDC] p-8 text-center bg-transparent">
              <h3 className="text-[16px] font-semibold text-[#222] mb-2">等待支付</h3>
              <p className="text-[14px] text-[#666] mb-4">
                {selectedPlan.name} — {currentPlanPrice !== null && getUpgradePrice(selectedPlan) < selectedPlan.price
                  ? formatPrice(getUpgradePrice(selectedPlan))
                  : formatPrice(selectedPlan.price)
                }
              </p>
              <div className="w-48 h-48 mx-auto bg-[#F5F4F1] rounded-xl flex items-center justify-center mb-4">
                <div className="text-[13px] text-[#999] text-center px-4">
                  正在加载支付二维码...
                </div>
              </div>
              <p className="text-[13px] text-[#999] mb-4">请在 5 分钟内完成支付</p>
              {error && <div className="mb-4 p-3 bg-red-50 text-red-600 text-[13px] rounded-lg">{error}</div>}
              <button onClick={handleRetry} className="text-[13px] text-[#666] hover:text-[#333] transition-colors">
                取消
              </button>
            </div>
          </div>
        )}

        {/* Success */}
        {payStep === 'success' && (
          <div className="max-w-[400px] mx-auto">
            <div className="rounded-2xl border border-[#E0DFDC] p-8 text-center bg-transparent">
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
            <div className="rounded-2xl border border-[#E0DFDC] p-8 text-center bg-transparent">
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
