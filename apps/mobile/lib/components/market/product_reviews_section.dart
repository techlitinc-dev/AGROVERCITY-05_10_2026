// Product reviews section — star input + comment form (upsert semantics) +
// reviews list. Embedded in the product-detail (certificate) dialog (X7).

import 'package:flutter/material.dart';

import '../../api/api_exception.dart';
import '../../api/marketplace_api.dart';
import '../../data/translations.dart';
import '../../models/product_review.dart';
import '../../state/app_state.dart';

class ProductReviewsSection extends StatefulWidget {
  final MarketplaceApi api;
  final String productId;
  final String? currentUserId;
  final AppState? state;

  const ProductReviewsSection({
    super.key,
    required this.api,
    required this.productId,
    this.currentUserId,
    this.state,
  });

  @override
  State<ProductReviewsSection> createState() => _ProductReviewsSectionState();
}

class _ProductReviewsSectionState extends State<ProductReviewsSection> {
  final _commentController = TextEditingController();
  List<ProductReview> _reviews = const [];
  Map<String, dynamic> _product = const {};
  int _selectedStars = 0;
  bool _loading = true;
  bool _submitting = false;

  String _tr(String key) =>
      widget.state?.tr(key) ?? AppTranslations.get(key, 'en');

  String get _lang => widget.state?.language ?? 'en';

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    Map<String, dynamic> product = const {};
    List<ProductReview> reviews = const [];
    try {
      product = await widget.api.getProduct(widget.productId);
    } catch (_) {}
    try {
      final res = await widget.api.listReviews(widget.productId);
      reviews = ((res['data'] as List?) ?? const <dynamic>[])
          .map((e) => ProductReview.fromJson((e as Map).cast<String, dynamic>()))
          .toList();
    } catch (_) {}
    if (!mounted) return;
    setState(() {
      _product = product;
      _reviews = reviews;
      _loading = false;
    });
  }

  void _snack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.maybeOf(context)
        ?.showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _submit() async {
    if (_selectedStars < 1 || _submitting) return;
    setState(() => _submitting = true);
    try {
      await widget.api.postReview(
        widget.productId,
        _selectedStars,
        _commentController.text.trim(),
      );
      if (!mounted) return;
      _commentController.clear();
      _snack(_tr('reviews.reviewSubmitted'));
      await _load();
    } on ApiException catch (e) {
      _snack(e.message.isNotEmpty ? e.message : e.code);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final ratingAvg = (_product['ratingAvg'] as num?) ?? (_product['rating'] as num?);
    final ratingCount =
        ((_product['ratingCount'] as num?) ?? (_product['reviewsCount'] as num?) ?? 0)
            .toInt();
    final hasMine = _reviews.any((r) => r.userId == widget.currentUserId);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Divider(height: 20),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              _tr('reviews.writeReview'),
              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Color(0xFF263238)),
            ),
            if (ratingCount > 0 && ratingAvg != null)
              Text(
                "⭐ $ratingAvg (${_tr('reviews.reviewsLabel').replaceAll('{count}', '$ratingCount')})",
                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF2E7D32)),
              ),
          ],
        ),
        const SizedBox(height: 8),
        Row(
          children: List.generate(5, (idx) {
            final selected = idx < _selectedStars;
            return GestureDetector(
              onTap: () => setState(() => _selectedStars = idx + 1),
              child: Padding(
                padding: const EdgeInsets.only(right: 4),
                child: Icon(
                  selected ? Icons.star_rounded : Icons.star_outline_rounded,
                  size: 30,
                  color: const Color(0xFFEAB308),
                ),
              ),
            );
          }),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: _commentController,
          maxLength: 500,
          maxLines: 2,
          decoration: InputDecoration(
            hintText: _tr('reviews.experienceHint'),
            hintStyle: TextStyle(fontSize: 12, color: Colors.grey.shade400),
            counterStyle: const TextStyle(fontSize: 10),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          ),
        ),
        const SizedBox(height: 8),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: (_selectedStars < 1 || _submitting) ? null : _submit,
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF2E7D32),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: Text(
              _submitting
                  ? _tr('reviews.sending')
                  : (hasMine ? _tr('reviews.updateReview') : _tr('reviews.send')),
              style: const TextStyle(fontWeight: FontWeight.w900),
            ),
          ),
        ),
        const SizedBox(height: 14),
        if (_loading)
          const Center(
            child: Padding(
              padding: EdgeInsets.symmetric(vertical: 12),
              child: CircularProgressIndicator(color: Color(0xFF2E7D32)),
            ),
          )
        else if (_reviews.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Center(
              child: Text(
                _tr('reviews.noReviewsYet'),
                style: const TextStyle(fontSize: 12, color: Colors.grey, fontWeight: FontWeight.w700),
              ),
            ),
          )
        else
          ..._reviews.map((r) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          r.userName,
                          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF263238)),
                        ),
                        Text(r.timeAgo(_lang), style: TextStyle(fontSize: 10, color: Colors.grey.shade500)),
                      ],
                    ),
                    Row(
                      children: List.generate(
                        5,
                        (idx) => Icon(
                          idx < r.rating ? Icons.star_rounded : Icons.star_outline_rounded,
                          size: 14,
                          color: const Color(0xFFEAB308),
                        ),
                      ),
                    ),
                    if (r.comment.isNotEmpty)
                      Text(
                        r.comment,
                        style: const TextStyle(fontSize: 12, color: Color(0xFF374151), height: 1.35),
                      ),
                  ],
                ),
              )),
      ],
    );
  }
}
