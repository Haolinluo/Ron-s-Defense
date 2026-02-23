/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Crosshair, Shield, Target, Trophy, RotateCcw, Info } from 'lucide-react';
import { cn } from './lib/utils';
import { 
  GameState, 
  GameStatus, 
  Missile, 
  EnemyRocket, 
  Explosion, 
  Turret, 
  City 
} from './types';

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

const INITIAL_TURRETS: Turret[] = [
  { id: 't-left', x: 50, y: 550, ammo: 20, maxAmmo: 20, active: true },
  { id: 't-mid', x: 400, y: 550, ammo: 40, maxAmmo: 40, active: true },
  { id: 't-right', x: 750, y: 550, ammo: 20, maxAmmo: 20, active: true },
];

const INITIAL_CITIES: City[] = [
  { id: 'c1', x: 150, y: 570, active: true },
  { id: 'c2', x: 250, y: 570, active: true },
  { id: 'c3', x: 350, y: 570, active: true },
  { id: 'c4', x: 450, y: 570, active: true },
  { id: 'c5', x: 550, y: 570, active: true },
  { id: 'c6', x: 650, y: 570, active: true },
];

const WIN_SCORE = 1000;

const playExplosionSound = (frequency = 100, duration = 0.5) => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const audioCtx = new AudioContextClass();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);

    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + duration);
    
    // Cleanup
    setTimeout(() => {
      audioCtx.close();
    }, duration * 1000 + 100);
  } catch (e) {
    console.warn('Audio not supported or blocked', e);
  }
};

export default function App() {
  const [gameState, setGameState] = useState<GameState>({
    score: 0,
    status: 'START',
    wave: 1,
    missiles: [],
    enemyRockets: [],
    explosions: [],
    turrets: INITIAL_TURRETS,
    cities: INITIAL_CITIES,
  });

  const [language, setLanguage] = useState<'zh' | 'en'>('zh');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(null);
  const lastTimeRef = useRef<number>(0);
  const spawnTimerRef = useRef<number>(0);
  const fireCooldownRef = useRef<number>(0);
  const isFiringRef = useRef<boolean>(false);
  const targetPosRef = useRef<{ x: number, y: number }>({ x: 0, y: 0 });

  const t = {
    zh: {
      title: 'Ron新星防御',
      start: '开始游戏',
      score: '得分',
      wave: '波次',
      win: '防御成功！',
      loss: '防御失败...',
      restart: '再玩一次',
      ammo: '弹药',
      instructions: '长按并滑动鼠标/屏幕进行连续扫射。预判敌方火箭轨迹，利用爆炸摧毁它们。',
      winMsg: '你成功保卫了地球！',
      lossMsg: '所有炮台已被摧毁。',
    },
    en: {
      title: 'Ron Nova Defense',
      start: 'Start Game',
      score: 'Score',
      wave: 'Wave',
      win: 'Defense Successful!',
      loss: 'Defense Failed...',
      restart: 'Play Again',
      ammo: 'Ammo',
      instructions: 'Hold and drag to fire continuously. Predict rocket paths and use explosions to destroy them.',
      winMsg: 'You successfully defended Earth!',
      lossMsg: 'All turrets have been destroyed.',
    }
  }[language];

  const resetGame = useCallback(() => {
    setGameState({
      score: 0,
      status: 'PLAYING',
      wave: 1,
      missiles: [],
      enemyRockets: [],
      explosions: [],
      turrets: INITIAL_TURRETS.map(t => ({ ...t })),
      cities: INITIAL_CITIES.map(c => ({ ...c })),
    });
    spawnTimerRef.current = 0;
  }, []);

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (gameState.status !== 'PLAYING') return;
    isFiringRef.current = true;
    updateTargetPos(e);
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (gameState.status !== 'PLAYING') return;
    updateTargetPos(e);
  };

  const handlePointerUp = () => {
    isFiringRef.current = false;
  };

  const updateTargetPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    targetPosRef.current = {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const fireMissile = (x: number, y: number) => {
    // Don't fire if clicking too low
    if (y > 520) return;

    // Find best turret (nearest with ammo)
    let bestTurretIndex = -1;
    let minDist = Infinity;

    gameState.turrets.forEach((turret, index) => {
      if (turret.active && turret.ammo > 0) {
        const dist = Math.sqrt(Math.pow(turret.x - x, 2) + Math.pow(turret.y - y, 2));
        if (dist < minDist) {
          minDist = dist;
          bestTurretIndex = index;
        }
      }
    });

    if (bestTurretIndex !== -1) {
      const turret = gameState.turrets[bestTurretIndex];
      const newMissile: Missile = {
        id: Math.random().toString(36).substr(2, 9),
        startX: turret.x,
        startY: turret.y,
        x: turret.x,
        y: turret.y,
        targetX: x,
        targetY: y,
        progress: 0,
        speed: 0.03, // Slightly faster for machine gun feel
        color: '#4ade80',
      };

      setGameState(prev => {
        const newTurrets = [...prev.turrets];
        newTurrets[bestTurretIndex] = {
          ...newTurrets[bestTurretIndex],
          ammo: newTurrets[bestTurretIndex].ammo - 1
        };
        return {
          ...prev,
          missiles: [...prev.missiles, newMissile],
          turrets: newTurrets,
        };
      });
    }
  };

  const update = useCallback((time: number) => {
    if (lastTimeRef.current !== undefined) {
      const deltaTime = time - lastTimeRef.current;

      setGameState(prev => {
        if (prev.status !== 'PLAYING') return prev;

        let { score, missiles, enemyRockets, explosions, turrets, cities, wave, status } = prev;

        // 0. Fire Machine Gun
        fireCooldownRef.current -= deltaTime;
        if (isFiringRef.current && fireCooldownRef.current <= 0) {
          fireMissile(targetPosRef.current.x, targetPosRef.current.y);
          fireCooldownRef.current = 150; // Fire every 150ms
        }

        // 1. Update Missiles
        const nextMissiles: Missile[] = [];
        missiles.forEach(m => {
          const nextProgress = m.progress + m.speed;
          if (nextProgress >= 1) {
            // Explode!
            playExplosionSound(150, 0.4);
            explosions.push({
              id: Math.random().toString(36).substr(2, 9),
              x: m.targetX,
              y: m.targetY,
              radius: 0,
              maxRadius: 80,
              growing: true,
              life: 0,
            });
          } else {
            nextMissiles.push({
              ...m,
              progress: nextProgress,
              x: m.startX + (m.targetX - m.startX) * nextProgress,
              y: m.startY + (m.targetY - m.startY) * nextProgress,
            });
          }
        });

        // 2. Update Enemy Rockets
        const nextEnemyRockets: EnemyRocket[] = [];
        enemyRockets.forEach(r => {
          const nextProgress = r.progress + r.speed;
          const currentX = r.startX + (r.targetX - r.startX) * nextProgress;
          const currentY = r.startY + (r.targetY - r.startY) * nextProgress;

          // Check if destroyed by explosion
          const isDestroyed = explosions.some(exp => {
            const dist = Math.sqrt(Math.pow(exp.x - currentX, 2) + Math.pow(exp.y - currentY, 2));
            return dist < exp.radius;
          });

          if (isDestroyed) {
            score += 20;
            playExplosionSound(80, 0.3);
            // Small explosion at impact
            explosions.push({
              id: Math.random().toString(36).substr(2, 9),
              x: currentX,
              y: currentY,
              radius: 0,
              maxRadius: 20,
              growing: true,
              life: 0,
            });
          } else if (nextProgress >= 1) {
            // Hit target!
            playExplosionSound(50, 0.8);
            explosions.push({
              id: Math.random().toString(36).substr(2, 9),
              x: r.targetX,
              y: r.targetY,
              radius: 0,
              maxRadius: 50,
              growing: true,
              life: 0,
            });
            // Check what was hit
            turrets = turrets.map(t => {
              if (Math.abs(t.x - r.targetX) < 30) return { ...t, active: false, ammo: 0 };
              return t;
            });
            cities = cities.map(c => {
              if (Math.abs(c.x - r.targetX) < 20) return { ...c, active: false };
              return c;
            });
          } else {
            nextEnemyRockets.push({
              ...r,
              progress: nextProgress,
              x: currentX,
              y: currentY,
            });
          }
        });

        // 3. Update Explosions
        const nextExplosions: Explosion[] = [];
        explosions.forEach(e => {
          let nextRadius = e.radius;
          let nextGrowing = e.growing;
          let nextLife = e.life + 0.02;

          if (nextGrowing) {
            nextRadius += 2;
            if (nextRadius >= e.maxRadius) nextGrowing = false;
          } else {
            nextRadius -= 1.5;
          }

          if (nextRadius > 0 && nextLife < 1) {
            nextExplosions.push({
              ...e,
              radius: nextRadius,
              growing: nextGrowing,
              life: nextLife,
            });
          }
        });

        // 4. Spawn Enemy Rockets
        spawnTimerRef.current += deltaTime;
        const spawnInterval = Math.max(2000 - wave * 200, 500);
        if (spawnTimerRef.current > spawnInterval) {
          spawnTimerRef.current = 0;
          const startX = Math.random() * CANVAS_WIDTH;
          const targets = [...turrets.filter(t => t.active), ...cities.filter(c => c.active)];
          if (targets.length > 0) {
            const target = targets[Math.floor(Math.random() * targets.length)];
            nextEnemyRockets.push({
              id: Math.random().toString(36).substr(2, 9),
              startX,
              startY: 0,
              x: startX,
              y: 0,
              targetX: target.x,
              targetY: target.y,
              progress: 0,
              speed: 0.001 + (wave * 0.0002),
            });
          }
        }

        // 5. Check Win/Loss
        if (score >= WIN_SCORE) {
          status = 'WON';
        } else if (turrets.every(t => !t.active)) {
          status = 'LOST';
        }

        // Wave logic (optional, but let's just keep it simple)
        if (score > wave * 200) {
          wave += 1;
          // Refill ammo on wave increase
          turrets = turrets.map(t => t.active ? { ...t, ammo: t.maxAmmo } : t);
        }

        return {
          ...prev,
          score,
          missiles: nextMissiles,
          enemyRockets: nextEnemyRockets,
          explosions: nextExplosions,
          turrets,
          cities,
          wave,
          status,
        };
      });
    }
    lastTimeRef.current = time;
    requestRef.current = requestAnimationFrame(update);
  }, [gameState.status]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(update);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [update]);

  // Draw loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw Shanghai Skyline (Background)
    ctx.fillStyle = '#1a1a1a';
    
    // Oriental Pearl Tower (东方明珠)
    const opX = 100;
    ctx.fillRect(opX - 2, 350, 4, 200); // Main spire
    ctx.beginPath();
    ctx.arc(opX, 420, 15, 0, Math.PI * 2); // Top sphere
    ctx.fill();
    ctx.beginPath();
    ctx.arc(opX, 480, 22, 0, Math.PI * 2); // Bottom sphere
    ctx.fill();
    
    // Shanghai Tower (上海中心)
    const stX = 220;
    ctx.beginPath();
    ctx.moveTo(stX - 25, 550);
    ctx.lineTo(stX - 15, 250);
    ctx.quadraticCurveTo(stX, 230, stX + 15, 250);
    ctx.lineTo(stX + 25, 550);
    ctx.fill();

    // World Financial Center (环球金融中心 - Bottle Opener)
    const wfX = 350;
    ctx.fillRect(wfX - 20, 280, 40, 270);
    ctx.clearRect(wfX - 10, 290, 20, 30); // The "hole"
    ctx.fillStyle = '#1a1a1a'; // Restore fill style after clearRect
    
    // Jin Mao Tower (金茂大厦)
    const jmX = 500;
    for (let i = 0; i < 8; i++) {
      const width = 40 - i * 4;
      ctx.fillRect(jmX - width / 2, 320 + i * 30, width, 30);
    }
    ctx.fillRect(jmX - 2, 300, 4, 20); // Spire

    // Other generic buildings
    ctx.fillRect(600, 400, 30, 150);
    ctx.fillRect(650, 450, 40, 100);
    ctx.fillRect(720, 380, 25, 170);

    // Draw Ground
    ctx.fillStyle = '#262626';
    ctx.fillRect(0, 550, CANVAS_WIDTH, 50);

    // Draw Cities
    gameState.cities.forEach(city => {
      if (city.active) {
        ctx.fillStyle = '#3b82f6';
        ctx.fillRect(city.x - 15, city.y - 20, 30, 20);
        ctx.fillStyle = '#1d4ed8';
        ctx.fillRect(city.x - 10, city.y - 25, 10, 5);
        ctx.fillRect(city.x + 2, city.y - 28, 8, 8);
      } else {
        ctx.fillStyle = '#451a03';
        ctx.beginPath();
        ctx.arc(city.x, city.y, 10, 0, Math.PI, true);
        ctx.fill();
      }
    });

    // Draw Turrets
    gameState.turrets.forEach(turret => {
      if (turret.active) {
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.moveTo(turret.x - 20, turret.y);
        ctx.lineTo(turret.x + 20, turret.y);
        ctx.lineTo(turret.x, turret.y - 30);
        ctx.closePath();
        ctx.fill();
        
        // Ammo count
        ctx.fillStyle = 'white';
        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(turret.ammo.toString(), turret.x, turret.y + 15);
      } else {
        ctx.fillStyle = '#451a03';
        ctx.fillRect(turret.x - 15, turret.y - 10, 30, 10);
      }
    });

    // Draw Enemy Rockets
    gameState.enemyRockets.forEach(r => {
      // Trail
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(r.startX, r.startY);
      ctx.lineTo(r.x, r.y);
      ctx.stroke();
      
      // Missile Body
      const angle = Math.atan2(r.targetY - r.startY, r.targetX - r.startX);
      ctx.save();
      ctx.translate(r.x, r.y);
      ctx.rotate(angle);
      
      // Body
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(-6, -2, 8, 4);
      // Head
      ctx.fillStyle = '#f87171';
      ctx.beginPath();
      ctx.moveTo(2, -2);
      ctx.lineTo(6, 0);
      ctx.lineTo(2, 2);
      ctx.fill();
      // Fins
      ctx.fillStyle = '#991b1b';
      ctx.fillRect(-6, -4, 2, 2);
      ctx.fillRect(-6, 2, 2, 2);
      
      ctx.restore();
    });

    // Draw Player Missiles
    gameState.missiles.forEach(m => {
      // Thicker Trail
      ctx.strokeStyle = 'rgba(74, 222, 128, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(m.startX, m.startY);
      ctx.lineTo(m.x, m.y);
      ctx.stroke();

      // Glowing Head
      const headGradient = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, 4);
      headGradient.addColorStop(0, 'white');
      headGradient.addColorStop(1, '#4ade80');
      ctx.fillStyle = headGradient;
      ctx.beginPath();
      ctx.arc(m.x, m.y, 4, 0, Math.PI * 2);
      ctx.fill();

      // Target marker (more prominent)
      ctx.strokeStyle = '#4ade80';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(m.targetX - 8, m.targetY - 8);
      ctx.lineTo(m.targetX + 8, m.targetY + 8);
      ctx.moveTo(m.targetX + 8, m.targetY - 8);
      ctx.lineTo(m.targetX - 8, m.targetY + 8);
      ctx.stroke();
      
      // Target circle
      ctx.strokeStyle = 'rgba(74, 222, 128, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(m.targetX, m.targetY, 12, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Draw Explosions
    gameState.explosions.forEach(e => {
      const gradient = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.radius);
      gradient.addColorStop(0, 'white');
      gradient.addColorStop(0.2, '#fbbf24');
      gradient.addColorStop(0.6, '#ef4444');
      gradient.addColorStop(1, 'transparent');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
      ctx.fill();
    });

  }, [gameState]);

  return (
    <div className="min-h-screen bg-neutral-950 text-white font-sans selection:bg-emerald-500/30 flex flex-col items-center justify-center p-4">
      {/* Header */}
      <div className="w-full max-w-4xl flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500 rounded-lg shadow-lg shadow-emerald-500/20">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex bg-neutral-900 rounded-full p-1 border border-white/5">
            <button 
              onClick={() => setLanguage('zh')}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium transition-all",
                language === 'zh' ? "bg-emerald-500 text-white" : "text-neutral-400 hover:text-white"
              )}
            >
              中文
            </button>
            <button 
              onClick={() => setLanguage('en')}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium transition-all",
                language === 'en' ? "bg-emerald-500 text-white" : "text-neutral-400 hover:text-white"
              )}
            >
              EN
            </button>
          </div>
        </div>
      </div>

      {/* Main Game Area */}
      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-blue-500 rounded-2xl blur opacity-20 group-hover:opacity-30 transition duration-1000"></div>
        <div className="relative bg-neutral-900 rounded-xl border border-white/10 overflow-hidden shadow-2xl">
          {/* HUD */}
          <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start pointer-events-none z-10">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10">
                <Trophy className="w-4 h-4 text-yellow-500" />
                <span className="text-sm font-mono font-bold">{t.score}: {gameState.score}</span>
                <span className="text-[10px] text-neutral-500 ml-2">/ {WIN_SCORE}</span>
              </div>
              <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10">
                <Target className="w-4 h-4 text-emerald-500" />
                <span className="text-sm font-mono font-bold">{t.wave}: {gameState.wave}</span>
              </div>
            </div>

            <div className="flex gap-2">
              {gameState.turrets.map((turret, i) => (
                <div key={turret.id} className={cn(
                  "flex flex-col items-center gap-1 bg-black/40 backdrop-blur-md p-2 rounded-lg border transition-all",
                  turret.active ? "border-white/10" : "border-red-500/50 grayscale opacity-50"
                )}>
                  <span className="text-[10px] uppercase tracking-wider text-neutral-500">{t.ammo}</span>
                  <span className={cn(
                    "text-lg font-mono font-bold leading-none",
                    turret.ammo < 5 ? "text-red-500 animate-pulse" : "text-white"
                  )}>
                    {turret.ammo}
                  </span>
                  <div className="w-8 h-1 bg-neutral-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 transition-all duration-300" 
                      style={{ width: `${(turret.ammo / turret.maxAmmo) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Canvas */}
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            onMouseDown={handlePointerDown}
            onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            onMouseLeave={handlePointerUp}
            onTouchStart={handlePointerDown}
            onTouchMove={handlePointerMove}
            onTouchEnd={handlePointerUp}
            className="max-w-full h-auto cursor-crosshair touch-none"
          />

          {/* Overlays */}
          <AnimatePresence>
            {gameState.status !== 'PLAYING' && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-20 p-6 text-center"
              >
                <div className="max-w-md">
                  {gameState.status === 'START' && (
                    <motion.div
                      initial={{ y: 20 }}
                      animate={{ y: 0 }}
                    >
                      <h2 className="text-4xl font-black mb-4 tracking-tight bg-gradient-to-br from-white to-neutral-500 bg-clip-text text-transparent">
                        {t.title}
                      </h2>
                      <p className="text-neutral-400 mb-8 leading-relaxed">
                        {t.instructions}
                      </p>
                      <button 
                        onClick={resetGame}
                        className="group relative px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl font-bold text-lg transition-all hover:scale-105 active:scale-95 shadow-xl shadow-emerald-500/20"
                      >
                        <span className="flex items-center gap-2">
                          <Target className="w-5 h-5" />
                          {t.start}
                        </span>
                      </button>
                    </motion.div>
                  )}

                  {gameState.status === 'WON' && (
                    <motion.div
                      initial={{ scale: 0.9 }}
                      animate={{ scale: 1 }}
                    >
                      <div className="w-20 h-20 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-yellow-500/50">
                        <Trophy className="w-10 h-10 text-yellow-500" />
                      </div>
                      <h2 className="text-4xl font-black mb-2 text-yellow-500">{t.win}</h2>
                      <p className="text-neutral-400 mb-8">{t.winMsg}</p>
                      <div className="text-2xl font-mono mb-8">
                        {t.score}: <span className="text-white font-bold">{gameState.score}</span>
                      </div>
                      <button 
                        onClick={resetGame}
                        className="px-8 py-4 bg-white text-black rounded-xl font-bold text-lg hover:bg-neutral-200 transition-all flex items-center gap-2 mx-auto"
                      >
                        <RotateCcw className="w-5 h-5" />
                        {t.restart}
                      </button>
                    </motion.div>
                  )}

                  {gameState.status === 'LOST' && (
                    <motion.div
                      initial={{ scale: 0.9 }}
                      animate={{ scale: 1 }}
                    >
                      <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/50">
                        <Target className="w-10 h-10 text-red-500" />
                      </div>
                      <h2 className="text-4xl font-black mb-2 text-red-500">{t.loss}</h2>
                      <p className="text-neutral-400 mb-8">{t.lossMsg}</p>
                      <div className="text-2xl font-mono mb-8">
                        {t.score}: <span className="text-white font-bold">{gameState.score}</span>
                      </div>
                      <button 
                        onClick={resetGame}
                        className="px-8 py-4 bg-red-500 text-white rounded-xl font-bold text-lg hover:bg-red-400 transition-all flex items-center gap-2 mx-auto"
                      >
                        <RotateCcw className="w-5 h-5" />
                        {t.restart}
                      </button>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-8 flex flex-col items-center gap-4">
        <div className="flex items-center gap-6 text-neutral-500 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-emerald-500 rounded-full" />
            <span>{language === 'zh' ? '拦截导弹' : 'Interceptor'}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full" />
            <span>{language === 'zh' ? '敌方火箭' : 'Enemy Rocket'}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded-sm" />
            <span>{language === 'zh' ? '城市' : 'City'}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2 text-neutral-600 text-xs bg-neutral-900/50 px-4 py-2 rounded-full border border-white/5">
          <Info className="w-3 h-3" />
          <span>{language === 'zh' ? '提示：中间炮台弹药最充足' : 'Tip: Middle turret has the most ammo'}</span>
        </div>
      </div>
    </div>
  );
}
