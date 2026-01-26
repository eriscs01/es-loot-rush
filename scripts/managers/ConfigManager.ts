import { GameConfig } from "../types";
import { DYNAMIC_KEYS } from "../config/constants";
import { PropertyStore } from "./PropertyStore";

const DEFAULT_CONFIG: GameConfig = {
  easyChallengeCount: 3,
  mediumChallengeCount: 2,
  hardChallengeCount: 1,
  totalRounds: 4,
  roundDurationTicks: 18000,
};

export class ConfigManager {
  private config: GameConfig;

  constructor(private readonly propertyStore: PropertyStore) {
    this.config = { ...DEFAULT_CONFIG };
  }

  loadConfig(): void {
    const parsed = this.propertyStore.getJSON<GameConfig>(DYNAMIC_KEYS.config, DEFAULT_CONFIG);
    this.config = this.validateConfig(parsed) ? parsed : { ...DEFAULT_CONFIG };
  }

  saveConfig(): void {
    this.propertyStore.setJSON(DYNAMIC_KEYS.config, this.config);
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
