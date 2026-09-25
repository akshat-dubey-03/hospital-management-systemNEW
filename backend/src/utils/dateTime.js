// src/utils/dateTime.js
// Utility functions for date/time handling.
// Strategy: Store all timestamps in UTC (PostgreSQL TIMESTAMPTZ).
// Frontend receives ISO 8601 strings and displays in local timezone.

/**
 * Returns today's date as a JS Date object at midnight UTC.
 */
export function todayUTC() {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

/**
 * Checks if a given Date is in the past (before today UTC).
 * @param {Date} date
 * @returns {boolean}
 */
export function isPastDate(date) {
  const today = todayUTC();
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d < today;
}

/**
 * Generates time slots between startTime and endTime with a given duration.
 * Times are strings in 'HH:MM' format.
 * @param {string} startTime - e.g. '09:00'
 * @param {string} endTime - e.g. '13:00'
 * @param {number} durationMinutes - e.g. 30
 * @returns {Array<{ startTime: string, endTime: string }>}
 */
export function generateTimeSlots(startTime, endTime, durationMinutes) {
  const slots = [];
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);

  let currentMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  while (currentMinutes + durationMinutes <= endMinutes) {
    const slotStart = minutesToTime(currentMinutes);
    const slotEnd = minutesToTime(currentMinutes + durationMinutes);
    slots.push({ startTime: slotStart, endTime: slotEnd });
    currentMinutes += durationMinutes;
  }

  return slots;
}

/**
 * Converts total minutes from midnight to 'HH:MM' string.
 * @param {number} minutes
 * @returns {string}
 */
export function minutesToTime(minutes) {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Returns the day of week (0=Monday, 6=Sunday) for a given date string 'YYYY-MM-DD'.
 * Note: JS Date.getDay() returns 0=Sunday; we remap to 0=Monday.
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @returns {number} 0–6
 */
export function getDayOfWeek(dateStr) {
  const date = new Date(dateStr + 'T00:00:00Z');
  const jsDay = date.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  return jsDay === 0 ? 6 : jsDay - 1; // Remap to 0=Mon, 6=Sun
}
