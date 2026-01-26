import { system, world } from "@minecraft/server";
import { DYNAMIC_KEYS, DYNAMIC_PROPERTY_LIMIT_BYTES } from "../config/constants";
import { DebugLogger } from "./DebugLogger";

type PropertyValue = string | number | boolean | undefined;

export class PropertyStore {
  private cache: Map<string, PropertyValue> = new Map();
  private dirtyKeys: Set<string> = new Set();
  private flushHandle?: number;
  private initialized = false;

  constructor(
    private readonly debugLogger?: DebugLogger,
    private readonly flushIntervalTicks = 200
  ) {}

  initialize(): void {
    world.afterEvents.worldLoad.subscribe(() => {
      if (this.initialized) return;
      this.initialized = true;
      this.loadAllToCache();
      this.startAutoFlush();
    });
  }

  get<T extends PropertyValue = PropertyValue>(key: string, fallback?: T): T {
    if (this.cache.has(key)) {
      return this.cache.get(key) as T;
    }

    const value = world.getDynamicProperty(key);
    const result = (value ?? fallback) as T;
    this.cache.set(key, result);
    return result;
  }

  set(key: string, value: PropertyValue): void {
    this.cache.set(key, value);
    this.dirtyKeys.add(key);
  }

  getBoolean(key: string, fallback = false): boolean {
    const value = this.get(key);
    return typeof value === "boolean" ? value : fallback;
  }

  setBoolean(key: string, value: boolean): void {
    this.set(key, value);
  }

  getNumber(key: string, fallback = 0): number {
    const value = this.get(key);
    return typeof value === "number" ? value : fallback;
  }

  setNumber(key: string, value: number): void {
    this.set(key, value);
  }

  getString(key: string, fallback = ""): string {
    const value = this.get(key);
    return typeof value === "string" ? value : fallback;
  }

  setString(key: string, value: string): void {
    this.set(key, value);
  }

  getJSON<T = unknown>(key: string, fallback: T): T {
    const raw = this.getString(key);
    if (!raw) return fallback;

    try {
      return JSON.parse(raw) as T;
    } catch (err) {
      this.debugLogger?.warn(`Failed to parse JSON for key ${key}`, err);
      return fallback;
    }
  }

  setJSON<T = unknown>(key: string, value: T): void {
    try {
      const payload = JSON.stringify(value);
      if (payload.length > DYNAMIC_PROPERTY_LIMIT_BYTES) {
        this.debugLogger?.warn(`Payload too large for key ${key}: ${payload.length} bytes`);
        return;
      }
      this.setString(key, payload);
    } catch (err) {
      this.debugLogger?.warn(`Failed to stringify JSON for key ${key}`, err);
    }
  }

  flush(): void {
    if (this.dirtyKeys.size === 0) return;

    const keys = Array.from(this.dirtyKeys);
    keys.forEach((key) => {
      const value = this.cache.get(key);
      try {
        world.setDynamicProperty(key, value);
      } catch (err) {
        this.debugLogger?.warn(`Failed to flush property ${key}`, err);
      }
    });

    this.dirtyKeys.clear();
    this.debugLogger?.log(`Flushed ${keys.length} properties to world storage`);
  }

  invalidate(key: string): void {
    this.cache.delete(key);
    this.dirtyKeys.delete(key);
  }

  invalidateAll(): void {
    this.cache.clear();
    this.dirtyKeys.clear();
  }

  reload(): void {
    this.dirtyKeys.clear();
    this.cache.clear();
    this.loadAllToCache();
  }

  dispose(): void {
    this.flush();
    this.stopAutoFlush();
    this.cache.clear();
    this.dirtyKeys.clear();
    this.initialized = false;
  }

  private loadAllToCache(): void {
    const keys = Object.values(DYNAMIC_KEYS);
    keys.forEach((key) => {
      const value = world.getDynamicProperty(key);
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        this.cache.set(key, value as PropertyValue);
      }
    });
    this.debugLogger?.log(`Loaded ${this.cache.size} properties into cache`);
  }

  private startAutoFlush(): void {
    if (typeof system.runInterval !== "function") return;

    this.flushHandle = system.runInterval(() => {
      if (this.dirtyKeys.size > 0) {
        this.flush();
      }
    }, this.flushIntervalTicks);
  }

  private stopAutoFlush(): void {
    if (this.flushHandle !== undefined && typeof system.clearRun === "function") {
      system.clearRun(this.flushHandle);
      this.flushHandle = undefined;
    }
  }
}
