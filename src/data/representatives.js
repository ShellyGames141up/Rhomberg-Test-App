import { nearestBranchForArea } from './branches.js';

const makeRepresentative = (branchId, branchCode, code, name) => ({
  id: `${branchCode}-${code}`,
  branchId,
  branchCode,
  code,
  name,
});

export const representativesByBranch = {
  'cape-town': [
    ['01', 'Hugo Vercuiel'],
    ['11', 'Alphonso Majiet'],
    ['13', 'Andrew Japhtha'],
    ['14', 'Quintin van Wyk'],
    ['15', 'Dawie Grobbelaar'],
    ['17', 'Arthur Daniels'],
    ['18', 'Getruida'],
    ['19', 'Kevin Thompson'],
    ['25', 'Reneil'],
    ['26', 'Siya'],
    ['27', 'Ericu Vercuiel'],
  ].map(([code, name]) => makeRepresentative('cape-town', 'C', code, name)),
  durban: [
    ['01', 'Hugo Vercuiel'],
    ['03', 'Hugo Vercuiel Durban'],
    ['06', 'Salome van der Walt'],
    ['12', 'Paul Nash'],
    ['13', 'Andrew Japhtha'],
    ['14', 'Quinton van Wyk'],
    ['15', 'Dawie Grobbelaar'],
    ['16', 'Coenie'],
    ['17', 'Arthur Daniels'],
    ['21', 'Amy Riley'],
  ].map(([code, name]) => makeRepresentative('durban', 'D', code, name)),
  johannesburg: [
    ['01', 'Hugo Vercuiel'],
    ['10', 'Alison'],
    ['14', 'Quinton van Wyk'],
    ['15', 'Dawie Grobbelaar'],
    ['16', 'Grant Stoffels'],
    ['18', 'Andrew COD JHB'],
    ['19', 'Hugo VDM'],
    ['20', 'Tammy Landey'],
    ['21', 'Danny'],
    ['22', 'Hugo van der Merwe'],
    ['23', 'Siya'],
    ['24', 'Rowlen'],
    ['25', 'Reneil'],
    ['26', 'Siya'],
  ].map(([code, name]) => makeRepresentative('johannesburg', 'J', code, name)),
  'port-elizabeth': [
    ['15', 'Dawi'],
    ['16', 'Carmen Bellew'],
  ].map(([code, name]) => makeRepresentative('port-elizabeth', 'P', code, name)),
};

export const representatives = Object.values(representativesByBranch).flat();

export const representativesForArea = area => {
  const branch = nearestBranchForArea(area);
  return { branch, representatives: representativesByBranch[branch.id] || [] };
};

export const representativeById = id => representatives.find(representative => representative.id === id) || null;
