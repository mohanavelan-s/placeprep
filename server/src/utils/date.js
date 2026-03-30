function formatDateInTimezone(date, timezone) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function getTodayInTimezone(timezone) {
  return formatDateInTimezone(new Date(), timezone);
}

function normalizeDate(value, timezone) {
  if (!value) {
    return getTodayInTimezone(timezone);
  }

  if (value instanceof Date) {
    return formatDateInTimezone(value, timezone);
  }

  return String(value).slice(0, 10);
}

function getDateRange(days, timezone) {
  const current = new Date();
  const range = [];

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(current);
    date.setDate(current.getDate() - offset);
    range.push(formatDateInTimezone(date, timezone));
  }

  return range;
}

function minutesBetween(startAt, endAt) {
  if (!startAt || !endAt) {
    return 0;
  }

  return Math.max(0, Math.round((new Date(endAt).getTime() - new Date(startAt).getTime()) / 60000));
}

module.exports = {
  formatDateInTimezone,
  getTodayInTimezone,
  normalizeDate,
  getDateRange,
  minutesBetween,
};
