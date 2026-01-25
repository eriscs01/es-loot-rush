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

  log(message: string, ...meta: unknown[]): void {
    if (!this.isEnabled()) return;
    console.log(`[LootRush][DEBUG] ${message}`, ...meta);
  }

  warn(message: string, ...meta: unknown[]): void {
    if (!this.isEnabled()) return;
    console.warn(`[LootRush][DEBUG] ${message}`, ...meta);
  }
}
