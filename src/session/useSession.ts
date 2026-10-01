export interface Session {
  /** Who is unlocked, or undefined when the app is view-only. */
  name?: string;
  minutesLeft?: number;
}

const MOCK_SESSION: Session = { name: 'Anna', minutesLeft: 42 };

/**
 * Not mounted anywhere yet: the lock pill is visuals-only until #33 lands.
 * Mocked identity for the visual system. Replace the body with the real
 * session once auth lands (#33); consumers only depend on the Session shape.
 */
export function useSession(): Session {
  return MOCK_SESSION;
}
