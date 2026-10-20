/**
 * Payme merchant-API error codes and JSON-RPC error shape.
 * Docs: https://developer.help.paycom.uz/metody-merchant-api/oshibki
 */
export enum PaymeErrorCode {
  Unauthorized = -32504,
  InvalidJsonRpc = -32700,
  MethodNotFound = -32601,
  InvalidParams = -32600,

  InvalidAccount = -31099,       // 400xx range → account errors
  OrderNotFound = -31050,
  AmountMismatch = -31001,
  TransactionNotFound = -31003,
  CannotCancel = -31007,
  TransactionAlreadyExists = -31008,
  Internal = -31008,
}

export interface PaymeErrorBody {
  code: PaymeErrorCode;
  message: { ru: string; uz: string; en: string };
  data?: string;
}

export function makeError(
  code: PaymeErrorCode,
  ru: string,
  uz: string,
  en: string,
  data?: string,
): PaymeErrorBody {
  return { code, message: { ru, uz, en }, data };
}

export const ERR_INVALID_AMOUNT = makeError(
  PaymeErrorCode.AmountMismatch,
  'Неверная сумма',
  "Noto'g'ri summa",
  'Invalid amount',
);

export const ERR_ORDER_NOT_FOUND = makeError(
  PaymeErrorCode.OrderNotFound,
  'Заказ не найден',
  'Buyurtma topilmadi',
  'Order not found',
  'order_id',
);

export const ERR_TRANSACTION_NOT_FOUND = makeError(
  PaymeErrorCode.TransactionNotFound,
  'Транзакция не найдена',
  'Tranzaksiya topilmadi',
  'Transaction not found',
);

export const ERR_CANNOT_CANCEL = makeError(
  PaymeErrorCode.CannotCancel,
  'Нельзя отменить эту транзакцию',
  'Tranzaksiyani bekor qilib bo\'lmaydi',
  'Cannot cancel',
);
