import { ProgramCache } from "./webgl-helpers";

interface Animation {
  startTime: number;
  endTime: number;
  startValue: number;
  endValue: number;
  currentValue: number;
}

export interface Camera {
  props: Float32Array;
}

export interface Circle {
  index: number;
  radius: number;
  color: Float32Array;
  vel: Float32Array;
  acc: Float32Array;
  animation: Animation;
}

export interface LevelProps {
  borderSize: number;
  numCircles: number;
}

export interface GameProgramCache extends ProgramCache {
  uniforms: {
    uRes: WebGLUniformLocation | null;
    uCircleProps: WebGLUniformLocation | null;
    uCircleColorProps: WebGLUniformLocation | null;
    uCameraProps: WebGLUniformLocation | null;
    uTime: WebGLUniformLocation | null;
    uBorder: WebGLUniformLocation | null;
  };
}

export interface GameState {
  started: boolean;
  currentLevel: number;
  gameOver: boolean;
  gameWon: boolean;
  levelWon: boolean;
  dimensions: { width: number; height: number };
  readyToTryAgainAt: number;
}
