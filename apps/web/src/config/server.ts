import {
  parseServerConfiguration,
  toPublicConfiguration,
  type PublicConfiguration,
  type ServerConfiguration,
} from "./schema";

let cachedServerConfiguration: ServerConfiguration | undefined;

export function getServerConfiguration(): ServerConfiguration {
  cachedServerConfiguration ??= parseServerConfiguration(process.env);
  return cachedServerConfiguration;
}

export function getPublicConfiguration(): PublicConfiguration {
  return toPublicConfiguration(getServerConfiguration());
}
