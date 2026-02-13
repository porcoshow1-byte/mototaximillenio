# Workflow - MotoJá

## TDD Policy

**Nível: Moderado**

- Testes são incentivados, mas não bloqueiam o desenvolvimento
- Testes obrigatórios para: lógica de pagamentos, cálculo de preços, autenticação
- Testes recomendados para: componentes complexos, serviços de API
- Testes opcionais para: componentes UI simples, estilos

## Commit Strategy

**Padrão: Conventional Commits**

### Formato

```
<tipo>: <descrição curta>

[corpo opcional]
[rodapé opcional]
```

### Tipos permitidos

| Tipo | Uso |
|------|-----|
| `feat` | Nova funcionalidade |
| `fix` | Correção de bug |
| `refactor` | Refatoração sem mudança de comportamento |
| `chore` | Manutenção (deps, configs, CI) |
| `docs` | Documentação |
| `style` | Formatação (sem mudança de lógica) |
| `test` | Adição ou correção de testes |
| `perf` | Melhoria de performance |

### Exemplos

```
feat: adicionar rastreamento GPS em tempo real
fix: corrigir cálculo de preço para bike entregas
refactor: migrar auth de Firebase para Supabase
chore: atualizar dependências do Vite
docs: documentar API de corridas
```

## Code Review

**Política: Obrigatório para mudanças não-triviais**

### Requer revisão

- Novas funcionalidades
- Mudanças em lógica de negócio (preços, pagamentos, auth)
- Alterações de schema/banco de dados
- Mudanças de infraestrutura

### Não requer revisão

- Correção de typos
- Ajustes de estilo/CSS
- Atualizações de documentação
- Bump de dependências (sem breaking changes)

## Verification Checkpoints

**Política: Após cada fase completa**

### Quando verificar

- ✅ Ao completar uma fase inteira de um track
- ✅ Antes de iniciar a próxima fase
- ✅ Após merge de branches significativos

### O que verificar

1. Build sem erros (`npm run build`)
2. App funcional no navegador (dev server)
3. Fluxos críticos testados manualmente (login, corrida, pagamento)
4. Console sem erros relevantes

## Task Lifecycle

```
[ ] Pending → [~] In Progress → [x] Complete
                    ↓
               [!] Blocked (se houver impedimento)
```
