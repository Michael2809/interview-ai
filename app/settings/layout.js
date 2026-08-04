// Private application route — must never appear in search results.
export const metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export default function SettingsLayout({ children }) {
  return children;
}
