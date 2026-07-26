import { RaceEngine } from '../engine/race-engine.js';
import { createRaceState, serializeRaceState } from '../engine/race-state.js';
import { CourseVisualization } from './course-visualization.js';
import { RaceDirectorDashboard } from './race-director-dashboard.js';
import { SetupScreen } from './setup-screen.js';
import { formatDuration, formatPace } from '../utils/time-utils.js';

const STORAGE_KEY = 'f3-race-director-state';

function randomId(prefix) {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const token = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${prefix}-${token}`;
}

function getStatusText(status) {
  const statusMap = {
    results: 'Race complete',
    running: 'Race in progress',
    ready: 'Race ready',
    stopped: 'Race paused/stopped'
  };
  return statusMap[status] ?? 'Race paused/stopped';
}

export class UIController {
  constructor() {
    this.watchPace = document.getElementById('watchPace');
    this.watchTeam = document.getElementById('watchTeam');
    this.watchNeedle = document.getElementById('watchNeedle');
    this.setupContainer = document.getElementById('setupScreen');
    this.dashboardContainer = document.getElementById('dashboardScreen');
    this.courseContainer = document.getElementById('courseVisualization');
    this.resultsContainer = document.getElementById('resultsScreen');

    this.setupScreen = null;
    this.dashboard = null;
    this.course = null;
    this.engine = null;
  }

  init() {
    this.setupScreen = new SetupScreen(this.setupContainer, (config) => this.startRace(config));
    this.setupScreen.render();
  }

  startRace(config) {
    const raceState = createRaceState({
      ...config,
      deviceId: randomId('device'),
      sessionId: randomId('session')
    });

    this.engine = new RaceEngine(raceState);
    this.course = new CourseVisualization(this.courseContainer);

    this.dashboard = new RaceDirectorDashboard(this.dashboardContainer, {
      onToggleRace: (isRunning) => {
        if (isRunning) {
          this.engine.stopRace();
        } else {
          this.engine.startRace();
        }
      },
      onResetRace: () => this.engine.resetRace(),
      onAdjustPace: (teamId, deltaSec) => this.engine.adjustPace(teamId, deltaSec),
      onPauseToggle: (teamId, paused) => this.engine.setPaused(teamId, paused),
      onCheckpointChange: (teamId, checkpointIndex) => this.engine.setCheckpoint(teamId, checkpointIndex),
      onResetTeam: (teamId) => this.engine.resetTeam(teamId)
    });

    this.setupContainer.classList.add('hidden');
    this.dashboardContainer.classList.remove('hidden');
    this.courseContainer.classList.remove('hidden');
    this.resultsContainer.classList.remove('hidden');

    this.course.render(raceState);
    this.dashboard.render(this.engine.getSnapshot());

    this.engine.subscribe((snapshot) => {
      this.dashboard.update(snapshot);
      this.course.update(snapshot);
      this.renderSecondaryWatch(snapshot);
      this.renderResults(snapshot);
      localStorage.setItem(STORAGE_KEY, serializeRaceState(snapshot));
    });

    this.engine.startRace();
  }

  renderSecondaryWatch(snapshot) {
    const leadTeam = [...snapshot.teams].sort((a, b) => b.distanceMiles - a.distanceMiles)[0];
    if (!leadTeam) return;

    this.watchTeam.textContent = leadTeam.name.toUpperCase();
    this.watchPace.textContent = formatPace(leadTeam.currentPaceSec);

    const minPace = Math.min(...snapshot.teams.map((team) => team.minPaceSec));
    const maxPace = Math.max(...snapshot.teams.map((team) => team.maxPaceSec));
    const paceRange = Math.max(1, maxPace - minPace);
    const rotation = ((leadTeam.currentPaceSec - minPace) / paceRange) * 360;
    this.watchNeedle.style.transform = `translateX(-50%) rotate(${rotation}deg)`;
  }

  renderResults(snapshot) {
    const top = [...snapshot.teams].sort((a, b) => b.distanceMiles - a.distanceMiles)[0];
    const statusText = getStatusText(snapshot.status);

    this.resultsContainer.innerHTML = `
      <section class="card">
        <div class="section-header">
          <span class="label">Race status</span>
          <strong>${statusText}</strong>
        </div>
        <div class="race-meta-grid">
          <div><span class="label">Leader</span><strong>${top ? top.name : '--'}</strong></div>
          <div><span class="label">Time remaining</span><strong>${formatDuration(snapshot.remainingSec)}</strong></div>
          <div><span class="label">Event log entries</span><strong>${snapshot.eventLog.length}</strong></div>
          <div><span class="label">Sync ready</span><strong>${snapshot.sessionId} + ${snapshot.deviceId}</strong></div>
        </div>
      </section>
    `;
  }
}
