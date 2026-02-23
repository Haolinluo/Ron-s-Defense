export interface Point {
  x: number;
  y: number;
}

export interface Entity {
  id: string;
  x: number;
  y: number;
}

export interface Missile extends Entity {
  targetX: number;
  targetY: number;
  startX: number;
  startY: number;
  progress: number; // 0 to 1
  speed: number;
  color: string;
}

export interface EnemyRocket extends Entity {
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  progress: number;
  speed: number;
}

export interface Explosion extends Entity {
  radius: number;
  maxRadius: number;
  growing: boolean;
  life: number; // 0 to 1
}

export interface Turret extends Entity {
  ammo: number;
  maxAmmo: number;
  active: boolean;
}

export interface City extends Entity {
  active: boolean;
}

export type GameStatus = 'START' | 'PLAYING' | 'WON' | 'LOST' | 'WAVE_END';

export interface GameState {
  score: number;
  status: GameStatus;
  wave: number;
  missiles: Missile[];
  enemyRockets: EnemyRocket[];
  explosions: Explosion[];
  turrets: Turret[];
  cities: City[];
}
