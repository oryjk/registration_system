export type RegistrationWindowState = "not_started" | "open" | "closed";

export interface RegistrationWindowResult {
  state: RegistrationWindowState;
  countdownTarget: number | null;
}

function timestamp(value?: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function resolveRegistrationWindow({
  now,
  isRegistering,
  registrationStartAt,
  registrationEndAt,
}: {
  now: number;
  isRegistering: boolean;
  registrationStartAt?: string | null;
  registrationEndAt?: string | null;
}): RegistrationWindowResult {
  if (!isRegistering) return { state: "closed", countdownTarget: null };

  const start = timestamp(registrationStartAt);
  const end = timestamp(registrationEndAt);
  if (start !== null && now < start) {
    return { state: "not_started", countdownTarget: start };
  }
  if (end !== null && now >= end) {
    return { state: "closed", countdownTarget: null };
  }
  return { state: "open", countdownTarget: end };
}
