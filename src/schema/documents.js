/* Document types as data.

   Each type declares its numbering, its default status on creation,
   whether it shows prices, whether it collects a signature, and its
   terms. The preview renderer is generic and reads these flags — a new
   document type (a waiver, a damage report) is one registration. */

import { Registry } from '../core/registry.js';
import { Data, Store } from '../core/store.js';
import { uid } from '../core/util.js';

export function registerDocumentTypes() {
  Registry.documentType({
    id: 'quote', order: 10, label: 'Quote', prefix: 'Q-', seq: 2046,
    initialStatus: 'Draft', showPrices: true, signature: false,
    statuses: ['Draft', 'Sent', 'Accepted'],
    terms: 'Quote valid for 14 days. Equipment is held only once reserved.',
    css: true
  });
  Registry.documentType({
    id: 'contract', order: 20, label: 'Contract', prefix: 'C-', seq: 1192,
    initialStatus: 'Draft', showPrices: false, signature: true,
    statuses: ['Draft', 'Sent', 'Signed'],
    terms: 'Renter assumes full liability for loss or damage. Insurance certificate required above $5,000.',
    css: true
  });
  Registry.documentType({
    id: 'invoice', order: 30, label: 'Invoice', prefix: 'INV-', seq: 9048,
    initialStatus: 'Sent', showPrices: true, showPayments: true, signature: false,
    statuses: ['Draft', 'Sent', 'Partially paid', 'Paid', 'Overdue'],
    terms: 'Net 14. Late payments accrue 1.5% monthly.',
    css: false
  });
  Registry.documentType({
    id: 'packing', order: 40, label: 'Packing slip', prefix: 'PS-', seq: 774,
    initialStatus: 'Printed', showPrices: false, checkboxes: true, signature: false,
    statuses: ['Printed'],
    terms: 'Check every case against this list before the truck leaves.',
    css: false
  });
}

export function nextNumber(typeId) {
  const t = Registry.documentTypeById(typeId);
  t.seq += 1;
  return t.prefix + t.seq;
}

export function createDocument(orderId, typeId, patch = {}) {
  const t = Registry.documentTypeById(typeId);
  return Store.insert('documents', {
    id: uid('doc'), orderId, type: typeId, number: nextNumber(typeId),
    status: t.initialStatus, date: new Date().toISOString(),
    signedBy: null, sentTo: null, ...patch
  });
}

export const documentsFor = orderId => Data.documents().filter(d => d.orderId === orderId);
