/**
 * Tests for Textarea component
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Textarea } from '../textarea';

describe('Textarea', () => {
  describe('Rendering', () => {
    it('should render textarea element', () => {
      render(<Textarea />);
      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeInTheDocument();
      expect(textarea.tagName).toBe('TEXTAREA');
    });

    it('should apply custom className', () => {
      render(<Textarea className="custom-class" />);
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveClass('custom-class');
    });

    it('should render with placeholder', () => {
      render(<Textarea placeholder="Enter description" />);
      expect(screen.getByPlaceholderText('Enter description')).toBeInTheDocument();
    });
  });

  describe('Label', () => {
    it('should not render label when not provided', () => {
      render(<Textarea />);
      const label = screen.queryByText('Label');
      expect(label).not.toBeInTheDocument();
    });

    it('should render label when provided', () => {
      render(<Textarea label="Description" />);
      expect(screen.getByText('Description')).toBeInTheDocument();
    });

    it('should associate label with textarea using htmlFor', () => {
      render(<Textarea label="Comments" id="comments" />);
      const label = screen.getByText('Comments');
      const textarea = screen.getByRole('textbox');
      expect(label).toHaveAttribute('for', 'comments');
      expect(textarea).toHaveAttribute('id', 'comments');
    });

    it('should use name as id when id is not provided', () => {
      render(<Textarea label="Notes" name="patient-notes" />);
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveAttribute('id', 'patient-notes');
    });

    it('should show asterisk for required field', () => {
      render(<Textarea label="Required Field" required />);
      expect(screen.getByText('*')).toBeInTheDocument();
    });

    it('should not show asterisk for non-required field', () => {
      render(<Textarea label="Optional Field" />);
      expect(screen.queryByText('*')).not.toBeInTheDocument();
    });
  });

  describe('Error state', () => {
    it('should not show error by default', () => {
      render(<Textarea />);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('should display error message', () => {
      render(<Textarea error="This field is required" id="test" />);
      expect(screen.getByText('This field is required')).toBeInTheDocument();
    });

    it('should apply error styles', () => {
      render(<Textarea error="Error message" />);
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveClass('border-red-500');
      expect(textarea).toHaveClass('focus:border-red-500');
    });

    it('should set aria-invalid when error exists', () => {
      render(<Textarea error="Error" />);
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveAttribute('aria-invalid', 'true');
    });

    it('should associate error with textarea using aria-describedby', () => {
      render(<Textarea error="Error message" id="test" />);
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveAttribute('aria-describedby', 'test-error');
    });

    it('should not set aria-invalid when no error', () => {
      render(<Textarea />);
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveAttribute('aria-invalid', 'false');
    });
  });

  describe('Helper text', () => {
    it('should not show helper text by default', () => {
      render(<Textarea />);
      expect(screen.queryByText(/helper/i)).not.toBeInTheDocument();
    });

    it('should display helper text', () => {
      render(<Textarea helperText="Enter detailed description" id="test" />);
      expect(screen.getByText('Enter detailed description')).toBeInTheDocument();
    });

    it('should not show helper text when error exists', () => {
      render(
        <Textarea
          error="Error message"
          helperText="This should not be shown"
          id="test"
        />
      );
      expect(screen.getByText('Error message')).toBeInTheDocument();
      expect(screen.queryByText('This should not be shown')).not.toBeInTheDocument();
    });

    it('should associate helper text with textarea using aria-describedby', () => {
      render(<Textarea helperText="Helper text" id="test" />);
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveAttribute('aria-describedby', 'test-helper');
    });
  });

  describe('Value and onChange', () => {
    it('should accept initial value', () => {
      render(<Textarea value="Initial text" onChange={() => {}} />);
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea.value).toBe('Initial text');
    });

    it('should call onChange when text changes', () => {
      const handleChange = jest.fn();
      render(<Textarea onChange={handleChange} />);
      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'New text' } });
      expect(handleChange).toHaveBeenCalledTimes(1);
    });

    it('should update controlled value', () => {
      const handleChange = jest.fn();
      const { rerender } = render(
        <Textarea value="First" onChange={handleChange} />
      );
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea.value).toBe('First');

      rerender(<Textarea value="Second" onChange={handleChange} />);
      expect(textarea.value).toBe('Second');
    });

    it('should handle multiline text', () => {
      const multilineText = 'Line 1\nLine 2\nLine 3';
      render(<Textarea value={multilineText} onChange={() => {}} />);
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea.value).toBe(multilineText);
    });
  });

  describe('Disabled state', () => {
    it('should be disabled when disabled prop is true', () => {
      render(<Textarea disabled />);
      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeDisabled();
    });

    it('should apply disabled styles', () => {
      render(<Textarea disabled />);
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveClass('disabled:cursor-not-allowed');
      expect(textarea).toHaveClass('disabled:opacity-50');
    });

    it('should be disabled and have disabled attribute', () => {
      const handleChange = jest.fn();
      render(<Textarea disabled onChange={handleChange} />);
      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeDisabled();
      expect(textarea).toHaveAttribute('disabled');
    });
  });

  describe('HTML attributes', () => {
    it('should accept rows attribute', () => {
      render(<Textarea rows={5} />);
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveAttribute('rows', '5');
    });

    it('should accept maxLength attribute', () => {
      render(<Textarea maxLength={100} />);
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveAttribute('maxLength', '100');
    });

    it('should accept name attribute', () => {
      render(<Textarea name="description" />);
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveAttribute('name', 'description');
    });

    it('should accept data attributes', () => {
      render(<Textarea data-testid="custom-textarea" />);
      expect(screen.getByTestId('custom-textarea')).toBeInTheDocument();
    });

    it('should accept required attribute', () => {
      render(<Textarea required />);
      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeRequired();
    });

    it('should accept readOnly attribute', () => {
      render(<Textarea readOnly />);
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveAttribute('readOnly');
    });
  });

  describe('Base styles', () => {
    it('should have base textarea styles', () => {
      render(<Textarea />);
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveClass('flex');
      expect(textarea).toHaveClass('w-full');
      expect(textarea).toHaveClass('rounded-lg');
      expect(textarea).toHaveClass('border');
    });

    it('should have minimum height', () => {
      render(<Textarea />);
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveClass('min-h-[80px]');
    });

    it('should have focus styles', () => {
      render(<Textarea />);
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveClass('focus:outline-none');
      expect(textarea).toHaveClass('focus:ring-2');
      expect(textarea).toHaveClass('focus:ring-primary-500/20');
    });
  });

  describe('Ref forwarding', () => {
    it('should forward ref to textarea element', () => {
      const ref = React.createRef<HTMLTextAreaElement>();
      render(<Textarea ref={ref} />);
      expect(ref.current).toBeInstanceOf(HTMLTextAreaElement);
    });

    it('should allow ref methods to be called', () => {
      const ref = React.createRef<HTMLTextAreaElement>();
      render(<Textarea ref={ref} />);
      expect(ref.current?.tagName).toBe('TEXTAREA');
    });

    it('should be able to focus textarea via ref', () => {
      const ref = React.createRef<HTMLTextAreaElement>();
      render(<Textarea ref={ref} />);
      ref.current?.focus();
      expect(ref.current).toHaveFocus();
    });
  });

  describe('Complex combinations', () => {
    it('should handle all props together', () => {
      const handleChange = jest.fn();
      render(
        <Textarea
          label="Comments"
          id="comments"
          value="Test value"
          onChange={handleChange}
          placeholder="Enter comments"
          helperText="Max 500 characters"
          required
          rows={5}
          className="custom-class"
        />
      );

      expect(screen.getByText('Comments')).toBeInTheDocument();
      expect(screen.getByText('*')).toBeInTheDocument();
      expect(screen.getByText('Max 500 characters')).toBeInTheDocument();

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea).toHaveClass('custom-class');
      expect(textarea).toHaveAttribute('rows', '5');
      expect(textarea.value).toBe('Test value');
      expect(textarea).toBeRequired();

      fireEvent.change(textarea, { target: { value: 'New value' } });
      expect(handleChange).toHaveBeenCalled();
    });

    it('should prioritize error over helper text', () => {
      render(
        <Textarea
          label="Field"
          error="Error message"
          helperText="Helper text"
          id="test"
        />
      );

      expect(screen.getByText('Error message')).toBeInTheDocument();
      expect(screen.queryByText('Helper text')).not.toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('should handle empty value', () => {
      render(<Textarea value="" onChange={() => {}} />);
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea.value).toBe('');
    });

    it('should handle very long text', () => {
      const longText = 'a'.repeat(1000);
      render(<Textarea value={longText} onChange={() => {}} />);
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea.value).toBe(longText);
    });

    it('should handle special characters', () => {
      const specialText = 'Special: <>&"\'';
      render(<Textarea value={specialText} onChange={() => {}} />);
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea.value).toBe(specialText);
    });
  });

  describe('Display name', () => {
    it('should have correct display name', () => {
      expect(Textarea.displayName).toBe('Textarea');
    });
  });
});
