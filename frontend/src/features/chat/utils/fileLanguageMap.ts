const EXT_TO_LANG: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  py: "python",
  pyw: "python",
  rs: "rust",
  go: "go",
  java: "java",
  c: "c",
  h: "c",
  cpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  hpp: "cpp",
  cs: "csharp",
  rb: "ruby",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  json: "json",
  jsonc: "json",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  md: "markdown",
  mdx: "markdown",
  html: "html",
  htm: "html",
  css: "css",
  scss: "scss",
  sass: "sass",
  less: "less",
  sql: "sql",
  xml: "xml",
  svg: "xml",
  swift: "swift",
  kt: "kotlin",
  php: "php",
  r: "r",
  lua: "lua",
  dart: "dart",
  vue: "vue",
  svelte: "svelte",
};

export function getLanguageFromFilename(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return EXT_TO_LANG[ext] ?? "";
}

export const TEXT_SAFE_EXTENSIONS = new Set([
  ...Object.keys(EXT_TO_LANG),
  "txt",
  "env",
  "gitignore",
  "dockerignore",
  "editorconfig",
  "prettierrc",
  "eslintrc",
  "babelrc",
  "ini",
  "cfg",
  "conf",
  "log",
  "csv",
  "tsv",
  "diff",
  "patch",
  "makefile",
  "dockerfile",
  "prisma",
  "graphql",
  "gql",
  "proto",
]);

/** 확장자 없는 텍스트 파일명 */
const TEXT_SAFE_NAMES = new Set([
  "makefile",
  "dockerfile",
  "gemfile",
  "rakefile",
  "procfile",
  "vagrantfile",
  ".gitignore",
  ".dockerignore",
  ".editorconfig",
  ".prettierrc",
  ".eslintrc",
  ".babelrc",
  ".env",
  ".env.local",
  ".env.example",
]);

export function isTextSafeFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  if (TEXT_SAFE_NAMES.has(lower)) return true;
  const ext = lower.split(".").pop() ?? "";
  return TEXT_SAFE_EXTENSIONS.has(ext);
}

export const MAX_TEXT_FILE_SIZE = 500 * 1024; // 500KB
