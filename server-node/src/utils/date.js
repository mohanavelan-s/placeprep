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

function formatDateTimeInTimezone(date, timezone, options = {}) {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: timezone,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    ...options,
  }).format(new Date(date));
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

function pad(value) {
  return String(value).padStart(2, '0');
}

function addDaysToDateString(dateString, days) {
  const [year, month, day] = String(dateString).slice(0, 10).split('-').map(Number);
  const date = new Date(Date.UTC(year, (month || 1) - 1, day || 1));
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
}

function parseTimeZoneOffsetMinutes(timeZoneName) {
  const normalized = String(timeZoneName || '').trim();
  if (!normalized || normalized === 'GMT' || normalized === 'UTC') {
    return 0;
  }

  const match = normalized.match(/(?:GMT|UTC)([+-])(\d{1,2})(?::?(\d{2}))?/i);
  if (!match) {
    return 0;
  }

  const sign = match[1] === '-' ? -1 : 1;
  const hours = Number(match[2] || 0);
  const minutes = Number(match[3] || 0);
  return sign * ((hours * 60) + minutes);
}

function getTimeZoneOffsetMinutes(date, timezone) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    timeZoneName: 'shortOffset',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const timeZoneName = formatter
    .formatToParts(new Date(date))
    .find((part) => part.type === 'timeZoneName')?.value;

  return parseTimeZoneOffsetMinutes(timeZoneName);
}

function zonedDateTimeToUtc(dateValue, timeValue, timezone) {
  const [year, month, day] = String(dateValue).slice(0, 10).split('-').map(Number);
  const [hour, minute] = String(timeValue || '09:00').slice(0, 5).split(':').map(Number);

  let targetTime = new Date(Date.UTC(year, (month || 1) - 1, day || 1, hour || 0, minute || 0, 0, 0));

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const offsetMinutes = getTimeZoneOffsetMinutes(targetTime, timezone);
    const adjustedTime = new Date(
      Date.UTC(year, (month || 1) - 1, day || 1, hour || 0, minute || 0, 0, 0)
      - (offsetMinutes * 60000)
    );

    if (adjustedTime.getTime() === targetTime.getTime()) {
      break;
    }

    targetTime = adjustedTime;
  }

  return targetTime.toISOString();
}

function splitDateTimeInput(value, fallbackTime = '09:00') {
  const normalized = String(value || '').trim().replace(' ', 'T');
  if (!normalized) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return {
      date: normalized,
      time: fallbackTime,
    };
  }

  const match = normalized.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  const hasExplicitOffset = /([zZ]|[+-]\d{2}:\d{2})$/.test(normalized);

  if (match && !hasExplicitOffset) {
    return {
      date: match[1],
      time: match[2],
    };
  }

  return null;
}

function normalizeDateTime(value, timezone, fallbackTime = '09:00') {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const splitValue = splitDateTimeInput(value, fallbackTime);
  if (splitValue) {
    return zonedDateTimeToUtc(splitValue.date, splitValue.time, timezone);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function getNextDayMorningDateTime(timezone, now = new Date(), hour = 9, minute = 0) {
  const tomorrow = addDaysToDateString(formatDateInTimezone(now, timezone), 1);
  return zonedDateTimeToUtc(tomorrow, `${pad(hour)}:${pad(minute)}`, timezone);
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
  formatDateTimeInTimezone,
  getTodayInTimezone,
  normalizeDate,
  normalizeDateTime,
  getNextDayMorningDateTime,
  zonedDateTimeToUtc,
  getDateRange,
  minutesBetween,
};
