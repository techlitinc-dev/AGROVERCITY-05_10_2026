// Instructor upload sheet — create a course / audio / video podcast and
// submit it for superadmin review.

import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:flutter/material.dart';

import '../../state/app_state.dart';

/// Injectable uploader so widget tests can fake Firebase Storage.
class CourseMediaUploader {
  const CourseMediaUploader();

  Future<String> uploadBytes(String storagePath, Uint8List bytes) async {
    final ref = FirebaseStorage.instance.ref(storagePath);
    await ref.putData(bytes);
    return ref.getDownloadURL();
  }
}

class CourseUploadResult {
  const CourseUploadResult({
    required this.title,
    required this.description,
    required this.kind,
    required this.language,
    required this.category,
    required this.priceRupees,
    this.thumbnailUrl,
    this.mediaUrl,
  });

  final String title;
  final String description;
  final String kind;
  final String language;
  final String category;
  final double priceRupees;
  final String? thumbnailUrl;
  final String? mediaUrl;
}

class CourseUploadSheet extends StatefulWidget {
  const CourseUploadSheet({
    super.key,
    required this.state,
    required this.instructorId,
    required this.onSubmit,
    this.uploader = const CourseMediaUploader(),
  });

  final AppState state;
  final String instructorId;
  final Future<void> Function(CourseUploadResult result) onSubmit;
  final CourseMediaUploader uploader;

  static Future<void> show(
    BuildContext context, {
    required AppState state,
    required String instructorId,
    required Future<void> Function(CourseUploadResult result) onSubmit,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => CourseUploadSheet(
        state: state,
        instructorId: instructorId,
        onSubmit: onSubmit,
      ),
    );
  }

  @override
  State<CourseUploadSheet> createState() => _CourseUploadSheetState();
}

class _CourseUploadSheetState extends State<CourseUploadSheet> {
  static const kinds = ['courseMaterial', 'audioPodcast', 'videoPodcast'];
  static const categories = [
    'Agronomy',
    'Pest Management',
    'Dairy & Livestock',
    'Horticulture',
    'Soil Health',
    'Farm Machinery',
    'Organic Farming',
    'Agri Business',
  ];

  final _title = TextEditingController();
  final _description = TextEditingController();
  String _kind = 'videoPodcast';
  String _category = 'Agronomy';
  String _language = 'hi';
  double _price = 0;

  String? _mediaFileName;
  Uint8List? _mediaBytes;
  String? _thumbnailFileName;
  Uint8List? _thumbnailBytes;

  bool _uploading = false;

  @override
  void dispose() {
    _title.dispose();
    _description.dispose();
    super.dispose();
  }

  String tr(String key) => widget.state.tr(key);

  FileType get _pickerType => switch (_kind) {
        'videoPodcast' => FileType.video,
        'audioPodcast' => FileType.audio,
        _ => FileType.custom,
      };

  Future<void> _pickMedia() async {
    final picked = await FilePicker.platform.pickFiles(
      type: _pickerType,
      withData: true,
      allowedExtensions: _kind == 'courseMaterial'
          ? ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'zip']
          : null,
    );
    final file = picked?.files.firstOrNull;
    if (file == null) return;
    setState(() {
      _mediaFileName = file.name;
      _mediaBytes = file.bytes;
    });
  }

  Future<void> _pickThumbnail() async {
    final picked = await FilePicker.platform.pickFiles(
      type: FileType.image,
      withData: true,
    );
    final file = picked?.files.firstOrNull;
    if (file == null) return;
    setState(() {
      _thumbnailFileName = file.name;
      _thumbnailBytes = file.bytes;
    });
  }

  String _slug(String name) =>
      name.replaceAll(RegExp(r'[^a-zA-Z0-9._-]'), '_');

  Future<void> _submit() async {
    if (_title.text.trim().length < 3) {
      widget.state.showToast(tr('courseTitleLabel'));
      return;
    }
    if (_mediaBytes == null) {
      widget.state.showToast(tr('pickMediaFile'));
      return;
    }
    setState(() => _uploading = true);
    try {
      final stamp = DateTime.now().millisecondsSinceEpoch;
      final base = 'courses/${widget.instructorId}/$stamp';
      final mediaUrl = await widget.uploader
          .uploadBytes('$base/${_slug(_mediaFileName ?? 'media')}', _mediaBytes!);
      String? thumbnailUrl;
      if (_thumbnailBytes != null) {
        thumbnailUrl = await widget.uploader
            .uploadBytes('$base/${_slug(_thumbnailFileName ?? 'thumb.jpg')}', _thumbnailBytes!);
      }
      await widget.onSubmit(CourseUploadResult(
        title: _title.text.trim(),
        description: _description.text.trim(),
        kind: _kind,
        language: _language,
        category: _category,
        priceRupees: _price,
        thumbnailUrl: thumbnailUrl,
        mediaUrl: mediaUrl,
      ));
      if (mounted) Navigator.pop(context);
    } catch (e) {
      widget.state.showToast('Upload failed: $e');
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.92,
      minChildSize: 0.6,
      builder: (context, scrollController) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
        padding: const EdgeInsets.fromLTRB(20, 14, 20, 18),
        child: ListView(
          controller: scrollController,
          children: [
            Center(
              child: Container(
                width: 44,
                height: 4.5,
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
            ),
            const SizedBox(height: 12),
            Text(
              tr('uploadNew'),
              style: const TextStyle(
                  fontSize: 18, fontWeight: FontWeight.w900, color: Color(0xFF112A1F)),
            ),
            const SizedBox(height: 14),
            Text(tr('courseTitleLabel'),
                style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
            TextField(
              controller: _title,
              decoration: InputDecoration(
                hintText: tr('courseTitleLabel'),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                isDense: true,
              ),
            ),
            const SizedBox(height: 10),
            Text(tr('courseDescLabel'),
                style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
            TextField(
              controller: _description,
              maxLines: 3,
              decoration: InputDecoration(
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                isDense: true,
              ),
            ),
            const SizedBox(height: 10),
            Text('Kind',
                style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
            Wrap(
              spacing: 8,
              children: [
                for (final k in kinds)
                  ChoiceChip(
                    label: Text(switch (k) {
                      'courseMaterial' => tr('kindCourseMaterial'),
                      'audioPodcast' => tr('kindAudioPodcast'),
                      _ => tr('kindVideoPodcast'),
                    }),
                    selected: _kind == k,
                    onSelected: (_) => setState(() => _kind = k),
                  ),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: DropdownButtonFormField<String>(
                    initialValue: _category,
                    decoration: InputDecoration(
                      labelText: tr('categoryLabel'),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      isDense: true,
                    ),
                    items: [
                      for (final c in categories)
                        DropdownMenuItem(value: c, child: Text(c)),
                    ],
                    onChanged: (v) => setState(() => _category = v ?? _category),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: DropdownButtonFormField<String>(
                    initialValue: _language,
                    decoration: InputDecoration(
                      labelText: tr('language'),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      isDense: true,
                    ),
                    items: const [
                      DropdownMenuItem(value: 'hi', child: Text('हिन्दी')),
                      DropdownMenuItem(value: 'mr', child: Text('मराठी')),
                      DropdownMenuItem(value: 'en', child: Text('English')),
                    ],
                    onChanged: (v) => setState(() => _language = v ?? _language),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Text(tr('priceLabel'),
                    style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
                Expanded(
                  child: Slider(
                    value: _price,
                    min: 0,
                    max: 2000,
                    divisions: 40,
                    label: _price == 0 ? tr('freeLabel') : '₹${_price.round()}',
                    onChanged: (v) => setState(() => _price = v),
                  ),
                ),
                Text(
                  _price == 0 ? tr('freeLabel') : '₹${_price.round()}',
                  style: const TextStyle(fontWeight: FontWeight.w900),
                ),
              ],
            ),
            const SizedBox(height: 6),
            OutlinedButton.icon(
              onPressed: _pickMedia,
              icon: const Icon(Icons.upload_file_rounded, size: 18),
              label: Text(
                _mediaFileName ?? tr('pickMediaFile'),
                overflow: TextOverflow.ellipsis,
              ),
            ),
            if (_kind != 'courseMaterial')
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: OutlinedButton.icon(
                  onPressed: _pickThumbnail,
                  icon: const Icon(Icons.image_rounded, size: 18),
                  label: Text(
                    _thumbnailFileName ?? tr('pickThumbnail'),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: _uploading ? null : _submit,
              icon: _uploading
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.send_rounded),
              label: Text(tr('submitForReview')),
            ),
          ],
        ),
      ),
    );
  }
}
