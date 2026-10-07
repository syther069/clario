import { getServerConfiguration } from "./config/server";

export function register(): void {
  try {
    getServerConfiguration();
  } catch (error) {
    console.warn(
      "[instrumentation] Server configuration validation deferred:",
      error instanceof Error ? error.message : error,
    );
  }
}

