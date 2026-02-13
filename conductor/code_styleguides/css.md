# CSS Style Guide - MotoJá

## Design Tokens

### Color Palette

```css
:root {
  /* Primary - Orange (Marca MotoJá) */
  --color-primary: #f97316;
  --color-primary-light: #fb923c;
  --color-primary-dark: #ea580c;

  /* Neutral */
  --color-bg-light: #f9fafb;
  --color-bg-dark: #111827;
  --color-text-primary: #111827;
  --color-text-secondary: #6b7280;
  --color-text-inverse: #ffffff;

  /* Status */
  --color-success: #22c55e;
  --color-warning: #eab308;
  --color-error: #ef4444;
  --color-info: #3b82f6;

  /* Spacing */
  --space-xs: 0.25rem;   /* 4px */
  --space-sm: 0.5rem;    /* 8px */
  --space-md: 1rem;      /* 16px */
  --space-lg: 1.5rem;    /* 24px */
  --space-xl: 2rem;      /* 32px */
  --space-2xl: 3rem;     /* 48px */

  /* Border Radius */
  --radius-sm: 0.375rem;  /* 6px */
  --radius-md: 0.75rem;   /* 12px */
  --radius-lg: 1rem;      /* 16px */
  --radius-xl: 1.5rem;    /* 24px */
  --radius-full: 9999px;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
  --shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.15);

  /* Typography */
  --font-family: 'Inter', system-ui, sans-serif;
  --font-size-xs: 0.75rem;
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.125rem;
  --font-size-xl: 1.25rem;
  --font-size-2xl: 1.5rem;
  --font-size-3xl: 1.875rem;

  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-normal: 300ms ease;
  --transition-slow: 500ms ease;
}
```

## Naming Convention

**BEM-inspired with component prefix:**

```css
/* Componente */
.ride-card { }
.ride-card__header { }
.ride-card__title { }
.ride-card--active { }
.ride-card--cancelled { }
```

## Responsive Breakpoints

```css
/* Mobile first approach */
/* sm: 640px  - Phones landscape */
/* md: 768px  - Tablets */
/* lg: 1024px - Desktop */
/* xl: 1280px - Large desktop */

@media (min-width: 640px) { }
@media (min-width: 768px) { }
@media (min-width: 1024px) { }
@media (min-width: 1280px) { }
```

## Animation Guidelines

```css
/* Animações padrão do projeto */
.animate-fade-in {
  animation: fadeIn var(--transition-normal);
}

.animate-slide-up {
  animation: slideUp var(--transition-normal);
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
```

## General Rules

1. **Mobile first** — Estilos base para mobile, media queries para desktop
2. **CSS Variables** — Sempre usar tokens ao invés de valores hardcoded
3. **Sem !important** — Resolver especificidade com seletores mais específicos
4. **Transições suaves** — Todos os elementos interativos devem ter `transition`
5. **Acessibilidade** — Contraste mínimo 4.5:1, estados de foco visíveis
6. **Dark mode ready** — Usar variáveis CSS para facilitar tema escuro futuro
