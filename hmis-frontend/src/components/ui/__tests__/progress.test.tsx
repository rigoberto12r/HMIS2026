/**
 * Tests for Progress component
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { Progress } from '../progress';

describe('Progress', () => {
  describe('Rendering', () => {
    it('should render progress bar', () => {
      render(<Progress value={50} />);
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      render(<Progress value={50} className="custom-class" />);
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveClass('custom-class');
    });

    it('should render with default value of 0', () => {
      render(<Progress />);
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '0');
    });
  });

  describe('Variants', () => {
    it('should apply default variant styles', () => {
      render(<Progress value={50} />);
      const progressBar = screen.getByRole('progressbar');
      const indicator = progressBar.querySelector('div');
      expect(indicator).toHaveClass('bg-primary-500');
    });

    it('should apply success variant styles', () => {
      render(<Progress value={50} variant="success" />);
      const progressBar = screen.getByRole('progressbar');
      const indicator = progressBar.querySelector('div');
      expect(indicator).toHaveClass('bg-green-500');
    });

    it('should apply warning variant styles', () => {
      render(<Progress value={50} variant="warning" />);
      const progressBar = screen.getByRole('progressbar');
      const indicator = progressBar.querySelector('div');
      expect(indicator).toHaveClass('bg-yellow-500');
    });

    it('should apply danger variant styles', () => {
      render(<Progress value={50} variant="danger" />);
      const progressBar = screen.getByRole('progressbar');
      const indicator = progressBar.querySelector('div');
      expect(indicator).toHaveClass('bg-red-500');
    });
  });

  describe('Sizes', () => {
    it('should apply medium size by default', () => {
      render(<Progress value={50} />);
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveClass('h-2');
    });

    it('should apply small size styles', () => {
      render(<Progress value={50} size="sm" />);
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveClass('h-1');
    });

    it('should apply large size styles', () => {
      render(<Progress value={50} size="lg" />);
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveClass('h-3');
    });
  });

  describe('Progress value', () => {
    it('should set correct width based on value', () => {
      render(<Progress value={75} max={100} />);
      const progressBar = screen.getByRole('progressbar');
      const indicator = progressBar.querySelector('div') as HTMLElement;
      expect(indicator.style.width).toBe('75%');
    });

    it('should handle 0% progress', () => {
      render(<Progress value={0} />);
      const progressBar = screen.getByRole('progressbar');
      const indicator = progressBar.querySelector('div') as HTMLElement;
      expect(indicator.style.width).toBe('0%');
    });

    it('should handle 100% progress', () => {
      render(<Progress value={100} />);
      const progressBar = screen.getByRole('progressbar');
      const indicator = progressBar.querySelector('div') as HTMLElement;
      expect(indicator.style.width).toBe('100%');
    });

    it('should cap progress at 100%', () => {
      render(<Progress value={150} max={100} />);
      const progressBar = screen.getByRole('progressbar');
      const indicator = progressBar.querySelector('div') as HTMLElement;
      expect(indicator.style.width).toBe('100%');
    });

    it('should floor negative values to 0%', () => {
      render(<Progress value={-50} />);
      const progressBar = screen.getByRole('progressbar');
      const indicator = progressBar.querySelector('div') as HTMLElement;
      expect(indicator.style.width).toBe('0%');
    });

    it('should handle custom max values', () => {
      render(<Progress value={50} max={200} />);
      const progressBar = screen.getByRole('progressbar');
      const indicator = progressBar.querySelector('div') as HTMLElement;
      expect(indicator.style.width).toBe('25%');
    });

    it('should round percentage correctly', () => {
      render(<Progress value={33} max={100} />);
      const progressBar = screen.getByRole('progressbar');
      const indicator = progressBar.querySelector('div') as HTMLElement;
      expect(indicator.style.width).toBe('33%');
    });
  });

  describe('Label display', () => {
    it('should not show label by default', () => {
      render(<Progress value={50} />);
      expect(screen.queryByText('Progress')).not.toBeInTheDocument();
      expect(screen.queryByText('50%')).not.toBeInTheDocument();
    });

    it('should show label when showLabel is true', () => {
      render(<Progress value={50} showLabel />);
      expect(screen.getByText('Progress')).toBeInTheDocument();
      expect(screen.getByText('50%')).toBeInTheDocument();
    });

    it('should round percentage in label', () => {
      render(<Progress value={66.6} showLabel />);
      expect(screen.getByText('67%')).toBeInTheDocument();
    });

    it('should show 0% when value is 0', () => {
      render(<Progress value={0} showLabel />);
      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('should show 100% when value equals max', () => {
      render(<Progress value={100} showLabel />);
      expect(screen.getByText('100%')).toBeInTheDocument();
    });
  });

  describe('ARIA attributes', () => {
    it('should have role progressbar', () => {
      render(<Progress value={50} />);
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should set aria-valuemin to 0', () => {
      render(<Progress value={50} />);
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuemin', '0');
    });

    it('should set aria-valuemax from max prop', () => {
      render(<Progress value={50} max={200} />);
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuemax', '200');
    });

    it('should set aria-valuenow from value prop', () => {
      render(<Progress value={75} />);
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '75');
    });

    it('should default aria-valuemax to 100', () => {
      render(<Progress value={50} />);
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuemax', '100');
    });
  });

  describe('Base styles', () => {
    it('should have base progress bar styles', () => {
      render(<Progress value={50} />);
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveClass('relative');
      expect(progressBar).toHaveClass('w-full');
      expect(progressBar).toHaveClass('overflow-hidden');
      expect(progressBar).toHaveClass('rounded-full');
    });

    it('should have transition on indicator', () => {
      render(<Progress value={50} />);
      const progressBar = screen.getByRole('progressbar');
      const indicator = progressBar.querySelector('div');
      expect(indicator).toHaveClass('transition-all');
      expect(indicator).toHaveClass('duration-300');
      expect(indicator).toHaveClass('ease-in-out');
    });

    it('should have rounded indicator', () => {
      render(<Progress value={50} />);
      const progressBar = screen.getByRole('progressbar');
      const indicator = progressBar.querySelector('div');
      expect(indicator).toHaveClass('rounded-full');
    });
  });

  describe('Ref forwarding', () => {
    it('should forward ref to progress bar element', () => {
      const ref = React.createRef<HTMLDivElement>();
      render(<Progress ref={ref} value={50} />);
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
      expect(ref.current?.getAttribute('role')).toBe('progressbar');
    });

    it('should allow ref methods to be called', () => {
      const ref = React.createRef<HTMLDivElement>();
      render(<Progress ref={ref} value={50} />);
      expect(ref.current?.getAttribute('aria-valuenow')).toBe('50');
    });
  });

  describe('Complex combinations', () => {
    it('should handle all props together', () => {
      render(
        <Progress
          value={80}
          max={100}
          variant="success"
          size="lg"
          showLabel
          className="custom-class"
        />
      );

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveClass('custom-class');
      expect(progressBar).toHaveClass('h-3');
      expect(screen.getByText('80%')).toBeInTheDocument();

      const indicator = progressBar.querySelector('div') as HTMLElement;
      expect(indicator).toHaveClass('bg-green-500');
      expect(indicator.style.width).toBe('80%');
    });

    it('should combine variant and size correctly', () => {
      render(<Progress value={60} variant="warning" size="sm" />);
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveClass('h-1');

      const indicator = progressBar.querySelector('div');
      expect(indicator).toHaveClass('bg-yellow-500');
    });
  });

  describe('Edge cases', () => {
    it('should handle decimal values', () => {
      render(<Progress value={33.333} />);
      const progressBar = screen.getByRole('progressbar');
      const indicator = progressBar.querySelector('div') as HTMLElement;
      expect(indicator.style.width).toBe('33.333%');
    });

    it('should handle undefined variant gracefully', () => {
      render(<Progress value={50} variant={undefined} />);
      const progressBar = screen.getByRole('progressbar');
      const indicator = progressBar.querySelector('div');
      expect(indicator).toHaveClass('bg-primary-500'); // Should use default
    });

    it('should handle max value of 0', () => {
      render(<Progress value={0} max={0} />);
      const progressBar = screen.getByRole('progressbar');
      const indicator = progressBar.querySelector('div') as HTMLElement;
      // Division by zero results in NaN, which becomes 0%
      // The component clamps to 0-100%, so NaN becomes 0
      expect(indicator.style.width).toMatch(/^(0%|)$/);
    });
  });

  describe('Display name', () => {
    it('should have correct display name', () => {
      expect(Progress.displayName).toBe('Progress');
    });
  });
});
