-- Criação das tabelas para o Livro de Historinhas

CREATE TABLE stories (
  id VARCHAR(36) PRIMARY KEY,
  title VARCHAR(100) NOT NULL,
  author VARCHAR(60) NOT NULL DEFAULT 'Autor(a) anonimo(a)',
  content TEXT NOT NULL,
  photos JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_created_at ON stories(created_at DESC);
