/** @type {import('next').NextConfig} */
// Bundle analyzer is optional - only load if installed
let withBundleAnalyzer;
try {
  withBundleAnalyzer = require('@next/bundle-analyzer')({
    enabled: process.env.ANALYZE === 'true',
  });
} catch (e) {
  // Bundle analyzer not installed, use passthrough
  withBundleAnalyzer = (config) => config;
}

const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',

  // Skip type checking during build (CI runs tsc separately)
  typescript: {
    ignoreBuildErrors: true,
  },

  // Performance optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
    // React compiler optimizations (future)
    reactRemoveProperties: process.env.NODE_ENV === 'production' ? { properties: ['^data-testid$'] } : false,
  },

  // Compress responses
  compress: true,

  // Experimental features for better performance
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'recharts',
      '@tanstack/react-query',
      'framer-motion',
      'date-fns',
      'sonner',
      'react-hook-form',
    ],
    // Optimize CSS imports
    optimizeCss: true,
    // Enable partial prerendering for better performance
    ppr: false, // Set to true when stable
  },

  // Production source maps (smaller)
  productionBrowserSourceMaps: false,

  // Reduce bundle size
  poweredByHeader: false,

  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1',
  },

  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
  },

  // Headers for caching and performance
  async headers() {
    return [
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/fonts/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },

  async redirects() {
    return [
      {
        source: '/',
        destination: '/auth/login',
        permanent: false,
      },
    ];
  },

  // Webpack optimizations
  webpack: (config, { isServer }) => {
    // Optimize bundle splitting
    if (!isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          default: false,
          vendors: false,
          // Vendor chunk for react/next
          framework: {
            name: 'framework',
            chunks: 'all',
            test: /(?<!node_modules.*)[\\/]node_modules[\\/](react|react-dom|scheduler|prop-types|use-subscription)[\\/]/,
            priority: 40,
            enforce: true,
          },
          // Separate chunk for recharts (heavy charting library)
          recharts: {
            name: 'recharts',
            test: /[\\/]node_modules[\\/](recharts|d3-[\w-]+)[\\/]/,
            priority: 35,
            reuseExistingChunk: true,
          },
          // Separate chunk for DICOM libraries (very heavy, optional deps)
          dicom: {
            name: 'dicom',
            test: /[\\/]node_modules[\\/](cornerstone-core|cornerstone-wado-image-loader|dicom-parser)[\\/]/,
            priority: 35,
            reuseExistingChunk: true,
          },
          // Separate chunk for TipTap (rich text editor)
          tiptap: {
            name: 'tiptap',
            test: /[\\/]node_modules[\\/](@tiptap|prosemirror-[\w-]+)[\\/]/,
            priority: 35,
            reuseExistingChunk: true,
          },
          // Separate chunk for large libraries
          lib: {
            test(module) {
              return (
                module.size() > 160000 &&
                /node_modules[/\\]/.test(module.identifier())
              );
            },
            name(module) {
              const hash = require('crypto')
                .createHash('sha1')
                .update(module.identifier())
                .digest('hex')
                .substring(0, 8);
              return hash;
            },
            priority: 30,
            minChunks: 1,
            reuseExistingChunk: true,
          },
          // UI components chunk
          commons: {
            name: 'commons',
            chunks: 'all',
            minChunks: 2,
            priority: 20,
          },
          // Shared chunk
          shared: {
            name: 'shared',
            chunks: 'all',
            minChunks: 2,
            priority: 10,
            reuseExistingChunk: true,
            enforce: true,
          },
        },
      };

      // Reduce module concatenation overhead
      config.optimization.concatenateModules = true;

      // Tree shaking is enabled by default in Next.js 16
      // Note: usedExports conflicts with cacheUnaffected (Next.js 16 default)
      config.optimization.sideEffects = true;
    }

    return config;
  },
};

module.exports = withBundleAnalyzer(nextConfig);
