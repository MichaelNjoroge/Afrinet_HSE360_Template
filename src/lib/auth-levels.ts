// Authorization level helper (mirrors public.user_auth_level in the database).
// Level 1: all employees (report incidents)
// Level 2: supervisor, auditor
// Level 3: hr_manager, hse_coordinator (review, investigate, recommend)
// Level 4: director, hse_manager (approve, close)
// Level 5: admin (approve, close, full system control)

export type AuthLevel = 1 | 2 | 3 | 4 | 5;

const LEVEL_BY_ROLE: Record<string, AuthLevel> = {
  admin: 5,
  director: 4,
  hse_manager: 4,
  hr_manager: 3,
  hse_coordinator: 3,
  supervisor: 2,
  auditor: 2,
};

export function getAuthLevel(roles: ReadonlyArray<string> | undefined | null): AuthLevel {
  if (!roles?.length) return 1;
  let max: AuthLevel = 1;
  for (const role of roles) {
    const lvl = LEVEL_BY_ROLE[role];
    if (lvl && lvl > max) max = lvl;
  }
  return max;
}

export const MIN_LEVEL_TO_CLOSE: AuthLevel = 4;
export const MIN_LEVEL_TO_ONBOARD_CONTRACTOR: AuthLevel = 4;
