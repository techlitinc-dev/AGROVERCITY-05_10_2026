const Map<String, List<String>> loanTransitions = {
  'submitted': ['underReview', 'cancelled'],
  'underReview': ['approved', 'rejected', 'infoRequested', 'cancelled'],
  'infoRequested': ['underReview'],
  'approved': ['disbursed', 'rejected'],
  'rejected': [],
  'disbursed': [],
  'cancelled': [],
};

const List<String> loanStatuses = [
  'submitted',
  'underReview',
  'infoRequested',
  'approved',
  'rejected',
  'disbursed',
  'cancelled',
];

const Map<String, String> loanStatusLabels = {
  'submitted': 'ऋण आवेदन जमा हुआ',
  'underReview': 'बैंक समीक्षा में',
  'infoRequested': 'अतिरिक्त जानकारी मांगी गई',
  'approved': 'ऋण स्वीकृत',
  'rejected': 'ऋण अस्वीकृत',
  'disbursed': 'राशि वितरित',
  'cancelled': 'आवेदन रद्द',
};
