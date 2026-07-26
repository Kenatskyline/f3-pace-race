import { clamp } from '../utils/calculations.js';

function createTeamState(teamConfig, checkpointSpacingMiles) {
  const initialPace = clamp(teamConfig.overridePaceSec ?? teamConfig.minPaceSec, teamConfig.minPaceSec, teamConfig.maxPaceSec);

  return {
    id: teamConfig.id,
    name: teamConfig.name,
    color: teamConfig.color,
    role: teamConfig.role ?? null,
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
    checkpointSpacingMiles
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
      checkpointCount
    },
    teams: config.teams.map((team) => createTeamState(team, config.checkpointSpacingMiles)),
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
