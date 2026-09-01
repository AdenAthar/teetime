export const SEARCH_STATUS = {
  ACTIVE: "ACTIVE",
  PAUSED: "PAUSED",
  MATCHED: "MATCHED",
  EXPIRED: "EXPIRED",
} as const;
export type SearchStatus = (typeof SEARCH_STATUS)[keyof typeof SEARCH_STATUS];

export const TEE_STATUS = { OPEN: "OPEN", BOOKED: "BOOKED" } as const;
export type TeeStatus = (typeof TEE_STATUS)[keyof typeof TEE_STATUS];

export const CHANNEL = { EMAIL: "EMAIL", TEXT: "TEXT" } as const;
export type Channel = (typeof CHANNEL)[keyof typeof CHANNEL];

export const BOOKING_PROVIDERS = [
  "GolfNow",
  "foreUp",
  "Club Prophet",
  "TeeSnap",
  "Lightspeed",
  "Chronogolf",
] as const;

export const BRAND = {
  name: "teetime",
  crimson: "#E11D2E",
  email: "contact@teetime.app",
};
