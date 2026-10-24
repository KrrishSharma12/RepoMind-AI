import {
  Braces,
  Bug,
  Clock,
  Compass,
  Database,
  FileCode,
  GitPullRequest,
  Layers,
  Lightbulb,
  Link2,
  MessageSquare,
  Plug,
  Search,
  type LucideIcon,
} from "lucide-react";

/** Flip to true once GitHub OAuth exists. Until then, auth CTAs render as clearly labeled placeholders. */
export const AUTH_ENABLED = true;

export const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "For Developers", href: "#for-developers" },
] as const;

/* ---------- Sample data for the mockups (static, not live output) ---------- */

export interface TreeNode {
  name: string;
  depth: number;
  kind: "dir" | "file";
  active?: boolean;
}

export const FILE_TREE: TreeNode[] = [
  { name: "src", depth: 0, kind: "dir" },
  { name: "auth", depth: 1, kind: "dir" },
  { name: "token.ts", depth: 2, kind: "file" },
  { name: "middleware", depth: 1, kind: "dir" },
  { name: "auth.ts", depth: 2, kind: "file", active: true },
  { name: "routes", depth: 1, kind: "dir" },
  { name: "auth.ts", depth: 2, kind: "file", active: true },
  { name: "orders.ts", depth: 2, kind: "file" },
];

export const CHAT_MOCK = {
  repo: "acme/backend",
  question: "How does authentication work?",
  answer: [
    "Protected routes run through requireAuth in src/middleware/auth.ts. It reads the Bearer token from the request and verifies it as a JWT before the handler runs.",
    "Tokens are issued by the login handler in src/routes/auth.ts, after the password check succeeds.",
  ],
  sources: [
    { path: "src/middleware/auth.ts", lines: "12-34" },
    { path: "src/routes/auth.ts", lines: "20-48" },
  ],
};

export type Severity = "Security" | "Potential Bug" | "Performance";

export const REVIEW_MOCK = {
  number: 214,
  title: "Add user profile endpoint",
  file: "src/routes/profile.ts",
  diff: [
    { n: 14, text: 'router.get("/profile/:id", requireAuth, async (req, res) => {' },
    { n: 15, text: "  const user = await db.user.findById(req.params.id);" },
    { n: 16, text: "  res.json(user.profile);" },
    { n: 17, text: "});" },
  ],
  primary: {
    severity: "Security" as Severity,
    line: 15,
    text: "Potential authorization issue: verify that the authenticated user is allowed to access this profile.",
    context: "src/routes/orders.ts:31 checks req.user.id before returning data. This route does not.",
    fix: [
      "if (req.user.id !== req.params.id) {",
      '  return res.status(403).json({ error: "Forbidden" });',
      "}",
    ],
  },
  others: [
    {
      severity: "Potential Bug" as Severity,
      line: 16,
      text: "findById can return null for an unknown id, so user.profile would throw.",
    },
    {
      severity: "Performance" as Severity,
      line: 15,
      text: "This loads the full user row. Select only the fields the response needs.",
    },
  ],
};

/* ---------- Page copy ---------- */

export interface Step {
  title: string;
  description: string;
  icon: LucideIcon;
}

export const HOW_STEPS: Step[] = [
  { title: "Connect GitHub", description: "Authorize access to the repositories you choose.", icon: Plug },
  { title: "Index your code", description: "Repository files are processed and organized into searchable code context.", icon: Database },
  { title: "Ask or review", description: "Chat with the codebase, or trigger an automated pull request review.", icon: MessageSquare },
  { title: "Understand and improve", description: "Get source-backed explanations and actionable code suggestions.", icon: Lightbulb },
];

export interface Capability {
  title: string;
  icon: LucideIcon;
}

export const ENGINE_CAPABILITIES: Capability[] = [
  { title: "Repository-aware code retrieval", icon: Search },
  { title: "Function and class-aware code chunks", icon: Braces },
  { title: "Semantic and keyword search", icon: Layers },
  { title: "Relevant source-code context", icon: FileCode },
  { title: "Source references for traceability", icon: Link2 },
];

export const BENEFITS: Step[] = [
  { title: "Understand unfamiliar repositories faster", description: "Ask a question and get pointed to the code that answers it.", icon: Compass },
  { title: "Find the relevant code sooner", description: "Spend less time hunting through files while debugging.", icon: Clock },
  { title: "Catch potential issues earlier", description: "Findings appear on the pull request, before the merge.", icon: Bug },
  { title: "Make code reviews more contextual", description: "Reviews consider related code elsewhere in the repository.", icon: GitPullRequest },
];

export const FOOTER_LINKS = {
  working: [
    { label: "Features", href: "#features" },
    { label: "How It Works", href: "#how-it-works" },
  ],
  soon: ["GitHub", "Privacy", "Terms"],
};