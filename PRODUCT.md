# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The primary audience is an academic review panel evaluating a final-year computer-vision project. The presenter uses the website to explain the work clearly during a live panel review and to support answers to technical questions.

## Product Purpose

Cotton Grade is an accessible photo-based cotton identification project for small cotton and textile retailers. The website explains how progressive domain-adaptive transfer learning is being used to identify raw cotton cultivar from a single RGB photograph, while making the implemented work, training lineage, measured intermediate results, limitations and remaining final-stage work understandable in a short review session.

## Positioning

The research tests whether one ConvNeXt-Tiny backbone benefits from progressive adaptation through cotton leaves and cotton seeds before final training on raw or ginned cotton fibre. Intermediate classifiers are temporary training tasks; compatible backbone weights are transferred between stages and the final controlled experiment compares this progression with direct and partial-transfer routes.

## Operating Context

The primary presentation path is Overview, Literature, Progress, Architecture, Method, Results and Final Stage. It is designed for a live projector review: one question per section, large legible type, concise interpretation and optional deep evidence. Previous-review feedback, approved milestones, report chapter status and individual contributions are presented orally and must not be added to the website.

## Capabilities and Constraints

- Leaf and seed training stages are complete; final cotton dataset access and training remain pending.
- The architecture must be a clean vertical diagram that shows dataset processing, training, measured output and checkpoint handoff between stages.
- Real report artifacts under `Ran reports/` are the source of truth for measured results.
- Do not fabricate final-stage results or imply that intermediate accuracy proves the final research hypothesis.
- Use graphs and diagrams only where they improve explanation, and keep detailed parameters or secondary metrics out of the primary reading path.
- Keep the Architecture page as the visual and structural benchmark; shared navigation may change, but its diagram must remain intact.
- Literature claims must link to real primary papers and describe the gap conservatively as limited evidence, not universal absence.

## Brand Commitments

Retain the Cotton Grade name and the existing restrained research-oriented visual identity. Use direct academic language. Do not use emoji characters and do not make the experience resemble a generic marketing website or slide deck.

## Evidence on Hand

- `Ran reports/pt_progressive_leaf/`: leaf training history, test metrics, per-class results, confusion matrices and calibration evidence.
- `Ran reports/pt_progressive_seed/`: seed training history, test metrics, per-class results, confusion matrices, calibration evidence and the leaf-to-seed transfer record.
- Leaf result: 98.80% test Macro-F1 and 167 of 169 correct.
- Seed result: 95.61% test Macro-F1 and 65 of 68 correct.
- Leaf-to-seed transfer: 180 compatible tensors loaded and two task-head tensors replaced.
- Final cotton dataset access and final controlled-route results are not yet available.

## Product Principles

- Lead with the research story the panel must understand.
- Show measured evidence next to its interpretation and limitation.
- Keep one clear level of detail in the main narrative and place deeper evidence behind optional links.
- Make every primary page readable from a projector before optimizing for dense desktop browsing.
- Separate completed work from planned work unambiguously.
- Preserve scientific honesty when evidence is incomplete or dataset provenance limits evaluation strength.
