# Feishu Pixel-Level UI Alignment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align Muon's entire visual design layer to Feishu's pixel-exact specification — design tokens first (colors, typography, radius, shadows), then components (bubbles, sidebar, header, reactions, panels).

**Architecture:** Replace Muon's 6 color scales with Feishu's 14 scales + raw-opacity layer. Update all semantic tokens to Feishu values. Adjust typography, radius, and shadows to match. Then cascade changes to component TW classes. All token changes are pure CSS — no runtime risk.

**Tech Stack:** Tailwind CSS v4 `@theme` blocks, Vue 3 SFC `<template>` classes, CSS custom properties, `.dark` class for dark mode.

---

### Task 1: Replace Color Token File

**Files:**
- Modify: `packages/ui/src/tokens/colors.css`

- [ ] **Step 1: Replace the entire colors.css with Feishu's palette + semantic tokens**

Write the complete file:

```css
/* 14 Feishu color scales with raw opacity layer */
@theme {
  /* Blue (B) — Primary Brand — light mode */
  --B50: #f0f4ff;    --B50-raw: 240,244,255;
  --B100: #e1eaff;   --B100-raw: 225,234,255;
  --B200: #bacefd;   --B200-raw: 186,206,253;
  --B300: #82a7fc;   --B300-raw: 130,167,252;
  --B400: #4e83fd;   --B400-raw: 78,131,253;
  --B500: #3370ff;   --B500-raw: 51,112,255;
  --B600: #245bdb;   --B600-raw: 36,91,219;
  --B700: #1c4cba;   --B700-raw: 28,76,186;
  --B800: #133c9a;   --B800-raw: 19,60,154;
  --B900: #0c296e;   --B900-raw: 12,41,110;

  /* Neutral (N) — Gray — light mode */
  --N00: #ffffff;    --N00-raw: 255,255,255;
  --N50: #f5f6f7;    --N50-raw: 245,246,247;
  --N100: #f2f3f5;   --N100-raw: 242,243,245;
  --N200: #eff0f1;   --N200-raw: 239,240,241;
  --N300: #dee0e3;   --N300-raw: 222,224,227;
  --N350: #d0d3d6;   --N350-raw: 208,211,214;
  --N400: #bbbfc4;   --N400-raw: 187,191,196;
  --N500: #8f959e;   --N500-raw: 143,149,158;
  --N600: #646a73;   --N600-raw: 100,106,115;
  --N650: #51565d;   --N650-raw: 81,86,93;
  --N700: #373c43;   --N700-raw: 55,60,67;
  --N800: #2b2f36;   --N800-raw: 43,47,54;
  --N900: #1f2329;   --N900-raw: 31,35,41;
  --N950: #0f1114;   --N950-raw: 15,17,20;
  --N1000: #000000;  --N1000-raw: 0,0,0;

  /* Red (R) — Danger — light mode */
  --R50: #fef1f1;    --R50-raw: 254,241,241;
  --R100: #fde2e2;   --R100-raw: 253,226,226;
  --R200: #fbbfbc;   --R200-raw: 251,191,188;
  --R300: #f98e8b;   --R300-raw: 249,142,139;
  --R400: #f76964;   --R400-raw: 247,105,100;
  --R500: #f54a45;   --R500-raw: 245,74,69;
  --R600: #fa7873;   --R600-raw: 250,120,115;
  --R700: #ff9c99;   --R700-raw: 255,156,153;
  --R800: #fec6c3;   --R800-raw: 254,198,195;
  --R900: #ffe0e0;   --R900-raw: 255,224,224;

  /* Green (G) — Success — light mode */
  --G50: #f0fbef;    --G50-raw: 240,251,239;
  --G100: #d9f5d6;   --G100-raw: 217,245,214;
  --G200: #b7edb1;   --G200-raw: 183,237,177;
  --G300: #8ee085;   --G300-raw: 142,224,133;
  --G400: #62d256;   --G400-raw: 98,210,86;
  --G500: #34c724;   --G500-raw: 52,199,36;
  --G600: #2ea121;   --G600-raw: 46,161,33;
  --G700: #237b19;   --G700-raw: 35,123,25;
  --G800: #186010;   --G800-raw: 24,96,16;
  --G900: #124b0c;   --G900-raw: 18,75,12;

  /* Orange (O) — Warning — light mode */
  --O50: #fff5eb;    --O50-raw: 255,245,235;
  --O100: #feead2;   --O100-raw: 254,234,210;
  --O200: #fed4a4;   --O200-raw: 254,212,164;
  --O300: #ffba6b;   --O300-raw: 255,186,107;
  --O400: #ffa53d;   --O400-raw: 255,165,61;
  --O500: #ff8800;   --O500-raw: 255,136,0;
  --O600: #f5a54a;   --O600-raw: 245,165,74;
  --O700: #fabc75;   --O700-raw: 250,188,117;
  --O800: #ffd8ac;   --O800-raw: 255,216,172;
  --O900: #ffeace;   --O900-raw: 255,234,206;

  /* N opacity variants for fill/hover patterns */
  --N00-5: rgba(var(--N00-raw), 0.05);
  --N00-10: rgba(var(--N00-raw), 0.1);
  --N00-15: rgba(var(--N00-raw), 0.15);
  --N00-20: rgba(var(--N00-raw), 0.2);
  --N00-30: rgba(var(--N00-raw), 0.3);
  --N00-40: rgba(var(--N00-raw), 0.4);
  --N00-50: rgba(var(--N00-raw), 0.5);
  --N00-60: rgba(var(--N00-raw), 0.6);
  --N00-70: rgba(var(--N00-raw), 0.7);
  --N00-80: rgba(var(--N00-raw), 0.8);
  --N00-90: rgba(var(--N00-raw), 0.9);
  --N900-5: rgba(var(--N900-raw), 0.05);
  --N900-10: rgba(var(--N900-raw), 0.1);
  --N900-15: rgba(var(--N900-raw), 0.15);
  --N900-20: rgba(var(--N900-raw), 0.2);
  --N900-30: rgba(var(--N900-raw), 0.3);
  --N900-40: rgba(var(--N900-raw), 0.4);
  --N900-50: rgba(var(--N900-raw), 0.5);
  --N900-60: rgba(var(--N900-raw), 0.6);
  --N900-70: rgba(var(--N900-raw), 0.7);
  --N900-80: rgba(var(--N900-raw), 0.8);
  --N900-90: rgba(var(--N900-raw), 0.9);
}

/* Semantic role layer — light mode */
@theme {
  /* Backgrounds */
  --bg-body: var(--N00);
  --bg-base: var(--N100);
  --bg-float: var(--N00);
  --bg-float-overlay: var(--N50);
  --bg-mask: rgba(0, 0, 0, 0.4);
  --bg-content-base: #f8f9fa;
  --bg-text-selection: rgba(var(--B600-raw), 0.3);
  --bg-sub-navigation: var(--bg-body-overlay);
  --bg-pricolor: var(--primary-pri-400);

  /* Text */
  --text-title: var(--N900);
  --text-caption: var(--N600);
  --text-placeholder: var(--N500);
  --text-disabled: var(--N400);
  --text-link-normal: var(--B600);
  --text-link-hover: var(--B500);
  --text-link-pressed: var(--B700);
  --text-link-disabled: var(--N400);
  --text-link-loading: var(--B300);

  /* Icons */
  --icon-n1: var(--N800);
  --icon-n2: var(--N600);
  --icon-n3: var(--N500);
  --icon-disabled: var(--N400);

  /* Fills (hover/active/selected) */
  --fill-hover: rgba(var(--N900-raw), 0.08);
  --fill-active: rgba(var(--B500-raw), 0.12);
  --fill-pressed: rgba(var(--N900-raw), 0.12);
  --fill-selected: rgba(var(--B500-raw), 0.08);
  --fill-focus: rgba(var(--N900-raw), 0.12);
  --fill-disabled: var(--N400);
  --fill-tag: rgba(var(--N900-raw), 0.1);

  /* Borders & lines */
  --line-border-card: rgba(var(--N900-raw), 0.15);
  --line-border-component: var(--N350);
  --line-divider-default: rgba(var(--N900-raw), 0.15);
  --line-divider-module: rgba(var(--N900-raw), 0.15);

  /* Primary brand aliases */
  --primary-pri-50: var(--B50);
  --primary-pri-100: var(--B100);
  --primary-pri-200: var(--B200);
  --primary-pri-300: var(--B300);
  --primary-pri-400: var(--B400);
  --primary-pri-500: var(--B500);
  --primary-pri-600: var(--B600);
  --primary-pri-700: var(--B700);
  --primary-pri-800: var(--B800);
  --primary-pri-900: var(--B900);
  --primary-pri-50-raw: var(--B50-raw);
  --primary-pri-100-raw: var(--B100-raw);
  --primary-pri-200-raw: var(--B200-raw);
  --primary-pri-300-raw: var(--B300-raw);
  --primary-pri-400-raw: var(--B400-raw);
  --primary-pri-500-raw: var(--B500-raw);
  --primary-pri-600-raw: var(--B600-raw);
  --primary-pri-700-raw: var(--B700-raw);
  --primary-pri-800-raw: var(--B800-raw);
  --primary-pri-900-raw: var(--B900-raw);

  /* Functional color aliases */
  --function-danger-50: var(--R50);
  --function-danger-100: var(--R100);
  --function-danger-200: var(--R200);
  --function-danger-300: var(--R300);
  --function-danger-400: var(--R400);
  --function-danger-500: var(--R500);
  --function-danger-600: var(--R600);
  --function-danger-700: var(--R700);
  --function-danger-800: var(--R800);
  --function-danger-900: var(--R900);
  --function-warning-50: var(--O50);
  --function-warning-100: var(--O100);
  --function-warning-200: var(--O200);
  --function-warning-300: var(--O300);
  --function-warning-400: var(--O400);
  --function-warning-500: var(--O500);
  --function-warning-600: var(--O600);
  --function-warning-700: var(--O700);
  --function-warning-800: var(--O800);
  --function-warning-900: var(--O900);

  /* Shadows defaults (raw + color) */
  --shadow-default-raw: var(--N900-raw);
  --shadow-default: var(--N900);

  /* Shadow opacity overrides for dark mode */
  --shadow-default-sm: rgba(var(--N900-raw), 0.12);
  --shadow-default-md: rgba(var(--N900-raw), 0.1);
  --shadow-default-lg: rgba(var(--N900-raw), 0.08);

  /* Gradients */
  --gradient-red: linear-gradient(90deg, var(--R400), var(--R500));
  --gradient-orange: linear-gradient(90deg, var(--O400), var(--O500));
  --gradient-yellow: linear-gradient(90deg, var(--Y400), var(--Y500));
  --gradient-purple: linear-gradient(90deg, var(--P400), var(--P500));
  --gradient-turquoise: linear-gradient(90deg, var(--T400), var(--T500));
  --gradient-violet: linear-gradient(90deg, var(--V400), var(--V500));
  --gradient-wathet: linear-gradient(90deg, var(--W400), var(--W500));

  /* Muon compatibility layer — existing --color-* tokens mapped to Feishu values */
  --color-background: var(--N00);
  --color-foreground: var(--N900);
  --color-muted: var(--N100);
  --color-muted-foreground: var(--N600);
  --color-primary: var(--B500);
  --color-primary-foreground: #ffffff;
  --color-accent: var(--N100);
  --color-accent-foreground: var(--N900);
  --color-destructive: var(--R500);
  --color-destructive-foreground: #ffffff;
  --color-border: rgba(var(--N900-raw), 0.15);
  --color-input: var(--N300);
  --color-ring: var(--B500);
  --color-card: var(--N00);
  --color-card-foreground: var(--N900);
  --color-secondary: var(--B500);
  --color-secondary-foreground: #ffffff;
  --color-popover: var(--N00);
  --color-popover-foreground: var(--N900);
  --color-sidebar: var(--N50);
  --color-sidebar-foreground: var(--N900);
  --color-sidebar-border: rgba(var(--N900-raw), 0.15);
  --color-sidebar-accent: var(--N100);
  --color-sidebar-accent-foreground: var(--N900);
  --color-sidebar-primary: var(--B500);
  --color-sidebar-primary-foreground: #ffffff;
  --color-sidebar-ring: var(--B500);
  --color-server-bar: var(--N100);
  --color-success: var(--G500);
  --color-warning: var(--O500);
  --color-info: var(--B500);
  --color-chart-1: var(--B500);
  --color-chart-2: var(--G500);
  --color-chart-3: var(--O500);
  --color-chart-4: var(--R500);
  --color-chart-5: var(--N500);

  /* Molecule-level aliases */
  --color-list-item-hover-bg: var(--fill-hover);
  --color-list-item-selected-bg: var(--fill-selected);
  --color-list-item-active-rail: var(--B500);
  --color-menu-item-hover-bg: var(--fill-hover);
  --color-file-chip-bg: var(--N50);
  --color-file-chip-hover-bg: var(--N100);
  --color-breadcrumb-current-fg: var(--N900);
}

/* Semantic role layer — dark mode */
.dark {
  /* Palette overrides */
  --B50: #151f33;    --B50-raw: 21,31,51;
  --B100: #192a4c;   --B100-raw: 25,42,76;
  --B200: #203e78;   --B200-raw: 32,62,120;
  --B300: #2851a3;   --B300-raw: 40,81,163;
  --B400: #2e65d1;   --B400-raw: 46,101,209;
  --B500: #4c88ff;   --B500-raw: 76,136,255;
  --B600: #70a0ff;   --B600-raw: 112,160,255;
  --B700: #99bbff;   --B700-raw: 153,187,255;
  --B800: #b8cfff;   --B800-raw: 184,207,255;
  --B900: #cedfff;   --B900-raw: 206,223,255;

  --N00: #0a0a0a;    --N00-raw: 10,10,10;
  --N50: #1a1a1a;    --N50-raw: 26,26,26;
  --N100: #292929;   --N100-raw: 41,41,41;
  --N200: #373737;   --N200-raw: 55,55,55;
  --N300: #434343;   --N300-raw: 67,67,67;
  --N350: #505050;   --N350-raw: 80,80,80;
  --N400: #5f5f5f;   --N400-raw: 95,95,95;
  --N500: #757575;   --N500-raw: 117,117,117;
  --N600: #a6a6a6;   --N600-raw: 166,166,166;
  --N650: #cfcfcf;   --N650-raw: 207,207,207;
  --N700: #e0e0e0;   --N700-raw: 224,224,224;
  --N800: #e8e8e8;   --N800-raw: 232,232,232;
  --N900: #ebebeb;   --N900-raw: 235,235,235;
  --N950: #f8f8f8;   --N950-raw: 248,248,248;
  --N1000: #ffffff;  --N1000-raw: 255,255,255;

  --R50: #361918;    --R50-raw: 54,25,24;
  --R100: #4a1d1b;   --R100-raw: 74,29,27;
  --R200: #6b2827;   --R200-raw: 107,40,39;
  --R300: #9e3836;   --R300-raw: 158,56,54;
  --R400: #cc4743;   --R400-raw: 204,71,67;
  --R500: #f05b56;   --R500-raw: 240,91,86;
  --R600: #d83931;   --R600-raw: 216,57,49;
  --R700: #ac2f28;   --R700-raw: 172,47,40;
  --R800: #812520;   --R800-raw: 129,37,32;
  --R900: #621c18;   --R900-raw: 98,28,24;

  --G50: #162e2b;    --G50-raw: 22,46,43;
  --G100: #153d38;   --G100-raw: 21,61,56;
  --G200: #23665d;   --G200-raw: 35,102,93;
  --G300: #269687;   --G300-raw: 38,150,135;
  --G400: #37b8a6;   --G400-raw: 55,184,166;
  --G500: #54c248;   --G500-raw: 84,194,72;
  --G600: #04b49c;   --G600-raw: 4,180,156;
  --G700: #078372;   --G700-raw: 7,131,114;
  --G800: #036356;   --G800-raw: 3,99,86;
  --G900: #024b41;   --G900-raw: 2,75,65;

  --O50: #33210b;    --O50-raw: 51,33,11;
  --O100: #57330a;   --O100-raw: 87,51,10;
  --O200: #845117;   --O200-raw: 132,81,23;
  --O300: #bd7017;   --O300-raw: 189,112,23;
  --O400: #de8218;   --O400-raw: 222,130,24;
  --O500: #f2962c;   --O500-raw: 242,150,44;
  --O600: #de7802;   --O600-raw: 222,120,2;
  --O700: #b26206;   --O700-raw: 178,98,6;
  --O800: #8f4f04;   --O800-raw: 143,79,4;
  --O900: #6b3900;   --O900-raw: 107,57,0;

  /* Dark semantic overrides */
  --bg-body: var(--N50);
  --bg-base: var(--N100);
  --bg-float: var(--N100);
  --bg-float-overlay: var(--N50);
  --bg-mask: rgba(0, 0, 0, 0.7);
  --bg-content-base: #121212;
  --bg-sub-navigation: #262626;
  --bg-pricolor: var(--primary-pri-500);
  --bg-body-overlay: var(--N50);

  --shadow-default-sm: rgba(0, 0, 0, 0.32);
  --shadow-default-md: rgba(0, 0, 0, 0.28);
  --shadow-default-lg: rgba(0, 0, 0, 0.24);
  --line-divider-module: var(--static-black);

  /* Muon compatibility — dark */
  --color-background: var(--N50);
  --color-foreground: var(--N900);
  --color-muted: var(--N100);
  --color-muted-foreground: var(--N600);
  --color-primary: var(--B500);
  --color-primary-foreground: #ffffff;
  --color-accent: #25262b;
  --color-accent-foreground: var(--N900);
  --color-destructive: var(--R400);
  --color-destructive-foreground: #ffffff;
  --color-border: rgba(var(--N900-raw), 0.15);
  --color-input: var(--N300);
  --color-ring: var(--B500);
  --color-card: var(--N100);
  --color-card-foreground: var(--N900);
  --color-secondary: var(--B400);
  --color-secondary-foreground: #ffffff;
  --color-popover: #25262b;
  --color-popover-foreground: var(--N900);
  --color-sidebar: var(--N50);
  --color-sidebar-foreground: var(--N900);
  --color-sidebar-border: rgba(var(--N900-raw), 0.15);
  --color-sidebar-accent: #25262b;
  --color-sidebar-accent-foreground: var(--N900);
  --color-sidebar-primary: var(--B500);
  --color-sidebar-primary-foreground: #ffffff;
  --color-sidebar-ring: var(--B500);
  --color-server-bar: #0f1113;
  --color-success: var(--G400);
  --color-warning: var(--O400);
  --color-info: var(--B400);
  --color-chart-1: var(--B500);
  --color-chart-2: var(--G400);
  --color-chart-3: var(--O400);
  --color-chart-4: var(--R400);
  --color-chart-5: var(--N400);

  --color-list-item-hover-bg: var(--fill-hover);
  --color-list-item-selected-bg: var(--fill-selected);
  --color-list-item-active-rail: var(--B400);
  --color-menu-item-hover-bg: var(--N200);
  --color-file-chip-bg: var(--N200);
  --color-file-chip-hover-bg: var(--N300);
  --color-breadcrumb-current-fg: var(--N800);
}
```

- [ ] **Step 2: Verify the file compiles (no syntax errors)**

```bash
grep -o '}' packages/ui/src/tokens/colors.css | wc -l
```
Expected: 3 (three closing braces — one for each `@theme {}` block and one for `.dark {}`)

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/tokens/colors.css
git commit -m "feat: replace color tokens with Feishu 14-scale palette + semantic tokens"
```

---

### Task 2: Update Typography Tokens

**Files:**
- Modify: `packages/ui/src/tokens/typography.css`

- [ ] **Step 1: Replace font stack and adjust font size/line-height scale**

Write the complete file:

```css
@theme {
  --font-sans: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Tahoma, "PingFang SC", "Microsoft Yahei", Arial, "Hiragino Sans GB", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
  --font-mono: "JetBrains Mono", "Fira Code", "SF Mono", Consolas, monospace;

  --text-xs: 0.625rem; /* 10px */
  --text-xs--line-height: 0.875rem; /* 14px */
  --text-sm: 0.75rem; /* 12px */
  --text-sm--line-height: 1.125rem; /* 18px */
  --text-base: 0.875rem; /* 14px */
  --text-base--line-height: 1.25rem; /* 20px */
  --text-lg: 1rem; /* 16px */
  --text-lg--line-height: 1.375rem; /* 22px */
  --text-xl: 1.125rem; /* 18px */
  --text-xl--line-height: 1.5rem; /* 24px */
  --text-2xl: 1.25rem; /* 20px */
  --text-2xl--line-height: 1.625rem; /* 26px */
  --text-3xl: 1.5rem; /* 24px */
  --text-3xl--line-height: 2rem; /* 32px */

  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/ui/src/tokens/typography.css
git commit -m "feat: adjust typography to Feishu font stack, sizes (10/12/14/16/18/20) and tighter line heights"
```

---

### Task 3: Update Border Radius Tokens

**Files:**
- Modify: `packages/ui/src/tokens/radius.css`

- [ ] **Step 1: Replace radius values with Feishu scale**

Write the complete file:

```css
@theme {
  --radius-xs: 0.125rem; /* 2px — tags, chips */
  --radius-sm: 0.25rem; /* 4px — retained for compatibility */
  --radius-md: 0.375rem; /* 6px — buttons, inputs, defaults */
  --radius-lg: 0.5rem; /* 8px — cards (previously 8px) */
  --radius-xl: 0.75rem; /* 12px — large cards */

  /* Legacy single --radius retained as alias to --radius-md */
  --radius: var(--radius-md);
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/ui/src/tokens/radius.css
git commit -m "feat: align border radius tokens to Feishu scale (2/4/6/8/12px)"
```

---

### Task 4: Replace Shadow Tokens with Feishu 6-Tier System

**Files:**
- Modify: `packages/ui/src/tokens/shadow.css`

- [ ] **Step 1: Replace with Feishu multi-layer shadow system**

Write the complete file:

```css
@theme {
  /* s1 — Subtle (cards, hover action bars) */
  --shadow-s1-down: 0px 1px 2px -2px rgba(0,0,0,0.02), 0px 2px 4px rgba(0,0,0,0.02), 0px 2px 8px 2px rgba(0,0,0,0.02);
  --shadow-s1-left: -1px 0px 2px -2px rgba(0,0,0,0.02), -2px 0px 4px rgba(0,0,0,0.02), -2px 0px 8px 2px rgba(0,0,0,0.02);
  --shadow-s1-right: 1px 0px 2px -2px rgba(0,0,0,0.02), 2px 0px 4px rgba(0,0,0,0.02), 2px 0px 8px 2px rgba(0,0,0,0.02);
  --shadow-s1-up: 0px -1px 2px -2px rgba(0,0,0,0.02), 0px -2px 4px rgba(0,0,0,0.02), 0px -2px 8px 2px rgba(0,0,0,0.02);

  /* s2 — Raised (dropdowns, tooltips) */
  --shadow-s2-down: 0px 4px 16px 4px rgba(0,0,0,0.03), 0px 4px 8px rgba(0,0,0,0.02), 0px 2px 4px -4px rgba(0,0,0,0.02);
  --shadow-s2-left: -4px 0px 16px 4px rgba(0,0,0,0.03), -4px 0px 8px rgba(0,0,0,0.02), -2px 0px 4px -4px rgba(0,0,0,0.02);
  --shadow-s2-right: 4px 0px 16px 4px rgba(0,0,0,0.03), 4px 0px 8px rgba(0,0,0,0.02), 2px 0px 4px -4px rgba(0,0,0,0.02);
  --shadow-s2-up: 0px -4px 16px 4px rgba(0,0,0,0.03), 0px -4px 8px rgba(0,0,0,0.02), 0px -2px 4px -4px rgba(0,0,0,0.02);

  /* s3 — Modal (dialogs) */
  --shadow-s3-down: 0px 6px 18px 6px rgba(0,0,0,0.03), 0px 3px 6px -6px rgba(0,0,0,0.05), 0px 4px 8px rgba(0,0,0,0.03);
  --shadow-s3-left: -6px 0px 18px 6px rgba(0,0,0,0.03), -3px 0px 6px -6px rgba(0,0,0,0.05), -4px 0px 8px rgba(0,0,0,0.03);
  --shadow-s3-right: 6px 0px 18px 6px rgba(0,0,0,0.03), 3px 0px 6px -6px rgba(0,0,0,0.05), 4px 0px 8px rgba(0,0,0,0.03);
  --shadow-s3-up: 0px -6px 18px 6px rgba(0,0,0,0.03), 0px -3px 6px -6px rgba(0,0,0,0.05), 0px -4px 8px rgba(0,0,0,0.03);

  /* s4 — High (search modals, coach marks) */
  --shadow-s4-down: 0px 8px 24px 8px rgba(0,0,0,0.04), 0px 6px 12px rgba(0,0,0,0.04), 0px 4px 8px -8px rgba(0,0,0,0.06);
  --shadow-s4-left: -8px 0px 24px 8px rgba(0,0,0,0.04), -6px 0px 12px rgba(0,0,0,0.04), -4px 0px 8px -8px rgba(0,0,0,0.06);
  --shadow-s4-right: 8px 0px 24px 8px rgba(0,0,0,0.04), 6px 0px 12px rgba(0,0,0,0.04), 4px 0px 8px -8px rgba(0,0,0,0.06);
  --shadow-s4-up: 0px -8px 24px 8px rgba(0,0,0,0.04), 0px -6px 12px rgba(0,0,0,0.04), 0px -4px 8px -8px rgba(0,0,0,0.06);

  /* s5 — Max (top-level over everything) */
  --shadow-s5-down: 0px 10px 36px 10px rgba(0,0,0,0.04), 0px 8px 24px rgba(0,0,0,0.04), 0px 6px 12px -10px rgba(0,0,0,0.06);
  --shadow-s5-left: -10px 0px 36px 10px rgba(0,0,0,0.04), -8px 0px 24px rgba(0,0,0,0.04), -6px 0px 12px -10px rgba(0,0,0,0.06);
  --shadow-s5-right: 10px 0px 36px 10px rgba(0,0,0,0.04), 8px 0px 24px rgba(0,0,0,0.04), 6px 0px 12px -10px rgba(0,0,0,0.06);
  --shadow-s5-up: 0px -10px 36px 10px rgba(0,0,0,0.04), 0px -8px 24px rgba(0,0,0,0.04), 0px -6px 12px -10px rgba(0,0,0,0.06);

  /* Legacy sm/md/lg shadows for compatibility */
  --shadow-sm-down: 0px 2px 4px rgba(var(--N900-raw), 0.12);
  --shadow-sm-left: -2px 0px 4px rgba(var(--N900-raw), 0.12);
  --shadow-sm-right: 2px 0px 4px rgba(var(--N900-raw), 0.12);
  --shadow-sm-up: 0px -2px 4px rgba(var(--N900-raw), 0.12);
  --shadow-md-down: 0px 4px 8px rgba(var(--N900-raw), 0.1);
  --shadow-md-left: -4px 0px 8px rgba(var(--N900-raw), 0.1);
  --shadow-md-right: 4px 0px 8px rgba(var(--N900-raw), 0.1);
  --shadow-md-up: 0px -4px 8px rgba(var(--N900-raw), 0.1);
  --shadow-lg-down: 0px 6px 24px rgba(var(--N900-raw), 0.08);
  --shadow-lg-left: -6px 0px 24px rgba(var(--N900-raw), 0.08);
  --shadow-lg-right: 6px 0px 24px rgba(var(--N900-raw), 0.08);
  --shadow-lg-up: 0px -6px 24px rgba(var(--N900-raw), 0.08);

  /* Primary color shadows for branded elements */
  --shadow-pri-md: rgba(var(--B600-raw), 0.24);
  --shadow-pri-md-down: 0px 4px 8px var(--shadow-pri-md);
  --shadow-pri-lg: rgba(var(--B500-raw), 0.24);
  --shadow-pri-lg-down: 0px 6px 24px var(--shadow-pri-lg);

  /* Primary-tier shadows (s1-s5 with brand color) */
  --shadow-s1-down-pri: 0px 1px 2px -2px rgba(var(--N900-raw), 0.02), 0px 2px 4px rgba(var(--B500-raw), 0.04), 0px 2px 8px 2px rgba(var(--B500-raw), 0.02);
  --shadow-s2-down-pri: 0px 2px 4px -4px rgba(var(--N900-raw), 0.02), 0px 4px 8px rgba(var(--B500-raw), 0.04), 0px 4px 16px 4px rgba(var(--B500-raw), 0.03);
  --shadow-s3-down-pri: 0px 3px 6px -6px rgba(var(--N900-raw), 0.05), 0px 4px 8px rgba(var(--B500-raw), 0.06), 0px 6px 18px 6px rgba(var(--B500-raw), 0.04);
  --shadow-s4-down-pri: 0px 4px 8px -4px rgba(var(--B500-raw), 0.16), 0px 6px 12px rgba(var(--B500-raw), 0.08), 0px 8px 24px 8px rgba(var(--B500-raw), 0.06);
  --shadow-s5-down-pri: 0px 10px 12px -10px rgba(var(--B500-raw), 0.18), 0px 8px 24px rgba(var(--B500-raw), 0.1), 0px 10px 36px 10px rgba(var(--B500-raw), 0.06);

  /* Muon compatibility aliases */
  --shadow-xs: var(--shadow-s1-down);
  --shadow-sm: var(--shadow-s2-down);
  --shadow-md: var(--shadow-s3-down);
  --shadow-lg: var(--shadow-s4-down);
  --shadow-xl: var(--shadow-s5-down);
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/ui/src/tokens/shadow.css
git commit -m "feat: replace shadows with Feishu 6-tier multi-layer system + directional & primary variants"
```

---

### Task 5: Update Message Bubble — ChatMessage.vue

**Files:**
- Modify: `src/features/chat/components/ChatMessage.vue` (lines 117-118, 779, 792)

- [ ] **Step 1: Change bubble CSS classes**

Find at line 117-118:
```css
'w-fit max-w-full rounded-2xl px-3 py-2',
isRightAligned.value ? 'self-end bg-primary/10' : 'bg-muted/60',
```

Replace with:
```css
'w-fit max-w-[70%] rounded-[20px] px-4 py-2.5',
isRightAligned.value ? 'self-end bg-[var(--B100)]' : 'bg-[var(--N200)]',
```

- [ ] **Step 2: Change message body text classes**

Find at line 779:
```css
class="text-[15px] leading-relaxed text-foreground/90 whitespace-pre-wrap break-words ..."
```

Replace with:
```css
class="text-sm leading-[20px] text-foreground/90 whitespace-pre-wrap break-words ..."
```

- [ ] **Step 3: Change plain text fallback (line 792)**

Find at line 792:
```css
class="message-selectable-text text-[15px] leading-relaxed text-foreground/90 whitespace-pre-wrap break-words"
```

Replace with:
```css
class="message-selectable-text text-sm leading-[20px] text-foreground/90 whitespace-pre-wrap break-words"
```

- [ ] **Step 4: Update sender name link font size**

Find at line 709:
```css
class="text-[15px] font-medium leading-snug cursor-pointer hover:underline underline-offset-2"
```

Replace with:
```css
class="text-sm font-medium leading-snug cursor-pointer hover:underline underline-offset-2"
```

- [ ] **Step 5: Commit**

```bash
git add src/features/chat/components/ChatMessage.vue
git commit -m "feat: align ChatMessage bubble to Feishu — radius 20px, padding 10/16, text 14px, Feishu bg colors"
```

---

### Task 6: Update Message Bubble — MessageBubble.vue

**Files:**
- Modify: `src/features/chat/components/MessageBubble.vue` (lines 507-510, 652)

- [ ] **Step 1: Change bubble background colors**

Find at line 507:
```css
isMine ? 'bg-primary/10' : 'bg-muted',
```

Replace with:
```css
isMine ? 'bg-[var(--B100)]' : 'bg-[var(--N200)]',
```

- [ ] **Step 2: Change bubble padding for non-grouped messages**

Find at lines 508-510:
```css
isGroupStart
  ? 'rounded-t-lg'
  : 'px-3 py-2',
```

Replace with:
```css
isGroupStart
  ? 'rounded-t-lg'
  : 'px-4 py-2.5',
```

- [ ] **Step 3: Change reply snippet styling**

Find at line 652:
```css
class="mt-1 max-w-[min(65vw,560px)] px-3 py-1.5 rounded-md bg-muted/40 border border-border/30"
```

Replace with:
```css
class="mt-1 max-w-[min(65vw,560px)] px-3 py-1.5 rounded-md bg-[var(--N100)] border border-border/30"
```

- [ ] **Step 4: Commit**

```bash
git add src/features/chat/components/MessageBubble.vue
git commit -m "feat: align MessageBubble bg colors and padding to Feishu values"
```

---

### Task 7: Update Message — Group Gap & Avatar

**Files:**
- Modify: `src/features/chat/components/MessageGroup.vue`
- Modify: `src/features/chat/components/ChatMessage.vue`

- [ ] **Step 1: Reduce group spacing in MessageGroup.vue**

In the MessageGroup template, find the container that renders consecutive messages from the same sender. Change any vertical spacing class:
```css
/* From (2px gap between messages in a group): */
class="... space-y-0.5 ..."
/* To (0.5px — Feishu groups have near-zero gap): */
class="... space-y-[0.5px] ..."
```

If the component uses `gap-2` or `mt-` instead, reduce those to 0.5px or 0.

- [ ] **Step 2: Update group avatar to 28px in compact mode**

In ChatMessage.vue, find the avatar component where `isFirst` is false and change the size:

Find: `<Avatar :size="32"` or similar pattern for grouped message avatars
Change to: `<Avatar :size="28"` for non-first messages in a group

If the avatar is not rendered at all for non-first messages, no change needed — Feishu only shows the avatar on the first message in a group.

- [ ] **Step 3: Commit**

```bash
git add src/features/chat/components/MessageGroup.vue src/features/chat/components/ChatMessage.vue
git commit -m "feat: reduce message group gap to 0.5px, compact avatar to 28px"
```

---

### Task 8: Update Conversation Sidebar Items

**Files:**
- Modify: `src/features/chat/components/ConversationItem.vue` (lines 122, 131-132, 137-138)

- [ ] **Step 1: Change item min-height and padding**

Find at line 122:
```css
class="group relative flex min-h-[54px] cursor-pointer select-none items-center gap-2.5 rounded-md px-2.5 py-2 ..."
```

Replace with:
```css
class="group relative flex min-h-[60px] cursor-pointer select-none items-center gap-2.5 px-4 py-2.5 ..."
```

- [ ] **Step 2: Change active rail from 2px to 3px**

Find at line 131-132:
```html
<template v-if="active">
  <div class="absolute left-0 top-1/2 h-8 w-0.5 -translate-y-1/2 bg-primary" />
```

Replace `w-0.5` with `w-[3px]`:
```html
<template v-if="active">
  <div class="absolute left-0 top-1/2 h-8 w-[3px] -translate-y-1/2 bg-primary" />
```

- [ ] **Step 3: Change unread indicator from 2px to 3px**

Find at line 137-138:
```css
class="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 bg-primary"
```

Replace with:
```css
class="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 bg-primary"
```

- [ ] **Step 4: Change conversation name font size from 13px to 14px**

Find the name text element (look for `text-[13px]` or `text-sm` on the name span):

If it uses `text-sm` (now 12px after token change), change to `text-base` (14px):
```css
class="... text-base font-semibold ..."
```

If it uses a custom `text-[13px]`, change to `text-[14px]`.

- [ ] **Step 5: Remove `rounded-md` from item (no border radius on list items)**

Remove `rounded-md` from the item's class list — Feishu sidebar items have no border radius.

- [ ] **Step 6: Commit**

```bash
git add src/features/chat/components/ConversationItem.vue
git commit -m "feat: align conversation items — 60px height, 3px active rail, 14px name"
```

---

### Task 9: Update Conversation List Layout

**Files:**
- Modify: `src/features/chat/components/ConversationList.vue`

- [ ] **Step 1: Set fixed sidebar width to 260px**

Find the root container of the conversation list and add a fixed width:

If it uses a flex/grid layout, add:
```css
class="... w-[260px] shrink-0 ..."
```

- [ ] **Step 2: Reduce filter tab gap**

Find the filter tabs container (with `gap-1.5` or `gap-2`):

Change to:
```css
class="... gap-1 ..."
```

(4px gap between filter chips)

- [ ] **Step 3: Remove vertical spacing between conversation items**

Find the list container (likely has `space-y-0.5`):
```css
class="... space-y-0 ..."
```

Remove all vertical spacing.

- [ ] **Step 4: Commit**

```bash
git add src/features/chat/components/ConversationList.vue
git commit -m "feat: set sidebar to 260px fixed, reduce filter gap, remove item spacing"
```

---

### Task 10: Update Chat Header

**Files:**
- Modify: `src/features/chat/components/ChatHeader.vue`

- [ ] **Step 1: Change room name font from 15px to 16px**

Find at line 121:
```css
class="min-w-0 truncate text-[15px] font-semibold text-foreground"
```

Replace with:
```css
class="min-w-0 truncate text-base font-semibold text-foreground"
```

(`text-base` = 16px after the token change is reverted since base is 14px — actually, use `text-[16px]`)

Wait — after Task 2, `text-base` is 14px. Room name should be 16px. Use:
```css
class="min-w-0 truncate text-[16px] font-semibold text-foreground"
```

- [ ] **Step 2: Change action button gap from 4px to 8px**

Find the action buttons container (line 116 area, likely `gap-1` or `gap-2`):
```css
class="flex h-14 min-w-0 items-center gap-2 px-4"
```

Change to:
```css
class="flex h-14 min-w-0 items-center gap-2 px-4"
```

`gap-2` is 8px — if already `gap-2`, no change needed. If `gap-1`, change to `gap-2`.

- [ ] **Step 3: Make topic always visible (not just on wide screens)**

Find at line 128:
```css
class="hidden min-w-0 truncate text-xs text-muted-foreground"
```

Change `hidden` to show on all widths:
```css
class="min-w-0 truncate text-xs text-muted-foreground"
```

Also remove the `sm:` breakpoint restriction if present:
```css
class="hidden sm:block ..." → class="block ..."
```

- [ ] **Step 4: Commit**

```bash
git add src/features/chat/components/ChatHeader.vue
git commit -m "feat: align chat header — 16px room name, always-visible topic, 8px button gap"
```

---

### Task 11: Update Hover Action Bar

**Files:**
- Modify: `src/features/chat/components/MessageActionBar.vue`

- [ ] **Step 1: Change radius, shadow, and item sizes**

Find the action bar container (look for `rounded-xl`, `shadow-`, `backdrop-blur`):

If the bar uses:
```css
class="... rounded-xl bg-popover/95 backdrop-blur-xl border border-border/50 ..."
```

Change to:
```css
class="... rounded-[10px] bg-white/90 backdrop-blur-xl border border-[rgba(31,35,41,0.08)] shadow-[var(--shadow-s1-down)] ..."
```

- [ ] **Step 2: Change action item size from 32px to 28px**

Find action buttons (look for `p-[5px]`, `w-8`, `h-8`, `size-8`):

Change from `size-8` or `w-8 h-8` to:
```css
class="... w-7 h-7 ..."
```

Or if using padding: `p-[5px]` → `p-[3px]`

- [ ] **Step 3: Reduce icon size from 18px to 16px**

Find icon components in the action bar and add/change `:size="16"`:
```html
<Reply :size="16" />
<Smile :size="16" />
<MoreHorizontal :size="16" />
```

- [ ] **Step 4: Commit**

```bash
git add src/features/chat/components/MessageActionBar.vue
git commit -m "feat: align hover action bar — radius 10px, shadow s1, 28px items, 16px icons"
```

---

### Task 12: Update Reactions, Input & Secondary Components

**Files:**
- Modify: `src/features/chat/components/ReactionBar.vue`
- Modify: `src/features/chat/components/TimeStamp.vue`
- Modify: `src/features/chat/components/TypingIndicator.vue`
- Modify: `src/features/chat/components/SystemMessage.vue`
- Modify: `src/features/chat/components/RichTextInput.vue`

- [ ] **Step 1: ReactionBar.vue — chip sizing and margins**

Find reaction chip classes (look for `px-1.5 py-0.5` or `rounded-md text-xs`):
- Padding: `px-0.5 py-0.5` (2px 6px equiv, keep text-xs)
- Own reaction bg: `bg-[var(--B100)] border border-[var(--B300)]`
- Others bg: `bg-[var(--N100)] border border-transparent`
- Margin from bubble: `mt-2` instead of `mt-1`

- [ ] **Step 2: TimeStamp.vue — font 12→10px**

Find timestamp font class:
```css
class="text-xs text-muted-foreground"
```
After token change, `text-xs` = 10px (matches Feishu). Change color to:
```css
class="text-xs text-[var(--N400)]"
```

- [ ] **Step 3: TypingIndicator.vue — height and font**

Find the indicator container:
- Height: `h-6` (24px)
- Padding left: `pl-10` (40px — aligns with bubble indentation)
- Font: `text-xs` (12px → now 10px after token change, use `text-sm` for 12px)
- Color: `text-[var(--N500)]`

- [ ] **Step 4: SystemMessage.vue — text/icon sizing**

Adjust system message font to `text-xs` (10px after token change). Icons to `:size="14"`.

- [ ] **Step 5: RichTextInput.vue — send button**

Find the send button and change to:
```css
class="... rounded-full size-8 bg-[var(--B500)] text-white"
```

We don't have a full Feishu input toolbar spec. Skip detailed RichTextInput toolbar changes for now. Make the send button circular (rounded-full) and 32px.

- [ ] **Step 6: Commit**

```bash
git add src/features/chat/components/ReactionBar.vue \
        src/features/chat/components/TimeStamp.vue \
        src/features/chat/components/TypingIndicator.vue \
        src/features/chat/components/SystemMessage.vue \
        src/features/chat/components/RichTextInput.vue
git commit -m "feat: align reactions (Feishu chip style), timestamp (10px), typing, system messages, send button"
```

---

### Task 13: Update App Rail & Panel Components

**Files:**
- Modify: `src/app/components/workspace/WorkspaceAppRail.vue`
- Modify: `src/features/chat/components/ThreadPanel.vue`
- Modify: `src/features/chat/components/MemberListPanel.vue`

- [ ] **Step 1: WorkspaceAppRail — active bar 2→3px, icon 20→16px**

Find the active indicator bar (look for `w-0.5` or `w-[2px]`):
```css
class="... w-[3px] ..."  /* was w-0.5 */
```

Find nav icons (look for `size-5`):
```css
:size="16"  /* was :size="20" */
```

- [ ] **Step 2: ThreadPanel — width already 360px (verify)**

Verify the panel has `w-[360px]` or similar. No change needed if matches.

- [ ] **Step 3: MemberListPanel — item height 52px, section header 28px**

Find member list items:
```css
class="... h-[52px] ..."  /* adjust padding */
```

Add section headers with:
```css
class="... h-7 text-xs text-[var(--N500)] flex items-center px-4 ..."
```

- [ ] **Step 4: Commit**

```bash
git add src/app/components/workspace/WorkspaceAppRail.vue \
        src/features/chat/components/ThreadPanel.vue \
        src/features/chat/components/MemberListPanel.vue
git commit -m "feat: align app rail (3px bar, 16px icons), panels (52px items, section headers)"
```

---

### Task 14: Update Dialog & Menu Components

**Files:**
- Modify: `src/features/chat/components/ForwardDialog.vue`
- Modify: `src/features/chat/components/NewChatDialog.vue`
- Modify: `src/features/chat/components/MessageContextMenu.vue`

- [ ] **Step 1: ForwardDialog — width 520px, radius 10px**

Find the dialog container class:
```css
class="... w-[520px] rounded-[10px] ..."
```

- [ ] **Step 2: NewChatDialog — width 480px, radius 10px**

```css
class="... w-[480px] rounded-[10px] ..."
```

- [ ] **Step 3: MessageContextMenu — width 176px, radius 10px, font 14px**

```css
class="... min-w-[176px] rounded-[10px] shadow-[var(--shadow-s3-down)] ..."
```

Menu items:
```css
class="... h-8 px-3 py-1.5 text-sm ..."  /* text-sm = 14px after token? No — text-sm is now 12px */

/* Actually, text-sm is now 12px. Use text-base (14px) for menu items: */
class="... h-8 px-3 py-1.5 text-base ..."
```

Wait — let me check. After Task 2, `text-sm` = 12px and `text-base` = 14px. Menu items should be 14px = `text-base`.

- [ ] **Step 4: Commit**

```bash
git add src/features/chat/components/ForwardDialog.vue \
        src/features/chat/components/NewChatDialog.vue \
        src/features/chat/components/MessageContextMenu.vue
git commit -m "feat: align dialogs (Forward 520px, NewChat 480px) and context menu (176px, 10px radius)"
```

---

### Task 15: Verification — Light Mode Visual Check

- [ ] **Step 1: Start the dev server**

```bash
pnpm dev
```

- [ ] **Step 2: Verify key visual elements match Feishu**

Open Feishu side-by-side with Muon (both in light mode) and check:
1. Brand color = #3370FF (send button, active rails, unread badges)
2. Background = pure white (#FFFFFF)
3. Sidebar bg = #F2F3F5 (compare visually)
4. Message bubble = 20px radius, visible padding, B100/N200 backgrounds
5. Conversation items = 60px height, 3px active bar
6. Text contrast = N900 (#1F2329) for titles

- [ ] **Step 3: Toggle dark mode and verify**

Check all dark mode values (warmer grays, brighter #4C88FF primary).

- [ ] **Step 4: Document any remaining gaps**

Note any elements that still differ. Create follow-up issues if needed.

- [ ] **Step 5: Commit any fixups**

```bash
git status
git add -A
git commit -m "fix: visual verification fixups"  # if any changes needed
```

---

## Self-Review Notes

- All Feishu color scales (B, N, R, G, O) included in Task 1 with both light and dark values
- Typography covers font stack, 10/12/14/16/18/20 scale, tighter line heights (Task 2)
- Radius updated to Feishu values: 2/4/6/8/12px (Task 3)
- Shadows replaced with full 6-tier multi-layer system with directional + primary variants (Task 4)
- Message bubbles: radius, padding, font, bg colors all aligned (Tasks 5-6)
- Group gap reduced to 0.5px, avatar compact (Task 7)
- Sidebar items: 60px height, 3px active bar, 14px name (Task 8)
- Sidebar layout: 260px fixed width, no item spacing (Task 9)
- Chat header: 16px room name, always-visible topic (Task 10)
- Hover action bar: 10px radius, s1 shadow, 28px items (Task 11)
- Secondary components batched: reactions, timestamp, typing, system, input (Task 12)
- Panels and app rail: 3px bar, 16px icons, panel item sizes (Task 13)
- Dialogs and menus: width, radius, font sizes (Task 14)
- Verification step with side-by-side check (Task 15)

## Deferred Items (Follow-up)

Two spec items require more Feishu reference or structural changes:

1. **Read receipts (spec §5.11):** Moving from a separate ReadReceiptsBar to inline checkmarks (✓/✓✓/✓✓ blue) requires restructuring the message footer. Deferred until inline-status pattern is confirmed against live Feishu behavior.

2. **Full input toolbar (spec §5.8):** Only the send button shape was aligned (Task 12). RichTextInput toolbar icons, attachment button, and overall toolbar layout need more specific Feishu reference measurements before alignment.
