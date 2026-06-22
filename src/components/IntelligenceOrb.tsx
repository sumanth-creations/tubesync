/**
 * Intelligence Orb - 3D Animated AI Centerpiece Component
 *
 * Visual centerpiece for the AI-first experience with animated states:
 * - Thinking (processing/analyzing)
 * - Listening (awaiting user input)
 * - Learning (absorbing information)
 * - Researching (gathering data)
 */

import { useState, useEffect, useCallback } from 'react';

type OrbState = 'idle' | 'thinking' | 'listening' | 'learning' | 'researching';

interface IntelligenceOrbProps {
  state?: OrbState;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  pulseOnIdle?: boolean;
  showStatus?: boolean;
  className?: string;
}

const stateConfig: Record<OrbState, {
  label: string;
  primaryColor: string;
  secondaryColor: string;
  glowIntensity: number;
  animationSpeed: number;
  particles: boolean;
}> = {
  idle: {
    label: 'Ready',
    primaryColor: '#0ea5e9',
    secondaryColor: '#0284c7',
    glowIntensity: 0.4,
    animationSpeed: 3,
    particles: false,
  },
  thinking: {
    label: 'Thinking...',
    primaryColor: '#8b5cf6',
    secondaryColor: '#7c3aed',
    glowIntensity: 0.8,
    animationSpeed: 0.8,
    particles: true,
  },
  listening: {
    label: 'Listening...',
    primaryColor: '#10b981',
    secondaryColor: '#059669',
    glowIntensity: 0.6,
    animationSpeed: 2,
    particles: false,
  },
  learning: {
    label: 'Learning...',
    primaryColor: '#f59e0b',
    secondaryColor: '#d97706',
    glowIntensity: 0.7,
    animationSpeed: 1.5,
    particles: true,
  },
  researching: {
    label: 'Researching...',
    primaryColor: '#ec4899',
    secondaryColor: '#db2777',
    glowIntensity: 0.9,
    animationSpeed: 1,
    particles: true,
  },
};

const sizeClasses: Record<NonNullable<IntelligenceOrbProps['size']>, { container: string; orb: string; inner: string }> = {
  sm: { container: 'w-24 h-24', orb: 'w-20 h-20', inner: 'w-12 h-12' },
  md: { container: 'w-40 h-40', orb: 'w-32 h-32', inner: 'w-20 h-20' },
  lg: { container: 'w-64 h-64', orb: 'w-52 h-52', inner: 'w-32 h-32' },
  xl: { container: 'w-96 h-96', orb: 'w-80 h-80', inner: 'w-48 h-48' },
};

export function IntelligenceOrb({
  state = 'idle',
  size = 'lg',
  pulseOnIdle = true,
  showStatus = true,
  className = '',
}: IntelligenceOrbProps) {
  const [rotation, setRotation] = useState(0);
  const [pulse, setPulse] = useState(0);
  const [particlePositions, setParticlePositions] = useState<Array<{ x: number; y: number; opacity: number }>>([]);

  const config = stateConfig[state];
  const sizes = sizeClasses[size];

  // Rotation animation
  useEffect(() => {
    const interval = setInterval(() => {
      setRotation(prev => (prev + 360 / config.animationSpeed / 60) % 360);
    }, 16);
    return () => clearInterval(interval);
  }, [config.animationSpeed]);

  // Pulse animation for idle state
  useEffect(() => {
    if (!pulseOnIdle && state === 'idle') {
      setPulse(0);
      return;
    }

    const interval = setInterval(() => {
      setPulse(prev => (prev + 0.05) % (Math.PI * 2));
    }, 16);
    return () => clearInterval(interval);
  }, [pulseOnIdle, state]);

  // Particle animation for active states
  useEffect(() => {
    if (!config.particles) {
      setParticlePositions([]);
      return;
    }

    const interval = setInterval(() => {
      setParticlePositions(prev => {
        const newPositions = prev
          .map(p => ({
            ...p,
            opacity: p.opacity - 0.02,
            y: p.y - 2,
          }))
          .filter(p => p.opacity > 0);

        if (Math.random() > 0.7 && newPositions.length < 15) {
          newPositions.push({
            x: Math.random() * 100 - 50,
            y: 0,
            opacity: 0.8,
          });
        }

        return newPositions;
      });
    }, 50);

    return () => clearInterval(interval);
  }, [config.particles]);

  const glowScale = 1 + Math.sin(pulse) * 0.1;

  return (
    <div className={`relative flex items-center justify-center ${sizes.container} ${className}`}>
      {/* Outer glow ring */}
      <div
        className={`absolute ${sizes.orb} rounded-full opacity-30 blur-xl transition-colors duration-500`}
        style={{
          backgroundColor: config.primaryColor,
          transform: `scale(${glowScale * 1.3})`,
          boxShadow: `0 0 ${config.glowIntensity * 60}px ${config.primaryColor}`,
        }}
      />

      {/* Orbital ring */}
      <div
        className={`absolute ${sizes.orb} rounded-full border-2 transition-all duration-500`}
        style={{
          borderColor: config.primaryColor,
          opacity: config.glowIntensity,
          transform: `rotate(${rotation}deg)`,
        }}
      >
        {/* Ring dot */}
        <div
          className="absolute w-3 h-3 rounded-full -top-1 left-1/2 -translate-x-1/2"
          style={{
            backgroundColor: config.primaryColor,
            boxShadow: `0 0 10px ${config.primaryColor}`,
          }}
        />
      </div>

      {/* Inner orbital ring (opposite direction) */}
      <div
        className={`absolute ${sizes.inner} rounded-full border transition-all duration-500`}
        style={{
          borderColor: config.secondaryColor,
          opacity: config.glowIntensity * 0.6,
          transform: `rotate(${-rotation * 1.5}deg)`,
        }}
      >
        <div
          className="absolute w-2 h-2 rounded-full -bottom-1 left-1/2 -translate-x-1/2"
          style={{
            backgroundColor: config.secondaryColor,
            boxShadow: `0 0 8px ${config.secondaryColor}`,
          }}
        />
      </div>

      {/* Main orb */}
      <div
        className={`relative ${sizes.inner} rounded-full flex items-center justify-center transition-all duration-500`}
        style={{
          background: `radial-gradient(circle at 30% 30%, ${config.primaryColor}, ${config.secondaryColor})`,
          boxShadow: `
            0 0 ${config.glowIntensity * 40}px ${config.primaryColor},
            inset 0 0 30px rgba(255,255,255,0.2)
          `,
          transform: `scale(${glowScale})`,
        }}
      >
        {/* Inner shine highlight */}
        <div
          className="absolute w-1/3 h-1/3 rounded-full bg-white/20 blur-sm"
          style={{ top: '15%', left: '15%' }}
        />

        {/* Core indicator */}
        <div
          className="w-3 h-3 rounded-full bg-white/80 animate-pulse"
          style={{ boxShadow: '0 0 10px rgba(255,255,255,0.8)' }}
        />

        {/* Particles */}
        {config.particles && (
          <div className="absolute inset-0 overflow-visible">
            {particlePositions.map((particle, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 rounded-full"
                style={{
                  left: `calc(50% + ${particle.x}px)`,
                  bottom: `calc(50% + ${particle.y}px)`,
                  backgroundColor: config.primaryColor,
                  opacity: particle.opacity,
                  boxShadow: `0 0 6px ${config.primaryColor}`,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Status indicator */}
      {showStatus && (
        <div
          className="absolute -bottom-8 px-3 py-1 rounded-full text-sm font-medium transition-all duration-500"
          style={{
            backgroundColor: `${config.primaryColor}20`,
            color: config.primaryColor,
            borderColor: config.primaryColor,
            borderWidth: 1,
          }}
        >
          {config.label}
        </div>
      )}
    </div>
  );
}

// Interactive Orb wrapper with state management
export function InteractiveOrb({
  initialState = 'idle',
  size = 'xl',
  onStateChange,
  className = '',
}: {
  initialState?: OrbState;
  size?: IntelligenceOrbProps['size'];
  onStateChange?: (state: OrbState) => void;
  className?: string;
}) {
  const [orbState, setOrbState] = useState<OrbState>(initialState);

  const cycleState = useCallback(() => {
    const states: OrbState[] = ['idle', 'thinking', 'listening', 'learning', 'researching'];
    const currentIndex = states.indexOf(orbState);
    const nextIndex = (currentIndex + 1) % states.length;
    const next = states[nextIndex];
    setOrbState(next);
    onStateChange?.(next);
  }, [orbState, onStateChange]);

  return (
    <button
      onClick={cycleState}
      className={`cursor-pointer focus:outline-none ${className}`}
      aria-label={`Orb state: ${orbState}. Click to change.`}
    >
      <IntelligenceOrb
        state={orbState}
        size={size}
        pulseOnIdle
        showStatus
      />
    </button>
  );
}

// Orb with automatic state cycling for demo/waiting
export function DemoOrb({ size = 'lg', className = '' }: { size?: IntelligenceOrbProps['size']; className?: string }) {
  const [demoState, setDemoState] = useState<OrbState>('idle');

  useEffect(() => {
    const states: OrbState[] = ['idle', 'listening', 'thinking', 'learning', 'researching'];
    let currentIndex = 0;

    const interval = setInterval(() => {
      currentIndex = (currentIndex + 1) % states.length;
      setDemoState(states[currentIndex]);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <IntelligenceOrb
      state={demoState}
      size={size}
      pulseOnIdle
      showStatus
      className={className}
    />
  );
}
