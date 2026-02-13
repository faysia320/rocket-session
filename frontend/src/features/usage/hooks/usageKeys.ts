export const usageKeys = {
  all: ['usage'] as const,
  info: () => [...usageKeys.all, 'info'] as const,
};
