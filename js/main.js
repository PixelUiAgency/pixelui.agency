/* ==========================================================================
   Pixel UI — under construction
   Vanilla JS, no dependencies.
   ========================================================================== */
(() => {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const accent = () => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#FF5B2E";

  /* ------------------------------------------------------------------------
     Clock (Europe/Paris)
     ------------------------------------------------------------------------ */
  function initClock() {
    const hh = $("[data-hh]");
    const mm = $("[data-mm]");
    const time = $("[data-clock]");
    if (!hh || !mm) return;
    const fmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });
    const tick = () => {
      const now = new Date();
      for (const p of fmt.formatToParts(now)) {
        if (p.type === "hour") hh.textContent = p.value;
        if (p.type === "minute") mm.textContent = p.value;
      }
      time.setAttribute("datetime", now.toISOString());
    };
    tick();
    setInterval(tick, 15000);

    const year = $("[data-year]");
    if (year) year.textContent = String(new Date().getFullYear());
  }

  /* ------------------------------------------------------------------------
     Rotating word + selection box that follows its size
     ------------------------------------------------------------------------ */
  function initRotator() {
    const sel = $("[data-sel]");
    const dims = $("[data-dims]");
    if (!sel) return;
    const words = $$(".word", sel);
    let idx = 0;
    let sizes = [];

    const measure = () => {
      sizes = words.map((el) => ({
        w: Math.ceil(Math.max(el.scrollWidth, el.offsetWidth)) + 2,
        h: Math.round(el.offsetHeight),
      }));
      apply();
    };

    const apply = () => {
      const s = sizes[idx];
      if (!s) return;
      sel.style.width = s.w + "px";
      if (dims) dims.textContent = `${s.w} × ${s.h}`;
    };

    const show = (next) => {
      const prev = idx;
      idx = next;
      words.forEach((el, i) => {
        el.classList.toggle("on", i === idx);
        el.classList.toggle("prev", i === prev && i !== idx);
      });
      apply();
    };

    measure();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    if ("ResizeObserver" in window) {
      const ro = new ResizeObserver(measure);
      words.forEach((el) => ro.observe(el));
    } else {
      window.addEventListener("resize", measure);
    }

    if (reduceMotion) return;
    let timer = setInterval(() => show((idx + 1) % words.length), 2600);
    // Pause while the tab is hidden so it doesn't jump on return
    document.addEventListener("visibilitychange", () => {
      clearInterval(timer);
      if (!document.hidden) timer = setInterval(() => show((idx + 1) % words.length), 2600);
    });
  }

  /* ------------------------------------------------------------------------
     Copy email
     ------------------------------------------------------------------------ */
  function initCopy() {
    const btn = $("[data-copy]");
    const tip = $("[data-tip]");
    const live = $("[data-live]");
    if (!btn) return;
    let t;

    const fallbackCopy = (text) => {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
      ta.remove();
      return ok;
    };

    const done = (ok) => {
      btn.classList.toggle("is-copied", ok);
      tip.textContent = ok ? "Copied" : "Copy failed";
      tip.classList.add("show");
      live.textContent = ok ? "Email address copied" : "Copy failed";
      clearTimeout(t);
      t = setTimeout(() => {
        btn.classList.remove("is-copied");
        tip.classList.remove("show");
        live.textContent = "";
      }, 1800);
    };

    btn.addEventListener("click", async () => {
      const text = btn.dataset.copy;
      try {
        await navigator.clipboard.writeText(text);
        done(true);
      } catch (e) {
        done(fallbackCopy(text));
      }
    });
  }

  /* ------------------------------------------------------------------------
     ASCII field background — idle wave + pointer heat trail
     ------------------------------------------------------------------------ */
  function initField() {
    const canvas = $(".field");
    const content = $("[data-content]");
    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext("2d");

    const CHARS = " .·:-+*#";
    const TOP = CHARS.length - 1;
    const INKS = Array.from({ length: 11 }, (_, i) => `rgba(20,20,20,${(0.1 + i * 0.055).toFixed(3)})`);

    const mouse = { x: -9999, y: -9999, tx: -9999, ty: -9999, active: false };
    let W = 0, H = 0, cell = 14, cols = 0, rows = 0;
    let heat = new Float32Array(0);
    let mask = null;
    let color = accent();
    let raf = 0;
    let last = 0;

    const updateMask = () => {
      if (!content) { mask = null; return; }
      const a = content.getBoundingClientRect();
      const b = canvas.getBoundingClientRect();
      const pad = 28;
      mask = {
        x0: a.left - b.left - pad,
        y0: a.top - b.top - pad - 40,
        x1: a.right - b.left + pad,
        y1: a.bottom - b.top + pad,
      };
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      if (!W || !H) return;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cell = W < 640 ? 12 : 14;
      cols = Math.ceil(W / cell);
      rows = Math.ceil(H / cell);
      heat = new Float32Array(cols * rows);
      ctx.font = `500 ${cell - 3}px "Geist Mono", ui-monospace, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      color = accent();
      updateMask();
      if (reduceMotion) draw(0);
    };

    const inMask = (x, y) => mask && x > mask.x0 && x < mask.x1 && y > mask.y0 && y < mask.y1;

    const draw = (t) => {
      ctx.clearRect(0, 0, W, H);
      mouse.x += (mouse.tx - mouse.x) * 0.28;
      mouse.y += (mouse.ty - mouse.y) * 0.28;

      const R = W < 640 ? 70 : 110;
      const R2 = R * R;
      const reach = R2 * 5;

      for (let r = 0; r < rows; r++) {
        const y = r * cell + cell / 2;
        for (let c = 0; c < cols; c++) {
          const x = c * cell + cell / 2;
          const i = r * cols + c;

          if (mouse.active) {
            const dx = x - mouse.x, dy = y - mouse.y, d2 = dx * dx + dy * dy;
            if (d2 < reach) heat[i] = Math.min(1, heat[i] + Math.exp(-d2 / (R2 * 0.5)) * 0.26);
          }
          heat[i] *= 0.955;

          const wave = 0.5 + 0.5 * Math.sin(x * 0.011 + y * 0.017 - t * 0.0007) * Math.cos(y * 0.008 - x * 0.004 + t * 0.0005);
          const masked = inMask(x, y);
          let v = wave * wave * wave * 0.42 + heat[i];
          if (masked) v *= 0.2;

          if (v < 0.07) {
            ctx.fillStyle = INKS[0];
            ctx.fillText("·", x, y);
            continue;
          }
          const k = Math.min(TOP, 1 + Math.floor(v * TOP));
          ctx.fillStyle = heat[i] > 0.6 && !masked ? color : INKS[Math.min(10, Math.round(v * 10))];
          ctx.fillText(CHARS[k], x, y);
        }
      }
    };

    const loop = (t) => {
      raf = requestAnimationFrame(loop);
      if (t - last < 33) return; // ~30 fps is plenty for this effect
      last = t;
      draw(t);
    };

    resize();
    window.addEventListener("resize", resize);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(resize);
    // Re-measure the text mask once entrance animations have settled
    setTimeout(updateMask, 1400);

    if (reduceMotion) return;

    const track = (e) => {
      const b = canvas.getBoundingClientRect();
      mouse.tx = e.clientX - b.left;
      mouse.ty = e.clientY - b.top;
      if (!mouse.active) { mouse.x = mouse.tx; mouse.y = mouse.ty; mouse.active = true; }
    };
    window.addEventListener("pointermove", track, { passive: true });
    // Touch: start the trail on tap, stop it when the finger lifts
    window.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse") track(e); }, { passive: true });
    window.addEventListener("pointerup", (e) => { if (e.pointerType !== "mouse") mouse.active = false; }, { passive: true });
    window.addEventListener("pointercancel", () => { mouse.active = false; }, { passive: true });
    document.documentElement.addEventListener("pointerleave", () => { mouse.active = false; });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) { cancelAnimationFrame(raf); raf = 0; }
      else if (!raf) raf = requestAnimationFrame(loop);
    });
    raf = requestAnimationFrame(loop);
  }

  /* ------------------------------------------------------------------------ */
  initClock();
  initRotator();
  initCopy();
  initField();
})();
