import { world } from "@minecraft/server";
import { GameConfig } from "../types";

const DEFAULT_CONFIG: GameConfig = {
  easyChallengeCount: 3,
  mediumChallengeCount: 2,
  hardChallengeCount: 1,
  totalRounds: 4,
  roundDurationTicks: 18000,
};

export class ConfigManager {
  private readonly configKey = "lootRush:config";
  private config: GameConfig;

  constructor(private readonly worldRef = world) {
    this.config = { ...DEFAULT_CONFIG };
  }

  loadConfig(): void {
    const raw = this.worldRef.getDynamicProperty(this.configKey);
    if (typeof raw !== "string") {
      this.resetToDefaults();
      return;
    }

    try {
      const parsed = JSON.parse(raw) as GameConfig;
      this.config = this.validateConfig(parsed) ? parsed : { ...DEFAULT_CONFIG };
    } catch {
      this.resetToDefaults();
    }
  }

  saveConfig(): void {
    try {
      this.worldRef.setDynamicProperty(this.configKey, JSON.stringify(this.config));
    } catch {
      // Dynamic properties not yet initialized; ignore for now.
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
