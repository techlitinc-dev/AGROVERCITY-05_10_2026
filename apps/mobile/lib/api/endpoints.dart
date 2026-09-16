const String pathAppConfig = '/app-config';

const String pathAuthFirebaseVerify = '/auth/firebase-verify';
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

const String pathProducts = '/products';
const String pathCart = '/cart';
const String pathCartItems = '/cart/items';
const String pathOrders = '/orders';
const String pathRazorpayOrder = '/payments/razorpay/order';
const String pathRazorpayVerify = '/payments/razorpay/verify';
const String pathAddresses = '/addresses';

String productPath(String productId) => '$pathProducts/$productId';
String productCertificatePath(String productId) =>
    '$pathProducts/$productId/certificate';
String cartItemPath(String productId) => '$pathCartItems/$productId';
String orderPath(String orderId) => '$pathOrders/$orderId';
String orderCancelPath(String orderId) => '$pathOrders/$orderId/cancel';
String addressPath(String addressId) => '$pathAddresses/$addressId';

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

const String pathFpoMe = '/fpo/me';
const String pathFpoPools = '/fpo/pools';
const String pathFpoMachinery = '/fpo/machinery';

String fpoPoolJoinPath(String poolId) => '$pathFpoPools/$poolId/join';

String userProfilePath(String profileType) => '$pathUsersMeProfiles/$profileType';
String userProfileActivatePath(String profileType) =>
    '$pathUsersMeProfiles/$profileType/activate';
String userProfilePrimaryPath(String profileType) =>
    '$pathUsersMeProfiles/$profileType/primary';
