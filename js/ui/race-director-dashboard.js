import { formatClockTime, formatDuration, formatPace } from '../utils/time-utils.js';
import { milesToDisplay } from '../utils/calculations.js';

const PACE_STEP = 5;

export class RaceDirectorDashboard {
  constructor(container, callbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.teamPanels = new Map();
  }

  render(snapshot) {
    this.container.innerHTML = `
      <section class="card race-controls-card">
        <div class="section-header">
          <span class="label">Race controls</span>
          <div class="stack-right">
            <button class="primary-button" id="raceToggleButton" type="button">${snapshot.status === 'running' ? 'Stop Race' : 'Start Race'}</button>
            <button class="text-button danger" id="raceResetButton" type="button">Reset Race</button>
          </div>
        </div>
        <div class="race-meta-grid">
          <div><span class="label">Elapsed</span><strong id="elapsedDisplay">${formatDuration(snapshot.elapsedSec)}</strong></div>
          <div><span class="label">Session</span><strong>${snapshot.sessionId}</strong></div>
          <div><span class="label">Device</span><strong>${snapshot.deviceId}</strong></div>
        </div>
      </section>
      <section class="team-panels" id="teamPanels"></section>
    `;

    this.container.querySelector('#raceToggleButton').addEventListener('click', () => {
      this.callbacks.onToggleRace(snapshot.status === 'running');
    });

    this.container.querySelector('#raceResetButton').addEventListener('click', () => {
      this.callbacks.onResetRace();
    });

    const teamPanels = this.container.querySelector('#teamPanels');
    this.teamPanels.clear();

    snapshot.teams.forEach((team) => {
      const panel = document.createElement('article');
      panel.className = 'card team-panel';
      panel.innerHTML = `
        <div class="team-header">
          <h3>${team.name}</h3>
          <span class="team-dot" style="background:${team.color}"></span>
        </div>
        <div class="pace-row">
          <button class="pace-button" data-action="pace-down" type="button" aria-label="Speed up by ${PACE_STEP} seconds per mile">- ${PACE_STEP}s</button>
          <strong class="pace-value" data-role="current-pace">${formatPace(team.currentPaceSec)}</strong>
          <button class="pace-button" data-action="pace-up" type="button" aria-label="Slow down by ${PACE_STEP} seconds per mile">+ ${PACE_STEP}s</button>
        </div>
        <div class="team-stat-grid">
          <div><span class="label">Current distance</span><strong data-role="distance">${milesToDisplay(team.distanceMiles)}</strong></div>
          <div><span class="label">Checkpoint</span><strong data-role="checkpoint">${team.checkpointIndex}</strong></div>
          <div><span class="label">Remaining</span><strong data-role="remaining">${milesToDisplay(team.distanceRemainingMiles)}</strong></div>
          <div><span class="label">Est finish</span><strong data-role="finish">${formatClockTime(team.estimatedFinishAt)}</strong></div>
          <div><span class="label">Gap</span><strong data-role="gap">${formatDuration(Math.abs(team.gapSeconds))} ${team.gapSeconds >= 0 ? 'ahead' : 'behind'}</strong></div>
          <div><span class="label">Average pace</span><strong data-role="average-pace">${formatPace(team.averagePaceSec)}</strong></div>
          <div><span class="label">Time gained/lost</span><strong data-role="delta">${team.cumulativeTimeDeltaSec >= 0 ? '+' : '-'}${formatDuration(Math.abs(team.cumulativeTimeDeltaSec))}</strong></div>
          <div><span class="label">Position</span><strong data-role="position">${(team.distanceMiles / snapshot.race.totalDistanceMiles * 100).toFixed(1)}%</strong></div>
          <div><span class="label">Phase</span><strong data-role="phase">${team.gazellePacing?.currentPhaseLabel ?? '--'}</strong></div>
          <div><span class="label">Next change @</span><strong data-role="next-change">${team.gazellePacing?.enabled ? milesToDisplay(team.gazellePacing.nextChangeDistanceMiles) : '--'}</strong></div>
          <div><span class="label">Recent phases</span><strong data-role="phase-sequence">${team.gazellePacing?.recentPhaseLabels?.join(' → ') ?? '--'}</strong></div>
        </div>
        <div class="team-controls-row">
          <button class="text-button" data-action="pause-toggle" type="button">${team.paused ? 'Resume' : 'Pause'}</button>
          <button class="text-button" data-action="reset-team" type="button">Reset</button>
          <button class="text-button" data-action="checkpoint-down" type="button">Checkpoint -1</button>
          <button class="text-button" data-action="checkpoint-up" type="button">Checkpoint +1</button>
        </div>
      `;

      panel.querySelector('[data-action="pace-down"]').addEventListener('click', () => this.callbacks.onAdjustPace(team.id, -PACE_STEP));
      panel.querySelector('[data-action="pace-up"]').addEventListener('click', () => this.callbacks.onAdjustPace(team.id, PACE_STEP));
      panel.querySelector('[data-action="pause-toggle"]').addEventListener('click', () => this.callbacks.onPauseToggle(team.id, !team.paused));
      panel.querySelector('[data-action="reset-team"]').addEventListener('click', () => this.callbacks.onResetTeam(team.id));
      panel.querySelector('[data-action="checkpoint-down"]').addEventListener('click', () => this.callbacks.onCheckpointChange(team.id, team.checkpointIndex - 1));
      panel.querySelector('[data-action="checkpoint-up"]').addEventListener('click', () => this.callbacks.onCheckpointChange(team.id, team.checkpointIndex + 1));

      teamPanels.appendChild(panel);
      this.teamPanels.set(team.id, panel);
    });
  }

  update(snapshot) {
    const elapsedEl = this.container.querySelector('#elapsedDisplay');
    if (elapsedEl) elapsedEl.textContent = formatDuration(snapshot.elapsedSec);

    const toggleButton = this.container.querySelector('#raceToggleButton');
    if (toggleButton) toggleButton.textContent = snapshot.status === 'running' ? 'Stop Race' : 'Start Race';

    snapshot.teams.forEach((team) => {
      const panel = this.teamPanels.get(team.id);
      if (!panel) return;

      panel.querySelector('[data-role="current-pace"]').textContent = formatPace(team.currentPaceSec);
      panel.querySelector('[data-role="distance"]').textContent = milesToDisplay(team.distanceMiles);
      panel.querySelector('[data-role="checkpoint"]').textContent = team.checkpointIndex;
      panel.querySelector('[data-role="remaining"]').textContent = milesToDisplay(team.distanceRemainingMiles);
      panel.querySelector('[data-role="finish"]').textContent = formatClockTime(team.estimatedFinishAt);
      panel.querySelector('[data-role="gap"]').textContent = `${formatDuration(Math.abs(team.gapSeconds))} ${team.gapSeconds >= 0 ? 'ahead' : 'behind'}`;
      panel.querySelector('[data-role="average-pace"]').textContent = formatPace(team.averagePaceSec);
      panel.querySelector('[data-role="delta"]').textContent = `${team.cumulativeTimeDeltaSec >= 0 ? '+' : '-'}${formatDuration(Math.abs(team.cumulativeTimeDeltaSec))}`;
      panel.querySelector('[data-role="position"]').textContent = `${(team.distanceMiles / snapshot.race.totalDistanceMiles * 100).toFixed(1)}%`;
      panel.querySelector('[data-role="phase"]').textContent = team.gazellePacing?.currentPhaseLabel ?? '--';
      panel.querySelector('[data-role="next-change"]').textContent = team.gazellePacing?.enabled ? milesToDisplay(team.gazellePacing.nextChangeDistanceMiles) : '--';
      panel.querySelector('[data-role="phase-sequence"]').textContent = team.gazellePacing?.recentPhaseLabels?.join(' → ') ?? '--';
      panel.querySelector('[data-action="pause-toggle"]').textContent = team.paused ? 'Resume' : 'Pause';
    });
  }
}
