import { api } from "./client";
import type { UsageInfo } from "@/types";

export const usageApi = {
  get: () => api.get<UsageInfo>("/api/usage/"),
};
