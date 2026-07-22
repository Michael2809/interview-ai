import { forwardRef, useId } from 'react';

/**
 * TextField — labelled single-line text input.
 *
 * Standard anatomy:
 *   [ Label ]  ← optional
 *   [ Description ]  ← optional
 *   [   input   ]
 *   [ Error ]  ← optional, replaces description when present
 *
 * Uses a hairline border (`--color-rc-line`) that darkens on hover
 * and swaps to ink on focus.  Error state uses the red role token
 * for the border AND the message so the field feels of-a-piece with
 * the rest of the design language.
 *
 * Props:
 *   label        string        rendered above input
 *   description  string        muted helper text
 *   error        string        shown in red, replaces description
 *   required     boolean       renders an ink dot after the label
 *   fullWidth    boolean       default true — inputs stretch by default
 *   size         'sm'|'md'|'lg' controls input height
 *   ...rest passed through to the <input>
 *
 * Uses `forwardRef` so react-hook-form and refs work naturally.
 */

const INPUT_BASE =
  'w-full block bg-white text-[color:var(--color-rc-ink)] leading-none ' +
  'border border-[color:var(--color-rc-line)] rounded ' +
  'placeholder:text-[color:var(--color-rc-muted)] placeholder:opacity-70 ' +
  'transition-colors duration-150 ' +
  'hover:border-[color:var(--color-rc-line-hover)] ' +
  'focus:outline-none focus:border-[color:var(--color-rc-ink)] focus:ring-2 focus:ring-[color:var(--color-rc-yellow)] focus:ring-offset-0 ' +
  'disabled:bg-[color:var(--color-rc-soft)] disabled:cursor-not-allowed disabled:opacity-70';

const SIZES = {
  sm: 'h-9  px-3   text-[13.5px]',
  md: 'h-11 px-3.5 text-[14.5px]',
  lg: 'h-12 px-4   text-[15.5px]',
};

const TextField = forwardRef(function TextField(
  {
    label,
    description,
    error,
    required,
    size = 'md',
    fullWidth = true,
    className = '',
    id,
    ...rest
  },
  ref
) {
  const autoId = useId();
  const inputId = id || autoId;
  const descId = description || error ? `${inputId}-desc` : undefined;

  const cls = [
    INPUT_BASE,
    SIZES[size] || SIZES.md,
    error ? 'border-[color:var(--color-rc-red)] focus:border-[color:var(--color-rc-red)]' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={fullWidth ? 'w-full' : 'inline-block'}>
      {label && (
        <label
          htmlFor={inputId}
          className="block mb-1.5 text-[13px] font-medium text-[color:var(--color-rc-ink)] tracking-[-0.005em]"
        >
          {label}
          {required && (
            <span aria-hidden="true" className="ml-1 text-[color:var(--color-rc-ink)]">•</span>
          )}
        </label>
      )}

      <input
        id={inputId}
        ref={ref}
        aria-invalid={!!error || undefined}
        aria-describedby={descId}
        required={required}
        className={cls}
        {...rest}
      />

      {(error || description) && (
        <p
          id={descId}
          className={
            'mt-1.5 text-[12.5px] leading-snug ' +
            (error
              ? 'text-[color:var(--color-rc-red)]'
              : 'text-[color:var(--color-rc-muted)]')
          }
        >
          {error || description}
        </p>
      )}
    </div>
  );
});

export default TextField;
