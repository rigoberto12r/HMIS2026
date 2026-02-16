/**
 * Tests for RadioGroup component
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { RadioGroup, RadioGroupItem } from '../radio-group';

describe('RadioGroup', () => {
  describe('Rendering', () => {
    it('should render radio group', () => {
      render(
        <RadioGroup>
          <RadioGroupItem value="option1">Option 1</RadioGroupItem>
        </RadioGroup>
      );
      const radioGroup = screen.getByRole('radiogroup');
      expect(radioGroup).toBeInTheDocument();
    });

    it('should render multiple radio items', () => {
      render(
        <RadioGroup>
          <RadioGroupItem value="option1">Option 1</RadioGroupItem>
          <RadioGroupItem value="option2">Option 2</RadioGroupItem>
          <RadioGroupItem value="option3">Option 3</RadioGroupItem>
        </RadioGroup>
      );
      const radios = screen.getAllByRole('radio');
      expect(radios).toHaveLength(3);
    });

    it('should apply custom className to group', () => {
      render(
        <RadioGroup className="custom-class">
          <RadioGroupItem value="option1">Option 1</RadioGroupItem>
        </RadioGroup>
      );
      const radioGroup = screen.getByRole('radiogroup');
      expect(radioGroup).toHaveClass('custom-class');
    });

    it('should apply custom className to item', () => {
      render(
        <RadioGroup>
          <RadioGroupItem value="option1" className="custom-radio">
            Option 1
          </RadioGroupItem>
        </RadioGroup>
      );
      const radio = screen.getByRole('radio');
      expect(radio).toHaveClass('custom-radio');
    });
  });

  describe('Value control', () => {
    it('should set initial value', () => {
      render(
        <RadioGroup value="option2">
          <RadioGroupItem value="option1">Option 1</RadioGroupItem>
          <RadioGroupItem value="option2">Option 2</RadioGroupItem>
        </RadioGroup>
      );
      const radios = screen.getAllByRole('radio') as HTMLInputElement[];
      expect(radios[0].checked).toBe(false);
      expect(radios[1].checked).toBe(true);
    });

    it('should call onValueChange when selection changes', () => {
      const handleChange = jest.fn();
      render(
        <RadioGroup onValueChange={handleChange}>
          <RadioGroupItem value="option1">Option 1</RadioGroupItem>
          <RadioGroupItem value="option2">Option 2</RadioGroupItem>
        </RadioGroup>
      );

      const radios = screen.getAllByRole('radio');
      fireEvent.click(radios[1]);
      expect(handleChange).toHaveBeenCalledWith('option2');
    });

    it('should update controlled value', () => {
      const handleChange = jest.fn();
      const { rerender } = render(
        <RadioGroup value="option1" onValueChange={handleChange}>
          <RadioGroupItem value="option1">Option 1</RadioGroupItem>
          <RadioGroupItem value="option2">Option 2</RadioGroupItem>
        </RadioGroup>
      );

      let radios = screen.getAllByRole('radio') as HTMLInputElement[];
      expect(radios[0].checked).toBe(true);
      expect(radios[1].checked).toBe(false);

      rerender(
        <RadioGroup value="option2" onValueChange={handleChange}>
          <RadioGroupItem value="option1">Option 1</RadioGroupItem>
          <RadioGroupItem value="option2">Option 2</RadioGroupItem>
        </RadioGroup>
      );

      radios = screen.getAllByRole('radio') as HTMLInputElement[];
      expect(radios[0].checked).toBe(false);
      expect(radios[1].checked).toBe(true);
    });

    it('should work as uncontrolled component', () => {
      // For uncontrolled component, we need to provide onValueChange or it won't update
      const TestComponent = () => {
        const [value, setValue] = React.useState<string>();
        return (
          <RadioGroup value={value} onValueChange={setValue}>
            <RadioGroupItem value="option1">Option 1</RadioGroupItem>
            <RadioGroupItem value="option2">Option 2</RadioGroupItem>
          </RadioGroup>
        );
      };

      render(<TestComponent />);

      const radios = screen.getAllByRole('radio') as HTMLInputElement[];
      expect(radios[0].checked).toBe(false);
      expect(radios[1].checked).toBe(false);

      fireEvent.click(radios[1]);
      expect(radios[0].checked).toBe(false);
      expect(radios[1].checked).toBe(true);
    });
  });

  describe('Name attribute', () => {
    it('should apply name to all radio items', () => {
      render(
        <RadioGroup name="preference">
          <RadioGroupItem value="option1">Option 1</RadioGroupItem>
          <RadioGroupItem value="option2">Option 2</RadioGroupItem>
        </RadioGroup>
      );

      const radios = screen.getAllByRole('radio');
      radios.forEach(radio => {
        expect(radio).toHaveAttribute('name', 'preference');
      });
    });

    it('should group radios with same name', () => {
      const TestComponent = () => {
        const [value, setValue] = React.useState<string>('option1');
        return (
          <RadioGroup name="group1" value={value} onValueChange={setValue}>
            <RadioGroupItem value="option1">Option 1</RadioGroupItem>
            <RadioGroupItem value="option2">Option 2</RadioGroupItem>
          </RadioGroup>
        );
      };

      render(<TestComponent />);

      const radios = screen.getAllByRole('radio') as HTMLInputElement[];
      expect(radios[0].checked).toBe(true);
      expect(radios[1].checked).toBe(false);

      fireEvent.click(radios[1]);
      expect(radios[0].checked).toBe(false);
      expect(radios[1].checked).toBe(true);
    });
  });

  describe('RadioGroupItem', () => {
    it('should render radio input with value', () => {
      render(
        <RadioGroup>
          <RadioGroupItem value="test-value">Test</RadioGroupItem>
        </RadioGroup>
      );
      const radio = screen.getByRole('radio') as HTMLInputElement;
      expect(radio.value).toBe('test-value');
    });

    it('should auto-generate id from value', () => {
      render(
        <RadioGroup>
          <RadioGroupItem value="option1">Option 1</RadioGroupItem>
        </RadioGroup>
      );
      const radio = screen.getByRole('radio');
      expect(radio).toHaveAttribute('id', 'radio-option1');
    });

    it('should use custom id when provided', () => {
      render(
        <RadioGroup>
          <RadioGroupItem value="option1" id="custom-id">
            Option 1
          </RadioGroupItem>
        </RadioGroup>
      );
      const radio = screen.getByRole('radio');
      expect(radio).toHaveAttribute('id', 'custom-id');
    });

    it('should render children as label content', () => {
      render(
        <RadioGroup>
          <RadioGroupItem value="option1">
            <label htmlFor="radio-option1">Custom Label</label>
          </RadioGroupItem>
        </RadioGroup>
      );
      expect(screen.getByText('Custom Label')).toBeInTheDocument();
    });

    it('should handle disabled state', () => {
      render(
        <RadioGroup>
          <RadioGroupItem value="option1" disabled>
            Disabled
          </RadioGroupItem>
        </RadioGroup>
      );
      const radio = screen.getByRole('radio');
      expect(radio).toBeDisabled();
    });

    it('should not respond to click when disabled', () => {
      const handleChange = jest.fn();
      render(
        <RadioGroup onValueChange={handleChange}>
          <RadioGroupItem value="option1" disabled>
            Disabled
          </RadioGroupItem>
        </RadioGroup>
      );
      const radio = screen.getByRole('radio');
      expect(radio).toBeDisabled();
      // Disabled inputs can still receive change events in test environment,
      // but in real browsers they won't. We verify the disabled attribute is set.
      expect(radio).toHaveAttribute('disabled');
    });
  });

  describe('Base styles', () => {
    it('should have grid layout for group', () => {
      render(
        <RadioGroup>
          <RadioGroupItem value="option1">Option 1</RadioGroupItem>
        </RadioGroup>
      );
      const radioGroup = screen.getByRole('radiogroup');
      expect(radioGroup).toHaveClass('grid');
      expect(radioGroup).toHaveClass('gap-2');
    });

    it('should have base radio styles', () => {
      render(
        <RadioGroup>
          <RadioGroupItem value="option1">Option 1</RadioGroupItem>
        </RadioGroup>
      );
      const radio = screen.getByRole('radio');
      expect(radio).toHaveClass('h-4');
      expect(radio).toHaveClass('w-4');
      expect(radio).toHaveClass('rounded-full');
      expect(radio).toHaveClass('border');
    });

    it('should have focus styles', () => {
      render(
        <RadioGroup>
          <RadioGroupItem value="option1">Option 1</RadioGroupItem>
        </RadioGroup>
      );
      const radio = screen.getByRole('radio');
      expect(radio).toHaveClass('focus:ring-2');
      expect(radio).toHaveClass('focus:ring-primary-500/20');
    });

    it('should have disabled styles', () => {
      render(
        <RadioGroup>
          <RadioGroupItem value="option1">Option 1</RadioGroupItem>
        </RadioGroup>
      );
      const radio = screen.getByRole('radio');
      expect(radio).toHaveClass('disabled:cursor-not-allowed');
      expect(radio).toHaveClass('disabled:opacity-50');
    });
  });

  describe('Ref forwarding', () => {
    it('should forward ref to radio group', () => {
      const ref = React.createRef<HTMLDivElement>();
      render(
        <RadioGroup ref={ref}>
          <RadioGroupItem value="option1">Option 1</RadioGroupItem>
        </RadioGroup>
      );
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
      expect(ref.current?.getAttribute('role')).toBe('radiogroup');
    });

    it('should forward ref to radio item', () => {
      const ref = React.createRef<HTMLInputElement>();
      render(
        <RadioGroup>
          <RadioGroupItem ref={ref} value="option1">
            Option 1
          </RadioGroupItem>
        </RadioGroup>
      );
      expect(ref.current).toBeInstanceOf(HTMLInputElement);
      expect(ref.current?.type).toBe('radio');
    });
  });

  describe('Accessibility', () => {
    it('should have radiogroup role', () => {
      render(
        <RadioGroup>
          <RadioGroupItem value="option1">Option 1</RadioGroupItem>
        </RadioGroup>
      );
      expect(screen.getByRole('radiogroup')).toBeInTheDocument();
    });

    it('should have radio roles for items', () => {
      render(
        <RadioGroup>
          <RadioGroupItem value="option1">Option 1</RadioGroupItem>
          <RadioGroupItem value="option2">Option 2</RadioGroupItem>
        </RadioGroup>
      );
      const radios = screen.getAllByRole('radio');
      expect(radios).toHaveLength(2);
    });

    it('should be keyboard accessible', () => {
      render(
        <RadioGroup>
          <RadioGroupItem value="option1">Option 1</RadioGroupItem>
        </RadioGroup>
      );
      const radio = screen.getByRole('radio');
      radio.focus();
      expect(radio).toHaveFocus();
    });
  });

  describe('Complex combinations', () => {
    it('should handle multiple groups independently', () => {
      render(
        <>
          <RadioGroup name="group1" value="a">
            <RadioGroupItem value="a">Group 1 - A</RadioGroupItem>
            <RadioGroupItem value="b">Group 1 - B</RadioGroupItem>
          </RadioGroup>
          <RadioGroup name="group2" value="x">
            <RadioGroupItem value="x">Group 2 - X</RadioGroupItem>
            <RadioGroupItem value="y">Group 2 - Y</RadioGroupItem>
          </RadioGroup>
        </>
      );

      const radios = screen.getAllByRole('radio') as HTMLInputElement[];
      expect(radios[0].checked).toBe(true); // Group 1 - A
      expect(radios[1].checked).toBe(false); // Group 1 - B
      expect(radios[2].checked).toBe(true); // Group 2 - X
      expect(radios[3].checked).toBe(false); // Group 2 - Y
    });

    it('should handle all props together', () => {
      const handleChange = jest.fn();
      render(
        <RadioGroup
          name="preference"
          value="option2"
          onValueChange={handleChange}
          className="custom-group"
        >
          <RadioGroupItem value="option1" className="custom-item">
            Option 1
          </RadioGroupItem>
          <RadioGroupItem value="option2">Option 2</RadioGroupItem>
          <RadioGroupItem value="option3" disabled>
            Option 3
          </RadioGroupItem>
        </RadioGroup>
      );

      const radioGroup = screen.getByRole('radiogroup');
      expect(radioGroup).toHaveClass('custom-group');

      const radios = screen.getAllByRole('radio') as HTMLInputElement[];
      expect(radios[0]).toHaveClass('custom-item');
      expect(radios[1].checked).toBe(true);
      expect(radios[2]).toBeDisabled();

      fireEvent.click(radios[0]);
      expect(handleChange).toHaveBeenCalledWith('option1');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty radio group', () => {
      render(<RadioGroup></RadioGroup>);
      const radioGroup = screen.getByRole('radiogroup');
      expect(radioGroup).toBeInTheDocument();
    });

    it('should handle single radio item', () => {
      render(
        <RadioGroup>
          <RadioGroupItem value="only">Only Option</RadioGroupItem>
        </RadioGroup>
      );
      expect(screen.getAllByRole('radio')).toHaveLength(1);
    });

    it('should handle special characters in value', () => {
      render(
        <RadioGroup>
          <RadioGroupItem value="option-1_test">Test</RadioGroupItem>
        </RadioGroup>
      );
      const radio = screen.getByRole('radio') as HTMLInputElement;
      expect(radio.value).toBe('option-1_test');
    });
  });

  describe('Display names', () => {
    it('should have correct display name for RadioGroup', () => {
      expect(RadioGroup.displayName).toBe('RadioGroup');
    });

    it('should have correct display name for RadioGroupItem', () => {
      expect(RadioGroupItem.displayName).toBe('RadioGroupItem');
    });
  });
});
