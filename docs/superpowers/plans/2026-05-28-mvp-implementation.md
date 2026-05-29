# Skill Self Evolution MVP Implementation Plan

> Historical implementation plan. The current product source of truth is
> `docs/product/mvp-design.md`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the local Vercel Next.js MVP for the `SKILL.md` evaluation and self-evolution workbench.

**Architecture:** The app is a Next.js App Router application with a Chinese client-side workbench UI and server-side route handlers. Server modules own environment validation, workspace-password auth, S3 object storage, Ark-compatible LLM calls, evaluation/evolution orchestration, and task persistence. Tests exercise backend domain logic and API-independent services before verifying the app with `vercel dev`.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS, S3-compatible object storage, Volcengine Ark OpenAI-compatible chat API, Vitest, React Testing Library where needed.

---

### Task 1: Dependencies And Test Harness

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/test/*`

- [ ] Add runtime dependencies for S3, zip parsing, markdown preview, YAML frontmatter parsing, and class helpers.
- [ ] Add Vitest scripts and a Node test environment.
- [ ] Run the test command and confirm the harness starts.

### Task 2: Shared Domain Model

**Files:**
- Create: `src/lib/types.ts`
- Create: `src/lib/ids.ts`
- Create: `src/lib/skill-parser.ts`
- Create: `src/lib/reference-scan.ts`
- Test: `src/lib/*.test.ts`

- [ ] Define the MVP entity types for current skill, eval sets, runs, experiments, tasks, evidence, and usage.
- [ ] Parse `SKILL.md` frontmatter without blocking invalid content.
- [ ] Scan Markdown for external file references.
- [ ] Add tests for metadata parsing and reference scanning.

### Task 3: Server Infrastructure

**Files:**
- Create: `src/lib/server/env.ts`
- Create: `src/lib/server/storage.ts`
- Create: `src/lib/server/auth.ts`
- Create: `src/lib/server/ark.ts`
- Test: `src/lib/server/*.test.ts`

- [ ] Validate environment variables with safe defaults where possible.
- [ ] Implement S3 storage helpers with virtual-host style by honoring `S3_FORCE_PATH_STYLE=false`.
- [ ] Implement workspace password verification and signed session tokens.
- [ ] Implement Ark chat completion helper and token usage aggregation.
- [ ] Add unit tests for env parsing, auth token behavior, and storage key decisions.

### Task 4: Evaluation And Evolution Services

**Files:**
- Create: `src/lib/server/evaluators.ts`
- Create: `src/lib/server/evolution.ts`
- Create: `src/lib/server/tasks.ts`
- Test: `src/lib/server/evaluators.test.ts`
- Test: `src/lib/server/evolution.test.ts`

- [ ] Implement static review, eval-set-aware review, simulated routing eval, and outcome-based execution eval.
- [ ] Implement Direct Improve and Diverse Candidates orchestration with selector evidence.
- [ ] Implement one-running-task enforcement and stale task handling.
- [ ] Keep scores human-facing and use structured evidence for evolution decisions.

### Task 5: API Routes

**Files:**
- Create: `src/app/api/auth/verify/route.ts`
- Create: `src/app/api/workspace/*/route.ts`
- Create: `src/app/api/eval-sets/*/route.ts`
- Create: `src/app/api/models/route.ts`
- Create: `src/app/api/tasks/*/route.ts`
- Create: `src/app/api/evaluation-runs/route.ts`
- Create: `src/app/api/evolution-experiments/route.ts`

- [ ] Add authenticated route handlers for current skill, eval sets, models, task status, evaluation runs, and evolution experiments.
- [ ] Support zip upload with root `SKILL.md` validation.
- [ ] Ensure downloadable output is limited to `SKILL.md`.

### Task 6: Workbench UI

**Files:**
- Replace: `src/app/page.tsx`
- Create: `src/app/workbench-client.tsx`
- Create: `src/app/components/*`
- Modify: `src/app/globals.css`

- [ ] Build the Chinese free-form workbench with navigation order: 当前 skill, 评测集, 运行评测, 自进化实验.
- [ ] Add workspace password gate, model selector, current eval set selector, and task status.
- [ ] Implement current skill editor + preview + auto-save + upload/download.
- [ ] Implement eval set editor with progressive routing/execution case forms and AI suggestion task.
- [ ] Implement evaluation run controls and Summary + Drilldown report.
- [ ] Implement evolution configuration with evaluator selection, evolution algorithm, generation mode, evolution direction, evolution environment files, candidate comparison, simple diff, read-only candidates, and `SKILL.md` download.

### Task 7: Verification

**Files:**
- Modify as needed based on failures.

- [ ] Run backend tests.
- [ ] Run lint.
- [ ] Run production build.
- [ ] Start with `vercel dev`.
- [ ] Verify the local app loads, authenticates, reads models, and renders the workbench.
- [ ] If configured external services are reachable, run a smoke evaluation or task status check; otherwise verify mocked/unit backend coverage and route availability.
