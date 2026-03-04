import { ServiceAction } from "@/lib/types";

export const actionLabels: Record<ServiceAction, string> = {
  start: "Start",
  stop: "Stop",
  restart: "Restart",
  shutdown: "Shutdown",
  reset: "Reset",
  suspend: "Suspend",
  resume: "Resume",
};

export const primaryActions: ServiceAction[] = ["start", "stop"];
