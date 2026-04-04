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
  quoteLineCreatedDate: Timestamp;
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
  confidence: number;
  visitDate: Timestamp;
  visitOutcome: string;
  followUpDate: Timestamp;
  lob: 'Core' | 'RRA Kit' | 'Bearing & Greasing' | 'Controller conversion' | 'Hose & Belt' | 'Filters' | 'Coolant' | 'Radiwash' | 'Recon parts' | 'Battery' | 'CC' | 'Oil' | 'Local Parts' | 'New Engines' | 'Recon Engine' | 'DFK' | 'RAS' | 'RECD' | 'DATUM' | 'Service';
  createdAt: Timestamp;
  updatedAt: Timestamp;
  uid: string;
  followUps?: FollowUp[];
  expectedMonth?: string;
  confidenceHistory?: ConfidenceHistory[];
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
  createdAt: Timestamp;
}

export interface FOSVisit {
  id?: string;
  fosId: string;
  fosName: string;
  customerName: string;
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
  category: 'AMC' | 'Non - AMC' | 'NEPI' | 'CAMC';
}
