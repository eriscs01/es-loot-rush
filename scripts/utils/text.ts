import { ItemStack } from "@minecraft/server";
import { MinecraftItemTypes } from "@minecraft/vanilla-data";
import { ChallengeDefinition } from "../types";

/**
 * Removes Minecraft color codes from the beginning of a string.
 * Color codes are in the format §X where X is 0-9, a-f, k-o, or r.
 * @param text - The text to remove color codes from
 * @returns The text without leading color codes
 */
export function removeColorCode(text: string): string {
  return text.replace(/^§[0-9a-fk-or]/i, "");
}

export function getItemLabel(typeId: MinecraftItemTypes, includeVariant = true): string | undefined {
  const itemStack = new ItemStack(typeId);
  if (includeVariant) return itemStack.nameTag;

  const id = typeId.replace("minecraft:", "");
  // Return just the base type
  if (id.includes("_wool")) return "Wool";
  if (id.includes("_planks")) return "Planks";
  if (id.includes("_log")) return "Log";
  if (id.includes("_concrete_powder")) return "Concrete";
  if (id.includes("_concrete")) return "Concrete";
  if (id.includes("_terracotta")) return "Terracotta";
}

export function buildChallengeName(challenge: ChallengeDefinition): string {
  const includeVariant = challenge.variant !== "any";
  return `${challenge.count} ${getItemLabel(challenge.item, includeVariant)}`;
}
