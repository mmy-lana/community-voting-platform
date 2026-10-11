# UI Primitives & Design System

## 1. Design Tokens

| Token | Value | Usage |
|---|---|---|
| `--color-surface` | `#FFFFFF` | Card base (light) |
| `--color-surface-dark` | `#0B1220` | App background (dark) |
| `--color-ink` | `#0B1220` | Primary text (light mode) |
| `--color-ink-inverse` | `#FFFFFF` | Text on accent |
| `--color-accent` | `#4338CA` | Vote button / primary CTA |
| `--color-accent-strong` | `#312E81` | Hover/pressed CTA |
| `--color-voted` | `#059669` | Selected/voted state |
| `--color-closed` | `#DC2626` | Closed/expired state |
| `--color-warning` | `#D97706` | Near-expiry badge |
| `--color-border` | `#E2E8F0` / `#1E293B` (dark) | Card borders |
| Bar palette | `#4338CA`, `#0EA5E9`, `#F59E0B`, `#10B981`, `#EC4899`, `#8B5CF6` | BarChart series, WCAG AA on both surfaces |
| `--radius-card` | `16px` | VoteCard |
| `--radius-control` | `10px` | Buttons/badges |
| `--space-1..8` | 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 px | Spacing scale |
| `--font-sans` | Inter, system-ui fallback | All text |
| Type scale | 12 / 14 / 16 / 20 / 28 / 40 px (body-sm -> display) | |
| `--chart-bar-h` | 28px mobile / 32px >=768px | Bar thickness |
| `--touch-min` | 44px | Minimum touch target |

## 2. Tailwind v4 `@theme` Mapping

```css
@import "tailwindcss";

@theme {
  --color-surface: #ffffff;
  --color-surface-dark: #0b1220;
  --color-ink: #0b1220;
  --color-ink-inverse: #ffffff;
  --color-accent: #4338ca;
  --color-accent-strong: #312e81;
  --color-voted: #059669;
  --color-closed: #dc2626;
  --color-warning: #d97706;
  --color-border: #e2e8f0;

  --color-chart-1: #4338ca;
  --color-chart-2: #0ea5e9;
  --color-chart-3: #f59e0b;
  --color-chart-4: #10b981;
  --color-chart-5: #ec4899;
  --color-chart-6: #8b5cf6;

  --radius-card: 16px;
  --radius-control: 10px;
  --text-body-sm: 12px;
  --text-body: 14px;
  --text-body-lg: 16px;
  --text-title: 20px;
  --text-headline: 28px;
  --text-display: 40px;
  --spacing-touch: 44px;
  --font-sans: "Inter", system-ui, sans-serif;
}
```

## 3. Mobile-First Breakpoint Behavior

| Width | Layout rules |
|---|---|
| 360px | Single-column VoteCards; full-width option buttons; BarChart bars full width, labels truncate with ellipsis + `title` attr; 4px outer gutter; bottom sticky vote bar |
| 390px | Same as 360; slightly larger paddings (16px); type scale unchanged |
| 430px | At >=430px, all polls show percentages inline-right of option labels within the option row. The stacked full-width layout is unchanged from 360px. |
| 768px | 2-column card grid; BarChart gains value labels outside bars; modal becomes centered dialog (max-w 560px) |
| 1024px+ | 3-column grid (list page), max content width 1200px; results page two-pane (chart left, meta/time-series right) |

## 4. Atomic Component Signatures

```ts
// Button
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}

// Badge
interface BadgeProps {
  tone: 'neutral' | 'open' | 'closed' | 'draft' | 'warning';
  children: React.ReactNode;
}

// VoteCard
interface VoteCardProps {
  poll: PollDetailDTO;
  selectedOptionId: number | null;
  hasVoted: boolean;
  onOptionSelect: (optionId: number) => void;
  onSubmitVote: (optionId: number) => void;
  disabled?: boolean;
  expiryLabel?: string;
  onOpenResults?: () => void;
}

// BarChart
interface BarChartProps {
  data: ResultBucketDTO[];
  highlightOptionId?: number | null;
  maxBarSize?: number;
  animate?: boolean;
  showCounts?: boolean;
  emptyLabel?: string;
}

// ProgressBar
interface ProgressBarProps {
  value: number;
  color?: string;
  label: string;
  size?: 'sm' | 'md';
}

// Modal
interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  role?: 'dialog' | 'alertdialog';
  initialFocus?: 'first' | 'close';
}

// Toast
interface ToastMessage {
  id: string;
  tone: 'success' | 'error' | 'info';
  message: string;
  autoDismissMs?: number;
}

// Skeleton
interface SkeletonProps {
  variant: 'card' | 'bar-row' | 'text';
  count?: number;
}

// EmptyState
interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

// Spinner
interface SpinnerProps { size?: 16 | 24 | 32; label?: string }
```

Shared imports: All components import DTO types from `@community/shared` via the configured path alias.

VoteCard Interaction Model: `onOptionSelect` updates local selection state only (no network call). A separate "Cast Vote" button (disabled until a selection is made) triggers `onSubmitVote(selectedOptionId)`. Single-tap auto-submit is not used.

Accessibility contract: VoteCard options are a `role="radiogroup"` with `role="radio"` rows (arrow-key navigation); BarChart is `role="img"` with `aria-label` summary ("Option A leads with 45% of 128 votes") plus a visually-hidden `<table>` fallback; Modal traps focus, restores on close, `Escape` closes.
