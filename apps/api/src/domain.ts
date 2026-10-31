import {
  createHmac,
  timingSafeEqual,
  randomInt,
  randomBytes,
  createHash,
} from "node:crypto";
export class DomainError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function assert(ok: unknown, message: string, status = 400): asserts ok {
  if (!ok) throw new DomainError(status, message);
}
export const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export function constantEqual(a: string, b: string) {
  if (!/^[a-f0-9]{64}$/i.test(a) || !/^[a-f0-9]{64}$/i.test(b)) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}
export const signature = (body: string | Buffer, secret: string) =>
  createHmac("sha256", secret).update(body).digest("hex");
export function price(
  hourlyPaise: number,
  minutes: number,
  discountBps: number,
  taxBps: number,
  creditMinutes = 0,
) {
  assert(
    [hourlyPaise, minutes, discountBps, taxBps, creditMinutes].every(
      Number.isSafeInteger,
    ),
    "Invalid price inputs",
  );
  assert(
    hourlyPaise > 0 &&
      minutes > 0 &&
      discountBps >= 0 &&
      discountBps <= 10000 &&
      taxBps >= 0 &&
      taxBps <= 10000 &&
      creditMinutes >= 0,
    "Invalid price inputs",
  );
  const subtotalPaise = Math.round((hourlyPaise * minutes) / 60);
  const credit = Math.min(minutes, creditMinutes);
  const billable = Math.round((hourlyPaise * (minutes - credit)) / 60);
  const discountPaise =
    subtotalPaise - billable + Math.round((billable * discountBps) / 10000);
  const taxPaise = Math.round(
    ((subtotalPaise - discountPaise) * taxBps) / 10000,
  );
  const totalPaise = subtotalPaise - discountPaise + taxPaise;
  assert(Number.isSafeInteger(totalPaise), "Amount overflow");
  return {
    subtotalPaise,
    discountPaise,
    taxPaise,
    totalPaise,
    creditMinutes: credit,
  };
}
export function localParts(date: Date, timeZone: string) {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(date);
  const get = (t: string) => p.find((x) => x.type === t)!.value;
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
      get("weekday"),
    ),
    minute: Number(get("hour")) * 60 + Number(get("minute")),
  };
}
export function validateSlot(
  start: Date,
  end: Date,
  service: { minMinutes: number; maxMinutes: number; stepMinutes: number },
  hours: { weekday: number; openMinute: number; closeMinute: number }[],
  timezone: string,
  now = new Date(),
) {
  assert(
    Number.isFinite(start.getTime()) && Number.isFinite(end.getTime()),
    "Invalid date",
  );
  const minutes = (end.getTime() - start.getTime()) / 60000;
  assert(
    start > now && start.getTime() < now.getTime() + 180 * 86400000,
    "Select a future date within 180 days",
  );
  assert(
    minutes >= service.minMinutes &&
      minutes <= service.maxMinutes &&
      minutes % service.stepMinutes === 0,
    "Invalid booking duration",
  );
  const a = localParts(start, timezone),
    b = localParts(end, timezone);
  const h = hours.find((h) => h.weekday === a.weekday);
  assert(
    h &&
      a.date === b.date &&
      a.minute >= h.openMinute &&
      b.minute <= h.closeMinute &&
      (a.minute - h.openMinute) % service.stepMinutes === 0 &&
      start.getUTCSeconds() === 0 &&
      start.getUTCMilliseconds() === 0,
    "Outside operating hours or slot boundaries",
  );
  return minutes;
}
export function makeCode(pepper: string) {
  assert(pepper.length >= 32, "Session OTP is not configured", 503);
  const code = String(randomInt(100000, 1000000));
  const salt = randomBytes(16).toString("hex");
  return { code, salt, hash: signature(`${salt}:${code}`, pepper) };
}
export function codeValid(
  code: string,
  row: {
    salt: string;
    hash: string;
    attempts: number;
    expiresAt: Date;
    consumedAt: Date | null;
  },
  pepper: string,
  now = new Date(),
) {
  return (
    !row.consumedAt &&
    row.attempts < 5 &&
    row.expiresAt > now &&
    constantEqual(row.hash, signature(`${row.salt}:${code}`, pepper))
  );
}
export const canAccess = (
  actor: { id: string; role: string },
  owner: string,
  assigned?: string,
) =>
  actor.role === "ADMIN" ||
  actor.id === owner ||
  (actor.role === "STAFF" && actor.id === assigned);
