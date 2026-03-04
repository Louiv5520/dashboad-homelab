import { UnifiedService } from "@/lib/types";

export function normalizeServices(input: UnifiedService[]) {
  return [...input].sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === "running" ? -1 : 1;
    }

    if (a.source !== b.source) {
      return a.source.localeCompare(b.source);
    }

    return a.name.localeCompare(b.name);
  });
}
