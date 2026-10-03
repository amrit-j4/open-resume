export const Badge = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex rounded-md bg-neutral-100 px-2 pb-0.5 align-text-bottom text-xs font-semibold text-neutral-700 ring-1 ring-inset ring-neutral-700/10">
    {children}
  </span>
);
