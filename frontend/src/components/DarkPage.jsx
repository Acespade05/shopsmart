// Wraps pages that were styled for the old light theme (ink text on paper)
// so they read correctly on the dark storefront.
const DARK_OVERRIDES =
  'min-h-screen bg-[#0b0a08] text-[#f3eee3] ' +
  '[&_.text-ink]:!text-[#f3eee3] [&_.text-ink\\/70]:!text-[#f3eee3]/70 [&_.text-ink\\/60]:!text-[#f3eee3]/60 ' +
  '[&_.text-ink\\/50]:!text-[#f3eee3]/50 [&_.text-ink\\/40]:!text-[#f3eee3]/40 [&_.text-ink\\/30]:!text-[#f3eee3]/30 ' +
  '[&_.border-line]:!border-[#f3eee3]/10 [&_.bg-emerald-light]:!bg-[#14120f] ' +
  '[&_.text-emerald]:!text-[#5fb8a6] [&_.border-emerald]:!border-[#e3a857]';

export default function DarkPage({ children }) {
  return <div className={DARK_OVERRIDES}>{children}</div>;
}
