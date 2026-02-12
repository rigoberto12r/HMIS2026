'use client';

import { type ReactNode, useEffect, useRef } from 'react';
import {
  motion,
  AnimatePresence,
  useSpring,
  useTransform,
  useInView,
  useMotionValue,
  useReducedMotion,
} from 'framer-motion';
import {
  pageVariants,
  staggerContainer,
  staggerItem,
  cardHover,
  fadeIn,
  checkmarkPath,
  checkmarkCircle,
} from '@/lib/motion';
import { cn } from '@/lib/utils';

// ── MotionPage ───────────────────────────────────────────

export function MotionPage({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const shouldReduce = useReducedMotion();

  if (shouldReduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ── MotionStagger ────────────────────────────────────────

export function MotionStagger({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const shouldReduce = useReducedMotion();

  if (shouldReduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function MotionStaggerItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const shouldReduce = useReducedMotion();

  if (shouldReduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div variants={staggerItem} className={className}>
      {children}
    </motion.div>
  );
}

// ── MotionCard ───────────────────────────────────────────

export function MotionCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const shouldReduce = useReducedMotion();

  if (shouldReduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      variants={cardHover}
      initial="rest"
      whileHover="hover"
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ── MotionFadeIn ─────────────────────────────────────────

export function MotionFadeIn({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const shouldReduce = useReducedMotion();
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });

  if (shouldReduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      ref={ref}
      variants={fadeIn}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      transition={{ delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ── AnimatedNumber ───────────────────────────────────────

export function AnimatedNumber({
  value,
  className,
  prefix = '',
  suffix = '',
  decimals = 0,
}: {
  value: number;
  className?: string;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}) {
  const shouldReduce = useReducedMotion();
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });
  const display = useTransform(spring, (current) => {
    return `${prefix}${current.toFixed(decimals)}${suffix}`;
  });

  useEffect(() => {
    if (isInView && !shouldReduce) {
      motionValue.set(value);
    } else if (shouldReduce) {
      motionValue.set(value);
    }
  }, [value, isInView, shouldReduce, motionValue]);

  if (shouldReduce) {
    return (
      <span ref={ref} className={className} aria-live="polite">
        {prefix}{value.toFixed(decimals)}{suffix}
      </span>
    );
  }

  return (
    <motion.span ref={ref} className={className} aria-live="polite">
      {display}
    </motion.span>
  );
}

// ── SuccessCheckmark ─────────────────────────────────────

export function SuccessCheckmark({
  size = 48,
  className,
  show = true,
}: {
  size?: number;
  className?: string;
  show?: boolean;
}) {
  return (
    <AnimatePresence>
      {show && (
        <motion.svg
          width={size}
          height={size}
          viewBox="0 0 48 48"
          className={cn('text-accent-500', className)}
          initial="hidden"
          animate="visible"
          exit={{ opacity: 0, scale: 0.8 }}
        >
          <motion.circle
            cx="24"
            cy="24"
            r="22"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            variants={checkmarkCircle}
          />
          <motion.circle
            cx="24"
            cy="24"
            r="22"
            fill="currentColor"
            opacity="0.1"
            variants={checkmarkCircle}
          />
          <motion.path
            d="M14 24l7 7 13-13"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            variants={checkmarkPath}
          />
        </motion.svg>
      )}
    </AnimatePresence>
  );
}

// ── ProgressRing ─────────────────────────────────────────

export function ProgressRing({
  progress,
  size = 40,
  strokeWidth = 3,
  className,
  color = 'text-primary-500',
  trackColor = 'text-surface-200',
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  color?: string;
  trackColor?: string;
}) {
  const shouldReduce = useReducedMotion();
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  const motionProgress = useMotionValue(0);
  const springProgress = useSpring(motionProgress, {
    stiffness: 100,
    damping: 30,
  });
  const strokeDashoffset = useTransform(
    springProgress,
    (p) => circumference - (p / 100) * circumference
  );

  useEffect(() => {
    if (isInView || shouldReduce) {
      motionProgress.set(Math.min(100, Math.max(0, progress)));
    }
  }, [progress, isInView, shouldReduce, motionProgress]);

  const staticOffset = circumference - (progress / 100) * circumference;

  return (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={cn('transform -rotate-90', className)}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        className={trackColor}
        stroke="currentColor"
      />
      {shouldReduce ? (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={staticOffset}
          strokeLinecap="round"
          className={color}
          stroke="currentColor"
        />
      ) : (
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          style={{ strokeDashoffset }}
          strokeLinecap="round"
          className={color}
          stroke="currentColor"
        />
      )}
    </svg>
  );
}

// Re-export AnimatePresence for convenience
export { AnimatePresence, motion };
