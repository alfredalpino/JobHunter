import Image from "next/image";

type BrandLogoProps = {
  /** full = square lockup with wordmark; icon = crosshair mark only */
  variant?: "full" | "icon";
  className?: string;
  priority?: boolean;
};

const SIZES = {
  full: { width: 512, height: 512 },
  icon: { width: 512, height: 512 },
} as const;

export function BrandLogo({
  variant = "icon",
  className = "h-11 w-11",
  priority = false,
}: BrandLogoProps) {
  const src = variant === "full" ? "/logo.png" : "/logo-icon.png";
  const { width, height } = SIZES[variant];

  return (
    <Image
      src={src}
      alt="JobHunter by Alfred Alpino"
      width={width}
      height={height}
      priority={priority}
      className={`object-contain ${className}`}
    />
  );
}
