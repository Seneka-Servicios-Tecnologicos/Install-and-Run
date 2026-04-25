import logoColor from "@/assets/logo-seneka-color.png";
import logoWhite from "@/assets/logo-seneka-white.png";

interface SenekaLogoProps {
  className?: string;
  alt?: string;
}

/**
 * Renderiza ambos logos y los alterna por CSS según `.dark` en <html>.
 * Esto evita el "flash" al cambiar entre claro/oscuro y funciona bien con SSR.
 */
export function SenekaLogo({ className = "h-7 w-auto", alt = "Seneka" }: SenekaLogoProps) {
  return (
    <>
      <img src={logoColor} alt={alt} className={`logo-light ${className}`} loading="eager" />
      <img src={logoWhite} alt={alt} className={`logo-dark ${className}`} loading="eager" />
    </>
  );
}
