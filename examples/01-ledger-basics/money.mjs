/**
 * Decimal <-> minor-unit helpers for this example only.
 *
 * `@flashylabs/ledger` does NOT export `toMinor` / `toGold`. The canonical pair
 * lives in Flashy Rails (`flashy-rails/src/gold.mjs`, exported from
 * `@flashylabs/rails`), because knowing that "Gold has two decimals" is a
 * product fact, not a ledger fact. A ledger-basics example that imported Rails
 * to format a number would teach the dependency arrow backwards, so this file
 * does the same thing Rails does — borrow the ledger's money module, which is
 * the one place rounding is allowed to be opinionated — and nothing more.
 *
 * Two deliberate differences from the Rails pair, both for teaching:
 *   - `toMinor` accepts the decimal as a string ('50.00'), so a reader never
 *     sees a float literal standing in for money.
 *   - `toGold` returns a fixed-places string ('50.00'). Rails returns a number
 *     and leaves formatting to the UI; here the console IS the UI.
 */
import { fromDecimal, toDecimal } from '@flashylabs/ledger';

/** Flashy Gold settles to two decimals: 50.00 Gold is 5000 minor units. */
export const GOLD_DECIMALS = 2;

/** A person-facing decimal string -> the ledger's minor units (an integer). */
export const toMinor = (decimal) => fromDecimal(Number(decimal), GOLD_DECIMALS);

/** Minor units -> a person-facing string. Presentation only; never feed it back in. */
export const toGold = (minor) => toDecimal(minor, GOLD_DECIMALS).toFixed(GOLD_DECIMALS);
