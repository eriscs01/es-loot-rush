import minecraftLinting from "eslint-plugin-minecraft-linting";
import tsParser from "@typescript-eslint/parser";
import ts from "@typescript-eslint/eslint-plugin";
export default [
  {
    files: ["scripts/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: "latest",
    },
    plugins: {
      ts,
      "minecraft-linting": minecraftLinting,
    },
    rules: {
      "minecraft-linting/avoid-unnecessary-command": "error",
      // Error on unused imports, variables, and parameters
      "no-unused-vars": ["error", { args: "all", argsIgnorePattern: "^_", vars: "all", varsIgnorePattern: "^_" }],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { args: "all", argsIgnorePattern: "^_", vars: "all", varsIgnorePattern: "^_" },
      ],
    },
  },
];
