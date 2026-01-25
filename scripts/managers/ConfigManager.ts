import { world } from "@minecraft/server";
import { GameConfig } from "../types";
import { DYNAMIC_KEYS, DYNAMIC_PROPERTY_LIMIT_BYTES } from "../config/constants";
import { DebugLogger } from "./DebugLogger";

const DEFAULT_CONFIG: GameConfig = {
  easyChallengeCount: 3,
  mediumChallengeCount: 2,
  hardChallengeCount: 1,
  totalRounds: 4,
  roundDurationTicks: 18000,
};

export class ConfigManager {
  private config: GameConfig;

  constructor(
    private readonly worldRef = world,
    private readonly debugLogger?: DebugLogger
  ) {
    this.config = { ...DEFAULT_CONFIG };
  }

  loadConfig(): void {
    const raw = this.worldRef.getDynamicProperty(DYNAMIC_KEYS.config);
    if (typeof raw !== "string") {
      this.resetToDefaults();
      return;
    }

    try {
      const parsed = JSON.parse(raw) as GameConfig;
      this.config = this.validateConfig(parsed) ? parsed : { ...DEFAULT_CONFIG };
    } catch (err) {
      this.debugLogger?.warn("Failed to parse config; resetting to defaults", err);
      this.resetToDefaults();
    }
  }

  saveConfig(): void {
    try {
      const payload = JSON.stringify(this.config);
      if (payload.length <= DYNAMIC_PROPERTY_LIMIT_BYTES) {
        this.worldRef.setDynamicProperty(DYNAMIC_KEYS.config, payload);
      }
    } catch (err) {
      this.debugLogger?.warn("Failed to save config", err);
    }
  }

  getConfig(): GameConfig {
    return { ...this.config };
  }

  getConfigValue<K extends keyof GameConfig>(key: K): GameConfig[K] {
    return this.config[key];
  }

  setConfig<K extends keyof GameConfig>(key: K, value: GameConfig[K]): void {
    const candidate = { ...this.config, [key]: value } as GameConfig;
    if (!this.validateConfig(candidate)) {
      return;
    }

    this.config = candidate;
  }

  resetToDefaults(): void {
    this.config = { ...DEFAULT_CONFIG };
  }

  validateConfig(config: GameConfig): boolean {
    return config.totalRounds > 0 && config.roundDurationTicks > 0;
  }

  getDefaults(): GameConfig {
    return { ...DEFAULT_CONFIG };
  }
}
