# TypeScript Style Guide - MotoJá

## Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Componentes React | PascalCase | `UserApp`, `DriverApp`, `AuthScreen` |
| Funções/hooks | camelCase | `handlePay`, `useAuth`, `calculatePrice` |
| Constantes | SCREAMING_SNAKE_CASE | `APP_CONFIG`, `MOCK_USER` |
| Arquivos de componente | PascalCase.tsx | `UserApp.tsx`, `ChatModal.tsx` |
| Arquivos de serviço | camelCase.ts | `auth.ts`, `ride.ts`, `map.ts` |
| Interfaces/Types | PascalCase | `User`, `Driver`, `Ride` |
| Enums | PascalCase | `ServiceType`, `Role` |

## File Organization

```
motojá/
├── components/      # Componentes reutilizáveis
├── screens/         # Telas completas (pages)
├── services/        # Lógica de negócio e APIs
├── hooks/           # Custom React hooks
├── context/         # React Context providers
├── utils/           # Utilitários genéricos
├── types.ts         # Tipos globais
├── constants.ts     # Constantes globais
└── App.tsx          # Entry point
```

## Component Structure

```typescript
// 1. Imports (React first, then libs, then local)
import React, { useState, useEffect } from 'react';
import { SomeIcon } from 'lucide-react';
import { someService } from '../services/someService';

// 2. Types/Interfaces
interface MyComponentProps {
  title: string;
  onAction: () => void;
}

// 3. Component (named export preferred)
export const MyComponent = ({ title, onAction }: MyComponentProps) => {
  // 3a. State
  const [loading, setLoading] = useState(false);

  // 3b. Effects
  useEffect(() => {
    // ...
  }, []);

  // 3c. Handlers
  const handleClick = () => {
    // ...
  };

  // 3d. Render
  return (
    <div>
      <h1>{title}</h1>
      <button onClick={handleClick}>Ação</button>
    </div>
  );
};
```

## Service Structure

```typescript
// services/example.ts

// 1. Imports
import { supabase } from './supabase';

// 2. Types (if local to this service)
interface CreateRideParams {
  userId: string;
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
}

// 3. Functions (named exports)
export const createRide = async (params: CreateRideParams) => {
  const { data, error } = await supabase
    .from('rides')
    .insert(params);

  if (error) throw error;
  return data;
};
```

## General Rules

1. **Sempre usar TypeScript estrito** — Evitar `any`, preferir tipos explícitos
2. **Sem `console.log` em produção** — Usar `console.warn` para avisos legítimos
3. **Async/await** — Preferir sobre `.then()` chains
4. **Desestruturação** — Preferir `const { data, error } = ...` sobre `const result = ...`
5. **Early returns** — Reduzir aninhamento com retornos antecipados
6. **Componentes pequenos** — Se um componente tem > 200 linhas, considerar dividir
