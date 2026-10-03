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
String transportLoadBidsPath(String loadId) => '$pathTransportLoads/$loadId/bids';
String transportLoadAcceptBidPath(String loadId) => '$pathTransportLoads/$loadId/accept-bid';

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
String loanReviewPath(String applicationId) => '$pathLoans/$applicationId/review';
String loanApprovePath(String applicationId) => '$pathLoans/$applicationId/approve';
String loanRejectPath(String applicationId) => '$pathLoans/$applicationId/reject';
String loanInfoRequestPath(String applicationId) =>
    '$pathLoans/$applicationId/info-request';
String loanRespondPath(String applicationId) => '$pathLoans/$applicationId/respond';
String loanCancelPath(String applicationId) => '$pathLoans/$applicationId/cancel';
String loanDisbursePath(String applicationId) => '$pathLoans/$applicationId/disburse';
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
String landLeasePaymentsPath(String leaseId) => '$pathLandLeases/$leaseId/payments';
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

String userProfilePath(String profileType) => '$pathUsersMeProfiles/$profileType';
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
String coursePurchasePath(String courseId) =>
    '$pathCourses/$courseId/purchase';
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
String livestockAnimalPath(String animalId) => '$pathLivestockAnimals/$animalId';
String livestockAnimalLogsPath(String animalId) =>
    '$pathLivestockAnimals/$animalId/logs';

const String pathLivestockProcurementRateCalc =
    '/livestock/procurement/rate-calc';
const String pathLivestockProcurementCollections =
    '/livestock/procurement/collections';
const String pathLivestockProcurementSummary =
    '/livestock/procurement/summary';

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
const String pathDairyRateChartVersions = '/livestock/dairy/rate-chart/versions';
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
const String pathGaushalaExpensesSummary = '/livestock/gaushala/expenses/summary';
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
const String pathColdStorageProviderBookings = '/post-harvest/provider/bookings';
const String pathColdStorageProviderFacilities = '/post-harvest/provider/facilities';

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

