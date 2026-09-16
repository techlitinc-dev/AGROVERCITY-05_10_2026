// Luxury Interactive Animated Multi-Profile Switcher & Role Management Sheet

import 'dart:ui';
import 'package:flutter/material.dart';
import '../../state/app_state.dart';
import '../../models/user_profile_type.dart';
import '../common/motion_animations.dart';

class ProfileSwitcherSheet extends StatelessWidget {
  final AppState state;
  const ProfileSwitcherSheet({super.key, required this.state});

  @override
  Widget build(BuildContext context) {
    final activeMeta = state.activeProfileMeta;
    final allPersonas = UserProfileRegistry.all.values.toList();

    return ClipRRect(
      borderRadius: const BorderRadius.vertical(top: Radius.circular(32)),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
        child: Container(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.of(context).size.height * 0.88,
          ),
          padding: const EdgeInsets.fromLTRB(18, 12, 18, 24),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.96),
            borderRadius: const BorderRadius.vertical(top: Radius.circular(32)),
            border: Border.all(color: Colors.white.withValues(alpha: 0.6), width: 1.5),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.2),
                blurRadius: 36,
                offset: const Offset(0, -8),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 1. Top Pull Handle
              Center(
                child: Container(
                  width: 44,
                  height: 4.5,
                  decoration: BoxDecoration(
                    color: Colors.grey.shade400,
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
              ),
              const SizedBox(height: 14),

              // 2. Sheet Header with Close Action
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(7),
                        decoration: BoxDecoration(
                          color: activeMeta.primaryColor.withValues(alpha: 0.12),
                          shape: BoxShape.circle,
                        ),
                        child: Icon(Icons.swap_horizontal_circle_rounded, color: activeMeta.primaryColor, size: 20),
                      ),
                      const SizedBox(width: 8),
                      const Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            "प्रोफाइल स्विचर (Role Switcher)",
                            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Color(0xFF112A1F)),
                          ),
                          Text(
                            "एक टैप में अपनी सक्रिय भूमिका बदलें",
                            style: TextStyle(fontSize: 11, color: Colors.grey),
                          ),
                        ],
                      ),
                    ],
                  ),
                  BouncyPressable(
                    onTap: () => Navigator.pop(context),
                    child: Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: Colors.grey.shade100,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.close_rounded, size: 18, color: Colors.black87),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),

              // 3. Current User Status Glassmorphic Header Card
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      activeMeta.primaryColor.withValues(alpha: 0.15),
                      activeMeta.accentColor.withValues(alpha: 0.05),
                    ],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: activeMeta.primaryColor.withValues(alpha: 0.3)),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [activeMeta.primaryColor, activeMeta.accentColor],
                        ),
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: activeMeta.primaryColor.withValues(alpha: 0.4),
                            blurRadius: 10,
                            offset: const Offset(0, 3),
                          ),
                        ],
                      ),
                      child: Center(
                        child: Icon(activeMeta.icon, color: Colors.white, size: 22),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            state.profile.name,
                            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Color(0xFF1E293B)),
                          ),
                          const SizedBox(height: 2),
                          Row(
                            children: [
                              Container(
                                width: 7,
                                height: 7,
                                decoration: const BoxDecoration(
                                  color: Color(0xFF16A34A),
                                  shape: BoxShape.circle,
                                ),
                              ),
                              const SizedBox(width: 5),
                              Text(
                                "सक्रिय: ${activeMeta.labelHi} (${activeMeta.labelEn})",
                                style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: activeMeta.primaryColor),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: Colors.grey.shade200),
                      ),
                      child: Text(
                        "${state.linkedProfiles.length} / 6 जुड़ी हैं",
                        style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: Color(0xFF1E293B)),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // 4. Linked Profiles Horizontal Animated Slider
              const Text(
                "आपकी सक्रिय प्रोफाइल (Tap to Switch):",
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w900, color: Color(0xFF1E293B)),
              ),
              const SizedBox(height: 8),

              SizedBox(
                height: 136,
                child: ListView.separated(
                  physics: const BouncingScrollPhysics(),
                  scrollDirection: Axis.horizontal,
                  itemCount: state.linkedProfiles.length,
                  separatorBuilder: (context, i) => const SizedBox(width: 10),
                  itemBuilder: (context, idx) {
                    final type = state.linkedProfiles[idx];
                    final meta = UserProfileRegistry.meta(type);
                    final isActive = state.activeProfile == type;

                    return StaggeredSlideFade(
                      delayMs: idx * 40,
                      duration: const Duration(milliseconds: 300),
                      child: BouncyPressable(
                        onTap: () {
                          state.switchProfile(type);
                          Navigator.pop(context);
                        },
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 240),
                          curve: Curves.easeOutCubic,
                          width: 154,
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            gradient: isActive
                                ? LinearGradient(
                                    colors: [meta.primaryColor, meta.accentColor],
                                    begin: Alignment.topLeft,
                                    end: Alignment.bottomRight,
                                  )
                                : null,
                            color: isActive ? null : Colors.white,
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(
                              color: isActive ? meta.primaryColor : Colors.grey.shade200,
                              width: isActive ? 2.0 : 1.2,
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: isActive
                                    ? meta.primaryColor.withValues(alpha: 0.35)
                                    : Colors.black.withValues(alpha: 0.04),
                                blurRadius: isActive ? 14 : 6,
                                offset: const Offset(0, 4),
                              ),
                            ],
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Container(
                                    padding: const EdgeInsets.all(6),
                                    decoration: BoxDecoration(
                                      color: isActive
                                          ? Colors.white.withValues(alpha: 0.25)
                                          : meta.primaryColor.withValues(alpha: 0.12),
                                      shape: BoxShape.circle,
                                    ),
                                    child: Icon(
                                      meta.icon,
                                      size: 18,
                                      color: isActive ? Colors.white : meta.primaryColor,
                                    ),
                                  ),
                                  if (isActive)
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                      decoration: BoxDecoration(
                                        color: Colors.white,
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                      child: Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          Icon(Icons.check_circle_rounded, size: 10, color: meta.primaryColor),
                                          const SizedBox(width: 2),
                                          Text(
                                            "सक्रिय",
                                            style: TextStyle(
                                              fontSize: 8.5,
                                              fontWeight: FontWeight.w900,
                                              color: meta.primaryColor,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                ],
                              ),
                              const Spacer(),
                              Text(
                                meta.labelHi,
                                style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w900,
                                  color: isActive ? Colors.white : const Color(0xFF1E293B),
                                ),
                              ),
                              Text(
                                meta.labelEn,
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700,
                                  color: isActive ? Colors.white.withValues(alpha: 0.8) : Colors.grey.shade500,
                                ),
                              ),
                              const SizedBox(height: 3),
                              Text(
                                isActive ? "वर्तमान डैशबोर्ड ➔" : "टैप कर स्विच करें ⚡",
                                style: TextStyle(
                                  fontSize: 9,
                                  fontWeight: FontWeight.w800,
                                  color: isActive ? const Color(0xFFFFF176) : meta.primaryColor,
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
              const SizedBox(height: 16),

              // 5. Manage All 6 Roles (Add / Remove Roles)
              const Text(
                "सभी भूमिकाएं प्रबंधित करें (Link or Unlink Roles):",
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w900, color: Color(0xFF1E293B)),
              ),
              const SizedBox(height: 8),

              Flexible(
                child: ListView.separated(
                  shrinkWrap: true,
                  physics: const BouncingScrollPhysics(),
                  itemCount: allPersonas.length,
                  separatorBuilder: (context, i) => const SizedBox(height: 8),
                  itemBuilder: (context, idx) {
                    final meta = allPersonas[idx];
                    final isLinked = state.linkedProfiles.contains(meta.type);
                    final isActive = state.activeProfile == meta.type;

                    return Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: isLinked ? meta.primaryColor.withValues(alpha: 0.05) : Colors.grey.shade50,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: isLinked ? meta.primaryColor.withValues(alpha: 0.3) : Colors.grey.shade200,
                        ),
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 38,
                            height: 38,
                            decoration: BoxDecoration(
                              color: isLinked
                                  ? meta.primaryColor.withValues(alpha: 0.15)
                                  : Colors.grey.shade200,
                              shape: BoxShape.circle,
                            ),
                            child: Icon(
                              meta.icon,
                              size: 19,
                              color: isLinked ? meta.primaryColor : Colors.grey.shade500,
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Text(
                                      meta.labelHi,
                                      style: TextStyle(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w900,
                                        color: isLinked ? const Color(0xFF1E293B) : Colors.grey.shade700,
                                      ),
                                    ),
                                    const SizedBox(width: 4),
                                    Text(
                                      "(${meta.labelEn})",
                                      style: TextStyle(fontSize: 10.5, color: Colors.grey.shade500),
                                    ),
                                    if (isActive)
                                      Container(
                                        margin: const EdgeInsets.only(left: 6),
                                        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                                        decoration: BoxDecoration(
                                          color: meta.primaryColor,
                                          borderRadius: BorderRadius.circular(5),
                                        ),
                                        child: const Text(
                                          "ACTIVE",
                                          style: TextStyle(fontSize: 8, fontWeight: FontWeight.w900, color: Colors.white),
                                        ),
                                      ),
                                  ],
                                ),
                                Text(
                                  meta.taglineHi,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(fontSize: 10, color: Colors.grey.shade600),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 8),

                          // Toggle Button
                          BouncyPressable(
                            onTap: () {
                              state.toggleLinkedProfile(meta.type);
                            },
                            child: AnimatedContainer(
                              duration: const Duration(milliseconds: 200),
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                              decoration: BoxDecoration(
                                color: isLinked
                                    ? (isActive ? Colors.grey.shade200 : const Color(0xFFFEE2E2))
                                    : meta.primaryColor,
                                borderRadius: BorderRadius.circular(10),
                                border: isLinked && !isActive
                                    ? Border.all(color: const Color(0xFFFCA5A5))
                                    : null,
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    isLinked ? (isActive ? Icons.lock_rounded : Icons.remove_rounded) : Icons.add_rounded,
                                    size: 13,
                                    color: isLinked ? (isActive ? Colors.grey : const Color(0xFFDC2626)) : Colors.white,
                                  ),
                                  const SizedBox(width: 3),
                                  Text(
                                    isLinked ? (isActive ? "सक्रिय" : "हटाएं") : "जोड़ें +",
                                    style: TextStyle(
                                      fontSize: 10.5,
                                      fontWeight: FontWeight.w800,
                                      color: isLinked ? (isActive ? Colors.grey : const Color(0xFFDC2626)) : Colors.white,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
