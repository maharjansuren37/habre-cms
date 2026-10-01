# Design kit

A starting point for how this project looks and behaves, so the first screen is
not designed from a blank page. **Pack-owned: `install.sh` refreshes these
files, so do not edit them here.** `prototype` copies them into `prototypes/`
and changes the copies; what the project decides is recorded in
`blueprint/context/design.md`.

| File | What it is |
|---|---|
| `tokens.json` | The design tokens in the W3C Design Tokens format: a neutral slate scale, one brand hue, type, spacing, radii, shadows, motion, sizes, breakpoints, layers, and the colour roles in light and dark |
| `tokens.css` | The same tokens as CSS custom properties. Dark mode follows the OS, or `data-theme="dark"` |
| `components.css` | Every core component built only from those tokens: layout, navigation, links, buttons, forms, feedback, dialogs and menus, tables, cards |
| `components.html` | A static sheet showing each component in each state. Open it in a browser - no build step |
| `ux-checklist.md` | What every app or website needs regardless of its look: navigation by product type, required screens, the journeys to walk end to end, the accessibility floor |

**The default look is neutral on purpose.** A project changes the brand hue,
the font, the radius and the density - values, never names - and the whole
sheet follows. Components use only the `--color-*` roles, never a primitive
like `--blue-600`, which is what makes a re-theme a one-file change.

**Checked here, not assumed:** every colour pair a component draws meets WCAG
AA contrast in both modes, the two token files agree, and the components hold
no colour literal - `tests/test-seams.sh` in the pack measures all three.

**On a platform without CSS**, `tokens.json` is the source: React Native and
Expo take a theme object, Flutter a `ThemeData`, native apps an asset catalogue.
The role names carry across; `prototype` names the destination.
