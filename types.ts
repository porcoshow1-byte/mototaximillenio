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

export type PaymentMethod = 'pix' | 'cash' | 'corporate';

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
  email?: string;
  rating: number;
  totalRides: number;
  createdAt?: Date; // Added
  status?: 'active' | 'blocked'; // Added
  avatar?: string;
  type: 'passenger';
  isBlocked?: boolean;
  walletBalance?: number;
  companyId?: string; // Added for Corporate Module
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
  verificationStatus?: 'pending' | 'approved' | 'rejected';
  totalRides?: number;
  email?: string;
  cpf?: string; // Added for registration uniqueness check
  cnhUrl?: string;
  rejectionReason?: string;
}

export interface RideRequest {
  id: string;
  origin: string;
  destination: string;
  originCoords?: Coords;
  destinationCoords?: Coords;
  price: number;
  distance: string;
  duration: string;
  serviceType: ServiceType;
  status: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
  paymentStatus: 'pending' | 'completed' | 'pending_invoice'; // 'pending_invoice' for corporate
  passenger: User;
  driver?: Driver;
  createdAt: number;

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
}

export interface ChatMessage {
  id: string;
  rideId: string;
  senderId: string;
  text: string;
  createdAt: number;
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