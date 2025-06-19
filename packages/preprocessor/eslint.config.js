import { defineConfig } from "eslint/config";
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default defineConfig([
	js.configs.recommended,
	...tseslint.configs.recommended,
	{
		files: ["src/**/*.ts"],
		languageOptions: {
			parser: tseslint.parser,
		},
		rules: {
			semi: "error",
			"prefer-const": "error",
			"no-console": "off",
			"@typescript-eslint/no-unused-vars": "error",
		},
	},
]);
