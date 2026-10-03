import 'package:flutter/material.dart';

import '../../api/api_exception.dart';
import '../../api/transport_api.dart';
import '../../core/photo_upload.dart';
import '../../state/app_state.dart';

// POD capture: delivery photo(s) + receiver name gate the delivered transition.
class PodSection extends StatefulWidget {
  const PodSection({
    super.key,
    required this.state,
    required this.bookingId,
    required this.api,
    required this.uploader,
    required this.onDelivered,
    required this.onError,
  });

  final AppState state;
  final String bookingId;
  final TransportApi api;
  final PhotoUploader uploader;
  final VoidCallback onDelivered;
  final void Function(String message) onError;

  @override
  State<PodSection> createState() => _PodSectionState();
}

class _PodSectionState extends State<PodSection> {
  final _receiverCtrl = TextEditingController();
  final List<String> _podPhotos = [];
  Map<String, dynamic> _fieldErrors = const {};
  bool _busy = false;

  @override
  void dispose() {
    _receiverCtrl.dispose();
    super.dispose();
  }

  Future<void> _addPhoto() async {
    final ts = DateTime.now().millisecondsSinceEpoch;
    try {
      final url =
          await widget.uploader.pickAndUpload('pod/${widget.bookingId}/$ts.jpg');
      if (url != null && mounted) setState(() => _podPhotos.add(url));
    } catch (_) {
      widget.onError(widget.state.tr('transporter.photoUploadFailed'));
    }
  }

  Future<void> _submit() async {
    if (_receiverCtrl.text.trim().isEmpty || _podPhotos.isEmpty || _busy) {
      return;
    }
    setState(() {
      _busy = true;
      _fieldErrors = const {};
    });
    try {
      await widget.api.updateBooking(
        widget.bookingId,
        'delivered',
        podPhotos: _podPhotos,
        receiverName: _receiverCtrl.text.trim(),
      );
      widget.onDelivered();
    } on ApiException catch (e) {
      if (!mounted) return;
      if (e.code == 'POD_REQUIRED') {
        setState(() => _fieldErrors = e.fieldErrors);
      } else {
        widget.onError(e.message.isNotEmpty ? e.message : e.code);
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final canSubmit =
        _receiverCtrl.text.trim().isNotEmpty && _podPhotos.isNotEmpty && !_busy;
    return Container(
      margin: const EdgeInsets.only(top: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(widget.state.tr('transporter.podTitle'), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900)),
          const SizedBox(height: 10),
          TextField(
            controller: _receiverCtrl,
            onChanged: (_) => setState(() {}),
            decoration: InputDecoration(
              labelText: widget.state.tr('transporter.receiverName'),
              border: const OutlineInputBorder(),
              errorText: _fieldErrors['receiverName'] as String?,
            ),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              TextButton.icon(
                onPressed: _podPhotos.length >= 3 ? null : _addPhoto,
                icon: const Icon(Icons.add_a_photo_rounded, size: 16),
                label: Text('${widget.state.tr('transporter.addPhoto')} (${_podPhotos.length}/3)'),
              ),
              if (_fieldErrors['podPhotos'] != null)
                Expanded(
                  child: Text(
                    "${_fieldErrors['podPhotos']}",
                    style: const TextStyle(fontSize: 11, color: Color(0xFFDC2626)),
                  ),
                ),
            ],
          ),
          if (_podPhotos.isNotEmpty)
            Text(widget.state.tr('transporter.photosUploaded').replaceAll('{count}', "${_podPhotos.length}"), style: const TextStyle(fontSize: 11.5, color: Color(0xFF166534), fontWeight: FontWeight.w700)),
          const SizedBox(height: 10),
          ElevatedButton(
            onPressed: canSubmit ? _submit : null,
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF16A34A), foregroundColor: Colors.white, minimumSize: const Size(double.infinity, 48)),
            child: Text(widget.state.tr('transporter.submitDelivery'), style: const TextStyle(fontWeight: FontWeight.w900)),
          ),
        ],
      ),
    );
  }
}
