import js from "@eslint/js";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    ignores: ["node_modules/", "dist/", "build/", ".venv/"],
  },
  {
    // 既定：ブラウザ側 UI（index.html 由来の inline JS など）
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser },
    },
    rules: {
      "no-unused-vars": "warn",
      "no-undef": "error",
    },
  },
  {
    // Google Apps Script（Code.js）: GASサービスと google.script を許可
    files: ["Code.js"],
    languageOptions: {
      sourceType: "script",
      globals: {
        ...globals.browser,
        SpreadsheetApp: "readonly",
        HtmlService: "readonly",
        google: "readonly",
      },
    },
    rules: {
      // onOpen / getMasterData / setupMasterSheet は GAS 側から呼ばれるため未使用に見える
      "no-unused-vars": "off",
    },
  },
  {
    // Node スクリプト（hooks / tools）
    files: ["**/*.cjs", "tools/**/*.js", ".claude/**/*.js", ".agents/**/*.cjs"],
    languageOptions: {
      sourceType: "commonjs",
      globals: { ...globals.node },
    },
  },
];
