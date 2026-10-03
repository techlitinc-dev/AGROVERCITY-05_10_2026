// Full-parameter product form — create (POST /my-products) or edit (PUT).
// Reusable for any user-managed product listing.

import 'package:flutter/material.dart';

import '../../api/my_products_api.dart';
import '../../models/emarket_models.dart';
import '../../state/app_state.dart';

class ProductFormSheet extends StatefulWidget {
  final AppState state;
  final MyProductsApi api;
  final UserProduct? existing;

  const ProductFormSheet({
    super.key,
    required this.state,
    required this.api,
    this.existing,
  });

  static Future<bool?> show(
    BuildContext context, {
    required AppState state,
    required MyProductsApi api,
    UserProduct? existing,
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
          child: ProductFormSheet(
            state: state,
            api: api,
            existing: existing,
          ),
        ),
      );

  @override
  State<ProductFormSheet> createState() => _ProductFormSheetState();
}

class _ProductFormSheetState extends State<ProductFormSheet> {
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
  final _vernacular = TextEditingController();
  final _mrp = TextEditingController();
  final _price = TextEditingController();
  final _stock = TextEditingController();
  final _description = TextEditingController();
  final _imageUrl = TextEditingController();
  final _batchNo = TextEditingController();
  String _category = 'Seeds';
  String _unit = 'kg';
  bool _saving = false;
  bool _priceError = false;

  bool get _isEdit => widget.existing != null;

  @override
  void initState() {
    super.initState();
    final p = widget.existing;
    if (p != null) {
      _title.text = p.title;
      _brand.text = p.brand;
      _vernacular.text = p.vernacularTitle;
      _mrp.text = "${p.mrp.round()}";
      _price.text = "${p.discountedPrice.round()}";
      _stock.text = "${p.stock}";
      _description.text = p.description;
      _imageUrl.text = p.imageUrl;
      _batchNo.text = p.batchNo;
      _category = _categories.contains(p.category) ? p.category : 'Other';
      _unit = _units.contains(p.unit) ? p.unit : 'kg';
    }
  }

  @override
  void dispose() {
    _title.dispose();
    _brand.dispose();
    _vernacular.dispose();
    _mrp.dispose();
    _price.dispose();
    _stock.dispose();
    _description.dispose();
    _imageUrl.dispose();
    _batchNo.dispose();
    super.dispose();
  }

  Map<String, dynamic> _changedFields(
    UserProduct p,
    String title,
    double mrp,
    double price,
    int stock,
  ) {
    final fields = <String, dynamic>{};
    if (title != p.title) fields['title'] = title;
    if (_category != p.category) fields['category'] = _category;
    final brand = _brand.text.trim();
    if (brand != p.brand && brand.isNotEmpty) fields['brand'] = brand;
    final vernacular = _vernacular.text.trim();
    if (vernacular != p.vernacularTitle && vernacular.isNotEmpty) {
      fields['vernacularTitle'] = vernacular;
    }
    final description = _description.text.trim();
    if (description != p.description && description.isNotEmpty) {
      fields['description'] = description;
    }
    if (mrp != p.mrp) fields['mrp'] = mrp;
    if (price != p.discountedPrice) fields['discountedPrice'] = price;
    if (stock != p.stock) fields['stock'] = stock;
    if (_unit != p.unit) fields['unit'] = _unit;
    final imageUrl = _imageUrl.text.trim();
    if (imageUrl != p.imageUrl && imageUrl.isNotEmpty) {
      fields['imageUrl'] = imageUrl;
    }
    final batchNo = _batchNo.text.trim();
    if (batchNo != p.batchNo && batchNo.isNotEmpty) fields['batchNo'] = batchNo;
    return fields;
  }

  Future<void> _save() async {
    if (_saving) return;
    final title = _title.text.trim();
    final mrp = double.tryParse(_mrp.text.trim()) ?? 0;
    final price = double.tryParse(_price.text.trim()) ?? 0;
    final stock = int.tryParse(_stock.text.trim()) ?? 0;
    if (title.isEmpty || mrp <= 0 || price <= 0) {
      widget.state.showToast(widget.state.tr('emarket.fillRequiredMyProducts'));
      return;
    }
    if (price > mrp) {
      setState(() => _priceError = true);
      return;
    }
    setState(() {
      _saving = true;
      _priceError = false;
    });
    try {
      final existing = widget.existing;
      if (existing == null) {
        await widget.api.create(UserProductInput(
          title: title,
          category: _category,
          brand: _brand.text.trim(),
          vernacularTitle: _vernacular.text.trim(),
          description: _description.text.trim(),
          mrp: mrp,
          discountedPrice: price,
          stock: stock,
          unit: _unit,
          imageUrl: _imageUrl.text.trim(),
          batchNo: _batchNo.text.trim(),
        ));
      } else {
        final fields = _changedFields(existing, title, mrp, price, stock);
        if (fields.isNotEmpty) {
          await widget.api.update(existing.id, fields);
        }
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
          _field(_vernacular, widget.state.tr('emarket.vernacularTitleLabel')),
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
          if (_priceError) ...[
            const SizedBox(height: 6),
            Text(
              widget.state.tr('emarket.priceAboveMrp'),
              style: const TextStyle(
                  fontSize: 11.5,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFFDC2626)),
            ),
          ],
          const SizedBox(height: 10),
          TextField(
            controller: _description,
            maxLines: 3,
            decoration:
                _decoration(widget.state.tr('emarket.descriptionLabelOptional')),
          ),
          const SizedBox(height: 10),
          _field(_imageUrl, widget.state.tr('emarket.imageUrlLabelOptional')),
          const SizedBox(height: 10),
          _field(
            _batchNo,
            widget.state.tr('emarket.batchNoLabel'),
            hint: widget.state.tr('emarket.batchNoHint'),
          ),
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

  InputDecoration _decoration(String label, {String? hint}) => InputDecoration(
        labelText: label,
        labelStyle: const TextStyle(fontSize: 12),
        hintText: hint,
        hintStyle: const TextStyle(fontSize: 11),
        isDense: true,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
      );

  Widget _field(TextEditingController controller, String label,
      {bool number = false, String? hint}) {
    return TextField(
      controller: controller,
      keyboardType: number ? TextInputType.number : TextInputType.text,
      decoration: _decoration(label, hint: hint),
    );
  }
}
