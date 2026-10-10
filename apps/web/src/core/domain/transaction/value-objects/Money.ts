/**
 * Clean Architecture - Domain Layer
 * Value Object: Money
 * Pure domain logic: immutable, side-effect free financial value representation.
 */

export class Money {
  private readonly _amount: number;
  private readonly _currency: string;

  private constructor(amount: number, currency: string = "USD") {
    if (Number.isNaN(amount)) {
      throw new Error("Money amount cannot be NaN");
    }
    this._amount = amount;
    this._currency = (currency || "USD").toUpperCase();
  }

  public static create(amount: number | string, currency: string = "USD"): Money {
    const parsed = typeof amount === "string" ? Number.parseFloat(amount) : amount;
    return new Money(Number.isNaN(parsed) ? 0 : parsed, currency);
  }

  public static zero(currency: string = "USD"): Money {
    return new Money(0, currency);
  }

  public get amount(): number {
    return this._amount;
  }

  public get currency(): string {
    return this._currency;
  }

  public add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this._amount + other._amount, this._currency);
  }

  public subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this._amount - other._amount, this._currency);
  }

  public format(locale: string = "en-US"): string {
    return this._amount.toLocaleString(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  public formatWithCurrency(locale: string = "en-US"): string {
    return `$${this.format(locale)}`;
  }

  private assertSameCurrency(other: Money): void {
    if (this._currency !== other._currency) {
      throw new Error(
        `Currency mismatch: cannot operate on ${this._currency} and ${other._currency}`,
      );
    }
  }
}
