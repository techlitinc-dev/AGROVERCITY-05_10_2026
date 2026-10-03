import 'package:flutter/material.dart';

import '../../api/courses_api.dart';
import '../../state/app_state.dart';

class CourseQaSheet extends StatefulWidget {
  const CourseQaSheet({
    super.key,
    required this.state,
    required this.courseId,
    this.api,
  });

  final AppState state;
  final String courseId;
  final CoursesApi? api;

  static Future<void> show(
    BuildContext context, {
    required AppState state,
    required String courseId,
    CoursesApi? api,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => CourseQaSheet(
        state: state,
        courseId: courseId,
        api: api,
      ),
    );
  }

  @override
  State<CourseQaSheet> createState() => _CourseQaSheetState();
}

class _CourseQaSheetState extends State<CourseQaSheet> {
  late final CoursesApi _api = widget.api ?? CoursesApi();
  List<Map<String, dynamic>> _questions = [];
  bool _loading = true;
  final _questionController = TextEditingController();
  final _replyController = TextEditingController();
  String? _answeringQuestionId;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _questionController.dispose();
    _replyController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final questions = await _api.getQuestions(widget.courseId);
      if (mounted) setState(() => _questions = questions);
    } catch (_) {} finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _askQuestion() async {
    final text = _questionController.text.trim();
    if (text.isEmpty) return;
    setState(() => _submitting = true);
    try {
      await _api.askQuestion(widget.courseId, text);
      _questionController.clear();
      widget.state.showToast('Question posted!');
      await _load();
    } catch (e) {
      widget.state.showToast('Could not post question: $e');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _submitAnswer(String questionId) async {
    final text = _replyController.text.trim();
    if (text.isEmpty) return;
    try {
      await _api.answerQuestion(widget.courseId, questionId, text);
      _replyController.clear();
      setState(() => _answeringQuestionId = null);
      widget.state.showToast('Reply added!');
      await _load();
    } catch (e) {
      widget.state.showToast('Could not post reply: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.85,
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
                  'Community Q&A Forum',
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

          // Ask Question Input
          Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _questionController,
                    decoration: InputDecoration(
                      hintText: 'Ask the instructor or fellow learners...',
                      hintStyle: const TextStyle(fontSize: 12),
                      filled: true,
                      fillColor: const Color(0xFFF8FAFC),
                      isDense: true,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                FilledButton(
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFF1B4332),
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 12),
                  ),
                  onPressed: _submitting ? null : _askQuestion,
                  child: const Text('Ask',
                      style: TextStyle(fontWeight: FontWeight.w900)),
                ),
              ],
            ),
          ),
          const Divider(height: 1),

          // Questions List
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _questions.isEmpty
                    ? const Center(
                        child: Text(
                          'No questions yet. Ask something!',
                          style: TextStyle(color: Color(0xFF64748B)),
                        ),
                      )
                    : ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: _questions.length,
                        separatorBuilder: (_, _) =>
                            const Divider(height: 24, color: Color(0xFFF1F5F9)),
                        itemBuilder: (context, i) {
                          final q = _questions[i];
                          final qId = q['id'] as String? ?? '$i';
                          final question = q['question'] as String? ?? '';
                          final author =
                              q['userName'] as String? ?? 'Student';
                          final answers = (q['answers'] as List?)
                                  ?.cast<Map<String, dynamic>>() ??
                              const [];

                          return Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  CircleAvatar(
                                    radius: 12,
                                    backgroundColor: const Color(0xFFE2E8F0),
                                    child: Text(
                                      author.isNotEmpty
                                          ? author[0].toUpperCase()
                                          : '?',
                                      style: const TextStyle(
                                          fontSize: 10,
                                          fontWeight: FontWeight.w900,
                                          color: Color(0xFF475569)),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Text(
                                    author,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w800,
                                      fontSize: 12.5,
                                      color: Color(0xFF1E293B),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 6),
                              Text(
                                question,
                                style: const TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                  color: Color(0xFF0F172A),
                                ),
                              ),
                              const SizedBox(height: 8),

                              // Answer threads
                              for (final ans in answers) ...[
                                Container(
                                  margin: const EdgeInsets.only(
                                      left: 16, top: 4, bottom: 4),
                                  padding: const EdgeInsets.all(10),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFF8FAFC),
                                    borderRadius: BorderRadius.circular(10),
                                    border: Border.all(
                                        color: const Color(0xFFE2E8F0)),
                                  ),
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          Text(
                                            ans['userName'] as String? ??
                                                'Instructor',
                                            style: const TextStyle(
                                              fontWeight: FontWeight.w800,
                                              fontSize: 11.5,
                                              color: Color(0xFF1B4332),
                                            ),
                                          ),
                                          if (ans['isInstructor'] == true) ...[
                                            const SizedBox(width: 4),
                                            Container(
                                              padding:
                                                  const EdgeInsets.symmetric(
                                                      horizontal: 4,
                                                      vertical: 1),
                                              decoration: BoxDecoration(
                                                color: const Color(0xFFDCFCE7),
                                                borderRadius:
                                                    BorderRadius.circular(4),
                                              ),
                                              child: const Text(
                                                'Teacher',
                                                style: TextStyle(
                                                  fontSize: 9,
                                                  fontWeight: FontWeight.w900,
                                                  color: Color(0xFF15803D),
                                                ),
                                              ),
                                            ),
                                          ],
                                        ],
                                      ),
                                      const SizedBox(height: 3),
                                      Text(
                                        ans['answer'] as String? ?? '',
                                        style: const TextStyle(
                                          fontSize: 12,
                                          color: Color(0xFF334155),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],

                              // Reply button or text field
                              if (_answeringQuestionId == qId)
                                Padding(
                                  padding:
                                      const EdgeInsets.only(left: 16, top: 8),
                                  child: Row(
                                    children: [
                                      Expanded(
                                        child: TextField(
                                          controller: _replyController,
                                          autofocus: true,
                                          decoration: InputDecoration(
                                            hintText: 'Write a helpful reply...',
                                            hintStyle:
                                                const TextStyle(fontSize: 11.5),
                                            isDense: true,
                                            border: OutlineInputBorder(
                                              borderRadius:
                                                  BorderRadius.circular(10),
                                            ),
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: 6),
                                      IconButton(
                                        icon: const Icon(Icons.send_rounded,
                                            color: Color(0xFF1B4332), size: 20),
                                        onPressed: () => _submitAnswer(qId),
                                      ),
                                    ],
                                  ),
                                )
                              else
                                Padding(
                                  padding: const EdgeInsets.only(left: 16),
                                  child: TextButton.icon(
                                    style: TextButton.styleFrom(
                                      padding: EdgeInsets.zero,
                                      visualDensity: VisualDensity.compact,
                                    ),
                                    icon: const Icon(Icons.reply_rounded,
                                        size: 14),
                                    label: const Text('Reply',
                                        style: TextStyle(fontSize: 11)),
                                    onPressed: () {
                                      setState(
                                          () => _answeringQuestionId = qId);
                                    },
                                  ),
                                ),
                            ],
                          );
                        },
                      ),
          ),
        ],
      ),
    );
  }
}
