import { clamp } from '../utils/calculations.js';

const DEFAULT_GAZELLE_PHASE_RANGES = {
  recovery: { min: 560, max: 660 },
  comfortable: { min: 500, max: 600 },
  steady: { min: 460, max: 540 },
  push: { min: 420, max: 500 },
  hardPush: { min: 390, max: 470 }
};

function isGazelleTeam(teamConfig) {
  return typeof teamConfig?.name === 'string' && teamConfig.name.toLowerCase().includes('gazelle');
}

function inferTeamRole(teamConfig, teamIndex) {
  const normalizedName = String(teamConfig?.name ?? '').toLowerCase();
  if (normalizedName.includes('gazelle')) return 'Q';
  if (normalizedName.includes('clydesdale')) return 'SQ';
  if (teamIndex === 0) return 'Q';
  if (teamIndex === 1) return 'SQ';
  return null;
}

function normalizePhaseRanges(rawRanges, teamConfig) {
  return Object.entries(DEFAULT_GAZELLE_PHASE_RANGES).reduce((acc, [phaseKey, defaults]) => {
    const source = rawRanges?.[phaseKey] ?? defaults;
    const low = clamp(Math.min(source.min, source.max), teamConfig.minPaceSec, teamConfig.maxPaceSec);
    const high = clamp(Math.max(source.min, source.max), teamConfig.minPaceSec, teamConfig.maxPaceSec);
    acc[phaseKey] = { min: Math.min(low, high), max: Math.max(low, high) };
    return acc;
  }, {});
}

function createTeamState(teamConfig, checkpointSpacingMiles, gazelleConfig, teamIndex) {
  const initialPace = clamp(teamConfig.overridePaceSec ?? teamConfig.minPaceSec, teamConfig.minPaceSec, teamConfig.maxPaceSec);
  const gazelleEnabled = isGazelleTeam(teamConfig);
  const randomnessLevel = gazelleConfig?.randomnessLevel ?? 'moderate';
  const intervalMiles = Math.max(0.05, gazelleConfig?.intervalMiles ?? 0.25);
  const phaseRanges = normalizePhaseRanges(gazelleConfig?.phaseRanges, teamConfig);
  const role = inferTeamRole(teamConfig, teamIndex);

  return {
    id: teamConfig.id,
    name: teamConfig.name,
    role,
    color: teamConfig.color,
    minPaceSec: teamConfig.minPaceSec,
    maxPaceSec: teamConfig.maxPaceSec,
    currentPaceSec: initialPace,
    targetPaceSec: initialPace,
    overridePaceSec: teamConfig.overridePaceSec ?? null,
    paused: false,
    finishedAt: null,
    distanceMiles: 0,
    movingTimeSec: 0,
    checkpointIndex: 0,
    cumulativeTimeDeltaSec: 0,
    paceAdjustments: 0,
    checkpointSpacingMiles,
    gazellePacing: {
      enabled: gazelleEnabled,
      randomnessLevel,
      intervalMiles,
      phaseRanges,
      currentPhase: 'comfortable',
      nextChangeDistanceMiles: intervalMiles,
      recentPhases: ['comfortable'],
      pendingBlock: []
    }
  };
}

export function createRaceState(config) {
  const now = Date.now();
  const checkpointCount = Math.max(1, Math.round(config.totalDistanceMiles / config.checkpointSpacingMiles));
  const eventLog = [
    {
      type: 'race_created',
      at: now,
      payload: {
        totalDistanceMiles: config.totalDistanceMiles,
        checkpointSpacingMiles: config.checkpointSpacingMiles,
        teamCount: config.teams.length
      }
    }
  ];

  return {
    version: 1,
    deviceId: config.deviceId,
    sessionId: config.sessionId,
    createdAt: now,
    status: 'ready',
    startedAt: null,
    stoppedAt: null,
    race: {
      totalDistanceMiles: config.totalDistanceMiles,
      checkpointSpacingMiles: config.checkpointSpacingMiles,
      checkpointCount,
      durationSec: Math.max(300, Number(config.raceDurationSec) || 40 * 60)
    },
    teams: config.teams.map((team, index) => createTeamState(team, config.checkpointSpacingMiles, config.gazellePacing, index)),
    eventLog
  };
}

export function serializeRaceState(state) {
  return JSON.stringify({
    ...state,
    device_id: state.deviceId,
    session_id: state.sessionId,
    created_at: state.createdAt,
    started_at: state.startedAt,
    stopped_at: state.stoppedAt,
    event_log: state.eventLog
  });
}

export function deserializeRaceState(payload) {
  const parsed = JSON.parse(payload);
  return {
    ...parsed,
    deviceId: parsed.deviceId ?? parsed.device_id,
    sessionId: parsed.sessionId ?? parsed.session_id,
    createdAt: parsed.createdAt ?? parsed.created_at,
    startedAt: parsed.startedAt ?? parsed.started_at,
    stoppedAt: parsed.stoppedAt ?? parsed.stopped_at,
    eventLog: parsed.eventLog ?? parsed.event_log ?? []
  };
}
