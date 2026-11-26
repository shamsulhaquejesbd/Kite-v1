import type { Order, WhatsAppTemplate } from '../types/index.ts';

export function formatBDT(amount: number, symbol = '৳'): string {
  const num = Number(amount || 0);
  return `${symbol}${num.toLocaleString('en-BD', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

export function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-BD', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatShortDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-BD', {
      day: '2-digit',
      month: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function toWhatsAppDigits(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('880')) return digits;
  if (digits.startsWith('01') && digits.length === 11) return `88${digits}`;
  if (digits.startsWith('1') && digits.length === 10) return `880${digits}`;
  return digits;
}

export function interpolateWhatsAppTemplate(
  templateText: string,
  order: Pick<Order, 'customer_name' | 'order_number' | 'total_amount'>,
  currencySymbol = '৳'
): string {
  return templateText
    .replaceAll('[Customer Name]', order.customer_name)
    .replaceAll('[Order ID]', order.order_number)
    .replaceAll('[Total]', formatBDT(order.total_amount, currencySymbol));
}

export function buildWhatsAppClickToChatUrl(phone: string, message: string): string {
  const cleanPhone = toWhatsAppDigits(phone);
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${cleanPhone}?text=${encoded}`;
}

export function findTemplateForStatus(
  templates: WhatsAppTemplate[],
  status: string,
  fallbackCustomerName = 'Customer',
  fallbackOrderId = 'KITE-0000'
): string {
  const match = templates.find((t) => t.status_key === status);
  if (match) return match.template_text;
  return `Hello ${fallbackCustomerName}, your order #${fallbackOrderId} from THE KITE status is now ${status}.`;
}

export function isSafeHttpUrl(url: string): boolean {
  if (!url) return false;
  if (url.startsWith('/')) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}
