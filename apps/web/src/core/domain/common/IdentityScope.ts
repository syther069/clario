/**
 * Clean Architecture - Domain Layer
 * Value Object: IdentityScope
 * Encapsulates tenant boundary scoping, case-insensitive address normalization,
 * and scoped storage key derivation across multi-mode environments.
 */

export class IdentityScope {
  private static readonly _knownScopes = new Set<string>();

  /**
   * Uniformly normalizes user identifiers across all modes and storage layers,
   * handling EVM 0x addresses, Privy DIDs, and local IDs with case-insensitivity.
   */
  public static normalize(id?: string | null): string {
    if (!id || typeof id !== "string") return "";
    return id.trim().toLowerCase();
  }

  /**
   * Registers a tenant scope into active memory for cross-scope garbage collection.
   */
  public static register(scopeId?: string | null): void {
    if (scopeId && scopeId.trim()) {
      this._knownScopes.add(this.normalize(scopeId));
    }
  }

  /**
   * Returns a copy of all registered active tenant scopes.
   */
  public static getKnownScopes(): string[] {
    return Array.from(this._knownScopes);
  }

  /**
   * Clears all registered tenant scopes (used in test teardown).
   */
  public static clearKnownScopes(): void {
    this._knownScopes.clear();
  }

  /**
   * Generates a scoped key prefix for multi-tenant isolation.
   */
  public static getScopedKey(baseKey: string, scopeId?: string | null): string {
    if (!scopeId || !scopeId.trim()) return baseKey;
    const normalized = this.normalize(scopeId);
    this.register(normalized);
    return `${normalized}_${baseKey}`;
  }
}
