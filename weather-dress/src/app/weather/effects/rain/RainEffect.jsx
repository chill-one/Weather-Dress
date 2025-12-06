"use client";

import React, { useEffect } from "react";

import RainRenderer from "./rain-renderer";
import TweenLite from "gsap";
import times from "./times";
import { random, chance } from "./random";
import Raindrops from "./raindrops";
import loadImages from "./image-loader";
import createCanvas from "./create-canvas";
import { weatherData } from "./rain-utils";

import DropColor from "./img/drop-color.png";
import DropAlpha from "./img/drop-alpha.png";

// 1x1 black PNG, used when you don't pass a backgroundImageUrl
const FALLBACK_BG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==";

const RainEffect = (props) => {
  const { type = "rain", backgroundImageUrl, intensity } = props || {};

  let canvas,
    dropAlpha,
    dropColor,
    raindrops,
    textureFg,
    textureFgCtx,
    textureBg,
    textureBgCtx,
    renderer,
    curWeatherData;

  let backgroundImage = null;
  let intervalId;
  let blend = { v: 0 };

  let textureFgSize = {
    width: 100,
    height: 100,
  };
  let textureBgSize = {
    width: 100,
    height: 100,
  };

  // ---- MAIN EFFECT INITIALIZATION ----
  useEffect(() => {
    if (typeof window === "undefined") return;

    const url = backgroundImageUrl || FALLBACK_BG_DATA_URL;
    setBackgroundImage(url, type);

    // cleanup lightning interval on unmount
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backgroundImageUrl, type]);

  // Create a subtle gradient/texture so raindrops are visible when no background is provided
  const createFallbackTexture = () => {
    const size = 512;
    const fallbackCanvas = createCanvas(size, size);
    const ctx = fallbackCanvas.getContext("2d");

    if (!ctx) return fallbackCanvas;

    const gradient = ctx.createLinearGradient(0, 0, 0, size);
    gradient.addColorStop(0, "#0f172a");
    gradient.addColorStop(1, "#1f2937");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    // Add a light noise layer for extra refraction detail
    const noiseDensity = 0.08;
    ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
    for (let x = 0; x < size; x += 4) {
      for (let y = 0; y < size; y += 4) {
        if (Math.random() < noiseDensity) {
          ctx.fillRect(x, y, 2, 2);
        }
      }
    }

    return fallbackCanvas;
  };

  // Set the background image and initialize rain effect after image loads
  const setBackgroundImage = (url, weatherType) => {
    if (typeof window === "undefined") return;

    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.src = url;

    const finishInit = () => {
      textureFgSize = {
        width: backgroundImage.naturalWidth || backgroundImage.width || 100,
        height: backgroundImage.naturalHeight || backgroundImage.height || 100,
      };
      textureBgSize = {
        width: textureFgSize.width,
        height: textureFgSize.height,
      };

      // Once the image is loaded and sizes are known, load textures + init
      loadTextures().then(() => {
        init(weatherType);
      });
    };

    img.onload = () => {
      backgroundImage = img;
      finishInit();
    };

    img.onerror = () => {
      // Fall back to an internally generated texture so the rain remains visible
      backgroundImage = createFallbackTexture();
      finishInit();
    };
  };

  // Load drop textures
  const loadTextures = () => {
    return loadImages([
      { name: "dropAlpha", src: DropAlpha },
      { name: "dropColor", src: DropColor },
    ]).then(function (images) {
      dropColor = images.dropColor.img;
      dropAlpha = images.dropAlpha.img;
    });
  };

  const init = (weatherType = "rain") => {
    // normalize type to what weatherData expects (likely all lowercase)
    const normalizedType = (weatherType || "rain").toLowerCase();
    const baseWeatherData = weatherData[normalizedType] || weatherData.rain;
    const clampedIntensity = Math.max(
      0.2,
      Math.min(intensity ?? baseWeatherData.intensity ?? 1, 1.5)
    );

    const scaledWeatherData = {
      ...baseWeatherData,
      intensity: clampedIntensity,
      rainChance: baseWeatherData.rainChance * clampedIntensity,
      rainLimit: Math.max(
        1,
        Math.round(baseWeatherData.rainLimit * clampedIntensity)
      ),
      drizzle: Math.round(baseWeatherData.drizzle * clampedIntensity),
    };

    canvas = document.querySelector("#container-weather");
    if (!canvas) return;

    const container = canvas.parentElement;
    if (!container) return;

    const dpi = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();

    canvas.width = rect.width * dpi;
    canvas.height = rect.height * dpi;

    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    raindrops = new Raindrops(
      canvas.width,
      canvas.height,
      dpi,
      dropAlpha,
      dropColor,
      {
        trailRate: 1,
        trailScaleRange: [0.2, 0.45],
        collisionRadius: 0.45,
        dropletsCleaningRadiusMultiplier: 0.28,
      }
    );

    textureFg = createCanvas(textureFgSize.width, textureFgSize.height);
    textureFgCtx = textureFg.getContext("2d");
    textureBg = createCanvas(textureBgSize.width, textureBgSize.height);
    textureBgCtx = textureBg.getContext("2d");

    // if for some reason backgroundImage isn't set yet, create a flat canvas
    if (!backgroundImage) {
      const flat = createCanvas(textureFgSize.width, textureFgSize.height);
      const ctx = flat.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, flat.width, flat.height);
      }
      backgroundImage = flat;
    }

    generateTextures(backgroundImage, backgroundImage);

    renderer = new RainRenderer(
      canvas,
      raindrops.canvas,
      textureFg,
      textureBg,
      null,
      {
        brightness: 1.04,
        alphaMultiply: 16,
        alphaSubtract: 4,
        minRefraction: 128,
      }
    );

    curWeatherData = {
      ...scaledWeatherData,
      fg: backgroundImage,
      bg: backgroundImage,
    };

    if (normalizedType === "storm" || normalizedType === "fallout") {
      setupLightningFlicker();
    }

    if (raindrops && curWeatherData) {
      raindrops.options = Object.assign(raindrops.options, curWeatherData);
      raindrops.clearDrops();
    }
  };

  // Generate foreground/background textures for the rain renderer
  const generateTextures = (fg, bg, x = 0, y = 0, alpha = 1) => {
    if (!textureFgCtx || !textureBgCtx || !fg || !bg) return;

    if (
      (fg instanceof HTMLImageElement && !fg.complete) ||
      (bg instanceof HTMLImageElement && !bg.complete)
    ) {
      return;
    }

    textureFgCtx.globalAlpha = alpha;
    textureFgCtx.drawImage(fg, x, y, textureFgSize.width, textureFgSize.height);
    textureBgCtx.globalAlpha = alpha;
    textureBgCtx.drawImage(bg, x, y, textureBgSize.width, textureBgSize.height);
  };

  // Lightning flicker effect for storm weather
  const setupLightningFlicker = () => {
    const minInterval = 1000; // minimum time between flickers
    const maxInterval = 5000; // maximum time between flickers
    const flashChance =
      curWeatherData && typeof curWeatherData.flashChance === "number"
        ? curWeatherData.flashChance
        : 0;
    const interval =
      minInterval + (maxInterval - minInterval) * (1 - flashChance);

    intervalId = setInterval(() => {
      const flicker = Math.random() * 2.0;
      if (renderer && renderer.gl) {
        renderer.gl.useProgram(renderer.programWater);
        renderer.gl.createUniform("1f", "lightningFlash", flicker);
        setTimeout(() => {
          renderer.gl.useProgram(renderer.programWater);
          renderer.gl.createUniform("1f", "lightningFlash", 0.0);
        }, 100 + Math.random() * 200); // Flicker lasts 100–300ms
      }
    }, interval);
  };

  return (
    <div
      className="rain-effect-container"
      style={{ width: "100%", height: "100%" }}
    >
      <canvas id="container-weather"></canvas>
    </div>
  );
};

export default RainEffect;
