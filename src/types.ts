export type SearchType = 'ORDER_ID' | 'OUT_TRADE_NO' | 'TRANSACTION_ID';
export interface Payment {
  paymentId: string; outTradeNo?: string; transactionId?: string; channelCode?: string;
  status: number; statusName: string; amount: number; createdAt?: string; paidAt?: string; refundedAt?: string;
}
export interface ConsultOrder {
  orderId: string; userId: string; productId?: string; productName: string; consultCode?: string;
  amount: number; status: number; statusName: string; createdAt?: string; paidAt?: string;
  primaryPayment?: Payment; matched?: boolean; matchedPaymentId?: string; matchedHistoricalPayment?: boolean;
}
export interface Customer {
  userId: string; nickname?: string; phone?: string; registeredAt?: string; lastConsultAt?: string;
  orderCount: number; summaryOrder?: ConsultOrder; orders: ConsultOrder[];
}
export interface Detail {
  customer: Customer; order: ConsultOrder; payments: Payment[]; userQuestion?: string | null;
  answers: { question: string | null; answer: string | null }[];
  subjects: {
    label: string | null;
    userName: string | null;
    userGender: number | null;
    userBirthday: string | null;
    userBirthTime: string | null;
    userBirthPlace: string | null;
  }[];
  paidReportStatus?: string; paidReport?: string;
}
export interface Page<T> { records: T[]; total: number; current: number }
const dates = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'Asia/Shanghai' });
const money = new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' });
export function formatDate(value?: string) {
  if (!value) return '—';
  const normalized = value.replace(' ', 'T');
  const date = new Date(/(?:Z|[+-]\d{2}:?\d{2})$/.test(normalized) ? normalized : normalized + '+08:00');
  return Number.isNaN(date.getTime()) ? '—' : dates.format(date);
}
export function formatMoney(value: number) { return money.format(Number(value)); }
