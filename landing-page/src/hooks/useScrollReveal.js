// Hook personalizado para animações de scroll-reveal
// Usa IntersectionObserver para detectar quando elementos entram no viewport
// e adiciona a classe 'revealed' para ativar animações CSS
import { useEffect } from 'react';

const useScrollReveal = () => {
  useEffect(() => {
    // Cria um observer que monitora quando elementos cruzam o viewport
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // Quando o elemento entra no viewport, adiciona a classe 'revealed'
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
          }
        });
      },
      // Configurações: 15% do elemento visível, com margem inferior negativa para antecipar
      { threshold: 0.15, rootMargin: '0px 0px -50px 0px' }
    );

    // Seleciona todos os elementos com a classe 'reveal' para observar
    const elements = document.querySelectorAll('.reveal');
    elements.forEach((el) => observer.observe(el));

    // Cleanup: desconecta o observer quando o componente desmonta
    return () => observer.disconnect();
  }, []);
};

export default useScrollReveal;
