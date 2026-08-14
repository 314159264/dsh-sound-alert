/**
 * dsh-sound-alert — browser half.
 *
 * Hand-written bundle in the dsh client-module format:
 *   window.__ModuleLoader__.load({ id, factory })
 *
 * No build step, no npm dependencies beyond the platform seeds (react).
 * Detection is purely client-side:
 *   - goal completed  -> the 'goal' session projection flips to phase
 *                        'complete' (same data dsh-client-ui-goal renders)
 *   - question asked  -> a running tool call named 'ask_user_question'
 *                        appears in the conversation snapshot (the tool stays
 *                        "running" while it waits for the human answer, so
 *                        the beep fires the moment the question is shown)
 *   - answer done     -> a new turn/end lands in the snapshot (the agent
 *                        finished one thinking/working round and answered)
 * Configuration is kept in localStorage and exposed as a settings page plus
 * a minimal status strip above the composer. Each event may use a custom
 * audio file (data URL, <= 1 MB) instead of the synthesized tone.
 */
window.__ModuleLoader__.load({
  id: "dsh-sound-alert",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    let react = require("react");

    //#region config store (module-level singleton across both components)
    const STORAGE_KEY = "dsh-sound-alert:v1";
    const MAX_AUDIO_BYTES = 1024 * 1024; // 1 MB per custom audio file
    const DEFAULTS = {
      enabled: true,
      goal: { enabled: true, wave: "sine", freq: 880, dur: 240, gain: 0.22, repeats: 2, gap: 90, customUrl: null, customName: null },
      question: { enabled: true, wave: "triangle", freq: 660, dur: 150, gain: 0.22, repeats: 3, gap: 80, customUrl: null, customName: null },
      answer: { enabled: true, wave: "sine", freq: 784, dur: 200, gain: 0.2, repeats: 2, gap: 120, customUrl: null, customName: null },
    };

    function mergeEvent(def, raw) {
      const r = raw && typeof raw === "object" ? raw : {};
      // Per-event switch defaults to ON (old saved configs lack the field).
      return Object.assign({}, def, r, { enabled: r.enabled !== false });
    }

    function mergeConfig(raw) {
      if (!raw || typeof raw !== "object") return DEFAULTS;
      const merged = {
        enabled: typeof raw.enabled === "boolean" ? raw.enabled : DEFAULTS.enabled,
        goal: mergeEvent(DEFAULTS.goal, raw.goal),
        question: mergeEvent(DEFAULTS.question, raw.question),
        answer: mergeEvent(DEFAULTS.answer, raw.answer),
      };
      return merged;
    }

    function loadConfig() {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw === null) return DEFAULTS;
        return mergeConfig(JSON.parse(raw));
      } catch (err) {
        console.error("sound-alert: config load failed", err);
        return DEFAULTS;
      }
    }

    let config = loadConfig();
    const listeners = new Set();

    function saveConfig() {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      } catch (err) {
        console.error("sound-alert: config save failed", err);
      }
    }

    function emit() {
      for (const fn of [...listeners]) {
        try { fn(); } catch (err) { console.error("sound-alert: listener error", err); }
      }
    }

    function getConfig() { return config; }
    function subscribe(fn) { listeners.add(fn); return () => { listeners.delete(fn); }; }

    function setEnabled(enabled) {
      config = Object.assign({}, config, { enabled: Boolean(enabled) });
      saveConfig();
      emit();
    }

    function patchEvent(kind, key, value) {
      config = Object.assign({}, config, { [kind]: Object.assign({}, config[kind], { [key]: value }) });
      saveConfig();
      emit();
    }
    //#endregion

    //#region playback: custom audio file first, synthesized tone as fallback
    let audioCtx = null;
    let scheduleAt = 0;
    const WAVES = ["sine", "square", "triangle", "sawtooth"];

    function ensureAudio() {
      if (audioCtx) {
        if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
        return audioCtx;
      }
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        audioCtx = new AC();
        if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
        return audioCtx;
      } catch (err) {
        console.error("sound-alert: audio unavailable", err);
        return null;
      }
    }

    function playTone(o) {
      const ac = ensureAudio();
      if (!ac) return;
      const dur = Math.max(30, Math.min(2000, Number(o.dur) || 200));
      const gap = Math.max(20, Math.min(2000, Number(o.gap) || 80));
      const repeats = Math.max(1, Math.min(8, Math.round(Number(o.repeats) || 1)));
      const gain = Math.max(0.001, Math.min(1, Number(o.gain) || 0.2));
      const freq = Math.max(80, Math.min(4000, Number(o.freq) || 800));
      const wave = WAVES.indexOf(o.wave) >= 0 ? o.wave : "sine";
      const base = Math.max(ac.currentTime + 0.03, scheduleAt);
      for (let i = 0; i < repeats; i++) {
        const start = base + (i * (dur + gap)) / 1000;
        const end = start + dur / 1000;
        const osc = ac.createOscillator();
        const g = ac.createGain();
        osc.type = wave;
        osc.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, start);
        g.gain.exponentialRampToValueAtTime(gain, start + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, end);
        osc.connect(g);
        g.connect(ac.destination);
        osc.start(start);
        osc.stop(end + 0.02);
      }
      scheduleAt = base + (repeats * (dur + gap)) / 1000 + 0.05;
    }

    function play(kind) {
      const o = config[kind] || config.goal;
      if (!o) return;
      // Master switch AND per-event switch must both be on.
      if (!config.enabled || o.enabled === false) return;
      if (o.customUrl) {
        try {
          const a = new Audio(o.customUrl);
          const p = a.play();
          if (p && typeof p.catch === "function") p.catch((err) => {
            console.error("sound-alert: custom audio failed, using tone", err);
            playTone(o);
          });
          return;
        } catch (err) {
          console.error("sound-alert: custom audio error, using tone", err);
        }
      }
      try {
        playTone(o);
      } catch (err) {
        console.error("sound-alert: play failed", err);
      }
    }
    //#endregion

    //#region dock strip: minimal status + event detection
    function SoundDock(props) {
      const [s, setS] = react.useState(getConfig);
      react.useEffect(() => subscribe(() => setS(getConfig())), []);

      // Goal completed: the 'goal' projection flips to phase 'complete'.
      const projection = props.useProjection("goal");
      const goal = projection && projection.goal ? projection.goal : null;
      const goalKey = goal ? goal.id + ":" + goal.phase : "none";
      const prevGoalRef = react.useRef(null);
      react.useEffect(() => {
        const prev = prevGoalRef.current;
        prevGoalRef.current = goal ? { id: goal.id, phase: goal.phase } : null;
        if (!prev || !goal) return;
        if (prev.id === goal.id && prev.phase !== "complete" && goal.phase === "complete") {
          if (config.enabled) play("goal");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [goalKey]);

      // Question asked: a NEW running tool call named ask_user_question.
      // (The tool stays in runningCalls while it waits for the human answer,
      // so this fires the moment the question appears, not when it is answered.)
      const calls = (props.session && props.session.runningCalls) || [];
      const seenCallRef = react.useRef(new Set());
      react.useEffect(() => {
        const seen = seenCallRef.current;
        for (const c of calls) {
          if (c && c.name === "ask_user_question" && c.callId && !seen.has(c.callId)) {
            seen.add(c.callId);
            if (config.enabled) play("question");
          }
        }
        if (seen.size > 64) {
          const drop = [...seen].slice(0, seen.size - 64);
          for (const id of drop) seen.delete(id);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [calls]);

      // Answer done: a NEW turn/end lands. First paint only records existing
      // turns so opening an old session does not replay every past answer.
      const turnEnds = (props.session && props.session.turnEnds) || new Map();
      const seenTurnsRef = react.useRef(null); // null = not initialized yet
      react.useEffect(() => {
        const keys = [];
        for (const k of turnEnds.keys()) keys.push(k);
        const seen = seenTurnsRef.current;
        if (seen === null) {
          seenTurnsRef.current = new Set(keys);
          return;
        }
        let fresh = false;
        for (const k of keys) {
          if (!seen.has(k)) {
            seen.add(k);
            fresh = true;
          }
        }
        if (fresh && config.enabled) play("answer");
        if (seen.size > 256) {
          const drop = [...seen].slice(0, seen.size - 256);
          for (const k of drop) seen.delete(k);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [turnEnds]);

      return react.createElement(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "inherit", opacity: "0.85" } },
        react.createElement("span", null, s.enabled ? "🔔 提示音已开启" : "🔕 提示音已关闭"),
      );
    }
    //#endregion

    //#region settings page
    function numField(kind, text, key, step) {
      return react.createElement(
        "label",
        { style: { display: "flex", flexDirection: "column", gap: "2px", fontSize: "12px", color: "inherit" } },
        text,
        react.createElement("input", {
          type: "number",
          step: String(step),
          value: String(config[kind][key]),
          onChange: (e) => patchEvent(kind, key, Number(e.target.value)),
          style: { width: "84px" },
        }),
      );
    }

    function audioField(kind) {
      const o = config[kind];
      return react.createElement(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", fontSize: "12px" } },
        react.createElement(
          "label",
          { style: { color: "inherit" } },
          "自定义音频（≤1MB，支持常见格式）",
          react.createElement("input", {
            type: "file",
            accept: "audio/*",
            style: { marginLeft: "6px", maxWidth: "200px" },
            onChange: (e) => {
              const f = e.target.files && e.target.files[0];
              if (!f) return;
              if (f.size > MAX_AUDIO_BYTES) {
                window.alert("音频文件不能超过 1MB");
                e.target.value = "";
                return;
              }
              const reader = new FileReader();
              reader.onload = () => {
                patchEvent(kind, "customUrl", String(reader.result));
                patchEvent(kind, "customName", f.name);
              };
              reader.onerror = () => window.alert("读取音频文件失败");
              reader.readAsDataURL(f);
            },
          }),
        ),
        o.customUrl
          ? react.createElement(
              "span",
              { style: { display: "flex", alignItems: "center", gap: "6px" } },
              react.createElement("span", null, "已设置: " + (o.customName || "自定义音频")),
              react.createElement("button", {
                onClick: () => {
                  patchEvent(kind, "customUrl", null);
                  patchEvent(kind, "customName", null);
                },
              }, "清除"),
            )
          : null,
      );
    }

    function eventRow(kind) {
      const labels = { goal: "目标完成", question: "向用户提问", answer: "回答完成" };
      const label = labels[kind] || kind;
      const o = config[kind];
      return react.createElement(
        "div",
        { style: { border: "1px solid rgba(128,128,128,0.35)", borderRadius: "8px", padding: "10px", display: "flex", flexDirection: "column", gap: "8px" } },
        react.createElement(
          "div",
          { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } },
          react.createElement(
            "label",
            { style: { display: "flex", alignItems: "center", gap: "6px", fontWeight: "600", cursor: "pointer" } },
            react.createElement("input", {
              type: "checkbox",
              checked: o.enabled !== false,
              onChange: (e) => patchEvent(kind, "enabled", e.target.checked),
            }),
            label,
          ),
          react.createElement("button", { onClick: () => play(kind) }, "试听"),
        ),
        audioField(kind),
        react.createElement(
          "label",
          { style: { fontSize: "12px" } },
          "波形（未设自定义音频时使用）",
          react.createElement(
            "select",
            { value: o.wave, onChange: (e) => patchEvent(kind, "wave", e.target.value), style: { marginLeft: "6px" } },
            WAVES.map((w) => react.createElement("option", { key: w, value: w }, w)),
          ),
        ),
        react.createElement(
          "div",
          { style: { display: "flex", gap: "10px", flexWrap: "wrap" } },
          numField(kind, "频率 Hz", "freq", 10),
          numField(kind, "时长 ms", "dur", 10),
          numField(kind, "音量", "gain", 0.05),
          numField(kind, "重复", "repeats", 1),
          numField(kind, "间隔 ms", "gap", 10),
        ),
      );
    }

    function SoundSettings() {
      const [s, setS] = react.useState(getConfig);
      react.useEffect(() => subscribe(() => setS(getConfig())), []);
      return react.createElement(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: "12px", padding: "4px 0" } },
        react.createElement(
          "label",
          { style: { display: "flex", alignItems: "center", gap: "8px", fontWeight: "600" } },
          react.createElement("input", {
            type: "checkbox",
            checked: s.enabled,
            onChange: (e) => setEnabled(e.target.checked),
          }),
          "启用提示音（总开关）；下方每个事件可单独开关",
        ),
        eventRow("goal"),
        eventRow("question"),
        eventRow("answer"),
      );
    }
    //#endregion

    //#region plugin entry
    /** Required client services. */
    const inject = ["slots"];

    /**
     * Client plugin body.
     * @param ctx - client root context (full Cordis context).
     */
    function apply(ctx) {
      ctx.slots.inject("conversation.input.dock", () => ctx.slots.register(
        { name: "conversation.input.dock", id: "sound-alert", order: 30 },
        (props) => react.createElement(SoundDock, props),
      ));
      ctx.slots.inject("settings.section", () => ctx.slots.register(
        { name: "settings.section", id: "sound-alert", order: 30, label: "提示音" },
        () => react.createElement(SoundSettings, null),
      ));
    }
    //#endregion

    exports.inject = inject;
    exports.apply = apply;
    return module.exports;
  },
});
