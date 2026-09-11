# Apple Design Skill (HIG Reviewer)

This project has installed and configured the **Apple Design Skill** (`apple-design-skill`), grounded in Apple's Human Interface Guidelines (HIG) and adapted for modern web and cross-platform UI/UX.

## Guidelines & Methodology:
When designing, reviewing, or auditing UI/UX components and screens:
1. **Audit Framework**: Follow `.skills/apple-design/SKILL.md` for the structured 5-step review process.
2. **Routing Table**: Consult `.skills/apple-design/references/hig-lookup.md` to locate topic-specific design standards.
3. **References**: Load relevant guideline files from `.skills/apple-design/references/hig/`:
   - `accessibility.md` — Touch targets (min 44x44), WCAG AA color contrast, screen-reader semantics.
   - `color.md` — Semantic palette, dark mode contrast, visual hierarchy.
   - `layout.md` — Spacing rhythm, safe areas, mathematical border radius nesting.
   - `typography.md` — Legibility, optical sizing, line-heights, headline pairings.
   - `liquid-glass.md` — Translucent glass materials, blur layering, subtle rim light borders.
   - `motion.md` — Fluid spring physics, spatial continuity, non-jarring transitions.
4. **Severity Classification**: Categorize design feedback into **Critical** (blocks usability), **High** (violates core HIG), **Medium** (suboptimal polish), and **Low** (minor enhancement).
5. **Actionable Code**: Provide immediate, clean implementation fixes using React and Tailwind CSS.
