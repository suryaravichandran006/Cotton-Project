---
version: 1
slug: "src-app-architecture-page-tsx"
primary_target: "src/app/architecture/page.tsx"
related_targets: ["src/components/architecture/ArchitecturePage.tsx","src/components/architecture/ArchitectureDiagram.tsx"]
---

Scope: `/architecture` only. Visitor mode: Read. The surrounding Cotton Grade header, typography and page shell stay consistent; the architecture figure uses a light academic-paper treatment sized for panel presentation.

Audience and job: an academic review panel must understand the complete model lineage in one scan: where ConvNeXt-Tiny starts, how leaf and seed tasks adapt it, which weights move forward, how the final controlled routes differ, and which model is eventually deployed.

Proof and constraints: use `config/research.json` through `src/lib/research.ts` for datasets, measured intermediate results, transfer counts and experiment routes. The final CATGO dataset and route comparison remain pending. Leaf and seed classifiers are intermediate training stages only. No fabricated final metric or implied winner.

Direction: a native academic architecture plate with warm technical paper, dark connector strokes and a repeated semantic pastel grammar: pink inputs, yellow processing/transfer, blue models, green outputs and violet serving endpoints. Macro flow is vertical; completed training stages repeat the same internal pipeline.

Memorable moment: the one verified leaf-to-seed transfer token travels downward once as the seed stage briefly acknowledges receipt. Reduced motion leaves all information fully visible.
