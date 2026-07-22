# Recrewt UI

A minimal, editorial React component library that matches the Recrewt landing page. Twelve components, one import path, no gradients, no decorative chrome.

```js
import { Button, TextField, ScoreBadge, Card, Modal } from '@/components/ui';
```

## Design language

Every component is drawn from the landing-page tokens declared in `app/globals.css`:

| Token | Value | Purpose |
|---|---|---|
| `--color-rc-ink` | `#111111` | Primary text, ink icons |
| `--color-rc-white` | `#FFFFFF` | Card surface |
| `--color-rc-soft` | `#F7F7F4` | Muted card interior, section bands |
| `--color-rc-muted` | `#707070` | Secondary text |
| `--color-rc-line` | `#DEDEDA` | Hairline borders + dividers |
| `--color-rc-yellow` | `#FFD84D` | Accent — used sparingly |
| `--color-rc-warm` | `#B58419` | Small-caps labels, section pills |
| `--color-rc-green` | `#2A9D57` | Success, positive score |
| `--color-rc-orange` | `#D08624` | Warning, neutral status |
| `--color-rc-red` | `#C74B3A` | Danger, negative status |
| `--font-editorial` | `var(--font-archivo)` | Display face for headings |

Body copy inherits `Inter` from the root layout. Corners: 4 px (buttons, fields, badges), 12 px (medium cards), 18 px (large cards, modals, drawers). Focus rings are always the yellow token, 2 px, 3 px offset. Motion is 150 ms for state changes, 280 ms for surfaces, using the same `cubic-bezier(.22,.61,.36,1)` curve as the landing.

## Component index

### `<Button />`

Primary / secondary / ghost / danger — one component, four variants.

```jsx
<Button variant="primary" size="md" onClick={...}>Save changes</Button>
<Button variant="secondary" iconLeft={<Plus size={16} />}>Add role</Button>
<Button variant="ghost">Cancel</Button>
<Button variant="danger" loading>Delete</Button>
<Button variant="secondary" as="a" href="/dashboard">Back</Button>
```

| Prop | Type | Default | |
|---|---|---|---|
| `variant` | `'primary' \| 'secondary' \| 'ghost' \| 'danger'` | `'secondary'` | |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | 32 / 40 / 48 px tall |
| `iconLeft` | node | — | |
| `iconRight` | node | — | |
| `loading` | bool | `false` | shows `<Spinner />` and disables |
| `fullWidth` | bool | `false` | |
| `as` | `'button' \| 'a'` | `'button'` | Render as link when needed |
| `disabled` | bool | `false` | |

Focus, hover, active states are consistent across all four variants. Primary flips shade; secondary flips fill; ghost softens background; danger flips to red fill.

### `<TextField />` · `<PasswordField />` · `<Select />`

Same anatomy across all three: optional label, optional description, error state, `required` indicator, three sizes. All forward refs so form libraries (react-hook-form, Formik) work with no wrapper.

```jsx
<TextField
  label="Email"
  type="email"
  placeholder="you@company.com"
  required
  error={errors.email?.message}
  {...register('email')}
/>

<PasswordField label="Password" required {...register('password')} />

<Select
  label="Job category"
  placeholder="Choose a category"
  options={[
    { value: 'engineering', label: 'Engineering' },
    { value: 'design', label: 'Design' },
  ]}
  {...register('category')}
/>
```

Common props: `label`, `description`, `error`, `required`, `size`, `fullWidth`, plus anything the underlying input/select accepts. `PasswordField` adds a visibility toggle. `Select` accepts either an `options` array or raw `<option>` children.

### `<Badge />` · `<ScoreBadge />` · `<StatusBadge />`

Three flavors of the same pill. `Badge` is the primitive; the other two are semantic wrappers.

```jsx
<Badge variant="warning" uppercase>Free trial</Badge>
<Badge variant="ink">Most popular</Badge>

<ScoreBadge value={8.5} outOf={10} />       {/* green */}
<ScoreBadge value={82} outOf={100} />       {/* green (auto-normalized) */}

<StatusBadge status="in-progress" />
<StatusBadge status="shortlisted" />
<StatusBadge status="rejected" size="sm" />
```

`ScoreBadge` bands: `≥7 → success`, `≥4 → warning`, `<4 → danger`. Accepts values on either a 0–10 or 0–100 scale via `outOf`. `StatusBadge` maps the following statuses (case- and separator-insensitive): `invited`, `in-progress` (alias `ongoing`), `complete` (alias `completed`), `shortlisted`, `on-hold`, `rejected`, `active`, `inactive`, `draft`. Add more in `STATUS_MAP` — every call site updates automatically.

### `<Card />`

Compound component. Use the base for anything with the standard surface treatment (white, hairline border, 18 px radius, subtle shadow).

```jsx
<Card>
  <Card.Header
    title="Frontend Engineer"
    description="3 candidates in review"
    action={<Button size="sm" variant="secondary">See all</Button>}
  />
  <Card.Body>
    …content…
  </Card.Body>
  <Card.Footer>
    <Button variant="ghost">Cancel</Button>
    <Button variant="primary">Save</Button>
  </Card.Footer>
</Card>
```

Props: `padding` (`none`/`sm`/`md`/`lg`), `interactive` (adds a subtle hover lift, same as Pricing cards on the landing), `as` (change the root element).

### `<Modal />`

Centered dialog with backdrop. Handles Esc, focus return, scroll lock, and `aria-modal` for you.

```jsx
<Modal
  open={confirmOpen}
  onClose={() => setConfirmOpen(false)}
  title="Delete role?"
  description="Every candidate on this role will lose access."
  size="sm"
  footer={
    <>
      <Button variant="ghost" onClick={() => setConfirmOpen(false)}>Cancel</Button>
      <Button variant="danger" onClick={handleDelete}>Delete role</Button>
    </>
  }
>
  This can't be undone.
</Modal>
```

Sizes: `sm` (400 px), `md` (520 px), `lg` (720 px). Set `dismissible={false}` for a "must complete" dialog (Esc + backdrop close disabled).

### `<Drawer />`

Slide-in panel from any edge. Same contract as Modal — pick when the content is a linear detail view rather than a bounded decision.

```jsx
<Drawer
  open={panelOpen}
  onClose={() => setPanelOpen(false)}
  side="right"
  title="Priya Nair"
  description="Senior Product Designer · Interview complete"
  size="clamp(360px,42vw,560px)"
  footer={<Button variant="primary" fullWidth>Shortlist</Button>}
>
  …transcript, video, score bars…
</Drawer>
```

Sides: `left`, `right` (default), `top`, `bottom`. Same 280 ms motion curve as the AppShell mobile drawer.

### `<EmptyState />`

For the "nothing to show yet" moments — no roles, no candidates, an empty inbox, a filter with no matches.

```jsx
<EmptyState
  icon={<Briefcase size={22} />}
  title="No roles yet"
  description="Create your first role to start inviting candidates."
  action={<Button variant="primary" iconLeft={<Plus size={16} />}>Create role</Button>}
/>
```

Wrapped in a Card by default. Pass `bare` if you're already inside one. `title` and `description` are optional but the icon is meant to anchor the composition — always pass one.

### `<Spinner />`

Bare circular loader. Uses `currentColor`, so it inherits from any button, badge, or text container.

```jsx
<Spinner size={16} />                      {/* default: inherits color */}
<Spinner size={24} color="#B58419" />       {/* override */}
```

`Button loading` uses `<Spinner />` internally — you rarely need to render it directly except in raw text lockups ("Saving… ⟳").

## Composition patterns

**Confirmation flow** (Modal + Button):

```jsx
<Button variant="danger" onClick={() => setOpen(true)}>Delete</Button>
<Modal open={open} onClose={() => setOpen(false)} title="Delete?" size="sm"
  footer={<>
    <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
    <Button variant="danger" onClick={onConfirm} loading={submitting}>Delete</Button>
  </>}
>
  This can't be undone.
</Modal>
```

**Editable list row** (Card + Badge + Button):

```jsx
<Card padding="sm" interactive>
  <div className="flex items-center gap-4">
    <div className="min-w-0 flex-1">
      <p className="font-medium">{role.title}</p>
      <p className="text-[13px] text-[color:var(--color-rc-muted)]">{role.department}</p>
    </div>
    <StatusBadge status={role.status} />
    <Button size="sm" variant="ghost" iconRight={<ChevronRight size={14} />}>Open</Button>
  </div>
</Card>
```

**Form section** (TextField x N + Button):

```jsx
<Card padding="lg">
  <Card.Header title="Account details" description="Public profile" />
  <Card.Body>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <TextField label="First name" required />
      <TextField label="Last name" required />
      <TextField label="Company" description="Shown to candidates" fullWidth className="md:col-span-2" />
    </div>
  </Card.Body>
  <Card.Footer>
    <Button variant="ghost">Cancel</Button>
    <Button variant="primary" loading={saving}>Save changes</Button>
  </Card.Footer>
</Card>
```

## Constraints

- **No gradients.** Every fill is a flat token.
- **Yellow is an accent, not a background.** Reserve for focus rings, small-caps labels, warning badges, one-off decorative dots.
- **Body copy stays Inter; headings use `--font-editorial` (Archivo).** Do not mix in Plus Jakarta Sans — that font is scoped to the Electric Midnight product theme and clashes with this palette.
- **All components ship with `focus-visible` outlines.** Do not override.
- **Motion respects `prefers-reduced-motion`.** Do not add new animations without a reduced-motion fallback.

## Adding a component

1. Create `components/ui/<Name>.js`
2. Reuse existing tokens; don't hard-code hex.
3. Export as default from the file, then add one line to `index.js`.
4. Add a section here matching the entries above (props table, one example).
5. If it introduces new tokens, extend `@theme inline` in `app/globals.css`.

That's it.
