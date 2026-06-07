import React, { useEffect, useRef, useState } from 'react';
import { CarFront, Play, Pause, RotateCcw, Trophy, Zap, Map, Music, SkipForward, X } from 'lucide-react';
import { initAudio, playClick, playCrash, playBoostPickup, playStageUp, startEngine, updateEngineSpeed, stopEngine } from '../lib/audio';

const ROAD_WIDTH = 400;
const CAR_WIDTH = 50;
const CAR_HEIGHT = 90;
const LANE_COUNT = 3;
const ENEMY_SPEED_BASE = 5;
const SCROLL_SPEED_BASE = 8;
const PLAYER_SPEED = 7;

type GameState = 'START' | 'PLAYING' | 'GAMEOVER' | 'PAUSED';

interface GameObject {
  x: number;
  y: number;
  width: number;
  height: number;
  speed?: number;
  color?: string;
  type?: 'enemy' | 'booster';
}

const drawSceneryItem = (ctx: CanvasRenderingContext2D, x: number, y: number, stageName: string, scale: number = 1, isRightSide: boolean = false) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  
  if (stageName === 'RAJASTHAN DUNES') {
    // Cactus
    ctx.fillStyle = '#15803d'; 
    ctx.fillRect(-5, -30, 10, 40);
    ctx.fillRect(-15, -20, 10, 5);
    ctx.fillRect(5, -10, 10, 5);
    ctx.fillRect(-15, -30, 5, 10);
    ctx.fillRect(15, -20, 5, 10);
  } else if (stageName === 'HIMALAYAN SNOW') {
    // Pine Tree
    ctx.fillStyle = '#065f46';
    ctx.beginPath();
    ctx.moveTo(0, -60);
    ctx.lineTo(25, 0);
    ctx.lineTo(-25, 0);
    ctx.fill();
    ctx.fillStyle = '#047857';
    ctx.beginPath();
    ctx.moveTo(0, -40);
    ctx.lineTo(20, 10);
    ctx.lineTo(-20, 10);
    ctx.fill();
    ctx.fillStyle = '#78716c'; // trunk
    ctx.fillRect(-5, 0, 10, 15);
  } else if (stageName === 'NEON CITY') {
    // Neon building
    ctx.fillStyle = '#0f172a'; // dark building
    ctx.fillRect(-20, -100, 40, 100);
    ctx.strokeStyle = '#c026d3';
    ctx.lineWidth = 2;
    ctx.strokeRect(-20, -100, 40, 100);
    // windows
    ctx.fillStyle = '#0ea5e9';
    for(let w = -15; w <= 5; w += 20) {
      for(let wh = -90; wh < -10; wh += 20) {
        ctx.fillRect(w, wh, 10, 10);
      }
    }
  } else if (stageName === 'CYBER WASTELAND') {
    // Futuristic glowing rocks/spikes
    ctx.fillStyle = '#022c22';
    ctx.beginPath();
    ctx.moveTo(0, -50);
    ctx.lineTo(15, 0);
    ctx.lineTo(-15, 0);
    ctx.fill();
    ctx.fillStyle = '#10b981'; // glow
    ctx.beginPath();
    ctx.moveTo(0, -30);
    ctx.lineTo(5, 0);
    ctx.lineTo(-5, 0);
    ctx.fill();
  } else if (stageName === 'MIDNIGHT HIGHWAY') {
    // Lamppost
    ctx.scale(isRightSide ? -1 : 1, 1);
    ctx.fillStyle = '#3f3f46';
    ctx.fillRect(-3, -80, 6, 80);
    ctx.fillRect(0, -80, 25, 5); // Arm extending towards road
    // Light
    ctx.fillStyle = '#eab308';
    ctx.beginPath();
    ctx.arc(20, -75, 4, 0, Math.PI * 2);
    ctx.fill();
    // Glow
    ctx.fillStyle = 'rgba(234, 179, 8, 0.15)';
    ctx.beginPath();
    ctx.moveTo(20, -75);
    ctx.lineTo(60, 20);
    ctx.lineTo(-20, 20);
    ctx.fill();
  }
  
  ctx.restore();
};

const STAGE_THEMES = [
  { name: 'RAJASTHAN DUNES', bg: '#18181b', road: '#ffffff', lines: '#ea580c', border: '#3f3f46', text: 'text-orange-500', carMain: '#ea580c', carHood: '#c2410c' },
  { name: 'HIMALAYAN SNOW', bg: '#0f172a', road: '#ffffff', lines: '#38bdf8', border: '#475569', text: 'text-sky-500', carMain: '#10b981', carHood: '#059669' },
  { name: 'NEON CITY', bg: '#1e1b4b', road: '#ffffff', lines: '#c026d3', border: '#701a75', text: 'text-fuchsia-500', carMain: '#0ea5e9', carHood: '#0284c7' },
  { name: 'CYBER WASTELAND', bg: '#111827', road: '#ffffff', lines: '#10b981', border: '#064e3b', text: 'text-emerald-500', carMain: '#f59e0b', carHood: '#d97706' },
  { name: 'MIDNIGHT HIGHWAY', bg: '#09090b', road: '#ffffff', lines: '#eab308', border: '#27272a', text: 'text-yellow-500', carMain: '#a855f7', carHood: '#7e22ce' }
];

const THAR_COLORS = [
  { name: 'RAGE ORANGE', primary: '#ea580c', secondary: '#c2410c' },
  { name: 'STEALTH BLACK', primary: '#18181b', secondary: '#09090b', text: 'text-zinc-500' },
  { name: 'MYSTIC BLUE', primary: '#0ea5e9', secondary: '#0284c7' },
  { name: 'FOREST GREEN', primary: '#10b981', secondary: '#059669' },
  { name: 'CYBER PURPLE', primary: '#a855f7', secondary: '#7e22ce' },
  { name: 'CRIMSON RED', primary: '#ef4444', secondary: '#b91c1c' },
];

const STAGES = Array.from({ length: 100 }).map((_, i) => {
  const req = i < 9 ? i * 100 : 900 + (i - 9) * 1000;
  const t = STAGE_THEMES[i % STAGE_THEMES.length];
  return { ...t, name: t.name, req };
});

export default function TharRacingGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [gameState, setGameState] = useState<GameState>('START');
  const [selectedColorIndex, setSelectedColorIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [stageIndex, setStageIndex] = useState(0);
  const [isBoostingReact, setIsBoostingReact] = useState(false);
  const [stageClearMsg, setStageClearMsg] = useState<{clearedStageNumber: number, nextStageName: string} | null>(null);

  const [audioFiles, setAudioFiles] = useState<File[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const isLocalMusicPlaying = audioFiles.length > 0;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setAudioFiles(prev => [...prev, ...files]);
    }
  };

  useEffect(() => {
    if (audioFiles.length > 0 && audioRef.current) {
       if (audioRef.current.src) URL.revokeObjectURL(audioRef.current.src);
       audioRef.current.src = URL.createObjectURL(audioFiles[currentTrackIndex]);
       audioRef.current.play().catch(()=>{});
    }
  }, [audioFiles, currentTrackIndex]);
  
  const playNextTrack = () => {
    if (audioFiles.length > 0) {
      setCurrentTrackIndex(i => (i + 1) % audioFiles.length);
    }
  };

  const removeLocalSongs = () => {
    setAudioFiles([]);
    setCurrentTrackIndex(0);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
  };

  // Use refs for mutable game state to avoid re-renders in the loop
  const stateRef = useRef({
    gameState: 'START' as GameState,
    carColorIndex: 0,
    score: 0,
    stageIndex: 0,
    isBoosting: false,
    boostEndTime: 0,
    scrollOffset: 0,
    player: {
      x: ROAD_WIDTH / 2 - CAR_WIDTH / 2,
      y: 0, // Will be set to canvas bottom
      width: CAR_WIDTH,
      height: CAR_HEIGHT,
      isMovingLeft: false,
      isMovingRight: false,
    },
    enemies: [] as GameObject[],
    lines: [] as { y: number }[],
    speedMultiplier: 1,
    frameCount: 0,
    lastTime: 0,
  });

  // Touch controls
  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent, direction: 'left' | 'right') => {
    e.preventDefault();
    if (direction === 'left') stateRef.current.player.isMovingLeft = true;
    if (direction === 'right') stateRef.current.player.isMovingRight = true;
  };

  const handleTouchEnd = (e: React.TouchEvent | React.MouseEvent, direction: 'left' | 'right') => {
    e.preventDefault();
    if (direction === 'left') stateRef.current.player.isMovingLeft = false;
    if (direction === 'right') stateRef.current.player.isMovingRight = false;
  };

  useEffect(() => {
    stateRef.current.carColorIndex = selectedColorIndex;
  }, [selectedColorIndex]);

  const startGame = () => {
    initAudio();
    playClick();
    startEngine(isLocalMusicPlaying);

    const canvas = canvasRef.current;
    if (!canvas) return;

    stateRef.current = {
      ...stateRef.current,
      gameState: 'PLAYING',
      score: 0,
      stageIndex: 0,
      isBoosting: false,
      boostEndTime: 0,
      scrollOffset: 0,
      player: {
        ...stateRef.current.player,
        x: ROAD_WIDTH / 2 - CAR_WIDTH / 2,
        y: canvas.height - CAR_HEIGHT - 40,
        isMovingLeft: false,
        isMovingRight: false,
      },
      enemies: [],
      lines: Array.from({ length: 6 }).map((_, i) => ({ y: i * 150 })),
      speedMultiplier: 1,
      frameCount: 0,
    };
    
    setGameState('PLAYING');
    setScore(0);
    setStageIndex(0);
    setIsBoostingReact(false);
    setStageClearMsg(null);
  };

  const gameOver = () => {
    stopEngine();
    playCrash();
    stateRef.current.gameState = 'GAMEOVER';
    setGameState('GAMEOVER');
    if (stateRef.current.score > highScore) {
      setHighScore(Math.floor(stateRef.current.score));
    }
  };

  const pauseGame = () => {
    if (stateRef.current.gameState !== 'PLAYING') return;
    stateRef.current.gameState = 'PAUSED';
    setGameState('PAUSED');
    if (audioRef.current && isLocalMusicPlaying) {
      audioRef.current.pause();
    }
  };

  const resumeGame = () => {
    if (stateRef.current.gameState !== 'PAUSED') return;
    stateRef.current.gameState = 'PLAYING';
    stateRef.current.lastTime = performance.now(); // Avoid huge dt jump
    setGameState('PLAYING');
    if (audioRef.current && isLocalMusicPlaying) {
      audioRef.current.play().catch(()=>{});
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') stateRef.current.player.isMovingLeft = true;
      if (e.key === 'ArrowRight' || e.key === 'd') stateRef.current.player.isMovingRight = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') stateRef.current.player.isMovingLeft = false;
      if (e.key === 'ArrowRight' || e.key === 'd') stateRef.current.player.isMovingRight = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Main game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set initial player Y
    if (stateRef.current.player.y === 0) {
       stateRef.current.player.y = canvas.height - CAR_HEIGHT - 40;
    }

    let animationFrameId: number;

    const drawThar = (x: number, y: number, w: number, h: number, primaryColor: string = '#ea580c', secondaryColor: string = '#c2410c') => {
      // Top-down view of Mahindra Thar
      
      // Wheels
      ctx.fillStyle = '#111';
      ctx.fillRect(x - 5, y + 10, 8, 20); // Top Left
      ctx.fillRect(x + w - 3, y + 10, 8, 20); // Top Right
      ctx.fillRect(x - 5, y + h - 30, 8, 20); // Bottom Left
      ctx.fillRect(x + w - 3, y + h - 30, 8, 20); // Bottom Right

      // Main body
      ctx.fillStyle = primaryColor;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 6);
      ctx.fill();

      // Hood
      ctx.fillStyle = secondaryColor;
      ctx.fillRect(x + 4, y + 4, w - 8, 25);

      // Windshield
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.moveTo(x + 4, y + 30);
      ctx.lineTo(x + w - 4, y + 30);
      ctx.lineTo(x + w - 8, y + 45);
      ctx.lineTo(x + 8, y + 45);
      ctx.fill();

      // Soft top / Roof (Black/Dark Grey)
      ctx.fillStyle = '#222';
      ctx.fillRect(x + 6, y + 45, w - 12, h - 50);

      // Spare Tire
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h, 10, 0, Math.PI * 2);
      ctx.fill();
    };

    const drawBooster = (booster: GameObject) => {
      const { x, y, width: w, height: h } = booster;
      
      const cx = x + w / 2;
      const cy = y + h / 2;

      // Outer glow
      ctx.beginPath();
      ctx.arc(cx, cy, w * 0.8, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.3)';
      ctx.fill();

      // Inner core
      ctx.beginPath();
      ctx.arc(cx, cy, w * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = '#38bdf8';
      ctx.fill();
      
      // Lightning bolt icon (simplified)
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(cx - 2, cy - 8);
      ctx.lineTo(cx + 6, cy - 8);
      ctx.lineTo(cx + 2, cy);
      ctx.lineTo(cx + 8, cy);
      ctx.lineTo(cx - 4, cy + 10);
      ctx.lineTo(cx, cy + 2);
      ctx.lineTo(cx - 6, cy + 2);
      ctx.closePath();
      ctx.fill();
    };

    const drawEnemy = (enemy: GameObject) => {
      const { x, y, width: w, height: h, color } = enemy;
      
      // Wheels
      ctx.fillStyle = '#111';
      ctx.fillRect(x - 3, y + 15, 6, 18);
      ctx.fillRect(x + w - 3, y + 15, 6, 18);
      ctx.fillRect(x - 3, y + h - 30, 6, 18);
      ctx.fillRect(x + w - 3, y + h - 30, 6, 18);

      // Body
      ctx.fillStyle = color || '#3b82f6';
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 8);
      ctx.fill();

      // Windows
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(x + 6, y + 20, w - 12, 15); // Front window
      ctx.fillRect(x + 6, y + h - 25, w - 12, 10); // Back window
    };

    const updateAndDraw = (time: number) => {
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const state = stateRef.current;
      const dt = time - state.lastTime || 0;
      state.lastTime = time;

      const currentStage = STAGES[state.stageIndex] || STAGES[0];

      // Determine speeds
      const isPaused = state.gameState === 'PAUSED';
      const effectiveMultiplier = state.gameState === 'PLAYING' 
        ? (state.isBoosting ? state.speedMultiplier * 2.5 : state.speedMultiplier) 
        : (isPaused ? 0 : 0.3); // Idle scroll if start or gameover
      const currentSpeedBase = state.gameState === 'PLAYING'
        ? (state.isBoosting ? SCROLL_SPEED_BASE * 2 : SCROLL_SPEED_BASE)
        : (isPaused ? 0 : SCROLL_SPEED_BASE);

      state.scrollOffset += currentSpeedBase * effectiveMultiplier;

      // Draw Grass/Sand
      ctx.fillStyle = currentStage.bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw Road
      const roadX = canvas.width / 2 - ROAD_WIDTH / 2;
      ctx.fillStyle = currentStage.road;
      ctx.fillRect(roadX, 0, ROAD_WIDTH, canvas.height);

      // Road Speed Textures (cracks/noise) removed as requested.

      // Draw Shoulders (Grey lines on edge)
      ctx.fillStyle = currentStage.border;
      ctx.fillRect(roadX + 10, 0, 5, canvas.height);
      ctx.fillRect(roadX + ROAD_WIDTH - 15, 0, 5, canvas.height);

      // Rumble Strips on Shoulders
      ctx.fillStyle = currentStage.bg;
      for (let y = (state.scrollOffset) % 60 - 60; y < canvas.height; y += 60) {
        ctx.fillRect(roadX + 10, y, 5, 30);
        ctx.fillRect(roadX + ROAD_WIDTH - 15, y, 5, 30);
      }

      // Draw Scenery (Map elements)
      const scenerySpacing = 300;
      for (let y = (state.scrollOffset) % scenerySpacing - scenerySpacing; y < canvas.height + 100; y += scenerySpacing) {
        // Left side
        drawSceneryItem(ctx, roadX / 2, y, currentStage.name, 1.5, false);
        // Right side
        drawSceneryItem(ctx, roadX + ROAD_WIDTH + roadX / 2, y + 150, currentStage.name, 1.5, true);
      }

      // Draw and Move Dashed Lines
      ctx.fillStyle = currentStage.lines;
      state.lines.forEach(line => {
        line.y += currentSpeedBase * effectiveMultiplier;
        if (line.y > canvas.height) {
          line.y = -150;
        }
        const laneWidth = ROAD_WIDTH / LANE_COUNT;
        for (let i = 1; i < LANE_COUNT; i++) {
          ctx.shadowBlur = 10;
          ctx.shadowColor = currentStage.lines;
          ctx.fillRect(roadX + i * laneWidth - 3, line.y, 6, 50);
          ctx.shadowBlur = 0; // reset
        }
      });

      if (state.gameState === 'PLAYING') {
        state.frameCount++;

        // Boost logic
        if (state.isBoosting && time > state.boostEndTime) {
          state.isBoosting = false;
          setIsBoostingReact(false);
        }

        state.score += 0.05 * effectiveMultiplier;
        if (state.frameCount % 10 === 0) {
           setScore(Math.floor(state.score));
        }

        // Stage progression
        let newStageIdx = state.stageIndex;
        for (let i = STAGES.length - 1; i >= 0; i--) {
          if (state.score >= STAGES[i].req) {
            newStageIdx = i;
            break;
          }
        }
        if (newStageIdx !== state.stageIndex) {
          playStageUp();
          setStageClearMsg({ clearedStageNumber: state.stageIndex + 1, nextStageName: STAGES[newStageIdx].name });
          setTimeout(() => {
             setStageClearMsg(null);
          }, 1000);
          state.stageIndex = newStageIdx;
          setStageIndex(newStageIdx);
        }

        // Increase difficulty
        if (state.frameCount % 600 === 0 && !state.isBoosting) {
          state.speedMultiplier += 0.1;
        }

        // Player Movement
        const effectivePlayerSpeed = state.isBoosting ? PLAYER_SPEED * 1.5 : PLAYER_SPEED;
        if (state.player.isMovingLeft) {
          state.player.x -= effectivePlayerSpeed;
        }
        if (state.player.isMovingRight) {
          state.player.x += effectivePlayerSpeed;
        }
        
        // Strict boundary limits
        if (state.player.x < roadX + 15) {
          state.player.x = roadX + 15;
        } else if (state.player.x > roadX + ROAD_WIDTH - state.player.width - 15) {
          state.player.x = roadX + ROAD_WIDTH - state.player.width - 15;
        }

        // Spawn Enemies or Boosters
        const spawnRate = Math.max(30, 100 - state.speedMultiplier * 10);
        if (state.frameCount % Math.floor(spawnRate) === 0) {
          const laneWidth = ROAD_WIDTH / LANE_COUNT;
          const lane = Math.floor(Math.random() * LANE_COUNT);
          
          // 5% chance for a booster instead of an enemy
          const isBooster = Math.random() < 0.05;

          if (isBooster) {
            state.enemies.push({
              x: roadX + lane * laneWidth + laneWidth / 2 - 15,
              y: -CAR_HEIGHT,
              width: 30,
              height: 30,
              speed: SCROLL_SPEED_BASE * state.speedMultiplier, // Boosters move with the road
              type: 'booster'
            });
          } else {
            const enemyColors = ['#3f3f46', '#52525b', '#71717a', '#18181b'];
            state.enemies.push({
              x: roadX + lane * laneWidth + laneWidth / 2 - (CAR_WIDTH - 10) / 2,
              y: -CAR_HEIGHT,
              width: CAR_WIDTH - 10,
              height: CAR_HEIGHT - 5,
              speed: ENEMY_SPEED_BASE * state.speedMultiplier + Math.random() * 2,
              color: enemyColors[Math.floor(Math.random() * enemyColors.length)],
              type: 'enemy'
            });
          }
        }

        // Update and draw Game Objects
        for (let i = state.enemies.length - 1; i >= 0; i--) {
          const obj = state.enemies[i];
          
          // Boosters should speed up if we are boosting
          if (obj.type === 'booster') {
             obj.y += currentSpeedBase * effectiveMultiplier;
          } else {
             obj.y += obj.speed || ENEMY_SPEED_BASE;
          }

          // Collision Detection
          if (
            state.player.x < obj.x + obj.width &&
            state.player.x + state.player.width > obj.x &&
            state.player.y < obj.y + obj.height &&
            state.player.y + state.player.height > obj.y
          ) {
            if (obj.type === 'booster') {
              playBoostPickup();
              state.isBoosting = true;
              state.boostEndTime = time + 3000; // 3 seconds boost
              setIsBoostingReact(true);
              state.enemies.splice(i, 1);
              continue;
            } else if (!state.isBoosting) {
              // Only crash if not boosting
              gameOver();
            } else {
              // Destroy enemy if boosting
               state.enemies.splice(i, 1);
               continue;
            }
          }

          if (obj.y > canvas.height) {
            state.enemies.splice(i, 1);
          } else {
            if (obj.type === 'booster') {
               drawBooster(obj);
            } else {
               drawEnemy(obj);
            }
          }
        }
        
      } else {
        // Draw enemies static
        state.enemies.forEach(obj => {
           if (obj.type === 'booster') drawBooster(obj);
           else drawEnemy(obj);
        });
      }

      updateEngineSpeed(state.speedMultiplier, state.isBoosting, isLocalMusicPlaying || state.gameState === 'PAUSED');

      // Draw Player
      const selectedThar = THAR_COLORS[state.carColorIndex];
      drawThar(state.player.x, state.player.y, state.player.width, state.player.height, selectedThar.primary, selectedThar.secondary);

      animationFrameId = requestAnimationFrame(updateAndDraw);
    };

    animationFrameId = requestAnimationFrame(updateAndDraw);

    return () => {
      cancelAnimationFrame(animationFrameId);
      stopEngine();
    };
  }, []);

  return (
    <div className="relative w-full max-w-2xl mx-auto h-full max-h-[900px] flex justify-center items-center overflow-hidden" ref={containerRef}>
      
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={800}
        height={900}
        className="w-full h-full object-cover shadow-2xl"
      />

      {/* Control Overlays (for mobile) */}
      {gameState === 'PLAYING' && (
        <div className="absolute inset-0 flex z-10">
          <div 
            className="w-1/2 h-full active:bg-white/5 transition-colors pointer-events-auto"
            onPointerDown={(e) => handleTouchStart(e as any, 'left')}
            onPointerUp={(e) => handleTouchEnd(e as any, 'left')}
            onPointerLeave={(e) => handleTouchEnd(e as any, 'left')}
          />
          <div 
            className="w-1/2 h-full active:bg-white/5 transition-colors pointer-events-auto"
            onPointerDown={(e) => handleTouchStart(e as any, 'right')}
            onPointerUp={(e) => handleTouchEnd(e as any, 'right')}
            onPointerLeave={(e) => handleTouchEnd(e as any, 'right')}
          />
        </div>
      )}

      {/* Music Player */}
      <div className="absolute bottom-4 right-4 sm:bottom-8 sm:right-8 z-40 flex items-center gap-2 pointer-events-auto">
        <audio ref={audioRef} onEnded={playNextTrack} />
        {audioFiles.length > 0 ? (
          <div className="bg-zinc-900/80 backdrop-blur-md border border-zinc-700 rounded-lg px-4 py-2 flex items-center gap-3 shadow-xl">
             <div className="flex flex-col">
                <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest">Now Playing</span>
                <span className="text-zinc-100 text-xs font-bold truncate max-w-[120px]">{audioFiles[currentTrackIndex].name}</span>
             </div>
             <button onClick={playNextTrack} className="p-2 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-white transition-colors cursor-pointer relative z-50">
               <SkipForward size={16} />
             </button>
             <button onClick={removeLocalSongs} className="p-2 hover:bg-zinc-800 rounded-md text-red-400 hover:text-red-300 transition-colors cursor-pointer relative z-50" title="Remove local song">
               <X size={16} />
             </button>
          </div>
        ) : (
          <label className="bg-zinc-900/80 hover:bg-zinc-800 backdrop-blur-md border border-zinc-700 rounded-lg px-4 py-3 flex items-center gap-2 shadow-xl cursor-pointer text-zinc-400 hover:text-white transition-colors relative z-50">
            <Music size={16} />
            <span className="text-[10px] uppercase font-bold tracking-widest hidden sm:inline">Local Music</span>
            <input type="file" accept="audio/*" multiple className="hidden pointer-events-auto" onChange={handleFileUpload} />
          </label>
        )}
      </div>



      {/* HUD Score & Stage */}
      {(gameState === 'PLAYING' || gameState === 'PAUSED') && (
        <div className="absolute top-4 left-4 right-4 sm:top-8 sm:left-8 sm:right-8 flex justify-between items-start pointer-events-none z-20">
          
          {/* Stage Info */}
          <div className="bg-zinc-900/80 backdrop-blur-md border border-zinc-700 rounded-lg px-4 py-3 flex flex-col items-start shadow-xl pointer-events-auto">
            <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest mb-1 flex items-center gap-1"><Map size={12}/> Stage {stageIndex + 1}</span>
            <span className={`${STAGES[stageIndex].text} text-sm sm:text-base font-black italic tracking-wider uppercase leading-none`}>{STAGES[stageIndex].name}</span>
          </div>

          <div className="flex gap-2 items-start pointer-events-auto">
            {/* Pause Button */}
            {gameState === 'PLAYING' && (
              <button 
                onClick={(e) => { e.stopPropagation(); pauseGame(); }} 
                className="bg-zinc-900/80 backdrop-blur-md border border-zinc-700 rounded-lg p-3 sm:px-4 sm:py-3 shadow-xl hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors h-full flex items-center justify-center cursor-pointer"
                title="Pause Game"
              >
                <Pause size={24} />
              </button>
            )}

            {/* Detailed Score Card */}
            <div className="bg-zinc-900/80 backdrop-blur-md border border-zinc-700 rounded-lg px-4 py-3 flex flex-col items-end shadow-xl">
              <div className="flex gap-4">
                <div className="flex flex-col items-end">
                   <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest mb-1">Score</span>
                   <span className="text-zinc-100 text-2xl sm:text-3xl font-black italic leading-none">{score}m</span>
                </div>
                <div className="flex flex-col items-end border-l border-zinc-700 pl-4 ml-2">
                   <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest mb-1">Speed</span>
                   <span className="text-orange-500 text-lg sm:text-2xl font-black italic leading-none">
                      {(stateRef.current.speedMultiplier * 100).toFixed(0)} km/h
                   </span>
                </div>
              </div>
              {isBoostingReact && (
                <div className="mt-2 text-sky-400 text-xs font-black italic animate-pulse flex items-center gap-1">
                  <Zap size={14} fill="currentColor" /> NITRO BOOST ACTIVE (INVINCIBLE)
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Stage Clear Overlay */}
      {stageClearMsg && gameState === 'PLAYING' && (
        <div className="absolute top-[35%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none animate-bounce">
          <div className="bg-[#0c0c0e]/95 backdrop-blur-md border border-orange-500 text-center px-8 py-6 rounded-[2rem] shadow-[0_0_80px_rgba(234,88,12,0.6)]">
            <h2 className="text-3xl sm:text-5xl font-black italic uppercase tracking-tighter text-zinc-100 mb-2 drop-shadow-[0_2px_10px_rgba(255,255,255,0.4)]">
              Congratulations!
            </h2>
            <p className="text-orange-500 font-bold text-lg sm:text-xl tracking-widest uppercase mb-6 drop-shadow-md">
              आपने Stage {stageClearMsg.clearedStageNumber} पार कर लिया है
            </p>
            <div className="inline-flex flex-col items-center justify-center">
               <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest mb-1">Now Entering</span>
               <div className="bg-orange-600 text-black px-6 py-2 rounded-xl font-black italic uppercase text-2xl transform skew-x-[-8deg] shadow-[0_0_20px_rgba(234,88,12,0.4)]">
                 {stageClearMsg.nextStageName}
               </div>
            </div>
          </div>
        </div>
      )}

      {/* Paused Overlay */}
      {gameState === 'PAUSED' && (
        <div className="absolute inset-0 bg-[#0c0c0e]/80 backdrop-blur-md flex flex-col items-center justify-center z-30 p-6 pointer-events-auto">
          <div className="bg-zinc-900/60 backdrop-blur-md border border-zinc-800 p-8 rounded-2xl max-w-sm w-full text-center flex flex-col items-center">
            <div className="w-20 h-20 bg-sky-600/20 text-sky-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <Pause size={40} />
            </div>
            <h2 className="text-4xl font-black italic uppercase tracking-tighter text-zinc-100 mb-6">Game Paused</h2>
            <button 
              onClick={resumeGame}
              className="w-full h-16 bg-sky-600 hover:bg-sky-500 text-black font-black italic text-2xl rounded-2xl shadow-[0_0_30px_rgba(2,132,199,0.3)] transform flex items-center justify-center gap-4 transition-all hover:scale-105"
            >
              RESUME
              <Play className="w-6 h-6" fill="currentColor" />
            </button>
          </div>
        </div>
      )}

      {/* Start Screen */}
      {gameState === 'START' && (
        <div className="absolute inset-0 bg-[#0c0c0e]/80 backdrop-blur-md flex flex-col items-center justify-center z-30 p-6">
          <div className="bg-zinc-900/60 backdrop-blur-md border border-zinc-800 p-8 rounded-2xl max-w-sm w-full text-center flex flex-col items-center">
            <div className="w-20 h-20 bg-orange-600/20 text-orange-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <CarFront size={40} />
            </div>
            <h1 className="text-4xl font-black italic uppercase tracking-tighter text-zinc-100 mb-2">Thar Racing</h1>
            <p className="text-zinc-500 mb-4 text-[10px] font-bold uppercase tracking-widest text-center">Dodge traffic • Drive the legend</p>
            <div className="bg-orange-500/20 border border-orange-500 text-orange-400 p-3 rounded-xl mb-6 w-full font-bold text-sm tracking-wider animate-pulse flex items-center justify-center gap-2">
              <Trophy size={16} /> 100 Stage पार करने पर ₹1 लाख जीतो!
            </div>

            {/* Color selection */}
            <div className="w-full mb-8">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-3 block">Select Your Thar</span>
              <div className="flex gap-2 justify-center flex-wrap">
                {THAR_COLORS.map((color, idx) => (
                  <button
                    key={color.name}
                    onClick={() => setSelectedColorIndex(idx)}
                    className={`w-10 h-10 rounded-full border-2 transition-all ${selectedColorIndex === idx ? 'scale-110 border-white relative shadow-lg' : 'border-zinc-700 opacity-50 hover:opacity-100'}`}
                    style={{ backgroundColor: color.primary }}
                    title={color.name}
                  />
                ))}
              </div>
              <div className={`text-xs font-bold uppercase tracking-widest mt-3 ${THAR_COLORS[selectedColorIndex].text || ''}`} style={{ color: THAR_COLORS[selectedColorIndex].text ? undefined : THAR_COLORS[selectedColorIndex].primary }}>
                {THAR_COLORS[selectedColorIndex].name}
              </div>
            </div>

            <button 
              onClick={startGame}
              className="w-full h-20 bg-orange-600 hover:bg-orange-500 text-black font-black italic text-3xl rounded-2xl shadow-[0_0_30px_rgba(234,88,12,0.3)] transform skew-x-[-4deg] flex items-center justify-center gap-4 group transition-all"
            >
              START RACE
              <Play className="w-8 h-8 group-hover:translate-x-2 transition-transform" fill="currentColor" />
            </button>
          </div>
        </div>
      )}

      {/* Game Over Screen */}
      {gameState === 'GAMEOVER' && (
        <div className="absolute inset-0 bg-[#0c0c0e]/80 backdrop-blur-md flex flex-col items-center justify-center z-30 p-6">
          <div className="bg-zinc-900/60 backdrop-blur-md border border-zinc-800 p-8 rounded-2xl max-w-sm w-full text-center flex flex-col items-center">
            <div className="w-20 h-20 bg-orange-600/20 text-orange-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <RotateCcw size={40} />
            </div>
            <h2 className="text-4xl font-black italic uppercase tracking-tighter text-zinc-100 mb-2">Crashed!</h2>
            
            <div className="bg-zinc-900/80 w-full border border-zinc-800 rounded-xl p-6 mb-8 mt-6">
              <div className="flex flex-col mb-4">
                <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest text-center">Stage Reached</span>
                <div className="flex items-center justify-center gap-1 mt-1 mb-4">
                   <Map size={14} className="text-orange-500" />
                   <span className="text-orange-500 text-xl font-black italic uppercase tracking-wider">{STAGES[stageIndex].name}</span>
                </div>
                <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest text-center">Final Score</span>
                <span className="text-zinc-100 text-5xl font-black italic">{score}m</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-orange-500 pb-2">
                <Trophy size={16} />
                <span className="font-bold text-[10px] uppercase tracking-widest">Best: {highScore}m</span>
              </div>
            </div>

            <button 
              onClick={startGame}
              className="w-full h-20 bg-orange-600 hover:bg-orange-500 text-black font-black italic text-3xl rounded-2xl shadow-[0_0_30px_rgba(234,88,12,0.3)] transform skew-x-[-4deg] flex items-center justify-center gap-4 group transition-all"
            >
              RESTART
              <RotateCcw className="w-8 h-8 group-hover:-rotate-90 transition-transform" />
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
