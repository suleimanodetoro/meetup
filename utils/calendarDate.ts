/** Postgres DATE values describe a calendar day, not a UTC instant. */
export function parseCalendarDate(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

/** Preserve the day selected in a local date picker when writing a DATE. */
export function formatCalendarDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function calculateAge(birthday: Date, today: Date = new Date()): number {
  let age = today.getFullYear() - birthday.getFullYear();
  const monthDiff = today.getMonth() - birthday.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthday.getDate())) {
    age--;
  }
  return age;
}
