/// <reference types="cypress" />

// ***********************************************
// Custom Cypress commands for HMIS 2026
// ***********************************************

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Custom command to log in via API
       * @example cy.login('admin@hmis.app', 'Admin2026!')
       */
      login(email: string, password: string): Chainable<void>;

      /**
       * Custom command to log in via UI
       * @example cy.loginViaUI('admin@hmis.app', 'Admin2026!')
       */
      loginViaUI(email: string, password: string): Chainable<void>;

      /**
       * Custom command to log out
       * @example cy.logout()
       */
      logout(): Chainable<void>;

      /**
       * Custom command to set tenant ID
       * @example cy.setTenant('hospital_a')
       */
      setTenant(tenantId: string): Chainable<void>;

      /**
       * Custom command to wait for page to load
       * @example cy.waitForPageLoad()
       */
      waitForPageLoad(): Chainable<void>;

      /**
       * Custom command to create a test patient
       * @example cy.createPatient({ firstName: 'Juan', lastName: 'Pérez' })
       */
      createPatient(data: Partial<Patient>): Chainable<Patient>;

      /**
       * Custom command to create a test appointment
       * @example cy.createAppointment({ patientId: 'uuid', date: '2026-02-10' })
       */
      createAppointment(data: Partial<Appointment>): Chainable<Appointment>;
    }
  }
}

interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  document_type: string;
  document_number: string;
  email?: string;
}

interface Appointment {
  id: string;
  patient_id: string;
  provider_id: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
}

// Login via API (faster for test setup)
Cypress.Commands.add('login', (email: string, password: string) => {
  cy.request({
    method: 'POST',
    url: `${Cypress.env('apiUrl')}/auth/login`,
    body: {
      email,
      password,
    },
  }).then((response) => {
    expect(response.status).to.eq(200);
    expect(response.body).to.have.property('access_token');

    // Save tokens to localStorage
    window.localStorage.setItem('hmis_access_token', response.body.access_token);
    window.localStorage.setItem('hmis_refresh_token', response.body.refresh_token);
    window.localStorage.setItem('hmis_tenant_id', response.body.tenant_id || 'default');
  });
});

// Login via UI (for testing login flow)
Cypress.Commands.add('loginViaUI', (email: string, password: string) => {
  cy.visit('/auth/login');
  cy.get('input[name="email"]').type(email);
  cy.get('input[name="password"]').type(password);
  cy.get('button[type="submit"]').click();

  // Wait for redirect to dashboard
  cy.url().should('include', '/dashboard');
  cy.waitForPageLoad();
});

// Logout
Cypress.Commands.add('logout', () => {
  cy.window().then((win) => {
    win.localStorage.removeItem('hmis_access_token');
    win.localStorage.removeItem('hmis_refresh_token');
    win.localStorage.removeItem('hmis_tenant_id');
  });
});

// Set tenant ID
Cypress.Commands.add('setTenant', (tenantId: string) => {
  cy.window().then((win) => {
    win.localStorage.setItem('hmis_tenant_id', tenantId);
  });
});

// Wait for page to load
Cypress.Commands.add('waitForPageLoad', () => {
  cy.get('[data-loading="true"]', { timeout: 10000 }).should('not.exist');
  cy.get('body').should('be.visible');
});

// Create a test patient
Cypress.Commands.add('createPatient', (data: Partial<Patient>) => {
  const defaultData = {
    first_name: `Test${Date.now()}`,
    last_name: 'Patient',
    document_type: 'cedula',
    document_number: `${Date.now()}`.slice(-11),
    gender: 'male',
    birth_date: '1990-01-01',
    phone: '809-555-0100',
    email: `test${Date.now()}@test.com`,
    ...data,
  };

  cy.window().then((win) => {
    const token = win.localStorage.getItem('hmis_access_token');
    const tenantId = win.localStorage.getItem('hmis_tenant_id');

    cy.request({
      method: 'POST',
      url: `${Cypress.env('apiUrl')}/patients`,
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Tenant-ID': tenantId,
      },
      body: defaultData,
    }).then((response) => {
      expect(response.status).to.eq(201);
      return cy.wrap(response.body);
    });
  });
});

// Create a test appointment
Cypress.Commands.add('createAppointment', (data: Partial<Appointment>) => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const defaultData = {
    appointment_date: tomorrow.toISOString().split('T')[0],
    appointment_time: '10:00:00',
    appointment_type: 'consultation',
    reason: 'Test appointment',
    status: 'scheduled',
    ...data,
  };

  cy.window().then((win) => {
    const token = win.localStorage.getItem('hmis_access_token');
    const tenantId = win.localStorage.getItem('hmis_tenant_id');

    cy.request({
      method: 'POST',
      url: `${Cypress.env('apiUrl')}/appointments`,
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Tenant-ID': tenantId,
      },
      body: defaultData,
    }).then((response) => {
      expect(response.status).to.eq(201);
      return cy.wrap(response.body);
    });
  });
});

export {};
