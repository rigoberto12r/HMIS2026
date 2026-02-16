/**
 * Tests for Select component
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../select';

describe('Select (Native)', () => {
  describe('Rendering', () => {
    it('should render select element', () => {
      render(
        <Select>
          <option value="">Choose</option>
        </Select>
      );
      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
      expect(select.tagName).toBe('SELECT');
    });

    it('should apply custom className', () => {
      render(
        <Select className="custom-class">
          <option value="">Choose</option>
        </Select>
      );
      const select = screen.getByRole('combobox');
      expect(select).toHaveClass('custom-class');
    });

    it('should render options', () => {
      render(
        <Select>
          <option value="1">Option 1</option>
          <option value="2">Option 2</option>
          <option value="3">Option 3</option>
        </Select>
      );
      expect(screen.getByText('Option 1')).toBeInTheDocument();
      expect(screen.getByText('Option 2')).toBeInTheDocument();
      expect(screen.getByText('Option 3')).toBeInTheDocument();
    });
  });

  describe('Label', () => {
    it('should not render label when not provided', () => {
      render(
        <Select>
          <option value="">Choose</option>
        </Select>
      );
      expect(screen.queryByText('Label')).not.toBeInTheDocument();
    });

    it('should render label when provided', () => {
      render(
        <Select label="Country">
          <option value="">Choose</option>
        </Select>
      );
      expect(screen.getByText('Country')).toBeInTheDocument();
    });

    it('should associate label with select using htmlFor', () => {
      render(
        <Select label="Status" id="status-select">
          <option value="">Choose</option>
        </Select>
      );
      const label = screen.getByText('Status');
      const select = screen.getByRole('combobox');
      expect(label).toHaveAttribute('for', 'status-select');
      expect(select).toHaveAttribute('id', 'status-select');
    });

    it('should use name as id when id is not provided', () => {
      render(
        <Select label="Type" name="item-type">
          <option value="">Choose</option>
        </Select>
      );
      const select = screen.getByRole('combobox');
      expect(select).toHaveAttribute('id', 'item-type');
    });

    it('should show asterisk for required field', () => {
      render(
        <Select label="Required Field" required>
          <option value="">Choose</option>
        </Select>
      );
      expect(screen.getByText('*')).toBeInTheDocument();
    });

    it('should not show asterisk for non-required field', () => {
      render(
        <Select label="Optional Field">
          <option value="">Choose</option>
        </Select>
      );
      expect(screen.queryByText('*')).not.toBeInTheDocument();
    });
  });

  describe('Error state', () => {
    it('should not show error by default', () => {
      render(
        <Select>
          <option value="">Choose</option>
        </Select>
      );
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('should display error message', () => {
      render(
        <Select error="This field is required" id="test">
          <option value="">Choose</option>
        </Select>
      );
      expect(screen.getByText('This field is required')).toBeInTheDocument();
    });

    it('should apply error styles', () => {
      render(
        <Select error="Error message">
          <option value="">Choose</option>
        </Select>
      );
      const select = screen.getByRole('combobox');
      expect(select).toHaveClass('border-medical-red');
      expect(select).toHaveClass('focus:border-medical-red');
    });

    it('should set aria-invalid when error exists', () => {
      render(
        <Select error="Error">
          <option value="">Choose</option>
        </Select>
      );
      const select = screen.getByRole('combobox');
      expect(select).toHaveAttribute('aria-invalid', 'true');
    });

    it('should associate error with select using aria-describedby', () => {
      render(
        <Select error="Error message" id="test">
          <option value="">Choose</option>
        </Select>
      );
      const select = screen.getByRole('combobox');
      expect(select).toHaveAttribute('aria-describedby', 'test-error');
    });

    it('should not set aria-invalid when no error', () => {
      render(
        <Select>
          <option value="">Choose</option>
        </Select>
      );
      const select = screen.getByRole('combobox');
      expect(select).toHaveAttribute('aria-invalid', 'false');
    });
  });

  describe('Helper text', () => {
    it('should not show helper text by default', () => {
      render(
        <Select>
          <option value="">Choose</option>
        </Select>
      );
      expect(screen.queryByText(/helper/i)).not.toBeInTheDocument();
    });

    it('should display helper text', () => {
      render(
        <Select helperText="Choose your country" id="test">
          <option value="">Choose</option>
        </Select>
      );
      expect(screen.getByText('Choose your country')).toBeInTheDocument();
    });

    it('should not show helper text when error exists', () => {
      render(
        <Select
          error="Error message"
          helperText="This should not be shown"
          id="test"
        >
          <option value="">Choose</option>
        </Select>
      );
      expect(screen.getByText('Error message')).toBeInTheDocument();
      expect(screen.queryByText('This should not be shown')).not.toBeInTheDocument();
    });

    it('should associate helper text with select using aria-describedby', () => {
      render(
        <Select helperText="Helper text" id="test">
          <option value="">Choose</option>
        </Select>
      );
      const select = screen.getByRole('combobox');
      expect(select).toHaveAttribute('aria-describedby', 'test-helper');
    });
  });

  describe('Value and onChange', () => {
    it('should accept initial value', () => {
      render(
        <Select value="2" onChange={() => {}}>
          <option value="1">Option 1</option>
          <option value="2">Option 2</option>
        </Select>
      );
      const select = screen.getByRole('combobox') as HTMLSelectElement;
      expect(select.value).toBe('2');
    });

    it('should call onChange when selection changes', () => {
      const handleChange = jest.fn();
      render(
        <Select onChange={handleChange}>
          <option value="1">Option 1</option>
          <option value="2">Option 2</option>
        </Select>
      );
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: '2' } });
      expect(handleChange).toHaveBeenCalledTimes(1);
    });

    it('should update controlled value', () => {
      const handleChange = jest.fn();
      const { rerender } = render(
        <Select value="1" onChange={handleChange}>
          <option value="1">Option 1</option>
          <option value="2">Option 2</option>
        </Select>
      );
      const select = screen.getByRole('combobox') as HTMLSelectElement;
      expect(select.value).toBe('1');

      rerender(
        <Select value="2" onChange={handleChange}>
          <option value="1">Option 1</option>
          <option value="2">Option 2</option>
        </Select>
      );
      expect(select.value).toBe('2');
    });
  });

  describe('Radix-style onValueChange (Dual API)', () => {
    it('should call onValueChange when selection changes', () => {
      const handleValueChange = jest.fn();
      render(
        <Select onValueChange={handleValueChange}>
          <option value="1">Option 1</option>
          <option value="2">Option 2</option>
        </Select>
      );
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: '2' } });
      expect(handleValueChange).toHaveBeenCalledWith('2');
    });

    it('should call both onChange and onValueChange', () => {
      const handleChange = jest.fn();
      const handleValueChange = jest.fn();
      render(
        <Select onChange={handleChange} onValueChange={handleValueChange}>
          <option value="1">Option 1</option>
          <option value="2">Option 2</option>
        </Select>
      );
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: '2' } });
      expect(handleChange).toHaveBeenCalledTimes(1);
      expect(handleValueChange).toHaveBeenCalledWith('2');
    });

    it('should work with only onValueChange (no onChange)', () => {
      const handleValueChange = jest.fn();
      render(
        <Select onValueChange={handleValueChange}>
          <option value="1">Option 1</option>
          <option value="2">Option 2</option>
        </Select>
      );
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: '2' } });
      expect(handleValueChange).toHaveBeenCalledWith('2');
    });
  });

  describe('Disabled state', () => {
    it('should be disabled when disabled prop is true', () => {
      render(
        <Select disabled>
          <option value="">Choose</option>
        </Select>
      );
      const select = screen.getByRole('combobox');
      expect(select).toBeDisabled();
    });

    it('should apply disabled styles', () => {
      render(
        <Select disabled>
          <option value="">Choose</option>
        </Select>
      );
      const select = screen.getByRole('combobox');
      expect(select).toHaveClass('disabled:bg-neutral-50');
      expect(select).toHaveClass('disabled:cursor-not-allowed');
    });

    it('should be disabled and have disabled attribute', () => {
      const handleChange = jest.fn();
      render(
        <Select disabled onChange={handleChange}>
          <option value="1">Option 1</option>
          <option value="2">Option 2</option>
        </Select>
      );
      const select = screen.getByRole('combobox');
      expect(select).toBeDisabled();
      expect(select).toHaveAttribute('disabled');
    });
  });

  describe('HTML attributes', () => {
    it('should accept name attribute', () => {
      render(
        <Select name="country">
          <option value="">Choose</option>
        </Select>
      );
      const select = screen.getByRole('combobox');
      expect(select).toHaveAttribute('name', 'country');
    });

    it('should accept data attributes', () => {
      render(
        <Select data-testid="custom-select">
          <option value="">Choose</option>
        </Select>
      );
      expect(screen.getByTestId('custom-select')).toBeInTheDocument();
    });

    it('should accept required attribute', () => {
      render(
        <Select required>
          <option value="">Choose</option>
        </Select>
      );
      const select = screen.getByRole('combobox');
      expect(select).toBeRequired();
    });

    it('should accept multiple attribute', () => {
      render(
        <Select multiple>
          <option value="1">Option 1</option>
          <option value="2">Option 2</option>
        </Select>
      );
      const select = screen.getByRole('listbox');
      expect(select).toHaveAttribute('multiple');
    });
  });

  describe('Base styles', () => {
    it('should have base select styles', () => {
      render(
        <Select>
          <option value="">Choose</option>
        </Select>
      );
      const select = screen.getByRole('combobox');
      expect(select).toHaveClass('form-select');
      expect(select).toHaveClass('w-full');
      expect(select).toHaveClass('rounded-lg');
      expect(select).toHaveClass('border');
    });

    it('should have focus styles', () => {
      render(
        <Select>
          <option value="">Choose</option>
        </Select>
      );
      const select = screen.getByRole('combobox');
      expect(select).toHaveClass('focus:border-primary-500');
      expect(select).toHaveClass('focus:ring-2');
    });
  });

  describe('Ref forwarding', () => {
    it('should forward ref to select element', () => {
      const ref = React.createRef<HTMLSelectElement>();
      render(
        <Select ref={ref}>
          <option value="">Choose</option>
        </Select>
      );
      expect(ref.current).toBeInstanceOf(HTMLSelectElement);
    });

    it('should allow ref methods to be called', () => {
      const ref = React.createRef<HTMLSelectElement>();
      render(
        <Select ref={ref}>
          <option value="">Choose</option>
        </Select>
      );
      expect(ref.current?.tagName).toBe('SELECT');
    });

    it('should be able to focus select via ref', () => {
      const ref = React.createRef<HTMLSelectElement>();
      render(
        <Select ref={ref}>
          <option value="">Choose</option>
        </Select>
      );
      ref.current?.focus();
      expect(ref.current).toHaveFocus();
    });
  });

  describe('Complex combinations', () => {
    it('should handle all props together', () => {
      const handleChange = jest.fn();
      const handleValueChange = jest.fn();
      render(
        <Select
          label="Status"
          id="status"
          value="active"
          onChange={handleChange}
          onValueChange={handleValueChange}
          helperText="Select current status"
          required
          className="custom-class"
        >
          <option value="">Choose</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </Select>
      );

      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('*')).toBeInTheDocument();
      expect(screen.getByText('Select current status')).toBeInTheDocument();

      const select = screen.getByRole('combobox') as HTMLSelectElement;
      expect(select).toHaveClass('custom-class');
      expect(select.value).toBe('active');
      expect(select).toBeRequired();

      fireEvent.change(select, { target: { value: 'inactive' } });
      expect(handleChange).toHaveBeenCalled();
      expect(handleValueChange).toHaveBeenCalledWith('inactive');
    });
  });

  describe('Display name', () => {
    it('should have correct display name', () => {
      expect(Select.displayName).toBe('Select');
    });
  });
});

describe('Radix-style Select Components', () => {
  describe('SelectTrigger', () => {
    it('should render as button', () => {
      render(<SelectTrigger>Trigger</SelectTrigger>);
      const trigger = screen.getByRole('button');
      expect(trigger).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      render(<SelectTrigger className="custom">Trigger</SelectTrigger>);
      const trigger = screen.getByRole('button');
      expect(trigger).toHaveClass('custom');
    });

    it('should have base styles', () => {
      render(<SelectTrigger>Trigger</SelectTrigger>);
      const trigger = screen.getByRole('button');
      expect(trigger).toHaveClass('flex');
      expect(trigger).toHaveClass('items-center');
      expect(trigger).toHaveClass('justify-between');
    });

    it('should forward ref', () => {
      const ref = React.createRef<HTMLButtonElement>();
      render(<SelectTrigger ref={ref}>Trigger</SelectTrigger>);
      expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    });

    it('should have display name', () => {
      expect(SelectTrigger.displayName).toBe('SelectTrigger');
    });
  });

  describe('SelectValue', () => {
    it('should render placeholder', () => {
      render(<SelectValue placeholder="Select option" />);
      expect(screen.getByText('Select option')).toBeInTheDocument();
    });

    it('should have placeholder styles', () => {
      render(<SelectValue placeholder="Select" />);
      const value = screen.getByText('Select');
      expect(value).toHaveClass('text-surface-500');
    });
  });

  describe('SelectContent', () => {
    it('should render children', () => {
      render(
        <SelectContent>
          <div>Content</div>
        </SelectContent>
      );
      expect(screen.getByText('Content')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      const { container } = render(
        <SelectContent className="custom">
          <div>Content</div>
        </SelectContent>
      );
      const selectContent = container.firstChild as HTMLElement;
      expect(selectContent).toHaveClass('custom');
    });

    it('should have base styles', () => {
      const { container } = render(
        <SelectContent>
          <div>Content</div>
        </SelectContent>
      );
      const selectContent = container.firstChild as HTMLElement;
      expect(selectContent).toHaveClass('rounded-lg');
      expect(selectContent).toHaveClass('border');
    });
  });

  describe('SelectItem', () => {
    it('should render with value', () => {
      render(<SelectItem value="option1">Option 1</SelectItem>);
      expect(screen.getByText('Option 1')).toBeInTheDocument();
    });

    it('should have data-value attribute', () => {
      render(<SelectItem value="test-value">Test</SelectItem>);
      const item = screen.getByText('Test');
      expect(item).toHaveAttribute('data-value', 'test-value');
    });

    it('should apply custom className', () => {
      render(
        <SelectItem value="option" className="custom">
          Option
        </SelectItem>
      );
      const item = screen.getByText('Option');
      expect(item).toHaveClass('custom');
    });

    it('should have base styles', () => {
      render(<SelectItem value="option">Option</SelectItem>);
      const item = screen.getByText('Option');
      expect(item).toHaveClass('cursor-pointer');
      expect(item).toHaveClass('rounded-sm');
    });

    it('should have hover styles', () => {
      render(<SelectItem value="option">Option</SelectItem>);
      const item = screen.getByText('Option');
      expect(item).toHaveClass('hover:bg-surface-100');
    });
  });
});
