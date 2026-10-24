export default function PageTitle({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="font-display text-[1.25rem] [font-weight:590] tracking-[-0.028125rem] leading-[1.5625rem] text-ink m-0">
      {children}
    </h1>
  );
}
