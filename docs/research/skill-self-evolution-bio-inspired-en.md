# A Bio-Inspired Optimization Method for Self-Evolving SKILL.md Files

## Abstract

`SKILL.md` is a lightweight capability specification for agent systems. It usually contains a skill name, trigger description, scope boundaries, execution workflow, output format, failure-handling rules, and references to external files. As agent applications move from single prompts to composable capability systems, the quality of `SKILL.md` becomes more than a writing problem. It becomes an evaluable, searchable, and evolvable text-optimization problem. This paper proposes a bio-inspired self-evolution framework for `SKILL.md`: represent a skill document as a mutable and composable text individual; convert static quality review, trigger evaluation, and execution evaluation into structured evidence; then let evolution strategies generate candidate documents and evaluate every candidate automatically. Numeric scores are used for human comparison only, not as the sole optimization target. The paper keeps two concrete algorithm examples: genetic algorithms and particle swarm optimization. Genetic algorithms treat chunks such as `description`, `workflow`, `output`, and `guardrails` as genes that can be selected, crossed over, and mutated. Particle swarm optimization treats each complete `SKILL.md` candidate as a particle, while chunks become coordinate dimensions in a textual search space, allowing candidates to converge gradually between their own best experience and the global best direction. The main contribution is a framework that turns skill optimization from intuition-driven prompt editing into a traceable evidence-driven text search process.

**Keywords:** SKILL.md; self-evolution; bio-inspired optimization; genetic algorithm; particle swarm optimization; agent evaluation; prompt engineering

## 1. Introduction

A skill in an agent system is not merely a document. It is both a routing signal between user intent and agent capability, and a behavioral constraint during execution. A weak `SKILL.md` can fail in two different ways. First, it may not trigger when it should, or it may trigger when another skill or no skill should be selected. Second, after it is triggered, it may produce unstructured, incomplete, or unverifiable outputs. Traditional prompt or skill improvement often relies on manual intuition: inspect a failed case, rewrite a description, and judge by feel whether the result is better. This process is difficult to reproduce, explain, or scale.

This paper asks whether a `SKILL.md` can be treated as an evolvable text artifact. If so, bio-inspired optimization can provide a useful language for organizing the process: generate candidates, evaluate candidates, select directions, and continue evolving. “Bio-inspired” does not mean copying nature literally. It means extracting engineering patterns that are useful for text optimization: populations, multiple candidates, local mutation, chunk recombination, individual memory, collective experience, and gradual convergence.

In the proposed framework, evaluators do not optimize directly against numeric scores. Scores are useful for human readability and candidate comparison, but the evolution strategy consumes structured evidence: which static findings were critical, which trigger cases produced false positives or false negatives, which execution cases missed required fields, and where the skill invented missing information. This distinction is essential. A single score hides failure causes and encourages superficial metric chasing. A good skill self-evolution system should optimize the textual causes behind failures, not an abstract number.

## 2. Problem Definition

Given a current skill document \(S_0\), a set of evaluators \(E\), evaluation datasets \(D\), an optional evolution direction \(G\), and optional environment reference files \(R\), the goal is to generate a finite set of candidate skills:

\[
C = \{S_{1,1}, S_{1,2}, ..., S_{t,k}\}
\]

Each candidate \(S_{t,k}\) must be a downloadable and independently usable `SKILL.md`. After generation, every candidate is evaluated by the same evaluator plan:

\[
E(S_{t,k}, D) \rightarrow \{F_{static}, F_{trigger}, F_{execution}, U\}
\]

where:

- \(F_{static}\) contains static findings such as invalid frontmatter, missing `name` or `description`, unclear trigger descriptions, absent non-use guidance, weak workflows, or unresolved external references.
- \(F_{trigger}\) contains trigger evidence such as false positives, false negatives, overlap with neighboring skill descriptions, or cases where no skill should be selected.
- \(F_{execution}\) contains execution evidence such as missing expected fields, unverifiable outputs, unsupported assumptions, or fabricated missing details.
- \(U\) records model usage, token cost, and operational metadata.

The optimizer should not maximize a black-box total score. It should use this evidence to generate better text candidates. Scores may be derived from evidence, but they serve human comparison, ranking, and inspection.

## 3. Evolvable Representation of SKILL.md

A `SKILL.md` can be represented as a text individual composed of semantic chunks:

```text
S = {
  name,
  description,
  trigger_boundary,
  when_not_to_use,
  workflow,
  output_format,
  failure_handling,
  references
}
```

Different chunks influence different quality dimensions.

`name` and `description` primarily affect routing and triggering. They determine whether an agent router can select the skill correctly given the user input, memory, conversation context, and competing skill descriptions.

`trigger_boundary` and `when_not_to_use` reduce false positives. For a skill, “when not to use this” is as important as “when to use this.” Without explicit non-use guidance, a skill may trigger for background mentions, adjacent tasks, or situations where another skill is more appropriate.

`workflow` and `output_format` affect execution quality. They tell the agent how to process inputs, decompose the task, and produce verifiable outputs.

`failure_handling` manages missing information and uncertainty. For meeting summaries, requirement extraction, or data analysis, a skill should not invent owners, deadlines, or evidence when the source does not contain them.

`references` represents external files. If `SKILL.md` mentions `references/`, `scripts/`, `assets/`, or `templates/`, the evaluation system should treat “whether these files are referenced, explained, and consistent with the text” as part of static quality. Even if the first version only optimizes `SKILL.md` itself, external file usage still affects usability.

This chunked representation gives bio-inspired algorithms workable objects: genes, coordinates, local positions, and movement directions.

## 4. Evidence-Driven Self-Evolution Loop

The proposed self-evolution loop has six stages.

First, the user inputs or edits the current `SKILL.md`. The platform is not a skill marketplace, a download site, or a lifecycle-management system. It is a lightweight workbench for storing, evaluating, generating, comparing, and downloading improved skill files.

Second, the user selects evaluators and evaluation sets. The evaluator plan should include static quality review, trigger evaluation, and single-skill expected execution evaluation. Actual agent execution evaluation can remain a separate future extension until a real agent runner exists.

Third, the system runs baseline evaluation on the original skill and records structured evidence.

Fourth, an evolution strategy generates candidates. Generation can be chain-based or tree-based. Chain generation creates one candidate per round and is suitable for direct improvement. Tree generation creates multiple candidates per round and is suitable for exploring distinct directions.

Fifth, every candidate is automatically evaluated. A candidate should not be shown only as a diff; it must be tested by the same evaluator plan so that users can compare evidence across versions.

Sixth, the user compares candidates and downloads the preferred `SKILL.md`. The platform should not force acceptance or manage versions. Users inspect candidate graphs, evaluation evidence, and diffs against the original skill or other candidates, then take the file they prefer.

## 5. Genetic Algorithm Example: Skill Chunks as Genes

Genetic algorithms were systematized by Holland around the ideas of selection, crossover, and mutation. In `SKILL.md` optimization, the complete skill document is an individual and semantic chunks are genes.

### 5.1 Representation

Consider an original skill:

```markdown
---
name: meeting-summary
description: Use this skill when the user wants help with meeting notes.
---

Summarize the meeting and list action items.
```

It contains at least two genes:

- `descriptionOriginal`
- `instructionOriginal`

The first generation can derive multiple candidates:

- Candidate A mutates only `description` to improve trigger clarity.
- Candidate B keeps the original description and adds `workflow`.
- Candidate C keeps the original description and adds `output_format`.

Each candidate is evaluated as a complete `SKILL.md`, not as an isolated chunk.

### 5.2 Selection

Selection should not simply pick the highest total score. It should identify explainable strong fragments. If Candidate A reduces false negatives in trigger evaluation, A’s `description` can enter the next generation. If Candidate B improves workflow completeness, B’s `workflow` can enter the next generation. If Candidate C makes outputs more verifiable, C’s `output_format` can enter the next generation.

### 5.3 Crossover

The second generation can cross over A’s `description`, B’s `workflow`, and C’s `output_format`:

```text
S2 = A.description + B.workflow + C.output_format
```

This matters because trigger quality, execution process, and output structure are often controlled by different text chunks. Crossover lets the system combine local strengths from different candidates into a more complete document.

### 5.4 Mutation

Mutation makes targeted repairs based on evidence. For example:

- If action items miss owners, mutate `output_format` to include `owner`.
- If deadlines are missing, add `deadline`.
- If the model fabricates missing details, add `failure_handling` instructing it to mark unavailable fields as `unspecified`.

Mutation should be evidence-driven rather than random full-document rewriting. `SKILL.md` is a short configuration artifact; excessive mutation can destroy working structure.

### 5.5 Suitable Scenarios

Genetic algorithms are suitable when:

- A skill needs improvement across multiple quality dimensions.
- Different candidates have strengths in different chunks.
- Users need a clear view of derivation, crossover, and mutation relationships.
- The system should show which text fragments were preserved or replaced.

The main risk is candidate growth. Crossover may also create stylistic inconsistency. The system should therefore limit rounds and candidates per round, and perform consistency cleanup after recombination.

## 6. Particle Swarm Optimization Example: Complete Skill Files as Particles

Particle swarm optimization was introduced by Kennedy and Eberhart for iterative population-based optimization. Each particle moves through a search space while referencing both its own best-known position and the global best position. In `SKILL.md` optimization, each particle should be a complete candidate file, not a single chunk. Chunks are coordinate dimensions in the textual search space.

### 6.1 Representation

A particle can be represented as:

```text
P_i = {
  description_position,
  workflow_position,
  output_position,
  guardrails_position,
  failure_handling_position
}
```

These positions are not numeric coordinates. They are text states. For instance, `description_position` may move from “rough meeting notes description” to “explicit meeting-summary trigger” to “description with not-to-use boundaries.”

### 6.2 Initialization

Round 0 contains only the original skill. Round 1 derives multiple complete-file particles from it:

- Particle A focuses on `description` and primarily moves the trigger-description dimension.
- Particle B focuses on `workflow/output` and primarily moves execution-path and output-structure dimensions.
- Particle C focuses on `guardrails` and primarily moves boundary and non-use dimensions.

Each particle is independently evaluated and receives its own pBest. If Particle C is most stable under the evidence, it becomes the current gBest.

### 6.3 Movement

In Round 2, particles should not all move linearly in the same visual direction. Each particle updates according to its own pBest, the global gBest, and evaluation evidence:

```text
P_i(t+1) = move(P_i(t), pBest_i, gBest, evidence)
```

In text space, this can mean:

- Particle A keeps its strong `description` and absorbs gBest’s `guardrails`.
- Particle B keeps its strong `workflow` and absorbs gBest’s `description`.
- Particle C, as gBest, adds `workflow` and `output` to expand its advantage.

Thus PSO does not treat chunks as particles. It moves multiple complete `SKILL.md` files through different chunk dimensions.

### 6.4 Convergence

As rounds continue, particles should become less divergent. The final candidate may include:

- A more precise description.
- Clearer when-not-to-use boundaries.
- A more complete workflow.
- A more verifiable output format.
- Stronger failure handling.

Compared with genetic algorithms, PSO usually produces smoother diffs. It does not emphasize explicit parent crossover; it emphasizes gradual tuning of complete file candidates in a text space.

### 6.5 Suitable Scenarios

Particle swarm optimization is suitable when:

- The original skill already has baseline quality.
- Users want to see several complete candidate files gradually approach a shared direction.
- The objective favors stability and convergence rather than large structural recombination.
- Evaluation evidence can distinguish individual best experience from global best direction.

The main risk is premature convergence. If initial particles are too similar, the swarm may converge to a local optimum. Initialization should therefore ensure that particles focus on different chunks.

## 7. Evaluation Design

A self-evolving skill platform should separate evaluation questions.

### 7.1 Static Quality Review

Static review depends only on `SKILL.md` and detects structural problems:

- Whether frontmatter is parseable.
- Whether `name` and `description` exist.
- Whether `description` explains trigger scenarios clearly.
- Whether non-use or forbidden-use guidance exists.
- Whether workflow is clear.
- Whether external references are mentioned and used coherently.

### 7.2 Trigger Evaluation

Trigger evaluation asks:

> Given user input, memory and conversation context, and other skill names and descriptions, should this skill be triggered?

It must remain separate from execution evaluation. A skill may execute well but should not have triggered; another may trigger correctly but execute poorly. Mixing the two makes failure localization difficult.

### 7.3 Single-Skill Expected Execution Evaluation

This evaluation assumes the skill has already triggered. It judges whether following `SKILL.md` satisfies the expected result. It checks:

- Task coverage.
- Required fields.
- Source-groundedness.
- Missing-information handling.
- Output format.

### 7.4 Actual Agent Execution Evaluation

This requires a real agent runner. Early systems can retain the data shape and UI affordance without forcing runtime integration. It should stay separate because real agent performance depends on tool calls, context management, and competition among skills.

## 8. System Design Recommendations

An implementation should include:

- `Skill Store`: stores the current `SKILL.md` and experiment snapshots.
- `Eval Set Store`: stores reusable typed evaluation sets.
- `Evaluator`: produces structured evidence and human-readable scores.
- `Evolution Strategy`: generates candidates according to an algorithmic strategy.
- `Candidate Graph`: records parent-child, crossover, movement, and mutation relationships.
- `Diff Viewer`: compares each candidate with the original skill or another candidate.
- `Download`: lets the user take the preferred `SKILL.md`.

The candidate graph is central to the user experience. Genetic algorithms should show parents, children, crossover links, and mutation links. Particle swarm optimization should show particle positions, movement directions, pBest, gBest, and ghosted previous-round positions. Only with process visualization can users understand how an algorithmic idea becomes concrete text change.

## 9. Discussion

The value of applying bio-inspired optimization to `SKILL.md` is not the algorithm label itself. The value is a disciplined language for organizing search.

Genetic algorithms help users understand that useful text fragments can be preserved, crossed over, and mutated. This is effective for explaining how complex text structures are assembled.

Particle swarm optimization helps users understand that multiple complete-file candidates can explore independently and then converge using both individual and collective experience. This is effective for explaining why some optimization processes should tune gradually rather than rewrite everything at once.

Both algorithms require detailed evaluation evidence. If the evaluator returns only a total score, the algorithm searches blindly. If it returns failure types, failed cases, field-level defects, and boundary conflicts, the algorithm can generate targeted text changes.

## 10. Limitations and Future Work

The framework has several limitations.

First, LLM-based evaluation is uncertain. Fixed rubrics, repeated sampling, human spot checks, and regression evaluation sets can reduce variance.

Second, text search is not continuous. In PSO, “position” and “velocity” must be reinterpreted as chunk states and edit directions rather than copied directly from numerical formulas.

Third, candidate count and cost must be controlled. Tree-shaped candidate generation can rapidly increase LLM calls, so rounds, candidates per round, and evaluation set size should be bounded.

Fourth, real agent execution evaluation remains future work. Only after integrating real tool calls and runtime environments can the system evaluate skill performance inside a complete agent stack.

Fifth, semantic consistency of external references needs deeper evaluation. Early systems can check whether files are mentioned and explained; later versions can evaluate whether referenced content is actually used correctly by the skill.

## 11. Conclusion

This paper proposed a bio-inspired self-evolution method for `SKILL.md`. The method treats a skill document as an evolvable text individual, converts evaluation results into structured evidence, and uses evolution strategies to generate, evaluate, and compare candidate versions. Genetic algorithms show how skill chunks can be selected, crossed over, and mutated as genes. Particle swarm optimization shows how complete candidate files can move under the joint influence of pBest and gBest. The goal is not to replace human judgment with an algorithm, but to let humans inspect every text change, evaluation finding, and candidate relationship so they can confidently download a better `SKILL.md`.

## References

1. Holland, J. H. (1975). *Adaptation in Natural and Artificial Systems*. University of Michigan Press. Later MIT Press edition: <https://mitpress.mit.edu/9780262581110/adaptation-in-natural-and-artificial-systems/>.
2. Kennedy, J., & Eberhart, R. (1995). Particle swarm optimization. *Proceedings of ICNN'95 - International Conference on Neural Networks*, 4, 1942-1948. DOI: <https://doi.org/10.1109/ICNN.1995.488968>.
3. Skill Self Evolution product design document: `docs/product/mvp-design.md`.
4. Skill Algorithm Evolution Demo: `public/demos/skill-algorithm-evolution.html`.
