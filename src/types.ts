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
  vel: Float32Array;
  animation: Animation;
}

export interface GameProgramCache extends ProgramCache {
  uniforms: {
    uRes: WebGLUniformLocation | null;
    uCircleProps: WebGLUniformLocation | null;
    uCameraProps: WebGLUniformLocation | null;
    uTime: WebGLUniformLocation | null;
    uBorder: WebGLUniformLocation | null;
  };
}

export interface GameState {
  started: boolean;
  level: number;
  gameOver: boolean;
}
