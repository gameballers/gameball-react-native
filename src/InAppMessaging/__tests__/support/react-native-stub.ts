/**
 * What the in-app messaging core touches of React Native: the image cache, and nothing else.
 *
 * The core is plain TypeScript and its tests run in the `iam` jest project, which deliberately
 * does not load React Native's jest setup — that setup replaces the global timers, and the
 * analytics and service suites drive time with jest's own async fake timers.
 */
export const Image = {
  prefetch: (_url: string): Promise<boolean> => Promise.resolve(true),
};
