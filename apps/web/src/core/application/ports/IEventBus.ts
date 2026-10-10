/**
 * Clean Architecture - Application Port
 * Interface: IEventBus
 * Observer / Pub-Sub abstraction for reactive state and cross-component updates.
 */

export type EventHandler<T = unknown> = (payload: T) => void;

export interface IEventBus {
  publish<T = unknown>(event: string, payload: T): void;
  subscribe<T = unknown>(event: string, handler: EventHandler<T>): () => void;
}
