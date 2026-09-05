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

/** Lifecycle of a real golfer's booking attached to a TeeTime (the Confirm flow). */
export const CONFIRM_STATUS = {
  PENDING: "PENDING", // booked, outside the pre-round confirmation window yet
  AWAITING_CONFIRMATION: "AWAITING_CONFIRMATION", // confirmation request sent, no response yet
  CONFIRMED: "CONFIRMED", // golfer confirmed — booking stands
  CANCELED: "CANCELED", // golfer canceled, or never responded before the auto-release deadline
  MODIFY_REQUESTED: "MODIFY_REQUESTED", // golfer asked to change it; slot released same as a cancel
} as const;
export type ConfirmStatus = (typeof CONFIRM_STATUS)[keyof typeof CONFIRM_STATUS];

/** Distinguishes a Confirm pre-round nudge from a Waitlist "slot opened" alert. */
export const NOTIFICATION_KIND = {
  MATCH: "MATCH",
  CONFIRM_REQUEST: "CONFIRM_REQUEST",
} as const;
export type NotificationKind = (typeof NOTIFICATION_KIND)[keyof typeof NOTIFICATION_KIND];

// Confirm timing: ask 24-48h out, auto-release if still unanswered inside 3h of tee time.
export const CONFIRM_ASK_MIN_HOURS = 24;
export const CONFIRM_ASK_MAX_HOURS = 48;
export const CONFIRM_AUTO_RELEASE_WITHIN_HOURS = 3;

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
