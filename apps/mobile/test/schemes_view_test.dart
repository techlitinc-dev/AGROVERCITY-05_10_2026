import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kisan_setu/api/api_exception.dart';
import 'package:kisan_setu/api/schemes_api.dart';
import 'package:kisan_setu/api/soil_tests_api.dart';
import 'package:kisan_setu/api/vault_api.dart';
import 'package:kisan_setu/models/govt_scheme.dart';
import 'package:kisan_setu/models/vault_document.dart';
import 'package:kisan_setu/views/schemes_view.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'helpers.dart';

class FakeSchemesApi extends SchemesApi {
  List<GovtScheme> schemes = const [];
  List<PortalEntry> portals = const [];
  Object? applyError;

  String? lastCategory;
  bool? lastEligibleOnly;
  final List<List<String>> applyCalls = [];

  @override
  Future<List<GovtScheme>> listSchemes({
    String? category,
    bool eligibleOnly = false,
  }) async {
    lastCategory = category;
    lastEligibleOnly = eligibleOnly;
    return schemes;
  }

  @override
  Future<Map<String, dynamic>> applyScheme(
    String schemeId,
    List<String> documentIds,
  ) async {
    applyCalls.add(documentIds);
    final error = applyError;
    if (error != null) throw error;
    return {'applicationId': schemeId, 'status': 'submitted'};
  }

  @override
  Future<List<PortalEntry>> getPortals() async => portals;
}

class FakeVaultApi extends VaultApi {
  List<VaultDocument> documents = const [];
  final List<String> deleteCalls = [];

  @override
  Future<List<VaultDocument>> listDocuments() async => documents;

  @override
  Future<void> deleteDocument(String id) async {
    deleteCalls.add(id);
  }
}

class FakeSoilTestsApi extends SoilTestsApi {
  @override
  Future<List<Map<String, dynamic>>> listSoilTests() async => const [];
}

GovtScheme _scheme(String id, {bool eligible = false, String category = 'income-support'}) =>
    GovtScheme(
      id: id,
      name: 'Scheme $id',
      category: category,
      eligible: eligible,
      benefitAmount: '₹6,000/वर्ष',
      documentsRequired: const ['Aadhaar', '7/12'],
      status: 'open',
      nextDeadline: '2026-12-31',
      description: 'विवरण',
    );

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('schemes list renders with eligibility badge', (tester) async {
    final api = FakeSchemesApi()
      ..schemes = [_scheme('pmkisan', eligible: true), _scheme('pmfby')];

    await pumpScreen(
      tester,
      Scaffold(
        body: SchemesView(
          state: TestAppState(),
          schemesApi: api,
          vaultApi: FakeVaultApi(),
          soilTestsApi: FakeSoilTestsApi(),
        ),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));
    await tester.pump(const Duration(seconds: 1));

    expect(find.text('पात्र ✓'), findsOneWidget);
    expect(find.text('Scheme pmkisan'), findsOneWidget);
    expect(find.text('Scheme pmfby'), findsOneWidget);
  });

  testWidgets('duplicate apply shows snackbar', (tester) async {
    final api = FakeSchemesApi()
      ..schemes = [_scheme('pmkisan', eligible: true)]
      ..applyError = const ApiException(code: 'ALREADY_APPLIED');
    final vault = FakeVaultApi()
      ..documents = const [
        VaultDocument(
          id: 'doc1',
          docType: 'aadhaar',
          fileName: 'aadhaar.png',
          downloadUrl: 'https://fake.example/a.png',
          uploadedAt: '2026-09-17',
          sizeBytes: 1024,
        ),
      ];

    await pumpScreen(
      tester,
      Scaffold(
        body: SchemesView(
          state: TestAppState(),
          schemesApi: api,
          vaultApi: vault,
          soilTestsApi: FakeSoilTestsApi(),
        ),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));
    await tester.pump(const Duration(seconds: 1));

    await tester.tap(find.text('ऐप से आवेदन करें'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(find.text('आधार कार्ड'), findsOneWidget);

    await tester.tap(find.text('आवेदन जमा करें'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(api.applyCalls.length, 1);
    expect(find.text('पहले से आवेदन किया हुआ'), findsOneWidget);
  });
}
