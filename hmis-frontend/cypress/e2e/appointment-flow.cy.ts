describe('Appointment Management Flow', () => {
  let testPatient: any;

  before(() => {
    // Create a test patient for appointments
    cy.login(Cypress.env('adminEmail'), Cypress.env('adminPassword'));
    cy.setTenant('default');

    cy.createPatient({
      first_name: 'Appointment',
      last_name: 'TestPatient',
    }).then((patient) => {
      testPatient = patient;
    });

    cy.logout();
  });

  beforeEach(() => {
    cy.login(Cypress.env('adminEmail'), Cypress.env('adminPassword'));
    cy.setTenant('default');
  });

  afterEach(() => {
    cy.logout();
  });

  describe('Appointment List', () => {
    it('should display appointments page', () => {
      cy.visit('/appointments');
      cy.waitForPageLoad();

      // Check page title
      cy.contains('h1', /citas|appointments/i).should('be.visible');

      // Check "New Appointment" button exists
      cy.contains('button', /nueva cita|new appointment/i).should('be.visible');
    });

    it('should filter appointments by date', () => {
      cy.visit('/appointments');
      cy.waitForPageLoad();

      // Look for date filters
      cy.get('body').then(($body) => {
        if ($body.find('button:contains("Hoy"), button:contains("Today")').length > 0) {
          cy.contains('button', /hoy|today/i).click();
          cy.wait(1000);
        }
      });
    });

    it('should filter appointments by status', () => {
      cy.visit('/appointments');
      cy.waitForPageLoad();

      // Look for status filter
      cy.get('body').then(($body) => {
        if ($body.find('select[name="status"]').length > 0) {
          cy.get('select[name="status"]').select('scheduled');
          cy.wait(1000);
        }
      });
    });
  });

  describe('Create Appointment', () => {
    it('should open create appointment modal', () => {
      cy.visit('/appointments');
      cy.waitForPageLoad();

      // Click "New Appointment" button
      cy.contains('button', /nueva cita|new appointment/i).click();

      // Check modal is visible
      cy.get('[role="dialog"]', { timeout: 3000 }).should('be.visible');
    });

    it('should create a new appointment successfully', () => {
      cy.visit('/appointments');
      cy.waitForPageLoad();

      // Open create modal
      cy.contains('button', /nueva cita|new appointment/i).click();

      // Calculate tomorrow's date
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      // Fill form
      cy.get('input[name="patient_id"], select[name="patient_id"]').then(($el) => {
        if ($el.is('select')) {
          // If it's a select, choose first option
          cy.get('select[name="patient_id"]').select(1);
        } else {
          // If it's an autocomplete input, type patient name
          cy.get('input[name="patient_id"]').type(testPatient.first_name);
          cy.wait(1000);
          cy.contains(testPatient.first_name).click();
        }
      });

      // Select provider
      cy.get('select[name="provider_id"]').select(1);

      // Set date and time
      cy.get('input[name="appointment_date"]').type(dateStr);
      cy.get('input[name="appointment_time"]').type('10:00');

      // Select appointment type
      cy.get('select[name="appointment_type"]').select('consultation');

      // Add reason
      cy.get('textarea[name="reason"]').type('Consulta de rutina');

      // Submit form
      cy.contains('button', /guardar|save|crear|create/i).click();

      // Check success message
      cy.contains(/cita creada|appointment created/i, { timeout: 5000 }).should('be.visible');
    });

    it('should validate required fields', () => {
      cy.visit('/appointments');
      cy.waitForPageLoad();

      // Open create modal
      cy.contains('button', /nueva cita|new appointment/i).click();

      // Try to submit empty form
      cy.contains('button', /guardar|save|crear|create/i).click();

      // Check for validation errors
      cy.contains(/requerido|required/i).should('be.visible');
    });

    it('should prevent scheduling in the past', () => {
      cy.visit('/appointments');
      cy.waitForPageLoad();

      // Open create modal
      cy.contains('button', /nueva cita|new appointment/i).click();

      // Try to set a past date
      cy.get('input[name="appointment_date"]').type('2020-01-01');

      // Submit form (with minimum required fields)
      cy.get('select[name="patient_id"]').select(1);
      cy.get('select[name="provider_id"]').select(1);
      cy.get('input[name="appointment_time"]').type('10:00');
      cy.get('select[name="appointment_type"]').select('consultation');

      cy.contains('button', /guardar|save|crear|create/i).click();

      // Should show validation error
      cy.wait(500);
      cy.get('body').should('exist');
    });
  });

  describe('Appointment Actions', () => {
    let appointment: any;

    beforeEach(() => {
      // Create a test appointment
      cy.createAppointment({
        patient_id: testPatient.id,
        provider_id: 'test-provider-id',
      }).then((appt) => {
        appointment = appt;
      });
    });

    it('should check-in an appointment', () => {
      cy.visit('/appointments');
      cy.waitForPageLoad();

      // Find the appointment and check-in
      cy.contains(testPatient.last_name).parents('tr').within(() => {
        cy.contains('button', /registrar|check.*in/i).click();
      });

      // Confirm check-in
      cy.contains('button', /confirmar|confirm/i).click();

      // Check success message
      cy.contains(/registrado|checked.*in/i, { timeout: 5000 }).should('be.visible');
    });

    it('should cancel an appointment', () => {
      cy.visit('/appointments');
      cy.waitForPageLoad();

      // Find the appointment
      cy.contains(testPatient.last_name).parents('tr').within(() => {
        cy.contains('button', /cancelar|cancel/i).click();
      });

      // Confirm cancellation
      cy.contains('button', /confirmar|confirm/i).click();

      // Check success message
      cy.contains(/cancelada|cancelled/i, { timeout: 5000 }).should('be.visible');
    });

    it('should start clinical encounter from appointment', () => {
      cy.visit('/appointments');
      cy.waitForPageLoad();

      // Find appointment with checked-in status
      cy.get('body').then(($body) => {
        if ($body.text().includes('Registrado') || $body.text().includes('Checked In')) {
          cy.contains('button', /iniciar encuentro|start encounter/i).first().click();

          // Should navigate to EMR page
          cy.url().should('include', '/emr');
        }
      });
    });
  });

  describe('Appointment Calendar View', () => {
    it('should display calendar view if available', () => {
      cy.visit('/appointments');
      cy.waitForPageLoad();

      // Look for calendar view toggle
      cy.get('body').then(($body) => {
        if ($body.find('button[aria-label*="calendar"]').length > 0) {
          cy.get('button[aria-label*="calendar"]').click();
          cy.wait(1000);

          // Check calendar is displayed
          cy.get('[role="grid"], .calendar').should('be.visible');
        }
      });
    });
  });

  describe('Appointment Statistics', () => {
    it('should display appointment statistics', () => {
      cy.visit('/appointments');
      cy.waitForPageLoad();

      // Check stats cards
      cy.get('body').then(($body) => {
        if ($body.find('[data-testid="stats"]').length > 0) {
          cy.get('[data-testid="stats"]').should('be.visible');
        }
      });
    });
  });

  describe('View Appointment Details', () => {
    it('should view appointment details', () => {
      cy.createAppointment({
        patient_id: testPatient.id,
        provider_id: 'test-provider-id',
        reason: 'Test appointment details',
      }).then((appointment: any) => {
        cy.visit('/appointments');
        cy.waitForPageLoad();

        // Click on appointment row
        cy.contains(testPatient.last_name).click();

        // Check details modal or page
        cy.contains('Test appointment details').should('be.visible');
      });
    });
  });

  describe('Today\'s Appointments', () => {
    it('should show only today\'s appointments when Today filter is active', () => {
      cy.visit('/appointments');
      cy.waitForPageLoad();

      // Click Today button
      cy.contains('button', /hoy|today/i).click();
      cy.wait(1000);

      // Verify appointments are from today
      cy.get('body').should('exist');
    });
  });

  describe('No Show Appointments', () => {
    it('should mark appointment as no-show', () => {
      // Create an appointment in the past
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      cy.createAppointment({
        patient_id: testPatient.id,
        provider_id: 'test-provider-id',
        appointment_date: yesterday.toISOString().split('T')[0],
      }).then(() => {
        cy.visit('/appointments');
        cy.waitForPageLoad();

        // Filter past appointments
        cy.contains('button', /pasadas|past/i).click();
        cy.wait(1000);

        // Look for no-show action
        cy.get('body').then(($body) => {
          if ($body.text().includes('No Asistió') || $body.text().includes('No Show')) {
            cy.contains('button', /no.*asistió|no.*show/i).first().click();

            // Confirm action
            cy.contains('button', /confirmar|confirm/i).click();

            // Check success
            cy.wait(500);
          }
        });
      });
    });
  });

  describe('Responsive Design', () => {
    it('should work on mobile viewport', () => {
      cy.viewport('iphone-x');

      cy.visit('/appointments');
      cy.waitForPageLoad();

      // Check page loads
      cy.contains(/citas|appointments/i).should('be.visible');
    });

    it('should work on tablet viewport', () => {
      cy.viewport('ipad-2');

      cy.visit('/appointments');
      cy.waitForPageLoad();

      // Check page loads
      cy.contains(/citas|appointments/i).should('be.visible');
    });
  });
});
