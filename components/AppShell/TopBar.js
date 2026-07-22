'use client';

import { Menu } from 'lucide-react';
import Brand from './Brand';

/**
 * Mobile top bar — hidden on ≥ md.  Contains the brand block on the
 * left and the hamburger button on the right.  Renders nothing on
 * desktop because the sidebar takes over.
 */
export default function TopBar({ onMenuClick }) {
  return (
    <div className="md:hidden bg-white border-b border-gray-soft p-4 flex items-center justify-between">
      <Brand />
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Open navigation menu"
        className="text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-violet rounded"
      >
        <Menu size={22} />
      </button>
    </div>
  );
}
