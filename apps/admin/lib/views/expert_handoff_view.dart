import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/admin_api.dart';
import '../api/api_exception.dart';

class ExpertHandoffView extends StatefulWidget {
  const ExpertHandoffView({super.key});

  @override
  State<ExpertHandoffView> createState() => _ExpertHandoffViewState();
}

class _ExpertHandoffViewState extends State<ExpertHandoffView> {
  List<Map<String, dynamic>>? _tickets;
  String? _error;
  bool _showResolved = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await context.read<AdminApi>().listExpertHandoffs();
      setState(() {
        _tickets = (res['data'] as List? ?? [])
            .map((e) => (e as Map).cast<String, dynamic>())
            .toList();
        _error = null;
      });
    } on ApiException catch (e) {
      setState(() => _error = e.code);
    } catch (e) {
      setState(() => _error = e.toString());
    }
  }

  Future<void> _resolveTicket(Map<String, dynamic> ticket) async {
    final api = context.read<AdminApi>();
    final notesController = TextEditingController();
    final productsController = TextEditingController();

    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Row(
          children: [
            const Icon(Icons.medical_services, color: Color(0xFF2E7D32)),
            const SizedBox(width: 8),
            Text('परामर्श समाधान #${ticket['id'] ?? ''}'),
          ],
        ),
        content: SizedBox(
          width: 500,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'किसान प्रश्न: ${ticket['query'] ?? 'कोई प्रश्न नहीं'}',
                style: const TextStyle(fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: notesController,
                maxLines: 4,
                decoration: const InputDecoration(
                  labelText: 'वैज्ञानिक निदान एवं प्रिस्क्रिप्शन *',
                  hintText: 'उदा. टमाटर के अगेती झुलसा के लिए कॉपर ऑक्सीक्लोराइड 50% WP का 2.5 ग्राम/लीटर छिड़काव करें...',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: productsController,
                decoration: const InputDecoration(
                  labelText: 'अनुशंसित कृषि उत्पाद (अल्पविराम से अलग करें)',
                  hintText: 'Copper Oxychloride 50 WP, Neem Oil 10000 PPM',
                  border: OutlineInputBorder(),
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('रद्द करें'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: const Color(0xFF2E7D32)),
            onPressed: () {
              if (notesController.text.trim().length < 5) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('कृपया कम से कम 5 अक्षरों का निदान लिखें')),
                );
                return;
              }
              Navigator.pop(context, true);
            },
            child: const Text('प्रिस्क्रिप्शन भेजें'),
          ),
        ],
      ),
    );

    if (ok == true) {
      try {
        final products = productsController.text
            .split(',')
            .map((s) => s.trim())
            .where((s) => s.isNotEmpty)
            .toList();

        await api.resolveExpertHandoff(
          ticket['id'] as String,
          prescriptionNotes: notesController.text.trim(),
          recommendedProducts: products,
        );

        setState(() {
          ticket['status'] = 'resolved';
          ticket['prescriptionNotes'] = notesController.text.trim();
        });

        _toast('प्रिस्क्रिप्शन किसान को सफलतापूर्वक भेजा गया');
      } on ApiException catch (e) {
        _toast('विफल (${e.code})');
      }
    }
  }

  void _toast(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('कृषि वैज्ञानिक डेस्क (KVK Expert Handoff)'),
        actions: [
          FilterChip(
            label: const Text('समाधानित दिखाएं'),
            selected: _showResolved,
            onSelected: (v) => setState(() => _showResolved = v),
          ),
          const SizedBox(width: 8),
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'रिफ्रेश करें',
            onPressed: _load,
          ),
          const SizedBox(width: 16),
        ],
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_error != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text('डेटा लोड करने में त्रुटि: $_error'),
            const SizedBox(height: 12),
            FilledButton.tonal(onPressed: _load, child: const Text('पुनः प्रयास करें')),
          ],
        ),
      );
    }

    final tickets = _tickets;
    if (tickets == null) {
      return const Center(child: CircularProgressIndicator());
    }

    final displayTickets = _showResolved
        ? tickets
        : tickets.where((t) => t['status'] != 'resolved').toList();

    if (displayTickets.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.task_alt, size: 64, color: Colors.green),
            const SizedBox(height: 16),
            Text(
              _showResolved
                  ? 'कोई टिकट उपलब्ध नहीं है'
                  : 'कोई लंबित परामर्श टिकट नहीं है (सभी हल हो चुके हैं)',
              style: const TextStyle(fontSize: 16, color: Colors.grey),
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: displayTickets.length,
      itemBuilder: (context, i) {
        final t = displayTickets[i];
        final isResolved = t['status'] == 'resolved';

        return Card(
          margin: const EdgeInsets.only(bottom: 12),
          elevation: 2,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: isResolved ? Colors.grey.shade200 : Colors.amber.shade100,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            isResolved ? 'सुलझाया गया' : 'परामर्श प्रतीक्षारत',
                            style: TextStyle(
                              color: isResolved ? Colors.grey.shade700 : Colors.amber.shade900,
                              fontWeight: FontWeight.bold,
                              fontSize: 12,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          'ID: ${t['id'] ?? ''}',
                          style: TextStyle(color: Colors.grey.shade600, fontSize: 12),
                        ),
                      ],
                    ),
                    Text(
                      t['createdAt'] != null
                          ? t['createdAt'].toString().substring(0, 10)
                          : '',
                      style: TextStyle(color: Colors.grey.shade500, fontSize: 12),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  t['query'] ?? 'कोई प्रश्न नहीं',
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                ),
                if (t['context'] != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    'संदर्भ / फसल: ${t['context']}',
                    style: TextStyle(color: Colors.grey.shade700, fontSize: 13),
                  ),
                ],
                if (isResolved && t['prescriptionNotes'] != null) ...[
                  const Divider(height: 24),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.green.shade50,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.green.shade200),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Row(
                          children: [
                            Icon(Icons.check_circle, color: Colors.green, size: 16),
                            SizedBox(width: 6),
                            Text(
                              'कृषि वैज्ञानिक का निदान:',
                              style: TextStyle(fontWeight: FontWeight.bold, color: Colors.green),
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(t['prescriptionNotes'] ?? ''),
                      ],
                    ),
                  ),
                ],
                if (!isResolved) ...[
                  const SizedBox(height: 16),
                  Align(
                    alignment: Alignment.centerRight,
                    child: FilledButton.icon(
                      icon: const Icon(Icons.edit_note),
                      label: const Text('प्रिस्क्रिप्शन एवं सलाह दें'),
                      style: FilledButton.styleFrom(
                        backgroundColor: const Color(0xFF2E7D32),
                      ),
                      onPressed: () => _resolveTicket(t),
                    ),
                  ),
                ],
              ],
            ),
          ),
        );
      },
    );
  }
}
