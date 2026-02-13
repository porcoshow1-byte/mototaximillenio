# Product Guidelines - MotoJá

## Voice and Tone

**Profissional e técnico, porém amigável e acessível.**

- Documentação técnica: clara, objetiva e bem estruturada
- Interface do usuário: linguagem simples e acolhedora
- Mensagens de erro: explicativas, nunca culpando o usuário
- Notificações: diretas e informativas

### Exemplos

| ❌ Não usar | ✅ Usar |
|-------------|---------|
| "Erro 500: falha interna" | "Ops! Algo deu errado. Tente novamente em instantes." |
| "Input inválido" | "Por favor, insira um endereço válido." |
| "Autenticação falhou" | "E-mail ou senha incorretos. Tente novamente." |

## Design Principles

### 1. Performance em Primeiro Lugar

- Tempo de carregamento < 3 segundos
- Animações suaves (60fps)
- Lazy loading de componentes pesados
- Otimização de imagens e assets

### 2. Foco na Experiência do Desenvolvedor

- Código limpo e autodocumentado
- Componentes reutilizáveis
- Separação clara de responsabilidades (services/, screens/, components/)
- TypeScript estrito para prevenir bugs

### 3. Segurança e Confiabilidade

- Validação de dados em todas as camadas
- Row Level Security (RLS) no Supabase
- Tokens seguros para autenticação
- Tratamento adequado de erros em todas as operações
- Dados sensíveis nunca expostos no frontend
