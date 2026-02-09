/**
 * Optimized Image Component
 *
 * Wrapper around Next.js Image with performance best practices:
 * - Automatic WebP/AVIF format selection
 * - Lazy loading by default
 * - Proper sizing attributes
 * - Blur placeholder for better UX
 */

'use client';

import Image, { ImageProps } from 'next/image';
import React from 'react';

interface OptimizedImageProps extends Omit<ImageProps, 'placeholder'> {
  /**
   * Whether to use blur placeholder (requires blurDataURL)
   */
  useBlurPlaceholder?: boolean;
  /**
   * Fallback image if src fails to load
   */
  fallbackSrc?: string;
}

export function OptimizedImage({
  useBlurPlaceholder = false,
  fallbackSrc,
  alt,
  ...props
}: OptimizedImageProps) {
  const [imgSrc, setImgSrc] = React.useState(props.src);

  const handleError = () => {
    if (fallbackSrc) {
      setImgSrc(fallbackSrc);
    }
  };

  return (
    <Image
      {...props}
      src={imgSrc}
      alt={alt}
      placeholder={useBlurPlaceholder ? 'blur' : 'empty'}
      loading={props.loading || 'lazy'}
      quality={props.quality || 85}
      onError={handleError}
    />
  );
}

/**
 * Avatar Image Component
 *
 * Optimized for user avatars with circular styling
 */
interface AvatarImageProps {
  src?: string | null;
  alt: string;
  size?: number;
  fallback?: string;
  className?: string;
}

export function AvatarImage({
  src,
  alt,
  size = 40,
  fallback,
  className = '',
}: AvatarImageProps) {
  const initials = alt
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  if (!src) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-300 text-gray-700 font-semibold rounded-full ${className}`}
        style={{ width: size, height: size, fontSize: size / 2.5 }}
      >
        {initials}
      </div>
    );
  }

  return (
    <OptimizedImage
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={`rounded-full object-cover ${className}`}
      fallbackSrc={fallback}
    />
  );
}

/**
 * Logo Image Component
 *
 * Optimized for logos with priority loading
 */
interface LogoImageProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
}

export function LogoImage({ src, alt, width, height, className = '' }: LogoImageProps) {
  return (
    <OptimizedImage
      src={src}
      alt={alt}
      width={width}
      height={height}
      priority={true} // Logos should load immediately
      className={className}
    />
  );
}
