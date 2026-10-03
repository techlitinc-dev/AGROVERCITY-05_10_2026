// Seller product form — create (POST /seller/products) or edit (PUT).

import 'package:flutter/material.dart';

import '../../api/seller_products_api.dart';
import '../../models/emarket_models.dart';
import '../../state/app_state.dart';

class SellerProductFormSheet extends StatefulWidget {
  final AppState state;
  final SellerProductsApi api;
  final SellerProduct? existing;

  const SellerProductFormSheet({
    super.key,
    required this.state,
    required this.api,
    this.existing,
  });

  static Future<bool?> show(
    BuildContext context, {
    required AppState state,
    required SellerProductsApi api,
    SellerProduct? existing,
  }) =>
      showModalBottomSheet<bool>(
        context: context,
        isScrollControlled: true,
        backgroundColor: Colors.white,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        builder: (_) => Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(context).viewInsets.bottom,
          ),
          child: SellerProductFormSheet(
            state: state,
            api: api,
            existing: existing,
          ),
        ),
      );

  @override
  State<SellerProductFormSheet> createState() => _SellerProductFormSheetState();
}

class _SellerProductFormSheetState extends State<SellerProductFormSheet> {
  static const _categories = [
    'Seeds',
    'Fertilizer',
    'Pesticide',
    'Tools',
    'Vehicles',
    'Other',
  ];
  static const _units = ['kg', 'litre', 'piece', 'pack', 'quintal'];

  final _title = TextEditingController();
  final _brand = TextEditingController();
  final _mrp = TextEditingController();
  final _price = TextEditingController();
  final _stock = TextEditingController();
  final _description = TextEditingController();
  final _imageUrl = TextEditingController();
  String _category = 'Seeds';
  String _unit = 'kg';
  bool _saving = false;

  bool get _isEdit => widget.existing != null;

  @override
  void initState() {
    super.initState();
    final p = widget.existing;
    if (p != null) {
      _title.text = p.title;
      _brand.text = p.brand;
      _mrp.text = "${p.mrp.round()}";
      _price.text = "${p.discountedPrice.round()}";
      _stock.text = "${p.stock}";
      _description.text = p.description ?? '';
      _imageUrl.text = p.imageUrl ?? '';
      _category = _categories.contains(p.category) ? p.category : 'Other';
      _unit = _units.contains(p.unit) ? p.unit : 'kg';
    }
  }

  @override
  void dispose() {
    _title.dispose();
    _brand.dispose();
    _mrp.dispose();
    _price.dispose();
    _stock.dispose();
    _description.dispose();
    _imageUrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_saving) return;
    final title = _title.text.trim();
    final brand = _brand.text.trim();
    final mrp = double.tryParse(_mrp.text.trim()) ?? 0;
    final price = double.tryParse(_price.text.trim()) ?? 0;
    final stock = int.tryParse(_stock.text.trim()) ?? 0;
    if (title.isEmpty || brand.isEmpty || mrp <= 0 || price <= 0) {
      widget.state.showToast(widget.state.tr('emarket.fillRequired'));
      return;
    }
    setState(() => _saving = true);
    try {
      if (_isEdit) {
        await widget.api.update(
          widget.existing!.id,
          title: title,
          category: _category,
          brand: brand,
          mrp: mrp,
          discountedPrice: price,
          stock: stock,
          unit: _unit,
          description: _description.text.trim(),
          imageUrl: _imageUrl.text.trim(),
        );
      } else {
        await widget.api.create(
          title: title,
          category: _category,
          brand: brand,
          mrp: mrp,
          discountedPrice: price,
          stock: stock,
          unit: _unit,
          description: _description.text.trim(),
          imageUrl: _imageUrl.text.trim(),
        );
      }
      if (mounted) Navigator.pop(context, true);
    } catch (_) {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            widget.state
                .tr(_isEdit ? 'emarket.editProduct' : 'emarket.addProduct'),
            style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 14),
          _field(_title, widget.state.tr('emarket.titleLabel')),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: DropdownButtonFormField<String>(
                  initialValue: _category,
                  decoration: _decoration(
                      widget.state.tr('emarket.categoryLabel')),
                  items: [
                    for (final c in _categories)
                      DropdownMenuItem(value: c, child: Text(c)),
                  ],
                  onChanged: (v) => setState(() => _category = v ?? _category),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: DropdownButtonFormField<String>(
                  initialValue: _unit,
                  decoration:
                      _decoration(widget.state.tr('emarket.unitLabel')),
                  items: [
                    for (final u in _units)
                      DropdownMenuItem(value: u, child: Text(u)),
                  ],
                  onChanged: (v) => setState(() => _unit = v ?? _unit),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          _field(_brand, widget.state.tr('emarket.brandLabel')),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: _field(
                    _mrp, widget.state.tr('emarket.mrpLabel'), number: true),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _field(_price,
                    widget.state.tr('emarket.discountedPriceLabel'),
                    number: true),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _field(
                    _stock, widget.state.tr('emarket.stockLabel'),
                    number: true),
              ),
            ],
          ),
          const SizedBox(height: 10),
          _field(_description,
              widget.state.tr('emarket.descriptionLabelOptional')),
          const SizedBox(height: 10),
          _field(_imageUrl, widget.state.tr('emarket.imageUrlLabelOptional')),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFEA580C),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14)),
              ),
              onPressed: _saving ? null : _save,
              child: Text(
                _saving ? "..." : widget.state.tr('save'),
                style: const TextStyle(fontWeight: FontWeight.w900),
              ),
            ),
          ),
        ],
      ),
    );
  }

  InputDecoration _decoration(String label) => InputDecoration(
        labelText: label,
        labelStyle: const TextStyle(fontSize: 12),
        isDense: true,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
      );

  Widget _field(TextEditingController controller, String label,
      {bool number = false}) {
    return TextField(
      controller: controller,
      keyboardType: number ? TextInputType.number : TextInputType.text,
      decoration: _decoration(label),
    );
  }
}
