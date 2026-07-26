export function formatPace(secondsPerMile) {
  if (!Number.isFinite(secondsPerMile) || secondsPerMile <= 0) return '--:--';
  const rounded = Math.round(secondsPerMile);
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function formatClockTime(timestampMs) {
  if (!Number.isFinite(timestampMs) || timestampMs <= 0) return '--:--';
  const date = new Date(timestampMs);
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const suffix = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${suffix}`;
}

export function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '--:--';
  const rounded = Math.round(seconds);
  const minutes = Math.floor(rounded / 60);
  const sec = String(rounded % 60).padStart(2, '0');
  return `${minutes}:${sec}`;
}
