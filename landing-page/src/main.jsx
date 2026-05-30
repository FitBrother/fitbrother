/**
 * main.jsx — Ponto de entrada da aplicação React
 * 
 * Este arquivo inicializa o React e renderiza o componente principal (App)
 * dentro do elemento #root definido no index.html.
 * 
 * Importa também o arquivo de estilos globais (index.css) que contém
 * todas as variáveis CSS do design system.
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

/* Importa os estilos globais com todas as variáveis CSS */
import './index.css'

/* Importa o componente raiz da aplicação */
import App from './App.jsx'

/**
 * Renderiza a aplicação dentro do modo estrito do React
 * O StrictMode ajuda a identificar problemas potenciais durante o desenvolvimento
 */
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
