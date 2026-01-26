import { world } from "@minecraft/server";
import { DYNAMIC_KEYS } from "../config/constants";

export class DebugLogger {
  constructor(private readonly worldRef = world) {}

  isEnabled(): boolean {
    return this.worldRef.getDynamicProperty(DYNAMIC_KEYS.debugMode) === true;
  }

  setEnabled(flag: boolean): void {
    this.worldRef.setDynamicProperty(DYNAMIC_KEYS.debugMode, flag);
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
