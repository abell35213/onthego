# CSS Rules & Standards (`css/`)

## Architecture

All styles live in a **single stylesheet** (`styles.css`, ~2300 lines). There is no CSS preprocessor (Sass, Less) or PostCSS pipeline. The file is organized into clearly labeled sections using comment headers.

## Section Organization

Sections are delimited by block comments following this pattern:
```css
/* ===== Section Name ===== */
```

Sections appear in this order:
1. CSS Variables (`:root`)
2. Global Styles (reset, body, links)
3. Scrollbar
4. Header
5. Concierge Button
6. Header Action Buttons
7. Main Container
8. World View
9. Trip Sidebar & Trip Cards
10. Local View
11. Top Filter Bar & Search Bar & Filters
12. Local Main (sidebar + map)
13. Sidebar
14. Restaurant List, Loading & Empty States
15. Restaurant Card (header, rating, info, tags, address, actions, social links, Instagram)
16. Map Container
17. Travel Log View (stats, content, entries)
18. Modal (Account)
19. Account Tabs, Forms, Connections, Settings
20. AI Concierge Panel (header, body, form, error, loading, messages, cards, reservation)
21. Leaflet Popup Overrides
22. iOS-style Map Pin Markers
23. Popup Content (Map Marker Popups)
24. Directions Control
25. Search This Area Button
26. Responsive (media queries last)

When adding new sections, place them before the Responsive section and follow the existing comment header pattern.

## CSS Variables (Design Tokens)

All colors, shadows, radii, and transitions are defined as CSS custom properties in `:root`. **Always use variables** — never hardcode color values in component styles.

### Color System
```css
/* Backgrounds (dark to light hierarchy) */
--bg-base:        #080D1A;        /* Page background */
--bg-surface:     #0F172A;        /* Card/surface background */
--bg-elevated:    #1A2540;        /* Elevated surfaces */
--bg-glass:       rgba(255, 255, 255, 0.04);   /* Glass effect */
--bg-glass-hover: rgba(255, 255, 255, 0.07);   /* Glass hover */

/* Brand Colors */
--primary:        #00D4FF;        /* Cyan — primary accent */
--primary-dim:    rgba(0, 212, 255, 0.15);     /* Muted primary */
--primary-glow:   rgba(0, 212, 255, 0.4);      /* Glow effect */
--secondary:      #7C3AED;        /* Purple — secondary accent */
--gold:           #F59E0B;        /* Gold — highlights, badges */

/* Text */
--text:           #E2E8F0;        /* Primary text */
--text-muted:     #64748B;        /* Secondary/muted text */
--text-dim:       #94A3B8;        /* Dimmed text */

/* Borders */
--border:         rgba(255, 255, 255, 0.08);
--border-accent:  rgba(0, 212, 255, 0.3);

/* Status */
--success:        #10B981;
--error:          #EF4444;
--warning:        #F59E0B;
```

### Legacy Aliases
Legacy variable names are aliased to the new tokens for backward compatibility. Use the short-form names in new code:
```css
--primary-color: var(--primary);    /* Use --primary instead */
--text-dark: var(--text);           /* Use --text instead */
--bg-light: var(--bg-surface);      /* Use --bg-surface instead */
```

### Spacing & Sizing
```css
--radius-sm:  6px;
--radius:     12px;
--radius-lg:  16px;
--radius-xl:  24px;

--shadow-sm:  0 1px 3px rgba(0,0,0,0.4);
--shadow:     0 4px 16px rgba(0,0,0,0.5);
--shadow-lg:  0 8px 32px rgba(0,0,0,0.6);
--shadow-xl:  0 16px 48px rgba(0,0,0,0.7);
--shadow-glow: 0 0 24px var(--primary-glow);

--transition: 0.2s ease;
--transition-slow: 0.4s cubic-bezier(0.4, 0, 0.2, 1);
```

## Naming Conventions

- Use **kebab-case** for all class names: `.restaurant-card`, `.trip-sidebar`
- Use **BEM-inspired naming** for component variants: `.tag-badge.business`, `.social-link.instagram`
- IDs use **camelCase** matching JavaScript references: `#searchInput`, `#restaurantList`
- State classes: `.active`, `.open`, `.visible`, `.sidebar-collapsed`
- Use descriptive, component-scoped names — avoid generic names like `.container` or `.wrapper` without context

## Design Patterns

### Glassmorphism
Used throughout for cards, panels, and elevated surfaces:
```css
background: var(--bg-glass);
backdrop-filter: blur(20px);
-webkit-backdrop-filter: blur(20px);
border: 1px solid var(--border);
```
Always include the `-webkit-` prefix for Safari support.

### Gradient Text
Used for the header title:
```css
background: linear-gradient(135deg, #fff 0%, var(--primary) 100%);
-webkit-background-clip: text;
-webkit-text-fill-color: transparent;
background-clip: text;
```

### Hover Effects
Standard interactive element hover pattern:
```css
transition: var(--transition);
/* On hover: */
transform: translateY(-1px);     /* or translateX(4px) for cards */
box-shadow: var(--shadow-lg);
border-color: var(--border-accent);
```

### Card Pattern
Restaurant cards and trip cards follow this structure:
```css
.card {
    background: var(--bg-glass);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 1rem;
    transition: var(--transition);
}
.card:hover {
    background: var(--bg-glass-hover);
    border-color: var(--border-accent);
    transform: translateX(4px);   /* or translateY(-2px) */
}
```

### Button Patterns
Two main button styles:
1. **Glass button** (secondary actions):
   ```css
   background: var(--bg-glass);
   border: 1px solid var(--border);
   color: var(--text-dim);
   ```
2. **Gradient button** (primary CTAs):
   ```css
   background: linear-gradient(135deg, var(--primary), var(--secondary));
   color: #fff;
   border: none;
   box-shadow: 0 0 20px var(--primary-glow);
   ```

## Layout

- Use **CSS Flexbox** for one-dimensional layouts (header, card rows, action groups)
- Use **CSS Grid** sparingly — Flexbox is preferred in this codebase
- No floats — use `display: flex` with `gap` for spacing
- `box-sizing: border-box` is set globally via universal selector
- Main layout: sticky header + flex main content area

## Typography

- **Font family**: `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
- **Font smoothing**: `-webkit-font-smoothing: antialiased`
- **Line height**: `1.6` (body default)
- Font sizes use `rem` units relative to browser default (16px)
- Font weights used: 300 (light), 400 (regular), 500 (medium), 600 (semibold), 700 (bold), 800 (extra-bold)

## Responsive Design

### Approach
**Mobile-first** base styles with `max-width` media queries for adjustments:

### Breakpoints
```css
@media (max-width: 1024px) { /* Tablet landscape */ }
@media (max-width: 768px)  { /* Tablet portrait / large mobile */ }
@media (max-width: 480px)  { /* Small mobile */ }
```

### Responsive Patterns
- Header buttons hide text labels at small widths, showing only icons
- Sidebar collapses to full-width on mobile
- World map sidebar becomes collapsible
- Filter bar wraps on smaller screens
- Restaurant cards stack vertically

## Animations & Transitions

- Use CSS `transition` for hover effects (standard `var(--transition)`)
- Use `@keyframes` for complex animations (concierge loading orb, slide-in notifications)
- Use `animation-delay` for staggered card entrances
- Respect `prefers-reduced-motion` when adding new animations

## Scrollbar Styling

Custom WebKit scrollbar for the dark theme:
```css
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: var(--bg-surface); }
::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 99px; }
::-webkit-scrollbar-thumb:hover { background: var(--primary); }
```

## Map-Related Styles

- Leaflet popup styles are overridden to match the dark theme
- iOS-style pin markers are created with CSS (`.ios-pin-marker`, `.ios-pin-circle`, `.ios-pin-tail`)
- Popup content uses `.popup-content-full` for full-width card-style popups
- Map controls (directions, search area) are styled to match the app theme

## Third-Party Overrides

Leaflet popup default styles are overridden:
```css
.leaflet-popup-content-wrapper { /* Dark theme background */ }
.leaflet-popup-tip { /* Matching dark tip */ }
```
Keep overrides scoped and minimal — avoid global Leaflet style changes.
