// Farmer loan detail — status banner, terms, timeline, schedule, documents,
// respond-to-info-request & cancel actions.

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';

import '../../api/api_exception.dart';
import '../../api/loans_api.dart';
import '../../models/loan_application.dart';
import '../../models/loan_schedule_entry.dart';
import '../../state/app_state.dart';
import 'loan_detail_widgets.dart';
import 'loan_widgets.dart';

final _inr = NumberFormat('#,##,##0', 'en_IN');

class LoanDetailView extends StatefulWidget {
  final AppState state;
  final LoansApi? loansApi;
  const LoanDetailView({super.key, required this.state, this.loansApi});

  @override
  State<LoanDetailView> createState() => _LoanDetailViewState();
}

class _LoanDetailViewState extends State<LoanDetailView> {
  late final LoansApi _api = widget.loansApi ?? LoansApi();

  LoanApplication? _loan;
  List<LoanScheduleEntry> _schedule = [];
  bool _loading = true;
  bool _error = false;
  bool _uploading = false;

  String? get _loanId => widget.state.selectedLoanId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final id = _loanId;
    if (id == null) {
      setState(() => _loading = false);
      return;
    }
    setState(() {
      _loading = true;
      _error = false;
    });
    try {
      final loan = await _api.getLoan(id);
      if (!mounted) return;
      setState(() => _loan = loan);
      _loadSchedule(id);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e.code == 'LOAN_NOT_FOUND';
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = true;
      });
    }
  }

  Future<void> _loadSchedule(String id) async {
    try {
      final schedule = await _api.getSchedule(id);
      if (!mounted) return;
      setState(() {
        _schedule = schedule;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  void _snack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _respond() async {
    final loan = _loan;
    if (loan == null) return;
    final message = await showLoanMessageDialog(context,
        state: widget.state, title: widget.state.tr('loans.respondTitle'));
    if (message == null || !mounted) return;
    try {
      final updated = await _api.respond(loan.applicationId, message);
      if (!mounted) return;
      setState(() => _loan = updated);
      _snack(widget.state.tr('loans.respondedMsg'));
    } on ApiException catch (e) {
      if (e.code == 'LOAN_INVALID_TRANSITION') {
        _snack(e.message.isNotEmpty ? e.message : e.code);
        _load();
      } else {
        _snack(e.message.isNotEmpty ? e.message : e.code);
      }
    }
  }

  Future<void> _cancel() async {
    final loan = _loan;
    if (loan == null) return;
    final confirmed = await showLoanConfirmDialog(
      context,
      state: widget.state,
      title: widget.state.tr('loans.cancelTitle'),
      confirmLabel: widget.state.tr('loans.cancelApplication'),
    );
    if (!confirmed || !mounted) return;
    try {
      final updated = await _api.cancel(loan.applicationId);
      if (!mounted) return;
      setState(() => _loan = updated);
      _snack(widget.state.tr('loans.cancelledMsg'));
    } on ApiException catch (e) {
      _snack(e.message.isNotEmpty ? e.message : e.code);
      if (e.code == 'LOAN_INVALID_TRANSITION') _load();
    }
  }

  Future<void> _uploadImages() async {
    final picker = ImagePicker();
    final images = await picker.pickMultiImage();
    if (images.isEmpty) return;
    await _doUpload(images.map((e) => e.path).toList());
  }

  Future<void> _uploadPdf() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['pdf'],
      allowMultiple: true,
    );
    final files = result?.files ?? [];
    final paths = files.where((f) => f.path != null).map((f) => f.path!).toList();
    if (paths.isEmpty) return;
    await _doUpload(paths);
  }

  Future<void> _doUpload(List<String> paths) async {
    final loan = _loan;
    if (loan == null) return;
    setState(() => _uploading = true);
    try {
      final updated = await _api.uploadDocuments(loan.applicationId, paths);
      if (!mounted) return;
      setState(() => _loan = updated);
      _snack(widget.state.tr('loans.documentsTitle'));
    } on ApiException catch (e) {
      _snack(e.message.isNotEmpty ? e.message : e.code);
    } catch (e) {
      _snack('$e');
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = widget.state;
    if (_loading) {
      return const Center(
          child: CircularProgressIndicator(color: Color(0xFF43A047)));
    }
    final loan = _loan;
    if (_error || loan == null) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(state.tr('bank.loadFailed'),
                style: const TextStyle(
                    color: Colors.grey, fontWeight: FontWeight.w700)),
            const SizedBox(height: 10),
            ElevatedButton(onPressed: _load, child: Text(state.tr('retry'))),
          ],
        ),
      );
    }
    final color = loanStatusColor(loan.status);

    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(18, 14, 18, 100),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Status banner header
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [color, Color.lerp(color, Colors.black, 0.25) ?? color],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        loanStatusLabel(state, loan.status),
                        style: const TextStyle(
                            color: Colors.white,
                            fontSize: 13,
                            fontWeight: FontWeight.w900),
                      ),
                    ),
                    if (loan.applicationNumber != null &&
                        loan.applicationNumber!.isNotEmpty)
                      Text("#${loan.applicationNumber}",
                          style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.85),
                              fontSize: 12,
                              fontWeight: FontWeight.w700)),
                  ],
                ),
                const SizedBox(height: 8),
                Text(loan.purpose,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        color: Colors.white,
                        fontSize: 17,
                        fontWeight: FontWeight.w900)),
                const SizedBox(height: 4),
                Text(
                  "₹${_inr.format(loan.amount.toInt())} • ${loan.tenureMonths} ${state.tr('loans.monthsUnit')} • ${state.tr('loans.appliedOn')} ${formatLoanDate(loan.createdAt)}",
                  style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.9),
                      fontSize: 11.5),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          LoanTermsCard(state: state, loan: loan),

          if (loan.status == LoanStatus.rejected &&
              loan.rejectionReason != null)
            Container(
              width: double.infinity,
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFFFEF2F2),
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: const Color(0xFFFCA5A5)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(state.tr('loans.rejectionReason'),
                      style: const TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFFDC2626))),
                  const SizedBox(height: 4),
                  Text(loan.rejectionReason!,
                      style: const TextStyle(
                          fontSize: 12.5, color: Color(0xFF7F1D1D))),
                ],
              ),
            ),

          if (loan.status == LoanStatus.disbursed)
            LoanSectionCard(
              state: state,
              title: state.tr('loans.disbursement'),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (loan.disbursementRef != null)
                    loanKvRow(
                        state.tr('loans.disbursementRef'),
                        loan.disbursementRef!),
                  if (loan.disbursedAt != null)
                    loanKvRow(state.tr('loans.disbursedOn'),
                        formatLoanDate(loan.disbursedAt!)),
                ],
              ),
            ),

          // Timeline
          if (loan.timeline.isNotEmpty)
            LoanSectionCard(
              state: state,
              title: state.tr('loans.timelineTitle'),
              child: LoanTimelineView(state: state, entries: loan.timeline),
            ),

          // Repayment schedule (whatever the backend returns; usually only
          // populated after sanction).
          LoanSectionCard(
            state: state,
            title: state.tr('loans.scheduleTitle'),
            child: _schedule.isEmpty
                ? Text(state.tr('loans.scheduleEmpty'),
                    style: TextStyle(
                        fontSize: 12, color: Colors.grey.shade600))
                : LoanScheduleTable(state: state, entries: _schedule),
          ),

          // Documents
          LoanDocumentsSection(
            state: state,
            documents: loan.documents,
            uploading: _uploading,
            onUploadImages: _uploadImages,
            onUploadPdf: _uploadPdf,
          ),

          // Farmer actions
          if (loan.canRespond)
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: _respond,
                style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF7C3AED),
                    foregroundColor: Colors.white,
                    minimumSize: const Size(double.infinity, 44)),
                icon: const Icon(Icons.reply_rounded, size: 16),
                label: Text(state.tr('loans.respond'),
                    style: const TextStyle(fontWeight: FontWeight.w800)),
              ),
            ),
          if (loan.canCancel) ...[
            if (loan.canRespond) const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: _cancel,
                style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFFDC2626),
                    side: const BorderSide(color: Color(0xFFDC2626)),
                    minimumSize: const Size(double.infinity, 44)),
                icon: const Icon(Icons.cancel_outlined, size: 16),
                label: Text(state.tr('loans.cancelApplication'),
                    style: const TextStyle(fontWeight: FontWeight.w800)),
              ),
            ),
          ],
          const SizedBox(height: 8),
        ],
      ),
    );
  }
}
