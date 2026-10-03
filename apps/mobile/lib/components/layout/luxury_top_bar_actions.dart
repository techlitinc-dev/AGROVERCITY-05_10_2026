// Right-side actions for LuxuryTopBar: spray alert capsule, AgriCoins pill,
// language selector pill, notifications bell, avatar account menu, logout button + dialog.

import 'package:flutter/material.dart';

import '../../data/translations.dart';
import '../../state/app_state.dart';
import '../../state/profile_routes.dart';
import '../common/motion_animations.dart';

class TopBarActions extends StatelessWidget {
  final AppState state;
  final bool isWomen;

  const TopBarActions({super.key, required this.state, required this.isWomen});

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: state,
      builder: (context, _) {
        return Row(
          mainAxisSize: MainAxisSize.min,
          children: [
        // A. AgriCoins Pill
        GestureDetector(
          onTap: () => state.navigateTo('krishiRatna'),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 4.5),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF2A200B), Color(0xFF3D2D0F)],
              ),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: const Color(0xFFE9C46A).withValues(alpha: 0.85),
                width: 1.0,
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.monetization_on_rounded,
                    size: 12.5, color: Color(0xFFE9C46A)),
                const SizedBox(width: 3),
                Text(
                  "${state.profile.agriCoins}",
                  style: const TextStyle(
                    fontSize: 10.5,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFFE9C46A),
                  ),
                ),
              ],
            ),
          ),
        ),

        const SizedBox(width: 4),

        // C. Language Selector Pill (English / मराठी / हिन्दी)
        PopupMenuButton<String>(
          key: const ValueKey('topbar_language_button'),
          tooltip: state.tr('language'),
          padding: EdgeInsets.zero,
          offset: const Offset(0, 36),
          color: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          onSelected: (lang) => state.setLanguage(lang),
          itemBuilder: (ctx) => [
            for (final entry in AppTranslations.languageNames.entries)
              PopupMenuItem<String>(
                value: entry.key,
                child: Row(
                  children: [
                    Text(
                      entry.key == 'en' ? '🇬🇧' : (entry.key == 'mr' ? '🚩' : '🇮🇳'),
                      style: const TextStyle(fontSize: 15),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        entry.value,
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: state.language == entry.key
                              ? FontWeight.w900
                              : FontWeight.w500,
                          color: state.language == entry.key
                              ? const Color(0xFF2E7D32)
                              : const Color(0xFF263238),
                        ),
                      ),
                    ),
                    if (state.language == entry.key)
                      const Icon(Icons.check_circle_rounded, size: 16, color: Color(0xFF2E7D32)),
                  ],
                ),
              ),
          ],
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4.5),
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.35),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: const Color(0xFFE9C46A).withValues(alpha: 0.85),
                width: 1.0,
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  Icons.translate_rounded,
                  size: 13,
                  color: Color(0xFFE9C46A),
                ),
                const SizedBox(width: 2.5),
                Text(
                  state.language.toUpperCase(),
                  style: const TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFFE9C46A),
                  ),
                ),
              ],
            ),
          ),
        ),

        const SizedBox(width: 4),

        // D. Notifications bell
        Tooltip(
          message: state.tr('notifications'),
          child: BouncyPressable(
            onTap: () => state.navigateTo('notifications'),
            child: Container(
              width: 28,
              height: 28,
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.35),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: const Color(0xFFE9C46A).withValues(alpha: 0.85),
                  width: 1.0,
                ),
              ),
              child: const Center(
                child: Icon(Icons.notifications_rounded,
                    size: 15, color: Color(0xFFE9C46A)),
              ),
            ),
          ),
        ),

        const SizedBox(width: 4),

        // E. Avatar account menu
        PopupMenuButton<String>(
          tooltip: state.tr('accountMenu'),
          padding: EdgeInsets.zero,
          iconSize: 28,
          onSelected: (route) {
            if (route == 'language') {
              showLanguageSelectionSheet(context, state);
            } else if (route == 'home') {
              state.navigateTo(ProfileRoutes.defaultRouteFor(state.activeProfile));
            } else {
              state.navigateTo(route);
            }
          },
          itemBuilder: (ctx) => [
            PopupMenuItem(
              value: 'home',
              child: Row(
                children: [
                  const Icon(Icons.home_rounded, size: 18),
                  const SizedBox(width: 8),
                  Text(state.tr('home')),
                ],
              ),
            ),
            PopupMenuItem(
              value: 'settings',
              child: Row(
                children: [
                  const Icon(Icons.settings_rounded, size: 18),
                  const SizedBox(width: 8),
                  Text(state.tr('settings')),
                ],
              ),
            ),
            PopupMenuItem(
              value: 'language',
              child: Row(
                children: [
                  const Icon(Icons.translate_rounded, size: 18),
                  const SizedBox(width: 8),
                  Text(state.tr('language')),
                ],
              ),
            ),
            PopupMenuItem(
              value: 'helpSupport',
              child: Row(
                children: [
                  const Icon(Icons.help_outline_rounded, size: 18),
                  const SizedBox(width: 8),
                  Text(state.tr('help')),
                ],
              ),
            ),
          ],
          icon: CircleAvatar(
            radius: 14,
            backgroundColor: const Color(0xFFE9C46A),
            child: Text(
              state.profile.name.isNotEmpty
                  ? state.profile.name.characters.first.toUpperCase()
                  : 'A',
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w900,
                color: Color(0xFF112A1F),
              ),
            ),
          ),
        ),

        const SizedBox(width: 4),

        // F. Log out button
        Tooltip(
          message: state.tr('logout'),
          child: BouncyPressable(
            onTap: () => showTopBarLogoutDialog(context, state),
            child: Container(
              width: 28,
              height: 28,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFFEF4444), Color(0xFFDC2626)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.white, width: 1.4),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFFDC2626).withValues(alpha: 0.55),
                    blurRadius: 5,
                    offset: const Offset(0, 1),
                  ),
                ],
              ),
              child: const Center(
                child: Icon(Icons.logout_rounded,
                    size: 15, color: Colors.white),
              ),
            ),
          ),
        ),
      ],
    );
      },
    );
  }
}

void showLanguageSelectionSheet(BuildContext context, AppState state) {
  showModalBottomSheet(
    context: context,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    builder: (ctx) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    const Icon(Icons.translate_rounded, color: Color(0xFF2E7D32), size: 22),
                    const SizedBox(width: 8),
                    Text(
                      state.tr('selectLanguagePrompt'),
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFF112A1F),
                      ),
                    ),
                  ],
                ),
                IconButton(
                  icon: const Icon(Icons.close_rounded),
                  onPressed: () => Navigator.pop(ctx),
                ),
              ],
            ),
            const SizedBox(height: 12),
            ...AppTranslations.languageNames.entries.map((e) {
              final isSel = state.language == e.key;
              return Container(
                margin: const EdgeInsets.only(bottom: 8),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: isSel ? const Color(0xFF43A047) : Colors.grey.shade200,
                    width: isSel ? 1.5 : 1.0,
                  ),
                ),
                child: Material(
                  color: isSel ? const Color(0xFFE8F5E9) : Colors.grey.shade50,
                  borderRadius: BorderRadius.circular(12),
                  clipBehavior: Clip.antiAlias,
                  child: ListTile(
                  dense: true,
                  leading: Text(
                    e.key == 'en' ? '🇬🇧' : (e.key == 'mr' ? '🚩' : '🇮🇳'),
                    style: const TextStyle(fontSize: 20),
                  ),
                  title: Text(
                    e.value,
                    style: TextStyle(
                      fontWeight: isSel ? FontWeight.w900 : FontWeight.w600,
                      color: isSel ? const Color(0xFF1B5E20) : const Color(0xFF263238),
                    ),
                  ),
                  trailing: isSel
                      ? const Icon(Icons.check_circle_rounded, color: Color(0xFF2E7D32))
                      : null,
                  onTap: () {
                    Navigator.pop(ctx);
                    state.setLanguage(e.key);
                  },
                ),
              ),
            );
            }),
          ],
        ),
      ),
    ),
  );
}

void showTopBarLogoutDialog(BuildContext context, AppState state) {
  showDialog(
    context: context,
    builder: (ctx) => AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
      backgroundColor: Colors.white,
      surfaceTintColor: Colors.transparent,
      title: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(7),
            decoration: const BoxDecoration(
              color: Color(0xFFFEE2E2),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.logout_rounded,
                color: Color(0xFFDC2626), size: 20),
          ),
          const SizedBox(width: 10),
          Text(
            state.tr('logoutConfirm'),
            style: const TextStyle(
              fontSize: 17,
              fontWeight: FontWeight.w900,
              color: Color(0xFF112A1F),
            ),
          ),
        ],
      ),
      content: Text(
        state.tr('logoutMsg'),
        style: const TextStyle(fontSize: 13, color: Color(0xFF4B5563), height: 1.4),
      ),
      actionsPadding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(ctx),
          child: Text(
            state.tr('cancel'),
            style: const TextStyle(
              color: Color(0xFF6B7280),
              fontWeight: FontWeight.w700,
              fontSize: 12.5,
            ),
          ),
        ),
        ElevatedButton(
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFFDC2626),
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12)),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            elevation: 2,
          ),
          onPressed: () {
            Navigator.pop(ctx);
            state.logout();
          },
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.logout_rounded, size: 14),
              const SizedBox(width: 5),
              Text(
                state.tr('logout'),
                style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 12.5),
              ),
            ],
          ),
        ),
      ],
    ),
  );
}
