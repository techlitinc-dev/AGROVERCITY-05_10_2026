const String pathAppConfig = '/app-config';

const String pathAuthFirebaseVerify = '/auth/firebase-verify';
const String pathAuthLogin = '/auth/login';
const String pathAuthRefresh = '/auth/refresh';
const String pathAuthMpinSet = '/auth/mpin/set';
const String pathAuthMpinVerify = '/auth/mpin/verify';
const String pathAuthMpinReset = '/auth/mpin/reset';
const String pathAuthRegister = '/auth/register';

const String pathUsersMe = '/users/me';
const String pathUsersMeFarmBoundary = '/users/me/farm-boundary';
const String pathUsersMeProfiles = '/users/me/profiles';

const String pathWeather = '/weather';

const String pathMandiPrices = '/mandi/prices';
const String pathMandiList = '/mandi/list';
const String pathMandiVyapariRates = '/mandi/vyapari-rates';
const String pathMandiCompare = '/mandi/compare';
const String pathMandiPriceHistory = '/mandi/prices/history';

const String pathMarketLots = '/market/lots';

const String pathContracts = '/contracts';

const String pathTransportVehicles = '/transport/vehicles';
const String pathTransportVehiclesMy = '/transport/vehicles/my';
const String pathTransportFareEstimate = '/transport/fare-estimate';
const String pathTransportBookings = '/transport/bookings';

String contractPath(String contractId) => '$pathContracts/$contractId';
String contractAcceptPath(String contractId) =>
    '$pathContracts/$contractId/accept';

String transportVehiclePath(String vehicleId) =>
    '$pathTransportVehicles/$vehicleId';
String transportVehicleCalendarPath(String vehicleId) =>
    '$pathTransportVehicles/$vehicleId/calendar';
String transportVehicleAvailabilityPath(String vehicleId) =>
    '$pathTransportVehicles/$vehicleId/availability';
String transportBookingPath(String bookingId) =>
    '$pathTransportBookings/$bookingId';
String transportBookingAcceptPath(String bookingId) =>
    '$pathTransportBookings/$bookingId/accept';
String transportBookingRejectPath(String bookingId) =>
    '$pathTransportBookings/$bookingId/reject';

const String pathTransportProfile = '/transport/profile';
const String pathTransportLoads = '/transport/loads';
const String pathTransportAnalytics = '/transport/analytics';

String transportLoadPath(String loadId) => '$pathTransportLoads/$loadId';
String transportLoadBidPath(String loadId) => '$pathTransportLoads/$loadId/bid';
String transportLoadBidsPath(String loadId) =>
    '$pathTransportLoads/$loadId/bids';
String transportLoadAcceptBidPath(String loadId) =>
    '$pathTransportLoads/$loadId/accept-bid';

String transportBookingLocationPath(String bookingId) =>
    '$pathTransportBookings/$bookingId/location';
String transportBookingBiltyPath(String bookingId) =>
    '$pathTransportBookings/$bookingId/bilty';
String transportBookingWeighbridgePath(String bookingId) =>
    '$pathTransportBookings/$bookingId/weighbridge';
String transportBookingExpensesPath(String bookingId) =>
    '$pathTransportBookings/$bookingId/expenses';

const String pathProducts = '/products';
const String pathCart = '/cart';
const String pathCartItems = '/cart/items';
const String pathOrders = '/orders';
const String pathRazorpayOrder = '/payments/razorpay/order';
const String pathRazorpayVerify = '/payments/razorpay/verify';
const String pathAddresses = '/addresses';
const String pathWishlist = '/wishlist';
const String pathWishlistItems = '/wishlist/items';
const String pathCoupons = '/coupons';
const String pathCouponsValidate = '/coupons/validate';

String productPath(String productId) => '$pathProducts/$productId';
String productCertificatePath(String productId) =>
    '$pathProducts/$productId/certificate';
String cartItemPath(String productId) => '$pathCartItems/$productId';
String orderPath(String orderId) => '$pathOrders/$orderId';
String orderCancelPath(String orderId) => '$pathOrders/$orderId/cancel';
String orderTimelinePath(String orderId) => '$pathOrders/$orderId/timeline';
String orderReturnPath(String orderId) => '$pathOrders/$orderId/return';
String addressPath(String addressId) => '$pathAddresses/$addressId';
String wishlistItemPath(String productId) => '$pathWishlistItems/$productId';

// E-Market seller product management (seller role only)
const String pathSellerProducts = '/seller/products';

String sellerProductPath(String productId) => '$pathSellerProducts/$productId';

// E-Market my-products management (any logged-in user)
const String pathMyProducts = '/my-products';

String myProductPath(String productId) => '$pathMyProducts/$productId';

// E-Market analytics (customer & seller dashboards)
const String pathAnalyticsCustomer = '/analytics/customer';
const String pathAnalyticsSeller = '/analytics/seller';

String marketLotPath(String lotId) => '$pathMarketLots/$lotId';

const String pathEquipment = '/equipment';
const String pathEquipmentOwnerFleet = '/equipment/owner/fleet';
const String pathEquipmentBookingsPending = '/equipment/bookings/pending';

String equipmentPath(String equipmentId) => '$pathEquipment/$equipmentId';
String equipmentSlotsPath(String equipmentId) =>
    '$pathEquipment/$equipmentId/slots';
String equipmentSlotBookPath(String slotId) =>
    '$pathEquipment/slots/$slotId/book';
String equipmentSlotWaitlistPath(String slotId) =>
    '$pathEquipment/slots/$slotId/waitlist';
String equipmentBookingPath(String bookingId) =>
    '$pathEquipment/bookings/$bookingId';
String equipmentBookingApprovePath(String bookingId) =>
    '$pathEquipment/bookings/$bookingId/approve';
String equipmentBookingRejectPath(String bookingId) =>
    '$pathEquipment/bookings/$bookingId/reject';

const String pathDiaryEntries = '/diary/entries';
const String pathDiaryReport = '/diary/report';

String diaryEntryPath(String entryId) => '$pathDiaryEntries/$entryId';

const String pathPnlSummary = '/pnl/summary';
const String pathPnlCrops = '/pnl/crops';
const String pathPnlBreakEven = '/pnl/break-even';

String pnlCropExpensesPath(String cropId) => '$pathPnlCrops/$cropId/expenses';

const String pathFinanceCreditScore = '/finance/credit-score';
const String pathFinanceLoanCalculator = '/finance/loan-calculator';
const String pathFinanceKcc = '/finance/kcc';
const String pathFinanceLoans = '/finance/loans';
const String pathFinanceLoansApply = '/finance/loans/apply';

// Loan management (farmer tracking + bankManager review workspace)
const String pathLoans = '/loans';
const String pathLoansQueue = '/loans/queue';
const String pathLoansStats = '/loans/stats';

String loanPath(String applicationId) => '$pathLoans/$applicationId';
String loanReviewPath(String applicationId) =>
    '$pathLoans/$applicationId/review';
String loanApprovePath(String applicationId) =>
    '$pathLoans/$applicationId/approve';
String loanRejectPath(String applicationId) =>
    '$pathLoans/$applicationId/reject';
String loanInfoRequestPath(String applicationId) =>
    '$pathLoans/$applicationId/info-request';
String loanRespondPath(String applicationId) =>
    '$pathLoans/$applicationId/respond';
String loanCancelPath(String applicationId) =>
    '$pathLoans/$applicationId/cancel';
String loanDisbursePath(String applicationId) =>
    '$pathLoans/$applicationId/disburse';
String loanSchedulePath(String applicationId) =>
    '$pathLoans/$applicationId/schedule';
String loanDocumentsPath(String applicationId) =>
    '$pathLoans/$applicationId/documents';

const String pathLandPlots = '/land/plots';
const String pathLandLeases = '/land/leases';
const String pathLandListings = '/land/listings';
const String pathLandListingsMine = '/land/listings/mine';
const String pathLandLeaseRequests = '/land/lease-requests';

String landPlotPath(String plotId) => '$pathLandPlots/$plotId';
String landLeasePath(String leaseId) => '$pathLandLeases/$leaseId';
String landLeasePaymentsPath(String leaseId) =>
    '$pathLandLeases/$leaseId/payments';
String landLeaseAgreementPdfPath(String leaseId) =>
    '$pathLandLeases/$leaseId/agreement-pdf';
String landListingPath(String listingId) => '$pathLandListings/$listingId';
String landLeaseRequestAcceptPath(String requestId) =>
    '$pathLandLeaseRequests/$requestId/accept';
String landLeaseRequestRejectPath(String requestId) =>
    '$pathLandLeaseRequests/$requestId/reject';

const String pathBankAccounts = '/bank-accounts';

String bankAccountPath(String accountId) => '$pathBankAccounts/$accountId';
String bankAccountVerifyPath(String accountId) =>
    '$pathBankAccounts/$accountId/verify';
String bankAccountSetPrimaryPath(String accountId) =>
    '$pathBankAccounts/$accountId/set-primary';

const String pathTransportSettlements = '/transport/settlements';
const String pathEquipmentSettlements = '/equipment/settlements';
const String pathBrokerSettlements = '/broker/settlements';

const String pathFpoMe = '/fpo/me';
const String pathFpoPools = '/fpo/pools';
const String pathFpoMachinery = '/fpo/machinery';

String fpoPoolJoinPath(String poolId) => '$pathFpoPools/$poolId/join';

String userProfilePath(String profileType) =>
    '$pathUsersMeProfiles/$profileType';
String userProfileActivatePath(String profileType) =>
    '$pathUsersMeProfiles/$profileType/activate';
String userProfilePrimaryPath(String profileType) =>
    '$pathUsersMeProfiles/$profileType/primary';

const String pathSchemes = '/schemes';
const String pathSchemesPortals = '/schemes/portals';

String schemeApplyPath(String schemeId) => '$pathSchemes/$schemeId/apply';

const String pathVaultDocuments = '/vault/documents';

String vaultDocumentPath(String documentId) =>
    '$pathVaultDocuments/$documentId';

const String pathLandRecordsSearch = '/land-records/search';

String landRecordPdfPath(String recordId) => '/land-records/$recordId/pdf';
String landRecordImportPath(String recordId) =>
    '/land-records/$recordId/import';

const String pathWaterSchedule = '/water/schedule';
const String pathWaterGroundwater = '/water/groundwater';
const String pathWaterCanalRotation = '/water/canal-rotation';
const String pathWaterPmksyCalculator = '/water/pmksy-calculator';

const String pathNotifications = '/notifications';
const String pathNotificationsReadAll = '/notifications/read-all';

String notificationReadPath(String id) => '$pathNotifications/$id/read';

const String pathUsersMeSettings = '/users/me/settings';
const String pathUsersMeConsents = '/users/me/consents';

const String pathDevices = '/devices';

String devicePath(String tokenHash) => '$pathDevices/$tokenHash';

const String pathSoilTests = '/soil-tests';
const String pathSoilTestsBook = '/soil-tests/book';

const String pathInsurancePolicies = '/insurance/policies';
const String pathInsurancePoliciesApply = '/insurance/policies/apply';
const String pathInsuranceRates = '/insurance/rates';
const String pathInsuranceClaims = '/insurance/claims';

String insurancePolicyCertificatePath(String policyId) =>
    '$pathInsurancePolicies/$policyId/certificate';
String insuranceClaimPath(String claimId) => '$pathInsuranceClaims/$claimId';
String insuranceClaimAppealPath(String claimId) =>
    '$pathInsuranceClaims/$claimId/appeal';

const String pathInsuranceSchemes = '/insurance/schemes';

// Insurance Provider Management Endpoints
const String pathInsuranceProviderPolicies = '/insurance/provider/policies';
String insuranceProviderPolicyPath(String policyId) =>
    '$pathInsuranceProviderPolicies/$policyId';
String insuranceProviderPolicyReviewPath(String policyId) =>
    '$pathInsuranceProviderPolicies/$policyId/review';

const String pathInsuranceProviderClaims = '/insurance/provider/claims';
String insuranceProviderClaimPath(String claimId) =>
    '$pathInsuranceProviderClaims/$claimId';
String insuranceProviderClaimScheduleSurveyPath(String claimId) =>
    '$pathInsuranceProviderClaims/$claimId/schedule_survey';
String insuranceProviderClaimSurveyReportPath(String claimId) =>
    '$pathInsuranceProviderClaims/$claimId/survey_report';
String insuranceProviderClaimReviewPath(String claimId) =>
    '$pathInsuranceProviderClaims/$claimId/review';
String insuranceProviderClaimDisbursePath(String claimId) =>
    '$pathInsuranceProviderClaims/$claimId/disburse';

const String pathInsuranceProviderStats = '/insurance/provider/stats';
const String pathInsuranceProviderRates = '/insurance/provider/rates';

const String pathUsersMeBookings = '/users/me/bookings';

const String pathNews = '/news';
const String pathChannels = '/channels';

String channelChatPath(String channelId) => '$pathChannels/$channelId/chat';

const String pathWorkshops = '/workshops';
const String pathExpertTalks = '/expert-talks';
const String pathVideos = '/videos';
const String pathBlogs = '/blogs';

String workshopEnrollPath(String workshopId) =>
    '$pathWorkshops/$workshopId/enroll';
String expertTalkRegisterPath(String talkId) =>
    '$pathExpertTalks/$talkId/register';
String expertTalkQuestionsPath(String talkId) =>
    '$pathExpertTalks/$talkId/questions';
String blogBookmarkPath(String blogId) => '$pathBlogs/$blogId/bookmark';
String blogLikePath(String blogId) => '$pathBlogs/$blogId/like';

// Instructor courses & podcasts (module 27)
const String pathCourses = '/courses';
const String pathCoursesMine = '/courses/mine';
const String pathCoursesPurchasedList = '/courses/purchased/list';
const String pathCoursesMyLearning = '/courses/my-learning';
const String pathCoursesPurchasesVerify = '/courses/purchases/verify';

String coursePath(String courseId) => '$pathCourses/$courseId';
String coursePurchasePath(String courseId) => '$pathCourses/$courseId/purchase';
String courseEnrollPath(String courseId) => '$pathCourses/$courseId/enroll';
String courseLearnPath(String courseId) => '$pathCourses/$courseId/learn';
String courseLessonProgressPath(String courseId, String lessonId) =>
    '$pathCourses/$courseId/lessons/$lessonId/progress';
String courseCertificatePath(String courseId) =>
    '$pathCourses/$courseId/certificate';
String courseReviewsPath(String courseId) => '$pathCourses/$courseId/reviews';
String courseQuestionsPath(String courseId) =>
    '$pathCourses/$courseId/questions';
String courseQuestionAnswersPath(String courseId, String questionId) =>
    '$pathCourses/$courseId/questions/$questionId/answers';

// Teachers & Instructor Studio
const String pathTeachersMe = '/teachers/me';
const String pathTeachersStudents = '/teachers/students';
const String pathTeachersCertificatesIssue = '/teachers/certificates/issue';
const String pathTeachersAnnouncements = '/teachers/announcements';
const String pathTeachersAnalytics = '/teachers/analytics';
String teacherPath(String teacherId) => '/teachers/$teacherId';

// Platform Advertisements
const String pathAdsActive = '/ads/active';
const String pathAds = '/ads';
const String pathAdsMine = '/ads/mine';
String adPath(String adId) => '/ads/$adId';
String adImpressionPath(String adId) => '/ads/$adId/impression';
String adClickPath(String adId) => '/ads/$adId/click';

const String pathGaushalas = '/gaushalas';
const String pathNurseries = '/nurseries';
const String pathVets = '/vets';
const String pathDairyProducts = '/dairy-products';

String gaushalaManureOrderPath(String gaushalaId) =>
    '$pathGaushalas/$gaushalaId/manure-order';
String vetBookPath(String vetId) => '$pathVets/$vetId/book';
String dairyProductOrderPath(String productId) =>
    '$pathDairyProducts/$productId/order';

// Livestock & Dairy Manager full-fledged endpoints
const String pathLivestockAnimals = '/livestock/animals';
String livestockAnimalPath(String animalId) =>
    '$pathLivestockAnimals/$animalId';
String livestockAnimalLogsPath(String animalId) =>
    '$pathLivestockAnimals/$animalId/logs';

const String pathLivestockProcurementRateCalc =
    '/livestock/procurement/rate-calc';
const String pathLivestockProcurementCollections =
    '/livestock/procurement/collections';
const String pathLivestockProcurementSummary = '/livestock/procurement/summary';

const String pathLivestockBreeding = '/livestock/breeding';
String livestockBreedingStatusPath(String cycleId) =>
    '$pathLivestockBreeding/$cycleId/status';

const String pathLivestockVetRecords = '/livestock/vet/records';
const String pathLivestockVetVaccinations = '/livestock/vet/vaccinations';

const String pathLivestockGaushalaAdoptions = '/livestock/gaushala/adoptions';
const String pathLivestockGaushalaDonations = '/livestock/gaushala/donations';
const String pathLivestockGaushalaByproducts = '/livestock/gaushala/byproducts';

// Dairy + Gaushala + Doctor management (dairyManager persona consoles)
const String pathDairyMembers = '/livestock/dairy/members';
const String pathDairyRateChart = '/livestock/dairy/rate-chart';
const String pathDairyRateChartVersions =
    '/livestock/dairy/rate-chart/versions';
const String pathDairyPaymentBatches = '/livestock/dairy/payments/batches';
const String pathDairyFarmerPayments = '/livestock/dairy/farmer/payments';
const String pathDairyFarmerSlips = '/livestock/dairy/farmer/slips';
const String pathDairySalesCustomers = '/livestock/dairy/sales/customers';
const String pathDairySalesOrders = '/livestock/dairy/sales/orders';
const String pathDairySalesSummary = '/livestock/dairy/sales/summary';
const String pathDairyStockItems = '/livestock/dairy/stock/items';
const String pathGaushalaMine = '/livestock/gaushala/mine';
const String pathGaushalaProfile = '/livestock/gaushala/profile';
const String pathGaushalaCattle = '/livestock/gaushala/cattle';
const String pathGaushalaExpenses = '/livestock/gaushala/expenses';
const String pathGaushalaExpensesSummary =
    '/livestock/gaushala/expenses/summary';
const String pathGaushalaDashboard = '/livestock/gaushala/dashboard';
const String pathVetsManaged = '/livestock/vets/managed';
const String pathVetsClaim = '/livestock/vets/claim';
const String pathVetsMe = '/livestock/vets/me';
const String pathVetsMeSchedule = '/livestock/vets/me/schedule';
const String pathVetsMeAppointments = '/livestock/vets/me/appointments';
const String pathVetsMeEarnings = '/livestock/vets/me/earnings';
const String pathLivestockAppointments = '/livestock/appointments';
const String pathLivestockPrescriptions = '/livestock/prescriptions';
const String pathVetCampaigns = '/livestock/vet/campaigns';

String dairyMemberPath(String memberId) => '$pathDairyMembers/$memberId';
String dairyMemberStatementPath(String memberId) =>
    '$pathDairyMembers/$memberId/statement';
String dairyRateChartPath(String chartId) => '$pathDairyRateChart/$chartId';
String dairyPaymentBatchMarkPaidPath(String batchId) =>
    '$pathDairyPaymentBatches/$batchId/mark-paid';
String dairySaleCustomerPath(String customerId) =>
    '$pathDairySalesCustomers/$customerId';
String dairySaleOrderStatusPath(String orderId) =>
    '$pathDairySalesOrders/$orderId/status';
String dairyStockAdjustPath(String itemId) =>
    '$pathDairyStockItems/$itemId/adjust';
String gaushalaCattleEventsPath(String animalId) =>
    '$pathGaushalaCattle/$animalId/events';
String gaushalaAdoptionStatusPath(String adoptionId) =>
    '/livestock/gaushala/adoptions/$adoptionId/status';
String gaushalaDonationStatusPath(String donationId) =>
    '/livestock/gaushala/donations/$donationId/status';
String gaushalaExpensePath(String expenseId) =>
    '$pathGaushalaExpenses/$expenseId';
String vetManagedPath(String vetId) => '$pathVetsManaged/$vetId';
String livestockAppointmentStatusPath(String apptId) =>
    '$pathLivestockAppointments/$apptId/status';
String vetCampaignPath(String campaignId) => '$pathVetCampaigns/$campaignId';
String vetCampaignEnrollPath(String campaignId) =>
    '$pathVetCampaigns/$campaignId/enroll';
String vetCampaignMarkVaccinatedPath(String campaignId) =>
    '$pathVetCampaigns/$campaignId/mark-vaccinated';

const String pathTreeArticles = '/tree/articles';
const String pathTreeNgos = '/tree/ngos';
const String pathTreeBiofuel = '/tree/biofuel';
const String pathTreeCareGuides = '/tree/care-guides';
const String pathTreeCarbonEstimate = '/tree/carbon/estimate';
const String pathTreePlantations = '/tree/plantations';
const String pathTreePlantationsMine = '/tree/plantations/mine';
String treePlantationPath(String plantationId) =>
    '$pathTreePlantations/$plantationId';
String treePlantationLogsPath(String plantationId) =>
    '$pathTreePlantations/$plantationId/logs';
const String pathTreeSchemes = '/tree/schemes';
const String pathTreeSpeciesSuitability = '/tree/species-suitability';
const String pathTreeAdoptionsMine = '/tree/adoptions/mine';

String treeNgoSaplingRequestPath(String ngoId) =>
    '$pathTreeNgos/$ngoId/sapling-request';

const String pathChannelsSchedule = '/channels/schedule';
String channelScheduleRemindPath(String bcastId) =>
    '$pathChannelsSchedule/$bcastId/remind';
String channelPollsPath(String channelId) => '$pathChannels/$channelId/polls';
String channelPollVotePath(String channelId, String pollId) =>
    '$pathChannels/$channelId/polls/$pollId/vote';
String channelQuestionsPath(String channelId) =>
    '$pathChannels/$channelId/questions';
String channelQuestionUpvotePath(String channelId, String qId) =>
    '$pathChannels/$channelId/questions/$qId/upvote';
String channelQuestionAnswerPath(String channelId, String qId) =>
    '$pathChannels/$channelId/questions/$qId/answer';
String channelPinPath(String channelId) => '$pathChannels/$channelId/pin';
String channelGiftPath(String channelId) => '$pathChannels/$channelId/gift';

String productReviewsPath(String productId) =>
    '${productPath(productId)}/reviews';

const String pathRatings = '/ratings';

const String pathSync = '/sync';

const String pathWomenShg = '/women/shg';
const String pathWomenShgDeposit = '/women/shg/deposit';
const String pathWomenHomeEnterprise = '/women/home-enterprise';
const String pathWomenGardenPlans = '/women/garden-plans';
const String pathWomenBackyardLivestock = '/women/backyard-livestock';

const String pathAdvisorySaturation = '/advisory/saturation';
const String pathAdvisorySowingIntent = '/advisory/sowing-intent';
const String pathAdvisoryDiseaseScan = '/advisory/disease-scan';
const String pathAdvisoryPestRadar = '/advisory/pest-radar';
const String pathAdvisoryNpk = '/advisory/npk';

const String pathRegionsCrops = '/regions/crops';

const String pathClimateCarbonPotential = '/climate/carbon-potential';
const String pathClimateResilientVarieties = '/climate/resilient-varieties';

const String pathPostHarvestColdStorage = '/post-harvest/cold-storage';
const String pathPostHarvestGrade = '/post-harvest/grade';

String coldStorageBookPath(String facilityId) =>
    '$pathPostHarvestColdStorage/$facilityId/book';
String coldStorageApplyPath(String facilityId) =>
    '$pathPostHarvestColdStorage/$facilityId/apply';
String coldStorageReleaseRequestPath(String bookingId) =>
    '/post-harvest/bookings/$bookingId/request-release';
String coldStorageReceiptPath(String receiptNumber) =>
    '/post-harvest/receipts/$receiptNumber';

const String pathColdStorageProviderStats = '/post-harvest/provider/stats';
const String pathColdStorageProviderBookings =
    '/post-harvest/provider/bookings';
const String pathColdStorageProviderFacilities =
    '/post-harvest/provider/facilities';

String coldStorageProviderBookingPath(String id) =>
    '/post-harvest/provider/bookings/$id';
String coldStorageProviderBookingReviewPath(String id) =>
    '/post-harvest/provider/bookings/$id/review';
String coldStorageProviderBookingInwardPath(String id) =>
    '/post-harvest/provider/bookings/$id/inward';
String coldStorageProviderBookingReleasePath(String id) =>
    '/post-harvest/provider/bookings/$id/release';
String coldStorageProviderFacilityPath(String id) =>
    '/post-harvest/provider/facilities/$id';
String coldStorageProviderChambersPath(String facilityId) =>
    '/post-harvest/provider/facilities/$facilityId/chambers';

const String pathChatbotMessages = '/chatbot/messages';
const String pathChatbotHistory = '/chatbot/history';
const String pathChatbotExpertHandoff = '/chatbot/expert-handoff';
const String pathChatbotExperts = '/chatbot/experts';

const String pathGamificationStatus = '/gamification/status';
const String pathGamificationRedeem = '/gamification/redeem';

// Direct-buyer procurement module (buy-requirements, negotiation, purchases)
const String pathDirectBuyerProfile = '/direct-buyer/profile';
const String pathDirectBuyerAnalytics = '/direct-buyer/analytics';
const String pathDirectBuyerSavedFarmers = '/direct-buyer/saved-farmers';
const String pathDirectBuyerFeed = '/direct-buyer/feed';

String directBuyerSavedFarmerPath(String farmerId) =>
    '$pathDirectBuyerSavedFarmers/$farmerId';

const String pathDemands = '/demands';

String demandPath(String demandId) => '$pathDemands/$demandId';
String demandClosePath(String demandId) => '$pathDemands/$demandId/close';
String demandReopenPath(String demandId) => '$pathDemands/$demandId/reopen';

const String pathOffers = '/offers';
const String pathOffersMine = '/offers/mine';

String offerPath(String offerId) => '$pathOffers/$offerId';
String offerAcceptPath(String offerId) => '$pathOffers/$offerId/accept';
String offerRejectPath(String offerId) => '$pathOffers/$offerId/reject';
String offerWithdrawPath(String offerId) => '$pathOffers/$offerId/withdraw';
String offerCounterPath(String offerId) => '$pathOffers/$offerId/counter';

const String pathPurchases = '/purchases';

String purchasePath(String purchaseId) => '$pathPurchases/$purchaseId';
String purchaseAdvancePath(String purchaseId) =>
    '$pathPurchases/$purchaseId/advance';
String purchasePickupPath(String purchaseId) =>
    '$pathPurchases/$purchaseId/pickup';
String purchaseDispatchPath(String purchaseId) =>
    '$pathPurchases/$purchaseId/dispatch';
String purchaseDeliverPath(String purchaseId) =>
    '$pathPurchases/$purchaseId/deliver';
String purchaseQcPath(String purchaseId) => '$pathPurchases/$purchaseId/qc';
String purchaseResolvePath(String purchaseId) =>
    '$pathPurchases/$purchaseId/resolve';
String purchasePayPath(String purchaseId) => '$pathPurchases/$purchaseId/pay';
String purchaseCancelPath(String purchaseId) =>
    '$pathPurchases/$purchaseId/cancel';
String purchaseRatePath(String purchaseId) => '$pathPurchases/$purchaseId/rate';
String purchaseInvoicePath(String purchaseId) =>
    '$pathPurchases/$purchaseId/invoice';

// ============================================================
// Coverage expansion — fills gaps vs endpoints.md (2026-10-17)
// ============================================================

// --- Auth, reference & misc ---
const String pathAuthLogout = '/auth/logout';
const String pathLanguages = '/languages';
const String pathGeoReverse = '/geo/reverse';
const String pathUploads = '/uploads';
const String pathUsersMeDataExport = '/users/me/data-export';
const String pathUsersMeDataExportLatest = '/users/me/data-export/latest';

// --- Saved searches (§6) ---
const String pathSavedSearches = '/saved-searches';
String savedSearchPath(String id) => '$pathSavedSearches/$id';
String savedSearchAlertsPath(String id) => '$pathSavedSearches/$id/alerts';

// --- Intelligence & price alerts (§26) ---
const String pathIntelligence = '/intelligence';
const String pathPriceAlerts = '/price-alerts';
String priceAlertPath(String id) => '$pathPriceAlerts/$id';

// --- Advisory extras (§5) ---
const String pathAdvisoryCropPlan = '/advisory/crop-plan';
const String pathAdvisoryCropPlanConfirm = '/advisory/crop-plan/confirm';
const String pathAdvisoryDiseaseScans = '/advisory/disease-scans';

// --- Billing & subscriptions (§35) ---
const String pathBillingPlans = '/billing/plans';
const String pathBillingSubscription = '/billing/subscription';
const String pathBillingSubscriptionUpgrade = '/billing/subscription/upgrade';
const String pathBillingSubscriptionCancel = '/billing/subscription/cancel';
const String pathBillingSubscriptions = '/billing/subscriptions';
const String pathBillingSubscribe = '/billing/subscribe';
const String pathBillingInvoices = '/billing/invoices';

// --- Broker deal desk (§25) ---
const String pathBrokerDeals = '/broker/deals';
const String pathBrokerLeads = '/broker/leads';
const String pathBrokerCommissions = '/broker/commissions';
const String pathFarmerDeals = '/farmer/deals';
String brokerDealPath(String id) => '$pathBrokerDeals/$id';
String brokerDealMessagesPath(String id) => '$pathBrokerDeals/$id/messages';
String brokerDealEvidencePath(String id) => '$pathBrokerDeals/$id/evidence';
String brokerDealReleasePayoutPath(String id) =>
    '$pathBrokerDeals/$id/release-payout';
String brokerDealContractPath(String id) => '$pathBrokerDeals/$id/contract';
String brokerDealChatRoomPath(String id) => '$pathBrokerDeals/$id/chat-room';
String brokerDealMilestonesPath(String id) => '$pathBrokerDeals/$id/milestones';
String brokerDealVehiclePath(String id) => '$pathBrokerDeals/$id/vehicle';
String brokerDealReceiptPath(String id) => '$pathBrokerDeals/$id/receipt';
String brokerLeadPath(String id) => '$pathBrokerLeads/$id';
String farmerDealPath(String id) => '$pathFarmerDeals/$id';
String farmerDealMessagesPath(String id) => '$pathFarmerDeals/$id/messages';
String farmerDealRespondPath(String id) => '$pathFarmerDeals/$id/respond';
String farmerDealEvidencePath(String id) => '$pathFarmerDeals/$id/evidence';
String farmerDealAcceptPath(String id) => '$pathFarmerDeals/$id/accept';
String farmerDealDisputesPath(String id) => '$pathFarmerDeals/$id/disputes';

// --- WebRTC calls (§34) ---
const String pathCalls = '/calls';
const String pathCallsInitiate = '/calls/initiate';
const String pathCallsActive = '/calls/active';
const String pathCallsHistory = '/calls/history';
String callPath(String callId) => '$pathCalls/$callId';
String callSignalPath(String callId) => '$pathCalls/$callId/signal';
String callEndPath(String callId) => '$pathCalls/$callId/end';
String callAnswerPath(String callId) => '$pathCalls/$callId/answer';
String callDeclinePath(String callId) => '$pathCalls/$callId/decline';

// --- AI power engines (§36) ---
const String pathAiPowerTradeOfferScore = '/ai-power/trade/offer-score';
const String pathAiPowerAdvisorySprayWindow = '/ai-power/advisory/spray-window';
const String pathAiPowerDemandForecast = '/ai-power/demand/forecast';

// --- Mahila gruh udyog (§27) ---
const String pathGruhUdyogCategories = '/gruh-udyog/categories';
const String pathGruhUdyogUnits = '/gruh-udyog/units';
const String pathGruhUdyogUnitsMe = '/gruh-udyog/units/me';
String gruhUdyogUnitPath(String id) => '$pathGruhUdyogUnits/$id';
String gruhUdyogUnitProductsPath(String id) =>
    '$pathGruhUdyogUnits/$id/products';
String gruhUdyogUnitPausePath(String id) => '$pathGruhUdyogUnits/$id/pause';
String gruhUdyogUnitResumePath(String id) => '$pathGruhUdyogUnits/$id/resume';
String gruhUdyogUnitCertificationsPath(String id) =>
    '$pathGruhUdyogUnits/$id/certifications';
String gruhUdyogUnitOrdersPath(String id) => '$pathGruhUdyogUnits/$id/orders';
String gruhUdyogUnitOffersPath(String id) => '$pathGruhUdyogUnits/$id/offers';
String gruhUdyogUnitDashboardPath(String id) =>
    '$pathGruhUdyogUnits/$id/dashboard';
String gruhUdyogProductPath(String id) => '/gruh-udyog/products/$id';
String gruhProductStockPath(String id) => '/gruh-udyog/products/$id/stock';
String gruhProductPublishPath(String id) => '/gruh-udyog/products/$id/publish';
String gruhProductUnpublishPath(String id) =>
    '/gruh-udyog/products/$id/unpublish';
String gruhProductBatchesPath(String id) => '/gruh-udyog/products/$id/batches';
String gruhProductOffersPath(String id) => '/gruh-udyog/products/$id/offers';
String gruhBatchStatusPath(String id) => '/gruh-udyog/batches/$id/status';
String gruhOfferPath(String id) => '/gruh-udyog/offers/$id';
String gruhOrderAcceptPath(String id) => '/gruh-udyog/orders/$id/accept';
String gruhOrderRejectPath(String id) => '/gruh-udyog/orders/$id/reject';
String gruhOrderStatusPath(String id) => '/gruh-udyog/orders/$id/status';

// --- Milk seller (§30) ---
const String pathMilkSellerClients = '/milk-seller/clients';
const String pathMilkSellerDeliveries = '/milk-seller/deliveries';
const String pathMilkSellerDeliveriesBulk = '/milk-seller/deliveries/bulk';
const String pathMilkSellerBills = '/milk-seller/bills';
const String pathMilkSellerBillsGenerate = '/milk-seller/bills/generate';
const String pathMilkSellerAnalytics = '/milk-seller/analytics';
String milkClientPath(String id) => '$pathMilkSellerClients/$id';
String milkClientCalendarPath(String id) =>
    '$pathMilkSellerClients/$id/calendar';
String milkDeliveryPath(String id) => '$pathMilkSellerDeliveries/$id';
String milkBillPath(String id) => '$pathMilkSellerBills/$id';
String milkBillSendPath(String id) => '$pathMilkSellerBills/$id/send';
String milkBillPaymentsPath(String id) => '$pathMilkSellerBills/$id/payments';

// --- Exporter (§31) ---
const String pathExporterProfile = '/exporter/profile';
const String pathExporterDashboard = '/exporter/dashboard';
const String pathExporterRfqs = '/exporter/rfqs';
const String pathExporterQuotes = '/exporter/quotes';
const String pathExporterOrders = '/exporter/orders';
const String pathExporterAnalytics = '/exporter/analytics';
const String pathExporterSuppliers = '/exporter/suppliers';
const String pathExporterSuppliersSaved = '/exporter/suppliers/saved';
const String pathExporterComplianceDocuments = '/exporter/compliance/documents';
const String pathExporterContractsTemplates = '/exporter/contracts/templates';
String exporterRfqPath(String id) => '$pathExporterRfqs/$id';
String exporterRfqClosePath(String id) => '$pathExporterRfqs/$id/close';
String exporterRfqReopenPath(String id) => '$pathExporterRfqs/$id/reopen';
String exporterRfqQuotesPath(String id) => '$pathExporterRfqs/$id/quotes';
String exporterQuotePath(String id) => '$pathExporterQuotes/$id';
String exporterQuoteAcceptPath(String id) => '$pathExporterQuotes/$id/accept';
String exporterQuoteRejectPath(String id) => '$pathExporterQuotes/$id/reject';
String exporterQuoteCounterPath(String id) => '$pathExporterQuotes/$id/counter';
String exporterOrderPath(String id) => '$pathExporterOrders/$id';
String exporterOrderAdvancePath(String id) => '$pathExporterOrders/$id/advance';
String exporterOrderInspectionPath(String id) =>
    '$pathExporterOrders/$id/inspection';
String exporterOrderShippingPath(String id) =>
    '$pathExporterOrders/$id/shipping';
String exporterOrderCustomsPath(String id) => '$pathExporterOrders/$id/customs';
String exporterOrderDeliverPath(String id) => '$pathExporterOrders/$id/deliver';
String exporterOrderCompletePath(String id) =>
    '$pathExporterOrders/$id/complete';
String exporterOrderInvoicePath(String id) => '$pathExporterOrders/$id/invoice';
String exporterOrderStatusPath(String id) => '$pathExporterOrders/$id/status';
String exporterOrderShipmentPath(String id) =>
    '$pathExporterOrders/$id/shipment';
String exporterOrderShipmentEventsPath(String id) =>
    '$pathExporterOrders/$id/shipment/events';
String exporterOrderDocumentsPath(String id) =>
    '$pathExporterOrders/$id/documents';
String exporterOrderDocumentPath(String orderId, String docId) =>
    '$pathExporterOrders/$orderId/documents/$docId';
String exporterOrderLcPath(String id) => '$pathExporterOrders/$id/lc';
String exporterOrderRemittancesPath(String id) =>
    '$pathExporterOrders/$id/remittances';
String exporterOrderFinancePath(String id) => '$pathExporterOrders/$id/finance';
String exporterSupplierSavePath(String sellerId) =>
    '$pathExporterSuppliers/$sellerId/save';

// --- Resale marketplace (§33) ---
const String pathResaleListings = '/resale-listings';
const String pathResaleListingsMine = '/resale-listings/mine';
String resaleListingPath(String id) => '$pathResaleListings/$id';
String resaleListingInquirePath(String id) => '$pathResaleListings/$id/inquire';
String resaleListingBookPath(String id) => '$pathResaleListings/$id/book';

// --- Equipment rental hub (§32) ---
const String pathEquipmentRentalVerificationDocuments =
    '/equipment-rental/verification/documents';
const String pathEquipmentRentalVerificationStatus =
    '/equipment-rental/verification/status';
const String pathEquipmentRentalBadge = '/equipment-rental/badge';
const String pathEquipmentRentalBlacklist = '/equipment-rental/blacklist';
const String pathEquipmentRentalOperators = '/equipment-rental/operators';
const String pathEquipmentRentalMaintenance = '/equipment-rental/maintenance';
const String pathEquipmentRentalPricingRules =
    '/equipment-rental/pricing-rules';
const String pathEquipmentRentalReports = '/equipment-rental/reports';
const String pathEquipmentRentalRiskFarmers = '/equipment-rental/risk/farmers';
const String pathEquipmentRentalDemandHeatmap =
    '/equipment-rental/demand-heatmap';
const String pathEquipmentRentalRankingExplain =
    '/equipment-rental/ranking/explain';
const String pathEquipmentRentalRecommendations =
    '/equipment-rental/recommendations';
const String pathEquipmentRentalMonitoringBookings =
    '/equipment-rental/monitoring/bookings';
const String pathEquipmentRentalSettlements = '/equipment-rental/settlements';
const String pathEquipmentRentalCommission = '/equipment-rental/commission';
const String pathEquipmentRentalPolicies = '/equipment-rental/policies';
const String pathEquipmentRentalReminders = '/equipment-rental/reminders';
String equipmentRentalBlacklistPath(String userId) =>
    '$pathEquipmentRentalBlacklist/$userId';
String equipmentRentalOperatorPath(String id) =>
    '$pathEquipmentRentalOperators/$id';
String equipmentRentalMaintenancePath(String id) =>
    '$pathEquipmentRentalMaintenance/$id';
String equipmentQuotePath(String equipmentId) =>
    '$pathEquipment/$equipmentId/quote';

// --- Equipment extras (§14) ---
const String pathEquipmentDemandPosts = '/equipment/demand-posts';
const String pathEquipmentOwnerDamageClaims = '/equipment/owner/damage-claims';
const String pathEquipmentOwnerDashboard = '/equipment/owner/dashboard';
const String pathEquipmentOwnerAnalytics = '/equipment/owner/analytics';
const String pathEquipmentOwnerTdsStatements =
    '/equipment/owner/tds-statements';
String equipmentDemandPostPath(String id) => '$pathEquipmentDemandPosts/$id';
String equipmentDemandPostQuotesPath(String id) =>
    '$pathEquipmentDemandPosts/$id/quotes';
String equipmentBookingContractPath(String id) =>
    '$pathEquipment/bookings/$id/contract';
String equipmentBookingContractEsignPath(String id) =>
    '$pathEquipment/bookings/$id/contract/esign';
String equipmentBookingContractPdfPath(String id) =>
    '$pathEquipment/bookings/$id/contract/pdf';
String equipmentBookingDisputesPath(String id) =>
    '$pathEquipment/bookings/$id/disputes';
String equipmentBookingRefundPath(String id) =>
    '$pathEquipment/bookings/$id/refund';
String equipmentBookingPaymentsPath(String id) =>
    '$pathEquipment/bookings/$id/payments';
String equipmentBookingInvoicePath(String id) =>
    '$pathEquipment/bookings/$id/invoice';
String equipmentBookingCounterAcceptPath(String id) =>
    '$pathEquipment/bookings/$id/counter/accept';
String equipmentBookingCounterDeclinePath(String id) =>
    '$pathEquipment/bookings/$id/counter/decline';
String equipmentBookingDepositPath(String id) =>
    '$pathEquipment/bookings/$id/deposit';
String equipmentBookingDepositForfeitPath(String id) =>
    '$pathEquipment/bookings/$id/deposit/forfeit';
String equipmentBookingChatRoomPath(String id) =>
    '$pathEquipment/bookings/$id/chat-room';
String equipmentDisputePath(String id) => '/equipment/disputes/$id';
String equipmentDisputeEvidencePath(String id) =>
    '/equipment/disputes/$id/evidence';
String equipmentDamageClaimPath(String id) =>
    '$pathEquipmentOwnerDamageClaims/$id';
String equipmentDamageClaimConfirmPath(String id) =>
    '$pathEquipmentOwnerDamageClaims/$id/confirm-estimate';
String equipmentDamageClaimResolvePath(String id) =>
    '$pathEquipmentOwnerDamageClaims/$id/resolve';
String equipmentPricingRulesPath(String id) =>
    '$pathEquipment/$id/pricing-rules';

// --- Transport extras (§7 / FT features) ---
const String pathTransportWallet = '/transport/wallet';
const String pathTransportPayouts = '/transport/payouts';
const String pathTransportCompliance = '/transport/compliance';
const String pathTransportFareTrends = '/transport/fare-trends';
const String pathTransportInstantBookings = '/transport/instant-bookings';
const String pathTransportNearbyVehicles = '/transport/nearby-vehicles';
const String pathTransportLoadsMatched = '/transport/loads/matched';
const String pathTransportLedgerMine = '/transport/ledger/mine';
const String pathTransportLoadTemplates = '/transport/load-templates';
const String pathTransportFavorites = '/transport/favorites';
String transportBookingWaitingPath(String id) =>
    '$pathTransportBookings/$id/waiting';
String transportBookingPodOtpPath(String id) =>
    '$pathTransportBookings/$id/pod-otp';
String transportBookingVerifyPodOtpPath(String id) =>
    '$pathTransportBookings/$id/verify-pod-otp';
String transportBookingSharePath(String id) =>
    '$pathTransportBookings/$id/share';
String transportSharedPath(String token) => '/transport/shared/$token';
String transportBookingCancelPath(String id) =>
    '$pathTransportBookings/$id/cancel';
String transportBookingRateFarmerPath(String id) =>
    '$pathTransportBookings/$id/rate-farmer';
String transportBookingDamageDisputesPath(String id) =>
    '$pathTransportBookings/$id/damage-disputes';
String transportBookingAssignDriverPath(String id) =>
    '$pathTransportBookings/$id/assign-driver';
String transportBookingBreakdownPath(String id) =>
    '$pathTransportBookings/$id/breakdown';
String transportBookingInspectionPath(String id) =>
    '$pathTransportBookings/$id/inspection';
String transportBookingStopsPath(String id) =>
    '$pathTransportBookings/$id/stops';
String transportStopPodPath(String bookingId, int stopNo) =>
    '$pathTransportBookings/$bookingId/stops/$stopNo/pod';
String transportVehicleLocationPath(String id) =>
    '$pathTransportVehicles/$id/location';
String transportLoadBidCounterPath(String loadId, String bidId) =>
    '$pathTransportLoads/$loadId/bids/$bidId/counter';
String transportLoadTemplatePath(String id) =>
    '$pathTransportLoadTemplates/$id';
String transportLoadTemplateRepeatPath(String id) =>
    '$pathTransportLoadTemplates/$id/repeat';
String transportFavoritePath(String transporterId) =>
    '$pathTransportFavorites/$transporterId';
String transportBookingRebookPath(String id) =>
    '$pathTransportBookings/$id/rebook';
String transportFarmerReputationPath(String uid) =>
    '/transport/farmers/$uid/reputation';

// --- Land extras (§21) ---
const String pathLandSummary = '/land/summary';
const String pathLandSettlements = '/land/settlements';
const String pathLandAnalytics = '/land/analytics';
const String pathLandProfitDashboard = '/land/profit-dashboard';
const String pathLandProfitDashboardExport = '/land/profit-dashboard/export';
const String pathLandTenancies = '/land/tenancies';
const String pathLandRentDues = '/land/rent/dues';
const String pathLandLeads = '/land/leads';
const String pathLandPriceSuggestion = '/land/price-suggestion';
const String pathLandSavedListings = '/land/saved-listings';
const String pathLandWaitlistMine = '/land/waitlist/mine';
String landPlotExpensesPath(String plotId) => '$pathLandPlots/$plotId/expenses';
String landLeaseEsignPath(String id) => '$pathLandLeases/$id/esign';
String landLeaseEscrowFundPath(String id) => '$pathLandLeases/$id/escrow/fund';
String landLeaseMilestonesPath(String id) => '$pathLandLeases/$id/milestones';
String landLeaseMilestonePath(String id, int index) =>
    '$pathLandLeases/$id/milestones/$index';
String landLeaseMilestoneReleasePath(String id, int index) =>
    '$pathLandLeases/$id/milestones/$index/release';
String landLeaseChatRoomPath(String id) => '$pathLandLeases/$id/chat-room';
String landLeaseLedgerPath(String id) => '$pathLandLeases/$id/ledger';
String landLeaseDisputesPath(String id) => '$pathLandLeases/$id/disputes';
String landLeaseHandoverPath(String id) => '$pathLandLeases/$id/handover';
String landLeaseHarvestDeclarationsPath(String id) =>
    '$pathLandLeases/$id/harvest-declarations';
String landLeaseHarvestSettlePath(String leaseId, String declId) =>
    '$pathLandLeases/$leaseId/harvest-declarations/$declId/settle';
String landLeaseRenewPath(String id) => '$pathLandLeases/$id/renew';
String landLeaseRenewalsPath(String id) => '$pathLandLeases/$id/renewals';
String landLeaseRenewalRespondPath(String renewalId) =>
    '/land/lease-renewals/$renewalId/respond';
String landLeaseTerminatePath(String id) => '$pathLandLeases/$id/terminate';
String landListingPhotosPath(String id) => '$pathLandListings/$id/photos';
String landListingPhotoPath(String listingId, String photoId) =>
    '$pathLandListings/$listingId/photos/$photoId';
String landListingAvailabilityPath(String id) =>
    '$pathLandListings/$id/availability';
String landListingBoostPath(String id) => '$pathLandListings/$id/boost';
String landListingViewPath(String id) => '$pathLandListings/$id/view';
String landListingReviewsPath(String id) => '$pathLandListings/$id/reviews';
String landListingSavePath(String id) => '$pathLandListings/$id/save';
String landListingWaitlistPath(String id) => '$pathLandListings/$id/waitlist';
String landLeadPath(String id) => '$pathLandLeads/$id';
String landLeadStatusPath(String id) => '$pathLandLeads/$id/status';
String landLeadNotesPath(String id) => '$pathLandLeads/$id/notes';
String landLeaseRequestCounterPath(String id) =>
    '$pathLandLeaseRequests/$id/counter';
String rentPaymentReceiptPath(String paymentId) =>
    '/rent-payments/$paymentId/receipt';

// --- Seller business suite (§6/§22) ---
const String pathSellerStock = '/seller/stock';
const String pathSellerCashflow = '/seller/cashflow';
const String pathSellerGstReports = '/seller/gst-reports';
const String pathSellerTdsStatements = '/seller/tds-statements';
const String pathSellerTdsStatementPdf = '/seller/tds-statements/statement.pdf';
const String pathSellerTeamInvites = '/seller/team/invites';
const String pathSellerTeamMembers = '/seller/team/members';
const String pathSellerSales = '/seller/sales';
const String pathSellerLedgers = '/seller/ledgers';
const String pathSellerProcurement = '/seller/procurement';
const String pathSellerRates = '/seller/rates';
const String pathSellerRatesMy = '/seller/rates/my';
const String pathSellerForecast = '/seller/forecast';
const String pathSellerBuyerDirectory = '/seller/buyer-directory';
const String pathSellerBulkOrders = '/seller/bulk-orders';
const String pathSellerDashboard = '/seller/dashboard';
String sellerStockAdjustPath(String id) => '$pathSellerStock/$id/adjust';
String sellerStockFromPurchasePath(String id) =>
    '$pathSellerStock/from-purchase/$id';
String sellerTeamMemberPath(String id) => '$pathSellerTeamMembers/$id';
String sellerTeamMemberRolePath(String id) => '$pathSellerTeamMembers/$id/role';
String sellerOrderStatusPath(String id) => '$pathOrders/$id/status';
String sellerSaleInvoicePath(String id) => '$pathSellerSales/$id/invoice.pdf';
String sellerPurchasePath(String id) => '$pathSellerProcurement/$id';
String sellerPurchasePaymentStatusPath(String id) =>
    '$pathSellerProcurement/$id/payment-status';
String sellerPurchasePayPath(String id) => '$pathSellerProcurement/$id/pay';
String sellerPurchaseReceiptPath(String paymentId) =>
    '$pathSellerProcurement/mine/$paymentId/receipt';
String sellerCommissionInvoicePath(String id) =>
    '$pathPurchases/$id/commission-invoice';

// --- Orders / purchases extras (§6/§22/§23) ---
const String pathOrderBnplSchedulePrefix = '/orders';
String orderBnplSchedulePath(String id) => '$pathOrders/$id/bnpl-schedule';
String purchaseChatRoomPath(String id) => '$pathPurchases/$id/chat-room';
String purchaseDisputesPath(String id) => '$pathPurchases/$id/disputes';
String purchaseDisputeEvidencePath(String purchaseId, String disputeId) =>
    '$pathPurchases/$purchaseId/disputes/$disputeId/evidence';
String purchaseInvoicePdfPath(String id) => '$pathPurchases/$id/invoice.pdf';
String purchaseEscrowFundPath(String id) => '$pathPurchases/$id/escrow/fund';
String purchaseHandoverOtpPath(String id) => '$pathPurchases/$id/handover-otp';
String purchaseHandoverVerifyPath(String id) =>
    '$pathPurchases/$id/handover/verify';
String purchaseQcPhotosPath(String id) => '$pathPurchases/$id/qc/photos';
String purchaseReceiptPath(String id) => '$pathPurchases/$id/receipt';

// --- Loans extras (§11b) ---
const String pathLoanAuditLogs = '/loans/audit-logs';
String loanDocumentDownloadPath(String loanId, String documentId) =>
    '$pathLoans/$loanId/documents/$documentId/download';
String loanRepaymentsPath(String id) => '$pathLoans/$id/repayments';
String loanFarmer360Path(String id) => '$pathLoans/$id/farmer360';

// --- Insurance extras (§12) ---
const String pathInsurancePremiumCalculator = '/insurance/premium-calculator';
String insuranceProviderClaimPayoutApprovalRequestPath(String id) =>
    '$pathInsuranceProviderClaims/$id/payout-approval-request';
String insuranceProviderStatsExportPath() =>
    '$pathInsuranceProviderStats/export';

// --- Post-harvest extras (§20) ---
const String pathColdStorageProviderFees = '/post-harvest/provider/fees';
const String pathColdStorageProviderRentLedger =
    '/post-harvest/provider/rent-ledger';
String coldStorageProviderFeesPayPath(String id) =>
    '$pathColdStorageProviderFees/$id/pay';

// --- Dairy extras (§16) ---
const String pathDairyReportsDaily = '/livestock/dairy/reports/daily';
const String pathDairyAnalytics = '/livestock/dairy/analytics';
const String pathDairyFarmerAnalytics = '/livestock/dairy/farmer/analytics';
const String pathDairyFarmerHome = '/dairy/farmer/home';
const String pathDairyDashboard = '/dairy/dashboard';
const String pathDairyStandingOrders = '/dairy/standing-orders';
const String pathDairyStandingBrowse = '/dairy/standing/browse';
const String pathDairyBidsBrowse = '/dairy/bids/browse';
const String pathDairyDemandsBrowse = '/dairy/demands/browse';
const String pathDairyCommissionStructure = '/dairy/commission-structure';
const String pathDairyAgents = '/livestock/dairy/agents';
const String pathVetsMeSettlements = '/livestock/vets/me/settlements';
const String pathVetsMePayouts = '/livestock/vets/me/payouts';
String dairyStandingOrderPath(String id) => '$pathDairyStandingOrders/$id';
String dairyStandingOrderClosePath(String id) =>
    '$pathDairyStandingOrders/$id/close';
String dairyPurchaseReceiptPath(String id) => '/dairy/purchases/$id/receipt';
String dairyPurchaseChatRoomPath(String id) => '/dairy/purchases/$id/chat-room';
String dairyPurchaseContractEsignPath(String id) =>
    '/dairy/purchases/$id/contract/esign';
String dairyAgentPath(String agentUid) => '$pathDairyAgents/$agentUid';
String dairyPublicPath(String managerId) => '/dairy/dairies/$managerId';
String dairyFarmerPublicPath(String farmerId) => '/dairy/farmers/$farmerId';
String dairyFarmerReliabilityPath(String farmerId) =>
    '/dairy/farmers/$farmerId/reliability';

// --- Dairy manager (inventory routes from userflow.md) ---
const String pathDairyManagerDemands = '/dairy-manager/demands';
const String pathDairyManagerBids = '/dairy-manager/bids';
const String pathDairyManagerRoutes = '/dairy-manager/routes';
const String pathDairyManagerCollectionCheck =
    '/dairy-manager/collection-check';
const String pathDairyManagerMilkSlips = '/dairy-manager/milk-slips';
const String pathDairyManagerRateChart = '/dairy-manager/rate-chart';
String dairyManagerBidPath(String id) => '$pathDairyManagerBids/$id';
String dairyManagerBidCounterPath(String id) =>
    '$pathDairyManagerBids/$id/counter';
String dairyManagerBidAcceptPath(String id) =>
    '$pathDairyManagerBids/$id/accept';
String dairyManagerRoutePath(String id) => '$pathDairyManagerRoutes/$id';
String dairyManagerRouteStatusPath(String id) =>
    '$pathDairyManagerRoutes/$id/status';
String dairyManagerFlagReviewPath(String collectionId) =>
    '/dairy-manager/collections/$collectionId/flag-review';

// --- Contracts extras (§26) ---
const String pathContractsMine = '/contracts/mine';
String contractDeclinePath(String id) => '$pathContracts/$id/decline';
String contractDeliveriesPath(String id) => '$pathContracts/$id/deliveries';
String contractCancelPath(String id) => '$pathContracts/$id/cancel';

// --- Demands / lots extras (§23) ---
const String pathDemandsStanding = '/demands/standing';
const String pathDemandsBrowse = '/demands/browse';
String lotRelistPath(String id) => '$pathMarketLots/$id/relist';

// --- e-market customer extras (§22) ---
const String pathCustomerSubscriptions = '/customer/subscriptions';
const String pathCustomerQuotes = '/customer/quotes';
const String pathCustomerOrders = '/customer/orders';
const String pathCustomerBrowseNearMe = '/customer/browse/near-me';
const String pathCustomerPlanner = '/customer/planner';
const String pathCustomerInvoicesConsolidated =
    '/customer/invoices/consolidated';
const String pathCustomerAnalytics = '/customer/analytics';
String customerSubscriptionPath(String id) => '$pathCustomerSubscriptions/$id';
String customerQuoteAcceptPath(String id) => '$pathCustomerQuotes/$id/accept';
String customerQuoteCounterPath(String id) => '$pathCustomerQuotes/$id/counter';
String customerOrderPath(String id) => '$pathCustomerOrders/$id';
String customerOrderInspectionPath(String id) =>
    '$pathCustomerOrders/$id/inspection';
String customerStorefrontPath(String farmerId) =>
    '/customer/storefronts/$farmerId';
String customerSupplierFavoritePath(String farmerId) =>
    '/customer/suppliers/favorites/$farmerId';

// --- Chat rooms (§24/§28.28-adjacent) ---
const String pathChatDirect = '/chat/direct';
const String pathChatRooms = '/chat/rooms';
String chatRoomMessagesPath(String roomId) => '$pathChatRooms/$roomId/messages';
String chatRoomReadPath(String roomId) => '$pathChatRooms/$roomId/read';

// --- Courses / teachers extras (§29) ---
String courseCurriculumPath(String id) => '$pathCourses/$id/curriculum';
String courseEnquiriesPath(String id) => '$pathCourses/$id/enquiries';
String courseAssignmentsPath(String id) => '$pathCourses/$id/assignments';
String courseChatPath(String id) => '$pathCourses/$id/chat';
String assignmentSubmissionsPath(String id) => '/assignments/$id/submissions';
String coursePurchaseContractPath(String id) =>
    '$pathCourses/purchases/$id/contract';
String coursePurchaseCancelPath(String id) =>
    '$pathCourses/purchases/$id/cancel';
String coursePurchaseDisputesPath(String id) =>
    '$pathCourses/purchases/$id/disputes';
const String pathTeachersBatches = '/teachers/batches';
const String pathTeachersAvailability = '/teachers/availability';
const String pathTeachersChatOpen = '/teachers/chat/open';
const String pathTeachersChatRooms = '/teachers/chat/rooms';
const String pathTeachersCredentials = '/teachers/me/credentials';
const String pathTeachersEarnings = '/teachers/earnings';
const String pathTeachersPaymentsHistory = '/teachers/payments/history';
const String pathTeachersCommissionStructure = '/teachers/commission-structure';
const String pathTeachersFeedback = '/teachers/feedback';
const String pathTeachersEnquiries = '/teachers/enquiries';
const String pathInstructorSettlements = '/instructor/settlements';
String teacherBatchPath(String id) => '$pathTeachersBatches/$id';
String teacherBatchSessionsPath(String id) =>
    '$pathTeachersBatches/$id/sessions';
String sessionAttendancePath(String sessionId) =>
    '/teachers/sessions/$sessionId/attendance';
String sessionCheckInPath(String sessionId) => '/sessions/$sessionId/check-in';
String teacherEnquiryPath(String id) => '$pathTeachersEnquiries/$id';
String teacherEnquiryQuotePath(String id) => '$pathTeachersEnquiries/$id/quote';
String teacherEnquiryCounterPath(String id) =>
    '$pathTeachersEnquiries/$id/counter';
String teacherEnquiryAcceptPath(String id) =>
    '$pathTeachersEnquiries/$id/accept';
String teacherAssignmentGradePath(String id) =>
    '/teachers/assignments/$id/grade';
String certificateDownloadPath(String certId) =>
    '/teachers/certificates/$certId/download';
String certificateRevokePath(String certId) =>
    '/teachers/certificates/$certId/revoke';
String certificateVerifyPath(String certId) =>
    '/teachers/certificates/verify/$certId';
