/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  addDoc, 
  updateDoc, 
  doc, 
  deleteDoc, 
  Timestamp, 
  serverTimestamp,
  orderBy,
  getDocFromServer
} from 'firebase/firestore';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell
} from 'recharts';
import { 
  Plus, 
  LayoutDashboard, 
  FileText, 
  TrendingUp, 
  Clock, 
  ShieldCheck,
  Search,
  Filter,
  Trash2,
  Edit2,
  IndianRupee,
  ChevronRight,
  MoreVertical,
  Calendar,
  Zap,
  History,
  AlertCircle,
  CheckCircle,
  Download,
  Users,
  X
} from 'lucide-react';
import { format, differenceInDays, parse } from 'date-fns';
import { db, auth, OperationType, handleFirestoreError } from './firebase';
import { Quotation, FOS, FOSVisit, MasterAsset } from './types';
import { motion, AnimatePresence } from 'motion/react';
import Papa from 'papaparse';

// Recreated Ethen Logo as an SVG for perfect display
const EthenLogo = ({ className = "w-full h-full" }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M30 15 C 30 5, 65 5, 75 5 L 75 25 C 75 25, 40 25, 30 35 Z" fill="#00AEEF" />
    <path d="M30 40 C 30 30, 65 30, 75 30 L 75 50 C 75 50, 40 50, 30 60 Z" fill="#8DC63F" />
    <path d="M30 65 C 30 55, 65 55, 75 55 L 75 75 C 75 75, 40 75, 30 85 Z" fill="#F7941E" />
  </svg>
);

const COLORS = ['#00AEEF', '#8DC63F', '#F7941E', '#64748b', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316'];

const formatExpectedMonth = (value: any) => {
  if (!value) return 'N/A';
  try {
    let dateStr = value;
    if (typeof value !== 'string' && typeof value?.toDate === 'function') {
      dateStr = format(value.toDate(), 'yyyy-MM');
    }
    if (typeof dateStr === 'string' && dateStr.includes('-')) {
      const [year, month] = dateStr.split('-').map(Number);
      if (!isNaN(year) && !isNaN(month)) {
        return format(new Date(year, month - 1), 'MMM yyyy');
      }
    }
    return String(value);
  } catch (e) {
    return String(value);
  }
};

export default function App() {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQuotation, setEditingQuotation] = useState<Quotation | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'list' | 'high-value' | 'fos-performance' | 'below-1-lakh' | 'top-100' | 'master-sheet' | 'reports' | 'data-management' | 'customer-wise' | 'follow-up-schedule'>('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [masterSearchTerm, setMasterSearchTerm] = useState('');
  const [fosList, setFosList] = useState<FOS[]>([]);
  const [visits, setVisits] = useState<FOSVisit[]>([]);
  const [masterAssets, setMasterAssets] = useState<MasterAsset[]>([]);
  const [lobFilter, setLobFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [zoneFilter, setZoneFilter] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [fosFilter, setFosFilter] = useState<string[]>([]);
  const [branchFilter, setBranchFilter] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [reportDateRange, setReportDateRange] = useState({ from: format(new Date(), 'yyyy-MM-01'), to: format(new Date(), 'yyyy-MM-dd') });
  
  // Form state
  const [formData, setFormData] = useState({
    quoteNo: '',
    opportunityNumber: '',
    quoteLineCreatedDate: format(new Date(), 'yyyy-MM-dd'),
    account: '',
    item: '',
    itemDescription: '',
    quantity: 1,
    unitPrice: 0,
    status: 'Submitted',
    saleOrder: '',
    branch: '',
    quoteLineCreatedBy: '',
    remarks: '',
    asset: '',
    fosName: '',
    billingAddress: '',
    shippingAddress: '',
    zone: 'Central',
    customer: '',
    confidence: 10,
    visitDate: format(new Date(), 'yyyy-MM-dd'),
    visitOutcome: '',
    followUpDate: format(new Date(), 'yyyy-MM-dd'),
    lob: 'Service' as Quotation['lob'],
    customerCategory: 'Paid' as Quotation['customerCategory'],
    expectedMonth: format(new Date(), 'yyyy-MM')
  });

  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isFosModalOpen, setIsFosModalOpen] = useState(false);
  const [isVisitModalOpen, setIsVisitModalOpen] = useState(false);
  const [editingVisit, setEditingVisit] = useState<FOSVisit | null>(null);
  const [isMasterModalOpen, setIsMasterModalOpen] = useState(false);
  const [historyQuotation, setHistoryQuotation] = useState<Quotation | null>(null);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<string | null>(null);
  const [visitToDelete, setVisitToDelete] = useState<string | null>(null);
  const [masterAssetToDelete, setMasterAssetToDelete] = useState<string | null>(null);
  const [bulkDeleteConfirmation, setBulkDeleteConfirmation] = useState<{ collection: string, label: string } | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [duplicateItems, setDuplicateItems] = useState<{ newData: any, existingId: string }[]>([]);
  const [newBulkItems, setNewBulkItems] = useState<any[]>([]);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [masterFile, setMasterFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);

  const [fosFormData, setFosFormData] = useState({
    name: '',
    employeeId: '',
    branch: '',
    zone: 'Central'
  });

  const [visitFormData, setVisitFormData] = useState({
    fosId: '',
    fosName: '',
    customerName: '',
    plannedDate: format(new Date(), 'yyyy-MM-dd'),
    status: 'Planned' as FOSVisit['status'],
    outcome: '',
    purposeOfVisit: '',
    nextFollowUpDate: format(new Date(), 'yyyy-MM-dd'),
    nextVisitDate: format(new Date(), 'yyyy-MM-dd'),
    businessGenerated: 0
  });

  useEffect(() => {
    const q = query(collection(db, 'quotations'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const qts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Quotation[];
      setQuotations(qts);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'quotations');
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'fos'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as FOS[];
      setFosList(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'fos');
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'visits'), orderBy('plannedDate', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as FOSVisit[];
      setVisits(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'visits');
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'masterAssets'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as MasterAsset[];
      setMasterAssets(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'masterAssets');
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowWelcome(false);
    }, 3500);
    return () => clearTimeout(timer);
  }, []);

  // Test connection
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    }
    testConnection();
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const safeDate = (dateStr: string) => {
    if (!dateStr) return new Date();
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? new Date() : d;
  };

  const handleBulkUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkFile) return;

    setIsUploading(true);
    Papa.parse(bulkFile, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        // Deduplicate CSV items internally first (last one wins)
        const uniqueCsvItems = new Map<string, any>();
        results.data.forEach((row: any) => {
          try {
            const quantity = Number(row['Quantity']) || 1;
            const unitPrice = Number(row['Unit Price']) || 0;
            const quoteNo = row['Quote No.'] || '';
            if (!quoteNo) return;

            const assetNo = row['Asset'] || '';
            let customerCategory = (row['Customer Category'] || 'Paid') as Quotation['customerCategory'];

            // Lookup in masterAssets for automatic category suggestion
            if (assetNo) {
              const mapping = masterAssets.find(m => m.assetNo === assetNo);
              if (mapping) {
                customerCategory = mapping.category as Quotation['customerCategory'];
              }
            }

            uniqueCsvItems.set(quoteNo, {
              quoteNo,
              opportunityNumber: row['Opportunity Number'] || '',
              quoteLineCreatedDate: Timestamp.fromDate(safeDate(row['Quote Line: Created Date'])),
              account: row['Account'] || '',
              item: row['Item'] || '',
              itemDescription: row['Item Description'] || '',
              quantity: quantity,
              unitPrice: unitPrice,
              baseAmount: quantity * unitPrice,
              status: row['Status'] || 'Submitted',
              saleOrder: row['Sale Order'] || '',
              branch: row['Branch'] || '',
              quoteLineCreatedBy: row['Quote Line: Created By'] || '',
              remarks: row['Remarks'] || '',
              asset: assetNo,
              fosName: row['FOS Name'] || '',
              billingAddress: row['Billing Address'] || '',
              shippingAddress: row['Shipping Address'] || '',
              zone: row['Zone'] || 'Central',
              customer: row['Customer'] || '',
              confidence: Number(row['Confidence']) || 10,
              visitDate: Timestamp.fromDate(safeDate(row['Visit Date'])),
              visitOutcome: row['Visit Outcome'] || '',
              followUpDate: Timestamp.fromDate(safeDate(row['Follow up'])),
              lob: (row['LOB'] || 'Service') as Quotation['lob'],
              customerCategory: customerCategory,
              expectedMonth: row['Expected Month'] || format(new Date(), 'yyyy-MM'),
              uid: 'guest',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              followUps: [],
              confidenceHistory: [{
                value: Number(row['Confidence']) || 10,
                timestamp: Timestamp.now()
              }]
            });
          } catch (err) {
            console.error('Error parsing row:', row, err);
          }
        });

        const parsedItems = Array.from(uniqueCsvItems.values());
        const duplicates: { newData: any, existingId: string }[] = [];
        const newItems: any[] = [];

        parsedItems.forEach((item: any) => {
          const existing = quotations.find(q => q.quoteNo === item.quoteNo);
          if (existing && existing.id) {
            duplicates.push({ newData: item, existingId: existing.id });
          } else {
            newItems.push(item);
          }
        });

        if (duplicates.length > 0) {
          setDuplicateItems(duplicates);
          setNewBulkItems(newItems);
          setIsDuplicateModalOpen(true);
          setIsUploading(false);
        } else {
          try {
            const promises = newItems.map(data => addDoc(collection(db, 'quotations'), data));
            await Promise.all(promises);
            setIsBulkModalOpen(false);
            setBulkFile(null);
            
            const highValueAdded = newItems.filter(item => item.baseAmount >= 100000).length;
            if (highValueAdded > 0) {
              setToast({ 
                message: `Successfully uploaded ${newItems.length} quotations. ${highValueAdded} High Value quotes added!`, 
                type: 'success' 
              });
            } else {
              setToast({ message: `Successfully uploaded ${newItems.length} quotations`, type: 'success' });
            }
          } catch (error) {
            handleFirestoreError(error, OperationType.CREATE, 'quotations');
            setToast({ message: 'Failed to upload quotations', type: 'error' });
          } finally {
            setIsUploading(false);
          }
        }
      },
      error: (error) => {
        console.error('CSV Parse Error:', error);
        setToast({ message: 'Error parsing CSV file. Please check the format.', type: 'error' });
        setIsUploading(false);
      }
    });
  };

  const handleMasterUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!masterFile) return;

    setIsUploading(true);
    Papa.parse(masterFile, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const promises = results.data.map((row: any) => {
            const assetNo = row['Asset No.'] || row['Asset No'] || row['assetNo'] || '';
            const category = row['Category'] || row['category'] || '';
            if (!assetNo || !category) return null;
            
            return addDoc(collection(db, 'masterAssets'), {
              assetNo,
              category
            });
          }).filter(p => p !== null);

          await Promise.all(promises);
          setIsMasterModalOpen(false);
          setMasterFile(null);
          setToast({ message: `Successfully uploaded ${promises.length} master asset mappings`, type: 'success' });
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, 'masterAssets');
          setToast({ message: 'Failed to upload master assets', type: 'error' });
        } finally {
          setIsUploading(false);
        }
      },
      error: (error) => {
        console.error('CSV Parse Error:', error);
        setToast({ message: 'Error parsing CSV file. Please check the format.', type: 'error' });
        setIsUploading(false);
      }
    });
  };

  const handleDuplicateAction = async (action: 'replace' | 'skip') => {
    setIsUploading(true);
    try {
      if (action === 'replace') {
        const updatePromises = duplicateItems.map(dup => {
          const existing = quotations.find(q => q.id === dup.existingId);
          const history = [...(existing?.confidenceHistory || [])];
          if (existing && existing.confidence !== Number(dup.newData.confidence)) {
            history.push({
              value: Number(dup.newData.confidence),
              timestamp: Timestamp.now()
            });
          }
          return updateDoc(doc(db, 'quotations', dup.existingId), {
            ...dup.newData,
            confidenceHistory: history,
            updatedAt: serverTimestamp()
          });
        });
        await Promise.all(updatePromises);
      }
      
      const addPromises = newBulkItems.map(data => addDoc(collection(db, 'quotations'), data));
      await Promise.all(addPromises);

      setIsBulkModalOpen(false);
      setIsDuplicateModalOpen(false);
      setBulkFile(null);
      setDuplicateItems([]);
      setNewBulkItems([]);
      setToast({ 
        message: `Bulk upload processed: ${action === 'replace' ? duplicateItems.length : 0} replaced, ${newBulkItems.length} added`, 
        type: 'success' 
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'quotations');
      setToast({ message: 'Failed to process bulk upload', type: 'error' });
    } finally {
      setIsUploading(false);
    }
  };

  const downloadTemplate = () => {
    const headers = [
      'Quote No.', 'Opportunity Number', 'Quote Line: Created Date', 'Account', 'Item', 'Item Description', 
      'Quantity', 'Unit Price', 'Status', 'Sale Order', 'Branch', 'Quote Line: Created By', 'Remarks', 
      'Asset', 'FOS Name', 'Billing Address', 'Shipping Address', 'Zone', 'Customer', 'Confidence', 
      'Visit Date', 'Visit Outcome', 'Follow up', 'LOB', 'Customer Category', 'Expected Month'
    ];
    const exampleRow = [
      'Q-001', 'OPP-123', '2024-12-01', 'Acme Corp', 'UPS 10kVA', 'Online UPS', 
      '1', '50000', 'Submitted', 'SO-456', 'Mumbai', 'Admin', 'Urgent', 
      'Asset-001', 'John Doe', 'Address 1', 'Address 2', 'Central', 'Acme Corp', '75', 
      '2024-12-05', 'Positive', '2024-12-10', 'Service', 'Paid', '2024-12'
    ];
    const csvContent = headers.join(',') + '\n' + exampleRow.join(',');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'quotation_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const data = {
      ...formData,
      quantity: Number(formData.quantity),
      unitPrice: Number(formData.unitPrice),
      baseAmount: Number(formData.quantity) * Number(formData.unitPrice),
      quoteLineCreatedDate: Timestamp.fromDate(safeDate(formData.quoteLineCreatedDate)),
      visitDate: Timestamp.fromDate(safeDate(formData.visitDate)),
      followUpDate: Timestamp.fromDate(safeDate(formData.followUpDate)),
      uid: 'guest',
      updatedAt: serverTimestamp(),
    };

    try {
      if (editingQuotation?.id) {
        const history = [...(editingQuotation.confidenceHistory || [])];
        if (editingQuotation.confidence !== Number(formData.confidence)) {
          history.push({
            value: Number(formData.confidence),
            timestamp: Timestamp.now()
          });
        }
        await updateDoc(doc(db, 'quotations', editingQuotation.id), {
          ...data,
          confidenceHistory: history
        });
        setToast({ message: 'Quotation updated successfully', type: 'success' });
      } else {
        await addDoc(collection(db, 'quotations'), {
          ...data,
          createdAt: serverTimestamp(),
          followUps: [],
          confidenceHistory: [{
            value: Number(formData.confidence),
            timestamp: Timestamp.now()
          }]
        });
        setToast({ message: 'Quotation created successfully', type: 'success' });
      }
      setIsModalOpen(false);
      setEditingQuotation(null);
      setFormData({
        quoteNo: '',
        opportunityNumber: '',
        quoteLineCreatedDate: format(new Date(), 'yyyy-MM-dd'),
        account: '',
        item: '',
        itemDescription: '',
        quantity: 1,
        unitPrice: 0,
        status: 'Submitted',
        saleOrder: '',
        branch: '',
        quoteLineCreatedBy: '',
        remarks: '',
        asset: '',
        fosName: '',
        billingAddress: '',
        shippingAddress: '',
        zone: 'Central',
        customer: '',
        confidence: 50,
        visitDate: format(new Date(), 'yyyy-MM-dd'),
        visitOutcome: '',
        followUpDate: format(new Date(), 'yyyy-MM-dd'),
        lob: 'Service',
        customerCategory: 'Paid',
        expectedMonth: format(new Date(), 'yyyy-MM')
      });
    } catch (error) {
      handleFirestoreError(error, editingQuotation ? OperationType.UPDATE : OperationType.CREATE, 'quotations');
      setToast({ message: `Failed to ${editingQuotation ? 'update' : 'create'} quotation`, type: 'error' });
    }
  };

  const handleFosSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'fos'), {
        ...fosFormData,
        createdAt: serverTimestamp()
      });
      setIsFosModalOpen(false);
      setFosFormData({ name: '', employeeId: '', branch: '', zone: 'Central' });
      setToast({ message: 'FOS member added successfully', type: 'success' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'fos');
      setToast({ message: 'Failed to add FOS member', type: 'error' });
    }
  };

  const handleVisitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const selectedFos = fosList.find(f => f.id === visitFormData.fosId);
    try {
      const data = {
        ...visitFormData,
        fosName: selectedFos?.name || '',
        plannedDate: Timestamp.fromDate(safeDate(visitFormData.plannedDate)),
        nextFollowUpDate: Timestamp.fromDate(safeDate(visitFormData.nextFollowUpDate)),
        nextVisitDate: Timestamp.fromDate(safeDate(visitFormData.nextVisitDate)),
        businessGenerated: Number(visitFormData.businessGenerated),
      };

      if (editingVisit?.id) {
        await updateDoc(doc(db, 'visits', editingVisit.id), {
          ...data,
          updatedAt: serverTimestamp()
        });
        setToast({ message: 'Visit updated successfully', type: 'success' });
      } else {
        await addDoc(collection(db, 'visits'), {
          ...data,
          createdAt: serverTimestamp()
        });
        setToast({ message: 'Visit scheduled successfully', type: 'success' });
      }
      
      setIsVisitModalOpen(false);
      setEditingVisit(null);
      setVisitFormData({
        fosId: '',
        fosName: '',
        customerName: '',
        plannedDate: format(new Date(), 'yyyy-MM-dd'),
        status: 'Planned',
        outcome: '',
        purposeOfVisit: '',
        nextFollowUpDate: format(new Date(), 'yyyy-MM-dd'),
        nextVisitDate: format(new Date(), 'yyyy-MM-dd'),
        businessGenerated: 0
      });
    } catch (error) {
      handleFirestoreError(error, editingVisit ? OperationType.UPDATE : OperationType.CREATE, 'visits');
      setToast({ message: `Failed to ${editingVisit ? 'update' : 'schedule'} visit`, type: 'error' });
    }
  };

  const handleDownloadReport = () => {
    const fromDate = reportDateRange.from ? new Date(reportDateRange.from) : null;
    const toDate = reportDateRange.to ? new Date(reportDateRange.to) : null;

    const filtered = quotations.filter(q => {
      if (!q.quoteLineCreatedDate) return false;
      const qDate = q.quoteLineCreatedDate.toDate();
      
      if (fromDate && qDate < fromDate) return false;
      if (toDate) {
        const endDay = new Date(toDate);
        endDay.setHours(23, 59, 59, 999);
        if (qDate > endDay) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      setToast({ message: 'No quotations found in this date range', type: 'error' });
      return;
    }

    const csvData = filtered.map(q => ({
      'Quote No.': q.quoteNo,
      'Opportunity Number': q.opportunityNumber,
      'Quote Line: Created Date': q.quoteLineCreatedDate ? format(q.quoteLineCreatedDate.toDate(), 'yyyy-MM-dd') : '',
      'Account': q.account,
      'Item': q.item,
      'Item Description': q.itemDescription,
      'Quantity': q.quantity,
      'Unit Price': q.unitPrice,
      'Base Amount': q.baseAmount,
      'Status': q.status,
      'Sale Order': q.saleOrder,
      'Branch': q.branch,
      'Created By': q.quoteLineCreatedBy,
      'Asset': q.asset,
      'FOS Name': q.fosName,
      'Billing Address': q.billingAddress,
      'Shipping Address': q.shippingAddress,
      'Zone': q.zone,
      'Customer': q.customer,
      'Customer Category': q.customerCategory,
      'Confidence (%)': q.confidence,
      'Visit Date': q.visitDate ? format(q.visitDate.toDate(), 'yyyy-MM-dd') : '',
      'Visit Outcome': q.visitOutcome,
      'Follow up Date': q.followUpDate ? format(q.followUpDate.toDate(), 'yyyy-MM-dd') : '',
      'LOB': q.lob,
      'Expected Month': q.expectedMonth || '',
      'Remarks': q.remarks
    }));

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Quotes_Report_${reportDateRange.from}_to_${reportDateRange.to}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setToast({ message: `Report downloaded with ${filtered.length} quotes`, type: 'success' });
  };

  const handleDownloadConfidenceReport = () => {
    const fromDate = reportDateRange.from ? new Date(reportDateRange.from) : null;
    const toDate = reportDateRange.to ? new Date(reportDateRange.to) : null;

    const historyData: any[] = [];

    quotations.forEach(q => {
      if (!q.confidenceHistory) return;

      q.confidenceHistory.forEach((h, index) => {
        const hDate = h.timestamp.toDate();
        
        if (fromDate && hDate < fromDate) return;
        if (toDate) {
          const endDay = new Date(toDate);
          endDay.setHours(23, 59, 59, 999);
          if (hDate > endDay) return;
        }

        const prevValue = index > 0 ? q.confidenceHistory![index - 1].value : null;

        historyData.push({
          'Quote No.': q.quoteNo,
          'Customer': q.customer,
          'Account': q.account,
          'Date of Change': format(hDate, 'yyyy-MM-dd HH:mm:ss'),
          'Previous Confidence (%)': prevValue !== null ? prevValue : 'Initial',
          'New Confidence (%)': h.value,
          'Change': prevValue !== null ? `${h.value - prevValue}%` : 'N/A'
        });
      });
    });

    if (historyData.length === 0) {
      setToast({ message: 'No confidence changes found in this date range', type: 'error' });
      return;
    }

    const csv = Papa.unparse(historyData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Confidence_History_Report_${reportDateRange.from}_to_${reportDateRange.to}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setToast({ message: `Confidence history report downloaded with ${historyData.length} records`, type: 'success' });
  };

  const [isDeletingAll, setIsDeletingAll] = useState(false);

  const handleDeleteAllData = (collectionName: string, label: string) => {
    setBulkDeleteConfirmation({ collection: collectionName, label });
  };

  const confirmBulkDelete = async () => {
    if (!bulkDeleteConfirmation) return;
    
    const { collection: collectionName, label } = bulkDeleteConfirmation;
    setBulkDeleteConfirmation(null);
    setIsDeletingAll(true);
    
    try {
      // In a real scenario with many docs, we'd batch delete. 
      // For this app, we'll iterate through the local state IDs to delete from Firestore.
      let targetIds: string[] = [];
      if (collectionName === 'quotations') targetIds = quotations.map(q => q.id!);
      else if (collectionName === 'fos') targetIds = fosList.map(f => f.id!);
      else if (collectionName === 'visits') targetIds = visits.map(v => v.id!);
      else if (collectionName === 'masterAssets') targetIds = masterAssets.map(m => m.id!);
      else if (collectionName === 'all') {
        // Special case for wiping everything
        const allDeletes = [
          ...quotations.map(q => deleteDoc(doc(db, 'quotations', q.id!))),
          ...fosList.map(f => deleteDoc(doc(db, 'fos', f.id!))),
          ...visits.map(v => deleteDoc(doc(db, 'visits', v.id!))),
          ...masterAssets.map(m => deleteDoc(doc(db, 'masterAssets', m.id!)))
        ];
        await Promise.all(allDeletes);
        setToast({ message: 'Successfully wiped entire database', type: 'success' });
        return;
      }

      const deletePromises = targetIds.map(id => deleteDoc(doc(db, collectionName, id)));
      await Promise.all(deletePromises);
      
      setToast({ message: `Successfully deleted all ${label}`, type: 'success' });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, collectionName === 'all' ? 'multiple' : collectionName);
      setToast({ message: `Failed to delete ${label}`, type: 'error' });
    } finally {
      setIsDeletingAll(false);
    }
  };

  const handleEditVisit = (visit: FOSVisit) => {
    setEditingVisit(visit);
    setVisitFormData({
      fosId: visit.fosId,
      fosName: visit.fosName,
      customerName: visit.customerName,
      plannedDate: visit.plannedDate ? format(visit.plannedDate.toDate(), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
      status: visit.status,
      outcome: visit.outcome || '',
      purposeOfVisit: visit.purposeOfVisit || '',
      nextFollowUpDate: visit.nextFollowUpDate ? format(visit.nextFollowUpDate.toDate(), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
      nextVisitDate: visit.nextVisitDate ? format(visit.nextVisitDate.toDate(), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
      businessGenerated: visit.businessGenerated || 0
    });
    setIsVisitModalOpen(true);
  };

  const handleDelete = (id: string) => {
    setDeleteConfirmation(id);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmation) return;
    try {
      await deleteDoc(doc(db, 'quotations', deleteConfirmation));
      setToast({ message: 'Quotation deleted successfully', type: 'success' });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'quotations');
      setToast({ message: 'Failed to delete quotation', type: 'error' });
    } finally {
      setDeleteConfirmation(null);
    }
  };

  const confirmVisitDelete = async () => {
    if (!visitToDelete) return;
    try {
      await deleteDoc(doc(db, 'visits', visitToDelete));
      setToast({ message: 'Visit deleted successfully', type: 'success' });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'visits');
      setToast({ message: 'Failed to delete visit', type: 'error' });
    } finally {
      setVisitToDelete(null);
    }
  };

  const confirmMasterDelete = async () => {
    if (!masterAssetToDelete) return;
    try {
      await deleteDoc(doc(db, 'masterAssets', masterAssetToDelete));
      setToast({ message: 'Mapping deleted successfully', type: 'success' });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'masterAssets');
      setToast({ message: 'Failed to delete mapping', type: 'error' });
    } finally {
      setMasterAssetToDelete(null);
    }
  };

  const openEditModal = (q: Quotation) => {
    setEditingQuotation(q);
    setFormData({
      quoteNo: q.quoteNo || '',
      opportunityNumber: q.opportunityNumber || '',
      quoteLineCreatedDate: q.quoteLineCreatedDate ? format(q.quoteLineCreatedDate.toDate(), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
      account: q.account || '',
      item: q.item || '',
      itemDescription: q.itemDescription || '',
      quantity: q.quantity || 1,
      unitPrice: q.unitPrice || 0,
      status: q.status || 'Submitted',
      saleOrder: q.saleOrder || '',
      branch: q.branch || '',
      quoteLineCreatedBy: q.quoteLineCreatedBy || '',
      remarks: q.remarks || '',
      asset: q.asset || '',
      fosName: q.fosName || '',
      billingAddress: q.billingAddress || '',
      shippingAddress: q.shippingAddress || '',
      zone: q.zone || 'Central',
      customer: q.customer || '',
      confidence: q.confidence || 50,
      visitDate: q.visitDate ? format(q.visitDate.toDate(), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
      visitOutcome: q.visitOutcome || '',
      followUpDate: q.followUpDate ? format(q.followUpDate.toDate(), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
      lob: q.lob || 'Service',
      customerCategory: q.customerCategory || 'Paid',
      expectedMonth: q.expectedMonth || format(new Date(), 'yyyy-MM')
    });
    setIsModalOpen(true);
  };

  // Analytics Calculations
  const analytics = useMemo(() => {
    const filteredForAnalytics = quotations.filter(q => {
      const matchesLob = lobFilter.length === 0 || lobFilter.includes(q.lob);
      const matchesStatus = statusFilter.length === 0 || statusFilter.includes(q.status);
      const matchesZone = zoneFilter.length === 0 || zoneFilter.includes(q.zone);
      const matchesCategory = categoryFilter.length === 0 || categoryFilter.includes(q.customerCategory);
      const matchesFos = fosFilter.length === 0 || (q.fosName && fosFilter.includes(q.fosName));
      const matchesBranch = branchFilter.length === 0 || (q.branch && branchFilter.includes(q.branch));
      
      let matchesDate = true;
      if (dateRange.from || dateRange.to) {
        const qDate = q.createdAt?.toDate();
        if (qDate) {
          if (dateRange.from && qDate < new Date(dateRange.from)) matchesDate = false;
          if (dateRange.to) {
            const toDate = new Date(dateRange.to);
            toDate.setHours(23, 59, 59, 999);
            if (qDate > toDate) matchesDate = false;
          }
        } else {
          matchesDate = false;
        }
      }
      
      return matchesLob && matchesStatus && matchesZone && matchesCategory && matchesFos && matchesBranch && matchesDate;
    });

    const lobWise = filteredForAnalytics.reduce((acc, q) => {
      acc[q.lob] = acc[q.lob] || { count: 0, value: 0 };
      acc[q.lob].count += 1;
      acc[q.lob].value += (q.baseAmount || 0);
      return acc;
    }, {} as Record<string, { count: number, value: number }>);

    const statusWise = filteredForAnalytics.reduce((acc, q) => {
      acc[q.status] = (acc[q.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const zoneWise = filteredForAnalytics.reduce((acc, q) => {
      acc[q.zone] = (acc[q.zone] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const fosWise = filteredForAnalytics.reduce((acc, q) => {
      acc[q.fosName] = (acc[q.fosName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const confidenceWise = filteredForAnalytics.reduce((acc, q) => {
      acc[q.confidence] = (acc[q.confidence] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const ageing = {
      '0-15': 0,
      '16-30': 0,
      '31-45': 0,
      '46-90': 0,
      'Above 90': 0
    };

    filteredForAnalytics.forEach(q => {
      if (!q.createdAt) return;
      const days = differenceInDays(new Date(), q.createdAt.toDate());
      if (days <= 15) ageing['0-15']++;
      else if (days <= 30) ageing['16-30']++;
      else if (days <= 45) ageing['31-45']++;
      else if (days <= 90) ageing['46-90']++;
      else ageing['Above 90']++;
    });

    const followUpByFos = filteredForAnalytics.reduce((acc, q) => {
      acc[q.fosName] = (acc[q.fosName] || 0) + (q.followUps?.length || 0);
      return acc;
    }, {} as Record<string, number>);
    
    const customerCategoryWise = filteredForAnalytics.reduce((acc, q) => {
      acc[q.customerCategory] = (acc[q.customerCategory] || 0) + (q.baseAmount || 0);
      return acc;
    }, {} as Record<string, number>);

    const monthWiseValue = filteredForAnalytics.reduce((acc, q) => {
      let month = 'Unknown';
      if (q.expectedMonth) {
        if (typeof q.expectedMonth === 'string') {
          month = q.expectedMonth;
        } else if (typeof (q.expectedMonth as any).toDate === 'function') {
          month = format((q.expectedMonth as any).toDate(), 'yyyy-MM');
        }
      }
      acc[month] = (acc[month] || 0) + (q.baseAmount || 0);
      return acc;
    }, {} as Record<string, number>);

    const total = filteredForAnalytics.length;
    const totalValue = filteredForAnalytics.reduce((sum, q) => sum + (q.baseAmount || 0), 0);
    
    const highConfidenceQuotes = filteredForAnalytics.filter(q => (q.confidence || 0) >= 75);
    const highConfidenceValue = highConfidenceQuotes.reduce((sum, q) => sum + (q.baseAmount || 0), 0);

    const highValueQuotes = filteredForAnalytics
      .filter(q => (q.baseAmount || 0) >= 100000)
      .sort((a, b) => (b.baseAmount || 0) - (a.baseAmount || 0));
    const highValueTotalValue = highValueQuotes.reduce((sum, q) => sum + (q.baseAmount || 0), 0);

    const below1LakhQuotes = filteredForAnalytics
      .filter(q => (q.baseAmount || 0) < 100000)
      .sort((a, b) => (b.baseAmount || 0) - (a.baseAmount || 0));

    const top100ValueQuotes = [...filteredForAnalytics]
      .sort((a, b) => (b.baseAmount || 0) - (a.baseAmount || 0))
      .slice(0, 100);

    const customerWiseValue = filteredForAnalytics.reduce((acc, q) => {
      acc[q.customer] = (acc[q.customer] || 0) + (q.baseAmount || 0);
      return acc;
    }, {} as Record<string, number>);

    const top100CustomerQuotes = Object.entries(customerWiseValue)
      .map(([name, value]) => ({ name, value: value as number }))
      .sort((a, b) => (b.value as number) - (a.value as number))
      .slice(0, 100);

    const top100AgeingQuotes = [...filteredForAnalytics]
      .filter(q => q.createdAt)
      .sort((a, b) => a.createdAt!.toDate().getTime() - b.createdAt!.toDate().getTime())
      .slice(0, 100);

    return {
      total,
      totalValue,
      highConfidenceCount: highConfidenceQuotes.length,
      highConfidenceValue,
      highValueQuotes,
      highValueCount: highValueQuotes.length,
      highValueTotalValue,
      below1LakhQuotes,
      top100ValueQuotes,
      top100CustomerQuotes,
      top100AgeingQuotes,
      customerWiseValue,
      lobData: Object.entries(lobWise).map(([name, data]: [string, { count: number, value: number }]) => ({ name, count: data.count, value: data.value })),
      statusData: Object.entries(statusWise).map(([name, value]: [string, number]) => ({ name, value: total ? Math.round((value / total) * 100) : 0 })),
      zoneData: Object.entries(zoneWise).map(([name, value]: [string, number]) => ({ name, value: total ? Math.round((value / total) * 100) : 0 })),
      fosData: Object.entries(fosWise).map(([name, value]: [string, number]) => ({ name, value: total ? Math.round((value / total) * 100) : 0 })),
      confidenceData: Object.entries(confidenceWise).map(([name, value]: [string, number]) => ({ name, value: total ? Math.round((value / total) * 100) : 0 })),
      ageingData: Object.entries(ageing).map(([name, value]: [string, number]) => ({ name, value: total ? Math.round((value / total) * 100) : 0 })),
      followUpFosData: Object.entries(followUpByFos).map(([name, value]: [string, number]) => ({ name, value })),
      customerCategoryValueData: Object.entries(customerCategoryWise).map(([name, value]: [string, number]) => ({ name, value })),
      monthWiseData: Object.entries(monthWiseValue)
        .map(([name, value]: [string, number]) => {
          return { name: formatExpectedMonth(name), value, raw: name };
        })
        .sort((a, b) => a.raw.localeCompare(b.raw)),
    };
  }, [quotations, lobFilter, statusFilter, zoneFilter, categoryFilter, fosFilter, branchFilter, dateRange]);

  const confidenceAnalysis = useMemo(() => {
    const fromDate = reportDateRange.from ? new Date(reportDateRange.from) : null;
    const toDate = reportDateRange.to ? new Date(reportDateRange.to) : null;

    let totalChanges = 0;
    let positiveChanges = 0;
    let negativeChanges = 0;
    let totalValueChange = 0;

    quotations.forEach(q => {
      if (!q.confidenceHistory) return;

      q.confidenceHistory.forEach((h, index) => {
        if (index === 0) return;

        const hDate = h.timestamp.toDate();
        if (fromDate && hDate < fromDate) return;
        if (toDate) {
          const endDay = new Date(toDate);
          endDay.setHours(23, 59, 59, 999);
          if (hDate > endDay) return;
        }

        const prevValue = q.confidenceHistory![index - 1].value;
        const change = h.value - prevValue;

        totalChanges++;
        if (change > 0) positiveChanges++;
        else if (change < 0) negativeChanges++;
        totalValueChange += change;
      });
    });

    return {
      totalChanges,
      positiveChanges,
      negativeChanges,
      avgChange: totalChanges > 0 ? (totalValueChange / totalChanges).toFixed(1) : 0
    };
  }, [quotations, reportDateRange]);

  const filteredQuotations = useMemo(() => {
    return quotations.filter(q => {
    const matchesSearch = (q.customer || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (q.account || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (q.fosName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (q.lob || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (q.quoteNo || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesLob = lobFilter.length === 0 || lobFilter.includes(q.lob);
    const matchesStatus = statusFilter.length === 0 || statusFilter.includes(q.status);
    const matchesZone = zoneFilter.length === 0 || zoneFilter.includes(q.zone);
    const matchesCategory = categoryFilter.length === 0 || categoryFilter.includes(q.customerCategory);
    const matchesFos = fosFilter.length === 0 || (q.fosName && fosFilter.includes(q.fosName));
    const matchesBranch = branchFilter.length === 0 || (q.branch && branchFilter.includes(q.branch));
    
    let matchesDate = true;
    if (dateRange.from || dateRange.to) {
      const qDate = q.createdAt?.toDate();
      if (qDate) {
        if (dateRange.from && qDate < new Date(dateRange.from)) matchesDate = false;
        if (dateRange.to) {
          const toDate = new Date(dateRange.to);
          toDate.setHours(23, 59, 59, 999);
          if (qDate > toDate) matchesDate = false;
        }
      } else {
        matchesDate = false;
      }
    }
    
    return matchesSearch && matchesLob && matchesStatus && matchesZone && matchesCategory && matchesFos && matchesBranch && matchesDate;
    });
  }, [quotations, searchTerm, lobFilter, statusFilter, zoneFilter, categoryFilter, fosFilter, branchFilter, dateRange]);

  const uniqueFosNames = useMemo(() => Array.from(new Set(quotations.map(q => q.fosName).filter(Boolean))), [quotations]);
  const uniqueBranches = useMemo(() => Array.from(new Set(quotations.map(q => q.branch).filter(Boolean))), [quotations]);

  const allFollowUps = useMemo(() => {
    const quoteFollowUps = quotations
      .filter(q => q.followUpDate)
      .map(q => ({
        id: q.id,
        date: q.followUpDate.toDate(),
        fosName: q.fosName || 'N/A',
        customer: q.customer,
        type: 'Quotation',
        reference: q.quoteNo,
        lob: q.lob,
        value: q.baseAmount,
        original: q
      }));

    const visitFollowUps = visits
      .filter(v => v.nextFollowUpDate)
      .map(v => ({
        id: v.id,
        date: v.nextFollowUpDate!.toDate(),
        fosName: v.fosName,
        customer: v.customerName,
        type: 'Visit Follow-up',
        reference: v.purposeOfVisit || 'Visit',
        lob: 'N/A',
        value: 0,
        original: v
      }));

    return [...quoteFollowUps, ...visitFollowUps].sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [quotations, visits]);

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <AnimatePresence>
        {showWelcome && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
            className="fixed inset-0 z-[100] bg-slate-900 flex flex-col items-center justify-center text-center p-6"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="w-32 h-32 mb-8 bg-white p-4 rounded-3xl shadow-2xl"
            >
              <EthenLogo />
            </motion.div>
            <motion.h1
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.8 }}
              className="text-4xl md:text-6xl font-black text-white tracking-tighter mb-4"
            >
              Welcome to <span className="text-[#00AEEF]">Ethen Group</span>
            </motion.h1>
            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.8 }}
              className="text-xl md:text-2xl text-slate-400 font-medium mb-8"
            >
              Quote Dashboard
            </motion.p>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1, duration: 1 }}
              className="absolute bottom-12"
            >
              <p className="text-slate-500 text-sm font-bold uppercase tracking-[0.2em]">
                by Fawwaz Creation
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col fixed h-full z-30">
        <div className="p-6 border-b border-slate-800">
          <div className="flex flex-col gap-4">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg overflow-hidden border border-slate-100 p-2">
              <EthenLogo />
            </div>
            <div>
              <p className="font-bold text-sm text-white leading-tight">Ethen Power Solutionns</p>
              <p className="text-[10px] text-slate-500 font-medium">Private Limited</p>
            </div>
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'dashboard' ? 'bg-[#00AEEF] text-white shadow-lg shadow-[#00AEEF]/20' : 'hover:bg-slate-800 hover:text-white'}`}
          >
            <LayoutDashboard size={20} />
            <span className="font-semibold text-sm">Dashboard</span>
          </button>
          <button 
            onClick={() => setActiveTab('list')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'list' ? 'bg-[#00AEEF] text-white shadow-lg shadow-[#00AEEF]/20' : 'hover:bg-slate-800 hover:text-white'}`}
          >
            <FileText size={20} />
            <span className="font-semibold text-sm">Quotations</span>
          </button>
          <button 
            onClick={() => setActiveTab('high-value')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'high-value' ? 'bg-[#00AEEF] text-white shadow-lg shadow-[#00AEEF]/20' : 'hover:bg-slate-800 hover:text-white'}`}
          >
            <TrendingUp size={20} />
            <span className="font-semibold text-sm">High Value Quotes</span>
          </button>
          <button 
            onClick={() => setActiveTab('below-1-lakh')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'below-1-lakh' ? 'bg-[#00AEEF] text-white shadow-lg shadow-[#00AEEF]/20' : 'hover:bg-slate-800 hover:text-white'}`}
          >
            <IndianRupee size={20} />
            <span className="font-semibold text-sm">Below 1 Lakh</span>
          </button>
          <button 
            onClick={() => setActiveTab('customer-wise')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'customer-wise' ? 'bg-[#00AEEF] text-white shadow-lg shadow-[#00AEEF]/20' : 'hover:bg-slate-800 hover:text-white'}`}
          >
            <Users size={20} />
            <span className="font-semibold text-sm">Customer Wise</span>
          </button>
          <button 
            onClick={() => setActiveTab('top-100')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'top-100' ? 'bg-[#00AEEF] text-white shadow-lg shadow-[#00AEEF]/20' : 'hover:bg-slate-800 hover:text-white'}`}
          >
            <TrendingUp size={20} />
            <span className="font-semibold text-sm">Top 100 Quotes</span>
          </button>
          <button 
            onClick={() => setActiveTab('fos-performance')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'fos-performance' ? 'bg-[#00AEEF] text-white shadow-lg shadow-[#00AEEF]/20' : 'hover:bg-slate-800 hover:text-white'}`}
          >
            <Zap size={20} />
            <span className="font-semibold text-sm">FOS Performance</span>
          </button>
          <button 
            onClick={() => setActiveTab('follow-up-schedule')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'follow-up-schedule' ? 'bg-[#00AEEF] text-white shadow-lg shadow-[#00AEEF]/20' : 'hover:bg-slate-800 hover:text-white'}`}
          >
            <Clock size={20} />
            <span className="font-semibold text-sm">Follow-up Schedule</span>
          </button>
          <button 
            onClick={() => setActiveTab('master-sheet')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'master-sheet' ? 'bg-[#00AEEF] text-white shadow-lg shadow-[#00AEEF]/20' : 'hover:bg-slate-800 hover:text-white'}`}
          >
            <FileText size={20} />
            <span className="font-semibold text-sm">Master Sheet</span>
          </button>
          <button 
            onClick={() => setActiveTab('reports')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'reports' ? 'bg-[#00AEEF] text-white shadow-lg shadow-[#00AEEF]/20' : 'hover:bg-slate-800 hover:text-white'}`}
          >
            <Download size={20} />
            <span className="font-semibold text-sm">Reports</span>
          </button>
          <button 
            onClick={() => setActiveTab('data-management')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'data-management' ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'hover:bg-red-500/10 hover:text-red-500'}`}
          >
            <Trash2 size={20} />
            <span className="font-semibold text-sm">Data Management</span>
          </button>
        </nav>

        <div className="p-6 border-t border-slate-800 mt-auto">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">
            by Fawwaz Creations
          </p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64 p-8">
        <header className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-slate-900 capitalize tracking-tight">
              {activeTab === 'dashboard' ? 'Ethen Power Dashboard' : 
               activeTab === 'list' ? 'Quotations List' : 
               activeTab === 'high-value' ? 'High Value Quotations' :
               activeTab === 'below-1-lakh' ? 'Below 1 Lakh Quotations' :
               activeTab === 'customer-wise' ? 'Customer Wise Quotations' :
               activeTab === 'top-100' ? 'Top 100 Quotations' :
               activeTab === 'fos-performance' ? 'FOS Performance Tracking' :
               activeTab === 'follow-up-schedule' ? 'Follow-up Schedule' :
               activeTab === 'master-sheet' ? 'Master Asset Mapping' :
               activeTab === 'reports' ? 'Reports & Downloads' :
               'FOS Performance'}
            </h2>
            <p className="text-slate-500 text-sm mt-1">Ethen Power Solutionns Private Limited - Quotation Tracking</p>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-[#00AEEF] hover:bg-[#0096ce] text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-[#00AEEF]/20 active:scale-95"
          >
            <Plus size={20} />
            New Quotation
          </button>
          <button 
            onClick={() => setIsMasterModalOpen(true)}
            className="flex items-center gap-2 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold transition-all active:scale-95 text-sm"
          >
            <FileText size={18} />
            Master Sheet
          </button>
          <button 
            onClick={() => setIsBulkModalOpen(true)}
            className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-slate-900/20 active:scale-95 ml-4"
          >
            <FileText size={20} />
            Bulk Upload
          </button>
        </header>

        {/* Shared Filters Bar */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
            {/* LOB Filter */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">LOB Filter</label>
              <MultiSelect 
                options={[
                  'Core', 'RRA Kit', 'Bearing & Greasing', 'Controller conversion', 'Hose & Belt', 
                  'Filters', 'Coolant', 'Radiwash', 'Recon parts', 'Battery', 'CC', 
                  'Oil', 'Local Parts', 'New Engines', 'Recon Engine', 'DFK', 'RAS', 'RECD', 'DATUM', 'Service'
                ]}
                selected={lobFilter}
                onChange={setLobFilter}
                placeholder="Select LOBs..."
              />
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Status Filter</label>
              <MultiSelect 
                options={['Submitted', 'Customer Declined', 'Draft', 'Won', 'Lost']}
                selected={statusFilter}
                onChange={setStatusFilter}
                placeholder="Select Status..."
              />
            </div>

            {/* Zone Filter */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Zone Filter</label>
              <MultiSelect 
                options={['Central', 'North', 'South', 'East', 'West']}
                selected={zoneFilter}
                onChange={setZoneFilter}
                placeholder="Select Zones..."
              />
            </div>

            {/* Category Filter */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Category Filter</label>
              <MultiSelect 
                options={['AMC', 'NON - AMC', 'Non - AMC', 'Paid', 'NEPI', 'CAMC']}
                selected={categoryFilter}
                onChange={setCategoryFilter}
                placeholder="Select Categories..."
              />
            </div>

            {/* FOS Filter */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">FOS Filter</label>
              <MultiSelect 
                options={uniqueFosNames}
                selected={fosFilter}
                onChange={setFosFilter}
                placeholder="Select FOS..."
              />
            </div>

            {/* Branch Filter */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Branch Filter</label>
              <MultiSelect 
                options={uniqueBranches}
                selected={branchFilter}
                onChange={setBranchFilter}
                placeholder="Select Branch..."
              />
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-6 pt-4 border-t border-slate-100">
            <div className="flex-1 min-w-[300px]">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Quotation Created Date Range</label>
              <div className="flex items-center gap-2">
                <input 
                  type="date" 
                  className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00AEEF]/20 transition-all text-sm font-medium"
                  value={dateRange.from}
                  onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                />
                <span className="text-slate-400 font-bold">to</span>
                <input 
                  type="date" 
                  className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00AEEF]/20 transition-all text-sm font-medium"
                  value={dateRange.to}
                  onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                />
              </div>
            </div>
            <button 
              onClick={() => { 
                setLobFilter([]); 
                setStatusFilter([]);
                setZoneFilter([]);
                setCategoryFilter([]);
                setFosFilter([]);
                setBranchFilter([]);
                setDateRange({ from: '', to: '' }); 
              }}
              className="px-6 py-2 text-slate-500 hover:bg-slate-50 rounded-xl font-semibold transition-all text-sm border border-slate-200"
            >
              Reset All Filters
            </button>
          </div>
        </div>

        {activeTab === 'dashboard' ? (
          <div className="space-y-8">
            {/* Today's Follow-ups Alert */}
            {allFollowUps.filter(fu => format(fu.date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')).length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600">
                      <Clock size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900">Today's Follow-ups</h4>
                      <p className="text-xs text-slate-500 font-medium">Don't forget to check in with these customers</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setActiveTab('follow-up-schedule')}
                    className="text-xs font-bold text-amber-600 hover:underline"
                  >
                    View All
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {allFollowUps
                    .filter(fu => format(fu.date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd'))
                    .slice(0, 3)
                    .map((fu, idx) => (
                      <div key={idx} className="bg-white p-4 rounded-xl border border-amber-100 shadow-sm flex items-center justify-between">
                        <div className="flex-1">
                          <button 
                            onClick={() => setSelectedCustomer(fu.customer)}
                            className="text-xs font-bold text-slate-900 hover:text-[#00AEEF] transition-colors text-left block w-full truncate"
                            title="View all quotations for this customer"
                          >
                            {fu.customer}
                          </button>
                          <p className="text-[10px] text-slate-500 font-medium">{fu.fosName} • {fu.type}</p>
                        </div>
                        <button 
                          onClick={() => fu.type === 'Quotation' ? openEditModal(fu.original as Quotation) : handleEditVisit(fu.original as FOSVisit)}
                          className="p-2 hover:bg-amber-50 text-amber-600 rounded-lg transition-colors"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard 
                title="Total Quotations" 
                value={analytics.total} 
                icon={<FileText size={20} />} 
                color="blue"
              />
              <StatCard 
                title="Quotation Value" 
                value={`₹${analytics.totalValue.toLocaleString('en-IN')}`} 
                icon={<IndianRupee size={20} />} 
                color="green"
              />
              <StatCard 
                title="High Confidence (>=75%)" 
                value={`${analytics.highConfidenceCount} Quotes (₹${analytics.highConfidenceValue.toLocaleString('en-IN')})`} 
                icon={<ShieldCheck size={20} />} 
                color="orange"
              />
              <StatCard 
                title="High Value (>= ₹1 Lakh)" 
                value={`${analytics.highValueCount} Quotes (₹${analytics.highValueTotalValue.toLocaleString('en-IN')})`} 
                icon={<TrendingUp size={20} />} 
                color="slate"
              />
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <ChartWrapper title="LOB wise Value (₹)">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.lobData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} />
                    <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                    <Bar dataKey="value" fill="#00AEEF" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartWrapper>

              <ChartWrapper title="Status Distribution (%)">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={analytics.statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={4}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}%`}
                    >
                      {analytics.statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => [`${value}%`, 'Percentage']}
                      contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} 
                    />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              </ChartWrapper>

              <ChartWrapper title="Quotation Ageing (%)">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.ageingData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fill: '#64748b', fontSize: 11}}
                      tickFormatter={(value) => `${value}%`}
                    />
                    <Tooltip 
                      cursor={{fill: '#f1f5f9'}} 
                      formatter={(value: number) => [`${value}%`, 'Percentage']}
                      contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} 
                    />
                    <Bar dataKey="value" fill="#F7941E" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartWrapper>

              <ChartWrapper title="FOS Performance (%)">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.fosData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                    <XAxis 
                      type="number" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fill: '#64748b', fontSize: 11}}
                      tickFormatter={(value) => `${value}%`}
                    />
                    <YAxis dataKey="name" type="category" width={80} axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} />
                    <Tooltip 
                      cursor={{fill: '#f1f5f9'}} 
                      formatter={(value: number) => [`${value}%`, 'Percentage']}
                      contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} 
                    />
                    <Bar dataKey="value" fill="#8DC63F" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartWrapper>

              <ChartWrapper title="Follow-ups by FOS">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.followUpFosData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} />
                    <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                    <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartWrapper>

              <ChartWrapper title="Customer Category Value (%)">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={analytics.customerCategoryValueData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={4}
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {analytics.customerCategoryValueData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => [`₹${value.toLocaleString('en-IN')}`, 'Value']}
                      contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} 
                    />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              </ChartWrapper>

              <ChartWrapper title="Expected Month-wise Value (₹)">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.monthWiseData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fill: '#64748b', fontSize: 11}}
                      tickFormatter={(value) => `₹${(value / 100000).toFixed(1)}L`}
                    />
                    <Tooltip 
                      cursor={{fill: '#f1f5f9'}} 
                      formatter={(value: number) => [`₹${value.toLocaleString('en-IN')}`, 'Value']}
                      contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} 
                    />
                    <Bar dataKey="value" fill="#ec4899" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartWrapper>

              <ChartWrapper title="Top 5 Customers by Value (₹)">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.top100CustomerQuotes.slice(0, 5)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                    <XAxis 
                      type="number" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fill: '#64748b', fontSize: 11}}
                      tickFormatter={(value) => `₹${(value / 100000).toFixed(1)}L`}
                    />
                    <YAxis dataKey="name" type="category" width={100} axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} />
                    <Tooltip 
                      cursor={{fill: '#f1f5f9'}} 
                      formatter={(value: number) => [`₹${value.toLocaleString('en-IN')}`, 'Value']}
                      contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} 
                    />
                    <Bar dataKey="value" fill="#8DC63F" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartWrapper>

              <div className="lg:col-span-2 bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-slate-900 tracking-tight">High Value Quotations (&ge; ₹1 Lakh)</h3>
                  <span className="bg-blue-50 text-[#00AEEF] text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                    {analytics.highValueCount} Quotes
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-slate-500 text-[10px] font-bold uppercase tracking-wider border-b border-slate-100">
                        <th className="pb-4">Quote No</th>
                        <th className="pb-4">Customer</th>
                        <th className="pb-4">LOB</th>
                        <th className="pb-4">Status</th>
                        <th className="pb-4 text-right">Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {analytics.highValueQuotes.length > 0 ? (
                        analytics.highValueQuotes.map((q) => (
                          <tr key={q.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-4 text-sm font-semibold text-slate-900">{q.quoteNo}</td>
                            <td className="py-4 text-sm text-slate-600">{q.customer}</td>
                            <td className="py-4 text-xs font-medium text-slate-500">{q.lob}</td>
                            <td className="py-4">
                              <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase ${getStatusColor(q.status as any)}`}>
                                {q.status}
                              </span>
                            </td>
                            <td className="py-4 text-sm font-bold text-slate-900 text-right">₹{(q.baseAmount || 0).toLocaleString('en-IN')}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400 text-sm italic">No high value quotes found matching filters</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="mt-6 pt-6 border-t border-slate-100 text-center">
                  <button 
                    onClick={() => setActiveTab('high-value')}
                    className="text-[#00AEEF] font-bold text-sm hover:underline flex items-center gap-2 mx-auto"
                  >
                    View All High Value Quotes <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'high-value' ? (
          <div className="space-y-8">
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 tracking-tight">High Value Quotations (&ge; ₹1 Lakh)</h3>
                  <p className="text-slate-500 text-sm mt-1">Quotations with base amount of ₹1,00,000 or more</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Value</p>
                  <p className="text-2xl font-black text-[#00AEEF]">₹{analytics.highValueTotalValue.toLocaleString('en-IN')}</p>
                  <p className="text-xs font-bold text-slate-400 mt-1">{analytics.highValueCount} Quotes</p>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50/50 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                      <th className="px-6 py-4">Quote No</th>
                      <th className="px-6 py-4">Customer</th>
                      <th className="px-6 py-4">LOB</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {analytics.highValueQuotes.map((q) => (
                      <tr key={q.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-4">
                          <p className="font-semibold text-slate-900 text-sm">{q.quoteNo}</p>
                        </td>
                        <td className="px-6 py-4">
                          <button 
                            onClick={() => setSelectedCustomer(q.customer)}
                            className="font-semibold text-slate-900 text-sm hover:text-[#00AEEF] transition-colors text-left"
                            title="View all quotations for this customer"
                          >
                            {q.customer}
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-md">{q.lob}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${getStatusColor(q.status as any)}`}>
                            {q.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-slate-900 text-right">₹{(q.baseAmount || 0).toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                    {analytics.highValueQuotes.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">No high value quotes found matching filters</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : activeTab === 'below-1-lakh' ? (
          <div className="space-y-8">
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 tracking-tight">Below 1 Lakh Quotations</h3>
                  <p className="text-slate-500 text-sm mt-1">Quotations with base amount less than ₹1,00,000</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Count</p>
                  <p className="text-2xl font-black text-[#00AEEF]">{analytics.below1LakhQuotes.length}</p>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50/50 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                      <th className="px-6 py-4">Quote No</th>
                      <th className="px-6 py-4">Customer</th>
                      <th className="px-6 py-4">LOB</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {analytics.below1LakhQuotes.map((q) => (
                      <tr key={q.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-4">
                          <p className="font-semibold text-slate-900 text-sm">{q.quoteNo}</p>
                        </td>
                        <td className="px-6 py-4">
                          <button 
                            onClick={() => setSelectedCustomer(q.customer)}
                            className="font-semibold text-slate-900 text-sm hover:text-[#00AEEF] transition-colors text-left"
                            title="View all quotations for this customer"
                          >
                            {q.customer}
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-md">{q.lob}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${getStatusColor(q.status as any)}`}>
                            {q.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-slate-900 text-right">₹{(q.baseAmount || 0).toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : activeTab === 'customer-wise' ? (
          <div className="space-y-8">
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900 tracking-tight">Quotations Grouped by Customer</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Total Customers: {Object.keys(analytics.customerWiseValue).length}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50/50 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                      <th className="px-6 py-4">Customer Name</th>
                      <th className="px-6 py-4">Quote Count</th>
                      <th className="px-6 py-4 text-right">Total Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {Object.entries(
                      filteredQuotations.reduce((acc, q) => {
                        if (!acc[q.customer]) acc[q.customer] = { count: 0, value: 0 };
                        acc[q.customer].count++;
                        acc[q.customer].value += (q.baseAmount || 0);
                        return acc;
                      }, {} as Record<string, { count: number, value: number }>)
                    )
                    .sort((a, b) => (b[1] as { value: number }).value - (a[1] as { value: number }).value)
                    .map(([customer, data]) => {
                      const d = data as { count: number, value: number };
                      return (
                        <tr 
                          key={customer} 
                          className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                          onClick={() => setSelectedCustomer(customer)}
                        >
                          <td className="px-6 py-4">
                            <p className="font-semibold text-slate-900 text-sm group-hover:text-[#00AEEF] transition-colors">{customer}</p>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-md">
                              {d.count} Quotes
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm font-bold text-slate-900 text-right">
                            ₹{d.value.toLocaleString('en-IN')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : activeTab === 'top-100' ? (
          <div className="space-y-8">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                  <TrendingUp size={20} className="text-[#00AEEF]" />
                  Top 100 Value-wise
                </h3>
                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                  {analytics.top100ValueQuotes.map((q, i) => (
                    <div 
                      key={q.id} 
                      className="flex items-center justify-between p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors group"
                      onClick={() => setSelectedCustomer(q.customer)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-slate-400 w-6">#{i+1}</span>
                        <div>
                          <p className="text-sm font-bold text-slate-900 group-hover:text-[#00AEEF] transition-colors">{q.customer}</p>
                          <p className="text-[10px] text-slate-500">{q.quoteNo}</p>
                        </div>
                      </div>
                      <p className="text-sm font-black text-[#00AEEF]">₹{(q.baseAmount || 0).toLocaleString('en-IN')}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                  <TrendingUp size={20} className="text-[#8DC63F]" />
                  Top 100 Customer-wise
                </h3>
                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                  {analytics.top100CustomerQuotes.map((c, i) => (
                    <div 
                      key={c.name} 
                      className="flex items-center justify-between p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors group"
                      onClick={() => setSelectedCustomer(c.name)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-slate-400 w-6">#{i+1}</span>
                        <p className="text-sm font-bold text-slate-900 group-hover:text-[#00AEEF] transition-colors">{c.name}</p>
                      </div>
                      <p className="text-sm font-black text-[#8DC63F]">₹{c.value.toLocaleString('en-IN')}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                  <Clock size={20} className="text-[#F7941E]" />
                  Top 100 Ageing-wise
                </h3>
                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                  {analytics.top100AgeingQuotes.map((q, i) => {
                    const days = q.createdAt ? differenceInDays(new Date(), q.createdAt.toDate()) : 0;
                    return (
                      <div 
                        key={q.id} 
                        className="flex items-center justify-between p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors group"
                        onClick={() => setSelectedCustomer(q.customer)}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold text-slate-400 w-6">#{i+1}</span>
                          <div>
                            <p className="text-sm font-bold text-slate-900 group-hover:text-[#F7941E] transition-colors">{q.customer}</p>
                            <p className="text-[10px] text-slate-500">{q.quoteNo}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-[#F7941E]">{days} Days</p>
                          <p className="text-[10px] text-slate-500">₹{(q.baseAmount || 0).toLocaleString('en-IN')}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'fos-performance' ? (
          <div className="space-y-8">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsFosModalOpen(true)}
                className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg active:scale-95"
              >
                <Plus size={20} />
                Add FOS Details
              </button>
              <button 
                onClick={() => setIsVisitModalOpen(true)}
                className="bg-[#00AEEF] hover:bg-[#0096ce] text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg active:scale-95"
              >
                <Calendar size={20} />
                Plan New Visit
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-fit">
                <h3 className="text-lg font-bold text-slate-900 mb-6">FOS Team</h3>
                <div className="space-y-4">
                  {fosList.map(fos => {
                    const fosVisits = visits.filter(v => v.fosId === fos.id);
                    const completed = fosVisits.filter(v => v.status === 'Completed').length;
                    const business = fosVisits.reduce((sum, v) => sum + (v.businessGenerated || 0), 0);
                    return (
                      <div key={fos.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-bold text-slate-900">{fos.name}</p>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{fos.employeeId}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mt-4">
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Visits</p>
                            <p className="text-sm font-bold text-slate-700">{completed} / {fosVisits.length}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Business</p>
                            <p className="text-sm font-bold text-[#8DC63F]">₹{business.toLocaleString('en-IN')}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 mb-6">Visit Plan vs Achievement</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-slate-500 text-[10px] font-bold uppercase tracking-wider border-b border-slate-100">
                        <th className="pb-4">Planned Date</th>
                        <th className="pb-4">FOS Name</th>
                        <th className="pb-4">Customer</th>
                        <th className="pb-4">Status</th>
                        <th className="pb-4 text-right">Business</th>
                        <th className="pb-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {visits.map(visit => (
                        <tr key={visit.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-4 text-sm text-slate-600">{visit.plannedDate ? format(visit.plannedDate.toDate(), 'dd MMM yyyy') : '-'}</td>
                          <td className="py-4 text-sm font-semibold text-slate-900">{visit.fosName}</td>
                          <td className="py-4">
                            <button 
                              onClick={() => setSelectedCustomer(visit.customerName)}
                              className="text-sm font-medium text-slate-600 hover:text-[#00AEEF] transition-colors text-left"
                              title="View all quotations for this customer"
                            >
                              {visit.customerName}
                            </button>
                          </td>
                          <td className="py-4">
                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase ${
                              visit.status === 'Completed' ? 'bg-green-100 text-green-600' : 
                              visit.status === 'Cancelled' ? 'bg-red-100 text-red-600' : 
                              'bg-blue-100 text-blue-600'
                            }`}>
                              {visit.status}
                            </span>
                          </td>
                          <td className="py-4 text-sm font-bold text-slate-900 text-right">₹{(visit.businessGenerated || 0).toLocaleString('en-IN')}</td>
                          <td className="py-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button 
                                onClick={() => handleEditVisit(visit)}
                                className="p-2 text-slate-400 hover:text-[#00AEEF] hover:bg-[#00AEEF]/5 rounded-lg transition-all"
                                title="Update Visit"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button 
                                onClick={() => setVisitToDelete(visit.id!)}
                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                title="Delete Visit"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'follow-up-schedule' ? (
          <div className="space-y-8">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 tracking-tight">Follow-up Schedule</h3>
                  <p className="text-slate-500 text-sm font-medium">Daily schedule for FOS follow-ups</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="bg-amber-50 text-amber-600 px-4 py-2 rounded-xl border border-amber-100 flex items-center gap-2">
                    <Clock size={16} />
                    <span className="text-xs font-bold uppercase tracking-wider">Today: {format(new Date(), 'dd MMM yyyy')}</span>
                  </div>
                </div>
              </div>
              
              <div className="p-8">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-slate-500 text-[10px] font-bold uppercase tracking-wider border-b border-slate-100">
                        <th className="pb-4">Follow-up Date</th>
                        <th className="pb-4">FOS Name</th>
                        <th className="pb-4">Customer</th>
                        <th className="pb-4">Type</th>
                        <th className="pb-4">Reference</th>
                        <th className="pb-4 text-right">Value</th>
                        <th className="pb-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {allFollowUps.map((fu, idx) => {
                        const isToday = format(fu.date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                        const isPast = fu.date < new Date(new Date().setHours(0,0,0,0));
                        
                        return (
                          <tr key={`${fu.id}-${idx}`} className={`hover:bg-slate-50/50 transition-colors ${isToday ? 'bg-amber-50/30' : ''}`}>
                            <td className="py-4">
                              <div className="flex flex-col">
                                <span className={`text-sm font-bold ${isPast ? 'text-red-500' : isToday ? 'text-amber-600' : 'text-slate-900'}`}>
                                  {format(fu.date, 'dd MMM yyyy')}
                                </span>
                                {isToday && <span className="text-[10px] font-bold text-amber-500 uppercase">Today</span>}
                                {isPast && <span className="text-[10px] font-bold text-red-400 uppercase">Overdue</span>}
                              </div>
                            </td>
                            <td className="py-4 text-sm font-semibold text-slate-900">{fu.fosName}</td>
                            <td className="py-4">
                              <button 
                                onClick={() => setSelectedCustomer(fu.customer)}
                                className="text-sm font-medium text-slate-600 hover:text-[#00AEEF] transition-colors text-left"
                                title="View all quotations for this customer"
                              >
                                {fu.customer}
                              </button>
                            </td>
                            <td className="py-4">
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                                fu.type === 'Quotation' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'
                              }`}>
                                {fu.type}
                              </span>
                            </td>
                            <td className="py-4 text-sm font-mono text-slate-500">{fu.reference}</td>
                            <td className="py-4 text-sm font-bold text-slate-900 text-right">
                              {fu.value > 0 ? `₹${fu.value.toLocaleString('en-IN')}` : '-'}
                            </td>
                            <td className="py-4 text-right">
                              <div className="flex items-center justify-end gap-1">
                                {fu.type === 'Quotation' ? (
                                  <>
                                    <button 
                                      onClick={() => openEditModal(fu.original as Quotation)}
                                      className="p-2 text-[#00AEEF] hover:bg-[#00AEEF]/10 rounded-lg transition-all"
                                      title="Update Quote"
                                    >
                                      <Edit2 size={16} />
                                    </button>
                                    <button 
                                      onClick={() => handleDelete(fu.id!)}
                                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                      title="Delete Quote"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button 
                                      onClick={() => handleEditVisit(fu.original as FOSVisit)}
                                      className="p-2 text-purple-500 hover:bg-purple-50 rounded-lg transition-all"
                                      title="Update Visit"
                                    >
                                      <Edit2 size={16} />
                                    </button>
                                    <button 
                                      onClick={() => setVisitToDelete(fu.id!)}
                                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                      title="Delete Visit"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {allFollowUps.length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-slate-400 italic">
                            No follow-ups scheduled at the moment.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'reports' ? (
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm overflow-hidden relative">
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#00AEEF]/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
              
              <div className="relative">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-14 h-14 bg-[#00AEEF]/10 rounded-2xl flex items-center justify-center text-[#00AEEF]">
                    <Download size={28} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900">Download Quotes Report</h3>
                    <p className="text-slate-500 font-medium">Select a date range to export your quotation data to CSV.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest">From Date</label>
                    <div className="relative group">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#00AEEF] transition-colors" size={20} />
                      <input 
                        type="date" 
                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-[#00AEEF]/10 focus:border-[#00AEEF] transition-all font-bold text-slate-900"
                        value={reportDateRange.from}
                        onChange={(e) => setReportDateRange({ ...reportDateRange, from: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest">To Date</label>
                    <div className="relative group">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#00AEEF] transition-colors" size={20} />
                      <input 
                        type="date" 
                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-[#00AEEF]/10 focus:border-[#00AEEF] transition-all font-bold text-slate-900"
                        value={reportDateRange.to}
                        onChange={(e) => setReportDateRange({ ...reportDateRange, to: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col md:flex-row items-center justify-between gap-6 p-6 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 shadow-sm">
                      <FileText size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">
                        {quotations.filter(q => {
                          if (!q.quoteLineCreatedDate) return false;
                          const qDate = q.quoteLineCreatedDate.toDate();
                          const from = reportDateRange.from ? new Date(reportDateRange.from) : null;
                          const to = reportDateRange.to ? new Date(reportDateRange.to) : null;
                          if (from && qDate < from) return false;
                          if (to) {
                            const endDay = new Date(to);
                            endDay.setHours(23, 59, 59, 999);
                            if (qDate > endDay) return false;
                          }
                          return true;
                        }).length} Quotes Selected
                      </p>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Ready for export</p>
                    </div>
                  </div>
                  <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
                    <button 
                      onClick={handleDownloadReport}
                      className="flex-1 md:flex-none px-8 py-4 bg-[#00AEEF] hover:bg-[#0096ce] text-white rounded-2xl font-bold flex items-center justify-center gap-3 transition-all shadow-xl shadow-[#00AEEF]/20 active:scale-95"
                    >
                      <Download size={20} />
                      Quotes Report
                    </button>
                    <button 
                      onClick={handleDownloadConfidenceReport}
                      className="flex-1 md:flex-none px-8 py-4 bg-[#8DC63F] hover:bg-[#7eb138] text-white rounded-2xl font-bold flex items-center justify-center gap-3 transition-all shadow-xl shadow-[#8DC63F]/20 active:scale-95"
                    >
                      <TrendingUp size={20} />
                      Confidence History
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Confidence Analysis Section */}
            <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-14 h-14 bg-[#8DC63F]/10 rounded-2xl flex items-center justify-center text-[#8DC63F]">
                  <TrendingUp size={28} />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-slate-900">Confidence Analysis</h3>
                  <p className="text-slate-500 font-medium">Tracking how confidence levels moved in the selected period.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Changes</p>
                  <p className="text-2xl font-bold text-slate-900">{confidenceAnalysis.totalChanges}</p>
                </div>
                <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-100">
                  <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Upward Moves</p>
                  <p className="text-2xl font-bold text-emerald-700">+{confidenceAnalysis.positiveChanges}</p>
                </div>
                <div className="p-6 bg-rose-50 rounded-2xl border border-rose-100">
                  <p className="text-[10px] font-bold text-rose-600 uppercase tracking-widest mb-1">Downward Moves</p>
                  <p className="text-2xl font-bold text-rose-700">-{confidenceAnalysis.negativeChanges}</p>
                </div>
                <div className="p-6 bg-blue-50 rounded-2xl border border-blue-100">
                  <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-1">Avg. Change</p>
                  <p className="text-2xl font-bold text-blue-700">{confidenceAnalysis.avgChange}%</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Report Format</p>
                <p className="text-sm font-bold text-slate-900">CSV (Excel Compatible)</p>
              </div>
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Data Source</p>
                <p className="text-sm font-bold text-slate-900">Live Quotations Data</p>
              </div>
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Last Updated</p>
                <p className="text-sm font-bold text-slate-900">{format(new Date(), 'dd MMM, HH:mm')}</p>
              </div>
            </div>
          </div>
        ) : activeTab === 'data-management' ? (
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm overflow-hidden relative">
              <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
              
              <div className="relative">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-14 h-14 bg-red-500/10 rounded-2xl flex items-center justify-center text-red-500">
                    <Trash2 size={28} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900">Data Management</h3>
                    <p className="text-slate-500 font-medium">Carefully manage and clear your application data.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Quotations Cleanup */}
                  <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-[#00AEEF] shadow-sm">
                          <FileText size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">Quotations</p>
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{quotations.length} Records</p>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">Delete all quotation records from the database. This action is permanent.</p>
                    <button 
                      onClick={() => handleDeleteAllData('quotations', 'Quotations')}
                      disabled={isDeletingAll || quotations.length === 0}
                      className="w-full py-3 bg-white hover:bg-red-50 text-red-500 border border-red-100 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Trash2 size={16} />
                      Clear All Quotations
                    </button>
                  </div>

                  {/* FOS Cleanup */}
                  <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-orange-500 shadow-sm">
                          <Zap size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">FOS List</p>
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{fosList.length} Records</p>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">Remove all Field Officers from the system. This will affect existing assignments.</p>
                    <button 
                      onClick={() => handleDeleteAllData('fos', 'FOS Records')}
                      disabled={isDeletingAll || fosList.length === 0}
                      className="w-full py-3 bg-white hover:bg-red-50 text-red-500 border border-red-100 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Trash2 size={16} />
                      Clear All FOS
                    </button>
                  </div>

                  {/* Visits Cleanup */}
                  <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-purple-500 shadow-sm">
                          <Calendar size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">FOS Visits</p>
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{visits.length} Records</p>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">Delete all planned and completed visit records from the database.</p>
                    <button 
                      onClick={() => handleDeleteAllData('visits', 'Visit Records')}
                      disabled={isDeletingAll || visits.length === 0}
                      className="w-full py-3 bg-white hover:bg-red-50 text-red-500 border border-red-100 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Trash2 size={16} />
                      Clear All Visits
                    </button>
                  </div>

                  {/* Master Assets Cleanup */}
                  <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-green-500 shadow-sm">
                          <ShieldCheck size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">Master Assets</p>
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{masterAssets.length} Records</p>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">Wipe the master asset mapping table. This will remove all asset-to-customer links.</p>
                    <button 
                      onClick={() => handleDeleteAllData('masterAssets', 'Master Assets')}
                      disabled={isDeletingAll || masterAssets.length === 0}
                      className="w-full py-3 bg-white hover:bg-red-50 text-red-500 border border-red-100 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Trash2 size={16} />
                      Clear Master Assets
                    </button>
                  </div>
                </div>

                <div className="mt-10 p-6 bg-red-50 rounded-2xl border border-red-100">
                  <div className="flex gap-4">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600 shrink-0">
                      <AlertCircle size={24} />
                    </div>
                    <div>
                      <h4 className="text-red-900 font-bold mb-1">Danger Zone</h4>
                      <p className="text-red-700 text-sm leading-relaxed mb-4">
                        Deleting data from this panel will remove it permanently from the Firestore database. 
                        Make sure you have exported a backup from the <strong>Reports</strong> tab before proceeding.
                      </p>
                      <div className="flex gap-4">
                        <button 
                          onClick={() => handleDeleteAllData('all', 'Database Records')}
                          className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-sm transition-all shadow-lg shadow-red-600/20"
                        >
                          Wipe Entire Database
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'master-sheet' ? (
          <div className="space-y-8">
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="relative w-full max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="text" 
                      placeholder="Search asset no. or category..." 
                      className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00AEEF]/20 transition-all text-sm font-medium"
                      value={masterSearchTerm}
                      onChange={(e) => setMasterSearchTerm(e.target.value)}
                    />
                  </div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Showing {masterAssets.filter(m => 
                      m.assetNo.toLowerCase().includes(masterSearchTerm.toLowerCase()) || 
                      m.category.toLowerCase().includes(masterSearchTerm.toLowerCase())
                    ).length} of {masterAssets.length} mappings
                  </p>
                </div>
                <button 
                  onClick={() => setIsMasterModalOpen(true)}
                  className="bg-[#00AEEF] hover:bg-[#0096ce] text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-all text-sm"
                >
                  <Plus size={16} />
                  Add Mapping
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50/50 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                      <th className="px-6 py-4">Asset Number</th>
                      <th className="px-6 py-4">Category</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {masterAssets
                      .filter(m => 
                        m.assetNo.toLowerCase().includes(masterSearchTerm.toLowerCase()) || 
                        m.category.toLowerCase().includes(masterSearchTerm.toLowerCase())
                      )
                      .map((m) => (
                        <tr key={m.id} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="px-6 py-4">
                            <p className="font-semibold text-slate-900 text-sm">{m.assetNo}</p>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md">{m.category}</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button 
                              onClick={() => setMasterAssetToDelete(m.id)}
                              className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    {masterAssets.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-6 py-12 text-center text-slate-400 italic">
                          No master asset mappings found. Upload a master sheet to get started.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : activeTab === 'list' ? (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative w-full max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Search customer, FOS, or category..." 
                  className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00AEEF]/20 transition-all text-sm font-medium"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Showing {filteredQuotations.length} of {quotations.length} quotes
              </p>
            </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/50 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                    <th className="px-6 py-4">Quote No</th>
                    <th className="px-6 py-4">Account</th>
                    <th className="px-6 py-4">Category</th>
                    <th className="px-6 py-4">LOB</th>
                    <th className="px-6 py-4">Base Amount</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Zone</th>
                    <th className="px-6 py-4">FOS Name</th>
                    <th className="px-6 py-4">Expected Month</th>
                    <th className="px-6 py-4">Confidence</th>
                    <th className="px-6 py-4">Ageing</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredQuotations.map((q) => (
                    <tr key={q.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div>
                            <p className="font-semibold text-slate-900 text-sm">{q.quoteNo}</p>
                            <p className="text-[10px] font-medium text-slate-400 mt-0.5">{q.opportunityNumber}</p>
                          </div>
                          {(!q.asset || q.asset === 'NTUPT') && (
                            <div 
                              className="flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-600 rounded-md border border-amber-100 cursor-help group/warning relative"
                              title="Missing Asset No. - Update Category"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditModal(q);
                              }}
                            >
                              <AlertCircle size={12} />
                              <span className="text-[9px] font-bold uppercase">No Asset</span>
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 text-white text-[10px] rounded opacity-0 group-hover/warning:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                                Click to update customer category
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-semibold text-slate-900 text-sm">{q.account}</p>
                        <button 
                          onClick={() => setSelectedCustomer(q.customer)}
                          className="text-[10px] font-medium text-slate-400 hover:text-[#00AEEF] transition-colors mt-0.5"
                          title="View all quotations for this customer"
                        >
                          {q.customer}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md">{q.customerCategory}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-md">{q.lob}</span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-bold text-slate-900 text-sm">₹{(q.baseAmount || 0).toLocaleString('en-IN')}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${getStatusColor(q.status as any)}`}>
                          {q.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs font-semibold text-slate-600">{q.zone}</td>
                      <td className="px-6 py-4 text-xs font-semibold text-slate-600">{q.fosName}</td>
                      <td className="px-6 py-4">
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md">
                          {formatExpectedMonth(q.expectedMonth)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${getConfidenceColor(q.confidence as any)}`}>
                          {q.confidence}%
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          <div className={`w-1.5 h-1.5 rounded-full ${getAgeingColor(q.createdAt ? differenceInDays(new Date(), q.createdAt.toDate()) : 0)}`} />
                          <span className="text-xs font-semibold text-slate-600">
                            {q.createdAt ? `${differenceInDays(new Date(), q.createdAt.toDate())}d` : '-'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                          <button 
                            onClick={() => setHistoryQuotation(q)}
                            className="p-2 hover:bg-amber-50 text-amber-600 rounded-lg transition-colors"
                            title="Confidence History"
                          >
                            <History size={16} />
                          </button>
                          <button 
                            onClick={() => openEditModal(q)}
                            className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={() => q.id && handleDelete(q.id)}
                            className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </main>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden border border-slate-200"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 tracking-tight">{editingQuotation ? 'Edit Quotation' : 'New Quotation'}</h3>
                  <p className="text-slate-500 text-xs mt-1">Fill in the details to track your deal.</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 flex items-center justify-center bg-white rounded-xl text-slate-400 hover:text-[#00AEEF] shadow-sm border border-slate-100 transition-all active:scale-90">
                  <Plus className="rotate-45" size={24} />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-8">
                {(!formData.asset || formData.asset === 'NTUPT') && (
                  <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-3 animate-pulse">
                    <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600 shrink-0">
                      <AlertCircle size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-amber-900">Missing Asset Number</p>
                      <p className="text-xs text-amber-700 mt-0.5 font-medium">Please ensure the Customer Category is correctly updated for this quotation.</p>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Quote No.</label>
                    <input 
                      required
                      type="text" 
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00AEEF]/20 outline-none font-semibold text-slate-900 transition-all text-sm"
                      value={formData.quoteNo}
                      onChange={(e) => setFormData({ ...formData, quoteNo: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Opportunity Number</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00AEEF]/20 outline-none font-semibold text-slate-900 transition-all text-sm"
                      value={formData.opportunityNumber}
                      onChange={(e) => setFormData({ ...formData, opportunityNumber: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Quote Line: Created Date</label>
                    <input 
                      required
                      type="date" 
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00AEEF]/20 outline-none font-semibold text-slate-900 transition-all text-sm"
                      value={formData.quoteLineCreatedDate}
                      onChange={(e) => setFormData({ ...formData, quoteLineCreatedDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Account</label>
                    <input 
                      required
                      type="text" 
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00AEEF]/20 outline-none font-semibold text-slate-900 transition-all text-sm"
                      value={formData.account}
                      onChange={(e) => setFormData({ ...formData, account: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Item</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00AEEF]/20 outline-none font-semibold text-slate-900 transition-all text-sm"
                      value={formData.item}
                      onChange={(e) => setFormData({ ...formData, item: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Item Description</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00AEEF]/20 outline-none font-semibold text-slate-900 transition-all text-sm"
                      value={formData.itemDescription}
                      onChange={(e) => setFormData({ ...formData, itemDescription: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Quantity</label>
                    <input 
                      required
                      type="number" 
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00AEEF]/20 outline-none font-semibold text-slate-900 transition-all text-sm"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Unit Price</label>
                    <input 
                      required
                      type="number" 
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00AEEF]/20 outline-none font-semibold text-slate-900 transition-all text-sm"
                      value={formData.unitPrice}
                      onChange={(e) => setFormData({ ...formData, unitPrice: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Status</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00AEEF]/20 outline-none font-semibold text-slate-900 transition-all text-sm"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Sale Order</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00AEEF]/20 outline-none font-semibold text-slate-900 transition-all text-sm"
                      value={formData.saleOrder}
                      onChange={(e) => setFormData({ ...formData, saleOrder: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Branch</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00AEEF]/20 outline-none font-semibold text-slate-900 transition-all text-sm"
                      value={formData.branch}
                      onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Created By</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00AEEF]/20 outline-none font-semibold text-slate-900 transition-all text-sm"
                      value={formData.quoteLineCreatedBy}
                      onChange={(e) => setFormData({ ...formData, quoteLineCreatedBy: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Remarks</label>
                    <textarea 
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00AEEF]/20 outline-none font-semibold text-slate-900 transition-all text-sm"
                      value={formData.remarks}
                      onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Asset</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00AEEF]/20 outline-none font-semibold text-slate-900 transition-all text-sm"
                      value={formData.asset}
                      onChange={(e) => {
                        const val = e.target.value;
                        const match = masterAssets.find(m => m.assetNo === val);
                        if (match) {
                          setFormData({ ...formData, asset: val, customerCategory: match.category as any });
                        } else {
                          setFormData({ ...formData, asset: val });
                        }
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">FOS Name</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00AEEF]/20 outline-none font-semibold text-slate-900 transition-all text-sm"
                      value={formData.fosName}
                      onChange={(e) => setFormData({ ...formData, fosName: e.target.value })}
                    />
                  </div>
                  <div className="lg:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Billing Address</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00AEEF]/20 outline-none font-semibold text-slate-900 transition-all text-sm"
                      value={formData.billingAddress}
                      onChange={(e) => setFormData({ ...formData, billingAddress: e.target.value })}
                    />
                  </div>
                  <div className="lg:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Shipping Address</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00AEEF]/20 outline-none font-semibold text-slate-900 transition-all text-sm"
                      value={formData.shippingAddress}
                      onChange={(e) => setFormData({ ...formData, shippingAddress: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Zone</label>
                    <select 
                      required
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00AEEF]/20 outline-none font-semibold text-slate-900 transition-all text-sm appearance-none"
                      value={formData.zone}
                      onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                    >
                      <option value="East">East</option>
                      <option value="West">West</option>
                      <option value="North">North</option>
                      <option value="South">South</option>
                      <option value="Central">Central</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Customer</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00AEEF]/20 outline-none font-semibold text-slate-900 transition-all text-sm"
                      value={formData.customer}
                      onChange={(e) => setFormData({ ...formData, customer: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Confidence (%)</label>
                    <select 
                      required
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00AEEF]/20 outline-none font-semibold text-slate-900 transition-all text-sm appearance-none"
                      value={formData.confidence}
                      onChange={(e) => setFormData({ ...formData, confidence: Number(e.target.value) })}
                    >
                      <option value="0">0%</option>
                      <option value="10">10%</option>
                      <option value="20">20%</option>
                      <option value="25">25%</option>
                      <option value="30">30%</option>
                      <option value="40">40%</option>
                      <option value="50">50%</option>
                      <option value="60">60%</option>
                      <option value="70">70%</option>
                      <option value="75">75%</option>
                      <option value="80">80%</option>
                      <option value="90">90%</option>
                      <option value="100">100%</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Visit Date</label>
                    <input 
                      type="date" 
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00AEEF]/20 outline-none font-semibold text-slate-900 transition-all text-sm"
                      value={formData.visitDate}
                      onChange={(e) => setFormData({ ...formData, visitDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Visit Outcome</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00AEEF]/20 outline-none font-semibold text-slate-900 transition-all text-sm"
                      value={formData.visitOutcome}
                      onChange={(e) => setFormData({ ...formData, visitOutcome: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Follow up Date</label>
                    <input 
                      type="date" 
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00AEEF]/20 outline-none font-semibold text-slate-900 transition-all text-sm"
                      value={formData.followUpDate}
                      onChange={(e) => setFormData({ ...formData, followUpDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Expected Month</label>
                    <input 
                      required
                      type="month" 
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00AEEF]/20 outline-none font-semibold text-slate-900 transition-all text-sm"
                      value={formData.expectedMonth}
                      onChange={(e) => setFormData({ ...formData, expectedMonth: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={`block text-[10px] font-bold uppercase tracking-wider mb-2 ${(!formData.asset || formData.asset === 'NTUPT') ? 'text-amber-600' : 'text-slate-400'}`}>
                      Customer Category {(!formData.asset || formData.asset === 'NTUPT') && ' (Required Update)'}
                    </label>
                    <select 
                      required
                      className={`w-full px-4 py-2.5 rounded-xl focus:ring-2 outline-none font-semibold transition-all text-sm appearance-none ${
                        (!formData.asset || formData.asset === 'NTUPT') 
                          ? 'bg-amber-50 border-2 border-amber-200 focus:ring-amber-200 text-amber-900' 
                          : 'bg-slate-50 border border-slate-200 focus:ring-[#00AEEF]/20 text-slate-900'
                      }`}
                      value={formData.customerCategory}
                      onChange={(e) => setFormData({ ...formData, customerCategory: e.target.value as Quotation['customerCategory'] })}
                    >
                      <option value="AMC">AMC</option>
                      <option value="NON - AMC">NON - AMC</option>
                      <option value="Non - AMC">Non - AMC</option>
                      <option value="Paid">Paid</option>
                      <option value="NEPI">NEPI</option>
                      <option value="CAMC">CAMC</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">LOB (Line of Business)</label>
                    <select 
                      required
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00AEEF]/20 outline-none font-semibold text-slate-900 transition-all text-sm appearance-none"
                      value={formData.lob}
                      onChange={(e) => setFormData({ ...formData, lob: e.target.value as Quotation['lob'] })}
                    >
                      <option value="Core">Core</option>
                      <option value="RRA Kit">RRA Kit</option>
                      <option value="Bearing & Greasing">Bearing & Greasing</option>
                      <option value="Controller conversion">Controller conversion</option>
                      <option value="Hose & Belt">Hose & Belt</option>
                      <option value="Filters">Filters</option>
                      <option value="Coolant">Coolant</option>
                      <option value="Radiwash">Radiwash</option>
                      <option value="Recon parts">Recon parts</option>
                      <option value="Battery">Battery</option>
                      <option value="CC">CC</option>
                      <option value="Oil">Oil</option>
                      <option value="Local Parts">Local Parts</option>
                      <option value="New Engines">New Engines</option>
                      <option value="Recon Engine">Recon Engine</option>
                      <option value="DFK">DFK</option>
                      <option value="RAS">RAS</option>
                      <option value="RECD">RECD</option>
                      <option value="DATUM">DATUM</option>
                      <option value="Service">Service</option>
                    </select>
                  </div>
                  <div className="lg:col-span-3">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Remarks</label>
                    <textarea 
                      rows={3}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00AEEF]/20 outline-none font-semibold text-slate-900 transition-all text-sm"
                      value={formData.remarks}
                      onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                    />
                  </div>
                </div>
                <div className="pt-6 border-t border-slate-100 flex justify-end gap-3 sticky bottom-0 bg-white pb-2 shrink-0">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-6 py-2.5 text-slate-500 hover:bg-slate-50 rounded-xl font-semibold transition-all text-sm"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="px-8 py-2.5 bg-[#00AEEF] hover:bg-[#0096ce] text-white rounded-xl font-bold transition-all shadow-lg shadow-[#00AEEF]/20 active:scale-95 text-sm"
                  >
                    {editingQuotation ? 'Update Quotation' : 'Create Quotation'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Master Sheet Modal */}
      <AnimatePresence>
        {isMasterModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMasterModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200"
            >
              <div className="p-8 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-[#00AEEF]/10 rounded-2xl flex items-center justify-center text-[#00AEEF]">
                      <FileText size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 tracking-tight">Upload Master Sheet</h3>
                      <p className="text-slate-500 text-sm mt-1">Map Asset No. to Customer Category</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsMasterModalOpen(false)}
                    className="w-10 h-10 flex items-center justify-center bg-white rounded-xl text-slate-400 hover:text-red-500 shadow-sm border border-slate-100 transition-all active:scale-90"
                  >
                    ×
                  </button>
                </div>
              </div>
              
              <form onSubmit={handleMasterUpload} className="p-8">
                <div className="mb-8">
                  <div className="border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center hover:border-[#00AEEF]/50 transition-colors bg-slate-50/50 relative group">
                    <input 
                      type="file" 
                      accept=".csv"
                      onChange={(e) => setMasterFile(e.target.files?.[0] || null)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className="flex flex-col items-center">
                      <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-slate-400 mb-4 shadow-sm group-hover:scale-110 transition-transform">
                        <Plus size={32} />
                      </div>
                      <p className="text-slate-900 font-bold">{masterFile ? masterFile.name : 'Choose CSV File'}</p>
                      <p className="text-slate-400 text-xs mt-1">Columns: Asset No., Category</p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button 
                    type="button"
                    onClick={() => {
                      const headers = ['Asset No.', 'Category'];
                      const exampleRow = ['ASSET-001', 'AMC'];
                      const csvContent = headers.join(',') + '\n' + exampleRow.join(',');
                      const blob = new Blob([csvContent], { type: 'text/csv' });
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'master_asset_template.csv';
                      a.click();
                      window.URL.revokeObjectURL(url);
                    }}
                    className="flex-1 px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold transition-all active:scale-95 text-sm"
                  >
                    Template
                  </button>
                  <button 
                    type="submit"
                    disabled={!masterFile || isUploading}
                    className="flex-[2] px-6 py-4 bg-[#00AEEF] hover:bg-[#0096ce] text-white rounded-2xl font-bold transition-all shadow-lg shadow-[#00AEEF]/20 active:scale-95 text-sm disabled:opacity-50"
                  >
                    {isUploading ? 'Uploading...' : 'Upload Mapping'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bulk Upload Modal */}
      <AnimatePresence>
        {isBulkModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsBulkModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 tracking-tight">Bulk Upload</h3>
                  <p className="text-slate-500 text-xs mt-1">Upload multiple quotations via CSV.</p>
                </div>
                <button onClick={() => setIsBulkModalOpen(false)} className="w-10 h-10 flex items-center justify-center bg-white rounded-xl text-slate-400 hover:text-[#00AEEF] shadow-sm border border-slate-100 transition-all active:scale-90">
                  <Plus className="rotate-45" size={24} />
                </button>
              </div>
              <form onSubmit={handleBulkUpload} className="p-6 space-y-6">
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                    <p className="text-xs text-blue-700 font-medium leading-relaxed">
                      Please use the CSV template for correct formatting. Date format should be YYYY-MM-DD.
                    </p>
                    <button 
                      type="button"
                      onClick={downloadTemplate}
                      className="mt-3 text-xs font-bold text-[#00AEEF] hover:underline flex items-center gap-1"
                    >
                      Download Template CSV
                    </button>
                  </div>
                  
                  <div className="relative border-2 border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center hover:border-[#00AEEF]/50 transition-colors group cursor-pointer">
                    <input 
                      type="file" 
                      accept=".csv"
                      onChange={(e) => setBulkFile(e.target.files?.[0] || null)}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:text-[#00AEEF] transition-colors mb-3">
                      <Plus size={24} />
                    </div>
                    <p className="text-sm font-bold text-slate-900">{bulkFile ? bulkFile.name : 'Select CSV File'}</p>
                    <p className="text-[10px] text-slate-400 font-medium mt-1">or drag and drop here</p>
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsBulkModalOpen(false)}
                    className="px-6 py-2.5 text-slate-500 hover:bg-slate-50 rounded-xl font-semibold transition-all text-sm"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={!bulkFile || isUploading}
                    className="px-8 py-2.5 bg-[#00AEEF] hover:bg-[#0096ce] text-white rounded-xl font-bold transition-all shadow-lg shadow-[#00AEEF]/20 active:scale-95 text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isUploading ? 'Uploading...' : 'Start Upload'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FOS Modal */}
      <AnimatePresence>
        {isFosModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsFosModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 tracking-tight">Add FOS Details</h3>
                  <p className="text-slate-500 text-xs mt-1">Register a new Field Officer Sales member.</p>
                </div>
                <button onClick={() => setIsFosModalOpen(false)} className="w-10 h-10 flex items-center justify-center bg-white rounded-xl text-slate-400 hover:text-[#00AEEF] shadow-sm border border-slate-100 transition-all active:scale-90">
                  <Plus className="rotate-45" size={24} />
                </button>
              </div>
              <form onSubmit={handleFosSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">FOS Name</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00AEEF]/20 outline-none font-semibold text-slate-900 transition-all text-sm"
                    value={fosFormData.name}
                    onChange={(e) => setFosFormData({ ...fosFormData, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Employee ID</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00AEEF]/20 outline-none font-semibold text-slate-900 transition-all text-sm"
                    value={fosFormData.employeeId}
                    onChange={(e) => setFosFormData({ ...fosFormData, employeeId: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Branch</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00AEEF]/20 outline-none font-semibold text-slate-900 transition-all text-sm"
                    value={fosFormData.branch}
                    onChange={(e) => setFosFormData({ ...fosFormData, branch: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Zone</label>
                  <select 
                    required
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00AEEF]/20 outline-none font-semibold text-slate-900 transition-all text-sm appearance-none"
                    value={fosFormData.zone}
                    onChange={(e) => setFosFormData({ ...fosFormData, zone: e.target.value })}
                  >
                    <option value="Central">Central</option>
                    <option value="North">North</option>
                    <option value="South">South</option>
                    <option value="East">East</option>
                    <option value="West">West</option>
                  </select>
                </div>
                <div className="pt-4 flex justify-end gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsFosModalOpen(false)}
                    className="px-6 py-2.5 text-slate-500 hover:bg-slate-50 rounded-xl font-semibold transition-all text-sm"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="px-8 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-all shadow-lg active:scale-95 text-sm"
                  >
                    Add FOS
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Visit Modal */}
      <AnimatePresence>
        {isVisitModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsVisitModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 tracking-tight">{editingVisit ? 'Update Visit Details' : 'Plan New Visit'}</h3>
                  <p className="text-slate-500 text-xs mt-1">{editingVisit ? 'Update the outcome and next steps for this visit.' : 'Schedule a customer visit for an FOS.'}</p>
                </div>
                <button onClick={() => { setIsVisitModalOpen(false); setEditingVisit(null); }} className="w-10 h-10 flex items-center justify-center bg-white rounded-xl text-slate-400 hover:text-[#00AEEF] shadow-sm border border-slate-100 transition-all active:scale-90">
                  <Plus className="rotate-45" size={24} />
                </button>
              </div>
              <form onSubmit={handleVisitSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Select FOS</label>
                    <select 
                      required
                      disabled={!!editingVisit}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00AEEF]/20 outline-none font-semibold text-slate-900 transition-all text-sm appearance-none disabled:opacity-60"
                      value={visitFormData.fosId}
                      onChange={(e) => setVisitFormData({ ...visitFormData, fosId: e.target.value })}
                    >
                      <option value="">Select FOS Member...</option>
                      {fosList.map(fos => (
                        <option key={fos.id} value={fos.id}>{fos.name} ({fos.employeeId})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Customer Name</label>
                    <input 
                      required
                      type="text" 
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00AEEF]/20 outline-none font-semibold text-slate-900 transition-all text-sm"
                      value={visitFormData.customerName}
                      onChange={(e) => setVisitFormData({ ...visitFormData, customerName: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Planned Date</label>
                    <input 
                      required
                      type="date" 
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00AEEF]/20 outline-none font-semibold text-slate-900 transition-all text-sm"
                      value={visitFormData.plannedDate}
                      onChange={(e) => setVisitFormData({ ...visitFormData, plannedDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Status</label>
                    <select 
                      required
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00AEEF]/20 outline-none font-semibold text-slate-900 transition-all text-sm appearance-none"
                      value={visitFormData.status}
                      onChange={(e) => setVisitFormData({ ...visitFormData, status: e.target.value as any })}
                    >
                      <option value="Planned">Planned</option>
                      <option value="Completed">Completed</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>

                {visitFormData.status === 'Completed' && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Business Generated (₹)</label>
                        <input 
                          type="number" 
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00AEEF]/20 outline-none font-semibold text-slate-900 transition-all text-sm"
                          value={visitFormData.businessGenerated}
                          onChange={(e) => setVisitFormData({ ...visitFormData, businessGenerated: Number(e.target.value) })}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Visit Outcome</label>
                        <input 
                          type="text" 
                          placeholder="e.g. Positive, Quotation requested"
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00AEEF]/20 outline-none font-semibold text-slate-900 transition-all text-sm"
                          value={visitFormData.outcome}
                          onChange={(e) => setVisitFormData({ ...visitFormData, outcome: e.target.value })}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Purpose of Visit</label>
                      <textarea 
                        rows={2}
                        placeholder="Describe the purpose and discussion..."
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00AEEF]/20 outline-none font-semibold text-slate-900 transition-all text-sm resize-none"
                        value={visitFormData.purposeOfVisit}
                        onChange={(e) => setVisitFormData({ ...visitFormData, purposeOfVisit: e.target.value })}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Next Follow-up Date</label>
                        <input 
                          type="date" 
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00AEEF]/20 outline-none font-semibold text-slate-900 transition-all text-sm"
                          value={visitFormData.nextFollowUpDate}
                          onChange={(e) => setVisitFormData({ ...visitFormData, nextFollowUpDate: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Next Visit Date</label>
                        <input 
                          type="date" 
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00AEEF]/20 outline-none font-semibold text-slate-900 transition-all text-sm"
                          value={visitFormData.nextVisitDate}
                          onChange={(e) => setVisitFormData({ ...visitFormData, nextVisitDate: e.target.value })}
                        />
                      </div>
                    </div>
                  </>
                )}

                <div className="pt-4 flex justify-end gap-3">
                  <button 
                    type="button"
                    onClick={() => { setIsVisitModalOpen(false); setEditingVisit(null); }}
                    className="px-6 py-2.5 text-slate-500 hover:bg-slate-50 rounded-xl font-semibold transition-all text-sm"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="px-8 py-2.5 bg-[#00AEEF] hover:bg-[#0096ce] text-white rounded-xl font-bold transition-all shadow-lg shadow-[#00AEEF]/20 active:scale-95 text-sm"
                  >
                    {editingVisit ? 'Update Visit' : 'Schedule Visit'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Duplicate Confirmation Modal */}
      <AnimatePresence>
        {isDuplicateModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDuplicateModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200"
            >
              <div className="p-8 border-b border-slate-100 bg-amber-50/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600 shadow-inner">
                    <Zap size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 tracking-tight">
                      {duplicateItems.length === 1 ? 'Quotation Already Exists' : 'Duplicate Quotations Found'}
                    </h3>
                    <p className="text-slate-500 text-sm mt-1">
                      {duplicateItems.length === 1 
                        ? `Quotation ${duplicateItems[0].newData.quoteNo} is already in the system.`
                        : `${duplicateItems.length} quotations already exist in the system.`}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="p-8">
                {duplicateItems.length > 1 && (
                  <div className="max-h-48 overflow-y-auto mb-6 pr-2 custom-scrollbar border border-slate-100 rounded-2xl p-2 bg-slate-50/30">
                    <div className="space-y-2">
                      {duplicateItems.map((dup, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                          <span className="text-sm font-bold text-slate-700">{dup.newData.quoteNo}</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{dup.newData.customer}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-sm text-slate-600 mb-8 leading-relaxed">
                  {duplicateItems.length === 1 
                    ? 'Do you want to replace the existing quotation with this new one, or skip it?'
                    : 'Would you like to replace the existing quotations with these new ones, or skip them and only add the new entries?'}
                </p>

                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => handleDuplicateAction('skip')}
                    disabled={isUploading}
                    className="px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold transition-all active:scale-95 text-sm disabled:opacity-50"
                  >
                    Skip Duplicates
                  </button>
                  <button 
                    onClick={() => handleDuplicateAction('replace')}
                    disabled={isUploading}
                    className="px-6 py-3.5 bg-[#00AEEF] hover:bg-[#0096ce] text-white rounded-2xl font-bold transition-all shadow-lg shadow-[#00AEEF]/20 active:scale-95 text-sm disabled:opacity-50"
                  >
                    {isUploading ? 'Processing...' : 'Replace All'}
                  </button>
                </div>
                
                <button 
                  onClick={() => {
                    setIsDuplicateModalOpen(false);
                    setDuplicateItems([]);
                    setNewBulkItems([]);
                  }}
                  className="w-full mt-4 py-2 text-slate-400 hover:text-slate-600 text-xs font-bold transition-colors"
                >
                  Cancel Upload
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confidence History Modal */}
      <AnimatePresence>
        {historyQuotation && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setHistoryQuotation(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200"
            >
              <div className="p-8 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-[#00AEEF]/10 rounded-2xl flex items-center justify-center text-[#00AEEF]">
                      <History size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 tracking-tight">Confidence History</h3>
                      <p className="text-slate-500 text-sm mt-1">
                        Quotation: <span className="font-bold text-slate-700">{historyQuotation.quoteNo}</span>
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setHistoryQuotation(null)}
                    className="w-10 h-10 flex items-center justify-center bg-white rounded-xl text-slate-400 hover:text-red-500 shadow-sm border border-slate-100 transition-all active:scale-90"
                  >
                    ×
                  </button>
                </div>
              </div>
              
              <div className="p-8">
                <div className="max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                  <div className="space-y-6 relative before:absolute before:left-[23px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                    {historyQuotation.confidenceHistory && historyQuotation.confidenceHistory.length > 0 ? (
                      historyQuotation.confidenceHistory.map((entry, idx) => {
                        const prevEntry = idx > 0 ? historyQuotation.confidenceHistory![idx - 1] : null;
                        const daysDiff = prevEntry 
                          ? differenceInDays(entry.timestamp.toDate(), prevEntry.timestamp.toDate())
                          : null;

                        return (
                          <div key={idx} className="relative pl-12">
                            <div className={`absolute left-0 top-1 w-12 h-12 rounded-2xl flex items-center justify-center border-4 border-white shadow-sm z-10 ${getConfidenceColor(entry.value)}`}>
                              <span className="text-xs font-bold">{entry.value}%</span>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                  {format(entry.timestamp.toDate(), 'MMM dd, yyyy HH:mm')}
                                </span>
                                {daysDiff !== null && (
                                  <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                                    Took {daysDiff} days
                                  </span>
                                )}
                              </div>
                              <p className="text-sm font-medium text-slate-700">
                                {idx === 0 ? 'Initial confidence set' : `Confidence updated to ${entry.value}%`}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-slate-400 text-sm italic">No history available for this quotation.</p>
                      </div>
                    )}
                  </div>
                </div>

                <button 
                  onClick={() => setHistoryQuotation(null)}
                  className="w-full mt-8 py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold transition-all active:scale-95 shadow-lg shadow-slate-900/20"
                >
                  Close History
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmation && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirmation(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200"
            >
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-red-500 mx-auto mb-6">
                  <Trash2 size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Delete Quotation?</h3>
                <p className="text-slate-500 text-sm mb-8">
                  Are you sure you want to delete this quotation? This action cannot be undone.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => setDeleteConfirmation(null)}
                    className="px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold transition-all active:scale-95 text-sm"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={confirmDelete}
                    className="px-6 py-3.5 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-bold transition-all shadow-lg shadow-red-500/20 active:scale-95 text-sm"
                  >
                    Delete Now
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Visit Delete Confirmation Modal */}
      <AnimatePresence>
        {visitToDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setVisitToDelete(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200"
            >
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-red-500 mx-auto mb-6">
                  <Trash2 size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Delete Visit?</h3>
                <p className="text-slate-500 text-sm mb-8">
                  Are you sure you want to delete this visit record? This action cannot be undone.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => setVisitToDelete(null)}
                    className="px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold transition-all active:scale-95 text-sm"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={confirmVisitDelete}
                    className="px-6 py-3.5 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-bold transition-all shadow-lg shadow-red-500/20 active:scale-95 text-sm"
                  >
                    Delete Now
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Master Asset Delete Confirmation Modal */}
      <AnimatePresence>
        {masterAssetToDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMasterAssetToDelete(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200"
            >
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-red-500 mx-auto mb-6">
                  <Trash2 size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Delete Mapping?</h3>
                <p className="text-slate-500 text-sm mb-8">
                  Are you sure you want to delete this asset mapping? This will remove the automatic category suggestion for this asset.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => setMasterAssetToDelete(null)}
                    className="px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold transition-all active:scale-95 text-sm"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={confirmMasterDelete}
                    className="px-6 py-3.5 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-bold transition-all shadow-lg shadow-red-500/20 active:scale-95 text-sm"
                  >
                    Delete Now
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bulk Delete Confirmation Modal */}
      <AnimatePresence>
        {bulkDeleteConfirmation && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setBulkDeleteConfirmation(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200"
            >
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-red-500 mx-auto mb-6">
                  <Trash2 size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">
                  {bulkDeleteConfirmation.collection === 'all' ? 'Wipe Entire Database?' : `Delete All ${bulkDeleteConfirmation.label}?`}
                </h3>
                <p className="text-slate-500 text-sm mb-8 leading-relaxed">
                  {bulkDeleteConfirmation.collection === 'all' 
                    ? "This will permanently delete EVERY SINGLE RECORD (Quotations, FOS, Visits, and Master Assets). This action is irreversible."
                    : `Are you sure you want to delete all ${bulkDeleteConfirmation.label.toLowerCase()}? This action cannot be undone.`}
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => setBulkDeleteConfirmation(null)}
                    className="px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold transition-all active:scale-95 text-sm"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={confirmBulkDelete}
                    className="px-6 py-3.5 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-red-600/20 active:scale-95 text-sm"
                  >
                    Yes, Delete All
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {/* Customer Quotes Modal */}
        {selectedCustomer && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 tracking-tight">{selectedCustomer}</h3>
                  <p className="text-slate-500 text-sm font-medium">All quotations for this customer</p>
                </div>
                <button 
                  onClick={() => setSelectedCustomer(null)}
                  className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400 hover:text-slate-600"
                >
                  <X size={24} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-slate-500 text-[10px] font-bold uppercase tracking-wider border-b border-slate-100">
                        <th className="pb-4">Quote No</th>
                        <th className="pb-4">Item</th>
                        <th className="pb-4">Created Date</th>
                        <th className="pb-4">Status</th>
                        <th className="pb-4">LOB</th>
                        <th className="pb-4 text-right">Value</th>
                        <th className="pb-4 text-right">History</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {quotations
                        .filter(q => q.customer === selectedCustomer)
                        .sort((a, b) => {
                          const dateA = a.quoteLineCreatedDate?.toDate().getTime() || 0;
                          const dateB = b.quoteLineCreatedDate?.toDate().getTime() || 0;
                          return dateB - dateA;
                        })
                        .map((q) => (
                          <tr key={q.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-4 text-sm font-semibold text-slate-900">{q.quoteNo}</td>
                            <td className="py-4 text-sm text-slate-600">{q.item}</td>
                            <td className="py-4 text-sm text-slate-500">
                              {q.quoteLineCreatedDate ? format(q.quoteLineCreatedDate.toDate(), 'dd MMM yyyy') : '-'}
                            </td>
                            <td className="py-4">
                              <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase ${getStatusColor(q.status as any)}`}>
                                {q.status}
                              </span>
                            </td>
                            <td className="py-4 text-xs font-medium text-slate-500">{q.lob}</td>
                            <td className="py-4 text-sm font-bold text-slate-900 text-right">
                              ₹{(q.baseAmount || 0).toLocaleString('en-IN')}
                            </td>
                            <td className="py-4 text-right">
                              <button 
                                onClick={() => setHistoryQuotation(q)}
                                className="p-2 hover:bg-amber-50 text-amber-600 rounded-lg transition-colors"
                                title="Confidence History"
                              >
                                <History size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
              
              <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end">
                <button 
                  onClick={() => setSelectedCustomer(null)}
                  className="px-6 py-2 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 20, x: '-50%' }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] min-w-[320px]"
          >
            <div className={`flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border ${
              toast.type === 'success' 
                ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
                : 'bg-red-50 border-red-100 text-red-800'
            }`}>
              {toast.type === 'success' ? (
                <CheckCircle className="text-emerald-500" size={20} />
              ) : (
                <AlertCircle className="text-red-500" size={20} />
              )}
              <p className="text-sm font-bold">{toast.message}</p>
              <button 
                onClick={() => setToast(null)}
                className="ml-auto text-current opacity-50 hover:opacity-100 transition-opacity"
              >
                ×
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({ title, value, icon, color }: { title: string, value: string | number, icon: React.ReactNode, color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-[#00AEEF] text-white shadow-[#00AEEF]/20',
    green: 'bg-[#8DC63F] text-white shadow-[#8DC63F]/20',
    orange: 'bg-[#F7941E] text-white shadow-[#F7941E]/20',
    slate: 'bg-slate-700 text-white shadow-slate-900/20',
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 shadow-lg ${colors[color]}`}>
        {icon}
      </div>
      <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">{title}</p>
      <h3 className="text-2xl font-bold text-slate-900 mt-1 tracking-tight">{value}</h3>
    </div>
  );
}

function MultiSelect({ options, selected, onChange, placeholder }: { options: string[], selected: string[], onChange: (val: string[]) => void, placeholder: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={`min-h-[42px] w-full px-4 py-2 bg-slate-50 border rounded-xl transition-all flex flex-wrap gap-1.5 items-center cursor-pointer ${isOpen ? 'ring-2 ring-[#00AEEF]/20 border-[#00AEEF]' : 'border-slate-200'}`}
      >
        {selected.length === 0 ? (
          <span className="text-slate-400 text-sm">{placeholder}</span>
        ) : (
          selected.map(item => (
            <span key={item} className="bg-[#00AEEF] text-white text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
              {item}
              <button 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  onChange(selected.filter(l => l !== item)); 
                }} 
                className="hover:text-red-200"
              >
                ×
              </button>
            </span>
          ))
        )}
      </div>
      
      {isOpen && (
        <div className="absolute top-full left-0 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
          <label className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 cursor-pointer transition-colors border-b border-slate-100">
            <input 
              type="checkbox" 
              className="w-4 h-4 rounded border-slate-300 text-[#00AEEF] focus:ring-[#00AEEF]"
              checked={selected.length === options.length && options.length > 0}
              onChange={(e) => {
                if (e.target.checked) onChange(options);
                else onChange([]);
              }}
            />
            <span className="text-sm font-bold text-slate-900 italic">Select All</span>
          </label>
          {options.map(opt => (
            <label key={opt} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 cursor-pointer transition-colors">
              <input 
                type="checkbox" 
                className="w-4 h-4 rounded border-slate-300 text-[#00AEEF] focus:ring-[#00AEEF]"
                checked={selected.includes(opt)}
                onChange={(e) => {
                  if (e.target.checked) onChange([...selected, opt]);
                  else onChange(selected.filter(l => l !== opt));
                }}
              />
              <span className="text-sm font-medium text-slate-700">{opt}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function ChartWrapper({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
      <h3 className="text-lg font-bold text-slate-900 mb-6 tracking-tight">{title}</h3>
      {children}
    </div>
  );
}

function getStatusColor(status: Quotation['status']) {
  switch (status) {
    case 'Submitted': return 'bg-blue-50 text-blue-600';
    case 'Customer Declined': return 'bg-red-50 text-red-600';
    default: return 'bg-neutral-100 text-neutral-600';
  }
}

function getConfidenceColor(level: number) {
  const val = level;
  if (val <= 20) return 'bg-red-50 text-red-600';
  if (val <= 50) return 'bg-amber-50 text-amber-600';
  if (val <= 75) return 'bg-blue-50 text-blue-600';
  if (val <= 100) return 'bg-emerald-50 text-emerald-600';
  return 'bg-neutral-100 text-neutral-600';
}

function getAgeingColor(days: number) {
  if (days <= 15) return 'bg-emerald-500';
  if (days <= 30) return 'bg-blue-500';
  if (days <= 45) return 'bg-amber-500';
  if (days <= 90) return 'bg-orange-500';
  return 'bg-red-500';
}
