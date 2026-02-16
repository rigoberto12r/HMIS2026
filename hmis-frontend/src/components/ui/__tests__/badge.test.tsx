/**
 * Tests for Badge component
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { Badge, StatusBadge } from '../badge';

describe('Badge', () => {
  describe('Rendering', () => {
    it('should render badge with children', () => {
      render(<Badge>Active</Badge>);
      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    it('should render as span element', () => {
      render(<Badge>Badge</Badge>);
      const badge = screen.getByText('Badge');
      expect(badge.tagName).toBe('SPAN');
    });

    it('should apply custom className', () => {
      render(<Badge className="custom-class">Badge</Badge>);
      const badge = screen.getByText('Badge');
      expect(badge).toHaveClass('custom-class');
    });
  });

  describe('Variants', () => {
    it('should apply default variant styles by default', () => {
      render(<Badge>Default</Badge>);
      const badge = screen.getByText('Default');
      expect(badge).toHaveClass('bg-surface-100');
    });

    it('should apply primary variant styles', () => {
      render(<Badge variant="primary">Primary</Badge>);
      const badge = screen.getByText('Primary');
      expect(badge).toHaveClass('bg-primary-50');
      expect(badge).toHaveClass('text-primary-700');
    });

    it('should apply secondary variant styles', () => {
      render(<Badge variant="secondary">Secondary</Badge>);
      const badge = screen.getByText('Secondary');
      expect(badge).toHaveClass('bg-accent-50');
      expect(badge).toHaveClass('text-accent-700');
    });

    it('should apply success variant styles', () => {
      render(<Badge variant="success">Success</Badge>);
      const badge = screen.getByText('Success');
      expect(badge).toHaveClass('bg-green-50');
      expect(badge).toHaveClass('text-green-700');
    });

    it('should apply warning variant styles', () => {
      render(<Badge variant="warning">Warning</Badge>);
      const badge = screen.getByText('Warning');
      expect(badge).toHaveClass('bg-yellow-50');
      expect(badge).toHaveClass('text-yellow-700');
    });

    it('should apply danger variant styles', () => {
      render(<Badge variant="danger">Danger</Badge>);
      const badge = screen.getByText('Danger');
      expect(badge).toHaveClass('bg-red-50');
      expect(badge).toHaveClass('text-red-700');
    });

    it('should apply destructive variant styles (Radix compatibility)', () => {
      render(<Badge variant="destructive">Destructive</Badge>);
      const badge = screen.getByText('Destructive');
      expect(badge).toHaveClass('bg-red-50');
      expect(badge).toHaveClass('text-red-700');
    });

    it('should apply info variant styles', () => {
      render(<Badge variant="info">Info</Badge>);
      const badge = screen.getByText('Info');
      expect(badge).toHaveClass('bg-blue-50');
      expect(badge).toHaveClass('text-blue-700');
    });

    it('should apply outline variant styles', () => {
      render(<Badge variant="outline">Outline</Badge>);
      const badge = screen.getByText('Outline');
      expect(badge).toHaveClass('bg-transparent');
      expect(badge).toHaveClass('border');
    });

    it('should treat destructive same as danger', () => {
      const { container: dangerContainer } = render(
        <Badge variant="danger">Danger</Badge>
      );
      const { container: destructiveContainer } = render(
        <Badge variant="destructive">Destructive</Badge>
      );

      const dangerBadge = dangerContainer.querySelector('span');
      const destructiveBadge = destructiveContainer.querySelector('span');

      // Both should have same color classes
      expect(dangerBadge?.className).toContain('bg-red-50');
      expect(destructiveBadge?.className).toContain('bg-red-50');
    });
  });

  describe('Sizes', () => {
    it('should apply medium size by default', () => {
      render(<Badge>Medium</Badge>);
      const badge = screen.getByText('Medium');
      expect(badge).toHaveClass('text-xs');
      expect(badge).toHaveClass('px-3');
    });

    it('should apply small size styles', () => {
      render(<Badge size="sm">Small</Badge>);
      const badge = screen.getByText('Small');
      expect(badge).toHaveClass('text-2xs');
      expect(badge).toHaveClass('px-2');
    });

    it('should apply large size styles', () => {
      render(<Badge size="lg">Large</Badge>);
      const badge = screen.getByText('Large');
      expect(badge).toHaveClass('text-sm');
      expect(badge).toHaveClass('px-3.5');
    });
  });

  describe('Dot indicator', () => {
    it('should not show dot by default', () => {
      render(<Badge>No Dot</Badge>);
      const badge = screen.getByText('No Dot');
      const dot = badge.querySelector('span');
      expect(dot).not.toBeInTheDocument();
    });

    it('should show dot when dot prop is true', () => {
      render(<Badge dot>With Dot</Badge>);
      const badge = screen.getByText('With Dot');
      const dotContainer = badge.querySelector('span');
      expect(dotContainer).toBeInTheDocument();
    });

    it('should apply correct dot color for primary variant', () => {
      render(
        <Badge variant="primary" dot>
          Primary
        </Badge>
      );
      const badge = screen.getByText('Primary');
      // The dot structure is: span.relative > span.w-1.5.bg-color
      const dotContainer = badge.querySelector('span.relative');
      const dot = dotContainer?.querySelector('span.w-1\\.5');
      expect(dot).toHaveClass('bg-primary-500');
    });

    it('should apply correct dot color for danger variant', () => {
      render(
        <Badge variant="danger" dot>
          Danger
        </Badge>
      );
      const badge = screen.getByText('Danger');
      const dotContainer = badge.querySelector('span.relative');
      const dot = dotContainer?.querySelector('span.w-1\\.5');
      expect(dot).toHaveClass('bg-red-500');
    });

    it('should apply correct dot color for destructive variant', () => {
      render(
        <Badge variant="destructive" dot>
          Destructive
        </Badge>
      );
      const badge = screen.getByText('Destructive');
      const dotContainer = badge.querySelector('span.relative');
      const dot = dotContainer?.querySelector('span.w-1\\.5');
      expect(dot).toHaveClass('bg-red-500');
    });

    it('should have aria-hidden on dot', () => {
      render(<Badge dot>With Dot</Badge>);
      const badge = screen.getByText('With Dot');
      const dotContainer = badge.querySelector('span[aria-hidden="true"]');
      expect(dotContainer).toBeInTheDocument();
    });
  });

  describe('Pulse animation', () => {
    it('should not pulse by default', () => {
      render(<Badge dot>No Pulse</Badge>);
      const badge = screen.getByText('No Pulse');
      const pulseElement = badge.querySelector('.animate-ping');
      expect(pulseElement).not.toBeInTheDocument();
    });

    it('should show pulse animation when pulse is true', () => {
      render(
        <Badge dot pulse>
          Pulsing
        </Badge>
      );
      const badge = screen.getByText('Pulsing');
      const dotContainer = badge.querySelector('span.relative');
      const pulseElement = dotContainer?.querySelector('.animate-ping');
      expect(pulseElement).toBeInTheDocument();
    });

    it('should not show pulse without dot', () => {
      render(<Badge pulse>No Dot</Badge>);
      const badge = screen.getByText('No Dot');
      const pulseElement = badge.querySelector('.animate-ping');
      expect(pulseElement).not.toBeInTheDocument();
    });

    it('should apply correct color to pulse', () => {
      render(
        <Badge variant="success" dot pulse>
          Success
        </Badge>
      );
      const badge = screen.getByText('Success');
      const dotContainer = badge.querySelector('span.relative');
      const pulseElement = dotContainer?.querySelector('.animate-ping');
      expect(pulseElement).toHaveClass('bg-green-500');
    });
  });

  describe('Base styles', () => {
    it('should have base badge styles', () => {
      render(<Badge>Badge</Badge>);
      const badge = screen.getByText('Badge');
      expect(badge).toHaveClass('inline-flex');
      expect(badge).toHaveClass('items-center');
      expect(badge).toHaveClass('rounded-full');
      expect(badge).toHaveClass('font-medium');
      expect(badge).toHaveClass('whitespace-nowrap');
    });
  });

  describe('HTML attributes', () => {
    it('should accept data attributes', () => {
      render(<Badge data-testid="custom-badge">Badge</Badge>);
      expect(screen.getByTestId('custom-badge')).toBeInTheDocument();
    });

    it('should accept aria attributes', () => {
      render(<Badge aria-label="Status badge">Active</Badge>);
      const badge = screen.getByLabelText('Status badge');
      expect(badge).toBeInTheDocument();
    });

    it('should accept onClick handler', () => {
      const handleClick = jest.fn();
      render(<Badge onClick={handleClick}>Clickable</Badge>);
      const badge = screen.getByText('Clickable');
      badge.click();
      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('Complex combinations', () => {
    it('should handle all props together', () => {
      render(
        <Badge
          variant="primary"
          size="lg"
          dot
          pulse
          className="custom-class"
          data-testid="full-badge"
        >
          Full Badge
        </Badge>
      );

      const badge = screen.getByTestId('full-badge');
      expect(badge).toHaveClass('custom-class');
      expect(badge).toHaveClass('bg-primary-50');
      expect(badge).toHaveClass('text-sm');

      const dotContainer = badge.querySelector('span.relative');
      const dot = dotContainer?.querySelector('span.w-1\\.5');
      expect(dot).toHaveClass('bg-primary-500');

      const pulse = dotContainer?.querySelector('.animate-ping');
      expect(pulse).toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('should handle empty children', () => {
      const { container } = render(<Badge></Badge>);
      const badge = container.querySelector('span');
      expect(badge).toBeInTheDocument();
    });

    it('should handle long text', () => {
      const longText = 'This is a very long badge text that should not wrap';
      render(<Badge>{longText}</Badge>);
      expect(screen.getByText(longText)).toBeInTheDocument();
    });

    it('should handle undefined variant gracefully', () => {
      render(<Badge variant={undefined}>Badge</Badge>);
      const badge = screen.getByText('Badge');
      expect(badge).toHaveClass('bg-surface-100'); // Should use default
    });
  });
});

describe('StatusBadge', () => {
  describe('Predefined statuses', () => {
    it('should render pendiente status', () => {
      render(<StatusBadge status="pendiente" />);
      expect(screen.getByText('Pendiente')).toBeInTheDocument();
    });

    it('should render confirmada status', () => {
      render(<StatusBadge status="confirmada" />);
      expect(screen.getByText('Confirmada')).toBeInTheDocument();
    });

    it('should render en_progreso status with pulse', () => {
      render(<StatusBadge status="en_progreso" />);
      const badge = screen.getByText('En Progreso');
      const pulse = badge.querySelector('.animate-ping');
      expect(pulse).toBeInTheDocument();
    });

    it('should render completada status', () => {
      render(<StatusBadge status="completada" />);
      const badge = screen.getByText('Completada');
      expect(badge).toHaveClass('bg-green-50');
    });

    it('should render cancelada status', () => {
      render(<StatusBadge status="cancelada" />);
      expect(screen.getByText('Cancelada')).toBeInTheDocument();
    });

    it('should render pagada status', () => {
      render(<StatusBadge status="pagada" />);
      const badge = screen.getByText('Pagada');
      expect(badge).toHaveClass('bg-green-50');
    });

    it('should render vencida status with pulse', () => {
      render(<StatusBadge status="vencida" />);
      const badge = screen.getByText('Vencida');
      expect(badge).toHaveClass('bg-red-50');
      const pulse = badge.querySelector('.animate-ping');
      expect(pulse).toBeInTheDocument();
    });

    it('should render urgente status with pulse', () => {
      render(<StatusBadge status="urgente" />);
      const badge = screen.getByText('Urgente');
      expect(badge).toHaveClass('bg-red-50');
      const pulse = badge.querySelector('.animate-ping');
      expect(pulse).toBeInTheDocument();
    });

    it('should render activo status with pulse', () => {
      render(<StatusBadge status="activo" />);
      const badge = screen.getByText('Activo');
      const pulse = badge.querySelector('.animate-ping');
      expect(pulse).toBeInTheDocument();
    });

    it('should render dispensada status', () => {
      render(<StatusBadge status="dispensada" />);
      expect(screen.getByText('Dispensada')).toBeInTheDocument();
    });
  });

  describe('Case insensitivity', () => {
    it('should handle uppercase status', () => {
      render(<StatusBadge status="PENDIENTE" />);
      expect(screen.getByText('Pendiente')).toBeInTheDocument();
    });

    it('should handle mixed case status', () => {
      render(<StatusBadge status="PeNdIeNtE" />);
      expect(screen.getByText('Pendiente')).toBeInTheDocument();
    });
  });

  describe('Unknown status', () => {
    it('should render unknown status as-is', () => {
      const { container } = render(<StatusBadge status="custom_status" />);
      expect(screen.getByText('custom_status')).toBeInTheDocument();
    });

    it('should use default variant for unknown status', () => {
      const { container } = render(<StatusBadge status="unknown" />);
      const badge = screen.getByText('unknown');
      expect(badge).toHaveClass('bg-surface-100');
    });

    it('should not pulse for unknown status', () => {
      const { container } = render(<StatusBadge status="unknown" />);
      const badge = screen.getByText('unknown');
      const dotContainer = badge.querySelector('span.relative');
      const pulse = dotContainer?.querySelector('.animate-ping');
      expect(pulse).not.toBeInTheDocument();
    });
  });

  describe('Dot indicator', () => {
    it('should always show dot', () => {
      render(<StatusBadge status="activo" />);
      const badge = screen.getByText('Activo');
      const dotContainer = badge.querySelector('span.relative');
      expect(dotContainer).toBeInTheDocument();
    });
  });

  describe('Size', () => {
    it('should use medium size', () => {
      render(<StatusBadge status="activo" />);
      const badge = screen.getByText('Activo');
      expect(badge).toHaveClass('text-xs');
    });
  });

  describe('Custom className', () => {
    it('should accept custom className', () => {
      render(<StatusBadge status="activo" className="custom-status" />);
      const badge = screen.getByText('Activo');
      expect(badge).toHaveClass('custom-status');
    });
  });

  describe('All HMIS statuses', () => {
    const statuses = [
      'pendiente',
      'confirmada',
      'en_progreso',
      'completada',
      'cancelada',
      'pagada',
      'vencida',
      'parcial',
      'activo',
      'inactivo',
      'urgente',
      'dispensada',
      'por_dispensar',
    ];

    statuses.forEach(status => {
      it(`should render ${status} status`, () => {
        const { container } = render(<StatusBadge status={status} />);
        const badge = container.querySelector('span');
        expect(badge).toBeInTheDocument();
      });
    });
  });
});
