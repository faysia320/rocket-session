export const memoKeys = {
  all: ["memo"] as const,
  blocks: () => [...memoKeys.all, "blocks"] as const,
};
