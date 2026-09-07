/* =========================================================================
   MISSION HANIEH 19 — SCRIPT
   Vanilla JavaScript only. No frameworks, no build step.
   Organized into: Audio Engine, Ambient FX, Scene Manager, and one
   controller function per scene. Everything is wired up at the bottom
   in `init()`.
   ========================================================================= */

(() => {
  "use strict";

  /* =======================================================================
     0. STATE & DOM SHORTCUTS
     ======================================================================= */

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const state = {
    muted: false,
    currentScene: 0,
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  };

  const SCENES = [
    "scene-welcome",
    "scene-security",
    "scene-chase",
    "scene-balloons",
    "scene-gift",
    "scene-celebration",
    "scene-candle",
    "scene-final",
    "scene-secret",
  ];

  /* =======================================================================
     1. AUDIO ENGINE (Web Audio API — synthesized, no external files needed)
     ======================================================================= */

  const Audio2 = (() => {
    let ctx = null;
    let masterGain = null;

    function ensureContext() {
      if (!ctx) {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = ctx.createGain();
        masterGain.gain.value = state.muted ? 0 : 0.5;
        masterGain.connect(ctx.destination);
      }
      if (ctx.state === "suspended") ctx.resume();
      return ctx;
    }

    function setMuted(muted) {
      state.muted = muted;
      if (masterGain) masterGain.gain.value = muted ? 0 : 0.5;
    }

    // A single short tone. type: oscillator waveform.
    function tone(freq, duration = 0.15, type = "sine", delay = 0, volume = 0.25) {
      const c = ensureContext();
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, c.currentTime + delay);
      gain.gain.setValueAtTime(0.0001, c.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(volume, c.currentTime + delay + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + delay + duration);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(c.currentTime + delay);
      osc.stop(c.currentTime + delay + duration + 0.05);
    }

    // Cartoonish "pop" for balloons — quick pitch drop.
    function pop() {
      const c = ensureContext();
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(620, c.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, c.currentTime + 0.12);
      gain.gain.setValueAtTime(0.3, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.14);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start();
      osc.stop(c.currentTime + 0.16);
    }

    // Playful "boing" for the chase/dodge.
    function boing() {
      const c = ensureContext();
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(180, c.currentTime);
      osc.frequency.exponentialRampToValueAtTime(420, c.currentTime + 0.18);
      gain.gain.setValueAtTime(0.18, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start();
      osc.stop(c.currentTime + 0.22);
    }

    // Success chime — small ascending arpeggio.
    function chime() {
      tone(523.25, 0.18, "sine", 0, 0.22);
      tone(659.25, 0.18, "sine", 0.1, 0.22);
      tone(783.99, 0.25, "sine", 0.2, 0.24);
    }

    // Happy Birthday melody, synthesized (public-domain tune, no external audio file).
    function playBirthdaySong() {
      const q = 0.42; // quarter note length
      const notes = [
        // "Happy" "birth" "day" "to" "you"
        { f: 261.63, d: q * 0.75, t: 0 },
        { f: 261.63, d: q * 0.25, t: q * 0.75 },
        { f: 293.66, d: q, t: q },
        { f: 261.63, d: q, t: q * 2 },
        { f: 349.23, d: q, t: q * 3 },
        { f: 329.63, d: q * 2, t: q * 4 },
        // line 2
        { f: 261.63, d: q * 0.75, t: q * 6 },
        { f: 261.63, d: q * 0.25, t: q * 6.75 },
        { f: 293.66, d: q, t: q * 7 },
        { f: 261.63, d: q, t: q * 8 },
        { f: 392.0, d: q, t: q * 9 },
        { f: 349.23, d: q * 2, t: q * 10 },
      ];
      notes.forEach((n) => tone(n.f, n.d, "sine", n.t, 0.2));
    }

    return { setMuted, pop, boing, chime, playBirthdaySong, ensureContext };
  })();

  /* =======================================================================
     2. AMBIENT FX — particles, cursor glow, floating hearts
     ======================================================================= */

  // --- 2a. Ambient floating particles (canvas) ---
  const particleCanvas = $("#particle-canvas");
  const pctx = particleCanvas.getContext("2d");
  let particles = [];

  function resizeCanvas(canvas) {
    canvas.width = window.innerWidth * devicePixelRatio;
    canvas.height = window.innerHeight * devicePixelRatio;
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
  }

  function initParticles() {
    resizeCanvas(particleCanvas);
    const count = window.innerWidth < 640 ? 35 : 70;
    particles = Array.from({ length: count }, () => spawnParticle(true));
  }

  function spawnParticle(randomY) {
    const colors = ["#a742ff", "#ff3fa4", "#ffd166"];
    return {
      x: Math.random() * window.innerWidth,
      y: randomY ? Math.random() * window.innerHeight : window.innerHeight + 10,
      r: Math.random() * 2 + 0.6,
      speed: Math.random() * 0.35 + 0.08,
      drift: (Math.random() - 0.5) * 0.4,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: Math.random() * 0.5 + 0.2,
    };
  }

  function drawParticles() {
    pctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    pctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    particles.forEach((p) => {
      p.y -= p.speed;
      p.x += p.drift;
      if (p.y < -10) Object.assign(p, spawnParticle(false));
      pctx.beginPath();
      pctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      pctx.fillStyle = p.color;
      pctx.globalAlpha = p.alpha;
      pctx.shadowColor = p.color;
      pctx.shadowBlur = 8;
      pctx.fill();
    });
    pctx.globalAlpha = 1;
    requestAnimationFrame(drawParticles);
  }

  // --- 2b. Cursor glow ---
  const cursorGlow = $("#cursor-glow");
  function initCursorGlow() {
    let tx = window.innerWidth / 2;
    let ty = window.innerHeight / 2;
    let cx = tx;
    let cy = ty;
    window.addEventListener(
      "pointermove",
      (e) => {
        tx = e.clientX;
        ty = e.clientY;
      },
      { passive: true }
    );
    function loop() {
      cx += (tx - cx) * 0.12;
      cy += (ty - cy) * 0.12;
      cursorGlow.style.transform = `translate(${cx}px, ${cy}px)`;
      requestAnimationFrame(loop);
    }
    loop();
  }

  // --- 2c. Floating hearts ---
  const heartsLayer = $("#hearts-layer");
  function spawnHeart() {
    const heart = document.createElement("span");
    heart.className = "floating-heart";
    heart.textContent = Math.random() > 0.5 ? "💜" : "💗";
    const left = Math.random() * 100;
    const duration = 9 + Math.random() * 6;
    const drift = (Math.random() - 0.5) * 120;
    heart.style.left = left + "vw";
    heart.style.setProperty("--drift", drift + "px");
    heart.style.animationDuration = duration + "s";
    heart.style.fontSize = 14 + Math.random() * 14 + "px";
    heartsLayer.appendChild(heart);
    setTimeout(() => heart.remove(), duration * 1000 + 500);
  }

  function initHearts() {
    if (state.reducedMotion) return;
    setInterval(spawnHeart, 1400);
  }

  /* =======================================================================
     3. CONFETTI + FIREWORKS (canvas particle systems)
     ======================================================================= */

  const confettiCanvas = $("#confetti-canvas");
  const cctx = confettiCanvas.getContext("2d");
  let confettiPieces = [];
  let confettiRunning = false;

  function burstConfetti(amount = 140) {
    resizeCanvas(confettiCanvas);
    const colors = ["#a742ff", "#ff3fa4", "#ffd166", "#f5f0ff", "#7b2ff7"];
    for (let i = 0; i < amount; i++) {
      confettiPieces.push({
        x: window.innerWidth / 2 + (Math.random() - 0.5) * 200,
        y: window.innerHeight * 0.35,
        vx: (Math.random() - 0.5) * 12,
        vy: Math.random() * -10 - 4,
        gravity: 0.28 + Math.random() * 0.12,
        size: Math.random() * 7 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        spin: (Math.random() - 0.5) * 18,
        life: 0,
        maxLife: 160 + Math.random() * 60,
      });
    }
    if (!confettiRunning) {
      confettiRunning = true;
      requestAnimationFrame(runConfetti);
    }
  }

  function runConfetti() {
    cctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    cctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    confettiPieces.forEach((p) => {
      p.vy += p.gravity * 0.05;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.spin;
      p.life++;
      cctx.save();
      cctx.translate(p.x, p.y);
      cctx.rotate((p.rotation * Math.PI) / 180);
      cctx.fillStyle = p.color;
      cctx.globalAlpha = Math.max(0, 1 - p.life / p.maxLife);
      cctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      cctx.restore();
    });
    confettiPieces = confettiPieces.filter((p) => p.life < p.maxLife && p.y < window.innerHeight + 40);
    if (confettiPieces.length > 0) {
      requestAnimationFrame(runConfetti);
    } else {
      confettiRunning = false;
      cctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    }
  }

  // --- Fireworks (used during celebration scene) ---
  const fireworksCanvas = $("#fireworks-canvas");
  const fctx = fireworksCanvas.getContext("2d");
  let fireworkParticles = [];
  let fireworksInterval = null;
  let fireworksRunning = false;

  function launchFirework() {
    const colors = ["#a742ff", "#ff3fa4", "#ffd166", "#f5f0ff"];
    const cx = Math.random() * window.innerWidth;
    const cy = Math.random() * window.innerHeight * 0.5 + 40;
    const color = colors[Math.floor(Math.random() * colors.length)];
    const count = 46;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      const speed = Math.random() * 3.2 + 1.5;
      fireworkParticles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        life: 0,
        maxLife: 60 + Math.random() * 20,
      });
    }
  }

  function runFireworks() {
    fctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    fctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    fctx.globalCompositeOperation = "lighter";
    fireworkParticles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.03;
      p.life++;
      fctx.beginPath();
      fctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
      fctx.fillStyle = p.color;
      fctx.globalAlpha = Math.max(0, 1 - p.life / p.maxLife);
      fctx.shadowColor = p.color;
      fctx.shadowBlur = 10;
      fctx.fill();
    });
    fctx.globalCompositeOperation = "source-over";
    fireworkParticles = fireworkParticles.filter((p) => p.life < p.maxLife);
    if (fireworksRunning) requestAnimationFrame(runFireworks);
  }

  function startFireworks() {
    if (state.reducedMotion) return;
    resizeCanvas(fireworksCanvas);
    fireworksCanvas.classList.add("active");
    fireworksRunning = true;
    requestAnimationFrame(runFireworks);
    launchFirework();
    fireworksInterval = setInterval(launchFirework, 900);
  }

  function stopFireworks() {
    fireworksRunning = false;
    fireworksCanvas.classList.remove("active");
    clearInterval(fireworksInterval);
  }

  /* =======================================================================
     4. SCENE MANAGER
     ======================================================================= */

  function goToScene(index) {
    const prevIndex = state.currentScene;
    const prevEl = document.getElementById(SCENES[prevIndex]);
    const nextEl = document.getElementById(SCENES[index]);
    if (!nextEl) return;

    if (prevEl && prevEl !== nextEl) {
      prevEl.classList.add("leaving");
      prevEl.classList.remove("active");
      setTimeout(() => prevEl.classList.remove("leaving"), 650);
    }

    nextEl.classList.add("active");
    state.currentScene = index;
    updateHud(index);
    onSceneEnter(index);
  }

  function updateHud(index) {
    const hud = $("#mission-hud");
    if (index === 0) {
      hud.classList.add("hidden");
      return;
    }
    hud.classList.remove("hidden");
    const fill = $("#hud-fill");
    const levelNum = $("#hud-level-num");
    fill.style.width = (index / (SCENES.length - 1)) * 100 + "%";
    levelNum.textContent = index;
  }

  function onSceneEnter(index) {
    switch (SCENES[index]) {
      case "scene-security":
        runSecurityCheck();
        break;
      case "scene-chase":
        initChase();
        break;
      case "scene-balloons":
        initBalloons();
        break;
      case "scene-gift":
        initGiftOpen();
        break;
      case "scene-celebration":
        enterCelebration();
        break;
      case "scene-candle":
        initCandle();
        break;
      case "scene-final":
        runFinalTyping();
        break;
      default:
        break;
    }
  }

  /* =======================================================================
     5. SCENE 1 — SECURITY CHECK
     ======================================================================= */

  const SECURITY_LOG_LINES = [
    "در حال راه‌اندازی فایروال دوستی...",
    "بررسی متقابل بانک اطلاعاتی شوخی‌های خودمونی...",
    "اندازه‌گیری سطح وفاداری...",
    "بررسی تاریخچه‌ی تنقلات مشترک...",
    "کالیبره کردن حسگرهای قدرت بغل...",
    "چیزی نمونده...",
  ];

  let securityRan = false;
  function runSecurityCheck() {
    if (securityRan) return;
    securityRan = true;
    const logEl = $("#security-log");
    const bar = $("#security-progress");
    const status = $("#security-status");
    let step = 0;
    let progress = 0;

    const logInterval = setInterval(() => {
      if (step < SECURITY_LOG_LINES.length) {
        logEl.textContent = SECURITY_LOG_LINES[step];
        step++;
      }
    }, 620);

    const progInterval = setInterval(() => {
      progress += Math.random() * 14 + 6;
      if (progress >= 100) {
        progress = 100;
        bar.style.width = "100%";
        clearInterval(progInterval);
        clearInterval(logInterval);
        logEl.textContent = "هویت تأیید شد.";
        status.textContent = "دسترسی مجاز است";
        status.style.color = "var(--neon-gold)";
        Audio2.chime();
        setTimeout(() => goToScene(2), 1100);
        return;
      }
      bar.style.width = progress + "%";
    }, 280);
  }

  /* =======================================================================
     6. SCENE 2 — CATCH THE GIFT
     ======================================================================= */

  const CHASE_TAUNTS = ["خیلی کندی 😂", "چیزی نمونده!", "تلاش خوبی بود!", "خیلی نزدیک بود!", "نچ!"];
  let chaseInitialized = false;
  let dodgeCount = 0;
  const DODGES_REQUIRED = 5;
  let giftCatchable = false;

  function initChase() {
    if (chaseInitialized) return;
    chaseInitialized = true;
    const arena = $("#chase-arena");
    const gift = $("#runaway-gift");
    const taunt = $("#chase-taunt");

    function placeRandom() {
      const rect = arena.getBoundingClientRect();
      const pad = 60;
      const x = pad + Math.random() * (rect.width - pad * 2);
      const y = pad + Math.random() * (rect.height - pad * 2);
      gift.style.left = x + "px";
      gift.style.top = y + "px";
    }

    function showTaunt() {
      const msg = CHASE_TAUNTS[Math.floor(Math.random() * (CHASE_TAUNTS.length - 1))];
      taunt.textContent = msg;
      taunt.classList.add("show");
      setTimeout(() => taunt.classList.remove("show"), 700);
    }

    function dodge() {
      dodgeCount++;
      Audio2.boing();
      showTaunt();
      placeRandom();
      if (dodgeCount >= DODGES_REQUIRED) {
        giftCatchable = true;
        gift.style.filter = "drop-shadow(0 0 26px rgba(255, 209, 102, 0.9))";
      }
    }

    // Desktop: dodge when the pointer gets close to the gift.
    arena.addEventListener("pointermove", (e) => {
      if (giftCatchable) return;
      const r = gift.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dist = Math.hypot(e.clientX - cx, e.clientY - cy);
      if (dist < 90) dodge();
    });

    gift.addEventListener("click", () => {
      if (!giftCatchable) {
        // Touch devices: a tap that lands close still counts as a dodge attempt.
        dodge();
        return;
      }
      taunt.textContent = "بالاخره گرفتیش! 🎉";
      taunt.classList.add("show");
      Audio2.chime();
      gift.style.transition = "transform 0.4s ease, opacity 0.4s ease";
      gift.style.transform = "translate(-50%, -50%) scale(1.4)";
      gift.style.opacity = "0";
      setTimeout(() => goToScene(3), 900);
    });

    placeRandom();
  }

  /* =======================================================================
     7. SCENE 3 — POP THE BALLOONS
     ======================================================================= */

  let balloonsInitialized = false;
  let poppedCount = 0;
  const TOTAL_BALLOONS = 15;

  function initBalloons() {
    if (balloonsInitialized) return;
    balloonsInitialized = true;
    const field = $("#balloon-field");
    const counter = $("#balloon-count");
    const colors = ["pink", "purple", "gold"];

    for (let i = 0; i < TOTAL_BALLOONS; i++) {
      const b = document.createElement("button");
      b.className = "balloon " + colors[i % colors.length];
      b.setAttribute("aria-label", "Pop balloon");
      const leftPct = 4 + (i * (92 / TOTAL_BALLOONS)) + (Math.random() * 4 - 2);
      b.style.left = leftPct + "%";
      b.style.animationDuration = 7 + Math.random() * 5 + "s, " + (2.5 + Math.random() * 2) + "s";
      b.style.animationDelay = -(Math.random() * 8) + "s, " + -(Math.random() * 3) + "s";
      b.addEventListener("click", () => popBalloon(b, counter));
      field.appendChild(b);
    }
  }

  function popBalloon(b, counter) {
    if (b.classList.contains("popping")) return;
    b.classList.add("popping");
    Audio2.pop();
    poppedCount++;
    counter.textContent = poppedCount;
    setTimeout(() => b.remove(), 300);
    if (poppedCount >= TOTAL_BALLOONS) {
      setTimeout(() => {
        burstConfetti(220);
        Audio2.chime();
        setTimeout(() => goToScene(4), 1400);
      }, 350);
    }
  }

  /* =======================================================================
     8. SCENE 4 — OPEN THE GIFT
     ======================================================================= */

  let giftOpenInitialized = false;
  let giftClicks = 0;
  const GIFT_CLICKS_NEEDED = 10;

  function initGiftOpen() {
    if (giftOpenInitialized) return;
    giftOpenInitialized = true;
    const gift = $("#giant-gift");
    const fill = $("#gift-progress-fill");
    const clicksLeftEl = $("#gift-clicks-left");
    const shockwave = gift.querySelector(".gift-shockwave");

    gift.addEventListener("click", () => {
      if (giftClicks >= GIFT_CLICKS_NEEDED) return;
      giftClicks++;
      Audio2.pop();
      gift.classList.remove("shake");
      void gift.offsetWidth; // restart animation
      gift.classList.add("shake");
      shockwave.classList.remove("ping");
      void shockwave.offsetWidth;
      shockwave.classList.add("ping");

      fill.style.width = (giftClicks / GIFT_CLICKS_NEEDED) * 100 + "%";
      clicksLeftEl.textContent = GIFT_CLICKS_NEEDED - giftClicks;
      spawnMiniHearts(gift);

      if (giftClicks >= GIFT_CLICKS_NEEDED) {
        Audio2.chime();
        gift.classList.add("burst");
        burstConfetti(180);
        setTimeout(() => goToScene(5), 900);
      }
    });
  }

  function spawnMiniHearts(anchor) {
    for (let i = 0; i < 3; i++) spawnHeart();
  }

  /* =======================================================================
     9. SCENE 5 — CELEBRATION
     ======================================================================= */

  let celebrationEntered = false;
  function enterCelebration() {
    if (celebrationEntered) return;
    celebrationEntered = true;
    burstConfetti(260);
    startFireworks();
    Audio2.playBirthdaySong();

    $("#btn-to-candle").addEventListener("click", () => {
      stopFireworks();
      goToScene(6);
    });
  }

  /* =======================================================================
     10. SCENE 6 — BLOW OUT THE CANDLE
     ======================================================================= */

  let candleInitialized = false;
  let candleOut = false;

  function initCandle() {
    if (candleInitialized) return;
    candleInitialized = true;
    const btn = $("#btn-blow");
    const micHint = $("#mic-hint");

    btn.addEventListener("click", blowOutCandle);
    tryMicrophoneBlow(micHint);
  }

  function blowOutCandle() {
    if (candleOut) return;
    candleOut = true;
    const candle = $("#single-candle");
    candle.classList.add("out");
    spawnSmoke(candle);
    Audio2.chime();
    $("#star-field").classList.add("visible");
    document.body.style.transition = "background 1.2s ease";
    document.body.style.background = "#04020a";
    setTimeout(() => goToScene(7), 1800);
  }

  function spawnSmoke(candle) {
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        const s = document.createElement("div");
        s.className = "smoke";
        s.style.left = 46 + (Math.random() * 10 - 5) + "%";
        candle.appendChild(s);
        setTimeout(() => s.remove(), 1500);
      }, i * 120);
    }
  }

  async function tryMicrophoneBlow(hintEl) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = Audio2.ensureContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      hintEl.textContent = "میکروفون آماده‌ست — فوتش کن!";

      let sustainedFrames = 0;
      function check() {
        if (candleOut || state.currentScene !== 6) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        if (avg > 42) {
          sustainedFrames++;
        } else {
          sustainedFrames = Math.max(0, sustainedFrames - 1);
        }
        if (sustainedFrames > 6) {
          blowOutCandle();
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        requestAnimationFrame(check);
      }
      check();
    } catch (err) {
      hintEl.textContent = "میکروفون در دسترس نیست — به‌جاش دکمه رو بزن.";
    }
  }

  /* =======================================================================
     11. SCENE 7 — FINAL MESSAGE (typing animation)
     ======================================================================= */

  const FINAL_MESSAGE =
    "امروز یک فصل زیبای دیگه از زندگیت شروع می‌شه.\n\n" +
    "امیدوارم این سال برات خوشحالی، موفقیت، آرامش، خاطره‌های فراموش‌نشدنی و دلیل‌های بی‌شمار برای لبخند زدن بیاره.\n\n" +
    "هیچ‌وقت دست از رویاپردازی برندار.\n\n" +
    "تولدت مبارک!";

  let finalTyped = false;
  function runFinalTyping() {
    if (finalTyped) return;
    finalTyped = true;
    const el = $("#typing-message");
    const btn = $("#btn-to-secret");
    let i = 0;
    el.innerHTML = "";
    const cursor = document.createElement("span");
    cursor.className = "cursor-blink";
    cursor.textContent = "\u00A0";

    function typeChar() {
      if (i < FINAL_MESSAGE.length) {
        el.textContent = FINAL_MESSAGE.slice(0, i + 1);
        el.appendChild(cursor);
        i++;
        setTimeout(typeChar, 26);
      } else {
        cursor.remove();
        btn.classList.remove("hidden");
      }
    }
    setTimeout(typeChar, 400);

    btn.addEventListener("click", () => goToScene(8));
  }

  /* =======================================================================
     12. SCENE 8 — SECRET SURPRISE MODAL
     ======================================================================= */

  function initSecretModal() {
    const openBtn = $("#btn-open-secret");
    const modal = $("#secret-modal");
    const closeBtn = $("#modal-close");

    openBtn.addEventListener("click", () => {
      modal.classList.remove("hidden");
      requestAnimationFrame(() => modal.classList.add("visible"));
    });

    function close() {
      modal.classList.remove("visible");
      setTimeout(() => modal.classList.add("hidden"), 350);
    }

    closeBtn.addEventListener("click", close);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) close();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal.classList.contains("visible")) close();
    });
  }

  /* =======================================================================
     13. RIPPLE BUTTON EFFECT (delegated, works for all .ripple buttons)
     ======================================================================= */

  function initRipples() {
    document.addEventListener("pointerdown", (e) => {
      const btn = e.target.closest(".ripple");
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      btn.style.setProperty("--ripple-x", e.clientX - rect.left + "px");
      btn.style.setProperty("--ripple-y", e.clientY - rect.top + "px");
      btn.classList.remove("rippling");
      void btn.offsetWidth;
      btn.classList.add("rippling");
    });
  }

  /* =======================================================================
     14. MUTE CONTROL
     ======================================================================= */

  function initMute() {
    const btn = $("#btn-mute");
    btn.addEventListener("click", () => {
      const nowMuted = !state.muted;
      Audio2.setMuted(nowMuted);
      btn.textContent = nowMuted ? "🔇" : "🔊";
    });
  }

  /* =======================================================================
     15. INIT
     ======================================================================= */

  function init() {
    initParticles();
    requestAnimationFrame(drawParticles);
    initCursorGlow();
    initHearts();
    initRipples();
    initMute();
    initSecretModal();

    window.addEventListener("resize", () => {
      resizeCanvas(particleCanvas);
      resizeCanvas(confettiCanvas);
      resizeCanvas(fireworksCanvas);
    });

    $("#btn-start-mission").addEventListener("click", () => {
      Audio2.ensureContext(); // unlock audio on first gesture
      goToScene(1);
    });

    // Show the welcome scene immediately.
    document.getElementById(SCENES[0]).classList.add("active");
  }

  document.addEventListener("DOMContentLoaded", init);
})();

