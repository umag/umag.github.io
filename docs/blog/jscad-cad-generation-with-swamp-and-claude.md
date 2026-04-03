
> **Disclaimer:** The following text is an AI-generated summary of the design
> decisions and evolution of the JSCAD CAD generation system built with Swamp
> and Claude. All work was done iteratively with `claude-code` handling
> implementation while I approved steps and provided direction.

## Choosing the Right CAD System

The starting question was simple: which free CAD system integrates best with
Claude via Swamp?

We evaluated FreeCAD, CadQuery, OpenSCAD, JSCAD, OpenCascade, Blender, and
LibreCAD. The key criteria were subprocess requirements, TypeScript support, and
LLM-friendliness.

| System | Subprocess? | TypeScript? | LLM-friendly? |
|---|---|---|---|
| FreeCAD | Yes (Python) | No | Good |
| CadQuery | Yes (Python) | No | Excellent |
| OpenSCAD | Yes (CLI) | No | Excellent |
| **JSCAD** | **No** | **Native** | **Good** |

**JSCAD won** because it's the only option that runs fully in-process inside a
Swamp extension model. No subprocess, no Python, no temp files, no OS
dependency.

The trade-off: CadQuery has better LLM research backing and outputs STEP
natively. We accepted the loss of STEP to gain the in-process advantage.

## Applying DDD to a CAD Domain

The initial instinct was to write a Swamp model with a `run` method that
evaluates a script string. But what are the actual domain concepts? CAD isn't
naturally expressed in Swamp's data model.

A ubiquitous language exercise surfaced these domain types:

| Raw concept | Domain type | Invariant |
|---|---|---|
| Script string | `CadScript` | Non-empty, must define `main()` |
| Param map | `ScriptParameters` | Immutable, defensive copy |
| JSCAD geometry | `Geometry` | At least one shape |
| Output bytes | `SerializedModel` | Carries format alongside bytes |
| Execution record | `RenderResult` | Value object stored as Swamp resource |

All value objects — immutable, equality by value, no identity.

The domain services (`ScriptEvaluator` and `GeometrySerializer`) know nothing
about Swamp. The application layer (`jscad_cad.ts`) orchestrates them and owns
all Swamp I/O. Clean boundary between layers.

## The `new Function()` Decision

How to evaluate user-provided JSCAD scripts safely inside the model?

Three options: subprocess `deno eval` (defeats the in-process advantage),
`eval()` directly (pollutes global scope), or `new Function()` with injected
scope.

We chose option 3:

```javascript
new Function("primitives", "transforms", "booleans", ...,
  `${script}\nreturn main;`
)(primitives, transforms, booleans, ...)
```

Only the JSCAD modeling API is injected. No `Deno`, no `fetch`, no filesystem.
JSCAD scripts are code-as-data — the same pattern the JSCAD web editor uses.

One early bug: Claude wraps code in markdown fences (` ```javascript ``` `). We
added `stripMarkdownFences()` to `ScriptEvaluator` to strip before evaluation.

## The Serializer Bug — 14KB of Zeros

Generated STL files were 14KB of pure zeros.

Initial hypothesis: boolean subtract produced empty geometry. Actual cause:
`@jscad/stl-serializer` returns `ArrayBuffer[]` not `Uint8Array[]` for binary
mode. Our `mergeBuffers()` called `out.set(p, offset)` where `p` was an
`ArrayBuffer` — `TypedArray.set()` silently writes zeros when given an
`ArrayBuffer` instead of a typed view.

The fix was one line:

```typescript
const views = parts.map(p =>
  p instanceof Uint8Array ? p : new Uint8Array(p)
);
```

**Lesson:** npm package types lie. Verify actual runtime return types against
source code, not the README.

## The Validator as a Design Tool

The STL validator started as a way to catch bad output (zeros, degenerate
triangles). It evolved into a design verification tool — the bounding box output
told us exactly what was wrong with each model geometrically.

The checks evolved:
1. **v1:** Is the file non-zero? Is the header count consistent with file size?
2. **v2:** Are there degenerate triangles? What is the bounding box?
3. **v3 (slicer):** What does it look like from all 6 sides vs reference?

The validator made the feedback loop tight enough to iterate rapidly. Without it,
a bad model was just "wrong". With it: "66mm wide, 75mm deep, should be 260mm —
fix the handle."

## The LLM Generation Pattern

First attempt: call the Claude API directly inside the `@jscad/cad` model's
`generate` method. Rejected immediately — violates Swamp's design principle.
Models are execution units, not orchestrators.

Correct pattern: LLM generates the script at workflow level, passes it via CEL:

```yaml
script: ${{ data.latest("jscad-script-gen", "result").attributes.stdout }}
```

Another bug found here: passing multi-line scripts via `--input script=...`
caused the shell to hang indefinitely. The shell couldn't quote multi-line
strings safely. Fix: always write to a YAML input file first:

```bash
swamp model method run box-test run \
  --input-file /tmp/jscad-inputs.yaml \
  --json > /tmp/render-result.json 2>&1
```

## The Skill as Institutional Memory

Every generation re-discovered the same JSCAD v2 API mistakes:

- `cube()` doesn't exist — use `cuboid()`
- `center: true` — must be `[x, y, z]` array
- `cylinder({length: 5})` — use `height`
- Inline position math — parts protrude outside enclosures

The `jscad-codegen` skill encodes all of this with verified examples
cross-referenced against JSCAD source code. A references subfolder was added
after each bug with verified API docs and coordinate system rules.

## The 6-View Slicer as Ground Truth

"It looks wrong" isn't actionable. We needed numbers from all angles.

The slicer was built as a Swamp extension model with two pure domain functions:

- `slice(bytes, z)` — intersect triangles with a Z plane
- `sixViews(bytes)` — project all edges onto 6 orthographic planes

It takes `Uint8Array` and returns SVG strings and measurements. No Swamp
knowledge in the domain service.

The 6-view layout:

```
Row 0:  FRONT  |  RIGHT  |  BACK
Row 1:  TOP    |  LEFT   |  BOTTOM
```

Red dashed outlines from reference proportions overlaid on blue model edges.
Density of blue lines creates a natural silhouette — no convex hull computation
needed.

## Debugging the Genie Lamp

Three generations of bugs, all found by measurement not visual inspection:

**Bug 1 — Scale:** 75mm depth vs 260mm target. Body was a symmetric ellipsoid
blob. Fixed by switching to `extrudeRotate` of a hand-traced 2D profile and
`hull()` of tapering spheres for an organic spout.

**Bug 2 — Handle orientation:** `rotate([deg(90), 0, 0], torus)` rotates around
the X axis, putting the torus ring in the XZ plane (wrong). Fixed with
`rotate([0, deg(90), 0], torus)` to rotate around Y axis into the YZ plane.

**Bug 3 — Translate/rotate order:** `translate` followed by `rotate` moved the
translation offset onto the wrong axis. Fix: always `rotate()` first to align,
then `translate()` to position.

## Design Principles That Emerged

| Principle | Origin |
|---|---|
| Domain services know nothing about Swamp | DDD applied upfront |
| Static imports only — no dynamic `import()` | Swamp bundler requirement |
| Write to input file, never inline in shell args | Shell hanging bug |
| Declare all coordinates as named constants upfront | HDD box ribs protruding |
| `rotate()` before `translate()` when aligning an axis | Genie lamp handle bug |
| Validate with numbers, not eyes | Every iteration |
| Throw before write — no partial data on failure | Swamp shell model pattern |
| LLM generates at workflow level, model only executes | Design review |
