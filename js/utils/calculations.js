export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function milesToFeet(miles) {
  return miles * 5280;
}

export function milesToDisplay(miles) {
  const safeMiles = Math.max(0, miles);
  const wholeMiles = Math.floor(safeMiles);
  const feet = Math.round((safeMiles - wholeMiles) * 5280);
  return `${wholeMiles} mi ${feet} ft`;
}

export function calculateCheckpoint(distanceMiles, checkpointSpacingMiles, totalDistanceMiles) {
  if (checkpointSpacingMiles <= 0) return 0;
  const raw = Math.floor(distanceMiles / checkpointSpacingMiles);
  const max = Math.round(totalDistanceMiles / checkpointSpacingMiles);
  return clamp(raw, 0, max);
}

export function calculateGapSeconds(team, opponent) {
  if (!team || !opponent) return 0;
  const distanceGap = team.distanceMiles - opponent.distanceMiles;
  const referencePace = team.currentPaceSec > 0 ? team.currentPaceSec : 1;
  return distanceGap * referencePace;
}
