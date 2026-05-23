export const throttleConfig = () => ({
  ttlMs: parseInt(process.env.THROTTLE_TTL_MS ?? '60000', 10),
  limit: parseInt(process.env.THROTTLE_LIMIT ?? '60', 10),
  aiTtlMs: parseInt(process.env.THROTTLE_AI_TTL_MS ?? '60000', 10),
  aiLimit: parseInt(process.env.THROTTLE_AI_LIMIT ?? '10', 10),
});

export type ThrottleConfig = ReturnType<typeof throttleConfig>;
