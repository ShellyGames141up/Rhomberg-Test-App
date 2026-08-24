export const areas = [
  'Western Cape',
  'Gauteng',
  'KwaZulu-Natal',
  'Eastern Cape',
  'Free State',
  'Limpopo',
  'Mpumalanga',
  'North West',
  'Northern Cape',
  'International',
];

export const branches = [
  {
    id: 'cape-town',
    name: 'Cape Town',
    role: 'Manufacturing & Head Office',
    address: 'Cnr Barlinka & Muscat Street, Saxenburg Park, Blackheath, Cape Town, 7579',
    phone: '021 905 7041',
  },
  {
    id: 'johannesburg',
    name: 'Johannesburg',
    role: 'Gauteng branch',
    address: 'Unit 19, Great North Industrial Park, 20 Van Wyk Road, Brentwood Park, Benoni, 1501',
    phone: '011 453 3337',
  },
  {
    id: 'durban',
    name: 'Durban',
    role: 'KwaZulu-Natal branch',
    address: '43 Island Circle, Riverhorse Valley, Newlands East, Durban',
    phone: '031 941 5944',
  },
  {
    id: 'port-elizabeth',
    name: 'Port Elizabeth',
    role: 'Eastern Cape branch',
    address: 'Warehouse 3, 99 Circular Drive, Fairview, Port Elizabeth',
    phone: '041 451 0325',
  },
];

const branchById = id => branches.find(branch => branch.id === id) || branches[0];

const nearestBranchByArea = {
  'Western Cape': 'cape-town',
  'Northern Cape': 'cape-town',
  Gauteng: 'johannesburg',
  'Free State': 'johannesburg',
  Limpopo: 'johannesburg',
  Mpumalanga: 'johannesburg',
  'North West': 'johannesburg',
  'KwaZulu-Natal': 'durban',
  'Eastern Cape': 'port-elizabeth',
  International: 'cape-town',
};

export const nearestBranchForArea = area => branchById(nearestBranchByArea[area] || 'cape-town');
