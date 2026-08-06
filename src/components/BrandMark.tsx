import hecaLogo from '@/assets/heca-logo.png';
import hecaSymbol from '@/assets/heca-symbol.png';

interface BrandMarkProps {
  /** 'symbol' = apenas o símbolo quadrado; 'full' = marca completa HECA Construtora */
  variant?: 'symbol' | 'full';
  /** Altura da marca em px (a largura se ajusta preservando a proporção) */
  size?: number;
  className?: string;
  alt?: string;
}

/**
 * Marca HECA Construtora. Usa o arquivo original da marca, sempre com
 * object-contain para preservar proporção em tema claro e escuro.
 */
export const BrandMark = ({
  variant = 'symbol',
  size = 40,
  className = '',
  alt,
}: BrandMarkProps) => {
  const isSymbol = variant === 'symbol';
  return (
    <img
      src={isSymbol ? hecaSymbol : hecaLogo}
      alt={alt ?? (isSymbol ? 'HECA Construtora' : 'HECA Construtora')}
      height={size}
      style={isSymbol ? { width: size, height: size } : { height: size }}
      className={`object-contain shrink-0 select-none ${className}`}
      draggable={false}
    />
  );
};

export default BrandMark;
