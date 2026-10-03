// Step 3: Vernacular Multi-Profile Selection View with Animated Multi-Role Choice

import 'package:flutter/material.dart';
import '../../state/app_state.dart';
import '../../models/user_profile_type.dart';
import '../../components/common/motion_animations.dart';
import 'onboarding_progress.dart';

class ProfileSelectView extends StatefulWidget {
  final AppState state;
  const ProfileSelectView({super.key, required this.state});

  @override
  State<ProfileSelectView> createState() => _ProfileSelectViewState();
}

class _ProfileSelectViewState extends State<ProfileSelectView> {
  final Set<UserProfileType> _selectedProfiles = {};
  UserProfileType _primaryProfile = UserProfileType.farmer;

  @override
  void initState() {
    super.initState();
    // Seed from already-linked profiles; an empty set keeps Continue disabled
    // until the user picks at least one persona.
    _selectedProfiles.addAll(widget.state.linkedProfiles);
    _primaryProfile = widget.state.activeProfile;
  }

  void _toggleProfile(UserProfileType type) {
    setState(() {
      if (_selectedProfiles.contains(type)) {
        if (_selectedProfiles.length > 1) {
          _selectedProfiles.remove(type);
          if (_primaryProfile == type) {
            _primaryProfile = _selectedProfiles.first;
          }
        } else {
          widget.state.showToast(widget.state.tr('atLeastOneProfile'));
        }
      } else {
        _selectedProfiles.add(type);
      }
    });
  }

  void _setPrimaryProfile(UserProfileType type) {
    setState(() {
      if (!_selectedProfiles.contains(type)) {
        _selectedProfiles.add(type);
      }
      _primaryProfile = type;
    });
    widget.state.showToast("⭐ ${UserProfileRegistry.meta(type).label(widget.state.language)}");
  }

  void _handleContinue() {
    if (_selectedProfiles.isEmpty) {
      widget.state.showToast(widget.state.tr('atLeastOneProfile'));
      return;
    }
    widget.state.selectMultipleProfilesDuringRegistration(
      primary: _primaryProfile,
      selectedProfiles: _selectedProfiles.toList(),
    );
  }

  @override
  Widget build(BuildContext context) {
    final profiles = UserProfileRegistry.all.values.toList();
    final primaryMeta = UserProfileRegistry.meta(_primaryProfile);

    return Scaffold(
      backgroundColor: const Color(0xFFF5F7FA),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Overall journey progress (Step 2 of 4: Profiles)
              OnboardingFlowProgress(state: widget.state, currentStep: 2),
              const SizedBox(height: 8),

              // Selection count pill
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          primaryMeta.primaryColor.withValues(alpha: 0.15),
                          primaryMeta.accentColor.withValues(alpha: 0.25),
                        ],
                      ),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: primaryMeta.primaryColor.withValues(alpha: 0.4)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.layers_rounded, size: 14, color: primaryMeta.primaryColor),
                        const SizedBox(width: 4),
                        Text(
                          "${_selectedProfiles.length} ${widget.state.tr('profilesSelected')}",
                          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: primaryMeta.primaryColor),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              // Title & Multi-Role Instruction
              Text(
                widget.state.tr('selectRolesTitle'),
                style: const TextStyle(
                  fontSize: 21,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF112A1F),
                  letterSpacing: -0.2,
                ),
              ),
              const SizedBox(height: 3),
              Text(
                widget.state.tr('selectRolesSub'),
                style: TextStyle(fontSize: 12, color: Colors.grey.shade600, height: 1.3),
              ),
              const SizedBox(height: 12),

              // Active Primary Role Bar
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: primaryMeta.primaryColor.withValues(alpha: 0.3)),
                  boxShadow: [
                    BoxShadow(
                      color: primaryMeta.primaryColor.withValues(alpha: 0.12),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(5),
                      decoration: BoxDecoration(
                        color: primaryMeta.primaryColor,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.star_rounded, color: Colors.white, size: 13),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: RichText(
                        text: TextSpan(
                          style: const TextStyle(fontSize: 11.5, color: Color(0xFF1E293B)),
                          children: [
                            TextSpan(text: widget.state.tr('primaryRoleLabel'), style: const TextStyle(color: Colors.grey)),
                            TextSpan(
                              text: "${primaryMeta.label(widget.state.language)} (${primaryMeta.labelEn})",
                              style: TextStyle(fontWeight: FontWeight.w900, color: primaryMeta.primaryColor),
                            ),
                          ],
                        ),
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEF3C7),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        widget.state.tr('onboarding.primaryBadge'),
                        style: const TextStyle(fontSize: 9.5, fontWeight: FontWeight.w800, color: Color(0xFFB45309)),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 10),

              // 6 Persona Grid
              Expanded(
                child: GridView.builder(
                  physics: const BouncingScrollPhysics(),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    crossAxisSpacing: 10,
                    mainAxisSpacing: 10,
                    childAspectRatio: 0.86,
                  ),
                  itemCount: profiles.length,
                  itemBuilder: (context, index) {
                    final meta = profiles[index];
                    final isSelected = _selectedProfiles.contains(meta.type);
                    final isPrimary = _primaryProfile == meta.type;

                    return StaggeredSlideFade(
                      delayMs: index * 50,
                      duration: const Duration(milliseconds: 350),
                      child: BouncyPressable(
                        onTap: () => _toggleProfile(meta.type),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 220),
                          curve: Curves.easeOutCubic,
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: isSelected ? meta.primaryColor.withValues(alpha: 0.08) : Colors.white,
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(
                              color: isSelected ? meta.primaryColor : Colors.grey.shade200,
                              width: isSelected ? 2.2 : 1.2,
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: isSelected
                                    ? meta.primaryColor.withValues(alpha: 0.22)
                                    : Colors.black.withValues(alpha: 0.03),
                                blurRadius: isSelected ? 12 : 6,
                                offset: const Offset(0, 3),
                              ),
                            ],
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              // Top Header: Icon + Select Badge + Primary Star
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Container(
                                    width: 40,
                                    height: 40,
                                    decoration: BoxDecoration(
                                      color: isSelected
                                          ? meta.primaryColor
                                          : meta.primaryColor.withValues(alpha: 0.12),
                                      shape: BoxShape.circle,
                                    ),
                                    child: Icon(
                                      meta.icon,
                                      size: 22,
                                      color: isSelected ? Colors.white : meta.primaryColor,
                                    ),
                                  ),
                                  if (isSelected)
                                    GestureDetector(
                                      onTap: () => _setPrimaryProfile(meta.type),
                                      child: Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                                        decoration: BoxDecoration(
                                          color: isPrimary ? const Color(0xFFF59E0B) : meta.primaryColor,
                                          borderRadius: BorderRadius.circular(10),
                                        ),
                                        child: Row(
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            Icon(
                                              isPrimary ? Icons.star_rounded : Icons.check_rounded,
                                              color: Colors.white,
                                              size: 12,
                                            ),
                                            const SizedBox(width: 2),
                                            Text(
                                              isPrimary
                                                  ? widget.state
                                                      .tr('onboarding.primary')
                                                  : widget.state
                                                      .tr('onboarding.linked'),
                                              style: const TextStyle(
                                                fontSize: 9,
                                                color: Colors.white,
                                                fontWeight: FontWeight.w900,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    )
                                  else
                                    Container(
                                      width: 20,
                                      height: 20,
                                      decoration: BoxDecoration(
                                        shape: BoxShape.circle,
                                        border: Border.all(color: Colors.grey.shade300, width: 1.5),
                                      ),
                                    ),
                                ],
                              ),
                              const Spacer(),

                              // Localized Persona Title
                              Text(
                                meta.label(widget.state.language),
                                style: TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w900,
                                  color: isSelected ? meta.primaryColor : const Color(0xFF1E293B),
                                ),
                              ),

                              // English Subtitle
                              Text(
                                meta.labelEn,
                                style: TextStyle(
                                  fontSize: 10.5,
                                  fontWeight: FontWeight.w700,
                                  color: Colors.grey.shade500,
                                ),
                              ),
                              const SizedBox(height: 4),

                              // Localized Tagline
                              Text(
                                meta.tagline(widget.state.language),
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize: 9.5,
                                  fontWeight: FontWeight.w600,
                                  color: isSelected ? const Color(0xFF334155) : Colors.grey.shade600,
                                  height: 1.2,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ),
              const SizedBox(height: 10),

              // Full-Width Continue CTA
              ElevatedButton(
                onPressed: _selectedProfiles.isNotEmpty ? _handleContinue : null,
                style: ElevatedButton.styleFrom(
                  backgroundColor: primaryMeta.primaryColor,
                  foregroundColor: Colors.white,
                  minimumSize: const Size(double.infinity, 50),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  elevation: 4,
                  shadowColor: primaryMeta.primaryColor.withValues(alpha: 0.4),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      widget.state
                          .tr('onboarding.continueWithProfiles')
                          .replaceAll('{count}', '${_selectedProfiles.length}'),
                      style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w900, letterSpacing: 0.2),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
