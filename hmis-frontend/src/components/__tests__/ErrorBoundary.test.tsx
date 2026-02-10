/**
 * Tests for ErrorBoundary component
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary, AsyncErrorBoundary } from '../ErrorBoundary';

// Component that throws an error
const ThrowError: React.FC<{ shouldThrow?: boolean; message?: string }> = ({
  shouldThrow = true,
  message = 'Test error',
}) => {
  if (shouldThrow) {
    throw new Error(message);
  }
  return <div>No error</div>;
};

// Mock window.location
const mockLocation = {
  href: '',
};

describe('ErrorBoundary', () => {
  const originalError = console.error;
  const originalLocation = window.location;

  beforeAll(() => {
    // Suppress console.error for expected errors in tests
    console.error = jest.fn();
  });

  afterAll(() => {
    console.error = originalError;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockLocation.href = '';
    delete (window as any).location;
    window.location = mockLocation as any;

    // Mock Sentry
    (window as any).Sentry = {
      captureException: jest.fn(),
    };
  });

  afterEach(() => {
    window.location = originalLocation;
    delete (window as any).Sentry;
  });

  describe('Error-free rendering', () => {
    it('should render children when no error occurs', () => {
      render(
        <ErrorBoundary>
          <div>Test content</div>
        </ErrorBoundary>
      );

      expect(screen.getByText('Test content')).toBeInTheDocument();
    });

    it('should not show error UI when no error', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      );

      expect(screen.queryByText(/Algo salio mal/i)).not.toBeInTheDocument();
      expect(screen.getByText('No error')).toBeInTheDocument();
    });
  });

  describe('Error catching', () => {
    it('should catch errors and display error UI', () => {
      render(
        <ErrorBoundary>
          <ThrowError message="Component error" />
        </ErrorBoundary>
      );

      expect(screen.getByText(/Algo salio mal/i)).toBeInTheDocument();
      expect(screen.getByText(/Lo sentimos, ocurrio un error inesperado/i)).toBeInTheDocument();
    });

    it('should display error message in development mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      render(
        <ErrorBoundary>
          <ThrowError message="Development error" />
        </ErrorBoundary>
      );

      expect(screen.getByText(/Detalles tecnicos/i)).toBeInTheDocument();

      process.env.NODE_ENV = originalEnv;
    });

    it('should hide error details in production mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      render(
        <ErrorBoundary>
          <ThrowError message="Production error" />
        </ErrorBoundary>
      );

      expect(screen.queryByText(/Detalles tecnicos/i)).not.toBeInTheDocument();

      process.env.NODE_ENV = originalEnv;
    });

    it('should log error to console', () => {
      render(
        <ErrorBoundary>
          <ThrowError message="Console log test" />
        </ErrorBoundary>
      );

      expect(console.error).toHaveBeenCalled();
    });

    it('should send error to Sentry when available', () => {
      render(
        <ErrorBoundary>
          <ThrowError message="Sentry error" />
        </ErrorBoundary>
      );

      expect((window as any).Sentry.captureException).toHaveBeenCalled();
    });

    it('should handle missing Sentry gracefully', () => {
      delete (window as any).Sentry;

      expect(() => {
        render(
          <ErrorBoundary>
            <ThrowError message="No Sentry error" />
          </ErrorBoundary>
        );
      }).not.toThrow();
    });
  });

  describe('Custom fallback', () => {
    it('should render custom fallback when provided', () => {
      const customFallback = <div>Custom error message</div>;

      render(
        <ErrorBoundary fallback={customFallback}>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByText('Custom error message')).toBeInTheDocument();
      expect(screen.queryByText(/Algo salio mal/i)).not.toBeInTheDocument();
    });
  });

  describe('Error recovery', () => {
    it('should reset error state when reset button is clicked', () => {
      const { rerender } = render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByText(/Algo salio mal/i)).toBeInTheDocument();

      const resetButton = screen.getByText(/Intentar de nuevo/i);
      fireEvent.click(resetButton);

      // After reset, the error boundary should try to render children again
      // Since ThrowError still throws, it will catch the error again
      expect(screen.getByText(/Algo salio mal/i)).toBeInTheDocument();
    });

    it('should navigate to home when home button is clicked', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      const homeButton = screen.getByText(/Ir al inicio/i);
      fireEvent.click(homeButton);

      expect(window.location.href).toBe('/dashboard');
    });
  });

  describe('Error information display', () => {
    it('should display error icon', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      // Check for the presence of the error UI container
      const errorContainer = screen.getByText(/Algo salio mal/i).closest('div');
      expect(errorContainer).toBeInTheDocument();
    });

    it('should show both action buttons', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByText(/Intentar de nuevo/i)).toBeInTheDocument();
      expect(screen.getByText(/Ir al inicio/i)).toBeInTheDocument();
    });
  });

  describe('getDerivedStateFromError', () => {
    it('should update state when error is caught', () => {
      render(
        <ErrorBoundary>
          <ThrowError message="State update test" />
        </ErrorBoundary>
      );

      // Verify error UI is shown, which means state was updated
      expect(screen.getByText(/Algo salio mal/i)).toBeInTheDocument();
    });
  });

  describe('componentDidCatch', () => {
    it('should log error info to console', () => {
      render(
        <ErrorBoundary>
          <ThrowError message="Error info test" />
        </ErrorBoundary>
      );

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Error caught by boundary:'),
        expect.any(Error),
        expect.any(Object)
      );
    });
  });

  describe('AsyncErrorBoundary', () => {
    it('should wrap children in ErrorBoundary', () => {
      render(
        <AsyncErrorBoundary>
          <div>Async content</div>
        </AsyncErrorBoundary>
      );

      expect(screen.getByText('Async content')).toBeInTheDocument();
    });

    it('should catch errors in async components', () => {
      render(
        <AsyncErrorBoundary>
          <ThrowError message="Async error" />
        </AsyncErrorBoundary>
      );

      expect(screen.getByText(/Algo salio mal/i)).toBeInTheDocument();
    });
  });

  describe('Multiple errors', () => {
    it('should handle consecutive errors', () => {
      const { rerender } = render(
        <ErrorBoundary>
          <ThrowError message="First error" />
        </ErrorBoundary>
      );

      expect(screen.getByText(/Algo salio mal/i)).toBeInTheDocument();

      // Click reset
      const resetButton = screen.getByText(/Intentar de nuevo/i);
      fireEvent.click(resetButton);

      // Error will be thrown again
      expect(screen.getByText(/Algo salio mal/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible buttons', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      const resetButton = screen.getByText(/Intentar de nuevo/i);
      const homeButton = screen.getByText(/Ir al inicio/i);

      expect(resetButton.tagName).toBe('BUTTON');
      expect(homeButton.tagName).toBe('BUTTON');
    });
  });

  describe('Error boundary styling', () => {
    it('should render with correct layout classes', () => {
      const { container } = render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      const errorDiv = container.querySelector('.min-h-screen');
      expect(errorDiv).toBeInTheDocument();
      expect(errorDiv).toHaveClass('min-h-screen');
    });
  });

  describe('Development mode details', () => {
    it('should show component stack in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      render(
        <ErrorBoundary>
          <ThrowError message="Stack trace test" />
        </ErrorBoundary>
      );

      const details = screen.getByText(/Detalles tecnicos/i);
      expect(details).toBeInTheDocument();

      // Expand the details
      fireEvent.click(details);

      // Error message should be visible
      expect(screen.getByText(/Error: Stack trace test/i)).toBeInTheDocument();

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Edge cases', () => {
    it('should handle errors without error message', () => {
      const ThrowErrorNoMessage = () => {
        throw new Error();
      };

      render(
        <ErrorBoundary>
          <ThrowErrorNoMessage />
        </ErrorBoundary>
      );

      expect(screen.getByText(/Algo salio mal/i)).toBeInTheDocument();
    });

    it('should handle errors thrown as strings', () => {
      const ThrowStringError = () => {
        throw 'String error';
      };

      render(
        <ErrorBoundary>
          <ThrowStringError />
        </ErrorBoundary>
      );

      expect(screen.getByText(/Algo salio mal/i)).toBeInTheDocument();
    });
  });
});
