# Skill Self Evolution MVP Product Design

## Product Positioning

Skill Self Evolution is a lightweight workbench for evaluating and evolving `SKILL.md`.

It is not a skill marketplace, skill download site, or skill lifecycle management system. The platform helps a user inspect, evaluate, improve, compare, and download a better `SKILL.md`. Formal lifecycle management, publishing, and distribution happen outside this product, for example in SkillHub.

The MVP is single-tenant. It has no user accounts, no organization model, and no multi-tenant switching.

## Primary Product Experience

The primary experience is **自进化实验**.

The product should make the user feel that they can provide a `SKILL.md`, define how quality should be judged, run an evolution experiment, compare generated candidates, and download the candidate they prefer.

The core flow is:

```text
输入 / 编辑 SKILL.md
→ 创建 / 选择评测集
→ 选择模型
→ 配置自进化实验
→ 自动生成候选版本并评测
→ 对比候选版本
→ 下载满意的 SKILL.md
```

Independent evaluation is still available, but it is positioned as supporting infrastructure for self-evolution rather than the main product story.

## MVP Navigation

The app is a free-form workbench, not a wizard.

Navigation order:

1. 当前 skill
2. 评测集
3. 运行评测
4. 自进化实验

The top bar shows:

- 当前 skill 状态
- 当前模型选择
- 当前任务状态

The UI language is Chinese. The product keeps the term `skill` instead of translating it. Common labels include:

- 当前 skill
- SKILL.md 编辑器
- 评测集
- 评测器
- 静态评审
- 触发评测
- 效果评测
- 自进化实验
- 进化策略
- 进化算法
- 生成模式
- 进化方向
- 进化环境
- 候选版本
- 评测证据
- Token 用量

## Current Skill

The workspace has exactly one current skill.

Supported inputs:

- Paste `SKILL.md`
- Upload `.md`
- Upload `.zip`

Zip upload rules:

- The zip root must contain `SKILL.md`.
- The original zip is saved.
- The zip is only used for source retention and reference integrity checks.
- Other files in the zip are not semantically evaluated in the MVP.
- Users cannot download the original zip from the product.

Current skill behavior:

- The current skill can be edited in a Markdown editor with preview.
- The current skill auto-saves to S3 with a debounced save.
- Replacing the current skill does not show a confirmation dialog.
- The product does not manage skill versions.
- Evaluation runs and evolution experiments save their own input snapshots so old results remain understandable after the current skill changes.
- Users can download the current skill as `SKILL.md`.

Frontmatter behavior:

- Missing or invalid frontmatter does not block saving.
- Missing `name` or `description` is reported as a critical static finding.
- Routing evaluation is marked less reliable when `name` or `description` is missing.

## Eval Sets

Eval sets are independent reusable objects. They are typed because different
evaluation questions need different data shapes.

Eval set types:

- 可触发性评测集
- 单 skill 预期执行效果评测集
- agent 实际执行效果评测集

All eval sets have:

- Name
- Description
- Type
- Cases matching that type

Eval set behavior:

- Multiple eval sets are supported.
- Eval sets auto-save to S3.
- Eval set creation and editing are always available, even when no current skill exists.
- Top-level deletion is supported.
- Cases inside an eval set can be added, edited, and removed.
- AI case generation is scoped to the current eval set.
- Generated cases are directly written into the current eval set. There is no manual "apply suggestions" step.

## Eval Case Forms

Eval case forms depend on eval set type.

可触发性评测数据 fields:

- Case name
- User input
- Memory and conversation context
- Other skill list, each with name and description
- Expected selected skill or `none`

单 skill 预期执行效果评测数据 fields:

- Case name
- User input
- Memory and conversation context
- Expected execution result

agent 实际执行效果评测数据 fields:

- Case name
- User input
- Memory and conversation context
- Expected execution result

## Evaluation Types

The MVP never triggers a real agent runtime. All dynamic evaluation is simulated with LLM calls.

### General Static Review

General Static Review only depends on `SKILL.md`.

It evaluates:

- Frontmatter validity
- `name` and `description`
- `description` length as a proxy for trigger clarity
- Presence of non-scope or forbidden-use guidance
- Workflow clarity
- External reference detection

### Eval-Set-Aware Static Review

Eval-Set-Aware Static Review existed in the early design but is not exposed as a
separate current UI choice. The running product keeps the evaluation surface to
static quality, trigger evaluation, single-skill expected execution evaluation,
and disabled agent execution evaluation.

### Simulated Routing Eval

Routing eval answers:

> Given a user prompt and candidate skill descriptions, should this skill be selected?

Inputs include:

- Prompt
- Target skill `name`
- Target skill `description`
- Candidate skill pool
- Expected selected skill or `none`

The MVP uses a simulated LLM router. It does not call a real agent router.

Routing eval finds:

- False positives
- False negatives
- Description overlap
- Confusing neighboring skills
- Cases where no skill should be selected

### Simulated Execution Eval

Execution eval answers:

> Assuming this skill has been triggered, does the resulting behavior satisfy the task?

The MVP uses outcome-based simulation:

1. LLM simulates an output from an agent following the `SKILL.md`.
2. LLM judge evaluates the output against the case expectation and rubric.

The MVP does not simulate a real tool-using agent and does not execute scripts or external tools.

## Evaluation Runs

Evaluation runs are user-triggered.

The user chooses each evaluator independently:

- Static quality check
- Trigger evaluation + one 可触发性评测集
- Single skill expected execution evaluation + one 单 skill 预期执行效果评测集
- Agent actual execution evaluation + one agent 实际执行效果评测集

Scope availability rules:

- Static quality check requires current skill.
- Trigger evaluation requires a trigger eval set.
- Single skill execution evaluation requires a single-skill execution eval set.
- Agent actual execution evaluation is visible but disabled until a real agent runner exists.
- Each checked evaluator chooses its own eval set. There is no top-level global eval set selector for a run.

Evaluation report presentation uses Summary + Drilldown.

Summary includes:

- Overall human-readable score
- Static review status
- Routing pass / partial / fail counts
- Execution pass / partial / fail counts
- Top findings
- Model
- Token usage

Drilldown includes:

- Static Review
- Routing Cases
- Execution Cases
- Evidence
- Usage / metadata

Rerun is not supported in the MVP. Historical runs are read-only.

## Scoring And Evidence

Scores are for humans only.

The evaluator and evolution strategies must not optimize directly against numeric scores. They use structured evidence.

Case result status:

```text
pass | partial | fail
```

Static finding severity:

```text
critical | major | minor
```

Evidence fields should support:

- Finding or case id
- Severity or status
- Dimension
- Reason
- Evidence snippet
- Suggested fix
- Constraint violation, when relevant

Evolution strategies consume this evidence, not the score.

## Self-Evolution Experiments

自进化实验 is required in the MVP.

An experiment uses:

- Current skill snapshot
- Selected evaluator plan
- Selected eval set snapshots for each evaluator
- Selected model
- Evolution algorithm
- Generation mode
- Strategy configuration, such as rounds and candidates per round
- Optimization preference
- Optional evolution direction
- Optional evolution environment reference files
- Optional constraints

Self-evolution uses the same evaluator selection model as evaluation runs. The
user chooses which evaluators provide evidence for the experiment.

The evaluator module in 自进化实验 includes:

- Static quality check
- Trigger evaluation + one trigger eval set
- Single skill expected execution evaluation + one single-skill execution eval set
- Agent actual execution evaluation, visible but disabled until a real agent runner exists

Each evolution candidate is evaluated with the selected evaluator plan. The
evolution algorithm consumes structured evidence, not numeric score.

进化方向 is a free-form natural-language goal. It describes what the user wants
this experiment to improve or preserve.

进化环境 is an optional list of user-uploaded reference files. It defaults to
empty. Uploaded files are saved with the experiment snapshot and included as
reference context when generating candidate `SKILL.md` files.

All candidates are read-only.

For each candidate, the user can:

- View `SKILL.md`
- View Markdown preview
- View simple unified diff
- View evaluation report
- Download `SKILL.md`

The user cannot:

- Edit a candidate in place
- Adopt a candidate inside the platform
- Save a candidate as a managed skill version

## Evolution Strategies

Evolution strategy is split into two independent concepts:

- 进化算法: how candidate text should change
- 生成模式: how candidate lineage expands across rounds

### Evolution Algorithms

#### LLM 自优化

LLM 自优化 directly rewrites `SKILL.md` from structured evaluation evidence.
It is the simplest baseline and prioritizes critical/major findings and failed
cases.

#### 遗传算法

遗传算法 treats `SKILL.md` as text genes: `name`, `description`, trigger
boundaries, non-scope rules, workflow steps, safety constraints, and reference
instructions. It preserves strong fragments, recombines useful fragments, and
mutates weak regions related to failed evidence.

#### 粒子群

粒子群 treats each candidate as a particle. A candidate moves toward its own
best-known text changes and the global best direction suggested by evaluation
evidence. It favors gradual convergence over large rewrites.

#### 蚁群优化

蚁群优化 treats effective fragments as pheromone paths. Passing trigger
descriptions, execution steps, and safety boundaries are reinforced; failed or
misleading fragments decay. Later candidates prefer high-pheromone paths.

#### 免疫克隆选择

免疫克隆选择 treats failed cases, false triggers, and safety gaps as antigens.
Candidates that resist these issues are cloned and locally mutated, producing
stable "memory" fragments for critical boundaries.

#### 模拟退火

模拟退火 allows broader exploration in early high-temperature rounds, then
reduces rewrite magnitude as temperature cools. Later rounds should focus on
precise fixes and boundary reinforcement rather than major restructuring.

### Generation Modes

### Direct Improve

Direct Improve is chain-based.

```text
Original skill
→ Round 1 candidate
→ Round 2 candidate
→ Round 3 candidate
```

Each round uses the previous candidate and the latest evidence to generate the next candidate.

### Diverse Candidates

Diverse Candidates generates multiple candidates per round.

Each round:

1. Generates multiple candidates from the current parent.
2. Evaluates each candidate.
3. Uses Candidate Selector to choose one candidate for the next round.
4. Keeps all candidates visible to the user.

Candidate Selector uses structured evidence, not numeric score.

Selector criteria include:

- Critical issues fixed
- Failed cases improved
- No new critical or major regressions
- Skill intent preserved
- Safety constraints preserved
- User optimization preference followed

## Evolution Preferences And Constraints

Optimization preferences:

- Balanced
- Conservative
- Aggressive
- Routing Focus
- Execution Focus
- Safety Focus

The user can also provide an optional evolution direction.

Constraints:

- Lock name
- Lock description

Constraint priority:

```text
Lock constraints > Safety constraints > Optimization preference > Style preference
```

Structure rewriting rules:

- Conservative: preserve structure as much as possible.
- Balanced: allow moderate restructuring.
- Aggressive: allow major restructuring.
- Routing Focus: prioritize `description` and trigger boundaries.
- Execution Focus: prioritize workflow, steps, outputs, and failure handling.
- Safety Focus: prioritize confirmation, permissions, sensitive operations, and handoff rules.

## Diff

The MVP supports simple unified diff.

Candidate diff defaults:

- Direct Improve: compare candidate against parent.
- Diverse Candidates: compare candidate against parent selected for that round.

The user can also compare against the original input when practical.

No side-by-side diff, comments, syntax highlighting, or advanced folding is required in the MVP.

## Model Configuration

The backend uses Volcengine Ark.

The API key is configured server-side. The frontend never receives it.

The UI shows a model selector backed by server configuration. Example models:

- `deepseek-v4-pro`
- `seed-2.0-pro`

The MVP uses single-model mode. A run or experiment uses one selected model for the full workflow.

Every run and experiment records:

- Model name
- Prompt tokens
- Completion tokens
- Total tokens
- LLM call count
- Duration

The MVP does not show price estimates.

## Evaluator Versions

The MVP records evaluator versions.

Examples:

- `static-review-v1`
- `eval-set-fit-v1`
- `routing-sim-v1`
- `execution-sim-v1`
- `case-suggestion-v1`
- `direct-improve-v1`
- `diverse-candidates-v1`
- `candidate-selector-v1`

The product does not show full LLM prompts in the MVP.

## Persistence

The MVP uses S3-compatible object storage only. It does not use a database.

S3 stores:

- Current skill
- Source zip and manifest
- Eval sets
- Evaluation runs
- Evolution experiments
- Task status and results
- Lightweight indexes

Suggested storage layout:

```text
workspace/current-skill.md
workspace/current-skill-metadata.json
workspace/source.zip
workspace/manifest.json

eval-sets/<eval-set-id>.json
runs/<run-id>/input-skill.md
runs/<run-id>/eval-set-snapshot.json
runs/<run-id>/result.json
experiments/<experiment-id>/input-skill.md
experiments/<experiment-id>/eval-set-snapshot.json
experiments/<experiment-id>/eval-set-snapshots.json
experiments/<experiment-id>/environment-files.json
experiments/<experiment-id>/environment/<environment-file-id>-<file-name>
experiments/<experiment-id>/config.json
experiments/<experiment-id>/candidates/<candidate-id>.md
experiments/<experiment-id>/result.json
tasks/<task-id>/status.json
tasks/<task-id>/result.json
indexes/eval-sets.json
indexes/evaluation-runs.json
indexes/evolution-experiments.json
indexes/tasks.json
```

Index writes use simple overwrite semantics. This is acceptable for single-tenant, low-concurrency MVP usage.

## Tasks

All long-running actions use background tasks.

Task-backed actions include:

- Static review
- Evaluation run
- Suggested eval case generation
- Evolution experiment

The MVP targets Vercel background / long-running functions.

Task states:

```text
queued
running
succeeded
failed
```

The product allows only one queued or running task at a time.

No task cancellation is supported in the MVP.

Stale task behavior:

- If a running task has not updated within the configured timeout, it is marked failed.
- Default stale timeout should be around 30 minutes.

Progress display:

- Coarse percentage
- Current step label
- Elapsed time
- Model

The MVP does not stream partial LLM output. Results appear after completion. Failed tasks may show partial saved results.

## Access Control

The MVP has a single workspace password.

Behavior:

- User enters workspace password before accessing the app.
- Server verifies against `WORKSPACE_PASSWORD`.
- Server returns a signed session token.
- Frontend stores token in `sessionStorage`.
- Closing the browser session requires password entry again.
- API routes verify the token.

The MVP has no accounts, users, roles, tenants, or audit logs.

## Downloads

The user can only download `SKILL.md`.

Downloadable objects:

- Current skill
- Evolution candidate `SKILL.md`

Not downloadable in the MVP:

- Source zip
- Eval sets
- Evaluation reports
- Experiment data
- Full S3 export

## Explicit Non-Goals

The MVP does not include:

- Multi-tenant support
- Real agent runtime
- Database
- Skill lifecycle management
- Skill version management
- Skill marketplace features
- Skill package semantic evaluation
- Zip download
- Report export
- Eval set export
- Top-level deletion
- Rerun
- Task cancellation
- Streaming output
- Full prompt visibility
- Operation logs
- Audit logs
- Cost estimation
