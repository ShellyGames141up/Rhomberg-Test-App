import { categories, industries, products, recommendedCategories } from '../data/catalogue.js';
import { areas, branches, nearestBranchForArea } from '../data/branches.js';
import { notFound } from '../errors.js';

const clone = value => structuredClone(value);
const activeCategories = categories.filter(category => category.status !== 'inactive');
const activeProducts = products.filter(product => product.status !== 'inactive');

const publicBranch = branch => ({
  id: branch.id,
  name: branch.name,
  role: branch.role,
  address: branch.address,
  phone: branch.phone,
});

export function createPublicReferenceService() {
  return Object.freeze({
    listCategories() {
      return clone(activeCategories);
    },

    listProducts({ categoryId = '', query = '' } = {}) {
      const term = String(query).trim().toLowerCase();
      return clone(activeProducts.filter(product => (
        (!categoryId || product.category === categoryId)
        && (!term || `${product.code} ${product.name} ${product.description} ${product.measuringRange || ''}`.toLowerCase().includes(term))
      )));
    },

    getProduct(productId) {
      const product = activeProducts.find(item => item.id === productId);
      if (!product) throw notFound('The product was not found.');
      return clone(product);
    },

    getRecommendations() {
      return clone(recommendedCategories);
    },

    getRegistrationReference() {
      const publicBranches = branches.map(publicBranch);
      const areaDirectory = Object.fromEntries(areas.map(area => [
        area,
        {
          branch: publicBranch(nearestBranchForArea(area)),
          // Operational representative identities are deliberately absent until
          // an Administrator creates and assigns authoritative employee records.
          representatives: [],
        },
      ]));
      return clone({
        areas,
        industries,
        branches: publicBranches,
        areaDirectory,
        preferredRepresentative: null,
      });
    },
  });
}
