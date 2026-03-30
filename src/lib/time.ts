export function formatHoursFromMinutes(minutes?: number | null) {
  const safeMinutes = Number(minutes || 0);
  const hours = Math.round((safeMinutes / 60) * 10) / 10;

  if (hours === 1) {
    return "1 hr";
  }

  return `${hours.toFixed(hours % 1 === 0 ? 0 : 1)} hrs`;
}

export function hoursStringFromMinutes(minutes?: number | null) {
  const safeMinutes = Number(minutes || 0);
  const hours = Math.round((safeMinutes / 60) * 10) / 10;
  return hours.toFixed(hours % 1 === 0 ? 0 : 1);
}

export function parseHoursToMinutes(value: string, fallbackMinutes = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallbackMinutes;
  }

  return Math.round(parsed * 60);
}
