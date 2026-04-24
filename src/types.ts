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
  customerCategory: 'Paid' | 'NEPI' | 'CAMC';
  confidence: number | string | null;
  visitDate: Timestamp | string;
  visitOutcome: string;
  followUpDate: Timestamp | string; // Next Follow Up Date in UI
  lastFollowUpDate?: Timestamp | string; // Optional for backward compatibility
  lob?: 'Parts' | 'CBD' | 'Service' | 'Oil' | string;
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
  role: 'admin' | 'manager' | 'fos';
}

export interface FOS {
  id?: string;
  name: string;
  employeeId: string;
  branch: string;
  zone: string;
  partsTarget?: number;
  otherLocTarget?: number;
  cbdTarget?: number;
  newAmcTarget?: number;
  renewalAmcTarget?: number;
  createdAt: Timestamp;
}

export interface FOSVisit {
  id?: string;
  fosId: string;
  fosName: string;
  customerName: string;
  customerCategory?: string;
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

export interface Telecaller {
  id?: string;
  name: string;
  employeeId: string;
  dailyCallTarget: number;
  monthlyCallTarget: number;
  dailyConnectedTarget?: number;
  createdAt: Timestamp;
}

export interface CallLog {
  id?: string;
  telecallerId: string;
  telecallerName: string;
  customerName: string;
  quoteNo?: string;
  callDate: Timestamp;
  status: 'Connected' | 'Not Reachable' | 'Busy' | 'Invalid Number' | 'Follow-up Scheduled';
  durationMinutes?: number;
  outcome?: string;
  businessGenerated?: number;
  createdAt: Timestamp;
}
