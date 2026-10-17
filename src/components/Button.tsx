import Link from "next/link";

interface ButtonProps {
  label: string;
  iconLeft?: React.ReactNode;
  variant?: "primary" | "cancel" | "ghost";
  disabled?: boolean;
  onClick?: () => void;
  href?: string;
  type?: "button" | "submit";
}

const baseCls =
  "inline-flex items-center gap-1.5 h-10 px-4 rounded-lg font-sans text-sm font-semibold cursor-pointer whitespace-nowrap transition-[background-color,border-color,color,opacity] duration-[120ms] shrink-0 no-underline border border-transparent box-border";

const variantCls: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "bg-brand text-white border-brand hover:bg-brand-hover hover:border-brand-hover",
  cancel: "bg-cancel text-white border-cancel hover:bg-cancel-hover",
  ghost: "bg-transparent text-brand border-transparent hover:bg-[rgba(27,153,86,0.06)]",
};

const disabledCls = "opacity-50 cursor-default pointer-events-none";

const iconCls = "flex items-center [&_svg]:w-5 [&_svg]:h-5";

export default function Button({
  label,
  iconLeft,
  variant = "primary",
  disabled,
  onClick,
  href,
  type = "button",
}: ButtonProps) {
  const cls = `${baseCls} ${variantCls[variant]} ${disabled ? disabledCls : ""}`;

  // Marcas lidas pela exportação para o Figma (ver tools/figma-export).
  // São apenas atributos `data-*`: não alteram o comportamento nem o visual.
  const marcas = {
    "data-figma": "Button",
    "data-figma-variant": variant,
    "data-figma-state": disabled ? "desabilitado" : "padrao",
    "data-figma-label": label,
    // O Button é `inline-flex`: a largura vem do conteúdo, não do contêiner.
    "data-figma-hug": "horizontal",
  };

  const conteudo = (
    <>
      {iconLeft && (
        <span className={iconCls} data-figma-slot="icon-left">
          {iconLeft}
        </span>
      )}
      {label && <span data-figma-slot="label">{label}</span>}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={cls} {...marcas}>
        {conteudo}
      </Link>
    );
  }

  return (
    <button type={type} className={cls} onClick={onClick} disabled={disabled} {...marcas}>
      {conteudo}
    </button>
  );
}
