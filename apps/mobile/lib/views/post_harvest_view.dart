// Module O: Post-Harvest Supply Chain — API-wired port (Day 14 Tasks B1/B5).
// Cold-storage cards ← GET /v1/post-harvest/cold-storage (+ बुक करें booking
// dialog → POST /cold-storage/{id}/book); AI grading card ← multipart
// POST /v1/post-harvest/grade (1–3 photos).

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../api/api_exception.dart';
import '../api/post_harvest_api.dart';
import '../components/common/audio_button.dart';
import '../models/post_harvest_models.dart';
import '../state/app_state.dart';
import 'post_harvest_widgets.dart';

class PostHarvestView extends StatefulWidget {
  final AppState state;
  final PostHarvestApi? postHarvestApi;
  // Injectable for tests; defaults to the gallery multi-picker (1–3 images).
  final Future<List<XFile>> Function()? pickImages;

  const PostHarvestView({
    super.key,
    required this.state,
    this.postHarvestApi,
    this.pickImages,
  });

  @override
  State<PostHarvestView> createState() => _PostHarvestViewState();
}

class _PostHarvestViewState extends State<PostHarvestView> {
  late final PostHarvestApi _api = widget.postHarvestApi ?? PostHarvestApi();

  List<ColdStorageFacility> _facilities = const [];
  GradeResult? _grade;
  bool _loading = true;
  bool _error = false;
  bool _grading = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  (double?, double?) get _latLng {
    final points = widget.state.profile.farmBoundaryPoints;
    if (points.isEmpty) return (null, null);
    return (points.first['lat'], points.first['lng']);
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = false;
    });
    try {
      final (lat, lng) = _latLng;
      final facilities = await _api.listColdStorage(lat: lat, lng: lng);
      if (!mounted) return;
      setState(() {
        _facilities = facilities;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = true;
      });
    }
  }

  void _snack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.maybeOf(context)
        ?.showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _gradeProduce() async {
    if (_grading) return;
    final picker =
        widget.pickImages ?? () => ImagePicker().pickMultiImage(limit: 3);
    final images = (await picker()).take(3).toList();
    if (images.isEmpty || !mounted) return;
    setState(() => _grading = true);
    try {
      final result = await _api.grade(images);
      if (!mounted) return;
      setState(() {
        _grade = result;
        _grading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _grading = false);
      _snack(e.message.isNotEmpty
          ? e.message
          : widget.state.tr('postHarvest.gradingFailed'));
    }
  }

  void _openBookDialog(ColdStorageFacility facility) {
    showDialog(
      context: context,
      builder: (ctx) => ColdStorageBookDialog(
        facility: facility,
        state: widget.state,
        onSubmit: (quantity, fromDate, months) =>
            _book(facility, quantity, fromDate, months),
      ),
    );
  }

  Future<void> _book(ColdStorageFacility facility, double quantityQuintals,
      String fromDate, int months) async {
    try {
      await _api.bookColdStorage(
        facility.id,
        quantityQuintals: quantityQuintals,
        fromDate: fromDate,
        months: months,
      );
      _snack(widget.state.tr('postHarvest.storageBooked'));
      _load(); // refresh the card's available figure
    } on ApiException catch (e) {
      _snack(e.code == 'INSUFFICIENT_CAPACITY'
          ? widget.state.tr('postHarvest.insufficientCapacity')
          : (e.message.isNotEmpty ? e.message : e.code));
    }
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(18, 14, 18, 100),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(widget.state.tr('postHarvest.title'),
                      style: const TextStyle(
                          fontSize: 20, fontWeight: FontWeight.w800)),
                  Text(widget.state.tr('postHarvest.subtitle'),
                      style: const TextStyle(
                          fontSize: 12, color: Colors.grey)),
                ],
              ),
              AudioButton(text: widget.state.tr('postHarvest.audioSummary')),
            ],
          ),
          const SizedBox(height: 14),

          if (_loading)
            const Center(
              child: Padding(
                padding: EdgeInsets.symmetric(vertical: 60),
                child: CircularProgressIndicator(color: Color(0xFF1B4332)),
              ),
            )
          else if (_error)
            Center(
              child: Column(
                children: [
                  const SizedBox(height: 40),
                  Text(widget.state.tr('postHarvest.loadFailed'),
                      style: const TextStyle(
                          color: Colors.grey, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 10),
                  ElevatedButton(
                      onPressed: _load,
                      child: Text(widget.state.tr('retry'))),
                ],
              ),
            )
          else ...[
            // Cold Storages
            if (_facilities.isEmpty)
              Text(widget.state.tr('postHarvest.noColdStorageNearby'),
                  style: const TextStyle(fontSize: 12, color: Colors.grey))
            else
              for (final f in _facilities)
                ColdStorageCard(
                  facility: f,
                  state: widget.state,
                  onBook: () => _openBookDialog(f),
                ),
            const SizedBox(height: 4),

            // Quality Grading
            if (_grade != null)
              GradeResultCard(
                result: _grade!,
                state: widget.state,
                grading: _grading,
                onGrade: _gradeProduce,
              )
            else
              GradePickCard(
                  state: widget.state,
                  grading: _grading,
                  onGrade: _gradeProduce),
          ],
        ],
      ),
    );
  }
}
