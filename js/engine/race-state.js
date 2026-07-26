import { clamp } from '../utils/calculations.js';

function createTeamState(teamConfig, checkpointSpacingMiles) {
  const initialPace = clamp(teamConfig.overridePaceSec ?? teamConfig.minPaceSec, teamConfig.minPaceSec, teamConfig.maxPaceSec);

  return {
    id: teamConfig.id,
    name: teamConfig.name,
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
    checkpointSpacingMiles
  };
}

export function createRaceState(config) {
  const now = Date.now();
  const checkpointCount = Math.max(1, Math.round(config.totalDistanceMiles / config.checkpointSpacingMiles));

  return {
    version: 1,
    device_id: config.deviceId,
    session_id: config.sessionId,
    created_at: now,
    status: 'ready',
    started_at: null,
    stopped_at: null,
    race: {
      totalDistanceMiles: config.totalDistanceMiles,
      checkpointSpacingMiles: config.checkpointSpacingMiles,
      checkpointCount
    },
    teams: config.teams.map((team) => createTeamState(team, config.checkpointSpacingMiles)),
    event_log: [
      {
        type: 'race_created',
        at: now,
        payload: {
          totalDistanceMiles: config.totalDistanceMiles,
          checkpointSpacingMiles: config.checkpointSpacingMiles,
          teamCount: config.teams.length
        }
      }
    ]
  };
}

export function serializeRaceState(state) {
  return JSON.stringify(state);
}

export function deserializeRaceState(payload) {
  return JSON.parse(payload);
}
