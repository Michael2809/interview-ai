import { forwardRef, useId } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Select — native <select> wrapped to match the TextField style.
 *
 * Uses a plain <select> element so keyboard, screen-reader, mobile
 * OS pickers, and form libraries all work with zero custom code.
 * We only replace the default caret with a lucide chevron via a
 * pseudo overlay for visual consistency with the rest of the system.
 *
 * Props:
 *   label        string
 *   description  string    muted helper text
 *   error        string    red border + message
 *   required     boolean
 *   size         'sm' | 'md' | 'lg'
 *   options      Array<{ value, label }>   OR you can pass raw
 *                <option> children
 *   placeholder  string    renders as a disabled first option
 *   fullWidth    boolean   default true
 *   ...rest passed through to the underlying <select>
 */

const BASE =
  'w-full block appearance-none pr-9 bg-white text-[color:var(--color-rc-ink)] leading-none ' +
  'border border-[color:var(--color-rc-line)] rounded ' +
  'transition-colors duration-150 ' +
  'hover:border-[color:var(--color-rc-line-hover)] ' +
  'focus:outline-none focus:border-[color:var(--color-rc-ink)] focus:ring-2 focus:ring-[color:var(--color-rc-yellow)] focus:ring-offset-0 ' +
  'disabled:bg-[color:var(--color-rc-soft)] disabled:cursor-not-allowed disabled:opacity-70';

const SIZES = {
  sm: 'h-9  pl-3   text-[13.5px]',
  md: 'h-11 pl-3.5 text-[14.5px]',
  lg: 'h-12 pl-4   text-[15.5px]',
};

const Select = forwardRef(function Select(
  {
    label,
    description,
    error,
    required,
    size = 'md',
    fullWidth = true,
    options,
    placeholder,
    className = '',
    id,
    children,
    ...rest
  },
  ref
) {
  const autoId = useId();
  const selectId = id || autoId;
  const descId = description || error ? `${selectId}-desc` : undefined;

  const cls = [
    BASE,
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
          htmlFor={selectId}
          className="block mb-1.5 text-[13px] font-medium text-[color:var(--color-rc-ink)] tracking-[-0.005em]"
        >
          {label}
          {required && (
            <span aria-hidden="true" className="ml-1">•</span>
          )}
        </label>
      )}

      <div className="relative">
        <select
          id={selectId}
          ref={ref}
          aria-invalid={!!error || undefined}
          aria-describedby={descId}
          required={required}
          className={cls}
          /* Only apply defaultValue when the caller is using the field
             uncontrolled (no `value` prop). Otherwise React flags a
             controlled/uncontrolled conflict. */
          {...(rest.value === undefined && placeholder ? { defaultValue: '' } : {})}
          {...rest}
        >
          {placeholder && (
            <option value="" disabled hidden>
              {placeholder}
            </option>
          )}
          {options
            ? options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))
            : children}
        </select>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--color-rc-muted)]"
        />
      </div>

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

export default Select;
