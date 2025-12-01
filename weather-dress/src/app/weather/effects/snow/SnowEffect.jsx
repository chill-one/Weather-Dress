"use client";

import React, { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import snowflake from "./snowflake.png";

// https://github.com/bsehovac/shader-program

const count = 7000;

let wind = {
  current: 0,
  force: 0.1,
  target: 0.1,
  min: 0.1,
  max: 0.25,
  easing: 0.005,
};

// Vertex shader
const vertexShader = `
  precision highp float;
  attribute float size;
  attribute vec3 rotation;
  attribute vec3 speed;
  attribute vec4 a_color;
  attribute float scale;
  attribute float distortion;
  attribute float brightness;
  attribute float contrast;
  attribute float rotationOffset;
  attribute float flipX;
  attribute float flipY;
  attribute float warp;
  varying vec4 v_color;
  varying float v_rotation;
  varying float v_scale;
  varying float v_distortion;
  varying float v_brightness;
  varying float v_contrast;
  varying float v_rotationOffset;
  varying float v_flipX;
  varying float v_flipY;
  varying float v_warp;
  uniform float u_time;
  uniform vec3 u_worldSize;
  uniform float u_gravity;
  uniform float u_wind;
  void main() {
    v_color = a_color;
    v_rotation = rotation.x + u_time * rotation.y;
    v_scale = scale;
    v_distortion = distortion;
    v_brightness = brightness;
    v_contrast = contrast;
    v_rotationOffset = rotationOffset;
    v_flipX = flipX;
    v_flipY = flipY;
    v_warp = warp;

    vec3 pos = position;
    pos.x = mod(pos.x + u_time + u_wind * speed.x, u_worldSize.x * 2.0) - u_worldSize.x;
    pos.y = mod(pos.y - u_time * speed.y * u_gravity, u_worldSize.y * 2.0) - u_worldSize.y;
    pos.x += sin(u_time * speed.z) * rotation.z;
    pos.z += cos(u_time * speed.z) * rotation.z;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = (size * v_scale / gl_Position.w) * 100.0;
  }
`;

// Fragment shader
const fragmentShader = `
  precision highp float;
  uniform sampler2D u_texture;
  uniform float u_time;
  varying vec4 v_color;
  varying float v_rotation;
  varying float v_scale;
  varying float v_distortion;
  varying float v_brightness;
  varying float v_contrast;
  varying float v_rotationOffset;
  varying float v_flipX;
  varying float v_flipY;
  varying float v_warp;

  float noise(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    vec2 coord = gl_PointCoord - 0.5;

    coord *= v_scale;

    float distortion_amount = v_distortion * 0.15;
    coord += vec2(
      noise(coord * 10.0 + u_time * 0.1) * distortion_amount,
      noise(coord * 10.0 + u_time * 0.1 + 1.0) * distortion_amount
    );

    coord.x += v_warp * coord.y;
    coord.y += v_warp * coord.x;

    if (v_flipX > 0.5) coord.x = -coord.x;
    if (v_flipY > 0.5) coord.y = -coord.y;

    float angle = v_rotation + v_rotationOffset;
    vec2 rotated = vec2(
      cos(angle) * coord.x + sin(angle) * coord.y,
      cos(angle) * coord.y - sin(angle) * coord.x
    ) + 0.5;

    vec4 snowflake = texture2D(u_texture, rotated);

    vec3 color = snowflake.rgb;
    color = (color - 0.5) * v_contrast + 0.5 + v_brightness;
    color = clamp(color, 0.0, 1.0);

    gl_FragColor = vec4(color, snowflake.a * v_color.a);
  }
`;

// Settings for gentle and storm snow
const GENTLE_SETTINGS = {
  count: 3000,
  gravity: 20,
  colorAlphaMin: 0.2,
  colorAlphaMax: 0.6,
  sizeMin: 5,
  sizeMax: 15,
  scaleMin: 0.5,
  scaleMax: 1.5,
  distortionMin: 0.1,
  distortionMax: 0.5,
  brightnessMin: -0.1,
  brightnessMax: 0.2,
  contrastMin: 0.8,
  contrastMax: 1.2,
  wind: {
    force: 0.05,
    target: 0.05,
    min: 0.02,
    max: 0.1,
    easing: 0.002,
  },
  windDirectionChangeFreq: 0.97,
  windDirectionChangeAmount: 1.0,
  speedYMin: 0.5,
  speedYMax: 1.0,
  speedXMin: 0.2,
  speedXMax: 0.5,
  swayMax: 5,
};

const STORM_SETTINGS = {
  count: 7000,
  gravity: 45,
  colorAlphaMin: 0.25,
  colorAlphaMax: 0.8,
  sizeMin: 7,
  sizeMax: 18,
  scaleMin: 0.7,
  scaleMax: 2.2,
  distortionMin: 0.2,
  distortionMax: 1.0,
  brightnessMin: -0.2,
  brightnessMax: 0.3,
  contrastMin: 0.7,
  contrastMax: 1.3,
  wind: {
    force: 0.15,
    target: 0.2,
    min: 0.08,
    max: 0.35,
    easing: 0.01,
  },
  windDirectionChangeFreq: 0.995,
  windDirectionChangeAmount: 0.2,
  speedYMin: 1.2,
  speedYMax: 2.0,
  speedXMin: 0.4,
  speedXMax: 1.0,
  swayMax: 12,
};

function SnowParticles({ settings }) {
  const mesh = useRef();
  const worldSize = [110, 110, 80];
  const gravity = settings.gravity;
  const windRef = useRef({
    current: 0,
    force: settings.wind.force,
    target: settings.wind.target,
    min: settings.wind.min,
    max: settings.wind.max,
    easing: settings.wind.easing,
  });
  const windAngle = React.useRef(0); // radians

  const {
    positions,
    colors,
    sizes,
    rotations,
    speeds,
    scales,
    distortions,
    brightnesses,
    contrasts,
    rotationOffsets,
    flipXs,
    flipYs,
    warps,
  } = useMemo(() => {
    const positions = [];
    const colors = [];
    const sizes = [];
    const rotations = [];
    const speeds = [];
    const scales = [];
    const distortions = [];
    const brightnesses = [];
    const contrasts = [];
    const rotationOffsets = [];
    const flipXs = [];
    const flipYs = [];
    const warps = [];

    for (let i = 0; i < settings.count; i++) {
      positions.push(
        -worldSize[0] + Math.random() * worldSize[0] * 2,
        -worldSize[1] + Math.random() * worldSize[1] * 2,
        Math.random() * worldSize[2] * 2
      );

      speeds.push(
        settings.speedXMin +
          Math.random() * (settings.speedXMax - settings.speedXMin),
        settings.speedYMin +
          Math.random() * (settings.speedYMax - settings.speedYMin),
        Math.random() * settings.swayMax
      );

      rotations.push(
        Math.random() * 2 * Math.PI,
        Math.random() * 20,
        Math.random() * 10
      );

      colors.push(
        1,
        1,
        1,
        settings.colorAlphaMin +
          Math.random() *
            (settings.colorAlphaMax - settings.colorAlphaMin)
      );

      sizes.push(
        settings.sizeMin +
          Math.random() * (settings.sizeMax - settings.sizeMin)
      );

      scales.push(
        settings.scaleMin +
          Math.random() * (settings.scaleMax - settings.scaleMin)
      );

      distortions.push(
        settings.distortionMin +
          Math.random() *
            (settings.distortionMax - settings.distortionMin)
      );

      brightnesses.push(
        settings.brightnessMin +
          Math.random() *
            (settings.brightnessMax - settings.brightnessMin)
      );

      contrasts.push(
        settings.contrastMin +
          Math.random() *
            (settings.contrastMax - settings.contrastMin)
      );

      rotationOffsets.push(Math.random() * Math.PI * 2);

      flipXs.push(Math.random() > 0.5 ? 1 : 0);
      flipYs.push(Math.random() > 0.5 ? 1 : 0);

      warps.push(-0.3 + Math.random() * 0.6);
    }

    return {
      positions: new Float32Array(positions),
      colors: new Float32Array(colors),
      sizes: new Float32Array(sizes),
      rotations: new Float32Array(rotations),
      speeds: new Float32Array(speeds),
      scales: new Float32Array(scales),
      distortions: new Float32Array(distortions),
      brightnesses: new Float32Array(brightnesses),
      contrasts: new Float32Array(contrasts),
      rotationOffsets: new Float32Array(rotationOffsets),
      flipXs: new Float32Array(flipXs),
      flipYs: new Float32Array(flipYs),
      warps: new Float32Array(warps),
    };
  }, [settings]);

  const [texture, setTexture] = React.useState(null);

  React.useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.load(snowflake.src, (tex) => {
      setTexture(tex);
    });
  }, []);

  const uniforms = useMemo(
    () => ({
      u_time: { value: 0 },
      u_texture: { value: texture },
      u_worldSize: { value: worldSize },
      u_gravity: { value: gravity },
      u_wind: { value: 0 },
    }),
    [texture, gravity]
  );

  useFrame((state, delta) => {
    const w = windRef.current;

    w.force += (w.target - w.force) * w.easing;
    w.current += w.force * (delta * 0.2);

    if (Math.random() > settings.windDirectionChangeFreq) {
      const nudge =
        (Math.random() - 0.5) * settings.windDirectionChangeAmount;
      windAngle.current += nudge;

      if (windAngle.current > Math.PI) windAngle.current -= 2 * Math.PI;
      if (windAngle.current < -Math.PI) windAngle.current += 2 * Math.PI;
    }

    const windX = Math.cos(windAngle.current);
    uniforms.u_wind.value = w.current * windX;

    if (Math.random() > 0.98) {
      w.target += (Math.random() - 0.5) * 0.01;
      w.target = Math.max(w.min, Math.min(w.max, w.target));
    }

    if (Math.random() > 0.995) {
      w.target =
        (w.min + Math.random() * (w.max - w.min)) *
        (Math.random() > 0.5 ? -1 : 1);
    }

    uniforms.u_time.value = state.clock.getElapsedTime();
  });

  if (!texture) return null;

  return (
    <points ref={mesh} key={settings.count + "-" + settings.gravity}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={positions}
          count={positions.length / 3}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-a_color"
          array={colors}
          count={colors.length / 4}
          itemSize={4}
        />
        <bufferAttribute
          attach="attributes-size"
          array={sizes}
          count={sizes.length}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-rotation"
          array={rotations}
          count={rotations.length / 3}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-speed"
          array={speeds}
          count={speeds.length / 3}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-scale"
          array={scales}
          count={scales.length}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-distortion"
          array={distortions}
          count={distortions.length}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-brightness"
          array={brightnesses}
          count={brightnesses.length}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-contrast"
          array={contrasts}
          count={contrasts.length}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-rotationOffset"
          array={rotationOffsets}
          count={rotationOffsets.length}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-flipX"
          array={flipXs}
          count={flipXs.length}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-flipY"
          array={flipYs}
          count={flipYs.length}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-warp"
          array={warps}
          count={warps.length}
          itemSize={1}
        />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthTest={false}
      />
    </points>
  );
}

/**
 * SnowEffect component
 * Props:
 *   - type: 'gentle' | 'storm' (default: 'gentle')
 *   - backgroundImageUrl?: optional background image URL
 */

// NOTE: key change is here: take `props` and destructure inside
export default function SnowEffect(props) {
  const { type = "gentle", backgroundImageUrl } = props || {};
  const settings = type === "storm" ? STORM_SETTINGS : GENTLE_SETTINGS;

  const style = {
    width: "100vw",
    height: "100vh",
    backgroundSize: "cover",
    backgroundPosition: "center",
  };

  if (backgroundImageUrl) {
    style.backgroundImage = `url(${backgroundImageUrl})`;
  }

  return (
    <div style={style}>
      <Canvas camera={{ position: [0, 0, 200], fov: 75 }}>
        <SnowParticles settings={settings} />
      </Canvas>
    </div>
  );
}
