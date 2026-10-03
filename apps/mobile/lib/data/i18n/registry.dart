// Per-module i18n string tables, merged into AppTranslations.values at startup.
//
// Each table maps a language code to key-value string pairs:
//   const Map<String, Map<String, String>> kXxxStrings = {
//     'en': { 'prefix.key': '...' },
//     'mr': { ... }, 'hi': { ... }, 'gu': { ... },
//     'pa': { ... }, 'te': { ... }, 'ta': { ... },
//   };
//
// Add one import + one entry per strings_<module>.dart file in this directory.

import 'strings_account.dart';
import 'strings_advisory.dart';
import 'strings_bank.dart';
import 'strings_base_gu.dart';
import 'strings_base_pa.dart';
import 'strings_base_ta.dart';
import 'strings_base_te.dart';
import 'strings_bookings.dart';
import 'strings_climate.dart';
import 'strings_common.dart';
import 'strings_content.dart';
import 'strings_crop_insurance.dart';
import 'strings_direct.dart';
import 'strings_emarket.dart';
import 'strings_equipment.dart';
import 'strings_farm_diary.dart';
import 'strings_finance.dart';
import 'strings_fpo.dart';
import 'strings_gyan_hub.dart';
import 'strings_land_legal.dart';
import 'strings_landlord.dart';
import 'strings_livestock.dart';
import 'strings_loans.dart';
import 'strings_market.dart';
import 'strings_navigation.dart';
import 'strings_onboarding.dart';
import 'strings_persona.dart';
import 'strings_post_harvest.dart';
import 'strings_profile.dart';
import 'strings_profile_home.dart';
import 'strings_profit_loss.dart';
import 'strings_refer.dart';
import 'strings_reviews.dart';
import 'strings_schemes.dart';
import 'strings_trade.dart';
import 'strings_transporter.dart';
import 'strings_tree.dart';
import 'strings_voice.dart';
import 'strings_water.dart';
import 'strings_women.dart';

const List<Map<String, Map<String, String>>> kAllModuleTables = [
  kAccountStrings,
  kAdvisoryStrings,
  kBankStrings,
  kBaseGuStrings,
  kBasePaStrings,
  kBaseTaStrings,
  kBaseTeStrings,
  kBookingsStrings,
  kClimateStrings,
  kCommonStrings,
  kContentStrings,
  kCropInsuranceStrings,
  kDirectStrings,
  kEmarketStrings,
  kEquipmentStrings,
  kFarmDiaryStrings,
  kFinanceStrings,
  kFpoStrings,
  kGyanHubStrings,
  kLandLegalStrings,
  kLandlordStrings,
  kLivestockStrings,
  kLoansStrings,
  kMarketStrings,
  kNavigationStrings,
  kOnboardingStrings,
  kPersonaStrings,
  kPostHarvestStrings,
  kProfileStrings,
  kProfileHomeStrings,
  kProfitLossStrings,
  kReferStrings,
  kReviewsStrings,
  kSchemesStrings,
  kTradeStrings,
  kTransporterStrings,
  kTreeStrings,
  kVoiceStrings,
  kWaterStrings,
  kWomenStrings,
];
