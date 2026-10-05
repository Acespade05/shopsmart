// Wraps pages written for the old light theme (ink text on paper) so they read
// correctly on the dark storefront. The colour mapping lives in index.css (.theme-dark).
export default function DarkPage({ children }) {
  return <div className="theme-dark">{children}</div>;
}
