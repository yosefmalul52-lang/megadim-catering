/**
 * Mongoose select strings for order API responses.
 * PCI-adjacent fields (cardToken, expiry, authCode) are schema-level select:false
 * and only loaded explicitly for capture/void server operations.
 */

/** Bulk admin list endpoints — exclude sensitive payment metadata. */
export const ORDER_ADMIN_LIST_SELECT =
  '-cardToken -expireMonth -expireYear -authCode -paymentSecurityToken -transactionId';

/** Single-order admin/customer API responses — allow transactionId for ops UI. */
export const ORDER_API_DETAIL_SELECT =
  '-cardToken -expireMonth -expireYear -authCode -paymentSecurityToken';

/** Load hidden payment fields only inside capture/void handlers. */
export const ORDER_PAYMENT_OPERATION_SELECT = '+cardToken +authCode +expireMonth +expireYear';
