/**
 * Tests for Tabs component
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  Tabs,
  TabPanels,
  TabPanel,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '../tabs';

describe('Tabs (Array-based API)', () => {
  const mockTabs = [
    { id: 'tab1', label: 'Tab 1' },
    { id: 'tab2', label: 'Tab 2' },
    { id: 'tab3', label: 'Tab 3' },
  ];

  describe('Rendering', () => {
    it('should render tabs list', () => {
      render(<Tabs tabs={mockTabs} />);
      expect(screen.getByRole('tablist')).toBeInTheDocument();
    });

    it('should render all tab buttons', () => {
      render(<Tabs tabs={mockTabs} />);
      const tabs = screen.getAllByRole('tab');
      expect(tabs).toHaveLength(3);
      expect(screen.getByText('Tab 1')).toBeInTheDocument();
      expect(screen.getByText('Tab 2')).toBeInTheDocument();
      expect(screen.getByText('Tab 3')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      render(<Tabs tabs={mockTabs} className="custom-class" />);
      const tablist = screen.getByRole('tablist');
      expect(tablist).toHaveClass('custom-class');
    });

    it('should set first tab as active by default', () => {
      render(<Tabs tabs={mockTabs} />);
      const tabs = screen.getAllByRole('tab');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
    });
  });

  describe('Tab selection', () => {
    it('should call onTabChange when tab is clicked', () => {
      const handleTabChange = jest.fn();
      render(<Tabs tabs={mockTabs} onTabChange={handleTabChange} />);
      const tabs = screen.getAllByRole('tab');
      fireEvent.click(tabs[1]);
      expect(handleTabChange).toHaveBeenCalledWith('tab2');
    });

    it('should update active tab when controlled', () => {
      const { rerender } = render(<Tabs tabs={mockTabs} activeTab="tab1" />);
      let tabs = screen.getAllByRole('tab');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');

      rerender(<Tabs tabs={mockTabs} activeTab="tab2" />);
      tabs = screen.getAllByRole('tab');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    });

    it('should work as uncontrolled component', () => {
      render(<Tabs tabs={mockTabs} />);
      const tabs = screen.getAllByRole('tab');

      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
      fireEvent.click(tabs[2]);
      expect(tabs[2]).toHaveAttribute('aria-selected', 'true');
    });

    it('should not change tab when disabled tab is clicked', () => {
      const tabsWithDisabled = [
        { id: 'tab1', label: 'Tab 1' },
        { id: 'tab2', label: 'Tab 2', disabled: true },
        { id: 'tab3', label: 'Tab 3' },
      ];
      render(<Tabs tabs={tabsWithDisabled} />);
      const tabs = screen.getAllByRole('tab');

      fireEvent.click(tabs[1]);
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
    });
  });

  describe('Variants', () => {
    it('should apply default variant styles', () => {
      render(<Tabs tabs={mockTabs} variant="default" />);
      const tablist = screen.getByRole('tablist');
      expect(tablist).toHaveClass('border-b');
    });

    it('should apply pills variant styles', () => {
      render(<Tabs tabs={mockTabs} variant="pills" />);
      const tablist = screen.getByRole('tablist');
      expect(tablist).toHaveClass('bg-surface-100');
      expect(tablist).toHaveClass('rounded-lg');
    });

    it('should apply underline variant styles', () => {
      render(<Tabs tabs={mockTabs} variant="underline" />);
      const tablist = screen.getByRole('tablist');
      expect(tablist).toHaveClass('border-b-2');
    });
  });

  describe('Tab features', () => {
    it('should render tab with icon', () => {
      const tabsWithIcons = [
        { id: 'tab1', label: 'Tab 1', icon: <span data-testid="icon">📋</span> },
      ];
      render(<Tabs tabs={tabsWithIcons} />);
      expect(screen.getByTestId('icon')).toBeInTheDocument();
    });

    it('should render tab with badge', () => {
      const tabsWithBadge = [
        { id: 'tab1', label: 'Tab 1', badge: 5 },
      ];
      render(<Tabs tabs={tabsWithBadge} />);
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('should render tab with string badge', () => {
      const tabsWithBadge = [
        { id: 'tab1', label: 'Tab 1', badge: 'New' },
      ];
      render(<Tabs tabs={tabsWithBadge} />);
      expect(screen.getByText('New')).toBeInTheDocument();
    });

    it('should render disabled tab', () => {
      const tabsWithDisabled = [
        { id: 'tab1', label: 'Tab 1', disabled: true },
      ];
      render(<Tabs tabs={tabsWithDisabled} />);
      const tab = screen.getByRole('tab');
      expect(tab).toBeDisabled();
    });

    it('should render tab with icon and badge', () => {
      const tabsWithAll = [
        {
          id: 'tab1',
          label: 'Tab 1',
          icon: <span data-testid="icon">📋</span>,
          badge: 3,
        },
      ];
      render(<Tabs tabs={tabsWithAll} />);
      expect(screen.getByTestId('icon')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have tablist role', () => {
      render(<Tabs tabs={mockTabs} />);
      expect(screen.getByRole('tablist')).toBeInTheDocument();
    });

    it('should have tab roles for buttons', () => {
      render(<Tabs tabs={mockTabs} />);
      const tabs = screen.getAllByRole('tab');
      expect(tabs).toHaveLength(3);
    });

    it('should set aria-selected correctly', () => {
      render(<Tabs tabs={mockTabs} activeTab="tab2" />);
      const tabs = screen.getAllByRole('tab');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
      expect(tabs[2]).toHaveAttribute('aria-selected', 'false');
    });

    it('should set aria-controls on tabs', () => {
      render(<Tabs tabs={mockTabs} />);
      const tabs = screen.getAllByRole('tab');
      expect(tabs[0]).toHaveAttribute('aria-controls', 'panel-tab1');
      expect(tabs[1]).toHaveAttribute('aria-controls', 'panel-tab2');
    });

    it('should be keyboard accessible', () => {
      render(<Tabs tabs={mockTabs} />);
      const tabs = screen.getAllByRole('tab');
      tabs[0].focus();
      expect(tabs[0]).toHaveFocus();
    });
  });

  describe('Complex combinations', () => {
    it('should handle all features together', () => {
      const complexTabs = [
        {
          id: 'tab1',
          label: 'Active',
          icon: <span data-testid="icon1">📋</span>,
          badge: 5,
        },
        {
          id: 'tab2',
          label: 'Pending',
          icon: <span data-testid="icon2">⏰</span>,
          badge: 'New',
        },
        {
          id: 'tab3',
          label: 'Disabled',
          disabled: true,
        },
      ];

      const handleTabChange = jest.fn();
      render(
        <Tabs
          tabs={complexTabs}
          activeTab="tab1"
          onTabChange={handleTabChange}
          variant="pills"
          className="custom"
        />
      );

      expect(screen.getByTestId('icon1')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByTestId('icon2')).toBeInTheDocument();
      expect(screen.getByText('New')).toBeInTheDocument();

      const tabs = screen.getAllByRole('tab');
      expect(tabs[2]).toBeDisabled();

      fireEvent.click(tabs[1]);
      expect(handleTabChange).toHaveBeenCalledWith('tab2');
    });
  });
});

describe('Tabs (Radix-style API)', () => {
  describe('Radix-style props', () => {
    it('should support value prop', () => {
      const tabs = [
        { id: 'tab1', label: 'Tab 1' },
        { id: 'tab2', label: 'Tab 2' },
      ];
      render(<Tabs tabs={tabs} value="tab2" />);
      const tabElements = screen.getAllByRole('tab');
      expect(tabElements[1]).toHaveAttribute('aria-selected', 'true');
    });

    it('should support onValueChange prop', () => {
      const handleValueChange = jest.fn();
      const tabs = [
        { id: 'tab1', label: 'Tab 1' },
        { id: 'tab2', label: 'Tab 2' },
      ];
      render(<Tabs tabs={tabs} onValueChange={handleValueChange} />);
      const tabElements = screen.getAllByRole('tab');
      fireEvent.click(tabElements[1]);
      expect(handleValueChange).toHaveBeenCalledWith('tab2');
    });

    it('should support defaultValue prop', () => {
      const tabs = [
        { id: 'tab1', label: 'Tab 1' },
        { id: 'tab2', label: 'Tab 2' },
      ];
      render(<Tabs tabs={tabs} defaultValue="tab2" />);
      const tabElements = screen.getAllByRole('tab');
      expect(tabElements[1]).toHaveAttribute('aria-selected', 'true');
    });

    it('should support children-based usage', () => {
      render(
        <Tabs>
          <div>Custom content</div>
        </Tabs>
      );
      expect(screen.getByText('Custom content')).toBeInTheDocument();
    });
  });

  describe('Dual API compatibility', () => {
    it('should work with both onTabChange and onValueChange', () => {
      const handleTabChange = jest.fn();
      const handleValueChange = jest.fn();
      const tabs = [
        { id: 'tab1', label: 'Tab 1' },
        { id: 'tab2', label: 'Tab 2' },
      ];
      render(
        <Tabs
          tabs={tabs}
          onTabChange={handleTabChange}
          onValueChange={handleValueChange}
        />
      );
      const tabElements = screen.getAllByRole('tab');
      fireEvent.click(tabElements[1]);
      expect(handleValueChange).toHaveBeenCalledWith('tab2');
      expect(handleTabChange).not.toHaveBeenCalled(); // onValueChange takes precedence
    });

    it('should prefer value over activeTab', () => {
      const tabs = [
        { id: 'tab1', label: 'Tab 1' },
        { id: 'tab2', label: 'Tab 2' },
      ];
      render(<Tabs tabs={tabs} value="tab2" activeTab="tab1" />);
      const tabElements = screen.getAllByRole('tab');
      expect(tabElements[1]).toHaveAttribute('aria-selected', 'true');
    });
  });
});

describe('TabPanels', () => {
  it('should render children', () => {
    render(
      <TabPanels activeTab="tab1">
        <div>Panel content</div>
      </TabPanels>
    );
    expect(screen.getByText('Panel content')).toBeInTheDocument();
  });

  it('should have spacing styles', () => {
    const { container } = render(
      <TabPanels activeTab="tab1">
        <div>Content</div>
      </TabPanels>
    );
    const panels = container.firstChild as HTMLElement;
    expect(panels).toHaveClass('mt-4');
  });
});

describe('TabPanel', () => {
  it('should render children', () => {
    render(
      <TabPanel id="panel1">
        <div>Panel content</div>
      </TabPanel>
    );
    expect(screen.getByText('Panel content')).toBeInTheDocument();
  });

  it('should have tabpanel role', () => {
    render(
      <TabPanel id="panel1">
        <div>Content</div>
      </TabPanel>
    );
    const panel = screen.getByRole('tabpanel');
    expect(panel).toBeInTheDocument();
  });

  it('should have correct id', () => {
    render(
      <TabPanel id="test">
        <div>Content</div>
      </TabPanel>
    );
    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveAttribute('id', 'panel-test');
  });

  it('should have correct aria-labelledby', () => {
    render(
      <TabPanel id="test">
        <div>Content</div>
      </TabPanel>
    );
    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveAttribute('aria-labelledby', 'tab-test');
  });

  it('should apply custom className', () => {
    render(
      <TabPanel id="panel1" className="custom-panel">
        <div>Content</div>
      </TabPanel>
    );
    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveClass('custom-panel');
  });
});

describe('Radix-style Components', () => {
  describe('TabsList', () => {
    it('should render children', () => {
      render(
        <TabsList>
          <button>Tab 1</button>
        </TabsList>
      );
      expect(screen.getByText('Tab 1')).toBeInTheDocument();
    });

    it('should have tablist role', () => {
      render(
        <TabsList>
          <button>Tab</button>
        </TabsList>
      );
      expect(screen.getByRole('tablist')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      render(
        <TabsList className="custom">
          <button>Tab</button>
        </TabsList>
      );
      const tablist = screen.getByRole('tablist');
      expect(tablist).toHaveClass('custom');
    });

    it('should have base styles', () => {
      render(
        <TabsList>
          <button>Tab</button>
        </TabsList>
      );
      const tablist = screen.getByRole('tablist');
      expect(tablist).toHaveClass('inline-flex');
      expect(tablist).toHaveClass('items-center');
      expect(tablist).toHaveClass('rounded-lg');
    });
  });

  describe('TabsTrigger', () => {
    it('should render children', () => {
      render(<TabsTrigger value="tab1">Tab 1</TabsTrigger>);
      expect(screen.getByText('Tab 1')).toBeInTheDocument();
    });

    it('should have tab role', () => {
      render(<TabsTrigger value="tab1">Tab 1</TabsTrigger>);
      expect(screen.getByRole('tab')).toBeInTheDocument();
    });

    it('should have data-value attribute', () => {
      render(<TabsTrigger value="test-value">Tab</TabsTrigger>);
      const trigger = screen.getByRole('tab');
      expect(trigger).toHaveAttribute('data-value', 'test-value');
    });

    it('should apply custom className', () => {
      render(
        <TabsTrigger value="tab1" className="custom">
          Tab
        </TabsTrigger>
      );
      const trigger = screen.getByRole('tab');
      expect(trigger).toHaveClass('custom');
    });

    it('should have base styles', () => {
      render(<TabsTrigger value="tab1">Tab</TabsTrigger>);
      const trigger = screen.getByRole('tab');
      expect(trigger).toHaveClass('inline-flex');
      expect(trigger).toHaveClass('items-center');
      expect(trigger).toHaveClass('rounded-md');
    });

    it('should have focus styles', () => {
      render(<TabsTrigger value="tab1">Tab</TabsTrigger>);
      const trigger = screen.getByRole('tab');
      expect(trigger).toHaveClass('focus-visible:outline-none');
      expect(trigger).toHaveClass('focus-visible:ring-2');
    });

    it('should be keyboard accessible', () => {
      render(<TabsTrigger value="tab1">Tab</TabsTrigger>);
      const trigger = screen.getByRole('tab');
      trigger.focus();
      expect(trigger).toHaveFocus();
    });
  });

  describe('TabsContent', () => {
    it('should render children', () => {
      render(
        <TabsContent value="tab1">
          <div>Content</div>
        </TabsContent>
      );
      expect(screen.getByText('Content')).toBeInTheDocument();
    });

    it('should have tabpanel role', () => {
      render(
        <TabsContent value="tab1">
          <div>Content</div>
        </TabsContent>
      );
      expect(screen.getByRole('tabpanel')).toBeInTheDocument();
    });

    it('should have data-value attribute', () => {
      render(
        <TabsContent value="test-value">
          <div>Content</div>
        </TabsContent>
      );
      const content = screen.getByRole('tabpanel');
      expect(content).toHaveAttribute('data-value', 'test-value');
    });

    it('should apply custom className', () => {
      render(
        <TabsContent value="tab1" className="custom">
          <div>Content</div>
        </TabsContent>
      );
      const content = screen.getByRole('tabpanel');
      expect(content).toHaveClass('custom');
    });

    it('should have focus styles', () => {
      render(
        <TabsContent value="tab1">
          <div>Content</div>
        </TabsContent>
      );
      const content = screen.getByRole('tabpanel');
      expect(content).toHaveClass('focus-visible:outline-none');
      expect(content).toHaveClass('focus-visible:ring-2');
    });
  });

  describe('Complete Radix-style example', () => {
    it('should render complete Radix-style tabs', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>
      );

      expect(screen.getByText('Tab 1')).toBeInTheDocument();
      expect(screen.getByText('Tab 2')).toBeInTheDocument();
      expect(screen.getByText('Content 1')).toBeInTheDocument();
      expect(screen.getByText('Content 2')).toBeInTheDocument();
    });
  });
});

describe('Edge cases', () => {
  it('should handle empty tabs array', () => {
    render(<Tabs tabs={[]} />);
    const tablist = screen.getByRole('tablist');
    expect(tablist).toBeInTheDocument();
  });

  it('should handle single tab', () => {
    const singleTab = [{ id: 'only', label: 'Only Tab' }];
    render(<Tabs tabs={singleTab} />);
    expect(screen.getAllByRole('tab')).toHaveLength(1);
  });

  it('should handle tabs without labels', () => {
    const iconTabs = [
      { id: 'tab1', label: '', icon: <span>📋</span> },
    ];
    render(<Tabs tabs={iconTabs} />);
    expect(screen.getByRole('tab')).toBeInTheDocument();
  });

  it('should handle badge with zero value', () => {
    const tabsWithZero = [
      { id: 'tab1', label: 'Tab', badge: 0 },
    ];
    render(<Tabs tabs={tabsWithZero} />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });
});
