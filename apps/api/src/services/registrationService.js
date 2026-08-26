import { randomUUID } from 'node:crypto';
import { validationError } from '../errors.js';
import { hashPassword } from '../security/crypto.js';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const strongPassword = value => value.length >= 16
  && /[a-z]/.test(value)
  && /[A-Z]/.test(value)
  && /[0-9]/.test(value)
  && /[^A-Za-z0-9]/.test(value);

export function createRegistrationService({ repository, publicReferenceService, passwordHasher = hashPassword }) {
  return Object.freeze({
    async register(input, correlationId) {
      const companyName = String(input.company || '').trim();
      const contactName = String(input.contact || '').trim();
      const email = String(input.email || '').trim().toLowerCase();
      const phone = String(input.phone || '').trim();
      const area = String(input.area || '').trim();
      const industry = String(input.industry || '').trim();
      const password = String(input.password || '');
      const reference = publicReferenceService.getRegistrationReference();
      const branchId = reference.areaDirectory[area]?.branch?.id || '';
      const errors = {};
      if (companyName.length < 2 || companyName.length > 200) errors.company = 'Enter a company name of 2–200 characters.';
      if (contactName.length < 2 || contactName.length > 160) errors.contact = 'Enter the contact person’s full name.';
      if (!emailPattern.test(email) || email.length > 254) errors.email = 'Enter a valid company email address.';
      if (phone.length < 7 || phone.length > 50) errors.phone = 'Enter a valid contact number.';
      if (!reference.areas.includes(area) || !branchId) errors.area = 'Select an approved company area.';
      if (!reference.industries.includes(industry)) errors.industry = 'Select an approved industry.';
      if (!strongPassword(password)) errors.password = 'Use at least 16 characters including upper-case, lower-case, numeric and symbol characters.';
      if (Object.keys(errors).length) throw validationError(errors, 'Check the account details.');

      const command = {
        companyId: randomUUID(), userId: randomUUID(), companyName, contactName, email, phone,
        area, industry, branchId, passwordHash: await passwordHasher(password), correlationId,
      };
      return repository.registerCustomerAccount(command);
    },
  });
}
