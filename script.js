const CIRCUMFERENCE = 2 * Math.PI * 135;

const modeLabel = document.getElementById("modeLabel");
const ringProgress = document.getElementById("ringProgress");
const timeDisplay = document.getElementById("timeDisplay");
const sessionsTodayEl = document.getElementById("sessionsToday");
const startPauseBtn = document.getElementById("startPauseBtn");
const resetBtn = document.getElementById("resetBtn");
const skipBtn = document.getElementById("skipBtn");
const focusMinutesInput = document.getElementById("focusMinutes");
const breakMinutesInput = document.getElementById("breakMinutes");
const autoStartInput = document.getElementById("autoStart");
const historyList = document.getElementById("historyList");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");

ringProgress.style.strokeDasharray = CIRCUMFERENCE;

let mode = "focus";
let totalSeconds = getMinutesInput("focus") * 60;
let remainingSeconds = totalSeconds;
let running = false;
let tickHandle = null;

function getMinutesInput(m) {
  return m === "focus"
    ? clampMinutes(focusMinutesInput.value, 25)
    : clampMinutes(breakMinutesInput.value, 5);
}

function clampMinutes(value, fallback) {
  const n = parseInt(value, 10);
  if (isNaN(n) || n <= 0) return fallback;
  return Math.min(n, 240);
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

function render() {
  timeDisplay.textContent = formatTime(remainingSeconds);
  const fraction = remainingSeconds / totalSeconds;
  ringProgress.style.strokeDashoffset = CIRCUMFERENCE * (1 - fraction);
  ringProgress.classList.toggle("break", mode === "break");
  modeLabel.textContent = mode === "focus" ? "Focus session" : "Break time";
  modeLabel.classList.toggle("break", mode === "break");
  startPauseBtn.textContent = running ? "Pause" : "Start";
  document.title = `${formatTime(remainingSeconds)} — ${mode === "focus" ? "Focus" : "Break"}`;
}

function tick() {
  remainingSeconds -= 1;
  if (remainingSeconds <= 0) {
    completeSession(false);
    return;
  }
  render();
}

function startTimer() {
  if (running) return;
  running = true;
  if (Notification && Notification.permission === "default") {
    Notification.requestPermission();
  }
  tickHandle = setInterval(tick, 1000);
  render();
}

function pauseTimer() {
  running = false;
  clearInterval(tickHandle);
  render();
}

function resetTimer() {
  pauseTimer();
  totalSeconds = getMinutesInput(mode) * 60;
  remainingSeconds = totalSeconds;
  render();
}

function switchMode(nextMode) {
  mode = nextMode;
  totalSeconds = getMinutesInput(mode) * 60;
  remainingSeconds = totalSeconds;
  render();
}

function completeSession(skipped) {
  pauseTimer();
  const minutesSpent = skipped
    ? Math.ceil((totalSeconds - remainingSeconds) / 60)
    : Math.round(totalSeconds / 60);
  logSession(mode, minutesSpent, skipped);
  playChime();
  notify(
    mode === "focus" ? "Focus session complete" : "Break's over",
    mode === "focus" ? "Time for a break." : "Back to focus?"
  );

  const nextMode = mode === "focus" ? "break" : "focus";
  switchMode(nextMode);

  if (autoStartInput.checked) {
    startTimer();
  }
}

function playChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.value = 660;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch (e) {
    // audio not available, ignore
  }
}

function notify(title, body) {
  if (window.Notification && Notification.permission === "granted") {
    new Notification(title, { body });
  }
}

const HISTORY_KEY = "focusRingHistory";

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function saveHistory(history) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function logSession(sessionMode, minutes, skipped) {
  const history = loadHistory();
  history.unshift({
    mode: sessionMode,
    minutes,
    skipped,
    timestamp: Date.now(),
  });
  saveHistory(history.slice(0, 50));
  renderHistory();
}

function renderHistory() {
  const history = loadHistory();
  historyList.innerHTML = "";

  if (history.length === 0) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "No sessions yet — start your first one!";
    historyList.appendChild(li);
  } else {
    for (const entry of history) {
      const li = document.createElement("li");
      const label = document.createElement("span");
      const kindClass = entry.mode === "focus" ? "kind-focus" : "kind-break";
      const kindText = entry.mode === "focus" ? "Focus" : "Break";
      label.innerHTML = `<span class="${kindClass}">${kindText}</span> · ${entry.minutes} min${entry.skipped ? " (skipped)" : ""}`;
      const time = document.createElement("span");
      time.textContent = new Date(entry.timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      li.appendChild(label);
      li.appendChild(time);
      historyList.appendChild(li);
    }
  }

  const today = new Date().toDateString();
  const todayCount = history.filter(
    (e) => e.mode === "focus" && !e.skipped && new Date(e.timestamp).toDateString() === today
  ).length;
  sessionsTodayEl.textContent = `${todayCount} session${todayCount === 1 ? "" : "s"} today`;
}

startPauseBtn.addEventListener("click", () => {
  if (running) {
    pauseTimer();
  } else {
    startTimer();
  }
});

resetBtn.addEventListener("click", resetTimer);

skipBtn.addEventListener("click", () => {
  completeSession(true);
});

focusMinutesInput.addEventListener("change", () => {
  if (mode === "focus" && !running) {
    resetTimer();
  }
});

breakMinutesInput.addEventListener("change", () => {
  if (mode === "break" && !running) {
    resetTimer();
  }
});

clearHistoryBtn.addEventListener("click", () => {
  saveHistory([]);
  renderHistory();
});

render();
renderHistory();
