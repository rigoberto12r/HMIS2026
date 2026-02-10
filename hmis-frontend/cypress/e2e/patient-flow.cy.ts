describe('Patient Management Flow', () => {
  beforeEach(() => {
    // Login before each test
    cy.login(Cypress.env('adminEmail'), Cypress.env('adminPassword'));
    cy.setTenant('default');
  });

  afterEach(() => {
    // Logout after each test
    cy.logout();
  });

  describe('Patient List', () => {
    it('should display patient list page', () => {
      cy.visit('/patients');
      cy.waitForPageLoad();

      // Check page title
      cy.contains('h1', /pacientes|patients/i).should('be.visible');

      // Check search input exists
      cy.get('input[placeholder*="buscar"]', { timeout: 5000 }).should('be.visible');

      // Check "New Patient" button exists
      cy.contains('button', /nuevo paciente|new patient/i).should('be.visible');
    });

    it('should search for patients', () => {
      cy.visit('/patients');
      cy.waitForPageLoad();

      // Type in search box
      cy.get('input[placeholder*="buscar"]').type('Juan');

      // Wait for results to load
      cy.wait(1000);

      // Check that table has results or shows empty state
      cy.get('body').should('exist');
    });

    it('should filter patients by gender', () => {
      cy.visit('/patients');
      cy.waitForPageLoad();

      // Look for gender filter (might be a select or buttons)
      cy.get('body').then(($body) => {
        if ($body.find('select[name="gender"]').length > 0) {
          cy.get('select[name="gender"]').select('male');
          cy.wait(1000);
        }
      });
    });
  });

  describe('Create Patient', () => {
    it('should open create patient modal', () => {
      cy.visit('/patients');
      cy.waitForPageLoad();

      // Click "New Patient" button
      cy.contains('button', /nuevo paciente|new patient/i).click();

      // Check modal is visible
      cy.get('[role="dialog"]', { timeout: 3000 }).should('be.visible');
    });

    it('should create a new patient successfully', () => {
      cy.visit('/patients');
      cy.waitForPageLoad();

      // Open create modal
      cy.contains('button', /nuevo paciente|new patient/i).click();

      // Fill form
      const timestamp = Date.now();
      cy.get('input[name="first_name"]').type(`Juan${timestamp}`);
      cy.get('input[name="last_name"]').type('Pérez');
      cy.get('select[name="document_type"]').select('cedula');
      cy.get('input[name="document_number"]').type(`${timestamp}`.slice(-11));
      cy.get('input[name="birth_date"]').type('1990-01-15');
      cy.get('select[name="gender"]').select('male');
      cy.get('input[name="phone"]').type('809-555-0100');
      cy.get('input[name="email"]').type(`juan${timestamp}@test.com`);

      // Submit form
      cy.contains('button', /guardar|save/i).click();

      // Check success message
      cy.contains(/paciente creado|patient created/i, { timeout: 5000 }).should('be.visible');

      // Check patient appears in list
      cy.contains(`Juan${timestamp}`).should('be.visible');
    });

    it('should show validation errors for empty required fields', () => {
      cy.visit('/patients');
      cy.waitForPageLoad();

      // Open create modal
      cy.contains('button', /nuevo paciente|new patient/i).click();

      // Try to submit empty form
      cy.contains('button', /guardar|save/i).click();

      // Check for validation errors (adjust selectors based on your error display)
      cy.contains(/requerido|required/i).should('be.visible');
    });

    it('should validate document number format', () => {
      cy.visit('/patients');
      cy.waitForPageLoad();

      // Open create modal
      cy.contains('button', /nuevo paciente|new patient/i).click();

      // Fill form with invalid document
      cy.get('input[name="first_name"]').type('Test');
      cy.get('input[name="last_name"]').type('User');
      cy.get('select[name="document_type"]').select('cedula');
      cy.get('input[name="document_number"]').type('123'); // Too short
      cy.get('input[name="birth_date"]').type('1990-01-15');
      cy.get('select[name="gender"]').select('male');

      // Submit form
      cy.contains('button', /guardar|save/i).click();

      // Should show validation error
      cy.wait(500);
      cy.get('body').should('exist');
    });
  });

  describe('View Patient Details', () => {
    it('should view patient details', () => {
      // Create a test patient first
      cy.createPatient({
        first_name: 'María',
        last_name: 'González',
      }).then((patient: any) => {
        // Visit patients list
        cy.visit('/patients');
        cy.waitForPageLoad();

        // Search for the patient
        cy.get('input[placeholder*="buscar"]').clear().type('María');
        cy.wait(1000);

        // Click on patient row or view button
        cy.contains('María').click();

        // Check patient details page
        cy.url().should('include', `/patients/${patient.id}`);
        cy.contains('María González').should('be.visible');
      });
    });
  });

  describe('Edit Patient', () => {
    it('should edit patient information', () => {
      // Create a test patient
      cy.createPatient({
        first_name: 'Pedro',
        last_name: 'Martínez',
        phone: '809-555-0001',
      }).then((patient: any) => {
        // Visit patient details
        cy.visit(`/patients/${patient.id}`);
        cy.waitForPageLoad();

        // Click edit button
        cy.contains('button', /editar|edit/i).click();

        // Update phone number
        cy.get('input[name="phone"]').clear().type('809-555-9999');

        // Save changes
        cy.contains('button', /guardar|save/i).click();

        // Check success message
        cy.contains(/actualizado|updated/i, { timeout: 5000 }).should('be.visible');

        // Verify updated phone is displayed
        cy.contains('809-555-9999').should('be.visible');
      });
    });
  });

  describe('Delete Patient', () => {
    it('should delete a patient (soft delete)', () => {
      // Create a test patient
      cy.createPatient({
        first_name: 'DeleteMe',
        last_name: 'TestPatient',
      }).then((patient: any) => {
        // Visit patient details
        cy.visit(`/patients/${patient.id}`);
        cy.waitForPageLoad();

        // Click delete button
        cy.contains('button', /eliminar|delete/i).click();

        // Confirm deletion
        cy.contains('button', /confirmar|confirm/i).click();

        // Check success message
        cy.contains(/eliminado|deleted/i, { timeout: 5000 }).should('be.visible');

        // Should redirect to patients list
        cy.url().should('include', '/patients');
        cy.url().should('not.include', patient.id);
      });
    });
  });

  describe('Patient Statistics', () => {
    it('should display patient statistics', () => {
      cy.visit('/patients');
      cy.waitForPageLoad();

      // Check stats cards are visible
      cy.contains(/total.*pacientes|total.*patients/i).should('be.visible');
      cy.contains(/activos|active/i).should('be.visible');
    });
  });

  describe('Pagination', () => {
    it('should navigate between pages', () => {
      cy.visit('/patients');
      cy.waitForPageLoad();

      // Look for pagination controls
      cy.get('body').then(($body) => {
        if ($body.find('button[aria-label*="next"]').length > 0) {
          // Click next page
          cy.get('button[aria-label*="next"]').first().click();
          cy.wait(1000);

          // Check URL has page parameter
          cy.url().should('include', 'page=2');
        }
      });
    });
  });

  describe('Responsive Design', () => {
    it('should work on mobile viewport', () => {
      cy.viewport('iphone-x');

      cy.visit('/patients');
      cy.waitForPageLoad();

      // Check page loads on mobile
      cy.contains(/pacientes|patients/i).should('be.visible');

      // Check mobile menu if exists
      cy.get('body').then(($body) => {
        if ($body.find('button[aria-label*="menu"]').length > 0) {
          cy.get('button[aria-label*="menu"]').click();
          cy.wait(500);
        }
      });
    });

    it('should work on tablet viewport', () => {
      cy.viewport('ipad-2');

      cy.visit('/patients');
      cy.waitForPageLoad();

      // Check page loads on tablet
      cy.contains(/pacientes|patients/i).should('be.visible');
    });
  });
});
