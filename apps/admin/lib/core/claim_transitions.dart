const Map<String, List<String>> claimTransitions = {
  'intimated': ['surveyorAssigned'],
  'surveyorAssigned': ['fieldAssessed'],
  'fieldAssessed': ['dbtApproved', 'rejected'],
  'dbtApproved': ['disbursed'],
  'disbursed': [],
  'rejected': [],
};

const List<String> claimStatuses = [
  'intimated',
  'surveyorAssigned',
  'fieldAssessed',
  'dbtApproved',
  'disbursed',
  'rejected',
];

const Map<String, String> claimStatusLabels = {
  'intimated': 'दर्ज',
  'surveyorAssigned': 'सर्वेयर नियुक्त',
  'fieldAssessed': 'मूल्यांकन पूर्ण',
  'dbtApproved': 'DBT स्वीकृत',
  'disbursed': 'वितरित',
  'rejected': 'अस्वीकृत',
};
