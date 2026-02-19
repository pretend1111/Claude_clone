import React, { useEffect, useRef, useMemo } from 'react';

// 视觉颜色配置
const COLORS = {
  bg: 'transparent', // 透明背景
  shape: '#D97757',  // Claude Logo 陶土色
};

// 物理/交互配置
const SETTINGS = {
  interactionRadius: 160,
  steps: 5,
  tipScaleLength: 1.5,
  rootScaleLength: 0.6,
  rootMinTaper: 0.6,
  rootScaleWidth: 1.6,
  jitterInterval: 240,
  jitterStrength: 0.15,
};

interface ClaudeLogoProps {
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  autoAnimate?: boolean; // 自动转圈动画模式（模拟鼠标绕圈）
  breathe?: boolean; // 呼吸动画模式（12根条纹同时缩放）
}

const ClaudeLogo = ({ className = '', style, onClick, autoAnimate = false, breathe = false }: ClaudeLogoProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);
  const mouseState = useRef({ x: -1000, y: -1000 });
  const containerRef = useRef<HTMLDivElement>(null);

  const lastJitterTime = useRef(0);
  const jitterValues = useRef<{ l: number; w: number; t: number }[]>([]);
  const autoAnimateAngle = useRef(0);

  // 生成不规则几何配置
  const barsConfig = useMemo(() => {
    jitterValues.current = Array.from({ length: 12 }).map(() => ({ l: 0, w: 0, t: 0 }));

    return Array.from({ length: 12 }).map((_, i) => {
      const angleJitter = (Math.random() - 0.5) * 12;
      const baseLength = 55 + Math.random() * 35;
      const baseWidth = 10 + Math.random() * 6;
      const baseTaperRatio = 0.9 + Math.random() * 0.2;
      const maxTaperRatio = 1.4 + Math.random() * 0.2;
      const tipSegments = Math.floor(2 + Math.random() * 3);

      const tipOffsets = Array.from({ length: tipSegments - 1 }).map(() => ({
        angleBias: Math.random() * 0.4 - 0.2,
        radiusFactor: 0.2 + Math.random() * 0.3
      }));

      return {
        angle: (i * 30) + angleJitter,
        baseLength,
        baseWidth,
        baseDist: 12,
        baseTaperRatio,
        maxTaperRatio,
        tipSegments,
        tipOffsets
      };
    });
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 辅助函数：计算点到线段的距离以及投影位置
    const getSegmentData = (mx: number, my: number, x1: number, y1: number, x2: number, y2: number) => {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const lenSq = dx * dx + dy * dy;
      let t = ((mx - x1) * dx + (my - y1) * dy) / lenSq;
      const clampedT = Math.max(0, Math.min(1, t));
      const projX = x1 + clampedT * dx;
      const projY = y1 + clampedT * dy;
      const dist = Math.sqrt((mx - projX) ** 2 + (my - projY) ** 2);
      return { dist, t };
    };

    const drawPolygonBar = (
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      w: number,
      l: number,
      angle: number,
      taperRatio: number,
      config: typeof barsConfig[0]
    ) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((angle * Math.PI) / 180);

      ctx.beginPath();

      const startHalfW = w / 2;
      const endHalfW = (w * taperRatio) / 2;

      ctx.moveTo(0, -startHalfW);
      ctx.lineTo(0, startHalfW);
      ctx.lineTo(l, endHalfW);

      const tipRadius = endHalfW;
      config.tipOffsets.forEach((offset, i) => {
        const totalSegments = config.tipSegments;
        const segmentIndex = i + 1;
        const baseAngle = Math.PI / 2 - (Math.PI * segmentIndex) / totalSegments;
        const finalAngle = baseAngle + offset.angleBias;
        const r = tipRadius * (1 + offset.radiusFactor);
        const px = l + Math.cos(finalAngle) * r * 0.6;
        const py = Math.sin(finalAngle) * tipRadius;
        ctx.lineTo(px, py);
      });

      ctx.lineTo(l, -endHalfW);
      ctx.lineTo(0, -startHalfW);

      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    const handleResize = () => {
      const dpr = window.devicePixelRatio || 1;
      // 使用容器的尺寸而不是窗口尺寸
      const rect = container.getBoundingClientRect();
      const width = rect.width || 27;
      const height = rect.height || 27;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseState.current.x = e.clientX - rect.left;
      mouseState.current.y = e.clientY - rect.top;
    };

    const handleMouseLeave = () => {
      mouseState.current.x = -1000;
      mouseState.current.y = -1000;
    };

    const animate = () => {
      const now = Date.now();
      const width = canvas.width / (window.devicePixelRatio || 1);
      const height = canvas.height / (window.devicePixelRatio || 1);
      const centerX = width / 2;
      const centerY = height / 2;

      // autoAnimate 模式：模拟鼠标在外圈匀速转圈
      // breathe 模式：模拟鼠标在中心做径向往复运动（呼吸效果）
      let mouseX: number, mouseY: number;
      if (breathe) {
        // 使用 sin 函数做平滑的往复运动，周期约 1.5 秒
        const breathePhase = Math.sin(now * 0.004);
        // breathePhase 在 -1 到 1 之间
        // 映射到从中心到外圈的距离：中心附近 → 条纹缩短，外圈 → 条纹伸长
        const breatheRadius = SETTINGS.interactionRadius * (width / 250) * (0.15 + 0.35 * (breathePhase * 0.5 + 0.5));
        mouseX = centerX + breatheRadius;
        mouseY = centerY;
        // 同时让"鼠标"缓慢旋转，使效果更均匀
        const slowRotation = now * 0.001;
        mouseX = centerX + Math.cos(slowRotation) * breatheRadius;
        mouseY = centerY + Math.sin(slowRotation) * breatheRadius;
      } else if (autoAnimate) {
        autoAnimateAngle.current += 0.105; // 转圈速度
        const orbitRadius = SETTINGS.interactionRadius * (width / 250) * 0.55;
        mouseX = centerX + Math.cos(autoAnimateAngle.current) * orbitRadius;
        mouseY = centerY + Math.sin(autoAnimateAngle.current) * orbitRadius;
      } else {
        mouseX = mouseState.current.x;
        mouseY = mouseState.current.y;
      }

      // 确保不是 0
      if (width === 0 || height === 0) return;

      // 缩放因子：将原本设计的大图缩放到 27px 容器
      // 原始设计假设是约 250px 的大画布，现在要缩放到 27px
      const scaleFactor = width / 250;

      // 抖动更新逻辑
      if (now - lastJitterTime.current > SETTINGS.jitterInterval) {
        lastJitterTime.current = now;
        jitterValues.current = jitterValues.current.map(() => ({
          l: (Math.random() - 0.5) * SETTINGS.jitterStrength,
          w: (Math.random() - 0.5) * SETTINGS.jitterStrength,
          t: (Math.random() - 0.5) * SETTINGS.jitterStrength,
        }));
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = COLORS.shape;

      barsConfig.forEach((config, index) => {
        const rad = (config.angle * Math.PI) / 180;

        // 应用缩放
        const scaledDist = config.baseDist * scaleFactor;
        const scaledLength = config.baseLength * scaleFactor;
        const scaledWidth = config.baseWidth * scaleFactor;

        const x1 = centerX + Math.cos(rad) * scaledDist;
        const y1 = centerY + Math.sin(rad) * scaledDist;
        const x2 = centerX + Math.cos(rad) * (scaledDist + scaledLength);
        const y2 = centerY + Math.sin(rad) * (scaledDist + scaledLength);

        const { dist, t } = getSegmentData(mouseX, mouseY, x1, y1, x2, y2);

        let renderLength = scaledLength;
        let renderWidth = scaledWidth;
        let renderTaper = config.baseTaperRatio;

        if (dist < SETTINGS.interactionRadius * scaleFactor) {
          const rawRatio = 1 - dist / (SETTINGS.interactionRadius * scaleFactor);
          const steppedRatio = Math.floor(rawRatio * SETTINGS.steps) / SETTINGS.steps;

          if (t < 0.35) {
            renderLength = scaledLength - (scaledLength * (1 - SETTINGS.rootScaleLength) * steppedRatio);
            renderTaper = config.baseTaperRatio - (config.baseTaperRatio - SETTINGS.rootMinTaper) * steppedRatio;
            renderWidth = scaledWidth + (scaledWidth * (SETTINGS.rootScaleWidth - 1)) * steppedRatio;
          } else {
            renderLength = scaledLength + (scaledLength * (SETTINGS.tipScaleLength - 1) * steppedRatio);
            renderTaper = config.baseTaperRatio + (config.maxTaperRatio - config.baseTaperRatio) * steppedRatio;
          }

          const jitter = jitterValues.current[index];
          renderLength *= (1 + jitter.l);
          renderWidth *= (1 + jitter.w);
          renderTaper *= (1 + jitter.t);
        }

        drawPolygonBar(
          ctx,
          centerX,
          centerY,
          renderWidth,
          renderLength,
          config.angle,
          renderTaper,
          config
        );
      });

      requestRef.current = requestAnimationFrame(animate);
    };

    handleResize();
    requestRef.current = requestAnimationFrame(animate);

    if (!autoAnimate && !breathe) {
      container.addEventListener('mousemove', handleMouseMove);
      container.addEventListener('mouseleave', handleMouseLeave);
    }
    window.addEventListener('resize', handleResize);

    return () => {
      if (!autoAnimate && !breathe) {
        container.removeEventListener('mousemove', handleMouseMove);
        container.removeEventListener('mouseleave', handleMouseLeave);
      }
      window.removeEventListener('resize', handleResize);
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [barsConfig, autoAnimate, breathe]);

  return (
    <div
      ref={containerRef}
      className={`cursor-pointer ${className}`}
      style={{
        width: '66px',
        height: '66px',
        ...style
      }}
    >
      <canvas
        ref={canvasRef}
        className="block touch-none"
        style={{ width: '100%', height: '100%' }}
        onClick={onClick}
      />
    </div>
  );
};

export default ClaudeLogo;
