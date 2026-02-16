/**
 * Tests for Label component
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { Label } from '../label';

describe('Label', () => {
  describe('Rendering', () => {
    it('should render label with children', () => {
      render(<Label>Username</Label>);
      expect(screen.getByText('Username')).toBeInTheDocument();
    });

    it('should render as label element', () => {
      render(<Label>Email</Label>);
      const label = screen.getByText('Email');
      expect(label.tagName).toBe('LABEL');
    });

    it('should apply custom className', () => {
      render(<Label className="custom-class">Password</Label>);
      const label = screen.getByText('Password');
      expect(label).toHaveClass('custom-class');
    });
  });

  describe('Required indicator', () => {
    it('should not show asterisk by default', () => {
      render(<Label>Optional Field</Label>);
      expect(screen.queryByText('*')).not.toBeInTheDocument();
    });

    it('should show asterisk when required is true', () => {
      render(<Label required>Required Field</Label>);
      expect(screen.getByText('*')).toBeInTheDocument();
    });

    it('should render asterisk with red color', () => {
      render(<Label required>Required Field</Label>);
      const asterisk = screen.getByText('*');
      expect(asterisk).toHaveClass('text-red-500');
    });

    it('should show both label text and asterisk', () => {
      render(<Label required>Full Name</Label>);
      expect(screen.getByText('Full Name')).toBeInTheDocument();
      expect(screen.getByText('*')).toBeInTheDocument();
    });
  });

  describe('HTML attributes', () => {
    it('should accept htmlFor attribute', () => {
      render(<Label htmlFor="email-input">Email</Label>);
      const label = screen.getByText('Email');
      expect(label).toHaveAttribute('for', 'email-input');
    });

    it('should accept id attribute', () => {
      render(<Label id="custom-id">Label</Label>);
      const label = screen.getByText('Label');
      expect(label).toHaveAttribute('id', 'custom-id');
    });

    it('should accept data attributes', () => {
      render(<Label data-testid="custom-label">Label</Label>);
      expect(screen.getByTestId('custom-label')).toBeInTheDocument();
    });

    it('should accept aria attributes', () => {
      render(<Label aria-label="Custom aria label">Label</Label>);
      const label = screen.getByText('Label');
      expect(label).toHaveAttribute('aria-label', 'Custom aria label');
    });
  });

  describe('Base styles', () => {
    it('should have base label styles', () => {
      render(<Label>Label</Label>);
      const label = screen.getByText('Label');
      expect(label).toHaveClass('block');
      expect(label).toHaveClass('text-sm');
      expect(label).toHaveClass('font-medium');
      expect(label).toHaveClass('mb-1.5');
    });

    it('should have light mode text color', () => {
      render(<Label>Label</Label>);
      const label = screen.getByText('Label');
      expect(label).toHaveClass('text-surface-700');
    });

    it('should have dark mode text color', () => {
      render(<Label>Label</Label>);
      const label = screen.getByText('Label');
      expect(label).toHaveClass('dark:text-surface-300');
    });
  });

  describe('Ref forwarding', () => {
    it('should forward ref to label element', () => {
      const ref = React.createRef<HTMLLabelElement>();
      render(<Label ref={ref}>Label</Label>);
      expect(ref.current).toBeInstanceOf(HTMLLabelElement);
    });

    it('should allow ref methods to be called', () => {
      const ref = React.createRef<HTMLLabelElement>();
      render(<Label ref={ref}>Label</Label>);
      expect(ref.current?.tagName).toBe('LABEL');
    });

    it('should be able to focus label via ref', () => {
      const ref = React.createRef<HTMLLabelElement>();
      render(<Label ref={ref} tabIndex={0}>Label</Label>);
      ref.current?.focus();
      expect(ref.current).toHaveFocus();
    });
  });

  describe('Complex combinations', () => {
    it('should handle all props together', () => {
      render(
        <Label
          htmlFor="username"
          required
          className="custom-class"
          data-testid="username-label"
        >
          Username
        </Label>
      );

      const label = screen.getByTestId('username-label');
      expect(label).toHaveClass('custom-class');
      expect(label).toHaveAttribute('for', 'username');
      expect(screen.getByText('Username')).toBeInTheDocument();
      expect(screen.getByText('*')).toBeInTheDocument();
    });

    it('should merge custom className with base styles', () => {
      render(<Label className="text-lg">Custom Size</Label>);
      const label = screen.getByText('Custom Size');
      expect(label).toHaveClass('text-lg');
      expect(label).toHaveClass('block');
      expect(label).toHaveClass('font-medium');
    });
  });

  describe('Children handling', () => {
    it('should render string children', () => {
      render(<Label>Simple text</Label>);
      expect(screen.getByText('Simple text')).toBeInTheDocument();
    });

    it('should render JSX children', () => {
      render(
        <Label>
          <span>Complex</span> <strong>Label</strong>
        </Label>
      );
      expect(screen.getByText('Complex')).toBeInTheDocument();
      expect(screen.getByText('Label')).toBeInTheDocument();
    });

    it('should render with React fragments', () => {
      render(
        <Label>
          <>Field Name</>
        </Label>
      );
      expect(screen.getByText('Field Name')).toBeInTheDocument();
    });

    it('should render empty children', () => {
      const { container } = render(<Label></Label>);
      const label = container.querySelector('label');
      expect(label).toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('should handle required with undefined', () => {
      render(<Label required={undefined}>Label</Label>);
      expect(screen.queryByText('*')).not.toBeInTheDocument();
    });

    it('should handle required with false', () => {
      render(<Label required={false}>Label</Label>);
      expect(screen.queryByText('*')).not.toBeInTheDocument();
    });

    it('should handle very long label text', () => {
      const longText = 'This is a very long label text that might wrap to multiple lines in the UI';
      render(<Label>{longText}</Label>);
      expect(screen.getByText(longText)).toBeInTheDocument();
    });

    it('should handle special characters in label', () => {
      render(<Label>Email (required)*</Label>);
      expect(screen.getByText('Email (required)*')).toBeInTheDocument();
    });
  });

  describe('Display name', () => {
    it('should have correct display name', () => {
      expect(Label.displayName).toBe('Label');
    });
  });
});
