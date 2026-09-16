// Android emulator -> host loopback. For web, run with
// --dart-define=API_BASE_URL=http://localhost:8000/v1
const String kApiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://10.0.2.2:8000/v1',
);

// hardcoded until package_info_plus is adopted
const String kAppVersion = "1.0.0";
