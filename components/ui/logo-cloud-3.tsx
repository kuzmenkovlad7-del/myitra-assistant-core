import { InfiniteSlider } from "@/components/ui/infinite-slider";
import { cn } from "@/lib/utils";

type Logo = {
  src: string;
  alt: string;
  width?: number;
  height?: number;
};

type LogoCloudProps = React.ComponentProps<"div"> & {
  logos: Logo[];
};

export function LogoCloud({ className, logos, ...props }: LogoCloudProps) {
  return (
    <div
      {...props}
      className={cn(
        "overflow-hidden py-4 [mask-image:linear-gradient(to_right,transparent,black,transparent)]",
        className
      )}
    >
      {/* Здесь никаких speed нет, только duration / durationOnHover */}
      <InfiniteSlider duration={35} pauseOnHover>
        {logos.map((logo) => (
          <img
            key={`logo-${logo.alt}`}
            src={logo.src}
            alt={logo.alt}
            loading="lazy"
            className="pointer-events-none h-8 select-none md:h-10"
            width={logo.width || 120}
            height={logo.height || 40}
          />
        ))}
      </InfiniteSlider>
    </div>
  );
}
