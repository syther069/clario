import type { IEventBus, EventHandler } from "../../application/ports/IEventBus";

/**
 * Clean Architecture - Infrastructure Layer
 * BrowserEventBus
 * Concrete pub/sub bus implementing IEventBus via CustomEvent & BroadcastChannel.
 */
export class BrowserEventBus implements IEventBus {
  private readonly listeners = new Map<string, Set<EventHandler>>();
  private broadcastChannel: BroadcastChannel | null = null;

  public constructor() {
    if (typeof window !== "undefined" && typeof BroadcastChannel !== "undefined") {
      try {
        this.broadcastChannel = new BroadcastChannel("clario_channel");
        this.broadcastChannel.onmessage = (event) => {
          if (event?.data?.type) {
            this.notifyLocalListeners(event.data.type, event.data.payload);
          }
        };
      } catch {
        // Fallback silently if BroadcastChannel not permitted
      }
    }
  }

  public publish<T = unknown>(event: string, payload: T): void {
    // 1. Notify local in-memory listeners
    this.notifyLocalListeners(event, payload);

    // 2. Dispatch browser DOM window CustomEvent if in browser
    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
      try {
        window.dispatchEvent(new CustomEvent(event, { detail: payload }));
      } catch {
        // Safe fallback
      }
    }

    // 3. Broadcast across tabs
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({ type: event, payload });
      } catch {
        // Safe fallback
      }
    }
  }

  public subscribe<T = unknown>(event: string, handler: EventHandler<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const set = this.listeners.get(event)!;
    set.add(handler as EventHandler);

    // Also register window listener for DOM custom events
    let domListener: ((e: Event) => void) | null = null;
    if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
      domListener = (e: Event) => {
        const customEvent = e as CustomEvent<T>;
        handler(customEvent.detail);
      };
      window.addEventListener(event, domListener);
    }

    return () => {
      set.delete(handler as EventHandler);
      if (domListener && typeof window !== "undefined") {
        window.removeEventListener(event, domListener);
      }
    };
  }

  private notifyLocalListeners(event: string, payload: unknown): void {
    const set = this.listeners.get(event);
    if (set) {
      for (const listener of set) {
        try {
          listener(payload);
        } catch (err) {
          console.warn(`[BrowserEventBus] Error in listener for event ${event}:`, err);
        }
      }
    }
  }
}
