export function createMockZustandHook<State>(state: State) {
  return ((selector?: (state: State) => unknown) => {
    if (selector) {
      return selector(state);
    }

    return state;
  }) as unknown;
}
