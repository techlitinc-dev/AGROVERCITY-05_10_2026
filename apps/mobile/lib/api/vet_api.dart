// Vet workspace + appointments + prescriptions + vaccination campaigns.
// Contract: backend/app/routers/livestock_vets.py.

import '../models/livestock_mgmt_models.dart';
import 'api_client.dart';
import 'endpoints.dart';

List<T> _list<T>(Map<String, dynamic> res, T Function(Map<String, dynamic>) f) =>
    ((res['data'] as List?) ?? const <dynamic>[])
        .map((e) => f((e as Map).cast<String, dynamic>()))
        .toList();

class VetApi {
  VetApi({ApiClient? client}) : _client = client ?? ApiClient();

  final ApiClient _client;

  // --- Managed vet directory (dairyManager) ---

  Future<List<ManagedVet>> listManagedVets() async {
    final res = await _client.get(pathVetsManaged);
    return _list(res, ManagedVet.fromJson);
  }

  Future<ManagedVet> createManagedVet(Map<String, dynamic> body) async {
    final res = await _client.post(pathVetsManaged, body: body);
    return ManagedVet.fromJson((res as Map).cast<String, dynamic>());
  }

  Future<ManagedVet> updateManagedVet(
    String vetId,
    Map<String, dynamic> body,
  ) async {
    final res = await _client.put(vetManagedPath(vetId), body: body);
    return ManagedVet.fromJson((res as Map).cast<String, dynamic>());
  }

  Future<ManagedVet> deactivateManagedVet(String vetId) async {
    final res = await _client.delete(vetManagedPath(vetId));
    return ManagedVet.fromJson((res as Map).cast<String, dynamic>());
  }

  // --- Claim & workspace ---

  /// Claims the vet profile whose phone matches the user's. Throws
  /// ApiException(404 VET_NOT_FOUND / 409 ALREADY_CLAIMED) otherwise.
  Future<ManagedVet> claimVetProfile() async {
    final res = await _client.post(pathVetsClaim);
    return ManagedVet.fromJson((res as Map).cast<String, dynamic>());
  }

  Future<VetWorkspace> getMyVetProfile() async {
    final res = await _client.get(pathVetsMe);
    return VetWorkspace.fromJson((res as Map).cast<String, dynamic>());
  }

  Future<VetSchedule> getMySchedule() async {
    final res = await _client.get(pathVetsMeSchedule);
    return VetSchedule.fromJson((res as Map).cast<String, dynamic>());
  }

  Future<VetSchedule> updateMySchedule(Map<String, dynamic> body) async {
    final res = await _client.put(pathVetsMeSchedule, body: body);
    return VetSchedule.fromJson((res as Map).cast<String, dynamic>());
  }

  Future<List<Appointment>> getMyAppointments({
    String? status,
    String? date,
  }) async {
    final res = await _client.get(pathVetsMeAppointments, query: {
      if (status != null && status.isNotEmpty) 'status': status,
      if (date != null && date.isNotEmpty) 'date': date,
    });
    return _list(res, Appointment.fromJson);
  }

  Future<VetEarnings> getMyEarnings({String? month}) async {
    final res = await _client.get(pathVetsMeEarnings, query: {
      if (month != null && month.isNotEmpty) 'month': month,
    });
    return VetEarnings.fromJson((res as Map).cast<String, dynamic>());
  }

  // --- Appointments (farmer-facing + status transitions) ---

  Future<Appointment> createAppointment(Map<String, dynamic> body) async {
    final res = await _client.post(pathLivestockAppointments, body: body);
    return Appointment.fromJson((res as Map).cast<String, dynamic>());
  }

  Future<List<Appointment>> listMyAppointments({String? status}) async {
    final res = await _client.get(pathLivestockAppointments, query: {
      if (status != null && status.isNotEmpty) 'status': status,
    });
    return _list(res, Appointment.fromJson);
  }

  Future<Appointment> updateAppointmentStatus(
    String apptId,
    Map<String, dynamic> body,
  ) async {
    final res = await _client.post(
      livestockAppointmentStatusPath(apptId),
      body: body,
    );
    return Appointment.fromJson((res as Map).cast<String, dynamic>());
  }

  // --- Prescriptions ---

  Future<Prescription> createPrescription(Map<String, dynamic> body) async {
    final res = await _client.post(pathLivestockPrescriptions, body: body);
    return Prescription.fromJson((res as Map).cast<String, dynamic>());
  }

  Future<List<Prescription>> listPrescriptions({String? animalId}) async {
    final res = await _client.get(pathLivestockPrescriptions, query: {
      if (animalId != null && animalId.isNotEmpty) 'animalId': animalId,
    });
    return _list(res, Prescription.fromJson);
  }

  // --- Vaccination campaigns ---

  Future<List<VaccinationCampaign>> listCampaigns({String? status}) async {
    final res = await _client.get(pathVetCampaigns, query: {
      if (status != null && status.isNotEmpty) 'status': status,
    });
    return _list(res, VaccinationCampaign.fromJson);
  }

  Future<VaccinationCampaign> getCampaign(String campaignId) async {
    final res = await _client.get(vetCampaignPath(campaignId));
    return VaccinationCampaign.fromJson((res as Map).cast<String, dynamic>());
  }

  Future<VaccinationCampaign> createCampaign(Map<String, dynamic> body) async {
    final res = await _client.post(pathVetCampaigns, body: body);
    return VaccinationCampaign.fromJson((res as Map).cast<String, dynamic>());
  }

  Future<CampaignEnrollment> enrollCampaign(
    String campaignId,
    String animalId,
  ) async {
    final res = await _client.post(
      vetCampaignEnrollPath(campaignId),
      body: {'animalId': animalId},
    );
    return CampaignEnrollment.fromJson((res as Map).cast<String, dynamic>());
  }

  Future<CampaignEnrollment> markVaccinated(
    String campaignId,
    String animalId,
  ) async {
    final res = await _client.post(
      vetCampaignMarkVaccinatedPath(campaignId),
      body: {'animalId': animalId},
    );
    return CampaignEnrollment.fromJson((res as Map).cast<String, dynamic>());
  }
}
