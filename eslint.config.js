import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: ["node_modules/", "dist/"],
  },
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
];
