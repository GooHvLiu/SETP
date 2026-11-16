import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "data/**",
      "logs/**",
      "uploads/**",
      "coverage/**",
      "src/routes/routes.ts",
      "src/swagger/swagger.json",
      "prisma/migrations/**",
      "test/api-full-test.cjs",
    ],
  },
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-namespace": "off",
      "@typescript-eslint/no-this-alias": "off",
      "no-empty": "off",
      "no-useless-escape": "off",
      "no-control-regex": "off",
      "prefer-const": "off",
    },
  },
  {
    // 分层边界：controller 只编排请求/响应，数据访问一律走 service
    files: ["src/modules/**/*.controller.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "@src/db/prisma", message: "controller 不允许直接访问 Prisma，请在 service 中封装查询" },
            { name: "@prisma/client", message: "controller 不允许直接依赖 Prisma Client" },
          ],
        },
      ],
    },
  }
);
