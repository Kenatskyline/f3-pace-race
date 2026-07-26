import { calculateCheckpoint, calculateGapSeconds, clamp } from '../utils/calculations.js';

const PACE_TRANSITION_RATE = 12;

export class RaceEngine {
  constructor(raceState) {
    this.state = raceState;
    this.listeners = new Set();
    this.rafId = null;
    this.lastTickAt = Date.now();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => this.listeners.delete(listener);
  }

  notify() {
    const snapshot = this.getSnapshot();
    this.listeners.forEach((listener) => listener(snapshot));
  }

  logEvent(type, payload = {}) {
    this.state.event_log.push({ type, at: Date.now(), payload });
  }

  getSnapshot() {
    const now = Date.now();
    const elapsedSec = this.state.started_at ? (now - this.state.started_at) / 1000 : 0;

    const teams = this.state.teams.map((team) => {
      const distanceRemainingMiles = Math.max(0, this.state.race.totalDistanceMiles - team.distanceMiles);
      const estFinishTime = team.finishedAt || (team.currentPaceSec > 0 ? now + (distanceRemainingMiles * team.currentPaceSec * 1000) : null);
      const averagePaceSec = team.distanceMiles > 0 ? team.movingTimeSec / team.distanceMiles : team.currentPaceSec;
      return {
        ...team,
        distanceRemainingMiles,
        estimatedFinishAt: estFinishTime,
        averagePaceSec
      };
    });

    const teamsWithGaps = teams.map((team) => {
      const opponent = teams.find((entry) => entry.id !== team.id);
      return {
        ...team,
        gapSeconds: calculateGapSeconds(team, opponent)
      };
    });

    return {
      ...this.state,
      now,
      elapsedSec,
      teams: teamsWithGaps
    };
  }

  startRace() {
    const now = Date.now();
    this.state.status = 'running';
    this.state.started_at = this.state.started_at ?? now;
    this.state.stopped_at = null;
    this.lastTickAt = now;
    this.logEvent('race_started');
    this.beginLoop();
    this.notify();
  }

  stopRace() {
    this.state.status = 'stopped';
    this.state.stopped_at = Date.now();
    this.logEvent('race_stopped');
    this.endLoop();
    this.notify();
  }

  resetRace() {
    const spacing = this.state.race.checkpointSpacingMiles;
    this.state.status = 'ready';
    this.state.started_at = null;
    this.state.stopped_at = null;
    this.state.teams = this.state.teams.map((team) => ({
      ...team,
      paused: false,
      finishedAt: null,
      distanceMiles: 0,
      movingTimeSec: 0,
      checkpointIndex: 0,
      cumulativeTimeDeltaSec: 0,
      paceAdjustments: 0,
      currentPaceSec: team.overridePaceSec ?? team.minPaceSec,
      targetPaceSec: team.overridePaceSec ?? team.minPaceSec,
      checkpointSpacingMiles: spacing
    }));
    this.logEvent('race_reset');
    this.endLoop();
    this.notify();
  }

  beginLoop() {
    if (this.rafId) return;
    const loop = () => {
      this.tick();
      if (this.state.status === 'running') {
        this.rafId = requestAnimationFrame(loop);
      } else {
        this.rafId = null;
      }
    };
    this.rafId = requestAnimationFrame(loop);
  }

  endLoop() {
    if (!this.rafId) return;
    cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  tick() {
    const now = Date.now();
    const deltaSec = Math.max(0, (now - this.lastTickAt) / 1000);
    this.lastTickAt = now;

    if (this.state.status !== 'running' || deltaSec === 0) {
      this.notify();
      return;
    }

    this.state.teams.forEach((team) => {
      if (team.paused || team.finishedAt) return;

      const paceDiff = team.targetPaceSec - team.currentPaceSec;
      const paceStep = clamp(paceDiff, -PACE_TRANSITION_RATE * deltaSec, PACE_TRANSITION_RATE * deltaSec);
      team.currentPaceSec += paceStep;

      const progressMiles = deltaSec / Math.max(1, team.currentPaceSec);
      team.distanceMiles = Math.min(this.state.race.totalDistanceMiles, team.distanceMiles + progressMiles);
      team.movingTimeSec += deltaSec;

      const checkpoint = calculateCheckpoint(team.distanceMiles, this.state.race.checkpointSpacingMiles, this.state.race.totalDistanceMiles);
      if (checkpoint > team.checkpointIndex) {
        team.checkpointIndex = checkpoint;
        this.logEvent('checkpoint_crossed', { teamId: team.id, checkpointIndex: checkpoint });
      }

      if (team.distanceMiles >= this.state.race.totalDistanceMiles && !team.finishedAt) {
        team.finishedAt = now;
        this.logEvent('team_finished', { teamId: team.id });
      }
    });

    if (this.state.teams.every((team) => team.finishedAt)) {
      this.state.status = 'results';
      this.state.stopped_at = now;
      this.logEvent('race_finished');
      this.endLoop();
    }

    this.notify();
  }

  adjustPace(teamId, deltaSec) {
    const team = this.state.teams.find((entry) => entry.id === teamId);
    if (!team) return;

    const previousTarget = team.targetPaceSec;
    team.targetPaceSec = clamp(team.targetPaceSec + deltaSec, team.minPaceSec, team.maxPaceSec);
    const remaining = Math.max(0, this.state.race.totalDistanceMiles - team.distanceMiles);
    const deltaProjection = (previousTarget - team.targetPaceSec) * remaining;
    team.cumulativeTimeDeltaSec += deltaProjection;
    team.paceAdjustments += 1;

    this.logEvent('pace_adjusted', {
      teamId,
      previousTarget,
      nextTarget: team.targetPaceSec,
      deltaSec,
      projectedGainSec: deltaProjection
    });

    this.notify();
  }

  setPaused(teamId, paused) {
    const team = this.state.teams.find((entry) => entry.id === teamId);
    if (!team) return;
    team.paused = paused;
    this.logEvent(paused ? 'team_paused' : 'team_resumed', { teamId });
    this.notify();
  }

  setCheckpoint(teamId, nextCheckpointIndex) {
    const team = this.state.teams.find((entry) => entry.id === teamId);
    if (!team) return;

    const maxCheckpoint = this.state.race.checkpointCount;
    const clampedCheckpoint = clamp(nextCheckpointIndex, 0, maxCheckpoint);
    team.checkpointIndex = clampedCheckpoint;
    team.distanceMiles = clampedCheckpoint * this.state.race.checkpointSpacingMiles;
    team.finishedAt = team.distanceMiles >= this.state.race.totalDistanceMiles ? Date.now() : null;
    this.logEvent('checkpoint_corrected', { teamId, checkpointIndex: clampedCheckpoint });
    this.notify();
  }

  resetTeam(teamId) {
    const team = this.state.teams.find((entry) => entry.id === teamId);
    if (!team) return;

    team.paused = false;
    team.finishedAt = null;
    team.distanceMiles = 0;
    team.movingTimeSec = 0;
    team.checkpointIndex = 0;
    team.cumulativeTimeDeltaSec = 0;
    team.currentPaceSec = team.overridePaceSec ?? team.minPaceSec;
    team.targetPaceSec = team.currentPaceSec;

    this.logEvent('team_reset', { teamId });
    this.notify();
  }
}
