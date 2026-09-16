// Multi-Profile System — Farmer Home View (100% Backward Compatible Wrapper)

import 'package:flutter/material.dart';
import '../../state/app_state.dart';
import '../home_view.dart';

class FarmerHomeView extends StatelessWidget {
  final AppState state;
  final VoidCallback? onOpenVoice;

  const FarmerHomeView({
    super.key,
    required this.state,
    this.onOpenVoice,
  });

  @override
  Widget build(BuildContext context) {
    return HomeView(
      state: state,
      onOpenVoice: onOpenVoice ?? () {},
    );
  }
}
