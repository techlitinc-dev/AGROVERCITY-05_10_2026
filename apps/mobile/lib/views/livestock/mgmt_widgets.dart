// Shared frame + field widgets for the Dairy/Gaushala/Vet management sheets.
// Styling mirrors livestock_management_sheets.dart (white rounded sheet with
// drag handle, icon header, outlined fields).

import 'package:flutter/material.dart';

import '../../state/app_state.dart';

/// Standard modal-bottom-sheet frame: drag handle, icon header and a padded,
/// keyboard-aware scrollable body.
class MgmtSheetFrame extends StatelessWidget {
  final AppState state;
  final IconData icon;
  final Color iconColor;
  final String title;
  final String subtitle;
  final List<Widget> children;
  final Widget? footer;

  const MgmtSheetFrame({
    super.key,
    required this.state,
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.subtitle,
    required this.children,
    this.footer,
  });

  static Future<void> showSheet(
    BuildContext context,
    Widget sheet,
  ) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => sheet,
    );
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    return Container(
      padding: EdgeInsets.only(
        top: 20,
        left: 20,
        right: 20,
        bottom: bottomInset + 20,
      ),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Center(
              child: Container(
                width: 48,
                height: 5,
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: iconColor.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(icon, color: iconColor, size: 26),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      Text(
                        subtitle,
                        style: const TextStyle(
                          fontSize: 12,
                          color: Colors.grey,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 18),
            ...children,
            if (footer != null) ...[
              const SizedBox(height: 18),
              footer!,
            ],
          ],
        ),
      ),
    );
  }
}

class MgmtField extends StatelessWidget {
  final TextEditingController controller;
  final String label;
  final TextInputType? keyboardType;
  final IconData? icon;
  final int maxLines;

  const MgmtField({
    super.key,
    required this.controller,
    required this.label,
    this.keyboardType,
    this.icon,
    this.maxLines = 1,
  });

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      keyboardType: keyboardType,
      maxLines: maxLines,
      decoration: InputDecoration(
        labelText: label,
        prefixIcon: icon != null ? Icon(icon, size: 20) : null,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }
}

/// Horizontal single-select chips.
class MgmtChipSelect extends StatelessWidget {
  final List<String> options;
  final String selected;
  final ValueChanged<String> onChanged;

  const MgmtChipSelect({
    super.key,
    required this.options,
    required this.selected,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: options
          .map(
            (opt) => ChoiceChip(
              label: Text(opt, style: const TextStyle(fontSize: 12.5)),
              selected: selected == opt,
              onSelected: (_) => onChanged(opt),
            ),
          )
          .toList(),
    );
  }
}

/// Outlined field that opens a Material date picker and writes YYYY-MM-DD.
class MgmtDateField extends StatefulWidget {
  final String label;
  final DateTime initialDate;
  final ValueChanged<String> onPicked;

  const MgmtDateField({
    super.key,
    required this.label,
    required this.initialDate,
    required this.onPicked,
  });

  @override
  State<MgmtDateField> createState() => _MgmtDateFieldState();
}

class _MgmtDateFieldState extends State<MgmtDateField> {
  late String _text = _fmt(widget.initialDate);

  static String _fmt(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  Future<void> _pick() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: widget.initialDate,
      firstDate: DateTime(2020),
      lastDate: DateTime(2035),
    );
    if (picked != null) {
      setState(() => _text = _fmt(picked));
      widget.onPicked(_text);
    }
  }

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: _pick,
      borderRadius: BorderRadius.circular(12),
      child: InputDecorator(
        decoration: InputDecoration(
          labelText: widget.label,
          prefixIcon: const Icon(Icons.calendar_month_outlined, size: 20),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
        ),
        child: Text(_text, style: const TextStyle(fontSize: 14)),
      ),
    );
  }
}

/// Full-width save button with busy-state disabling (optimistic guard).
class MgmtSaveButton extends StatelessWidget {
  final String label;
  final bool saving;
  final Color color;
  final VoidCallback onPressed;

  const MgmtSaveButton({
    super.key,
    required this.label,
    required this.saving,
    required this.color,
    required this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 48,
      child: ElevatedButton.icon(
        style: ElevatedButton.styleFrom(
          backgroundColor: color,
          disabledBackgroundColor: color.withValues(alpha: 0.5),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
        ),
        onPressed: saving ? null : onPressed,
        icon: saving
            ? const SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: Colors.white,
                ),
              )
            : const Icon(Icons.check_circle_outline, color: Colors.white),
        label: Text(
          label,
          style: const TextStyle(
            fontSize: 14.5,
            fontWeight: FontWeight.bold,
            color: Colors.white,
          ),
        ),
      ),
    );
  }
}

/// Small colored status badge used across the console lists.
class MgmtStatusBadge extends StatelessWidget {
  final String label;
  final Color color;

  const MgmtStatusBadge({super.key, required this.label, required this.color});

  factory MgmtStatusBadge.forStatus(String status) {
    final color = switch (status) {
      'paid' || 'completed' || 'delivered' || 'approved' ||
      'acknowledged' || 'vaccinated' || 'active' || 'confirmed' =>
        const Color(0xFF2E7D32),
      'in-progress' || 'billed' || 'draft' || 'enrolled' || 'pending' =>
        const Color(0xFFF57F17),
      'cancelled' || 'rejected' || 'inactive' || 'deceased' || 'closed' =>
        const Color(0xFFD32F2F),
      _ => const Color(0xFF1565C0),
    };
    return MgmtStatusBadge(label: status, color: color);
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 10.5,
          fontWeight: FontWeight.bold,
          color: color,
        ),
      ),
    );
  }
}

/// Loading / error / empty-aware holder for one API-backed section.
class MgmtAsyncData<T> {
  T? data;
  String? error;
  bool loading;

  MgmtAsyncData({this.loading = true});
}

/// Renders the standard tri-state (loading spinner, error + retry, empty
/// placeholder, content) for one loaded section.
class MgmtAsyncView<T> extends StatelessWidget {
  final MgmtAsyncData<T> value;
  final Widget Function(T data) builder;
  final String emptyText;
  final String retryLabel;
  final bool Function(T data)? isEmpty;
  final VoidCallback? onRetry;

  const MgmtAsyncView({
    super.key,
    required this.value,
    required this.builder,
    required this.emptyText,
    this.retryLabel = 'Retry',
    this.isEmpty,
    this.onRetry,
  });

  @override
  Widget build(BuildContext context) {
    if (value.loading) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 40),
        child: Center(
          child: CircularProgressIndicator(color: Color(0xFF0288D1)),
        ),
      );
    }
    final error = value.error;
    if (error != null) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 32),
        child: Center(
          child: Column(
            children: [
              const Icon(
                Icons.cloud_off_outlined,
                color: Colors.grey,
                size: 32,
              ),
              const SizedBox(height: 8),
              Text(
                error,
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.grey, fontSize: 12.5),
              ),
              if (onRetry != null) ...[
                const SizedBox(height: 10),
                TextButton.icon(
                  onPressed: onRetry,
                  icon: const Icon(Icons.refresh, size: 16),
                  label: Text(retryLabel),
                ),
              ],
            ],
          ),
        ),
      );
    }
    final data = value.data as T;
    final empty = isEmpty?.call(data) ??
        (data is List ? data.isEmpty : data == null);
    if (empty) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 32),
        child: Center(
          child: Text(
            emptyText,
            textAlign: TextAlign.center,
            style: const TextStyle(color: Colors.grey, fontSize: 12.5),
          ),
        ),
      );
    }
    return builder(data);
  }
}
