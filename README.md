::: {align="center"}
# 🧠 RepoMind AI

### Chat with your codebase. Review every pull request with context.

**RepoMind AI is an AI-powered GitHub code intelligence platform that
helps developers understand repositories, trace code relationships, and
identify potential issues in pull requests.**

One shared code index powers two workflows: repository-aware AI chat and
contextual pull request reviews.

![Status](https://img.shields.io/badge/Project-RepoMind_AI-7c3aed)
![Next.js](https://img.shields.io/badge/Next.js-App_Router-black)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178c6)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-pgvector-336791)
![AI](https://img.shields.io/badge/AI-Gemini-8e75b2)
:::

------------------------------------------------------------------------

## 📌 Overview

Understanding an unfamiliar codebase can take hours. Developers often
need to search through multiple files to understand authentication, API
routes, database operations, and how different parts of an application
connect.

RepoMind AI makes this process easier by building a searchable
representation of a repository and retrieving relevant code when it is
needed.

It brings two workflows together:

-   **AI Repository Chat:** Ask questions about a repository in natural
    language and receive answers grounded in relevant code, with
    file-and-line references.
-   **AI Pull Request Review:** Analyze proposed changes alongside
    related repository code to surface potential bugs, security
    concerns, performance problems, and maintainability issues.

The goal is to help developers spend less time searching for context and
more time building reliable software.

## ✨ Core Features

### 💬 1. AI Repository Chat

Explore a codebase through a conversational interface.

-   Connect GitHub and browse accessible repositories.
-   View repository files in a structured file explorer.
-   Ask questions about application architecture, authentication, APIs,
    database access, and code behavior.
-   Retrieve relevant code using semantic and keyword search.
-   Receive streaming AI responses with source references.
-   Open and revisit saved conversations.
-   Stop or regenerate responses when needed.
-   Ground answers in retrieved code and acknowledge when the available
    evidence is insufficient.

**Example questions**

-   "Explain the authentication flow in this project."
-   "Where is JWT validation implemented?"
-   "How does the frontend communicate with the backend?"
-   "Which files handle user registration?"
-   "Find potential performance bottlenecks."

### 🔍 2. AI Pull Request Code Review

Review proposed changes with context from the wider repository.

-   Receive pull request events through a GitHub App webhook.
-   Inspect changed files and relevant code from the repository.
-   Ask the AI to identify potential bugs, security risks, performance
    issues, and maintainability concerns.
-   Validate findings against real files and eligible changed lines
    before publishing comments.
-   Provide actionable explanations and suggested fixes where
    appropriate.
-   View review activity from the repository workspace.

Review findings can be categorized as:

  ---------------------------------------------------------------------
  Category                           What it looks for
  ---------------------------------- ----------------------------------
  🔐 Security                        Potential authorization gaps,
                                     unsafe input handling, and other
                                     security risks

  🐛 Potential Bug                   Null handling, incorrect
                                     conditions, edge cases, and likely
                                     logic errors

  ⚡ Performance                     Unnecessary work, inefficient
                                     operations, and potential
                                     bottlenecks

  🧹 Maintainability                 Readability, error handling, and
                                     opportunities to simplify code
  ---------------------------------------------------------------------

AI findings are suggestions for developers to verify. RepoMind AI does
not replace human review or guarantee that code is secure.

### 🗂️ 3. Repository Indexing and Retrieval

The same code intelligence layer supports both chat and review.

-   Filter out files that should not be sent for analysis, such as
    secrets, binaries, lockfiles, and oversized files.
-   Split source files into manageable code chunks while retaining file
    paths and line ranges.
-   Generate embeddings and store searchable code representations in
    PostgreSQL with pgvector.
-   Use semantic search and PostgreSQL full-text search to find relevant
    code.
-   Combine retrieval rankings to improve context selection.
-   Reuse stored representations for files that have not changed.
-   Keep retrieved context scoped to the selected user's repository
    access.

### 🧭 4. GitHub Repository Workspace

A central place to explore and work with connected repositories.

-   Sign in with GitHub.
-   Install and connect the RepoMind GitHub App.
-   Browse repositories and indexing status.
-   Explore repository files and search for code.
-   Open code with line references.
-   Switch between repository chat and review activity.

## 🖥️ Product Experience

### Repository chat

``` text
You: How does authentication work?

RepoMind AI:
The authentication flow can be traced through the relevant
middleware and route handlers. Start with the authentication
middleware to understand how requests are validated, then
follow the login handler to see how credentials are checked
and how tokens or sessions are created.

Sources:
  src/middleware/auth.ts
  src/routes/auth.ts
```

*Illustrative example. Actual answers and source paths depend on the
indexed repository.*

### Pull request review

``` text
Pull Request: Add user profile endpoint

Potential Security Issue
Check whether the authenticated user is authorized to access
the requested profile. Without an appropriate ownership or
permission check, the endpoint may expose another user's data.

Suggested action:
Verify the caller's identity and enforce the relevant
authorization rule before returning the profile.
```

*Illustrative example. A finding should only be raised when the
surrounding code supports it.*

## ⚙️ How It Works

``` mermaid
flowchart TD
    GH["GitHub repositories"] --> IDX["Repository indexing"]
    IDX --> CH["Code chunks and metadata"]
    CH --> DB[("PostgreSQL + pgvector")]

    U["Developer"] --> APP["RepoMind AI · Next.js"]
    APP --> CHAT["AI repository chat"]
    APP --> PR["Pull request review"]
    CHAT --> RET["Context retrieval"]
    PR --> RET
    DB --> RET
    RET --> AI["Gemini API"]
    AI --> ANS["Source-backed answer"]
    AI --> FIND["Validated review findings"]
    FIND --> GHPR["GitHub pull request comments"]
```

### Indexing pipeline

1.  Read repository files that are eligible for indexing.
2.  Exclude files that are unsafe or unsuitable for analysis.
3.  Split source code into chunks and preserve source metadata.
4.  Generate embeddings for searchable code chunks.
5.  Store code, line ranges, and vectors in PostgreSQL.
6.  Reuse unchanged file content when possible.

### Chat pipeline

1.  Receive the developer's question.
2.  Search code using semantic similarity and keyword matching.
3.  Merge and select relevant results.
4.  Build a prompt using retrieved code and conversation context.
5.  Stream the AI response.
6.  Validate and display source references.

### Pull request review pipeline

1.  Receive and verify a GitHub pull request webhook.
2.  Retrieve the pull request diff and repository-scoped access token.
3.  Find relevant code surrounding the changes.
4.  Submit the diff and selected context for AI analysis.
5.  Validate findings against eligible files and changed lines.
6.  Publish actionable inline comments to GitHub.

## 🧱 Architecture and Technology Stack

  -----------------------------------------------------------------------
  Layer                   Technology              Purpose
  ----------------------- ----------------------- -----------------------
  Frontend and            Next.js App Router,     UI, pages, server-side
  application             React, TypeScript       logic, and API routes

  Styling                 Tailwind CSS            Responsive interface
                                                  and component styling

  Authentication          Better Auth, GitHub     User sign-in and
                          OAuth                   session management

  GitHub integration      GitHub App, GitHub API  Repository access, pull
                                                  request events, and
                                                  review comments

  Database                PostgreSQL, Supabase    Application data and
                                                  repository metadata

  Vector search           pgvector                Semantic retrieval over
                                                  code embeddings

  ORM                     Prisma                  Database access and
                                                  schema management

  AI                      Google Gemini API       Embeddings, streaming
                                                  chat, and structured
                                                  review findings

  Code rendering          Shiki, react-markdown   Syntax highlighting and
                                                  formatted AI responses

  Testing and quality     Vitest, ESLint, GitHub  Automated checks and
                          Actions                 code quality
  -----------------------------------------------------------------------

## 🗃️ Main Application Areas

The application is organized around these areas:

``` text
src/
├── app/              # Landing page, dashboard, workspace, and API routes
├── components/       # UI, repository, chat, review, and shared components
└── lib/
    ├── auth/         # Authentication and session helpers
    ├── github/       # GitHub API, app tokens, webhooks, and pull requests
    ├── ai/           # AI clients and prompts
    ├── rag/          # Chunking, indexing, retrieval, and citations
    ├── review/       # Diff parsing and review-finding validation
    ├── repo/         # File filtering and repository limits
    └── chat/         # Chat utilities and shared types

prisma/               # Database schema and database scripts
tests/                # Unit and integration tests
.github/workflows/    # Continuous integration workflows
```

*The exact files and modules may vary by implementation.*

## 🔐 Security and Privacy Principles

RepoMind AI is designed around repository-aware access control and
cautious handling of code.

-   **Verified webhooks:** Validate GitHub webhook signatures before
    processing events.
-   **Least privilege:** Request only the GitHub permissions needed for
    the relevant workflow.
-   **Separate credentials:** Keep user authentication credentials and
    GitHub App credentials separate.
-   **Server-side secrets:** Do not expose API keys, private keys, or
    access tokens to the browser.
-   **Repository isolation:** Scope code retrieval and conversations to
    the authorized user and repository.
-   **Secret filtering:** Exclude files that may contain credentials or
    other sensitive material from indexing.
-   **Untrusted repository content:** Treat source code, pull request
    descriptions, and comments as data, not as instructions to the AI.
-   **Validated review output:** Check review findings before posting
    them to GitHub.
-   **No code execution:** Repository contents are analyzed as text
    rather than executed by the AI review pipeline.

Only connect repositories whose code you are authorized to process. Code
excerpts and prompts may be sent to the configured AI provider; review
the provider's data policies and your organization's requirements before
using private repositories.

## 🚀 Getting Started

### Prerequisites

-   Node.js 22 or a version supported by the project
-   npm
-   PostgreSQL with the `vector` extension (Supabase is one option)
-   A GitHub account and GitHub App configuration
-   A Gemini API key

### 1. Install dependencies

``` bash
git clone <your-repository-url>
cd <project-directory>
npm install
```

### 2. Configure environment variables

Create `.env.local` using the project's `.env.example` as a reference.

Typical variables include:

``` env
DATABASE_URL=
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=

GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_APP_SLUG=
GITHUB_APP_ID=
GITHUB_APP_PRIVATE_KEY=
GITHUB_WEBHOOK_SECRET=

GEMINI_API_KEY=
LLM_MODEL=
REVIEW_MODEL=
EMBEDDING_MODEL=
```

Use the exact variable names expected by the current codebase. Never
commit `.env.local`, private keys, or API credentials.

### 3. Set up the database

``` bash
npx prisma migrate dev
npx prisma generate
```

If your project includes a Supabase row-level-security script, apply it
according to the project's setup instructions.

### 4. Configure the GitHub App

In GitHub, create an app under **Settings → Developer settings → GitHub
Apps**.

Configure the callback, setup, and webhook URLs to match the routes in
your project. Enable the repository permissions and pull request events
required by the implemented features. During local development, use a
secure public webhook tunnel if required.

Keep the GitHub App private key and webhook secret on the server.

### 5. Run the development server

``` bash
npm run dev
```

Open `http://localhost:3000`.

If your local webhook setup uses Smee, run its client in a separate
terminal using your configured channel and the webhook route in the
application.

### 6. Run quality checks

Use the scripts available in `package.json`. Common commands are:

``` bash
npm test
npm run typecheck
npm run lint
```

A command is available only if it is configured in the project.

## 🧪 Testing

Testing should cover the critical boundaries of the application,
including:

-   Webhook signature verification and event routing
-   Repository and user access isolation
-   File filtering and chunking
-   Retrieval and source-reference validation
-   Pull request diff parsing
-   Review finding validation and output sanitization
-   AI client error handling and retries

Unit tests with mocked external services do not replace end-to-end
testing against a real GitHub App, database, and AI provider.

## ⚖️ Important Limitations

-   AI-generated explanations and review comments may be incomplete or
    incorrect.
-   A review with no findings does not guarantee that code is secure or
    bug-free.
-   Retrieval quality depends on repository size, indexing limits, and
    the relevance of selected code chunks.
-   Large repositories may require dedicated background processing and
    more advanced vector indexing.
-   Automatic re-indexing, branch selection, usage controls, and
    repository analysis depend on the corresponding implementation being
    configured.
-   Local setup and real-service configuration are required before
    GitHub and AI workflows can be used in a new environment.

## 🛣️ Product Direction

RepoMind AI brings repository understanding and pull request review into
one developer workflow. The architecture is designed to support future
improvements such as more precise syntax-aware chunking, reranking,
richer repository analysis, automatic indexing triggers, background
jobs, and retrieval-quality evaluation.

## ❓ FAQ

### How is repository chat different from a general AI chatbot?

RepoMind AI retrieves relevant code from the selected repository and
grounds its response in that context, with source references where
available.

### How is AI pull request review different from chat?

Chat answers a developer's questions on demand. Pull request review
analyzes proposed code changes and can provide findings in the GitHub
review workflow.

### Does the AI execute my code?

The review workflow analyzes repository content as text. It does not
need to execute code to provide code-review suggestions.

### Can AI reviews replace human reviewers?

No. AI reviews are an additional layer of assistance. Developers should
verify findings, test changes, and follow their normal review process.

------------------------------------------------------------------------

::: {align="center"}
**Built for developers who want to understand more code and ship with
confidence.**
:::
