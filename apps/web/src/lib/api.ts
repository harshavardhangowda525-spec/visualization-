export type Studio = {
  id: string;
  slug: string;
  name: string;
  description: string;
  location: string;
  capacity: number;
  categoryId: string;
  timezone: string;
  equipment: string[];
  images: { url: string; alt: string }[];
  facilities: { name: string }[];
  hours: { weekday: number; openMinute: number; closeMinute: number }[];
  services: {
    id: string;
    name: string;
    hourlyPaise: number;
    taxBps: number;
    minMinutes: number;
    maxMinutes: number;
    stepMinutes: number;
  }[];
};
export type Plan = {
  id: string;
  name: string;
  description: string;
  pricePaise: number;
  days: number;
  discountBps: number;
  creditMinutes: number;
  maxBookings: number;
  benefits: string[];
};
export const money = (paise: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(paise / 100);
export const dateTime = (date: string) =>
  new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(date));
export async function api<T = any>(
  path: string,
  body?: unknown,
  method?: string,
): Promise<T> {
  const response = await fetch("/api/v1" + path, {
    method: method || (body ? "POST" : "GET"),
    credentials: "same-origin",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const r = await response
    .json()
    .catch(() => ({ message: "Service unavailable" }));
  if (!response.ok)
    throw new Error(
      Array.isArray(r.message)
        ? r.message.join(", ")
        : r.message || "Request failed",
    );
  return r;
}
export async function serverApi<T = any>(path: string): Promise<T> {
  const r = await fetch(
    (process.env.API_INTERNAL_URL || "http://127.0.0.1:4000") +
      "/api/v1" +
      path,
    { cache: "no-store", signal: AbortSignal.timeout(6000) },
  );
  if (!r.ok)
    throw new Error(
      "The studio catalogue is temporarily unavailable. Please try again shortly.",
    );
  return r.json();
}

export function requestKey() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
