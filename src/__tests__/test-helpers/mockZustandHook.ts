export function createMockZustandHook<State extends object>(state: State) {
  const listeners = new Set<() => void>();

  const hook = ((selector?: (state: State) => unknown) => {
    if (selector) {
      return selector(state);
    }

    return state;
  }) as unknown as {
    (selector?: (state: State) => unknown): unknown;
    getState: () => State;
    subscribe: (listener: () => void) => () => void;
  };

  hook.getState = () => state;

  hook.subscribe = (listener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  return hook;
}
