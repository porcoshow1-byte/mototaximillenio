-- ============================================
-- MotoJá - Supabase Schema
-- Migração Firebase → Supabase
-- VERSÃO CORRIGIDA: Ordenação das Tabelas e FKs
-- ============================================

-- Primeiro, limpamos qualquer tentativa anterior para começar limpo
-- CUIDADO: Isso apaga os dados dessas tabelas se existirem
DROP TABLE IF EXISTS support_tickets CASCADE;
DROP TABLE IF EXISTS occurrences CASCADE;
DROP TABLE IF EXISTS settings CASCADE;
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS rides CASCADE;
DROP TABLE IF EXISTS companies CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Extensões
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. TABELA: companies (Sem FKs para users ainda)
-- ============================================
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  cnpj TEXT UNIQUE NOT NULL,
  email TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('active', 'blocked', 'pending')),
  address TEXT,
  address_components JSONB,
  logo_url TEXT,
  credit_limit NUMERIC(10,2) DEFAULT 0,
  used_credit NUMERIC(10,2) DEFAULT 0,
  financial_manager TEXT,
  financial_manager_phone TEXT,
  phone TEXT,
  contract_url TEXT,
  owner_uid UUID, -- FK adicionada depois
  trade_name TEXT,
  state_inscription TEXT,
  is_temp_password BOOLEAN DEFAULT false,
  password_hash TEXT,
  settings JSONB DEFAULT '{"billingDay": 1, "autoBlockOverdue": false, "blockToleranceDays": 5}'::jsonb,
  allow_invoicing BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. TABELA: users (Depende de companies se tiver FK, mas vamos criar sem FK primeiro)
-- ============================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  cpf TEXT UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('passenger', 'driver', 'admin', 'company')) DEFAULT 'passenger',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'blocked')),
  avatar TEXT,
  address TEXT,
  address_components JSONB,
  rating NUMERIC(3,2) DEFAULT 5.0,
  total_rides INTEGER DEFAULT 0,
  wallet_balance NUMERIC(10,2) DEFAULT 0,
  wallet_history JSONB DEFAULT '[]'::jsonb,
  coupons JSONB DEFAULT '[]'::jsonb,
  referral_code TEXT,
  favorite_drivers TEXT[] DEFAULT '{}',
  saved_addresses JSONB DEFAULT '[]'::jsonb,
  company_id UUID, -- FK adicionada via ALTER TABLE

  -- Driver-specific fields
  vehicle TEXT,
  plate TEXT,
  location JSONB, -- { lat: number, lng: number }
  driver_status TEXT CHECK (driver_status IN ('online', 'offline', 'busy')),
  earnings_today NUMERIC(10,2) DEFAULT 0,
  verification_status TEXT CHECK (verification_status IN ('pending', 'approved', 'rejected', 'verified')),
  cnh_url TEXT,
  rejection_reason TEXT,

  -- Session control
  active_session_id TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. TABELA: rides
-- ============================================
CREATE TABLE rides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  origin TEXT NOT NULL,
  pickup_reference TEXT,
  destination TEXT NOT NULL,
  origin_coords JSONB, -- { lat, lng }
  destination_coords JSONB, -- { lat, lng }
  route_polyline TEXT,
  price NUMERIC(10,2) NOT NULL,
  distance TEXT,
  duration TEXT,
  service_type TEXT NOT NULL CHECK (service_type IN ('MOTO_TAXI', 'DELIVERY_MOTO', 'DELIVERY_BIKE')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'in_progress', 'completed', 'cancelled')),
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'pending_invoice')),
  payment_method TEXT DEFAULT 'pix',

  -- References (FKs adicionadas via ALTER TABLE para evitar problemas)
  passenger_id UUID,
  passenger JSONB NOT NULL,
  driver_id UUID,
  driver JSONB,
  company_id UUID,
  
  security_code TEXT,
  delivery_details JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);

-- ============================================
-- 4. OUTRAS TABELAS (chat, settings, occurrences, tickets)
-- ============================================

CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ride_id UUID NOT NULL, -- FK depois
  sender_id UUID NOT NULL, -- FK depois
  text TEXT NOT NULL,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE settings (
  id TEXT PRIMARY KEY DEFAULT 'general',
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE occurrences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL CHECK (type IN ('ride_issue', 'payment', 'feedback', 'support_request', 'system', 'new_driver')),
  title TEXT NOT NULL,
  message TEXT,
  read BOOLEAN DEFAULT false,
  protocol TEXT,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'investigating')),
  ride_id UUID, -- FK depois
  passenger_id UUID, -- FK depois
  driver_id UUID, -- FK depois
  ticket_id UUID,
  timeline JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE support_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL CHECK (type IN ('ride_issue', 'payment', 'feedback', 'support_request', 'vehicle_issue', 'other')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved', 'closed')),
  urgency TEXT DEFAULT 'medium' CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
  title TEXT NOT NULL,
  description TEXT,
  user_id UUID NOT NULL, -- FK depois
  user_name TEXT,
  user_role TEXT CHECK (user_role IN ('driver', 'passenger')),
  ride_id TEXT,
  read BOOLEAN DEFAULT false,
  comments JSONB DEFAULT '[]'::jsonb,
  ride_details JSONB,
  attachments TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ADICIONANDO FOREIGN KEYS (FKs)
-- ============================================

-- Users -> Companies
ALTER TABLE users ADD CONSTRAINT fk_users_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;

-- Rides -> Users/Companies
ALTER TABLE rides ADD CONSTRAINT fk_rides_passenger FOREIGN KEY (passenger_id) REFERENCES users(id);
ALTER TABLE rides ADD CONSTRAINT fk_rides_driver FOREIGN KEY (driver_id) REFERENCES users(id);
ALTER TABLE rides ADD CONSTRAINT fk_rides_company FOREIGN KEY (company_id) REFERENCES companies(id);

-- Chat -> Rides/Users
ALTER TABLE chat_messages ADD CONSTRAINT fk_chat_ride FOREIGN KEY (ride_id) REFERENCES rides(id) ON DELETE CASCADE;
ALTER TABLE chat_messages ADD CONSTRAINT fk_chat_sender FOREIGN KEY (sender_id) REFERENCES users(id);

-- Occurrences -> Rides/Users
ALTER TABLE occurrences ADD CONSTRAINT fk_occurrences_ride FOREIGN KEY (ride_id) REFERENCES rides(id);
ALTER TABLE occurrences ADD CONSTRAINT fk_occurrences_passenger FOREIGN KEY (passenger_id) REFERENCES users(id);
ALTER TABLE occurrences ADD CONSTRAINT fk_occurrences_driver FOREIGN KEY (driver_id) REFERENCES users(id);

-- Support Tickets -> Users
ALTER TABLE support_tickets ADD CONSTRAINT fk_tickets_user FOREIGN KEY (user_id) REFERENCES users(id);


-- ============================================
-- ÍNDICES E SEGURANÇA (RLS)
-- ============================================

-- Índices
CREATE INDEX idx_users_auth_id ON users(auth_id);
CREATE INDEX idx_users_type ON users(type);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_rides_status ON rides(status);
CREATE INDEX idx_rides_passenger ON rides(passenger_id);
CREATE INDEX idx_rides_driver ON rides(driver_id);
CREATE INDEX idx_rides_created ON rides(created_at DESC);
CREATE INDEX idx_chat_ride ON chat_messages(ride_id);
CREATE INDEX idx_occurrences_status ON occurrences(status);
CREATE INDEX idx_tickets_status ON support_tickets(status);

-- Habilitar RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE occurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

-- Policies (Permissivas para desenvolvimento)
CREATE POLICY "Dev: allow all on users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Dev: allow all on rides" ON rides FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Dev: allow all on companies" ON companies FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Dev: allow all on settings" ON settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Dev: allow all on occurrences" ON occurrences FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Dev: allow all on support_tickets" ON support_tickets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Dev: allow all on chat" ON chat_messages FOR ALL USING (true) WITH CHECK (true);

-- Triggers para updated_at
CREATE OR REPLACE FUNCTION update_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER companies_updated_at BEFORE UPDATE ON companies FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER rides_updated_at BEFORE UPDATE ON rides FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER occurrences_updated_at BEFORE UPDATE ON occurrences FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tickets_updated_at BEFORE UPDATE ON support_tickets FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER settings_updated_at BEFORE UPDATE ON settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
