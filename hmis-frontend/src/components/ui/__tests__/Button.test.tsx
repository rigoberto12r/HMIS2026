/**
 * Tests for Button component
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../button';
import { User, Settings } from 'lucide-react';

describe('Button', () => {
  describe('Rendering', () => {
    it('should render button with children', () => {
      render(<Button>Click me</Button>);
      expect(screen.getByText('Click me')).toBeInTheDocument();
    });

    it('should render as button element', () => {
      render(<Button>Button</Button>);
      const button = screen.getByText('Button');
      expect(button.tagName).toBe('BUTTON');
    });

    it('should apply custom className', () => {
      render(<Button className="custom-class">Button</Button>);
      const button = screen.getByText('Button');
      expect(button).toHaveClass('custom-class');
    });
  });

  describe('Variants', () => {
    it('should apply primary variant styles by default', () => {
      render(<Button>Primary</Button>);
      const button = screen.getByText('Primary');
      expect(button).toHaveClass('bg-primary-500');
    });

    it('should apply secondary variant styles', () => {
      render(<Button variant="secondary">Secondary</Button>);
      const button = screen.getByText('Secondary');
      expect(button).toHaveClass('bg-secondary-500');
    });

    it('should apply outline variant styles', () => {
      render(<Button variant="outline">Outline</Button>);
      const button = screen.getByText('Outline');
      expect(button).toHaveClass('border');
    });

    it('should apply ghost variant styles', () => {
      render(<Button variant="ghost">Ghost</Button>);
      const button = screen.getByText('Ghost');
      expect(button).toHaveClass('text-neutral-600');
    });

    it('should apply danger variant styles', () => {
      render(<Button variant="danger">Danger</Button>);
      const button = screen.getByText('Danger');
      expect(button).toHaveClass('bg-medical-red');
    });

    it('should apply success variant styles', () => {
      render(<Button variant="success">Success</Button>);
      const button = screen.getByText('Success');
      expect(button).toHaveClass('bg-medical-green');
    });
  });

  describe('Sizes', () => {
    it('should apply medium size by default', () => {
      render(<Button>Medium</Button>);
      const button = screen.getByText('Medium');
      expect(button).toHaveClass('h-10');
    });

    it('should apply small size styles', () => {
      render(<Button size="sm">Small</Button>);
      const button = screen.getByText('Small');
      expect(button).toHaveClass('h-8');
    });

    it('should apply large size styles', () => {
      render(<Button size="lg">Large</Button>);
      const button = screen.getByText('Large');
      expect(button).toHaveClass('h-12');
    });

    it('should apply icon size styles', () => {
      render(
        <Button size="icon" aria-label="Icon button">
          <User size={20} />
        </Button>
      );
      const button = screen.getByLabelText('Icon button');
      expect(button).toHaveClass('h-10');
      expect(button).toHaveClass('w-10');
    });
  });

  describe('Icons', () => {
    it('should render left icon', () => {
      render(
        <Button leftIcon={<User data-testid="left-icon" />}>With Icon</Button>
      );
      expect(screen.getByTestId('left-icon')).toBeInTheDocument();
    });

    it('should render right icon', () => {
      render(
        <Button rightIcon={<Settings data-testid="right-icon" />}>With Icon</Button>
      );
      expect(screen.getByTestId('right-icon')).toBeInTheDocument();
    });

    it('should render both left and right icons', () => {
      render(
        <Button
          leftIcon={<User data-testid="left-icon" />}
          rightIcon={<Settings data-testid="right-icon" />}
        >
          Both Icons
        </Button>
      );
      expect(screen.getByTestId('left-icon')).toBeInTheDocument();
      expect(screen.getByTestId('right-icon')).toBeInTheDocument();
    });
  });

  describe('Loading state', () => {
    it('should show spinner when loading', () => {
      render(<Button isLoading>Loading</Button>);
      const spinner = screen.getByRole('button').querySelector('svg');
      expect(spinner).toBeInTheDocument();
      expect(spinner).toHaveClass('animate-spin');
    });

    it('should hide left icon when loading', () => {
      render(
        <Button isLoading leftIcon={<User data-testid="left-icon" />}>
          Loading
        </Button>
      );
      expect(screen.queryByTestId('left-icon')).not.toBeInTheDocument();
    });

    it('should hide right icon when loading', () => {
      render(
        <Button isLoading rightIcon={<Settings data-testid="right-icon" />}>
          Loading
        </Button>
      );
      expect(screen.queryByTestId('right-icon')).not.toBeInTheDocument();
    });

    it('should be disabled when loading', () => {
      render(<Button isLoading>Loading</Button>);
      const button = screen.getByText('Loading');
      expect(button).toBeDisabled();
    });

    it('should still show children text when loading', () => {
      render(<Button isLoading>Loading Text</Button>);
      expect(screen.getByText('Loading Text')).toBeInTheDocument();
    });
  });

  describe('Disabled state', () => {
    it('should be disabled when disabled prop is true', () => {
      render(<Button disabled>Disabled</Button>);
      const button = screen.getByText('Disabled');
      expect(button).toBeDisabled();
    });

    it('should apply disabled styles', () => {
      render(<Button disabled>Disabled</Button>);
      const button = screen.getByText('Disabled');
      expect(button).toHaveClass('disabled:opacity-50');
    });

    it('should not call onClick when disabled', () => {
      const handleClick = jest.fn();
      render(
        <Button disabled onClick={handleClick}>
          Disabled
        </Button>
      );
      const button = screen.getByText('Disabled');
      fireEvent.click(button);
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('should be disabled when both disabled and loading', () => {
      render(
        <Button disabled isLoading>
          Disabled and Loading
        </Button>
      );
      const button = screen.getByText('Disabled and Loading');
      expect(button).toBeDisabled();
    });
  });

  describe('Interactions', () => {
    it('should call onClick when clicked', () => {
      const handleClick = jest.fn();
      render(<Button onClick={handleClick}>Click me</Button>);
      const button = screen.getByText('Click me');
      fireEvent.click(button);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should not call onClick when loading', () => {
      const handleClick = jest.fn();
      render(
        <Button isLoading onClick={handleClick}>
          Loading
        </Button>
      );
      const button = screen.getByText('Loading');
      fireEvent.click(button);
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('should handle multiple clicks', () => {
      const handleClick = jest.fn();
      render(<Button onClick={handleClick}>Click me</Button>);
      const button = screen.getByText('Click me');
      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.click(button);
      expect(handleClick).toHaveBeenCalledTimes(3);
    });
  });

  describe('HTML attributes', () => {
    it('should accept type attribute', () => {
      render(<Button type="submit">Submit</Button>);
      const button = screen.getByText('Submit');
      expect(button).toHaveAttribute('type', 'submit');
    });

    it('should accept aria-label', () => {
      render(<Button aria-label="Custom label">Button</Button>);
      const button = screen.getByLabelText('Custom label');
      expect(button).toBeInTheDocument();
    });

    it('should accept data attributes', () => {
      render(<Button data-testid="custom-button">Button</Button>);
      expect(screen.getByTestId('custom-button')).toBeInTheDocument();
    });

    it('should accept id attribute', () => {
      render(<Button id="custom-id">Button</Button>);
      const button = screen.getByText('Button');
      expect(button).toHaveAttribute('id', 'custom-id');
    });

    it('should accept name attribute', () => {
      render(<Button name="button-name">Button</Button>);
      const button = screen.getByText('Button');
      expect(button).toHaveAttribute('name', 'button-name');
    });
  });

  describe('Ref forwarding', () => {
    it('should forward ref to button element', () => {
      const ref = React.createRef<HTMLButtonElement>();
      render(<Button ref={ref}>Button</Button>);
      expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    });

    it('should allow ref methods to be called', () => {
      const ref = React.createRef<HTMLButtonElement>();
      render(<Button ref={ref}>Button</Button>);
      expect(ref.current?.tagName).toBe('BUTTON');
    });
  });

  describe('Accessibility', () => {
    it('should be keyboard accessible', () => {
      const handleClick = jest.fn();
      render(<Button onClick={handleClick}>Button</Button>);
      const button = screen.getByText('Button');
      button.focus();
      expect(button).toHaveFocus();
    });

    it('should have focus styles', () => {
      render(<Button>Button</Button>);
      const button = screen.getByText('Button');
      expect(button).toHaveClass('focus-visible:outline-none');
      expect(button).toHaveClass('focus-visible:ring-2');
    });

    it('should have proper aria-hidden on loading spinner', () => {
      render(<Button isLoading>Loading</Button>);
      const spinner = screen.getByRole('button').querySelector('svg');
      expect(spinner).toHaveAttribute('aria-hidden', 'true');
    });

    it('should be accessible with icon-only button', () => {
      render(
        <Button size="icon" aria-label="Settings">
          <Settings />
        </Button>
      );
      expect(screen.getByLabelText('Settings')).toBeInTheDocument();
    });
  });

  describe('Base styles', () => {
    it('should have base button styles', () => {
      render(<Button>Button</Button>);
      const button = screen.getByText('Button');
      expect(button).toHaveClass('inline-flex');
      expect(button).toHaveClass('items-center');
      expect(button).toHaveClass('justify-center');
      expect(button).toHaveClass('rounded-lg');
      expect(button).toHaveClass('font-medium');
    });

    it('should have transition styles', () => {
      render(<Button>Button</Button>);
      const button = screen.getByText('Button');
      expect(button).toHaveClass('transition-colors');
    });
  });

  describe('Complex combinations', () => {
    it('should handle all props together', () => {
      const handleClick = jest.fn();
      render(
        <Button
          variant="secondary"
          size="lg"
          leftIcon={<User data-testid="icon" />}
          onClick={handleClick}
          className="custom-class"
          aria-label="Complex button"
        >
          Complex Button
        </Button>
      );

      const button = screen.getByText('Complex Button');
      expect(button).toHaveClass('bg-secondary-500');
      expect(button).toHaveClass('h-12');
      expect(button).toHaveClass('custom-class');
      expect(screen.getByTestId('icon')).toBeInTheDocument();

      fireEvent.click(button);
      expect(handleClick).toHaveBeenCalled();
    });

    it('should override default variant with custom className', () => {
      render(<Button className="bg-blue-500">Custom</Button>);
      const button = screen.getByText('Custom');
      // Custom classes should be merged with variant classes
      expect(button.className).toContain('bg-blue-500');
    });
  });

  describe('Edge cases', () => {
    it('should render with empty children', () => {
      render(<Button></Button>);
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });

    it('should handle undefined variant gracefully', () => {
      render(<Button variant={undefined}>Button</Button>);
      const button = screen.getByText('Button');
      expect(button).toHaveClass('bg-primary-500'); // Should use default
    });

    it('should handle null children', () => {
      render(<Button>{null}</Button>);
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });

    it('should handle React fragments as children', () => {
      render(
        <Button>
          <>Click me</>
        </Button>
      );
      expect(screen.getByText('Click me')).toBeInTheDocument();
    });
  });

  describe('Display name', () => {
    it('should have correct display name', () => {
      expect(Button.displayName).toBe('Button');
    });
  });
});
