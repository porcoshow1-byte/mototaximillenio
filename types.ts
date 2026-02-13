import React from 'react';

export type Role = 'user' | 'driver' | 'admin' | 'company' | 'driver-register' | 'selection';

export enum ServiceType {
  MOTO_TAXI = 'MOTO_TAXI',
  DELIVERY_MOTO = 'DELIVERY_MOTO',
  DELIVERY_BIKE = 'DELIVERY_BIKE'
}

export interface Coords {
  lat: number;
  lng: number;
}

export type PaymentMethod = 'pix' | 'cash' | 'corporate' | 'card' | 'credit_machine' | 'debit_machine' | 'picpay' | 'whatsapp';

export interface Company {
  id: string;
  name: string;
  cnpj: string;
  email: string;
  status: 'active' | 'blocked' | 'pending';
  address?: string;
  logoUrl?: string;
  creditLimit?: number;
  usedCredit?: number;
  financialManager?: string;
  financialManagerPhone?: string;
  phone?: string;
  contractUrl?: string;
  ownerUid?: string;
  tradeName?: string;
  stateInscription?: string;
  addressComponents?: {
    street: string;
    number: string;
    neighborhood: string;
    city: string;
    state: string;
    cep: string;
    complement?: string;
  };
  isTempPassword?: boolean;
  passwordHash?: string;
  settings?: {
    billingDay: number;
    autoBlockOverdue: boolean;
    blockToleranceDays: number;
  };
  allowInvoicing?: boolean;
}

export interface User {
  id: string;
  name: string;
  phone: string;
  cpf?: string; // Added for registration
  address?: string; // Added for registration
  addressComponents?: {
    street: string;
    number: string;
    neighborhood: string;
    city: string;
    state: string;
    cep: string;
    complement?: string;
  };
  email?: string;
  rating: number;
  totalRides: number;
  createdAt?: Date; // Added
  status?: 'active' | 'blocked'; // Added
  avatar?: string;
  type: 'passenger';
  isBlocked?: boolean;
  walletBalance?: number;
  walletHistory?: WalletTransaction[];
  coupons?: Coupon[];
  referralCode?: string; // Indique e Ganhe
  favoriteDrivers?: string[]; // IDs of favorite drivers
  savedAddresses?: SavedAddress[]; // Home, Work, etc.
  companyId?: string; // Added for Corporate Module
}

export interface SavedAddress {
  id: string;
  label: string;
  address: string;
  coords: Coords | null;
  type?: 'home' | 'work' | 'other';
}

export interface Coupon {
  id: string;
  code: string;
  description: string;
  discount: number;
  type: 'percent' | 'fixed';
  expiresAt?: number;
}

export interface WalletTransaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  date: number; // timestamp
  description: string;
}

export interface Driver {
  id: string;
  name: string;
  vehicle: string;
  plate: string;
  rating: number;
  avatar: string;
  location: Coords;
  status: 'online' | 'offline' | 'busy';
  earningsToday: number;
  phone: string;
  verificationStatus?: 'pending' | 'approved' | 'rejected' | 'verified';
  totalRides?: number;
  email?: string;
  cpf?: string; // Added for registration uniqueness check
  cnhUrl?: string;
  rejectionReason?: string;
  createdAt?: number;
}

export interface RideRequest {
  id: string;
  origin: string;
  pickupReference?: string; // Point of reference for driver
  destination: string;
  originCoords?: Coords;
  destinationCoords?: Coords;
  routePolyline?: string;
  price: number;
  distance: string;
  duration: string;
  serviceType: ServiceType;
  status: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
  paymentStatus: 'pending' | 'completed' | 'pending_invoice'; // 'pending_invoice' for corporate
  passenger: User;
  driver?: Driver;
  createdAt: number;
  acceptedAt?: number;
  startedAt?: number;
  completedAt?: number;
  cancelledAt?: number;
  cancellationReason?: string;
  cancellationFee?: number;
  cancelledBy?: 'passenger' | 'driver' | 'admin' | 'system';

  // Payment Details
  paymentMethod?: PaymentMethod;
  companyId?: string; // For corporate billing

  // New fields for Delivery & Security
  securityCode?: string;
  deliveryDetails?: {
    type: 'send' | 'receive';
    contactName: string;
    contactPhone: string;
    instructions?: string;
  };

  // Dispatch Logic
  candidateDriverId?: string;
  rejectedDriverIds?: string[];
}

export interface ChatMessage {
  id: string;
  rideId: string;
  senderId: string;
  text: string;
  createdAt: number;
  status?: 'sent' | 'delivered' | 'read'; // Added for WhatsApp-style ticks
}

export interface AdminStats {
  totalRides: number;
  activeDrivers: number;
  revenue: number;
  pendingApprovals: number;
}

export interface MenuItem {
  id: string;
  icon: React.ReactNode;
}

export interface Occurrence {
  id: string;
  type: 'ride_issue' | 'payment' | 'feedback' | 'support_request' | 'system' | 'new_driver';
  title: string;
  message: string;
  time: number; // Timestamp
  read: boolean;
  protocol?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  rideId?: string;
  passengerId?: string; // Searchable passenger
  driverId?: string;
  ticketId?: string;
  timeline?: Array<{
    id: string;
    type: 'comment' | 'status_change' | 'attachment';
    content: string;
    author: string;
    timestamp: Date;
    attachmentUrl?: string;
  }>;
  status: 'pending' | 'resolved' | 'investigating';
}

export interface Review {
  id: string;
  rideId: string;
  reviewerId: string;
  reviewerName: string; // Denormalized for ease
  reviewedId: string;
  rating: number; // 1-5
  comment?: string;
  createdAt: number;
}