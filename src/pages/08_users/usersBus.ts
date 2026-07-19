/**
 * Tiny cross-page refresh bus for the Users module. Both Available Users
 * and Active Users pages listen for the "users:changed" event and refetch
 * so an Activate on one page immediately refreshes the other if mounted.
 */
type Listener = () => void;

const listeners = new Set<Listener>();

export function subscribeUsers(fn: Listener) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function emitUsersChanged() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* noop */
    }
  });
}
