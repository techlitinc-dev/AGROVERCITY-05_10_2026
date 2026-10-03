import { registerLocale } from '../index';

/**
 * Dairy sales / stock / reports strings (P6) — merged into `en`.
 * Reuses shared dairy keys (statuses, shifts, liters, sales strip labels)
 * from en.dairy.ts; this file only owns the P6-specific keys.
 */

const enDairySales: Record<string, string> = {
  // ---- Customer book ----
  dairySalesType_household: 'Household',
  dairySalesType_shop: 'Shop',
  dairySalesType_hotel: 'Hotel',
  dairyCustomersSearch: 'Search name or route',
  dairyCustomersEmpty: 'No customers yet',
  dairyCustomersEmptyBody: 'Add the households, shops or hotels that buy milk from your center.',
  dairyCustomerNew: 'Add customer',
  dairyCustomerEdit: 'Edit customer',
  dairyCustomerNotFound: 'Customer not found',
  dairyCustomerCreated: 'Customer added',
  dairyCustomerUpdated: 'Customer updated',
  dairyCustomerPhone: 'Phone (private ledger field)',
  dairyCustomerType: 'Customer type',
  dairyCustomerAddress: 'Address',
  dairyCustomerRoute: 'Route / area',
  dairyCustomerDailyAm: 'Daily liters (AM)',
  dairyCustomerDailyPm: 'Daily liters (PM)',
  dairyCustomerRate: 'Rate per liter (₹)',
  dairyCustomerRateInvalid: 'Rate must be more than ₹0',
  dairyCustomerDailyNeed: 'Daily need',

  // ---- Sale orders ----
  dairyOrdersEmpty: 'No orders yet',
  dairyOrdersEmptyBody: 'Schedule AM/PM delivery orders for your customers and track them through to paid.',
  dairyOrderNew: 'New order',
  dairyOrderSheetTitle: 'New sale order',
  dairyOrderPickCustomer: 'Customer',
  dairyOrderPickCustomerEmpty: 'No active customers',
  dairyOrderPickCustomerEmptyBody: 'Add a customer first — orders can only be placed for active customers.',
  dairyOrderAmountPreview: 'Amount (auto from liters × rate)',
  dairyOrderLitersInvalid: 'Enter liters above 0',
  dairyOrderCreated: 'Order scheduled',
  dairyOrderNotFound: 'Order not found',
  dairyOrderCustomer: 'Customer',
  dairyOrderMarkDelivered: 'Mark delivered',
  dairyOrderMarkBilled: 'Mark billed',
  dairyOrderMarkPaid: 'Mark paid',
  dairyOrderPaidNote: 'This order is paid and closed.',
  dairyOrderUpdated: 'Order updated',
  dairyOrderTransitionFailed: 'This order changed elsewhere — showing the latest state.',

  // ---- Stock ----
  dairyStockEmpty: 'No stock items yet',
  dairyStockEmptyBody: 'Track products made from your milk — curd, ghee, paneer — with quantities and expiry dates.',
  dairyStockAdd: 'Add item',
  dairyStockAdjust: 'Adjust',
  dairyStockName: 'Item name',
  dairyStockCategory: 'Category',
  dairyStockUnit: 'Unit (L, kg, pcs…)',
  dairyStockQty: 'Quantity in stock',
  dairyStockPrice: 'Unit price (₹)',
  dairyStockExpiry: 'Expiry date',
  dairyStockItemCreated: 'Item added',
  dairyStockAdjusted: 'Stock adjusted',
  dairyStockDelta: 'Change (+ / −)',
  dairyStockDeltaHint: 'Use a negative number to reduce stock, e.g. -2.5',
  dairyStockReason: 'Reason',
  dairyStockReasonRequired: 'A reason is required',
  dairyStockLastAdj: 'Last adjustment',
  dairyStockExpiredTag: 'Expired',
  dairyStockExpiresSoonTag: '{days}d left',
  dairyStockCat_milk: 'Milk',
  dairyStockCat_curd: 'Curd',
  dairyStockCat_ghee: 'Ghee',
  dairyStockCat_paneer: 'Paneer',
  dairyStockCat_other: 'Other',

  // ---- Reports ----
  dairyReportsDailyTitle: 'Daily report',
  dairyReportsPlTitle: 'Monthly P&L',
  dairyReportsSales: 'Sales',
  dairyReportClosingStock: 'Closing stock',
  dairyReportProcurementCost: 'Procurement cost',
  dairyReportSalesIncome: 'Sales income',
  dairyReportGrossProfit: 'Gross profit',
  dairyReportXCollections: '{count} collections',
  dairyReportXOrders: '{count} orders',
  dairyReportNoStock: 'No stock items yet.',
};

registerLocale('en', enDairySales);
