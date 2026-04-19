# Guia de Hospedagem na Hostinger (PHP + MySQL)

## Passo 1: Preparar o Banco de Dados

1. Acesse o **Painel de Controle da Hostinger**
2. Vá para **Banco de Dados (MySQL)**
3. Clique em **Criar Novo Banco de Dados**
   - **Nome do Banco**: `livro_historias`
   - **Nome do Usuário**: `seu_usuario`
   - **Senha**: `sua_senha_segura`
   - Clique em **Criar**

4. Clique no banco criado, depois em **phpMyAdmin**
5. Clique em **Importar**
6. Selecione o arquivo `database.sql`
7. Clique em **Ir** para criar as tabelas

## Passo 2: Preparar o Código PHP

1. Edite o arquivo `api.php`:
   - Na linha 14-17, atualize as credenciais:
   ```php
   $db_host = 'localhost';
   $db_user = 'seu_usuario';      // Campo "Nome do Usuário" que criou
   $db_pass = 'sua_senha_segura'; // Senha que define
   $db_name = 'livro_historias';  // Nome do banco que criou
   ```

## Passo 3: Upload para a Hostinger

1. Acesse **Gerenciador de Arquivos** na Hostinger
2. Navegue até a pasta **public_html**
3. Crie uma pasta chamada `livro-de-historias`
4. Upload dos arquivos desta pasta para lá:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `api.php`
   - `.htaccess`
   - Pasta `uploads/` (criar vazia)

## Passo 4: Ajustar Permissões

No **Gerenciador de Arquivos**:
1. Clique com botão direito na pasta `uploads/`
2. **Permissões** → setada para **755**

## Passo 5: Testar

Acesse: `https://seu-dominio.com/livro-de-historias/`

## Troubleshooting

**Erro "Erro ao conectar no banco"**
- Verifique credenciais no `api.php`
- Verifique se o banco está criado

**Erro 404 nas rotas**
- Verifique se o `.htaccess` está upload
- Verifique se mod_rewrite está ativado (contato suporte)

**Erro ao fazer upload de fotos**
- Verifique permissões da pasta `uploads/` (755)

**MySQL error "Access denied"**
- Verifique usuário/senha no `api.php`
- Verifique host (geralmente localhost)
