(() => {
  const key = "kaden-fighters-dojo-director-v1";
  const state = JSON.parse(localStorage.getItem(key) || "null") || {
    discipline: 34,
    combo: 18,
    tournament: 22,
    rank: "White Belt",
    avatar: "Street Student",
    mode: "Training Ground",
    serviceStatus: "Offline ranked queue ready",
  };
  const avatars = ["Street Student", "Dojo Rival", "Arcade Champion", "World Tour Hero"];
  const modes = ["Training Ground", "Story Route", "Battle Hub", "Ranked Ladder"];
  const clamp = (value) => Math.max(0, Math.min(100, value));
  const save = () => localStorage.setItem(key, JSON.stringify(state));

  function rank() {
    const total = state.discipline + state.combo + state.tournament;
    if (total >= 250) return "Champion";
    if (total >= 180) return "Black Belt";
    if (total >= 120) return "Red Belt";
    return "White Belt";
  }

  function improve(field) {
    state[field] = clamp(state[field] + 11);
    state.rank = rank();
    const index = Math.min(avatars.length - 1, Math.floor((state.discipline + state.combo + state.tournament) / 90));
    state.avatar = avatars[index];
    state.mode = modes[index];
    state.serviceStatus = `Queued ${state.mode} progress for future /api/kaden-fighters/progress sync`;
    save();
    render();
  }

  function render() {
    let panel = document.querySelector("#dojoDirector");
    if (!panel) {
      panel = document.createElement("aside");
      panel.id = "dojoDirector";
      panel.className = "dojo-director";
      document.body.appendChild(panel);
    }
    panel.innerHTML = `
      <div class="dojo-director__head">
        <div>
          <h2>Dojo Director</h2>
          <p>Premium fighter progression for movement practice, combo mastery, and tournament readiness.</p>
        </div>
        <span class="dojo-rank">${state.rank}</span>
      </div>
      <div class="dojo-grid">
        <div class="dojo-stat"><span>Footwork</span><strong>${state.discipline}</strong></div>
        <div class="dojo-stat"><span>Combos</span><strong>${state.combo}</strong></div>
        <div class="dojo-stat"><span>Bracket</span><strong>${state.tournament}</strong></div>
      </div>
      <div class="dojo-actions">
        <button data-dojo="discipline">Footwork</button>
        <button data-dojo="combo">Combo Lab</button>
        <button data-dojo="tournament">Bracket Prep</button>
      </div>
      <div class="dojo-feature-grid">
        <div><span>Avatar Path</span><strong>${state.avatar}</strong></div>
        <div><span>Current Mode</span><strong>${state.mode}</strong></div>
        <div><span>Accessibility</span><strong>Classic / Easy</strong></div>
        <div><span>Backend Contract</span><strong>${state.serviceStatus}</strong></div>
      </div>
      <p class="dojo-note">Production handoff: move-list trials, story rivals, ranked ghost ladder, and battle-hub rooms now share a clear progress-sync contract.</p>
    `;
    panel.querySelectorAll("[data-dojo]").forEach((button) => {
      button.addEventListener("click", () => improve(button.dataset.dojo));
    });
  }

  render();
})();
