export const ui = {
  form: "flex flex-col gap-4",
  field: "flex flex-col gap-2",
  label: "font-sans text-base text-ink-strong",
  input:
    "h-10 w-full rounded-lg border border-border-input px-4 font-sans text-base outline-none",
  select:
    "h-10 w-full rounded-lg border border-border-input bg-white px-4 font-sans text-base outline-none",
  errorBox:
    "rounded-md border border-danger bg-danger-bg px-3 py-2 font-sans text-[0.8125rem] text-danger",
  rowActions: "flex justify-end gap-2.5 pt-1",
} as const;
