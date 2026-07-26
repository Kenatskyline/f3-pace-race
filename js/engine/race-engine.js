import { calculateCheckpoint, calculateGapSeconds, clamp } from '../utils/calculations.js';

const PACE_TRANSITION_RATE = 12;
const PHASES = ['recovery', 'comfortable', 'steady', 'push', 'hardPush'];
const PHASE_LABELS = {
  recovery: 'Recovery',
  comfortable: 'Comfortable',
  steady: 'Steady',
  push: 'Push',
  hardPush: 'Hard Push'
};
const MODE_WEIGHTS = {
  mild: { recovery: 1.2, comfortable: 4.2, steady: 3.8, push: 1.3, hardPush: 0.25 },
  moderate: { recovery: 1.4, comfortable: 3.6, steady: 3.2, push: 2, hardPush: 0.8 },
  chaotic: { recovery: 1.8, comfortable: 2.8, steady: 2.6, push: 2.2, hardPush: 1.8 }
};
const MODE_MAX_TARGET_JUMP = { mild: 16, moderate: 28, chaotic: 48 };
const MODE_BLOCK_CHANCE = { mild: 0.16, moderate: 0.22, chaotic: 0.2 };
const DEFAULT_INTERVAL_MILES = 0.25;
// Limits catch-up updates when multiple interval thresholds are crossed in one frame.
const MAX_PHASE_CHANGES_PER_TICK = 8;
const MAX_RECENT_PHASES = 6;
const MINI_BLOCK_SHORT_LENGTH = 2;
const MINI_BLOCK_LONG_LENGTH = 3;
const MINI_BLOCK_SHORT_RATIO = 0.45;
const MINI_BLOCK_BUILD_MODE_PROBABILITY = 0.5;

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
    this.state.eventLog.push({ type, at: Date.now(), payload });
  }

  getSnapshot() {
    const now = Date.now();
    const elapsedSec = this.state.startedAt ? (now - this.state.startedAt) / 1000 : 0;
    const raceDurationSec = this.state.race.durationSec ?? 40 * 60;
    const remainingSec = Math.max(0, raceDurationSec - elapsedSec);

    const teams = this.state.teams.map((team) => {
      const distanceRemainingMiles = Math.max(0, this.state.race.totalDistanceMiles - team.distanceMiles);
      const estFinishTime = this.estimateFinishTime(team, now, distanceRemainingMiles);
      const averagePaceSec = team.distanceMiles > 0 ? team.movingTimeSec / team.distanceMiles : team.currentPaceSec;
      return {
        ...team,
        distanceRemainingMiles,
        estimatedFinishAt: estFinishTime,
        averagePaceSec,
        gazellePacing: team.gazellePacing
          ? {
              ...team.gazellePacing,
              currentPhaseLabel: PHASE_LABELS[team.gazellePacing.currentPhase] ?? PHASE_LABELS.comfortable,
              recentPhaseLabels: team.gazellePacing.recentPhases.map((phase) => PHASE_LABELS[phase] ?? PHASE_LABELS.comfortable)
            }
          : null
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
      remainingSec,
      teams: teamsWithGaps
    };
  }

  estimateFinishTime(team, now, distanceRemainingMiles) {
    if (team.finishedAt) return team.finishedAt;
    if (team.currentPaceSec <= 0) return null;
    return now + (distanceRemainingMiles * team.currentPaceSec * 1000);
  }

  startRace() {
    const now = Date.now();
    this.state.status = 'running';
    this.state.startedAt = this.state.startedAt ?? now;
    this.state.stoppedAt = null;
    this.lastTickAt = now;
    this.logEvent('race_started');
    this.beginLoop();
    this.notify();
  }

  stopRace() {
    this.state.status = 'stopped';
    this.state.stoppedAt = Date.now();
    this.logEvent('race_stopped');
    this.endLoop();
    this.notify();
  }

  resetRace() {
    const spacing = this.state.race.checkpointSpacingMiles;
    this.state.status = 'ready';
    this.state.startedAt = null;
    this.state.stoppedAt = null;
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
      checkpointSpacingMiles: spacing,
      gazellePacing: team.gazellePacing
        ? {
            ...team.gazellePacing,
            currentPhase: 'comfortable',
            nextChangeDistanceMiles: team.gazellePacing.intervalMiles ?? DEFAULT_INTERVAL_MILES,
            recentPhases: ['comfortable'],
            pendingBlock: []
          }
        : null
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
    const raceDurationSec = this.state.race.durationSec ?? 40 * 60;
    const elapsedSec = this.state.startedAt ? (now - this.state.startedAt) / 1000 : 0;

    if (this.state.status !== 'running' || deltaSec === 0) {
      this.notify();
      return;
    }

    if (elapsedSec >= raceDurationSec) {
      this.state.status = 'results';
      this.state.stoppedAt = now;
      this.state.teams.forEach((team) => {
        if (!team.finishedAt) team.finishedAt = now;
      });
      this.logEvent('race_finished', { reason: 'duration_elapsed' });
      this.endLoop();
      this.notify();
      return;
    }

    const maxPaceStep = PACE_TRANSITION_RATE * deltaSec;

    this.state.teams.forEach((team) => {
      if (team.paused || team.finishedAt) return;

      this.updateGazellePacing(team);

      const paceDiff = team.targetPaceSec - team.currentPaceSec;
      const paceStep = clamp(paceDiff, -maxPaceStep, maxPaceStep);
      team.currentPaceSec += paceStep;

      const progressMiles = deltaSec / Math.max(1, team.currentPaceSec);
      const nextDistance = team.distanceMiles + progressMiles;
      team.distanceMiles = team.gazellePacing?.enabled
        ? nextDistance
        : Math.min(this.state.race.totalDistanceMiles, nextDistance);
      team.movingTimeSec += deltaSec;

      const checkpoint = calculateCheckpoint(team.distanceMiles, this.state.race.checkpointSpacingMiles, this.state.race.totalDistanceMiles);
      if (checkpoint > team.checkpointIndex) {
        team.checkpointIndex = checkpoint;
        this.logEvent('checkpoint_crossed', { teamId: team.id, checkpointIndex: checkpoint });
      }
    });

    this.notify();
  }

  updateGazellePacing(team) {
    const pacing = team.gazellePacing;
    if (!pacing?.enabled) return;

    const intervalMiles = Math.max(0.05, pacing.intervalMiles || DEFAULT_INTERVAL_MILES);
    let phaseChangeCount = 0;
    while (team.distanceMiles >= pacing.nextChangeDistanceMiles && phaseChangeCount < MAX_PHASE_CHANGES_PER_TICK) {
      const nextPhase = this.selectStructuredPhase(team, pacing);
      const rawTarget = this.randomPaceInRange(pacing.phaseRanges[nextPhase], team.minPaceSec, team.maxPaceSec);
      const mode = pacing.randomnessLevel ?? 'moderate';
      const maxJump = MODE_MAX_TARGET_JUMP[mode] ?? MODE_MAX_TARGET_JUMP.moderate;
      const nextTarget = clamp(
        team.targetPaceSec + clamp(rawTarget - team.targetPaceSec, -maxJump, maxJump),
        team.minPaceSec,
        team.maxPaceSec
      );

      team.targetPaceSec = nextTarget;
      pacing.currentPhase = nextPhase;
      pacing.recentPhases = [...pacing.recentPhases, nextPhase].slice(-MAX_RECENT_PHASES);
      pacing.nextChangeDistanceMiles += intervalMiles;

      this.logEvent('gazelle_phase_changed', {
        teamId: team.id,
        phase: nextPhase,
        targetPaceSec: nextTarget,
        nextChangeDistanceMiles: pacing.nextChangeDistanceMiles
      });

      phaseChangeCount += 1;
    }

    if (phaseChangeCount === MAX_PHASE_CHANGES_PER_TICK && team.distanceMiles >= pacing.nextChangeDistanceMiles) {
      this.logEvent('gazelle_phase_change_cap_reached', {
        teamId: team.id,
        distanceMiles: team.distanceMiles,
        nextChangeDistanceMiles: pacing.nextChangeDistanceMiles
      });
    }
  }

  selectStructuredPhase(team, pacing) {
    const mode = pacing.randomnessLevel ?? 'moderate';
    const chaoticMode = mode === 'chaotic';
    const recent = pacing.recentPhases ?? [];
    const previous = recent[recent.length - 1] ?? 'comfortable';
    const beforePrevious = recent[recent.length - 2] ?? null;

    if (pacing.pendingBlock.length > 0) {
      const nextInBlock = pacing.pendingBlock.shift();
      if (this.isPhaseAllowed(previous, beforePrevious, nextInBlock, chaoticMode)) {
        return nextInBlock;
      }
      this.logEvent('gazelle_block_cleared', {
        teamId: team.id,
        blockedPhase: nextInBlock,
        remainingBlock: [...pacing.pendingBlock]
      });
      pacing.pendingBlock = [];
    }

    const weights = this.buildPhaseWeights(mode, previous, beforePrevious, chaoticMode);
    const phase = this.weightedPick(weights, (candidate) => this.isPhaseAllowed(previous, beforePrevious, candidate, chaoticMode));
    this.maybeCreateMiniBlock(pacing, mode, phase);
    return phase;
  }

  buildPhaseWeights(mode, previous, beforePrevious, chaoticMode) {
    const weights = { ...(MODE_WEIGHTS[mode] ?? MODE_WEIGHTS.moderate) };

    if (previous === 'push') {
      weights.recovery *= 2.2;
      weights.hardPush *= 0.5;
    } else if (previous === 'hardPush') {
      weights.recovery *= 3;
      weights.push *= 0.6;
      weights.hardPush *= 0.2;
    } else if (previous === 'recovery') {
      weights.comfortable *= 1.9;
      weights.steady *= 1.5;
    } else if (previous === 'comfortable') {
      weights.steady *= 1.35;
      weights.push *= 1.1;
    } else if (previous === 'steady') {
      weights.comfortable *= 1.2;
      weights.push *= 1.25;
    }

    if (beforePrevious && previous === beforePrevious) {
      weights[previous] = 0;
    }

    if (!chaoticMode && previous === 'recovery') {
      weights.hardPush = 0;
    }

    return weights;
  }

  maybeCreateMiniBlock(pacing, mode, currentPhase) {
    const chance = MODE_BLOCK_CHANCE[mode] ?? MODE_BLOCK_CHANCE.moderate;
    if (Math.random() > chance) return;

    const pending = [];
    const blockLength = Math.random() < MINI_BLOCK_SHORT_RATIO ? MINI_BLOCK_SHORT_LENGTH : MINI_BLOCK_LONG_LENGTH;
    const buildMode = Math.random() < MINI_BLOCK_BUILD_MODE_PROBABILITY;

    if (buildMode) {
      const index = PHASES.indexOf(currentPhase);
      for (let step = 1; step < blockLength; step += 1) {
        const nextIndex = Math.min(PHASES.length - 1, index + step);
        pending.push(PHASES[nextIndex]);
      }
    } else {
      for (let step = 1; step < blockLength; step += 1) {
        pending.push(currentPhase);
      }
    }

    pacing.pendingBlock = pending;
  }

  weightedPick(weights, isAllowed) {
    const candidates = PHASES
      .filter((phase) => (weights[phase] ?? 0) > 0)
      .filter((phase) => isAllowed(phase));

    if (candidates.length === 0) {
      return 'comfortable';
    }

    const total = candidates.reduce((sum, phase) => sum + (weights[phase] ?? 0), 0);
    if (total <= 0) return candidates[0];

    let roll = Math.random() * total;
    for (const phase of candidates) {
      roll -= weights[phase] ?? 0;
      if (roll <= 0) return phase;
    }
    return candidates[candidates.length - 1];
  }

  isPhaseAllowed(previous, beforePrevious, candidate, chaoticMode) {
    if (previous === candidate && beforePrevious === candidate) return false;
    if (!chaoticMode && previous === 'recovery' && candidate === 'hardPush') return false;
    return true;
  }

  randomPaceInRange(range, fallbackMin, fallbackMax) {
    const min = range?.min ?? fallbackMin;
    const max = range?.max ?? fallbackMax;
    const low = Math.min(min, max);
    const high = Math.max(min, max);
    return low + (Math.random() * (high - low));
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
    if (team.gazellePacing) {
      team.gazellePacing.currentPhase = 'comfortable';
      team.gazellePacing.nextChangeDistanceMiles = team.gazellePacing.intervalMiles ?? DEFAULT_INTERVAL_MILES;
      team.gazellePacing.recentPhases = ['comfortable'];
      team.gazellePacing.pendingBlock = [];
    }

    this.logEvent('team_reset', { teamId });
    this.notify();
  }
}
