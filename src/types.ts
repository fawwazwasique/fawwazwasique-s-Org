import { Timestamp } from 'firebase/firestore';

export interface FollowUp {
  date: Timestamp;
  notes: string;
}

export interface ConfidenceHistory {
  value: number;
  timestamp: Timestamp;
}

export interface Quotation {
  id?: string;
  quoteNo: string;
  opportunityNumber: string;
  quoteLineCreatedDate: Timestamp | string;
  account: string;
  item: string;
  itemDescription: string;
  quantity: number;
  unitPrice: number;
  baseAmount: number;
  status: string;
  saleOrder: string;
  branch: string;
  quoteLineCreatedBy: string;
  remarks: string;
  asset: string;
  fosName: string;
  billingAddress: string;
  shippingAddress: string;
  zone: string;
  customer: string;
  customerCategory: 'AMC' | 'NON - AMC' | 'Non - AMC' | 'Paid' | 'NEPI' | 'CAMC';
  confidence: number | string | null;
  visitDate: Timestamp | string;
  visitOutcome: string;
  followUpDate: Timestamp | string;
  loc: 'Filter' | 'Core' | 'Recon' | 'Battery' | 'Oil' | 'Service' | 'Growth Parts' | 'Local Parts' | 'Engine L/B' | 'Oil - CAMC';
  followUpResponsibility?: string;
  statusRemarks?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  uid: string;
  followUps?: FollowUp[];
  expectedMonth?: string;
  confidenceHistory?: ConfidenceHistory[];
  telecallerName?: string;
  followedBy?: string;
  fosRemarks?: string;
  telecallerRemarks?: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  role: 'admin' | 'user';
}

export interface FOS {
  id?: string;
  name: string;
  employeeId: string;
  branch: string;
  zone: string;
  partsTarget?: number;
  otherLocTarget?: number;
  createdAt: Timestamp;
}

export interface FOSVisit {
  id?: string;
  fosId: string;
  fosName: string;
  customerName: string;
  quoteNo?: string;
  plannedDate: Timestamp;
  actualDate?: Timestamp;
  status: 'Planned' | 'Completed' | 'Cancelled';
  outcome?: string;
  purposeOfVisit?: string;
  nextFollowUpDate?: Timestamp;
  nextVisitDate?: Timestamp;
  businessGenerated?: number;
  createdAt: Timestamp;
}

export interface MasterAsset {
  id?: string;
  assetNo: string;
  customerCategory: string;
  customerName?: string;
}

export interface FOSMapping {
  id?: string;
  customerCategory: string;
  zone: string;
  customerName?: string;
  fosName: string;
}
