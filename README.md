# TIM Recarga - Reprodução Fiel

Reprodução completa e idêntica do site **TIM Recarga** (`https://tim-recarga-beryl.vercel.app`), com layout responsivo mobile-first, design system oficial, validação de DDD brasileiro, seleção dinâmica de valores, order bump e integração Pix com QR Code e Copia e Cola.

---

## 🚀 Funcionalidades

1. **Tela 1: Identificação de Número**
   - Header oficial TIM com menu, minha conta e central de ajuda.
   - Campo de telefone com máscara automática `(XX) XXXXX-XXXX`.
   - Validação de DDDs válidos do Brasil com mensagem de erro caso o DDD seja incorreto.
   - Caixa de conferência do número antes de prosseguir.
   - Banner promocional "TIM PRÉ RENDE MAIS" e botão flutuante do WhatsApp.
   - Rodapé institucional com dados cadastrais e CNPJ.

2. **Tela 2: Seleção de Valor e Pagamento**
   - Banner Meu TIM XIP 5G.
   - Card com número cadastrado e botão de alteração.
   - Seletor de método de pagamento (Pix) com bônus para bancos parceiros (Nubank, C6, Inter).
   - Grade de valores: R$ 20, 25, 30, 35, 40, 50, 70 e 100 (com destaque "Mais escolhido" no R$ 50).
   - **Order Bump**: Opção de crédito extra de +R$ 5 para recargas abaixo de R$ 50.
   - Card de resumo com cálculo em tempo real do total.
   - Barra fixa inferior de pagamento.

3. **Tela 3: Pagamento Pix**
   - Geração de Pix em tempo real via API com fallback automático.
   - Exibição de QR Code oficial e código Pix Copia e Cola.
   - Botão "Copiar código PIX" funcional com feedback visual "Copiado!".
   - Contador regressivo de 15 minutos com expiração.
   - Monitoramento do status do pagamento e instruções detalhadas passo a passo.

4. **Tela 4: Confirmação de Sucesso**
   - Tela de confirmação com valor e número recarregado.
   - Botão de retorno ao início para nova recarga.

---

## 🛠️ Como Executar

### Pré-requisitos
- Node.js instalado (v16 ou superior).

### Passo a passo
1. Abra o terminal na pasta do projeto:
   ```bash
   cd c:\Users\prosperidade\Desktop\Projetos\tim
   ```

2. Inicie o servidor:
   ```bash
   npm start
   # ou
   node server.js
   ```

3. Acesse no navegador:
   ```
   http://localhost:3000 (ou http://localhost:3001)
   ```

> **Nota:** O projeto também pode ser aberto diretamente dando um duplo clique em `index.html` em qualquer navegador sem necessidade de servidor!
"# recarga" 
