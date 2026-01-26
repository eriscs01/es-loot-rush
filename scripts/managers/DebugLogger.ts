import { DYNAMIC_KEYS } from "../config/constants";
import { PropertyStore } from "./PropertyStore";

export class DebugLogger {
  constructor(private readonly propertyStore: PropertyStore) {
    void propertyStore;
  }

  isEnabled(): boolean {
    return this.propertyStore.getBoolean(DYNAMIC_KEYS.debugMode, false);
  }

  setEnabled(flag: boolean): void {
    this.propertyStore.setBoolean(DYNAMIC_KEYS.debugMode, flag);
    this.log(`Debug mode ${flag ? "enabled" : "disabled"}`);
  }

  debug(message: string, ...meta: unknown[]): void {
    if (!this.isEnabled() || !console.debug) return;
    console.debug(`[LootRush][DEBUG] ${message}`, ...meta);
  }

  log(message: string, ...meta: unknown[]): void {
    if (!this.isEnabled() || !console.log) return;
    console.log(`[LootRush][INFO] ${message}`, ...meta);
  }

  warn(message: string, ...meta: unknown[]): void {
    if (!this.isEnabled() || !console.warn) return;
    console.warn(`[LootRush][WARN] ${message}`, ...meta);
  }
}
