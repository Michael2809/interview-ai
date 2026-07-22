import { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import TextField from './TextField';

/**
 * PasswordField — TextField with a show/hide toggle on the right.
 *
 * The toggle button preserves the input's ref so form libraries
 * still see the underlying <input>.  The eye icon uses `lucide-react`
 * (already a project dependency) and matches the existing sign-in
 * page's visibility toggle in behaviour.
 *
 * Props: same as TextField.  `type` is forced to 'password' when
 * hidden and 'text' when visible — do not pass a `type` prop.
 */

const PasswordField = forwardRef(function PasswordField(
  { className = '', ...rest },
  ref
) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <TextField
        ref={ref}
        type={visible ? 'text' : 'password'}
        className={'pr-11 ' + className}
        {...rest}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        className={
          'absolute right-2 bottom-2 h-8 w-8 grid place-items-center ' +
          'rounded text-[color:var(--color-rc-muted)] hover:text-[color:var(--color-rc-ink)] ' +
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)]'
        }
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
});

export default PasswordField;
