import 'package:flutter/material.dart';

import '../../api/courses_api.dart';
import '../../state/app_state.dart';

class CourseBuilderSheet extends StatefulWidget {
  const CourseBuilderSheet({
    super.key,
    required this.state,
    this.api,
    this.onSaved,
  });

  final AppState state;
  final CoursesApi? api;
  final VoidCallback? onSaved;

  static Future<void> show(
    BuildContext context, {
    required AppState state,
    CoursesApi? api,
    VoidCallback? onSaved,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => CourseBuilderSheet(
        state: state,
        api: api,
        onSaved: onSaved,
      ),
    );
  }

  @override
  State<CourseBuilderSheet> createState() => _CourseBuilderSheetState();
}

class _CourseBuilderSheetState extends State<CourseBuilderSheet> {
  late final CoursesApi _api = widget.api ?? CoursesApi();

  final _titleController = TextEditingController();
  final _descController = TextEditingController();
  final _priceController = TextEditingController(text: '499');
  final _discountController = TextEditingController(text: '100');
  final _trailerController = TextEditingController();

  String _category = 'Agronomy';
  String _level = 'All Levels';
  final String _kind = 'courseMaterial';
  bool _saving = false;

  final List<Map<String, dynamic>> _modules = [];

  static const categories = [
    'Agronomy',
    'Organic Farming',
    'Dairy & Livestock',
    'Polyhouse & Hydroponics',
    'AgTech & Drones',
    'Agri Business',
  ];

  static const levels = [
    'All Levels',
    'Beginner',
    'Intermediate',
    'Advanced',
  ];

  @override
  void dispose() {
    _titleController.dispose();
    _descController.dispose();
    _priceController.dispose();
    _discountController.dispose();
    _trailerController.dispose();
    super.dispose();
  }

  void _addModule() {
    setState(() {
      final index = _modules.length + 1;
      _modules.add({
        'id': 'mod_$index',
        'title': 'Module $index: New Section',
        'order': index,
        'lessons': <Map<String, dynamic>>[],
      });
    });
  }

  void _addLesson(int moduleIndex) {
    showDialog(
      context: context,
      builder: (ctx) {
        final titleCtrl = TextEditingController();
        final durCtrl = TextEditingController(text: '15');
        final videoCtrl = TextEditingController();
        bool isPreview = false;

        return StatefulBuilder(
          builder: (context, setDlgState) => AlertDialog(
            title: const Text('Add Lesson', style: TextStyle(fontSize: 16)),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(
                    controller: titleCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Lesson Title',
                      hintText: 'e.g. Drip Irrigation Calibration',
                    ),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: durCtrl,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      labelText: 'Duration (Minutes)',
                    ),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: videoCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Video Stream URL (Optional)',
                    ),
                  ),
                  const SizedBox(height: 10),
                  CheckboxListTile(
                    title: const Text('Allow Free Preview',
                        style: TextStyle(fontSize: 13)),
                    value: isPreview,
                    onChanged: (v) =>
                        setDlgState(() => isPreview = v ?? false),
                    contentPadding: EdgeInsets.zero,
                  ),
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Cancel'),
              ),
              FilledButton(
                style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFF1B4332)),
                onPressed: () {
                  final t = titleCtrl.text.trim();
                  if (t.isEmpty) return;
                  Navigator.pop(ctx);
                  setState(() {
                    final lessons = _modules[moduleIndex]['lessons']
                        as List<Map<String, dynamic>>;
                    final lIndex = lessons.length + 1;
                    lessons.add({
                      'id': 'les_${moduleIndex + 1}_$lIndex',
                      'title': t,
                      'durationMinutes': int.tryParse(durCtrl.text) ?? 15,
                      'videoUrl': videoCtrl.text.trim(),
                      'isPreview': isPreview,
                      'order': lIndex,
                    });
                  });
                },
                child: const Text('Add'),
              ),
            ],
          ),
        );
      },
    );
  }

  Future<void> _publishCourse() async {
    final title = _titleController.text.trim();
    if (title.isEmpty) {
      widget.state.showToast('Please enter a course title');
      return;
    }
    if (_modules.isEmpty) {
      widget.state.showToast('Add at least one module with lessons first');
      return;
    }
    final price = double.tryParse(_priceController.text) ?? 0;
    final maxDiscount = int.tryParse(_discountController.text) ?? 0;

    setState(() => _saving = true);
    try {
      await _api.createCourse(
        title: title,
        description: _descController.text.trim(),
        category: _category,
        level: _level,
        kind: _kind,
        priceRupees: price,
        maxCoinsDiscount: maxDiscount,
        previewUrl: _trailerController.text.trim().isNotEmpty
            ? _trailerController.text.trim()
            : null,
        modules: _modules,
        whatYouWillLearn: [
          'Practical crop care & harvest management',
          'Scientific disease prevention and nutrition',
          'Government subsidies & marketing strategies',
        ],
      );
      if (!mounted) return;
      widget.state.showToast('Course published to Superstore! 🎉');
      widget.onSaved?.call();
      Navigator.pop(context);
    } catch (e) {
      if (mounted) widget.state.showToast('Publish failed: $e');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.92,
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        children: [
          Container(
            margin: const EdgeInsets.only(top: 10, bottom: 8),
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: Colors.grey.shade300,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Course & Curriculum Builder',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF1E293B),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close_rounded),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
          ),
          const Divider(height: 1),

          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                // Title
                TextField(
                  controller: _titleController,
                  decoration: InputDecoration(
                    labelText: 'Course Title *',
                    hintText: 'e.g. Masterclass on Drip Fertigation & Pruning',
                    border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12)),
                  ),
                ),
                const SizedBox(height: 12),

                // Description
                TextField(
                  controller: _descController,
                  maxLines: 2,
                  decoration: InputDecoration(
                    labelText: 'Course Description',
                    hintText: 'Comprehensive step-by-step masterclass...',
                    border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12)),
                  ),
                ),
                const SizedBox(height: 12),

                // Category & Level
                Row(
                  children: [
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        initialValue: _category,
                        decoration: InputDecoration(
                          labelText: 'Category',
                          border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12)),
                        ),
                        items: categories
                            .map((c) =>
                                DropdownMenuItem(value: c, child: Text(c)))
                            .toList(),
                        onChanged: (v) =>
                            setState(() => _category = v ?? _category),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        initialValue: _level,
                        decoration: InputDecoration(
                          labelText: 'Level',
                          border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12)),
                        ),
                        items: levels
                            .map((l) =>
                                DropdownMenuItem(value: l, child: Text(l)))
                            .toList(),
                        onChanged: (v) =>
                            setState(() => _level = v ?? _level),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),

                // Price & AgriCoins Discount
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _priceController,
                        keyboardType: TextInputType.number,
                        decoration: InputDecoration(
                          labelText: 'Price (₹)',
                          prefixText: '₹ ',
                          border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12)),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: TextField(
                        controller: _discountController,
                        keyboardType: TextInputType.number,
                        decoration: InputDecoration(
                          labelText: 'Max Coin Discount (₹)',
                          prefixText: '₹ ',
                          border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12)),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),

                // Trailer Video URL
                TextField(
                  controller: _trailerController,
                  decoration: InputDecoration(
                    labelText: 'Video Preview / Trailer Stream URL',
                    hintText: 'https://...mp4 or YouTube link',
                    border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12)),
                  ),
                ),
                const SizedBox(height: 20),

                // Modules & Lessons Header
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Curriculum & Lessons',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFF1E293B),
                      ),
                    ),
                    TextButton.icon(
                      onPressed: _addModule,
                      icon: const Icon(Icons.add_rounded, size: 18),
                      label: const Text('Add Module'),
                    ),
                  ],
                ),
                const SizedBox(height: 8),

                // Modules List
                for (var mIdx = 0; mIdx < _modules.length; mIdx++) ...[
                  _buildModuleEditor(mIdx),
                  const SizedBox(height: 12),
                ],

                const SizedBox(height: 24),
                FilledButton.icon(
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFF1B4332),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14)),
                  ),
                  onPressed: _saving ? null : _publishCourse,
                  icon: _saving
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white),
                        )
                      : const Icon(Icons.cloud_upload_rounded),
                  label: const Text(
                    'Publish Course to Superstore',
                    style: TextStyle(
                        fontWeight: FontWeight.w900, fontSize: 14),
                  ),
                ),
                const SizedBox(height: 20),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildModuleEditor(int moduleIndex) {
    final module = _modules[moduleIndex];
    final lessons =
        (module['lessons'] as List).cast<Map<String, dynamic>>();

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  module['title'] as String? ?? 'Section',
                  style: const TextStyle(
                      fontWeight: FontWeight.w900, fontSize: 13),
                ),
              ),
              IconButton(
                icon: const Icon(Icons.add_circle_outline_rounded,
                    size: 20, color: Color(0xFF1B4332)),
                tooltip: 'Add Lesson',
                onPressed: () => _addLesson(moduleIndex),
              ),
            ],
          ),
          if (lessons.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 8),
              child: Text(
                'No lessons added yet. Tap + to add first lecture.',
                style: TextStyle(fontSize: 11.5, color: Color(0xFF94A3B8)),
              ),
            )
          else
            for (final les in lessons)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 3),
                child: Row(
                  children: [
                    const Icon(Icons.play_lesson_rounded,
                        size: 14, color: Color(0xFF52B788)),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        les['title'] as String? ?? 'Lesson',
                        style: const TextStyle(
                            fontSize: 12, fontWeight: FontWeight.w700),
                      ),
                    ),
                    Text(
                      '${les['durationMinutes']}m',
                      style: const TextStyle(
                          fontSize: 10.5, color: Color(0xFF64748B)),
                    ),
                    if (les['isPreview'] == true) ...[
                      const SizedBox(width: 4),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 4, vertical: 1),
                        decoration: BoxDecoration(
                          color: const Color(0xFFDCFCE7),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: const Text('Free Preview',
                            style: TextStyle(
                                fontSize: 8.5,
                                fontWeight: FontWeight.w900,
                                color: Color(0xFF15803D))),
                      ),
                    ],
                  ],
                ),
              ),
        ],
      ),
    );
  }
}
