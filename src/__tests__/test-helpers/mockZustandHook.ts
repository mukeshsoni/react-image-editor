export function createMockZustandHook<State>(state: State) {
  const hook = ((selector?: (state: State) => unknown) => {
    if (selector) {
      return selector(state);
    }

    return state;
  }) as unknown as {
    (selector?: (state: State) => unknown): unknown;
    getState: () => State;
  };

  hook.getState = () => state;

  return hook;
}
