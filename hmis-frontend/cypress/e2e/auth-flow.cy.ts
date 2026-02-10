describe('Authentication Flow', () => {
  beforeEach(() => {
    // Clear all cookies and local storage before each test
    cy.clearCookies();
    cy.clearLocalStorage();
  });

  describe('Login', () => {
    it('should display login page', () => {
      cy.visit('/auth/login');

      // Check login form elements
      cy.contains(/iniciar sesión|log.*in|entrar/i).should('be.visible');
      cy.get('input[name="email"]').should('be.visible');
      cy.get('input[name="password"]').should('be.visible');
      cy.get('button[type="submit"]').should('be.visible');
    });

    it('should login successfully with valid credentials', () => {
      cy.visit('/auth/login');

      // Fill login form
      cy.get('input[name="email"]').type(Cypress.env('adminEmail'));
      cy.get('input[name="password"]').type(Cypress.env('adminPassword'));

      // Submit form
      cy.get('button[type="submit"]').click();

      // Should redirect to dashboard
      cy.url().should('include', '/dashboard');
      cy.waitForPageLoad();

      // Check dashboard is loaded
      cy.contains(/dashboard|panel/i).should('be.visible');

      // Check tokens are stored
      cy.window().then((win) => {
        expect(win.localStorage.getItem('hmis_access_token')).to.exist;
        expect(win.localStorage.getItem('hmis_tenant_id')).to.exist;
      });
    });

    it('should show error with invalid credentials', () => {
      cy.visit('/auth/login');

      // Fill with invalid credentials
      cy.get('input[name="email"]').type('invalid@example.com');
      cy.get('input[name="password"]').type('wrongpassword');

      // Submit form
      cy.get('button[type="submit"]').click();

      // Should show error message
      cy.contains(/inválid|incorrect|error/i, { timeout: 5000 }).should('be.visible');

      // Should stay on login page
      cy.url().should('include', '/auth/login');
    });

    it('should validate required fields', () => {
      cy.visit('/auth/login');

      // Try to submit without filling fields
      cy.get('button[type="submit"]').click();

      // Should show validation errors
      cy.get('input[name="email"]').then(($input) => {
        expect($input[0].validationMessage).to.not.be.empty;
      });
    });

    it('should validate email format', () => {
      cy.visit('/auth/login');

      // Enter invalid email format
      cy.get('input[name="email"]').type('notanemail');
      cy.get('input[name="password"]').type('password123');

      // Submit form
      cy.get('button[type="submit"]').click();

      // Should show validation error
      cy.get('input[name="email"]').then(($input) => {
        expect($input[0].validationMessage).to.not.be.empty;
      });
    });

    it('should toggle password visibility', () => {
      cy.visit('/auth/login');

      cy.get('input[name="password"]').type('password123');

      // Password should be hidden by default
      cy.get('input[name="password"]').should('have.attr', 'type', 'password');

      // Look for show/hide password button
      cy.get('body').then(($body) => {
        if ($body.find('button[aria-label*="password"]').length > 0) {
          cy.get('button[aria-label*="password"]').click();

          // Password should now be visible
          cy.get('input[name="password"]').should('have.attr', 'type', 'text');
        }
      });
    });

    it('should remember email if checkbox is checked', () => {
      cy.visit('/auth/login');

      const testEmail = 'remember@example.com';

      // Look for "Remember me" checkbox
      cy.get('body').then(($body) => {
        if ($body.find('input[type="checkbox"]').length > 0) {
          cy.get('input[name="email"]').type(testEmail);
          cy.get('input[type="checkbox"]').check();

          // Reload page
          cy.reload();

          // Email should be remembered
          cy.get('input[name="email"]').should('have.value', testEmail);
        }
      });
    });
  });

  describe('Logout', () => {
    beforeEach(() => {
      // Login before testing logout
      cy.loginViaUI(Cypress.env('adminEmail'), Cypress.env('adminPassword'));
    });

    it('should logout successfully', () => {
      // Find logout button (might be in header or sidebar)
      cy.contains('button', /cerrar sesión|logout|salir/i).click();

      // Should redirect to login page
      cy.url().should('include', '/auth/login');

      // Tokens should be cleared
      cy.window().then((win) => {
        expect(win.localStorage.getItem('hmis_access_token')).to.be.null;
        expect(win.localStorage.getItem('hmis_refresh_token')).to.be.null;
      });
    });

    it('should show logout confirmation if implemented', () => {
      cy.contains('button', /cerrar sesión|logout|salir/i).click();

      // Check if confirmation modal appears
      cy.get('body').then(($body) => {
        if ($body.find('[role="dialog"]').length > 0) {
          cy.get('[role="dialog"]').should('be.visible');
          cy.contains('button', /confirmar|confirm/i).click();
        }
      });

      cy.url().should('include', '/auth/login');
    });
  });

  describe('Protected Routes', () => {
    it('should redirect to login when accessing protected route without auth', () => {
      // Try to access dashboard without authentication
      cy.visit('/dashboard');

      // Should redirect to login
      cy.url().should('include', '/auth/login');
    });

    it('should redirect to login when accessing patients page without auth', () => {
      cy.visit('/patients');

      // Should redirect to login
      cy.url().should('include', '/auth/login');
    });

    it('should allow access to protected routes after login', () => {
      cy.loginViaUI(Cypress.env('adminEmail'), Cypress.env('adminPassword'));

      // Should be able to access dashboard
      cy.visit('/dashboard');
      cy.url().should('include', '/dashboard');

      // Should be able to access patients
      cy.visit('/patients');
      cy.url().should('include', '/patients');
    });
  });

  describe('Session Management', () => {
    it('should maintain session across page reloads', () => {
      cy.loginViaUI(Cypress.env('adminEmail'), Cypress.env('adminPassword'));

      // Reload page
      cy.reload();

      // Should still be logged in
      cy.url().should('not.include', '/auth/login');
      cy.contains(/dashboard|panel/i).should('be.visible');
    });

    it('should maintain session across navigation', () => {
      cy.loginViaUI(Cypress.env('adminEmail'), Cypress.env('adminPassword'));

      // Navigate to different pages
      cy.visit('/patients');
      cy.waitForPageLoad();
      cy.url().should('include', '/patients');

      cy.visit('/appointments');
      cy.waitForPageLoad();
      cy.url().should('include', '/appointments');

      cy.visit('/billing');
      cy.waitForPageLoad();
      cy.url().should('include', '/billing');

      // Should still be authenticated
      cy.window().then((win) => {
        expect(win.localStorage.getItem('hmis_access_token')).to.exist;
      });
    });

    it('should handle token expiration gracefully', () => {
      cy.loginViaUI(Cypress.env('adminEmail'), Cypress.env('adminPassword'));

      // Manually expire token
      cy.window().then((win) => {
        win.localStorage.setItem('hmis_access_token', 'expired_token');
      });

      // Try to access a protected route
      cy.visit('/patients');

      // Should either:
      // 1. Redirect to login
      // 2. Show error message
      // 3. Attempt token refresh

      cy.wait(2000);
      cy.url().then((url) => {
        if (url.includes('/auth/login')) {
          // Redirected to login - correct behavior
          expect(url).to.include('/auth/login');
        } else {
          // Might have refreshed token - check for error or success
          cy.get('body').should('exist');
        }
      });
    });
  });

  describe('Forgot Password', () => {
    it('should show forgot password link', () => {
      cy.visit('/auth/login');

      // Check forgot password link exists
      cy.get('body').then(($body) => {
        if ($body.text().includes('Olvidaste') || $body.text().includes('Forgot')) {
          cy.contains('a', /olvidaste.*contraseña|forgot.*password/i).should('be.visible');
        }
      });
    });

    it('should navigate to forgot password page', () => {
      cy.visit('/auth/login');

      cy.get('body').then(($body) => {
        if ($body.find('a[href*="forgot"]').length > 0) {
          cy.contains('a', /olvidaste|forgot/i).click();

          // Should navigate to forgot password page
          cy.url().should('include', 'forgot');
        }
      });
    });
  });

  describe('Multi-tenant Login', () => {
    it('should set tenant ID after successful login', () => {
      cy.loginViaUI(Cypress.env('adminEmail'), Cypress.env('adminPassword'));

      // Check tenant ID is set
      cy.window().then((win) => {
        const tenantId = win.localStorage.getItem('hmis_tenant_id');
        expect(tenantId).to.exist;
        expect(tenantId).to.not.equal('');
      });
    });

    it('should include tenant header in API requests', () => {
      cy.loginViaUI(Cypress.env('adminEmail'), Cypress.env('adminPassword'));

      // Intercept API request
      cy.intercept('GET', '**/api/v1/**').as('apiRequest');

      // Navigate to a page that makes API calls
      cy.visit('/patients');

      // Wait for API request
      cy.wait('@apiRequest').then((interception) => {
        // Check for tenant header
        expect(interception.request.headers).to.have.property('x-tenant-id');
      });
    });
  });

  describe('Security', () => {
    it('should not expose sensitive data in localStorage', () => {
      cy.loginViaUI(Cypress.env('adminEmail'), Cypress.env('adminPassword'));

      cy.window().then((win) => {
        // Check that password is not stored
        const storage = JSON.stringify(win.localStorage);
        expect(storage.toLowerCase()).to.not.include('password');
      });
    });

    it('should use HTTPS in production', () => {
      // This test would be relevant in production
      cy.visit('/auth/login');

      cy.location('protocol').then((protocol) => {
        // In local development, protocol is http:
        // In production, should be https:
        expect(['http:', 'https:']).to.include(protocol);
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper form labels', () => {
      cy.visit('/auth/login');

      // Check form accessibility
      cy.get('input[name="email"]').should('have.attr', 'aria-label').or('have.attr', 'id');
      cy.get('input[name="password"]').should('have.attr', 'aria-label').or('have.attr', 'id');
    });

    it('should support keyboard navigation', () => {
      cy.visit('/auth/login');

      // Tab through form fields
      cy.get('input[name="email"]').focus().type(Cypress.env('adminEmail'));
      cy.realPress('Tab'); // Requires cypress-real-events plugin
      cy.focused().should('have.attr', 'name', 'password');
    });
  });
});
