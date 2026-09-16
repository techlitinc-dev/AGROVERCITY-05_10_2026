import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppColors {
  AppColors._();

  static const Color background = Color(0xFFF5F7FA);
  static const Color card = Color(0xFFFFFFFF);
  static const Color primary = Color(0xFF43A047);
  static const Color accent = Color(0xFFE8F5E9);

  static const Color landlordPurple = Color(0xFF8B5CF6);
  static const Color transportBlue = Color(0xFF0284C7);
  static const Color sellerOrange = Color(0xFFEA580C);
  static const Color equipmentAmber = Color(0xFFF59E0B);
  static const Color brokerTeal = Color(0xFF14B8A6);
  static const Color womenRose = Color(0xFFBE123C);
}

ThemeData buildAppTheme() {
  return ThemeData(
    useMaterial3: true,
    scaffoldBackgroundColor: AppColors.background,
    colorScheme: ColorScheme.fromSeed(
      seedColor: AppColors.primary,
      brightness: Brightness.light,
    ),
    textTheme: GoogleFonts.muktaTextTheme(),
  );
}
